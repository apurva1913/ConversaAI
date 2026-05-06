/**
 * Orchestrator Agent — ReAct (Reasoning + Acting) Multi-Agent Planner
 *
 * Flow:
 *   User Message
 *     → Orchestrator thinks and creates an execution PLAN
 *     → Executes each step (spawns specialized agents)
 *     → Steps can be sequential or parallel, results can be chained
 *     → Critic evaluates the final response
 *     → Synthesizer streams the final answer
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import { ragAgent } from './ragAgent.js';
import { actionAgent } from './actionAgent.js';
import { criticAgent } from './criticAgent.js';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Orchestrator System Prompt ────────────────────────────────────────────────
const ORCHESTRATOR_PROMPT = `You are the Orchestrator of a multi-agent AI customer support system.
Your job is to THINK step-by-step and create an execution PLAN for specialized agents.

AVAILABLE AGENTS:
- "rag"    → Searches and synthesizes from the knowledge base documents
- "action" → Executes business operations. Actions: bookAppointment | createLead | checkStatus | escalateToHuman
- "none"   → Simple conversational reply (no agents needed)

DECISION RULES:
1. If the query is purely informational → plan: [{ agent: "rag" }]
2. If the query requires an action → plan: [{ agent: "action" }]
3. If the query needs BOTH (e.g. "tell me about pricing then book a demo") → chain them: rag first, then action
4. If the query is a greeting or small talk → plan: [{ agent: "none" }]  
5. If the query needs parallel knowledge + status check → mark parallel: true
6. NEVER exceed 3 steps — decompose only what's genuinely needed

RESPOND WITH VALID JSON ONLY:
{
  "thought": "<your detailed chain-of-thought reasoning about this specific query>",
  "plan": [
    {
      "id": "step_1",
      "agent": "rag" | "action" | "none",
      "task": "<specific task for this agent>",
      "action": "<only for agent=action: bookAppointment|createLead|checkStatus|escalateToHuman|extractData>",
      "parallel": false,
      "dependsOn": []
    }
  ],
  "complexity": "low" | "medium" | "high",
  "requiresCritic": true | false,
  "estimatedAgents": <number>
}`;

/**
 * Generate a structured execution plan via the Orchestrator LLM
 */
export async function plan(userMessage, conversationHistory = []) {
  const recentHistory = conversationHistory.slice(-6).map(m => ({
    role: m.role,
    content: String(m.content).slice(0, 300),
  }));

  const messages = [
    { role: 'system', content: ORCHESTRATOR_PROMPT },
    ...recentHistory,
    { role: 'user', content: `Create an execution plan for: "${userMessage}"` },
  ];

  const start = Date.now();
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.1,
    max_tokens: 600,
    response_format: { type: 'json_object' },
  });

  const raw = JSON.parse(res.choices[0].message.content);
  return {
    thought:         raw.thought         || 'No reasoning provided.',
    plan:            Array.isArray(raw.plan) ? raw.plan : [],
    complexity:      raw.complexity      || 'low',
    requiresCritic:  raw.requiresCritic  ?? false,
    estimatedAgents: raw.estimatedAgents || 1,
    planLatency:     Date.now() - start,
  };
}

/**
 * Execute one step of the plan, optionally passing results from prior steps
 */
async function executeStep(step, userMessage, priorResults, onEvent, sessionId) {
  const start = Date.now();
  onEvent('agent_start', { stepId: step.id, agent: step.agent, task: step.task });

  // Build context from dependencies
  const context = step.dependsOn
    ? step.dependsOn.map(id => priorResults[id]).filter(Boolean)
    : [];

  let result;

  if (step.agent === 'rag') {
    result = await ragAgent(userMessage, step.task, context);
  } else if (step.agent === 'action') {
    result = await actionAgent(userMessage, step.task, step.action, context, sessionId);
  } else {
    // "none" — simple direct response flag (handled by synthesizer)
    result = { type: 'general', content: null };
  }

  result.latency = Date.now() - start;
  onEvent('agent_complete', {
    stepId:  step.id,
    agent:   step.agent,
    task:    step.task,
    summary: summarize(result),
    latency: result.latency,
  });

  return result;
}

function summarize(result) {
  if (result.type === 'rag')    return `Retrieved ${result.chunks?.length || 0} chunks (confidence: ${result.confidence || '—'})`;
  if (result.type === 'action') return `Executed: ${result.actionName} → ${result.success ? 'success' : 'failed'}`;
  return 'General response queued';
}

/**
 * Execute the full plan — respects parallelism and dependency chaining
 */
async function executePlan(planSteps, userMessage, onEvent, sessionId) {
  const results = {};
  const executed = new Set();

  // Execute in topological order (up to 3 rounds)
  for (let round = 0; round < 3; round++) {
    const ready = planSteps.filter(step => {
      if (executed.has(step.id)) return false;
      return !step.dependsOn?.length || step.dependsOn.every(dep => executed.has(dep));
    });

    if (!ready.length) break;

    // Run parallel-capable steps concurrently, sequential ones one at a time
    const parallel = ready.filter(s => s.parallel);
    const sequential = ready.filter(s => !s.parallel);

    if (parallel.length > 0) {
      const parallelResults = await Promise.all(
        parallel.map(step => executeStep(step, userMessage, results, onEvent, sessionId))
      );
      parallel.forEach((step, i) => {
        results[step.id] = parallelResults[i];
        executed.add(step.id);
      });
    }

    for (const step of sequential) {
      results[step.id] = await executeStep(step, userMessage, results, onEvent, sessionId);
      executed.add(step.id);
    }
  }

  return results;
}

/**
 * Synthesize a final streaming response from all agent results
 */
async function synthesize(userMessage, agentResults, conversationHistory, orchestratorPlan, onChunk) {
  // Collect all inputs
  const ragResults    = Object.values(agentResults).filter(r => r.type === 'rag');
  const actionResults = Object.values(agentResults).filter(r => r.type === 'action');
  const isGeneral     = Object.values(agentResults).some(r => r.type === 'general');

  const contextBlocks = ragResults.map((r, i) =>
    r.chunks?.map(c => `[Source ${i + 1} – ${c.source}]\n${c.content}`).join('\n') || ''
  ).join('\n\n---\n\n');

  const actionBlock = actionResults.map(r =>
    `ACTION EXECUTED: ${r.actionName}\nRESULT: ${JSON.stringify(r.result?.data || r.result)}`
  ).join('\n\n');

  const systemPrompt = isGeneral
    ? `You are Conversa AI — a friendly and professional customer support assistant. Be warm, concise, and helpful. Mention your capabilities: knowledge base search, appointment booking, lead capture, and order status.`
    : `You are Conversa AI — a professional customer support assistant.

${contextBlocks ? `KNOWLEDGE BASE CONTEXT:\n${contextBlocks}\n\n` : ''}${actionBlock ? `COMPLETED ACTIONS:\n${actionBlock}\n\n` : ''}INSTRUCTIONS:
- Answer based on the above context and completed actions
- Cite sources when using knowledge base (e.g. "According to [Source 1]...")
- Confirm any completed actions clearly with their IDs/confirmations
- If context is insufficient, say so honestly
- Format with markdown where helpful (bullet points, bold text for IDs)
- Be concise and professional`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-4),
    { role: 'user', content: userMessage },
  ];

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 1200,
    stream: true,
  });

  let full = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) { full += delta; onChunk(delta); }
  }
  return full;
}

/**
 * Main Orchestrator entry point
 *  onEvent(type, payload) — called for each pipeline event (for SSE streaming)
 *  onChunk(text)          — called for each response text token
 */
export async function runOrchestrator(userMessage, conversationHistory, onEvent, onChunk, sessionId = null) {
  const totalStart = Date.now();

  // ── 1. THINK: Generate execution plan ──────────────────────────────────────
  onEvent('status', { type: 'planning', message: '🧠 Orchestrator is planning...' });

  let executionPlan;
  try {
    executionPlan = await plan(userMessage, conversationHistory);
  } catch (err) {
    // Fallback: single RAG step
    executionPlan = {
      thought: `Planning failed (${err.message}). Defaulting to RAG.`,
      plan: [{ id: 'step_1', agent: 'rag', task: userMessage, parallel: false, dependsOn: [] }],
      complexity: 'low', requiresCritic: false, estimatedAgents: 1, planLatency: 0,
    };
  }

  onEvent('plan', {
    thought:     executionPlan.thought,
    steps:       executionPlan.plan,
    complexity:  executionPlan.complexity,
    planLatency: executionPlan.planLatency,
  });

  // ── 2. ACT: Execute each agent in the plan ──────────────────────────────────
  onEvent('status', { type: 'executing', message: `⚡ Running ${executionPlan.plan.length} agent(s)...` });

  let agentResults = {};
  try {
    agentResults = await executePlan(executionPlan.plan, userMessage, onEvent, sessionId);
  } catch (err) {
    onEvent('status', { type: 'error', message: `Agent execution error: ${err.message}` });
    throw err;
  }

  // ── 3. OBSERVE: Collect RAG context for source display ─────────────────────
  const allSources = Object.values(agentResults)
    .filter(r => r.type === 'rag' && r.chunks?.length)
    .flatMap(r => r.chunks.map(c => ({ source: c.source, score: c.score })));

  const allActionResults = Object.values(agentResults)
    .filter(r => r.type === 'action')
    .map(r => r.result?.data || null)
    .filter(Boolean);

  if (allSources.length > 0) {
    onEvent('context', { sources: allSources });
  }

  // ── 4. REFLECT: Critic evaluates (only for complex or multi-step plans) ─────
  let critiqueResult = null;
  if (executionPlan.requiresCritic) {
    onEvent('status', { type: 'reflecting', message: '🔍 Critic agent reviewing plan...' });
    try {
      // Build a preliminary answer for the critic to evaluate
      const ragChunks = Object.values(agentResults).filter(r => r.type === 'rag').flatMap(r => r.chunks || []);
      const actionSummaries = Object.values(agentResults).filter(r => r.type === 'action');
      critiqueResult = await criticAgent(userMessage, executionPlan.plan, agentResults, ragChunks, actionSummaries);
      onEvent('critic', critiqueResult);
    } catch (err) {
      console.warn('[Critic] Failed:', err.message);
    }
  }

  // ── 5. SYNTHESIZE: Generate streaming final response ───────────────────────
  onEvent('status', { type: 'generating', message: '✨ Synthesizing response...' });
  const finalResponse = await synthesize(userMessage, agentResults, conversationHistory, executionPlan, onChunk);

  // Return full log for debug panel
  return {
    orchestratorPlan:  executionPlan,
    agentResults,
    critique:          critiqueResult,
    sources:           allSources,
    actionData:        allActionResults[0] || null,
    responseType:      allActionResults.length > 0 ? 'action' : allSources.length > 0 ? 'rag' : 'general',
    totalLatency:      Date.now() - totalStart,
    finalResponse,
  };
}

export default { runOrchestrator, plan };
