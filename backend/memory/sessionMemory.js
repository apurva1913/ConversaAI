import { Session } from '../models/index.js';

/**
 * Get full history for a session from MongoDB
 */
export async function getHistory(sessionId) {
  const session = await Session.findOne({ sessionId });
  return session ? session.messages : [];
}

/**
 * Add a message to session history in MongoDB.
 * Creates session if it doesn't exist.
 */
export async function addToHistory(sessionId, role, content, meta = {}) {
  const message = { role, content, timestamp: new Date(), meta };
  
  // Try to update existing session
  const session = await Session.findOneAndUpdate(
    { sessionId },
    { 
      $push: { messages: message },
      $set: { lastActive: new Date() }
    },
    { new: true, upsert: true }
  );

  // Auto-generate a name for the session if it's the first user message
  if (role === 'user' && session.messages.filter(m => m.role === 'user').length === 1) {
    const title = content.slice(0, 30).trim() + (content.length > 30 ? '...' : '');
    await Session.updateOne({ sessionId }, { $set: { name: title } });
  }

  return session;
}

/**
 * List all sessions for a user (or all for now)
 */
export async function listSessions() {
  return await Session.find().sort({ lastActive: -1 }).select('sessionId name lastActive status isEscalated');
}

/**
 * Update session escalation status
 */
export async function updateSessionStatus(sessionId, status, isEscalated = false) {
  return await Session.findOneAndUpdate(
    { sessionId },
    { $set: { status, isEscalated, lastActive: new Date() } },
    { new: true }
  );
}

/**
 * Get a specific session object
 */
export async function getSession(sessionId) {
  return await Session.findOne({ sessionId });
}
