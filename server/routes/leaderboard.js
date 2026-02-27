const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /api/leaderboard
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { calculateLeaderboard } = require('./trades');
        const leaderboard = await calculateLeaderboard();
        res.json(leaderboard);
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
