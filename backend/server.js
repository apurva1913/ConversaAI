import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';

// Routes
import chatRoutes from './routes/chat.js';
import ragRoutes from './routes/rag.js';
import analyticsRoutes from './routes/analytics.js';
import sessionRoutes from './routes/sessions.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Socket.io for Live Agent Support
io.on('connection', (socket) => {
  console.log('📡 Socket connected:', socket.id);

  socket.on('join_session', (sessionId) => {
    socket.join(sessionId);
    console.log(`👤 Socket ${socket.id} JOINED room: ${sessionId}`);
  });

  socket.on('send_message', async (data) => {
    // data = { sessionId, role, content }
    console.log(`✉️ Incoming msg for [${data.sessionId}] from [${data.role}]`);
    try {
      const { addToHistory, getSession } = await import('./memory/sessionMemory.js');
      // Persist the message to MongoDB
      await addToHistory(data.sessionId, data.role, data.content, { source: 'live_agent_socket' });
      
      // If agent is sending, ensure session stays in live_agent status
      if (data.role === 'assistant') {
        const session = await getSession(data.sessionId);
        if (session && session.status !== 'live_agent') {
           const { updateSessionStatus } = await import('./memory/sessionMemory.js');
           await updateSessionStatus(data.sessionId, 'live_agent', true);
        }
      }

      // Broadcast to everyone in the room (user and admin)
      io.to(data.sessionId).emit('new_message', data);
      console.log(`✅ Message broadcasted to room: ${data.sessionId}`);
    } catch (err) {
      console.error('[Socket] Failed to persist/emit message:', err.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Socket disconnected:', socket.id);
  });
});

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sessions', sessionRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', engine: 'Node.js/Expresso', persistence: 'MongoDB' });
});

// ── Database Connection ───────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/conversa-ai';

console.log('📡 Attempting to connect to MongoDB...');

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    // Start Server only after DB is ready
    httpServer.listen(PORT, () => {
      console.log(`🚀 Conversa AI Backend running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    });

    // ── HIGH SCALABILITY OPTIMIZATIONS ──────────────────────────────────────────
    // 1. Create Indexes for 1000s of concurrent sessions
    mongoose.connection.db.collection('conversasessions').createIndex({ sessionId: 1 });
    mongoose.connection.db.collection('conversasessions').createIndex({ status: 1 });
    // 2. PRO TIP: To scale to 10 instances, add: io.adapter(createAdapter(redisClient));
  })
  .catch(err => {
    console.error('\n❌ CRITICAL: MongoDB Connection Failed');
    console.error('──────────────────────────────────────────────────');
    console.error(`Error: ${err.message}`);
    console.error('\nPOSSIBLE CAUSES:');
    console.error('1. MongoDB is not installed or not running on your machine.');
    console.error('2. The connection string in .env is incorrect.');
    console.error('3. A firewall is blocking port 27017.');
    console.error('\nACTION REQUIRED: Please ensure MongoDB is started before running this app.');
    console.error('──────────────────────────────────────────────────\n');
    process.exit(1);
  });

export { io };
