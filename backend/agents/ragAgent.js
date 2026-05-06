/**
 * RAG Agent — Specialized Knowledge Retrieval & Synthesis Agent
 *
 * Receives a specific task from the Orchestrator, performs semantic
 * search via Weaviate, and returns structured evidence with confidence.
 */

import OpenAI from 'openai';
import { retrieveContext } from '../rag/documentStore.js';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RAG_AGENT_PROMPT = `You are a specialized Knowledge Retrieval Agent.
You have been given a task and relevant document chunks retrieved from the knowledge base.

Your job:
1. Analyze the retrieved chunks carefully
2. Identify the most relevant information for the task
3. Assess confidence level (0.0–1.0) based on how well the chunks answer the task
4. Return a structured assessment

RESPOND WITH VALID JSON ONLY:
{
  "relevantFindings": "<key facts extracted from the chunks that answer the task>",
  "confidence": <0.0-1.0>,
  "coverageGaps": "<what the chunks don't cover, if anything>",
  "recommendedAction": "answer" | "insufficient" | "partial"
}`;

/**
 * Execute the RAG agent for a given task
 * @param {string} userMessage   - Original user query (for broader context)
 * @param {string} task          - Specific task from the Orchestrator
 * @param {Array}  priorContext  - Results passed from upstream agents (for chaining)
 * @returns {{ type, chunks, findings, confidence, coverageGaps }}
 */
export async function ragAgent(userMessage, task, priorContext = []) {
  // Use the specific task for retrieval (more targeted than raw user message)
  const query = task || userMessage;

  // ── Step 1: Retrieve from Weaviate ─────────────────────────────────────────
  let chunks = [];
  try {
    chunks = await retrieveContext(query, 4);
    // Also retrieve for the original message if task differs (cast widened net)
    if (task !== userMessage) {
      const broader = await retrieveContext(userMessage, 2);
      // Merge unique chunks (by content fingerprint)
      const seen = new Set(chunks.map(c => c.content.slice(0, 50)));
      for (const c of broader) {
        if (!seen.has(c.content.slice(0, 50))) {
          chunks.push(c);
          seen.add(c.content.slice(0, 50));
        }
      }
    }
  } catch (err) {
    console.error('[RAGAgent] Weaviate retrieval failed:', err.message);
    return {
      type: 'rag', chunks: [], findings: '', confidence: 0,
      coverageGaps: 'Weaviate retrieval failed — knowledge base may be empty',
      recommendedAction: 'insufficient',
    };
  }

  if (!chunks.length) {
    return {
      type: 'rag', chunks: [], findings: '',
      confidence: 0, coverageGaps: 'No relevant documents found in knowledge base.',
      recommendedAction: 'insufficient',
    };
  }

  // ── Step 2: Analyse chunks via RAG Agent LLM ───────────────────────────────
  const chunkText = chunks
    .map((c, i) => `[Chunk ${i + 1} — ${c.source} (score: ${c.score})]:\n${c.content}`)
    .join('\n\n---\n\n');

  const priorSummary = priorContext.length > 0
    ? `\nCONTEXT FROM PRIOR AGENTS:\n${priorContext.map(r => r.findings || '').join('\n')}\n`
    : '';

  const messages = [
    { role: 'system', content: RAG_AGENT_PROMPT },
    {
      role: 'user',
      content: `TASK: ${task}\n\nRETRIEVED CHUNKS:\n${chunkText}${priorSummary}`,
    },
  ];

  let analysis = { relevantFindings: '', confidence: 0.5, coverageGaps: '', recommendedAction: 'partial' };
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });
    analysis = JSON.parse(res.choices[0].message.content);
  } catch (err) {
    console.warn('[RAGAgent] Analysis LLM failed:', err.message);
  }

  return {
    type:              'rag',
    chunks,
    findings:          analysis.relevantFindings   || '',
    confidence:        analysis.confidence         ?? 0.5,
    coverageGaps:      analysis.coverageGaps       || '',
    recommendedAction: analysis.recommendedAction  || 'partial',
  };
}

export default { ragAgent };
