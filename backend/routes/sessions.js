import express from 'express';
import { listSessions, getSession, updateSessionStatus } from '../memory/sessionMemory.js';

const router = express.Router();

/**
 * GET /api/sessions
 * List all chat sessions
 */
router.get('/', async (req, res) => {
  try {
    const sessions = await listSessions();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get full message history for a session
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const session = await getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/sessions/:sessionId/status
 * Update session escalation/status
 */
router.patch('/:sessionId/status', async (req, res) => {
  const { status, isEscalated } = req.body;
  try {
    const session = await updateSessionStatus(req.params.sessionId, status, isEscalated);
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
