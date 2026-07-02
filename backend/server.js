const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ── Socket.IO Setup ─────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'https://smart-attendance-management-system-jade.vercel.app',
    methods: ['GET', 'POST']
  }
});

// Make io accessible in routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('join_session', (sessionId) => {
    socket.join(`session_${sessionId}`);
    console.log(`Socket ${socket.id} joined session ${sessionId}`);
  });

  socket.on('attendance_marked', (data) => {
    io.to(`session_${data.sessionId}`).emit('attendance_update', data);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// ── Security Middlewares ────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://smart-attendance-management-system-jade.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});
app.use('/api/', limiter);

// ── Body Parsers ────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// ── Static Files ────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/student', require('./routes/student'));

// ── Public DB Debug Endpoint ──────────────────────────────
app.get('/api/public-debug-db', async (req, res) => {
  const db = require('./config/database');
  try {
    const info = {
      dbConfigExists: !!db,
      tables: {}
    };

    // Test simple query
    const [testQuery] = await db.query('SELECT 1 + 1 AS result');
    info.testConnection = 'OK';
    info.testResult = testQuery;

    // Check table structures
    const tablesToCheck = ['users', 'students', 'departments', 'semesters'];
    for (const table of tablesToCheck) {
      try {
        const [columns] = await db.query(`DESCRIBE ${table}`);
        info.tables[table] = columns.map(c => ({ field: c.Field, type: c.Type }));
      } catch (err) {
        info.tables[table] = { error: err.message };
      }
    }

    // Test students query
    try {
      const query = `
        SELECT s.*, u.name, u.email, u.phone, u.is_active, u.last_login,
               d.name AS department_name, sem.name AS semester_name
        FROM students s
        JOIN users u ON s.user_id = u.id
        JOIN departments d ON s.department_id = d.id
        JOIN semesters sem ON s.semester_id = sem.id
        ORDER BY u.name
      `;
      const [rows] = await db.query(query);
      info.studentsQuery = { status: 'SUCCESS', count: rows.length };
    } catch (err) {
      info.studentsQuery = { status: 'FAILED', error: err.message, code: err.code };
    }

    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Attendance Management System API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── 404 Handler ─────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Global Error Handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── Start Server ────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   Smart Attendance Management System      ║
  ║   Server running on port ${PORT}          ║
  ║   http://localhost:${PORT}                ║
  ╚═══════════════════════════════════════════╝
  `);
});

module.exports = { app, io };
