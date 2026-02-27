const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

function setupSocketHandlers(io) {
    // Authenticate socket connections via JWT
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.user.userId} (${socket.user.role})`);

        // Join market room (all authenticated users)
        socket.join('market');

        // Join admin room if admin
        if (socket.user.role === 'ADMIN') {
            socket.join('admin');
        }

        // Join company-specific room for portfolio updates
        if (socket.user.companyId) {
            socket.join(`company:${socket.user.companyId}`);
        }

        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.user.userId}`);
        });

        // Handle reconnection — client should re-bootstrap
        socket.on('reconnect', () => {
            socket.join('market');
            if (socket.user.role === 'ADMIN') {
                socket.join('admin');
            }
            if (socket.user.companyId) {
                socket.join(`company:${socket.user.companyId}`);
            }
        });
    });
}

module.exports = { setupSocketHandlers };
