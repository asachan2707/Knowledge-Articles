/**
 * Learning Hub Agent — Express + Groq RAG server
 *
 * On startup:
 *   - Crawls ../topics/**\/*.html (and a few root-level HTML pages) via ARTICLES_GLOB
 *   - Strips HTML to clean text using node-html-parser
 *   - Builds a BM25 index over all articles
 *
 * On POST /chat:
 *   - Scores every article against the user query with BM25
 *   - Injects the top-K article chunks as context
 *   - Maintains per-session conversation history (in-memory, TTL 30 min)
 *   - Streams the Groq response back to the client via SSE
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const Groq    = require('groq-sdk');
const { parse } = require('node-html-parser');

// ── Config ────────────────────────────────────────────────────────────────────

const PORT        = process.env.PORT || 3030;
const GROQ_API_KEY= process.env.GROQ_API_KEY || '';
const MODEL       = 'llama-3.3-70b-versatile';
const TOP_K       = 3;       // articles to inject per query
const MAX_CHUNK   = 2500;    // characters per article in the context
const SESSION_TTL = 30 * 60 * 1000;  // 30 minutes

// Root of the Learning Hub (one level up from agent/)
const HUB_ROOT = path.resolve(__dirname, '..');

// ── HTML → text ───────────────────────────────────────────────────────────────

function htmlToText(html) {
  const root = parse(html);
  // Remove script / style nodes
  root.querySelectorAll('script, style, noscript').forEach(n => n.remove());
  // Grab meaningful text
  return root.structuredText
    .replace(/\s{3,}/g, '\n\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

// ── Article loader ────────────────────────────────────────────────────────────

function loadArticles() {
  const articles = [];

  // Recursively find every .html file under topics/
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // skip node_modules
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.name.endsWith('.html')) {
        try {
          const html  = fs.readFileSync(full, 'utf8');
          const text  = htmlToText(html);
          if (text.length < 100) continue; // skip stubs

          // Build a human-readable title from the <title> tag or filename
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
    const tf  = freqs[t];
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

const sessions = new Map();   // sessionId → { history: [], lastSeen: Date }

function getSession(id) {
  const now = Date.now();
  let sess = sessions.get(id);
  if (!sess) {
    sess = { history: [], lastSeen: now };
    sessions.set(id, sess);
  }
  sess.lastSeen = now;
  return sess;
}

// Evict stale sessions every 10 minutes
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
    // Focused tutor prompt — answers must stay within this article's content
    const article = contextArticles[0];
    return `You are a focused tutor for the article "${article ? article.title : 'this topic'}" \
in the Learning Hub.

Your ONLY knowledge source for this conversation is the article content provided below. \
Answer questions directly and concisely, citing specific sections when helpful. \
If the user asks about something not covered in this article, say: \
"That topic isn't covered in this article — try asking the Hub Agent from the home page for a broader answer."

Do NOT answer from general knowledge when the article doesn't cover the topic. \
Keep responses well-structured with bullet points or numbered steps where it helps clarity.

ARTICLE CONTENT:
${ctx}`;
  }

  // General hub-wide prompt
  return `You are the Learning Hub Agent — a knowledgeable assistant for the Learning Hub, \
a curated collection of technical articles covering AI, Python, system design, Salesforce, \
cloud infrastructure, career development, and more.

Your job is to answer the user's questions using the article excerpts provided below as your \
primary source of knowledge. Be clear, concrete, and cite the article title when you draw \
from it. If the answer isn't in the articles, say so and give a brief general answer.

Keep responses well-structured: use bullet points or numbered steps where it helps clarity. \
Avoid being verbose — the user is a practising engineer.

RELEVANT ARTICLES:
${ctx}`;
}

// ── Express app ───────────────────────────────────────────────────────────────

const app     = express();
const groq    = new Groq({ apiKey: GROQ_API_KEY });

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
  res.json({ status: 'ok', articles: articles.length });
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
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not set on the server' });
  }

  // Topic-page mode: pin to that single article; skip BM25.
  // Global mode: BM25 retrieval across all articles.
  let relevant;
  let topicMode = false;
  if (topicRel && typeof topicRel === 'string') {
    const pinned = articles.find(a => a.rel === topicRel);
    relevant  = pinned ? [pinned] : retrieve(message, articles, idf);
    topicMode = !!pinned;
  } else {
    relevant = retrieve(message, articles, idf);
  }

  // Build messages array
  const sess = getSession(sessionId);
  const systemPrompt = buildSystemPrompt(relevant, topicMode);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...sess.history,
    { role: 'user',   content: message.trim() }
  ];

  // Stream SSE response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let fullReply = '';

  try {
    const stream = await groq.chat.completions.create({
      model:       MODEL,
      messages,
      stream:      true,
      temperature: 0.3,
      max_tokens:  1024
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) {
        fullReply += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    // Persist to session history (keep last 20 turns to avoid token explosion)
    sess.history.push({ role: 'user',      content: message.trim() });
    sess.history.push({ role: 'assistant', content: fullReply });
    if (sess.history.length > 40) sess.history = sess.history.slice(-40);

    // Send source metadata
    const sources = relevant.map(a => ({ title: a.title, rel: a.rel }));
    res.write(`data: ${JSON.stringify({ done: true, sources })}\n\n`);
  } catch (err) {
    console.error('[agent] Groq error:', err.message);
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
  console.log(`[agent] Model: ${MODEL}`);
  console.log(`[agent] Articles indexed: ${articles.length}`);
});
