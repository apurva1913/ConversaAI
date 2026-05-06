/**
 * RAG Layer - Weaviate Cloud vector store with OpenAI text2vec embeddings
 *
 * Setup:
 *  1. Create a free sandbox at https://console.weaviate.cloud
 *  2. Copy the cluster URL and API key into your .env
 *  3. The collection "ConversaDocument" is auto-created on first run
 *
 * The text2vec-openai module lives inside Weaviate Cloud — no extra
 * embedding calls needed; Weaviate handles them automatically using
 * your OPENAI_API_KEY header.
 */

import weaviate from 'weaviate-client';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const COLLECTION_NAME = 'ConversaDocument';

// ── Lazy singleton client ─────────────────────────────────────────────────────
let _initPromise = null;
let _client = null;
let _collection = null;

async function getClient() {
  if (_client) return _client;
  
  // Use a promise to ensure initialization only runs once, even if called concurrently
  if (!_initPromise) {
    _initPromise = (async () => {
      const url = process.env.WEAVIATE_URL;
      const apiKey = process.env.WEAVIATE_API_KEY;

      if (!url || !apiKey) {
        throw new Error(
          'Missing WEAVIATE_URL or WEAVIATE_API_KEY in environment. ' +
          'Create a free cluster at https://console.weaviate.cloud'
        );
      }

      const client = await weaviate.connectToWeaviateCloud(url, {
        authCredentials: new weaviate.ApiKey(apiKey),
        headers: {
          'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY,
        },
        // Fix for gRPC connection issues in high-latency environments
        skipInitChecks: true,
      });

      await ensureCollection(client);
      _client = client;
      return client;
    })();
  }
  
  return _initPromise;
}

async function getCollection() {
  if (_collection) return _collection;
  const client = await getClient();
  _collection = client.collections.get(COLLECTION_NAME);
  return _collection;
}

// ── Collection bootstrap ──────────────────────────────────────────────────────
async function ensureCollection(client) {
  const exists = await client.collections.exists(COLLECTION_NAME);
  if (exists) return;

  console.log(`[Weaviate] Creating collection "${COLLECTION_NAME}"…`);
  try {
    await client.collections.create({
      name: COLLECTION_NAME,
      description: 'Chunked documents for Conversa AI RAG pipeline',
      // text2vec-openai is available on every Weaviate Cloud free sandbox
      vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
        model: 'text-embedding-3-small',
        sourceProperties: ['content'],
      }),
      properties: [
        { name: 'content',     dataType: weaviate.configure.dataType.TEXT },
        { name: 'docId',       dataType: weaviate.configure.dataType.TEXT },
        { name: 'filename',    dataType: weaviate.configure.dataType.TEXT },
        { name: 'chunkIndex',  dataType: weaviate.configure.dataType.INT },
        { name: 'totalChunks', dataType: weaviate.configure.dataType.INT },
        { name: 'ingestedAt',  dataType: weaviate.configure.dataType.TEXT },
        { name: 'size',        dataType: weaviate.configure.dataType.INT },
      ],
    });
    console.log(`[Weaviate] Collection "${COLLECTION_NAME}" created ✓`);
  } catch (err) {
    // If it was created by a parallel process in the mean time, ignore the error
    if (err.message?.includes('already exists')) {
      console.log(`[Weaviate] Collection "${COLLECTION_NAME}" already exists (verified via catch).`);
    } else {
      throw err;
    }
  }
}

// ── Text chunking ─────────────────────────────────────────────────────────────
function chunkText(text, chunkSize = 400, overlap = 80) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim().length > 50) chunks.push(chunk);
    if (i + chunkSize >= words.length) break;
  }
  return chunks;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ingest a document: chunk it and upsert each chunk into Weaviate.
 * Returns { docId, chunks }.
 */
export async function ingestDocument(content, metadata = {}) {
  const collection = await getCollection();
  const docId = uuidv4();
  const chunks = chunkText(content);
  const now = new Date().toISOString();

  // Batch insert all chunks
  const objects = chunks.map((chunk, i) => ({
    properties: {
      content:     chunk,
      docId,
      filename:    metadata.filename   || 'Unknown',
      chunkIndex:  i,
      totalChunks: chunks.length,
      ingestedAt:  now,
      size:        metadata.size       || 0,
    },
  }));

  const result = await collection.data.insertMany(objects);

  if (result.hasErrors) {
    const errs = Object.values(result.errors).map(e => e.message).join('; ');
    throw new Error(`Weaviate insert errors: ${errs}`);
  }

  console.log(`[RAG] Ingested "${metadata.filename}" → docId=${docId}, chunks=${chunks.length}`);
  return { docId, chunks: chunks.length };
}

/**
 * Retrieve the top-K most semantically relevant chunks for a query.
 * Returns an array of { content, score, source, docId, chunkIndex }.
 */
export async function retrieveContext(query, topK = 3) {
  const collection = await getCollection();

  const results = await collection.query.nearText(query, {
    limit: topK,
    returnMetadata: ['certainty', 'distance'],
  });

  return results.objects.map(obj => ({
    content:    obj.properties.content,
    score:      obj.metadata?.certainty
                  ? Math.round(obj.metadata.certainty * 100) / 100
                  : null,
    source:     obj.properties.filename || 'Document',
    docId:      obj.properties.docId,
    chunkIndex: obj.properties.chunkIndex,
  }));
}

/**
 * List all unique documents (grouped by docId) currently in the store.
 */
export async function listDocuments() {
  const collection = await getCollection();

  // Fetch all chunks (up to 1000) – enough for a demo
  const results = await collection.query.fetchObjects({
    limit: 1000,
    returnProperties: ['docId', 'filename', 'ingestedAt', 'totalChunks', 'size'],
  });

  const docs = new Map();
  for (const obj of results.objects) {
    const { docId, filename, ingestedAt, totalChunks, size } = obj.properties;
    if (!docs.has(docId)) {
      docs.set(docId, { id: docId, filename, uploadedAt: ingestedAt, chunks: totalChunks, size });
    }
  }
  return Array.from(docs.values());
}

/**
 * Delete all chunks belonging to a given docId.
 */
export async function deleteDocument(docId) {
  const collection = await getCollection();

  const result = await collection.data.deleteMany(
    collection.filter.byProperty('docId').equal(docId)
  );

  console.log(`[RAG] Deleted docId=${docId}, removed=${result.successful}`);
  return { removed: result.successful };
}

/**
 * Return aggregate stats about the document store.
 */
export async function getDocumentStats() {
  try {
    const docs = await listDocuments();
    const totalChunks = docs.reduce((sum, d) => sum + (d.chunks || 0), 0);
    return { totalDocuments: docs.length, totalChunks };
  } catch {
    return { totalDocuments: 0, totalChunks: 0 };
  }
}

export default {
  ingestDocument,
  retrieveContext,
  listDocuments,
  deleteDocument,
  getDocumentStats,
};
