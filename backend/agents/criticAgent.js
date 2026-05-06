/**
 * Critic Agent — Quality Assurance & Self-Reflection Layer
 *
 * Evaluates the combined output of all agents BEFORE the final response
 * is synthesized. Scores on: accuracy, completeness, groundedness, action coverage.
 * If score < 7, returns improvement suggestions the Synthesizer incorporates.
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CRITIC_PROMPT = `You are a Quality Assurance Critic Agent for an AI customer support system.
A multi-agent pipeline has executed. Review its results and score the quality.

SCORING CRITERIA (each 0-10, then average):
1. Task Coverage    — Did the agents handle ALL parts of the user's query?
2. RAG Groundedness — Are knowledge-base answers grounded in retrieved sources?
3. Action Accuracy  — Were actions executed with correct, complete parameters?
4. Completeness     — Is anything missing that the user clearly needed?
5. Coherence        — Do multi-agent results fit together meaningfully?

RESPOND WITH VALID JSON ONLY:
{
  "scores": {
    "taskCoverage":    <0-10>,
    "ragGroundedness": <0-10>,
    "actionAccuracy":  <0-10>,
    "completeness":    <0-10>,
    "coherence":       <0-10>
  },
  "overallScore":  <0-10 average>,
  "approved":      <true if overallScore >= 7>,
  "issues":        ["<specific issue 1>", "<specific issue 2>"],
  "suggestions":   ["<improvement for synthesizer>"],
  "critiqueSummary": "<one sentence verdict>"
}`;

/**
 * Run the Critic agent over agent results
 *
 * @param {string} userMessage        - The original user query
 * @param {Array}  planSteps          - The orchestrator's plan
 * @param {Object} agentResults       - Map of stepId → agent result
 * @param {Array}  ragChunks          - All retrieved RAG chunks
 * @param {Array}  actionResults      - All action agent results
 */
export async function criticAgent(userMessage, planSteps, agentResults, ragChunks, actionResults) {
  // Build a summary of all agent work for the critic to review
  const agentSummary = Object.entries(agentResults).map(([stepId, result]) => {
    if (result.type === 'rag') {
      return `[${stepId} — RAG Agent]\n  Task: ${planSteps.find(s => s.id === stepId)?.task}\n  Chunks Retrieved: ${result.chunks?.length || 0}\n  Confidence: ${result.confidence ?? '—'}\n  Findings: ${result.findings?.slice(0, 300) || 'None'}\n  Gaps: ${result.coverageGaps || 'None'}`;
    }
    if (result.type === 'action') {
      return `[${stepId} — Action Agent]\n  Task: ${planSteps.find(s => s.id === stepId)?.task}\n  Action: ${result.actionName}\n  Success: ${result.success}\n  Params: ${JSON.stringify(result.params)}\n  Notes: ${result.extractionNotes || 'None'}`;
    }
    return `[${stepId} — General]: No specialized agent used`;
  }).join('\n\n');

  const messages = [
    { role: 'system', content: CRITIC_PROMPT },
    {
      role: 'user',
      content: `USER QUERY: "${userMessage}"\n\nEXECUTED PLAN (${planSteps.length} steps):\n${planSteps.map(s => `- ${s.id}: ${s.agent} → "${s.task}"`).join('\n')}\n\nAGENT RESULTS:\n${agentSummary}`,
    },
  ];

  const start = Date.now();
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(res.choices[0].message.content);
    return {
      scores:          parsed.scores          || {},
      overallScore:    parsed.overallScore    ?? 7,
      approved:        parsed.approved        ?? true,
      issues:          parsed.issues          || [],
      suggestions:     parsed.suggestions     || [],
      critiqueSummary: parsed.critiqueSummary || '',
      latency:         Date.now() - start,
    };
  } catch (err) {
    console.warn('[CriticAgent] Failed:', err.message);
    // On failure, approve by default to not block the response
    return {
      scores: {}, overallScore: 7, approved: true,
      issues: [], suggestions: [],
      critiqueSummary: `Critic evaluation unavailable (${err.message})`,
      latency: Date.now() - start,
    };
  }
}

export default { criticAgent };
