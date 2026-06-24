# Learning Hub Agent

RAG-powered chat agent over the Learning Hub topic articles.  
Uses **Groq** (free tier) + **LLaMA 3.3 70B** for fast, high-quality answers.

## Quick start — local Node.js

```bash
# 1. Get a free Groq API key at https://console.groq.com
# 2. From this directory:
cd agent
cp .env.example .env          # then paste your key into .env
npm install
GROQ_API_KEY=your_key_here npm start
```

Server starts on **http://localhost:3030**.  
Open any Learning Hub page — the 🤖 chat button appears bottom-right.

## Quick start — Docker

```bash
# Build
docker build -t learning-hub-agent ./agent

# Run (mounts the hub root so the container can read all articles)
docker run -p 3030:3030 \
  -e GROQ_API_KEY=your_key_here \
  -v "$(pwd):/hub:ro" \
  learning-hub-agent
```

> The Dockerfile sets `HUB_ROOT=/hub` automatically via the volume mount.  
> The server reads articles from that path at startup.

## How it works

1. **Indexing** — on startup, every `.html` file under `topics/` is parsed with  
   `node-html-parser`, stripped to plain text, and tokenised for BM25.

2. **Retrieval** — each user query is scored against all articles with BM25.  
   The top 3 articles (up to 2 500 chars each) are injected into the system prompt.

3. **Generation** — conversation history (last 20 turns) + retrieved context +  
   user message are sent to Groq. The response streams back token-by-token via SSE.

4. **Widget** — `chat-widget.js` (root) renders the floating chat button and panel.  
   Source chips in each response link back to the relevant article, pre-filled with  
   the search query so `highlight.js` auto-highlights on arrival.

## Environment variables

| Variable       | Default               | Description                    |
|----------------|-----------------------|--------------------------------|
| `GROQ_API_KEY` | *(required)*          | Groq API key                   |
| `PORT`         | `3030`                | Port the server listens on     |

## API

| Method | Path              | Description                        |
|--------|-------------------|------------------------------------|
| GET    | `/health`         | Returns `{status, articles}`       |
| POST   | `/chat`           | `{message, sessionId}` → SSE stream|
| DELETE | `/session/:id`    | Clear conversation history         |
