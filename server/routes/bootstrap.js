const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/bootstrap — single endpoint for full state hydration
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [market, companies, leaderboardData] = await Promise.all([
            prisma.marketState.findUnique({ where: { id: 1 } }),
            prisma.company.findMany({
                select: {
                    id: true,
                    name: true,
                    sharePrice: true,
                    sharesAvailable: true,
                    totalShares: true,
                    stockEnabled: true,
                    totalValuation: true,
                    cashBalance: true,
                    stockPercent: true,
                },
                orderBy: { name: 'asc' },
            }),
            (async () => {
                const { calculateLeaderboard } = require('./trades');
                return calculateLeaderboard();
            })(),
        ]);

        const responseData = {
            market: market || { isOpen: false, sellWithdrawCooldownSec: 60 },
            companies,
            leaderboard: leaderboardData,
        };

        // If user has a company, also include their company details and holdings (for any role)
        if (req.user.companyId) {
            const [myCompany, holdings, personalTrades] = await Promise.all([
                prisma.company.findUnique({ where: { id: req.user.companyId } }),
                prisma.holding.findMany({
                    where: { ownerCompanyId: req.user.companyId },
                    include: { targetCompany: { select: { name: true, sharePrice: true } } },
                }),
                prisma.trade.findMany({
                    where: {
                        OR: [
                            { buyerCompanyId: req.user.companyId },
                            { sellerCompanyId: req.user.companyId },
                        ],
                    },
                    include: {
                        buyer: { select: { name: true } },
                        seller: { select: { name: true } },
                    },
                    orderBy: { timestamp: 'desc' },
                    take: 50,
                }),
            ]);

            responseData.myCompany = myCompany;
            responseData.holdings = holdings;
            responseData.recentPersonalTrades = personalTrades; // Separate from global trades
            if (!responseData.recentTrades) responseData.recentTrades = personalTrades;
        }

        // If admin, include global data
        if (req.user.role === 'ADMIN') {
            const [globalTrades, events, participants] = await Promise.all([
                prisma.trade.findMany({
                    include: {
                        buyer: { select: { name: true } },
                        seller: { select: { name: true } },
                    },
                    orderBy: { timestamp: 'desc' },
                    take: 100,
                }),
                prisma.fluctuationEvent.findMany({
                    include: { targets: true },
                    orderBy: { id: 'desc' },
                }),
                prisma.user.findMany({
                    where: { role: 'PARTICIPANT' },
                    include: { company: true },
                    orderBy: { id: 'asc' },
                }),
            ]);

            responseData.recentTrades = globalTrades;
            responseData.events = events;
            responseData.participants = participants;
        }

        // If stats, include monitoring data
        if (req.user.role === 'STATS') {
            const [globalTrades, events] = await Promise.all([
                prisma.trade.findMany({
                    include: {
                        buyer: { select: { name: true } },
                        seller: { select: { name: true } },
                    },
                    orderBy: { timestamp: 'desc' },
                    take: 100,
                }),
                prisma.fluctuationEvent.findMany({
                    include: { targets: true },
                    orderBy: { id: 'desc' },
                }),
            ]);
            responseData.recentTrades = globalTrades;
            responseData.events = events;
        }

        // Additional STATS-only data (charts/history)
        if (req.user.role === 'STATS') {
            const [networthHistory, mostTraded, sessionSnapshot, heatmap, achievements] = await Promise.all([
                // Networth history
                (async () => {
                    const companies = await prisma.company.findMany({
                        include: {
                            netWorthSnapshots: {
                                orderBy: { recordedAt: 'asc' },
                                select: { recordedAt: true, netWorth: true, cash: true }
                            }
                        }
                    });
                    return companies.map(c => ({
                        companyId: c.id,
                        companyName: c.name,
                        snapshots: c.netWorthSnapshots
                    }));
                })(),
                // Most traded
                (async () => {
                    const companies = await prisma.company.findMany();
                    const trades = await prisma.trade.findMany();
                    return companies.map(c => {
                        const involving = trades.filter(t => t.buyerCompanyId === c.id || t.sellerCompanyId === c.id);
                        return {
                            companyId: c.id,
                            name: c.name,
                            tradeCount: involving.length,
                            totalVolume: involving.reduce((sum, t) => sum + t.total, 0)
                        };
                    });
                })(),
                // Session snapshot
                (async () => {
                    const trades = await prisma.trade.findMany();
                    return {
                        totalTradeVolume: trades.reduce((sum, t) => sum + t.total, 0),
                        totalTrades: trades.length,
                        marketStatus: (await prisma.marketState.findUnique({ where: { id: 1 } }))?.isOpen ? 'OPEN' : 'CLOSED'
                    };
                })(),
                // Heatmap
                prisma.company.findMany().then(companies => companies.map(c => ({
                    id: c.id,
                    name: c.name,
                    currentPrice: c.sharePrice,
                    startPrice: 10,
                    changePercent: ((c.sharePrice - 10) / 10) * 100
                }))),
                prisma.announcement.findMany({
                    where: { type: 'ACHIEVEMENT' },
                    orderBy: { createdAt: 'desc' },
                    take: 20
                })
            ]);

            responseData.networthHistory = networthHistory;
            responseData.mostTraded = mostTraded;
            responseData.sessionSnapshot = sessionSnapshot;
            responseData.heatmap = heatmap;
            responseData.recentAchievements = achievements;
        }

        // Active events for all users
        const activeEvents = await prisma.fluctuationEvent.findMany({
            where: { active: true },
            select: { id: true, name: true, description: true, currentStep: true, totalSteps: true, lastFiredAt: true },
        });
        responseData.activeEvents = activeEvents;

        res.json(responseData);
    } catch (err) {
        console.error('Bootstrap error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
