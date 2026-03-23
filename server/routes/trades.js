const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { recordStockPrice } = require('../utils/history');
const { recordCompanySnapshot } = require('../utils/statsCollector');

const prisma = new PrismaClient();

// Caching leaderboard to prevent DB hammering
let cachedLeaderboard = null;
let lastLeaderboardTime = 0;
const LEADERBOARD_CACHE_MS = 5000;

router.use(authenticateToken, requireRole('PARTICIPANT', 'ADMIN'));

// POST /api/trades/buy
router.post('/buy', async (req, res) => {
    try {
        const { targetCompanyId, shares } = req.body;
        const buyerCompanyId = req.user.companyId;

        if (!targetCompanyId || !shares || shares <= 0) {
            return res.status(400).json({ error: 'Valid targetCompanyId and shares required' });
        }

        if (buyerCompanyId === targetCompanyId) {
            return res.status(400).json({ error: 'Cannot buy your own shares' });
        }

        // Check market is open
        const market = await prisma.marketState.findUnique({ where: { id: 1 } });
        if (!market || !market.isOpen) {
            return res.status(400).json({ error: 'Market is closed' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const seller = await tx.company.findUnique({ where: { id: targetCompanyId } });
            if (!seller) throw new Error('Company not found');
            if (!seller.stockEnabled) throw new Error('Stock is disabled for this company');
            if (seller.sharesAvailable < shares) throw new Error(`Only ${seller.sharesAvailable} shares available`);

            const buyer = await tx.company.findUnique({ where: { id: buyerCompanyId } });
            if (!buyer) throw new Error('Buyer company not found');

            const totalCost = shares * seller.sharePrice;
            if (buyer.cashBalance < totalCost) throw new Error('Insufficient funds');

            // Deduct cash from buyer
            await tx.company.update({
                where: { id: buyerCompanyId },
                data: { cashBalance: { decrement: totalCost } },
            });

            // Add cash to seller and reduce available shares
            await tx.company.update({
                where: { id: targetCompanyId },
                data: {
                    cashBalance: { increment: totalCost },
                    sharesAvailable: { decrement: shares },
                },
            });

            // Update or create holding
            const existingHolding = await tx.holding.findUnique({
                where: {
                    ownerCompanyId_targetCompanyId: {
                        ownerCompanyId: buyerCompanyId,
                        targetCompanyId,
                    },
                },
            });

            if (existingHolding) {
                const totalShares = existingHolding.shares + shares;
                const totalCostBasis = (existingHolding.avgBuyPrice * existingHolding.shares) + totalCost;
                const newAvgPrice = totalCostBasis / totalShares;

                await tx.holding.update({
                    where: { id: existingHolding.id },
                    data: { shares: totalShares, avgBuyPrice: newAvgPrice },
                });
            } else {
                await tx.holding.create({
                    data: {
                        ownerCompanyId: buyerCompanyId,
                        targetCompanyId,
                        shares,
                        avgBuyPrice: seller.sharePrice,
                    },
                });
            }

            // Get next serial number
            const lastTrade = await tx.trade.findFirst({ orderBy: { serialNumber: 'desc' } });
            const nextSerialNumber = lastTrade ? lastTrade.serialNumber + 1 : 1;

            // Record trade
            const trade = await tx.trade.create({
                data: {
                    serialNumber: nextSerialNumber,
                    type: 'IPO',
                    buyerCompanyId,
                    sellerCompanyId: targetCompanyId,
                    targetCompanyId,
                    shares,
                    pricePerShare: seller.sharePrice,
                    total: totalCost,
                },
            });

            // Record price history
            await recordStockPrice(targetCompanyId, seller.sharePrice, tx);

            return { trade, buyer, seller, totalCost };
        });

        // Emit trade event
        if (req.io) {
            const buyerCompany = await prisma.company.findUnique({ where: { id: buyerCompanyId } });
            const sellerCompany = await prisma.company.findUnique({ where: { id: targetCompanyId } });

            req.io.to('market').emit('trade:executed', {
                serialNumber: result.trade.serialNumber,
                type: result.trade.type,
                timestamp: result.trade.timestamp,
                buyerName: buyerCompany.name,
                sellerName: sellerCompany.name,
                shares,
                pricePerShare: result.trade.pricePerShare,
                total: result.trade.total,
                targetCompanyId
            });

            // Emit leaderboard update
            const leaderboard = await calculateLeaderboard();
            req.io.to('market').emit('leaderboard:update', leaderboard);

            // Emit portfolio update to buyer
            const buyerHoldings = await prisma.holding.findMany({
                where: { ownerCompanyId: buyerCompanyId },
                include: { targetCompany: { select: { name: true, sharePrice: true } } },
            });
            req.io.to(`company:${buyerCompanyId}`).emit('portfolio:update', { holdings: buyerHoldings });

            // Record snapshots for stats dashboard
            recordCompanySnapshot(buyerCompanyId);
            recordCompanySnapshot(targetCompanyId);
        }

        res.json(result.trade);
    } catch (err) {
        console.error('Buy error:', err);
        res.status(400).json({ error: err.message || 'Trade failed' });
    }
});

// POST /api/trades/sell — User lists their owned shares on the secondary market
router.post('/sell', async (req, res) => {
    try {
        const { targetCompanyId, shares, pricePerShare } = req.body;
        const sellerCompanyId = req.user.companyId;

        if (!targetCompanyId || !shares || shares <= 0) {
            return res.status(400).json({ error: 'Valid targetCompanyId and shares required' });
        }

        const market = await prisma.marketState.findUnique({ where: { id: 1 } });
        if (!market || !market.isOpen) {
            return res.status(400).json({ error: 'Market is closed' });
        }

        const order = await prisma.$transaction(async (tx) => {
            const holding = await tx.holding.findUnique({
                where: {
                    ownerCompanyId_targetCompanyId: {
                        ownerCompanyId: sellerCompanyId,
                        targetCompanyId,
                    },
                },
            });

            if (!holding || holding.shares < shares) {
                throw new Error(`Insufficient shares. You own ${holding ? holding.shares : 0}`);
            }

            // Deduct shares from holding immediately to escrow them in the sell order
            const remainingShares = holding.shares - shares;
            if (remainingShares <= 0) {
                await tx.holding.delete({ where: { id: holding.id } });
            } else {
                await tx.holding.update({
                    where: { id: holding.id },
                    data: { shares: remainingShares },
                });
            }

            // Create SellOrder
            const newOrder = await tx.sellOrder.create({
                data: {
                    sellerCompanyId,
                    targetCompanyId,
                    shares,
                    pricePerShare: pricePerShare || 0, // No longer strictly used for pricing
                },
                include: {
                    sellerCompany: { select: { name: true } },
                    targetCompany: { select: { name: true } },
                }
            });

            return newOrder;
        });

        if (req.io) {
            req.io.to('market').emit('order:created', order);

            const sellerHoldings = await prisma.holding.findMany({
                where: { ownerCompanyId: sellerCompanyId },
                include: { targetCompany: { select: { name: true, sharePrice: true } } },
            });
            req.io.to(`company:${sellerCompanyId}`).emit('portfolio:update', { holdings: sellerHoldings });
        }

        res.json(order);
    } catch (err) {
        console.error('List sell order error:', err);
        res.status(400).json({ error: err.message || 'Failed to list shares' });
    }
});

// POST /api/trades/sell/withdraw — Withdraw a sell order
router.post('/sell/withdraw', async (req, res) => {
    try {
        const { orderId } = req.body;
        const sellerCompanyId = req.user.companyId;

        const marketState = await prisma.marketState.findUnique({ where: { id: 1 } });
        const cooldownMs = (marketState?.sellWithdrawCooldownSec || 60) * 1000;

        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.sellOrder.findUnique({ where: { id: orderId } });

            if (!order) throw new Error('Order not found');
            if (req.user.role !== 'ADMIN' && order.sellerCompanyId !== sellerCompanyId) throw new Error('Not authorized to withdraw this order');

            const ageMs = Date.now() - new Date(order.createdAt).getTime();
            if (req.user.role !== 'ADMIN' && ageMs < cooldownMs) {
                const remainingSec = Math.ceil((cooldownMs - ageMs) / 1000);
                throw new Error(`Cannot withdraw yet. Cooldown remaining: ${remainingSec}s`);
            }

            // Return shares to holding
            const existingHolding = await tx.holding.findUnique({
                where: {
                    ownerCompanyId_targetCompanyId: {
                        ownerCompanyId: order.sellerCompanyId,
                        targetCompanyId: order.targetCompanyId,
                    },
                },
            });

            if (existingHolding) {
                await tx.holding.update({
                    where: { id: existingHolding.id },
                    data: { shares: existingHolding.shares + order.shares },
                });
            } else {
                const targetCompany = await tx.company.findUnique({ where: { id: order.targetCompanyId } });
                await tx.holding.create({
                    data: {
                        ownerCompanyId: order.sellerCompanyId,
                        targetCompanyId: order.targetCompanyId,
                        shares: order.shares,
                        avgBuyPrice: targetCompany.sharePrice, // Simplification on return
                    },
                });
            }

            await tx.sellOrder.delete({ where: { id: orderId } });
            return order;
        });

        if (req.io) {
            req.io.to('market').emit('order:withdrawn', { id: orderId });

            const sellerHoldings = await prisma.holding.findMany({
                where: { ownerCompanyId: order.sellerCompanyId },
                include: { targetCompany: { select: { name: true, sharePrice: true } } },
            });
            req.io.to(`company:${order.sellerCompanyId}`).emit('portfolio:update', { holdings: sellerHoldings });
        }

        res.json({ message: 'Order withdrawn successfully' });
    } catch (err) {
        console.error('Withdraw order error:', err);
        res.status(400).json({ error: err.message || 'Failed to withdraw order' });
    }
});

// POST /api/trades/buy-p2p — Buy from a user's sell order
router.post('/buy-p2p', async (req, res) => {
    try {
        const { orderId, shares } = req.body;
        const buyerCompanyId = req.user.companyId;

        if (!orderId || !shares || shares <= 0) {
            return res.status(400).json({ error: 'orderId and valid shares are required' });
        }

        const market = await prisma.marketState.findUnique({ where: { id: 1 } });
        if (!market || !market.isOpen) return res.status(400).json({ error: 'Market is closed' });

        const result = await prisma.$transaction(async (tx) => {
            const order = await tx.sellOrder.findUnique({
                where: { id: orderId },
                include: { targetCompany: true, sellerCompany: true }
            });

            if (!order) throw new Error('Order taking failed: Order no longer exists');
            if (order.sellerCompanyId === buyerCompanyId) throw new Error('Cannot buy your own listed shares');
            if (order.targetCompanyId === buyerCompanyId) throw new Error('Cannot buy back your own company shares this way');
            if (order.shares < shares) throw new Error(`Only ${order.shares} shares available in this order`);

            const buyer = await tx.company.findUnique({ where: { id: buyerCompanyId } });

            const currentPrice = order.targetCompany.sharePrice;
            const totalCost = shares * currentPrice;
            if (buyer.cashBalance < totalCost) throw new Error('Insufficient funds');

            // 1. Move money
            await tx.company.update({
                where: { id: buyerCompanyId },
                data: { cashBalance: { decrement: totalCost } },
            });

            await tx.company.update({
                where: { id: order.sellerCompanyId },
                data: { cashBalance: { increment: totalCost } },
            });

            // 2. Transfer shares to buyer's holding
            const existingHolding = await tx.holding.findUnique({
                where: {
                    ownerCompanyId_targetCompanyId: {
                        ownerCompanyId: buyerCompanyId,
                        targetCompanyId: order.targetCompanyId,
                    },
                },
            });

            if (existingHolding) {
                const totalShares = existingHolding.shares + shares;
                const totalCostBasis = (existingHolding.avgBuyPrice * existingHolding.shares) + totalCost;

                await tx.holding.update({
                    where: { id: existingHolding.id },
                    data: { shares: totalShares, avgBuyPrice: totalCostBasis / totalShares },
                });
            } else {
                await tx.holding.create({
                    data: {
                        ownerCompanyId: buyerCompanyId,
                        targetCompanyId: order.targetCompanyId,
                        shares: shares,
                        avgBuyPrice: currentPrice,
                    },
                });
            }

            // 3. Record Trade
            const lastTrade = await tx.trade.findFirst({ orderBy: { serialNumber: 'desc' } });
            const nextSerialNumber = lastTrade ? lastTrade.serialNumber + 1 : 1;

            const trade = await tx.trade.create({
                data: {
                    serialNumber: nextSerialNumber,
                    type: 'P2P',
                    buyerCompanyId,
                    sellerCompanyId: order.sellerCompanyId,
                    targetCompanyId: order.targetCompanyId,
                    shares: shares,
                    pricePerShare: currentPrice,
                    total: totalCost,
                },
            });

            // Record price history
            await recordStockPrice(order.targetCompanyId, currentPrice, tx);

            // 4. Update or Delete the order
            if (order.shares === shares) {
                await tx.sellOrder.delete({ where: { id: orderId } });
            } else {
                await tx.sellOrder.update({
                    where: { id: orderId },
                    data: { shares: order.shares - shares }
                });
            }

            return { trade, order, buyer, processedShares: shares };
        }, { timeout: 20000 });

        // Socket Emissions
        if (req.io) {
            req.io.to('market').emit('order:filled', { id: orderId, remaining: result.order.shares - result.processedShares });
            req.io.to('market').emit('trade:executed', {
                serialNumber: result.trade.serialNumber,
                type: result.trade.type,
                timestamp: result.trade.timestamp,
                buyerName: result.buyer.name,
                sellerName: result.order.sellerCompany.name,
                shares: result.processedShares,
                pricePerShare: result.trade.pricePerShare,
                total: result.trade.total,
                targetCompanyId: result.order.targetCompanyId
            });

            const leaderboard = await calculateLeaderboard();
            req.io.to('market').emit('leaderboard:update', leaderboard);

            const buyerHoldings = await prisma.holding.findMany({
                where: { ownerCompanyId: buyerCompanyId },
                include: { targetCompany: { select: { name: true, sharePrice: true } } },
            });
            req.io.to(`company:${buyerCompanyId}`).emit('portfolio:update', { holdings: buyerHoldings });

            const sellerHoldings = await prisma.holding.findMany({
                where: { ownerCompanyId: result.order.sellerCompanyId },
                include: { targetCompany: { select: { name: true, sharePrice: true } } },
            });
            req.io.to(`company:${result.order.sellerCompanyId}`).emit('portfolio:update', { holdings: sellerHoldings });

            // Record snapshots for stats dashboard
            recordCompanySnapshot(buyerCompanyId);
            recordCompanySnapshot(result.order.sellerCompanyId);
        }

        res.json(result.trade);
    } catch (err) {
        console.error('P2P Buy error:', err);
        res.status(400).json({ error: err.message || 'P2P Trade failed' });
    }
});

// GET /api/trades/orders — Active secondary market orders
router.get('/orders', async (req, res) => {
    try {
        const orders = await prisma.sellOrder.findMany({
            include: {
                sellerCompany: { select: { name: true } },
                targetCompany: { select: { name: true, sharePrice: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const marketState = await prisma.marketState.findUnique({ where: { id: 1 } });

        res.json({
            orders,
            cooldownSec: marketState?.sellWithdrawCooldownSec || 60
        });
    } catch (err) {
        console.error('Get orders error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/trades/me — own trade history
router.get('/me', async (req, res) => {
    try {
        const companyId = req.user.companyId;
        const trades = await prisma.trade.findMany({
            where: {
                OR: [{ buyerCompanyId: companyId }, { sellerCompanyId: companyId }],
            },
            include: {
                buyer: { select: { name: true } },
                seller: { select: { name: true } },
                targetCompany: { select: { name: true } },
            },
            orderBy: { timestamp: 'desc' },
        });
        res.json(trades);
    } catch (err) {
        console.error('My trades error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/portfolio — own holdings
router.get('/', async (req, res) => {
    try {
        const holdings = await prisma.holding.findMany({
            where: { ownerCompanyId: req.user.companyId },
            include: {
                targetCompany: { select: { name: true, sharePrice: true } },
            },
        });
        res.json(holdings);
    } catch (err) {
        console.error('Portfolio error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Leaderboard calculation helper with caching
async function calculateLeaderboard() {
    const now = Date.now();
    if (cachedLeaderboard && (now - lastLeaderboardTime < LEADERBOARD_CACHE_MS)) {
        return cachedLeaderboard;
    }

    const companies = await prisma.company.findMany({
        include: {
            holdings: {
                include: { targetCompany: { select: { sharePrice: true } } },
            },
        },
    });

    const stockValueRanking = companies.map(c => {
        const stockValue = c.holdings.reduce((sum, h) => {
            return sum + (h.shares * h.targetCompany.sharePrice);
        }, 0);
        return { companyId: c.id, name: c.name, value: stockValue };
    }).sort((a, b) => b.value - a.value);

    const liquidityRanking = companies.map(c => ({
        companyId: c.id, name: c.name, value: c.cashBalance,
    })).sort((a, b) => b.value - a.value);

    const result = { stockValueRanking, liquidityRanking };
    cachedLeaderboard = result;
    lastLeaderboardTime = now;
    return result;
}

module.exports = router;
module.exports.calculateLeaderboard = calculateLeaderboard;
