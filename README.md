# Naive RAG

Naive RAG is a local full-stack RAG app for uploading PDF, DOCX, or TXT files, storing document chunks in Pinecone, and asking document-grounded questions through Groq's OpenAI-compatible API.

## Features

- React + Vite dashboard frontend
- Node.js + Express backend
- PDF, DOCX, and TXT upload support
- Conservative overlapping text chunking
- Embeddings from Pinecone Inference using `multilingual-e5-large`
- Vector storage and retrieval in Pinecone through the REST API
- Groq LLM answers through the OpenAI-compatible API
- Strict grounded-answer behavior with citations
- Upload progress, active-file state, clean errors, and vector reset

## Setup

1. Install dependencies:

```bash
npm run install:all
```

If npm has trouble writing cache files inside a OneDrive-synced folder on Windows, use a temp cache:

```bash
$env:npm_config_cache="$env:TEMP\navierag-npm-cache"
npm run install:all
```

2. Create environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Fill in `backend/.env` with your Pinecone and Groq keys.

4. Start both apps:

```bash
npm run dev
```

The frontend runs at `http://localhost:5173` and the backend runs at `http://localhost:4000`.

## Backend Environment

Required values:

```env
PORT=4000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173

PINECONE_API_KEY=
PINECONE_INDEX_NAME=naive-rag
PINECONE_NAMESPACE=default
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1

LLM_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_API_URL=https://api.groq.com/openai/v1

LANGSMITH_TRACING=false
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=naive-rag
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=naive-rag
```

## API Routes

- `GET /health`
- `POST /api/upload`
- `POST /api/query`
- `DELETE /api/reset`

## Vercel Notes

This repo is split into `frontend` and `backend` packages. For Vercel, deploy `frontend` as the web app and deploy the Express backend as a separate Node service, then set `VITE_API_URL` to the backend URL. Pinecone and Groq secrets should be configured only on the backend deployment.

For quick local validation:

```bash
npm run check
```

If a local security policy blocks Node from spawning the Vite/esbuild binary inside OneDrive, move the project to a non-synced folder or run the build from a terminal with permission to execute local npm binaries.
