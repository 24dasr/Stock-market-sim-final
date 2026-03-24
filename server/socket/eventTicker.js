const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Store active intervals by eventId
const activeIntervals = new Map();

async function startEventTicker(eventId, io) {
    // Don't start if already running
    if (activeIntervals.has(eventId)) return;

    const event = await prisma.fluctuationEvent.findUnique({
        where: { id: eventId },
        include: { targets: true },
    });

    if (!event || !event.active) return;

    const remainingSteps = event.totalSteps - event.currentStep;
    if (remainingSteps <= 0) {
        await endEvent(eventId, io);
        return;
    }

    console.log(`⏱️  Starting ticker for event ${eventId}: ${remainingSteps} steps remaining, ${event.intervalMs}ms interval`);

    const intervalId = setInterval(async () => {
        try {
            const currentEvent = await prisma.fluctuationEvent.findUnique({
                where: { id: eventId },
                include: { targets: true },
            });

            if (!currentEvent || !currentEvent.active) {
                clearInterval(intervalId);
                activeIntervals.delete(eventId);
                return;
            }

            // Apply drift to each target
            for (const target of currentEvent.targets) {
                const company = await prisma.company.findUnique({ where: { id: target.companyId } });
                if (!company) continue;

                const multiplier = target.driftDirection === 'UP'
                    ? (1 + target.driftPercent / 100)
                    : (1 - target.driftPercent / 100);
                const newPrice = Math.max(0.01, company.sharePrice * multiplier);
                const delta = newPrice - company.sharePrice;
                const deltaPercent = company.sharePrice > 0 ? (delta / company.sharePrice) * 100 : 0;

                // Recalculate total valuation based on new share price
                const newTotalValuation = company.stockPercent > 0
                    ? (company.totalShares * newPrice) / (company.stockPercent / 100)
                    : company.totalValuation;

                await prisma.company.update({
                    where: { id: target.companyId },
                    data: { sharePrice: newPrice, totalValuation: newTotalValuation },
                });

                const { recordStockPrice } = require('../utils/history');
                await recordStockPrice(target.companyId, newPrice, prisma);

                io.to('market').emit('price:update', {
                    companyId: target.companyId,
                    newPrice,
                    delta,
                    deltaPercent,
                });
            }

            // Increment step
            const newStep = currentEvent.currentStep + 1;
            await prisma.fluctuationEvent.update({
                where: { id: eventId },
                data: { currentStep: newStep },
            });

            io.to('market').emit('event:tick', {
                eventId,
                currentStep: newStep,
                totalSteps: currentEvent.totalSteps,
            });

            // Check if complete
            if (newStep >= currentEvent.totalSteps) {
                await endEvent(eventId, io);
            }

            // Broadcast leaderboard update
            const { calculateLeaderboard } = require('../routes/trades');
            const leaderboard = await calculateLeaderboard();
            io.to('market').emit('leaderboard:update', leaderboard);

        } catch (err) {
            console.error(`❌ Event ticker error (event ${eventId}):`, err);
        }
    }, event.intervalMs);

    activeIntervals.set(eventId, intervalId);
}

async function endEvent(eventId, io) {
    const intervalId = activeIntervals.get(eventId);
    if (intervalId) {
        clearInterval(intervalId);
        activeIntervals.delete(eventId);
    }

    try {
        await prisma.fluctuationEvent.update({
            where: { id: eventId },
            data: { active: false },
        });
    } catch (err) {
        // Event may have been deleted
    }

    io.to('market').emit('event:ended', { eventId });
    console.log(`✅ Event ${eventId} completed`);
}

function pauseEventTicker(eventId) {
    const intervalId = activeIntervals.get(eventId);
    if (intervalId) {
        clearInterval(intervalId);
        activeIntervals.delete(eventId);
        console.log(`⏸️  Event ${eventId} paused`);
    }
}

function stopEventTicker(eventId) {
    pauseEventTicker(eventId);
    console.log(`⏹️  Event ${eventId} stopped`);
}

// Resume active events on server restart
async function resumeActiveEvents(io) {
    try {
        const activeEvents = await prisma.fluctuationEvent.findMany({
            where: { active: true },
        });

        for (const event of activeEvents) {
            console.log(`🔄 Resuming event ${event.id}: ${event.name}`);
            startEventTicker(event.id, io);
        }

        if (activeEvents.length > 0) {
            console.log(`🔄 Resumed ${activeEvents.length} active events`);
        }
    } catch (err) {
        console.error('Error resuming events:', err);
    }
}

module.exports = {
    startEventTicker,
    pauseEventTicker,
    stopEventTicker,
    resumeActiveEvents,
};
