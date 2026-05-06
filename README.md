<div align="center">

# 🤖 Conversa AI

### Production-Grade AI Customer Support Platform

[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Weaviate](https://img.shields.io/badge/Weaviate-Vector%20DB-FF6900?style=for-the-badge&logoColor=white)](https://weaviate.io)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**An end-to-end AI SaaS demo featuring RAG, LLM-based Intent Routing, Streaming Responses, and a production-ready React dashboard.**

[Live Demo](#) · [Architecture](#architecture) · [Setup](#quick-start) · [API Docs](#api-reference)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **LLM Agent Router** | GPT classifies every query into RAG / Action / General — no keyword matching |
| 📚 **RAG Pipeline** | Weaviate Cloud vector DB with `text-embedding-3-small` for semantic retrieval |
| ⚡ **Action Handlers** | Mock APIs: booking, lead capture, order status, human escalation |
| 🔄 **SSE Streaming** | Token-by-token streaming with typing indicator and cursor blink |
| 💾 **Conversation Memory** | Session-scoped rolling history (last 10 messages) |
| 📊 **Live Dashboard** | Real-time analytics: query breakdown, response times, donut charts |
| 🔍 **Debug Panel** | Per-request agent reasoning, retrieved context, confidence score |
| 📁 **Knowledge Base UI** | Drag-and-drop PDF/TXT/MD/CSV upload + text paste ingestion |
| 🎨 **Premium Dark UI** | Glassmorphism, micro-animations, gradient accents, fully responsive |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Frontend                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────┐  │
│  │  Chat UI │  │ Knowledge Base│  │ Dashboard │  │  Debug   │  │
│  │ (Stream) │  │ (Upload/List) │  │(Analytics)│  │  (Logs)  │  │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  └────┬─────┘  │
└───────┼───────────────┼────────────────┼──────────────┼────────┘
        │ SSE / REST    │                │              │
        ▼               ▼                ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Node.js / Express API                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             /agents/orchestratorAgent (ReAct)             │  │
│  │  1. Plan: Decomposes query into execution steps           │  │
│  │  2. Dispatch: Runs specialized agents (sync/parallel)     │  │
│  └────┬─────────────────────────────┬───────────────────┬───┘  │
│       │                             │                   │      │
│  ┌────▼─────────────┐      ┌────────▼──────────┐        │      │
│  │   ragAgent.js    │      │  actionAgent.js   │        │      │
│  │ Retreives facts  │      │ Extracts params   │        │      │
│  │ & scores confid. │      │ & calls handler   │        │      │
│  └────┬─────────────┘      └────────┬──────────┘        │      │
│       │                             │                   │      │
│  ┌────▼─────────────────────────────▼───────────────────▼───┐  │
│  │                     criticAgent.js                        │  │
│  │  3. Evaluate: Scores exactness, groundedness, completeness│  │
│  │  4. Synthesize: Streams final validated response          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────┐   ┌──────────────────────────────┐  │
│  │  /memory/sessionMemory│   │  /analytics/analyticsStore   │  │
│  │  In-memory rolling   │   │  Query counts, timings, logs  │  │
│  │  conversation history │   └──────────────────────────────┘  │
│  └──────────────────────┘                                      │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │        Weaviate Cloud         │
                    │  Collection: ConversaDocument │
                    │  Vectorizer: text2vec-openai  │
                    │  Model: text-embedding-3-small│
                    └──────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **OpenAI API Key** — [platform.openai.com](https://platform.openai.com)
- **Weaviate Cloud (Free)** — [console.weaviate.cloud](https://console.weaviate.cloud)

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/conversa-ai.git
cd conversa-ai
```

### 2. Set up Weaviate Cloud (Free tier)

1. Go to [console.weaviate.cloud](https://console.weaviate.cloud) → **Create cluster** → choose **Free sandbox**
2. Copy your **Cluster URL** (e.g. `https://xxx.weaviate.network`)
3. Go to **API Keys** tab → copy the **Admin key**

### 3. Configure Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```env
OPENAI_API_KEY=sk-...your-key...
WEAVIATE_URL=https://your-cluster.weaviate.network
WEAVIATE_API_KEY=your-weaviate-admin-key
PORT=5000
```

### 4. Install & Run Backend

```bash
# In /backend
npm install
npm run dev
# → http://localhost:5000
```

### 5. Install & Run Frontend

```bash
# In /frontend (new terminal)
npm install
npm run dev
# → http://localhost:5173
```

### 6. Open the app

Visit **http://localhost:5173** and start chatting! 🎉

On first document upload, Weaviate will automatically create the `ConversaDocument` collection.

---

## 📡 How RAG Works

```
User message
    │
    ▼
LLM classifies intent as "rag"
    │
    ▼
retrieveContext(query, topK=3)
    │
    ├── Weaviate nearText() semantic search
    │   (using pre-embedded vectors from text-embedding-3-small)
    │
    ▼
Top-3 document chunks returned with similarity scores
    │
    ▼
Chunks injected into LLM system prompt as grounded context
    │
    ▼
GPT-4o-mini generates a cited, grounded answer
    │
    ▼
Response streamed token-by-token via SSE
```

**Document Ingestion Pipeline:**
1. File uploaded via multipart form → Multer saves it
2. Text extracted (PDF via `pdf-parse`, others as UTF-8)
3. Text split into **400-word chunks** with **80-word overlap** to preserve context across boundaries
4. Each chunk sent to Weaviate — **text2vec-openai** auto-vectorizes using `text-embedding-3-small`
5. File deleted from disk; vectors live in Weaviate permanently

---

## 🧠 How the ReAct Multi-Agent System Works

This system uses a **ReAct (Reasoning + Acting)** multi-agent loop, moving beyond simple classification. When a user sends a message, a pipeline of autonomous, specialized LLM agents is triggered:

1. **Orchestrator Agent**: Thinks step-by-step and decomposes the query into an **Execution Plan**. It can string together sequential steps (e.g. RAG first, then Action) or run agents in parallel.
2. **Specialized Agents**:
   - **RAG Agent**: Dispatched with a narrow task. Queries Weaviate, analyzes retrieved chunks, and scores its own confidence (0-1.0) on how well it answered the task.
   - **Action Agent**: Dispatched when business operations are needed. Extracts structured parameters from the conversation history and executes the mock backend handler.
3. **Critic Agent**: Reviews the combined output of all specialized agents. It scores the pipeline on Task Coverage, RAG Groundedness, Action Accuracy, and Completeness. If a score is below 7/10, it suggests refinements.
4. **Synthesizer**: Streams the final response to the user, incorporating context, action confirmations, and corrections from the Critic.

This architecture allows for complex compounding requests like: *"What is your refund policy, and also check the status of my order #12345."* (Both agents run in parallel, evaluate, and synthesize).

---

## ⚡ Action Handlers

| Action | Trigger Example | Returns |
|---|---|---|
| `bookAppointment` | "Book a demo for Tuesday at 3pm" | Booking ID, confirmation |
| `createLead` | "I'm interested in your pricing" | Lead ID, score (60-100) |
| `checkStatus` | "Where is my order #12345?" | Status, last updated |
| `escalateToHuman` | "I need to talk to someone now" | Ticket ID, wait time |

All action handlers are **mock implementations** — perfect for freelancing demos. Replace with real CRM/booking APIs (Salesforce, Calendly, etc.) for production.

---

## 📁 Project Structure

```
conversa-ai/
├── backend/
│   ├── agents/
│   │   └── conversaAgent.js     # LLM classification + response generation
│   ├── rag/
│   │   └── documentStore.js     # Weaviate integration (ingest, retrieve, list, delete)
│   ├── actions/
│   │   └── actionHandlers.js    # bookAppointment, createLead, checkStatus, escalate
│   ├── memory/
│   │   └── sessionMemory.js     # In-memory rolling conversation history
│   ├── analytics/
│   │   └── analyticsStore.js    # Query metrics and log store
│   ├── routes/
│   │   ├── chat.js              # POST /api/chat (SSE streaming pipeline)
│   │   ├── rag.js               # POST /api/rag/upload, GET /api/rag/documents
│   │   └── analytics.js         # GET /api/analytics
│   ├── uploads/                 # Temp upload dir (files deleted after ingestion)
│   ├── server.js                # Express entry + middleware
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js        # SSE streaming + REST API client
│   │   ├── components/
│   │   │   ├── Layout.jsx       # Sidebar + outlet shell
│   │   │   └── DebugPanel.jsx   # Live agent reasoning sidebar
│   │   ├── pages/
│   │   │   ├── ChatPage.jsx     # Main chat with streaming + sources
│   │   │   ├── KnowledgeBasePage.jsx  # Drag-drop upload + document list
│   │   │   ├── DashboardPage.jsx      # Analytics with SVG charts
│   │   │   └── DebugPage.jsx          # Query log table with filters
│   │   ├── App.jsx              # React Router setup
│   │   ├── main.jsx             # Entry point
│   │   └── index.css            # Full design system (no Tailwind)
│   ├── index.html
│   └── vite.config.js           # Proxy + build config
│
├── package.json                 # Root scripts
└── README.md
```

---

## 📡 API Reference

### POST `/api/chat`
Main chat endpoint — returns **Server-Sent Events** stream.

**Request:**
```json
{ "message": "Book a demo for tomorrow", "sessionId": "uuid-v4" }
```

**SSE Events:**
| Event | Payload | Description |
|---|---|---|
| `status` | `{ type, message }` | Pipeline step status (classifying, retrieving, etc.) |
| `classification` | `{ intent, confidence, reasoning, params }` | Agent decision |
| `context` | `{ sources: [{ content, score, source }] }` | RAG chunks found |
| `chunk` | `{ content: "token" }` | Streaming text delta |
| `action` | `{ result: { success, message, data } }` | Action execution result |
| `done` | `{ sessionId, responseType, context, debugLog, responseTime }` | Final event |
| `error` | `{ message, debugLog }` | Error event |

---

### POST `/api/rag/upload`
Upload a document (multipart/form-data). Field name: `file`.

**Response:**
```json
{ "success": true, "docId": "uuid", "chunks": 12, "filename": "policy.pdf" }
```

### GET `/api/rag/documents`
List all ingested documents with metadata.

### DELETE `/api/rag/documents/:docId`
Remove a document and all its chunks from Weaviate.

### POST `/api/rag/text`
Ingest raw text without uploading a file.

```json
{ "content": "Our return policy is...", "title": "Return Policy" }
```

### GET `/api/analytics`
Full platform metrics (queries, actions, sessions, documents, recent logs).

---

## 🎯 Use Cases for Demos

1. **SaaS Onboarding Bot** — Upload product docs, answer user questions via RAG
2. **E-commerce Support** — Handle returns, order status, and escalation
3. **B2B Lead Qualification** — Capture and score inbound leads automatically
4. **Appointment Scheduling** — Natural language booking via action handler
5. **HR/IT Helpdesk** — Upload internal policies, answer employee queries

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 5, React Router v6, Vanilla CSS |
| **Backend** | Node.js, Express 4, ES Modules |
| **AI Model** | OpenAI GPT-4o-mini (chat + classification) |
| **Embeddings** | OpenAI text-embedding-3-small (via Weaviate) |
| **Vector DB** | Weaviate Cloud (free sandbox) |
| **Streaming** | Server-Sent Events (SSE) |
| **Memory** | In-memory session store (production: Redis) |
| **File Parsing** | pdf-parse (PDF), native UTF-8 (TXT/MD/CSV) |

---

## 🔧 Production Upgrade Path

| Current (Demo) | Production Recommendation |
|---|---|
| In-memory session memory | Redis / Upstash |
| Mock action handlers | Real CRM APIs (Salesforce, HubSpot) |
| In-memory analytics | PostgreSQL / TimescaleDB |
| No auth | Clerk / Auth0 / NextAuth |
| Single server | Docker + Load balancer |
| Weaviate free sandbox | Weaviate Cloud paid / self-hosted |

---

---

<div align="center">
  <strong>⭐ If you found this useful, please star the repo!</strong><br/>
  <a href="https://github.com/yourusername/conversa-ai">GitHub</a> ·
  <a href="https://linkedin.com/in/yourprofile">LinkedIn</a>
</div>
