const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const prisma = new PrismaClient();

router.use(authenticateToken, requireRole('ADMIN'));

// GET /api/events — list all events
router.get('/', async (req, res) => {
    try {
        const events = await prisma.fluctuationEvent.findMany({
            include: { targets: true },
            orderBy: { id: 'desc' },
        });
        res.json(events);
    } catch (err) {
        console.error('List events error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/events — create fluctuation event
router.post('/', async (req, res) => {
    try {
        const { name, description, intervalMs, totalSteps, targets } = req.body;

        if (!name || !description || !intervalMs || !totalSteps || !targets || !targets.length) {
            return res.status(400).json({ error: 'All fields required (name, description, intervalMs, totalSteps, targets)' });
        }

        const event = await prisma.fluctuationEvent.create({
            data: {
                name,
                description,
                intervalMs,
                totalSteps,
                targets: {
                    create: targets.map(t => ({
                        companyId: t.companyId,
                        onsetDirection: t.onsetDirection,
                        onsetPercent: t.onsetPercent,
                        driftDirection: t.driftDirection,
                        driftPercent: t.driftPercent,
                    })),
                },
            },
            include: { targets: true },
        });

        res.status(201).json(event);
    } catch (err) {
        console.error('Create event error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/events/:id/fire — trigger event
router.post('/:id/fire', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id);
        const event = await prisma.fluctuationEvent.findUnique({
            where: { id: eventId },
            include: { targets: true },
        });

        if (!event) return res.status(404).json({ error: 'Event not found' });
        if (event.active) return res.status(400).json({ error: 'Event is already active' });

        // Apply onset shock
        const affectedCompanyIds = [];
        for (const target of event.targets) {
            const company = await prisma.company.findUnique({ where: { id: target.companyId } });
            if (!company) continue;

            const multiplier = target.onsetDirection === 'UP'
                ? (1 + target.onsetPercent / 100)
                : (1 - target.onsetPercent / 100);
            const newPrice = Math.max(0.01, company.sharePrice * multiplier);
            const delta = newPrice - company.sharePrice;
            const deltaPercent = company.sharePrice > 0 ? (delta / company.sharePrice) * 100 : 0;

            await prisma.company.update({
                where: { id: target.companyId },
                data: { sharePrice: newPrice },
            });

            const { recordStockPrice } = require('../utils/history');
            await recordStockPrice(target.companyId, newPrice, prisma);

            affectedCompanyIds.push(target.companyId);

            if (req.io) {
                req.io.to('market').emit('price:update', {
                    companyId: target.companyId,
                    newPrice,
                    delta,
                    deltaPercent,
                });
            }
        }

        // Set event as active
        await prisma.fluctuationEvent.update({
            where: { id: eventId },
            data: { active: true, currentStep: 0 },
        });

        // Broadcast event fired
        if (req.io) {
            req.io.to('market').emit('event:fired', {
                eventId,
                name: event.name,
                description: event.description,
                affectedCompanyIds,
            });

            // Start ticking
            const { startEventTicker } = require('../socket/eventTicker');
            startEventTicker(eventId, req.io);

            // Leaderboard update
            const { calculateLeaderboard } = require('./trades');
            const leaderboard = await calculateLeaderboard();
            req.io.to('market').emit('leaderboard:update', leaderboard);
        }

        res.json({ message: 'Event fired', eventId });
    } catch (err) {
        console.error('Fire event error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/events/:id/pause
router.post('/:id/pause', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id);
        const { pauseEventTicker } = require('../socket/eventTicker');
        pauseEventTicker(eventId);

        await prisma.fluctuationEvent.update({
            where: { id: eventId },
            data: { active: false },
        });

        res.json({ message: 'Event paused' });
    } catch (err) {
        console.error('Pause event error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/events/:id/stop
router.post('/:id/stop', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id);
        const { stopEventTicker } = require('../socket/eventTicker');
        stopEventTicker(eventId);

        await prisma.fluctuationEvent.update({
            where: { id: eventId },
            data: { active: false, currentStep: 0 },
        });

        if (req.io) {
            req.io.to('market').emit('event:ended', { eventId });
        }

        res.json({ message: 'Event stopped' });
    } catch (err) {
        console.error('Stop event error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
    try {
        const eventId = parseInt(req.params.id);
        const { stopEventTicker } = require('../socket/eventTicker');
        stopEventTicker(eventId);

        await prisma.fluctuationEvent.delete({ where: { id: eventId } });
        res.json({ message: 'Event deleted' });
    } catch (err) {
        console.error('Delete event error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/events/announcements
router.get('/announcements', async (req, res) => {
    try {
        const announcements = await prisma.announcement.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.json(announcements);
    } catch (err) {
        console.error('List announcements error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
