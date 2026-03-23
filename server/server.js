const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { setupSocketHandlers } = require('./socket/handlers');
const { resumeActiveEvents } = require('./socket/eventTicker');

// Load .env for local development
try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
    pingTimeout: 120000, // 2 minutes: extremely generous for slow networks
    pingInterval: 25000,
    cors: {
        origin: true, // Allow all origins in prod/dev for easier deployment
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors({
    origin: true,
    credentials: true,
}));
app.use(express.json());

// Attach io to requests so routes can emit events
app.use((req, res, next) => {
    req.io = io;
    next();
});

// ──── API Routes ────
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const companiesRoutes = require('./routes/companies');
const tradesRoutes = require('./routes/trades');
const eventsRoutes = require('./routes/events');
const leaderboardRoutes = require('./routes/leaderboard');
const bootstrapRoutes = require('./routes/bootstrap');
const statsRoutes = require('./routes/stats');
const { authenticateToken } = require('./middleware/auth');
const { requireRole } = require('./middleware/role');
const { startStatsJob } = require('./utils/statsCollector');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/trades', authenticateToken, requireRole('PARTICIPANT', 'ADMIN'), tradesRoutes);
app.use('/api/portfolio', authenticateToken, requireRole('PARTICIPANT', 'ADMIN'), tradesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/bootstrap', bootstrapRoutes);
app.use('/api/stats', statsRoutes);

// Market state routes (admin only)
app.patch('/api/market', authenticateToken, requireRole('ADMIN'), async (req, res) => {
    try {
        const { isOpen } = req.body;
        const market = await prisma.marketState.upsert({
            where: { id: 1 },
            update: { isOpen },
            create: { id: 1, isOpen },
        });

        io.to('market').emit('market:status', { isOpen: market.isOpen });
        res.json(market);
    } catch (err) {
        console.error('Market toggle error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ──── Serve Frontend in Production ────
const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

if (isProd) {
    const publicPath = path.join(__dirname, 'public');
    console.log(`🌐 Serving static files from: ${publicPath}`);
    app.use(express.static(publicPath));
    
    // Catch-all route to serve index.html for React Router
    app.get('*', (req, res, next) => {
        // Skip for API routes just in case
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(publicPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.json({ message: 'STXSIM API is running. Point your frontend to this server.' });
    });
}

// ──── Socket.io ────
setupSocketHandlers(io);

// ──── Start Server ────
const PORT = process.env.PORT || 3001;

async function start() {
    try {
        await prisma.$connect();
        console.log('📦 Database connected');

        // Seed admin accounts if they don't exist
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount === 0) {
            console.log('🌱 No admins found, running seed...');
            const { execSync } = require('child_process');
            execSync('node prisma/seed.js', { cwd: __dirname, stdio: 'inherit' });
        }

        // Ensure MarketState exists
        await prisma.marketState.upsert({
            where: { id: 1 },
            update: {},
            create: { id: 1, isOpen: false },
        });

        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`   API: http://localhost:${PORT}/api`);

            // Resume active events
            resumeActiveEvents(io);

            // Start background stats collection
            startStatsJob();
        });
    } catch (err) {
        console.error('❌ Server start error:', err);
        process.exit(1);
    }
}

start();

module.exports = { app, server, io };
