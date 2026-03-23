const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const prisma = new PrismaClient();

// PATCH /api/companies/:id — admin edit company (any field)
router.patch('/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
        const companyId = parseInt(req.params.id);
        const { name, totalValuation, stockPercent, cashBalance, sharePrice, sharesAvailable, stockEnabled } = req.body;

        const company = await prisma.company.findUnique({ where: { id: companyId } });
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (cashBalance !== undefined) updateData.cashBalance = cashBalance;
        if (sharePrice !== undefined) updateData.sharePrice = sharePrice;
        if (stockEnabled !== undefined) updateData.stockEnabled = stockEnabled;
        if (sharesAvailable !== undefined) updateData.sharesAvailable = sharesAvailable;

        if (totalValuation !== undefined || stockPercent !== undefined) {
            const newValuation = totalValuation !== undefined ? totalValuation : company.totalValuation;
            const newStockPercent = stockPercent !== undefined ? stockPercent : company.stockPercent;
            const stockValue = newValuation * (newStockPercent / 100);
            const newTotalShares = Math.floor(stockValue / (company.sharePrice || 10));

            updateData.totalValuation = newValuation;
            updateData.stockPercent = newStockPercent;
            updateData.totalShares = newTotalShares;

            // Proportionally adjust available shares
            if (company.totalShares > 0) {
                const ratio = newTotalShares / company.totalShares;
                updateData.sharesAvailable = Math.min(
                    sharesAvailable !== undefined ? sharesAvailable : Math.floor(company.sharesAvailable * ratio),
                    newTotalShares
                );
            }
        }

        const updated = await prisma.company.update({
            where: { id: companyId },
            data: updateData,
        });

        // Emit price update if sharePrice changed
        if (sharePrice !== undefined && req.io) {
            req.io.to('market').emit('price:update', {
                companyId: updated.id,
                newPrice: updated.sharePrice,
                delta: sharePrice - company.sharePrice,
                deltaPercent: company.sharePrice > 0 ? ((sharePrice - company.sharePrice) / company.sharePrice * 100) : 0,
            });
        }

        res.json(updated);
    } catch (err) {
        console.error('Update company error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/companies/:id/toggle — enable/disable stock
router.patch('/:id/toggle', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
        const companyId = parseInt(req.params.id);
        const company = await prisma.company.findUnique({ where: { id: companyId } });
        if (!company) return res.status(404).json({ error: 'Company not found' });

        const updated = await prisma.company.update({
            where: { id: companyId },
            data: { stockEnabled: !company.stockEnabled },
        });

        res.json(updated);
    } catch (err) {
        console.error('Toggle stock error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/companies/me — participant's own company
router.get('/me', authenticateToken, requireRole('PARTICIPANT'), async (req, res) => {
    try {
        const company = await prisma.company.findUnique({
            where: { id: req.user.companyId },
            include: {
                holdings: {
                    include: { targetCompany: { select: { name: true, sharePrice: true } } },
                },
            },
        });

        if (!company) return res.status(404).json({ error: 'Company not found' });
        res.json(company);
    } catch (err) {
        console.error('Get my company error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/market/companies — all companies with current price
router.get('/', authenticateToken, async (req, res) => {
    try {
        const companies = await prisma.company.findMany({
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
        });
        res.json(companies);
    } catch (err) {
        console.error('Get companies error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/companies/history — stock history for all companies
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const history = await prisma.stockHistory.findMany({
            include: { company: { select: { name: true, id: true } } },
            orderBy: { timestamp: 'asc' },
        });
        res.json(history);
    } catch (err) {
        console.error('Get history error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/companies/:id/price-history
router.get('/:id/price-history', authenticateToken, async (req, res) => {
    try {
        const companyId = parseInt(req.params.id);
        const history = await prisma.priceHistory.findMany({
            where: { companyId },
            orderBy: { recordedAt: 'asc' },
        });
        res.json(history);
    } catch (err) {
        console.error('Get price history error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
