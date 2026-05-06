/**
 * Chat Route — Full Multi-Agent Orchestrator Pipeline
 *
 * SSE Event stream:
 *   status       → pipeline step descriptions
 *   plan         → orchestrator's execution plan + reasoning
 *   agent_start  → when a specialized agent begins
 *   agent_complete → when an agent finishes (with summary)
 *   context      → RAG sources retrieved
 *   critic       → critic agent evaluation
 *   chunk        → streaming response token
 *   done         → final event with full debug log
 *   error        → pipeline error
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runOrchestrator } from '../agents/orchestratorAgent.js';
import { getHistory, addToHistory } from '../memory/sessionMemory.js';
import { recordQuery } from '../analytics/analyticsStore.js';

const router = express.Router();

/**
 * POST /api/chat
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  const { message, sessionId = uuidv4() } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // ── SSE setup ──────────────────────────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Session-Id',  sessionId);
  res.flushHeaders();

  const sendEvent = (eventType, data) => {
    try {
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch (_) { /* client disconnected */ }
  };

  const debugLog = {
    sessionId,
    userMessage: message,
    timestamp:   new Date().toISOString(),
    agentChain:  [],
  };

  try {
    const history = await getHistory(sessionId);
    
    // Check if session is already escalated
    const { getSession } = await import('../memory/sessionMemory.js');
    const session = await getSession(sessionId);

    if (session?.status === 'live_agent') {
      // 1. Save user message to history
      await addToHistory(sessionId, 'user', message);
      
      // 2. Broadcast to agent via socket
      const { io } = await import('../server.js');
      io.to(sessionId).emit('new_message', { sessionId, role: 'user', content: message });
      
      // 3. Inform user frontend
      sendEvent('chunk', { content: '' }); // no AI response needed
      sendEvent('done', {
        sessionId,
        responseType: 'live_agent',
        context: [],
        actionData: null,
        debugLog: { ...debugLog, error: 'Bypassed LLM - Live Agent active' },
        responseTime: 0,
      });
      return res.end();
    }

    // ── Run the full multi-agent orchestrator ─────────────────────────────────
    const result = await runOrchestrator(
      message,
      history,

      // onEvent — each pipeline stage fires an SSE event
      (type, payload) => {
        sendEvent(type, payload);

        // Track agent steps in debug log
        if (type === 'plan') {
          debugLog.orchestratorThought = payload.thought;
          debugLog.plan = payload.steps;
          debugLog.complexity = payload.complexity;
          debugLog.planLatency = payload.planLatency;
        }
        if (type === 'agent_start') {
          debugLog.agentChain.push({
            stepId: payload.stepId, agent: payload.agent,
            task: payload.task, status: 'running', startedAt: Date.now(),
          });
        }
        if (type === 'agent_complete') {
          const step = debugLog.agentChain.find(s => s.stepId === payload.stepId);
          if (step) { step.status = 'done'; step.summary = payload.summary; step.latency = payload.latency; }
        }
        if (type === 'critic') {
          debugLog.critique = payload;
        }
        if (type === 'context') {
          debugLog.retrievedSources = payload.sources;
        }
      },

      // onChunk — each text delta from the LLM
      (chunk) => sendEvent('chunk', { content: chunk }),
      sessionId
    );

    // ── Update memory ────────────────────────────────────────────────────────
    addToHistory(sessionId, 'user',      message);
    addToHistory(sessionId, 'assistant', result.finalResponse);

    // ── Record analytics ─────────────────────────────────────────────────────
    const totalTime = Date.now() - startTime;
    const subtype = result.actionData
      ? debugLog.agentChain.find(s => s.agent === 'action')?.task
      : null;
    recordQuery(result.responseType, subtype, totalTime, true);

    // ── Final done event ─────────────────────────────────────────────────────
    debugLog.responseType  = result.responseType;
    debugLog.totalLatency  = totalTime;

    sendEvent('done', {
      sessionId,
      responseType:      result.responseType,
      context:           result.sources,
      actionData:        result.actionData,
      orchestratorPlan:  result.orchestratorPlan,
      critique:          result.critique,
      agentChain:        debugLog.agentChain,
      debugLog,
      responseTime:      totalTime,
    });

    res.end();

  } catch (err) {
    console.error('[CHAT ERROR]', err.message);
    const totalTime = Date.now() - startTime;
    recordQuery('error', null, totalTime, false);
    debugLog.error = err.message;
    sendEvent('error', { message: err.message || 'Pipeline error', debugLog });
    res.end();
  }
});

export default router;
