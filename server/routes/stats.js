const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const prisma = new PrismaClient();

// Only STATS or ADMIN can access these routes
router.use(authenticateToken, requireRole('STATS', 'ADMIN'));

// GET /api/stats/networth-history
router.get('/networth-history', async (req, res) => {
    try {
        const companies = await prisma.company.findMany({
            include: {
                netWorthSnapshots: {
                    orderBy: { recordedAt: 'asc' },
                    select: { recordedAt: true, netWorth: true }
                }
            }
        });

        const result = companies.map(c => ({
            companyId: c.id,
            companyName: c.name,
            snapshots: c.netWorthSnapshots
        }));

        res.json(result);
    } catch (err) {
        console.error('Networth history error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/liquidity-history
router.get('/liquidity-history', async (req, res) => {
    try {
        const companies = await prisma.company.findMany({
            include: {
                netWorthSnapshots: {
                    orderBy: { recordedAt: 'asc' },
                    select: { recordedAt: true, cash: true }
                }
            }
        });

        const result = companies.map(c => ({
            companyId: c.id,
            companyName: c.name,
            snapshots: c.netWorthSnapshots.map(s => ({ recordedAt: s.recordedAt, cash: s.cash }))
        }));

        res.json(result);
    } catch (err) {
        console.error('Liquidity history error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/most-traded
router.get('/most-traded', async (req, res) => {
    try {
        const companies = await prisma.company.findMany();
        const trades = await prisma.trade.findMany();

        const tradeStats = companies.map(c => {
            const involvingTrades = trades.filter(t => t.buyerCompanyId === c.id || t.sellerCompanyId === c.id);
            return {
                companyId: c.id,
                name: c.name,
                tradeCount: involvingTrades.length,
                totalVolume: involvingTrades.reduce((sum, t) => sum + t.total, 0)
            };
        }).sort((a, b) => b.tradeCount - a.tradeCount);

        res.json(tradeStats);
    } catch (err) {
        console.error('Most traded error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/session-snapshot
router.get('/session-snapshot', async (req, res) => {
    try {
        const trades = await prisma.trade.findMany({
            include: { buyer: true, seller: true }
        });
        const companies = await prisma.company.findMany();
        const marketState = await prisma.marketState.findUnique({ where: { id: 1 } });

        const totalTradeVolume = trades.reduce((sum, t) => sum + t.total, 0);
        const totalTrades = trades.length;
        const biggestTrade = trades.length > 0 ? trades.sort((a, b) => b.total - a.total)[0] : null;

        // Bigest single gainer/loser
        let biggestGainer = null;
        let biggestLoser = null;
        if (companies.length > 0) {
            const sorted = [...companies].map(c => ({
                name: c.name,
                change: ((c.sharePrice - 10) / 10) * 100 // Hardcoded base 10 for now
            })).sort((a, b) => b.change - a.change);
            biggestGainer = sorted[0];
            biggestLoser = sorted[sorted.length - 1];
        }

        // Most active trader
        const activityMap = {};
        trades.forEach(t => {
            activityMap[t.buyerCompanyId] = (activityMap[t.buyerCompanyId] || 0) + 1;
            activityMap[t.sellerCompanyId] = (activityMap[t.sellerCompanyId] || 0) + 1;
        });
        let mostActiveId = null;
        let maxCount = 0;
        Object.entries(activityMap).forEach(([id, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostActiveId = parseInt(id);
            }
        });
        const mostActiveTrader = mostActiveId ? companies.find(c => c.id === mostActiveId)?.name : 'N/A';

        res.json({
            totalTradeVolume,
            totalTrades,
            biggestSingleTrade: biggestTrade ? `$${biggestTrade.total.toLocaleString()} by ${biggestTrade.buyer.name} from ${biggestTrade.seller.name}` : 'N/A',
            mostActiveTrader: `${mostActiveTrader} (${maxCount} trades)`,
            biggestGainer: biggestGainer ? `${biggestGainer.name} (+${biggestGainer.change.toFixed(1)}%)` : 'N/A',
            biggestLoser: biggestLoser ? `${biggestLoser.name} (${biggestLoser.change.toFixed(1)}%)` : 'N/A',
            marketStatus: marketState?.isOpen ? 'OPEN' : 'CLOSED'
        });
    } catch (err) {
        console.error('Session snapshot error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/stats/heatmap
router.get('/heatmap', async (req, res) => {
    try {
        const companies = await prisma.company.findMany();
        const result = companies.map(c => {
            const startPrice = 10; // BASE price
            const changePercent = ((c.sharePrice - startPrice) / startPrice) * 100;
            return {
                id: c.id,
                name: c.name,
                currentPrice: c.sharePrice,
                startPrice,
                changePercent
            };
        });
        res.json(result);
    } catch (err) {
        console.error('Heatmap error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
