const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const usersRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const searchRoutes = require('./routes/search');
const uploadRoutes = require('./routes/upload');
const walletRoutes = require('./routes/wallet');
const adminRoutes = require('./routes/admin');
const escrowRoutes = require('./routes/escrow').router;
const webhookRoutes = require('./routes/webhooks');
const ratingsRoutes = require('./routes/ratings');
const transactionsRoutes = require('./routes/transactions');
const { setupChatSocket } = require('./sockets/chat');
const { initBaileys } = require('./config/whatsapp');
const { startCronScheduler } = require('./services/cron');
const { runMigrations } = require('./config/migrations');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Proxy admin panel requests to the Docker container running the admin panel
app.use('/admin', createProxyMiddleware({ 
  target: 'http://admin-panel:8080', 
  changeOrigin: true,
  pathRewrite: {
    '^/admin': '', // remove /admin from the path before forwarding
  },
}));
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO setup
setupChatSocket(io);
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3000;
// Run database migrations on startup
runMigrations()
  .then(() => {
    server.listen(PORT, HOST, async () => {
      console.log(`🚀 SkillMatch server running on ${HOST}:${PORT}`);
      try {
        await initBaileys();
        console.log('💚 Baileys WhatsApp client initialized successfully.');
      } catch (err) {
        console.error('❌ Failed to initialize Baileys:', err);
      }
      startCronScheduler(io);
    });
  })
  .catch((err) => {
    console.error('❌ Database migration failed. Server starting anyway...', err);
    server.listen(PORT, HOST, async () => {
      console.log(`🚀 SkillMatch server running on ${HOST}:${PORT}`);
      try {
        await initBaileys();
        console.log('💚 Baileys WhatsApp client initialized successfully.');
      } catch (err) {
        console.error('❌ Failed to initialize Baileys:', err);
      }
      startCronScheduler(io);
    });
  });

module.exports = { app, server, io };
