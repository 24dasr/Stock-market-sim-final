const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEBOUNCE_TIME = 5000; // 5 seconds
const lastSnapshot = new Map(); // companyId -> timestamp

let lastGlobalSnapshot = 0;
const GLOBAL_DEBOUNCE = 30000;

async function recordSnapshots() {
    const now = Date.now();
    if (now - lastGlobalSnapshot < GLOBAL_DEBOUNCE) return;
    lastGlobalSnapshot = now;

    try {
        const companies = await prisma.company.findMany({
            include: {
                holdings: {
                    include: { targetCompany: true }
                }
            }
        });

        const snapshots = companies.map(c => {
            const portfolioValue = c.holdings.reduce((sum, h) => {
                return sum + (h.shares * h.targetCompany.sharePrice);
            }, 0);
            const netWorth = c.cashBalance + portfolioValue;

            return prisma.netWorthSnapshot.create({
                data: {
                    companyId: c.id,
                    netWorth,
                    cash: c.cashBalance,
                    portfolioValue
                }
            });
        });

        await Promise.all(snapshots);
    } catch (err) {
        console.error('Error recording net worth snapshots:', err);
    }
}

async function recordCompanySnapshot(companyId) {
    const now = Date.now();
    const last = lastSnapshot.get(companyId) || 0;

    if (now - last < DEBOUNCE_TIME) return;

    try {
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: {
                holdings: {
                    include: { targetCompany: true }
                }
            }
        });

        if (!company) return;

        const portfolioValue = company.holdings.reduce((sum, h) => {
            return sum + (h.shares * h.targetCompany.sharePrice);
        }, 0);
        const netWorth = company.cashBalance + portfolioValue;

        await prisma.netWorthSnapshot.create({
            data: {
                companyId,
                netWorth,
                cash: company.cashBalance,
                portfolioValue
            }
        });

        lastSnapshot.set(companyId, now);
    } catch (err) {
        console.error(`Error recording snapshot for company ${companyId}:`, err);
    }
}

function startStatsJob() {
    // Run every 60 seconds
    setInterval(recordSnapshots, 60000);
}

module.exports = { startStatsJob, recordCompanySnapshot, recordSnapshots };
