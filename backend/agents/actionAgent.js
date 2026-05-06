/**
 * Action Agent — Specialized Business Operation Executor
 *
 * Receives a task + action type from the Orchestrator, uses an LLM to
 * extract structured parameters from the user message (context-aware),
 * then dispatches to the appropriate action handler.
 */

import OpenAI from 'openai';
import { executeAction } from '../actions/actionHandlers.js';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ACTION_AGENT_PROMPT = `You are a specialized Action Execution Agent.
Your job is to extract structured parameters from the user's message to execute a specific action.

AVAILABLE ACTIONS AND THEIR PARAMETERS:
- bookAppointment: { name, email, date, time, service, notes }
- createLead:      { name, email, company, phone, interest, budget, message }
- checkStatus:     { orderId, ticketId }
- escalateToHuman: { issue, priority ("normal"|"high") }
- extractData: Use for RPA-style tasks where you need to parse structured info from unstructured text (like a bill, receipt, or email).
  Params: { rawText: string, schema: string, targetSystem: string, extractedData: object }
- processAutomation: Use for complex multi-step workflows like "sync this to my ERP", "process this refund", or "verify and email".
  Params: { workflowType: string, data: object }

Extract ONLY what is explicitly mentioned or can be reasonably inferred.
Use empty string "" for fields not mentioned — do NOT invent data.

Return ONLY JSON:
{
  "action": "bookAppointment" | "createLead" | "checkStatus" | "escalateToHuman" | "extractData" | "processAutomation",
  "params": { ... },
  "extractionNotes": "Why you chose these params"
}

For extractData, the "extractedData" param should contain the actual key-value pairs you found (e.g., { "vendor": "ACME", "total": 50.00 }).
`;

/**
 * Execute the Action agent for a given task
 * @param {string} userMessage  - Original user query
 * @param {string} task         - Specific task description from Orchestrator
 * @param {string} actionHint   - Action name hinted by Orchestrator (may be null)
 * @param {Array}  priorContext - Results from upstream agents (for param enrichment)
 * @param {string} sessionId    - Current session unique identifier
 */
export async function actionAgent(userMessage, task, actionHint, priorContext = [], sessionId = null) {
  // ── Step 1: Extract params via LLM ────────────────────────────────────────
  const priorSummary = priorContext.length > 0
    ? `\nCONTEXT FROM PRIOR AGENTS (use to enrich params):\n${priorContext.map(r => r.findings || JSON.stringify(r.result?.data || '')).join('\n')}`
    : '';

  const messages = [
    { role: 'system', content: ACTION_AGENT_PROMPT },
    {
      role: 'user',
      content: `USER MESSAGE: "${userMessage}"\nTASK: ${task}\nLIKELY ACTION: ${actionHint || 'determine from task'}${priorSummary}`,
    },
  ];

  let extraction = { action: actionHint || 'createLead', params: {}, extractionNotes: '' };
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });
    extraction = JSON.parse(res.choices[0].message.content);
  } catch (err) {
    console.warn('[ActionAgent] Param extraction failed:', err.message);
  }

  const actionName = extraction.action || actionHint || 'createLead';

  // ── Step 2: Execute the action handler ────────────────────────────────────
  let result;
  try {
    result = await executeAction(actionName, extraction.params || {}, sessionId);
  } catch (err) {
    result = { success: false, message: err.message, data: {} };
  }

  return {
    type:            'action',
    actionName,
    params:          extraction.params       || {},
    extractionNotes: extraction.extractionNotes || '',
    success:         result.success,
    result,
  };
}

export default { actionAgent };
