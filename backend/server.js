require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
const path       = require('path');
const jwt        = require('jsonwebtoken');

const app    = express();
const server = http.createServer(app);

// ── Socket.IO ──────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Inject io into notification service BEFORE any routes load
const notificationService = require('./utils/notificationService');
notificationService.setIO(io);

// ── Socket auth + room join ────────────────────────────────────────────────────
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Each user joins their own private room
  socket.join(`user:${socket.userId}`);
  socket.emit('connected', { message: 'Real-time notifications active' });

  socket.on('disconnect', () => {});
});

// ── Express middleware ─────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the frontend (index.html at project root)
app.use(express.static(path.join(__dirname, '..')));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/items',         require('./routes/items'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/contributions', require('./routes/contributions'));
app.use('/api/activities',    require('./routes/activities'));
app.use('/api/rewards',       require('./routes/rewards'));
app.use('/api/admin',         require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Explicit admin panel route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

// Catch-all: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ── MongoDB + Start ────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');

    // Start monthly champion scheduler (recovery + scheduling)
    require('./utils/monthlyScheduler').init().catch(err =>
      console.error('Scheduler init error:', err.message)
    );

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 LostLink server running on http://localhost:${PORT}`);
      console.log(`📡 Socket.IO real-time notifications active`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use.`);
        console.error(`   Run this command to free it, then try again:`);
        console.error(`   netstat -ano | findstr :${PORT}`);
        console.error(`   taskkill /PID <PID from above> /F\n`);
      } else {
        console.error('Server error:', err.message);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = { app, io };
