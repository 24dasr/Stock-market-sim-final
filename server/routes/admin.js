const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { createObjectCsvStringifier } = require('csv-writer');

const prisma = new PrismaClient();

// All routes require admin
router.use(authenticateToken, requireRole('ADMIN'));

// GET /api/admin/users — list all participant accounts
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { role: 'PARTICIPANT' },
            include: { company: true },
            orderBy: { id: 'asc' },
        });
        res.json(users.map(u => ({
            id: u.id,
            username: u.username,
            role: u.role,
            company: u.company,
        })));
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/admin/users — create participant + linked company
router.post('/users', async (req, res) => {
    try {
        const { username, password, companyName, totalValuation, stockPercent, cashBalance, sharesAvailable } = req.body;

        if (!username || !password || !companyName || totalValuation == null || stockPercent == null || cashBalance == null) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const stockValue = totalValuation * (stockPercent / 100);
        const totalShares = Math.floor(stockValue / 10); // $10 per share base
        const sharePrice = totalShares > 0 ? stockValue / totalShares : 0;
        const availableShares = Math.min(sharesAvailable || totalShares, totalShares);

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    role: 'PARTICIPANT',
                },
            });

            const company = await tx.company.create({
                data: {
                    name: companyName,
                    userId: user.id,
                    totalValuation,
                    stockPercent,
                    totalShares,
                    sharesAvailable: availableShares,
                    sharePrice,
                    cashBalance,
                },
            });

            await tx.stockHistory.create({
                data: {
                    companyId: company.id,
                    price: sharePrice
                }
            });

            return { user, company };
        });

        res.status(201).json({
            id: result.user.id,
            username: result.user.username,
            company: result.company,
        });
    } catch (err) {
        console.error('Create user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { company: true },
        });

        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'ADMIN') return res.status(403).json({ error: 'Cannot delete admin accounts' });

        await prisma.$transaction(async (tx) => {
            if (user.company) {
                // Delete holdings where this company is owner or target
                await tx.holding.deleteMany({ where: { ownerCompanyId: user.company.id } });
                await tx.holding.deleteMany({ where: { targetCompanyId: user.company.id } });
                // Delete fluctuation targets for this company
                await tx.fluctuationTarget.deleteMany({ where: { companyId: user.company.id } });
                // Delete trades where this company is buyer or seller
                await tx.trade.deleteMany({ where: { OR: [{ buyerCompanyId: user.company.id }, { sellerCompanyId: user.company.id }] } });
                // Delete company
                await tx.company.delete({ where: { id: user.company.id } });
            }
            await tx.user.delete({ where: { id: userId } });
        });

        res.json({ message: 'User and company deleted' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/trades — all trades with filters
router.get('/trades', async (req, res) => {
    try {
        const { companyId, from, to, role } = req.query;
        const where = {};

        if (companyId) {
            const cid = parseInt(companyId);
            if (role === 'buyer') {
                where.buyerCompanyId = cid;
            } else if (role === 'seller') {
                where.sellerCompanyId = cid;
            } else {
                where.OR = [{ buyerCompanyId: cid }, { sellerCompanyId: cid }];
            }
        }

        if (from || to) {
            where.timestamp = {};
            if (from) where.timestamp.gte = new Date(from);
            if (to) where.timestamp.lte = new Date(to);
        }

        const trades = await prisma.trade.findMany({
            where,
            include: {
                buyer: { select: { name: true } },
                seller: { select: { name: true } },
            },
            orderBy: { timestamp: 'desc' },
        });

        res.json(trades);
    } catch (err) {
        console.error('Get trades error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/trades/export — CSV export
router.get('/trades/export', async (req, res) => {
    try {
        const trades = await prisma.trade.findMany({
            include: {
                buyer: { select: { name: true } },
                seller: { select: { name: true } },
            },
            orderBy: { timestamp: 'desc' },
        });

        const csvStringifier = createObjectCsvStringifier({
            header: [
                { id: 'transactionId', title: 'Transaction ID' },
                { id: 'timestamp', title: 'Time' },
                { id: 'buyer', title: 'Buyer' },
                { id: 'shares', title: 'Shares' },
                { id: 'seller', title: 'Seller' },
                { id: 'pricePerShare', title: 'Price Per Share' },
                { id: 'total', title: 'Total Value' },
                { id: 'type', title: 'Trade Type' }
            ],
        });

        const records = trades.map(t => ({
            transactionId: `TXN-${String(t.serialNumber).padStart(6, '0')}`,
            timestamp: t.timestamp.toISOString(),
            buyer: t.buyer.name,
            shares: t.shares,
            seller: t.seller.name,
            pricePerShare: t.pricePerShare,
            total: t.total,
            type: t.type
        }));

        const csvString = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="trades.csv"');
        res.send(csvString);
    } catch (err) {
        console.error('Export trades error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/admin/reset — delete all companies, users, trades, events, and holdings
router.post('/reset', async (req, res) => {
    try {
        await prisma.$transaction(async (tx) => {
            // Delete all records linked to markets
            await tx.fluctuationTarget.deleteMany();
            await tx.fluctuationEvent.deleteMany();
            await tx.trade.deleteMany();
            await tx.holding.deleteMany();
            await tx.stockHistory.deleteMany();
            await tx.company.deleteMany();

            // Delete all participant users
            await tx.user.deleteMany({ where: { role: 'PARTICIPANT' } });

            // Close the market
            await tx.marketState.upsert({
                where: { id: 1 },
                update: { isOpen: false },
                create: { id: 1, isOpen: false },
            });
        });

        req.io.emit('market:status', { isOpen: false });
        res.json({ message: 'System reset successfully' });
    } catch (err) {
        console.error('System reset error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/admin/config — update global market settings
router.patch('/config', async (req, res) => {
    try {
        const { sellWithdrawCooldownSec } = req.body;

        const market = await prisma.marketState.upsert({
            where: { id: 1 },
            update: {
                sellWithdrawCooldownSec: sellWithdrawCooldownSec !== undefined ? parseInt(sellWithdrawCooldownSec) : undefined
            },
            create: {
                id: 1,
                sellWithdrawCooldownSec: sellWithdrawCooldownSec !== undefined ? parseInt(sellWithdrawCooldownSec) : 60
            },
        });

        res.json(market);
    } catch (err) {
        console.error('Update config error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/analytics — system analytics
router.get('/analytics', async (req, res) => {
    try {
        const companies = await prisma.company.findMany();
        const trades = await prisma.trade.findMany();
        const users = await prisma.user.count({ where: { role: 'PARTICIPANT' } });

        const totalMarketCap = companies.reduce((acc, c) => acc + c.totalValuation, 0);
        const totalTradeVolume = trades.reduce((acc, t) => acc + t.total, 0);
        const totalTrades = trades.length;

        let topGainer = null;
        let topLoser = null;
        let mostActiveTrader = null;

        if (companies.length > 0) {
            let maxGain = -Infinity;
            let maxLoss = Infinity;

            for (const c of companies) {
                const basePrice = 10; // Initial share price
                const gain = c.sharePrice - basePrice;
                const gainPercent = (gain / basePrice) * 100;

                if (gainPercent > maxGain) {
                    maxGain = gainPercent;
                    topGainer = { company: c.name, gainPercent };
                }
                if (gainPercent < maxLoss) {
                    maxLoss = gainPercent;
                    topLoser = { company: c.name, lossPercent: gainPercent };
                }
            }
        }

        if (trades.length > 0) {
            const volumeMap = {};
            for (const t of trades) {
                volumeMap[t.buyerCompanyId] = (volumeMap[t.buyerCompanyId] || 0) + t.total;
                volumeMap[t.sellerCompanyId] = (volumeMap[t.sellerCompanyId] || 0) + t.total;
            }

            let maxVol = -1;
            let activeTraderId = null;
            for (const [id, vol] of Object.entries(volumeMap)) {
                if (vol > maxVol) {
                    maxVol = vol;
                    activeTraderId = parseInt(id);
                }
            }

            if (activeTraderId) {
                const c = companies.find(c => c.id === activeTraderId);
                if (c) {
                    mostActiveTrader = { company: c.name, volume: maxVol };
                }
            }
        }

        res.json({
            totalMarketCap,
            totalTradeVolume,
            totalTrades,
            totalCompanies: companies.length,
            totalUsers: users,
            topGainer,
            topLoser,
            mostActiveTrader
        });

    } catch (err) {
        console.error('Get analytics error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/admin/export-all — export all data as JSON
router.get('/export-all', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: { company: true }
        });
        const companies = await prisma.company.findMany({
            include: { holdings: true }
        });
        const trades = await prisma.trade.findMany();
        const events = await prisma.fluctuationEvent.findMany({
            include: { targets: true }
        });
        const marketState = await prisma.marketState.findUnique({ where: { id: 1 } });

        const exportData = {
            timestamp: new Date().toISOString(),
            marketState,
            users,
            companies,
            trades,
            events
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="stxsim_full_export.json"');
        res.send(JSON.stringify(exportData, null, 2));
    } catch (err) {
        console.error('Export all error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
