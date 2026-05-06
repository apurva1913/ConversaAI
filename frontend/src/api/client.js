import { io } from 'socket.io-client';

const API_BASE = '/api';
const SOCKET_URL = 'http://localhost:5000'; // Target backend for sockets

let socket;
let listeners = new Map();

/**
 * Initialize Socket for real-time live support
 */
export function initSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.log('✅ Socket connected to backend:', socket.id));
    socket.on('connect_error', (err) => console.error('❌ Socket connection error:', err));

    socket.on('new_message', (data) => {
      console.log('📡 [Socket] New Message Received:', data);
      listeners.forEach(cb => cb(data));
    });
  }
  return socket;
}

export function registerSocketListener(id, callback) {
  listeners.set(id, callback);
}

export function unregisterSocketListener(id) {
  listeners.delete(id);
}

export function joinSocketSession(sessionId) {
  socket?.emit('join_session', sessionId);
}

export function sendSocketMessage(sessionId, role, content) {
  socket?.emit('send_message', { sessionId, role, content });
}

/**
 * SSE Chat Stream with full event support
 */
export async function sendMessage(message, sessionId, handlers) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });

  if (!res.ok) throw new Error(`Server returned ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let currentEvent = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          switch (currentEvent) {
            case 'status':         handlers.onStatus?.(data); break;
            case 'plan':           handlers.onPlan?.(data); break;
            case 'agent_start':    handlers.onAgentStart?.(data); break;
            case 'agent_complete': handlers.onAgentComplete?.(data); break;
            case 'context':        handlers.onContext?.(data); break;
            case 'critic':         handlers.onCritic?.(data); break;
            case 'chunk':          handlers.onChunk?.(data.content); break;
            case 'action':         handlers.onAction?.(data); break;
            case 'done':           handlers.onDone?.(data); break;
            case 'error':          handlers.onError?.(data); break;
          }
          currentEvent = null;
        } catch (e) {
          console.warn('Failed to parse SSE data:', e);
        }
      }
    }
  }
}

/**
 * Knowledge Base (RAG) API
 */
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/rag/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function getDocuments() {
  const res = await fetch(`${API_BASE}/rag/documents`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function deleteDocument(docId) {
  const res = await fetch(`${API_BASE}/rag/documents/${docId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

export async function ingestText(content, title) {
  const res = await fetch(`${API_BASE}/rag/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, title }),
  });
  if (!res.ok) throw new Error('Text ingestion failed');
  return res.json();
}

/**
 * Sessions API (Persistence)
 */
export async function getSessions() {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function getSessionDetails(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error('Failed to fetch session history');
  return res.json();
}

export async function updateSessionStatus(sessionId, status, isEscalated) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, isEscalated }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

/**
 * Analytics API
 */
export async function getAnalytics() {
  const res = await fetch(`${API_BASE}/analytics`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}
