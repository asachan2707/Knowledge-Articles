/**
 * Learning Hub Agent — Express + Claude RAG server
 *
 * On startup:
 *   - Crawls ../topics/**\/*.html (and sources/) via loadArticles()
 *   - Strips HTML to clean text using node-html-parser
 *   - Builds a BM25 index over all articles
 *
 * On POST /chat:
 *   - Scores every article against the user query with BM25
 *   - Injects the top-K article chunks as context into the system prompt
 *   - Maintains per-session conversation history (in-memory, TTL 30 min)
 *   - If ANTHROPIC_BEDROCK_BASE_URL is set: calls the Bedrock /invoke endpoint
 *     directly (Salesforce proxy format: /model/{modelId}/invoke)
 *   - Otherwise: uses the standard Anthropic SDK streaming API
 *   - Streams the response back to the client via SSE
 *
 * Config (env vars, loaded from .env if present):
 *   ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY — required
 *   ANTHROPIC_BEDROCK_BASE_URL — set to use Salesforce/Bedrock proxy
 *   CLAUDE_MODEL       — model ID (e.g. global.anthropic.claude-sonnet-4-6)
 *   PORT               — optional, default 3030
 */

'use strict';

require('dotenv').config();

const fs        = require('fs');
const path      = require('path');
const express   = require('express');
const cors      = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { parse } = require('node-html-parser');

// ── Config ────────────────────────────────────────────────────────────────────

const PORT              = process.env.PORT || 3030;
// Support both standard key (ANTHROPIC_API_KEY) and Salesforce proxy token (ANTHROPIC_AUTH_TOKEN)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
const BEDROCK_BASE_URL  = process.env.ANTHROPIC_BEDROCK_BASE_URL || '';
const MODEL             = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const TOP_K            = 3;
const MAX_CHUNK        = 3000;   // chars per article injected into context
const SESSION_TTL      = 30 * 60 * 1000;  // 30 minutes

const HUB_ROOT = path.resolve(__dirname, '..');

// ── HTML → text ───────────────────────────────────────────────────────────────

function htmlToText(html) {
  const root = parse(html);
  root.querySelectorAll('script, style, noscript').forEach(n => n.remove());
  return root.structuredText
    .replace(/\s{3,}/g, '\n\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

// ── Article loader ────────────────────────────────────────────────────────────

function loadArticles() {
  const articles = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        try {
          const html = fs.readFileSync(full, 'utf8');
          const text = htmlToText(html);
          if (text.length < 100) continue;

          const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
          const title = titleMatch
            ? titleMatch[1].replace(/\s*\|\s*Learning Hub\s*/i, '').trim()
            : path.basename(full, '.html');

          const rel = path.relative(HUB_ROOT, full);
          articles.push({ title, rel, text, tokens: tokenize(text) });
        } catch (_) {}
      }
    }
  }

  walk(path.join(HUB_ROOT, 'topics'));

  const sourcesDir = path.join(__dirname, 'sources');
  if (fs.existsSync(sourcesDir)) walk(sourcesDir);

  console.log(`[agent] Loaded ${articles.length} articles`);
  return articles;
}

// ── BM25 ──────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','it','its','this','that',
  'these','those','i','you','we','they','he','she','what','which','who','how',
  'all','any','both','each','few','more','most','other','some','such','no',
  'not','only','own','same','so','than','too','very','just','can','from'
]);

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function buildIDF(articles) {
  const df = {};
  for (const art of articles) {
    const uniq = new Set(art.tokens);
    for (const t of uniq) df[t] = (df[t] || 0) + 1;
  }
  const N   = articles.length;
  const idf = {};
  for (const [t, n] of Object.entries(df)) {
    idf[t] = Math.log((N - n + 0.5) / (n + 0.5) + 1);
  }
  return idf;
}

function bm25Score(queryTokens, artTokens, idf, k1 = 1.5, b = 0.75, avgLen = 500) {
  const len   = artTokens.length;
  const freqs = {};
  for (const t of artTokens) freqs[t] = (freqs[t] || 0) + 1;

  let score = 0;
  for (const t of queryTokens) {
    if (!(t in freqs)) continue;
    const tf   = freqs[t];
    const idfT = idf[t] || 0;
    score += idfT * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * len / avgLen));
  }
  return score;
}

function retrieve(query, articles, idf, k = TOP_K) {
  const qTokens = tokenize(query);
  const avgLen  = articles.reduce((s, a) => s + a.tokens.length, 0) / articles.length;
  const scored  = articles.map(a => ({
    ...a,
    score: bm25Score(qTokens, a.tokens, idf, 1.5, 0.75, avgLen)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).filter(a => a.score > 0);
}

// ── Session store ─────────────────────────────────────────────────────────────

const sessions = new Map();

function getSession(id) {
  const now  = Date.now();
  let sess   = sessions.get(id);
  if (!sess) {
    sess = { history: [], lastSeen: now };
    sessions.set(id, sess);
  }
  sess.lastSeen = now;
  return sess;
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL;
  for (const [id, sess] of sessions) {
    if (sess.lastSeen < cutoff) sessions.delete(id);
  }
}, 10 * 60 * 1000);

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(contextArticles, topicMode) {
  const ctx = contextArticles.length
    ? contextArticles.map((a, i) =>
        `--- Article ${i + 1}: ${a.title} ---\n${a.text.slice(0, MAX_CHUNK)}`
      ).join('\n\n')
    : 'No specific articles matched. Answer from general knowledge.';

  if (topicMode) {
    const article = contextArticles[0];
    return `You are a focused tutor for the article "${article ? article.title : 'this topic'}" \
in the Learning Hub.

Your ONLY knowledge source for this conversation is the article content provided below. \
Answer questions directly and concisely, citing specific sections when helpful. \
If the user asks about something not covered in this article, say: \
"That topic isn't covered in this article — try asking the Hub Agent from the home page for a broader answer."

Do NOT answer from general knowledge when the article doesn't cover the topic. \
Keep responses well-structured with bullet points or numbered steps where it helps clarity. \
Use markdown formatting — **bold** for key terms, bullet lists, code blocks where relevant.

ARTICLE CONTENT:
${ctx}`;
  }

  return `You are the Learning Hub Agent — a knowledgeable assistant for a curated personal \
knowledge base covering AI, system design, prompt engineering, JavaScript, Python, \
infrastructure, databases, and related engineering topics.

Answer the user's questions using the article excerpts below as your primary source. \
Be clear and concrete. Cite the article title when you draw from it directly. \
If the answer isn't in the articles, say so briefly and then give a concise general answer.

Use markdown formatting — **bold** for key terms, bullet lists, code blocks for code examples. \
Keep responses tight and practical — the user is a practicing engineer.

RELEVANT ARTICLES:
${ctx}`;
}

// ── Express app ───────────────────────────────────────────────────────────────

const app       = express();
// Standard Anthropic SDK — only used when BEDROCK_BASE_URL is NOT set
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── Bedrock proxy call ────────────────────────────────────────────────────────
// Salesforce proxy speaks AWS Bedrock format: POST /model/{modelId}/invoke
// Body uses anthropic_version + system + messages (same as Anthropic Messages API).
// Returns the full response JSON; we then chunk it back to the client as SSE.

async function callBedrockInvoke(systemPrompt, messages, model, baseUrl, apiKey) {
  const endpoint = `${baseUrl}/model/${encodeURIComponent(model)}/invoke`;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    system:     systemPrompt,
    messages,
    max_tokens: 1024,
  });

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':    apiKey,
    },
    body,
  });

  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
  return json;
}

app.use(cors());
app.use(express.json());

// ── Load knowledge base at startup ───────────────────────────────────────────

let articles, idf;
try {
  articles = loadArticles();
  idf      = buildIDF(articles);
} catch (err) {
  console.error('[agent] Failed to load articles:', err.message);
  process.exit(1);
}

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', articles: articles.length, model: MODEL });
});

// ── Chat endpoint (streaming SSE) ─────────────────────────────────────────────

app.post('/chat', async (req, res) => {
  const { message, sessionId, topicRel } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'No API key set. Add ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN to agent/.env and restart.'
    });
  }

  // Retrieve relevant articles
  let relevant, topicMode = false;
  if (topicRel && typeof topicRel === 'string') {
    const pinned = articles.find(a => a.rel === topicRel);
    relevant  = pinned ? [pinned] : retrieve(message, articles, idf);
    topicMode = !!pinned;
  } else {
    relevant = retrieve(message, articles, idf);
  }

  const sess         = getSession(sessionId);
  const systemPrompt = buildSystemPrompt(relevant, topicMode);

  // Anthropic requires alternating user/assistant turns only in messages[];
  // system prompt is a separate top-level parameter.
  const messages = [
    ...sess.history,
    { role: 'user', content: message.trim() }
  ];

  // Stream SSE response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let fullReply = '';

  try {
    if (BEDROCK_BASE_URL) {
      // ── Bedrock proxy path (Salesforce internal gateway) ──────────────────
      // The proxy only supports /invoke (non-streaming), so we fetch the full
      // response then emit it in small SSE chunks so the UI still animates.
      const bedrockRes = await callBedrockInvoke(
        systemPrompt, messages, MODEL, BEDROCK_BASE_URL, ANTHROPIC_API_KEY
      );

      fullReply = bedrockRes?.content?.[0]?.text || '';
      if (!fullReply) throw new Error('Empty response from Bedrock proxy');

      // Emit in ~60-char chunks so the chat bubble fills progressively
      const CHUNK = 60;
      for (let i = 0; i < fullReply.length; i += CHUNK) {
        const delta = fullReply.slice(i, i + CHUNK);
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }

    } else {
      // ── Standard Anthropic SDK streaming path ─────────────────────────────
      const stream = anthropic.messages.stream({
        model:      MODEL,
        system:     systemPrompt,
        messages,
        max_tokens: 1024,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta'
        ) {
          const delta = event.delta.text;
          if (delta) {
            fullReply += delta;
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
        }
      }
    }

    // Persist to session history (keep last 20 turns)
    sess.history.push({ role: 'user',      content: message.trim() });
    sess.history.push({ role: 'assistant', content: fullReply });
    if (sess.history.length > 40) sess.history = sess.history.slice(-40);

    const sources = relevant.map(a => ({ title: a.title, rel: a.rel }));
    res.write(`data: ${JSON.stringify({ done: true, sources })}\n\n`);

  } catch (err) {
    console.error('[agent] Claude error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

// ── Clear session ─────────────────────────────────────────────────────────────

app.delete('/session/:id', (req, res) => {
  sessions.delete(req.params.id);
  res.json({ cleared: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[agent] Listening on http://localhost:${PORT}`);
  console.log(`[agent] Model:    ${MODEL}`);
  console.log(`[agent] Backend:  ${BEDROCK_BASE_URL || 'Anthropic API (direct)'}`);
  console.log(`[agent] Articles: ${articles.length} indexed`);
  if (!ANTHROPIC_API_KEY) {
    console.warn('[agent] ⚠  No API key set — chat requests will fail until .env is configured');
  }
});
