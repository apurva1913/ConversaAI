import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  name: { type: String, default: 'New Chat' },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    meta: mongoose.Schema.Types.Mixed
  }],
  isEscalated: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'closed', 'live_agent'], default: 'active' },
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

export const Session = mongoose.model('Session', sessionSchema);

const analyticsSchema = new mongoose.Schema({
  type: { type: String, enum: ['rag', 'action', 'general', 'error'], required: true },
  subtype: String,
  responseTime: Number,
  success: { type: Boolean, default: true },
  timestamp: { type: Date, default: Date.now }
});

export const Analytics = mongoose.model('Analytics', analyticsSchema);
