/**
 * Product Launch — Backend Server (multi-product)
 *
 * Route structure:
 *   GET  /api/products                              — public list
 *   GET  /api/products/:id                          — public single
 *   POST /api/products/:productId/waitlist/join     — join waitlist
 *   GET  /api/products/:productId/waitlist/count    — live count
 *   POST /api/products/:productId/buy               — flash sale buy
 *   POST /api/products/:productId/admin-launch      — admin fire launch
 *   POST /api/products/:productId/admin-reset       — admin reset
 *   GET  /api/products/:productId/admin-stats       — per-product stats
 *   GET  /api/products/:productId/admin-registrations
 *   GET  /api/admin/all-stats                       — global overview
 *   GET  /api/admin/jobs                            — mock job log
 */
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';

import { db } from './db/pool.js';
import { connectRedis, redis, redisSub } from './redis.js';
import { productsRouter } from './routes/products.js';
import { waitlistRouter }  from './routes/waitlist.js';
import { launchRouter }    from './routes/launch.js';

const USE_MOCKS   = process.env.USE_MOCKS === 'true';
const app         = express();
const httpServer  = createServer(app);
const PORT        = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// ── Socket.io ──────────────────────────────────────────────────────────────
const io = new SocketIO(httpServer, {
  cors: { origin: CORS_ORIGIN, methods: ['GET', 'POST'] },
});

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start }));
  });
  next();
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/products', productsRouter);
app.use('/api/products/:productId/waitlist', waitlistRouter);
app.use('/api/products/:productId', launchRouter);

// Global admin route (all-product summary + mock tools)
app.get('/api/admin/all-stats', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'unauthorized' });
  // Delegate to launch router handler via db directly
  const { rows: products } = await db.query(`SELECT * FROM products ORDER BY sort_order ASC`);
  const summary = await Promise.all(products.map(async (p) => {
    const [regRes, ordRes] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM registrations WHERE product_id = $1`, [p.id]),
      db.query(`SELECT COUNT(*) FROM orders WHERE product_id = $1`, [p.id]),
    ]);
    const stockRaw  = await redis.get(`flash:stock:${p.id}`);
    const isActive  = (await redis.get(`flash:active:${p.id}`)) === '1';
    const countRaw  = await redis.get(`waitlist:count:${p.id}`);
    return {
      ...p,
      totalRegistered: parseInt(regRes.rows[0].count, 10),
      totalOrders:     parseInt(ordRes.rows[0].count, 10),
      flashStock:      Math.max(0, parseInt(stockRaw ?? String(p.flash_slots), 10)),
      flashActive:     isActive,
      waitlistCount:   parseInt(countRaw ?? '0', 10),
    };
  }));
  res.json(summary);
});

app.get('/api/admin/jobs', async (_req, res) => {
  if (!USE_MOCKS) return res.status(404).json({ error: 'only available in mock mode' });
  const { jobLog } = await import('./mocks/queues.js');
  res.json({ jobs: jobLog.slice().reverse(), total: jobLog.length });
});

app.get('/api/admin/mock-store', async (_req, res) => {
  if (!USE_MOCKS) return res.status(404).json({ error: 'only available in mock mode' });
  const { store } = await import('./mocks/db.js');
  res.json(store);
});

app.get('/health/live',  (_req, res) => res.json({ status: 'ok', mock: USE_MOCKS }));
app.get('/health/ready', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    const pong = await redis.ping();
    if (pong === 'PONG') return res.json({ status: 'ready', mock: USE_MOCKS });
    throw new Error('redis ping failed');
  } catch (err) {
    return res.status(503).json({ status: 'not_ready', reason: err.message });
  }
});

// ── Socket.io connection + viewer tracking ─────────────────────────────────
let liveViewers = 0;
io.on('connection', (socket) => {
  liveViewers++;
  io.emit('viewers:update', { count: liveViewers });
  socket.on('disconnect', () => {
    liveViewers = Math.max(0, liveViewers - 1);
    io.emit('viewers:update', { count: liveViewers });
  });
});

// ── Redis pub/sub → Socket.io (all events carry productId) ─────────────────
async function setupPubSub() {
  await redisSub.subscribe('waitlist:joined', (msg) => {
    const { productId, count } = JSON.parse(msg);
    io.emit('waitlist:count', { productId, count });
  });

  await redisSub.subscribe('flash:stock:update', (msg) => {
    const { productId, remaining } = JSON.parse(msg);
    io.emit('flash:stock', { productId, remaining });
  });

  await redisSub.subscribe('launch:fired', (msg) => {
    const { productId, launchedAt } = JSON.parse(msg);
    io.emit('launch:fired', { productId, launchedAt });
  });

  await redisSub.subscribe('launch:reset', (msg) => {
    const { productId } = JSON.parse(msg);
    io.emit('launch:reset', { productId });
  });

  console.log('[pubsub] Subscribed to Redis channels');
}

// ── Boot ───────────────────────────────────────────────────────────────────
async function start() {
  await connectRedis();
  await setupPubSub();
  httpServer.listen(PORT, () => console.log(`[server] Listening on http://localhost:${PORT}`));
}

async function shutdown(signal) {
  console.log(`[server] ${signal} received — draining...`);
  httpServer.close(async () => {
    await db.end();
    await redis.quit();
    await redisSub.quit();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start().catch((err) => { console.error('[server] Boot failed:', err); process.exit(1); });
