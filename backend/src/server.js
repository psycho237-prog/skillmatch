const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const usersRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const searchRoutes = require('./routes/search');
const uploadRoutes = require('./routes/upload');
const { setupChatSocket } = require('./sockets/chat');
const { initBaileys } = require('./config/whatsapp');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO setup
setupChatSocket(io);
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3000;
server.listen(PORT, HOST, async () => {
  console.log(`🚀 SkillMatch server running on ${HOST}:${PORT}`);
  try {
    await initBaileys();
    console.log('💚 Baileys WhatsApp client initialized successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize Baileys:', err);
  }
});

module.exports = { app, server, io };
