import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/pool.js';
import { redis } from '../redis.js';
import { orderConfirmQueue, launchNotifyQueue } from '../queues/emailQueue.js';

export const launchRouter = Router({ mergeParams: true });

function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'unauthorized' });
  next();
}

const buyLimiter = rateLimit({
  windowMs: 1000, max: 3,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'waiting_room', message: 'High demand — please retry in a moment.', retryAfter: 1 },
});

// ── POST /api/products/:productId/buy ─────────────────────────────────────
launchRouter.post('/buy', buyLimiter, async (req, res) => {
  const { productId } = req.params;
  const { email, name } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'email and name are required' });

  const isActive = await redis.get(`flash:active:${productId}`);
  if (isActive !== '1') return res.status(400).json({ error: 'sale_not_active', message: 'Sale has not started yet.' });

  const remaining = await redis.decr(`flash:stock:${productId}`);
  if (remaining < 0) {
    await redis.incr(`flash:stock:${productId}`);
    return res.status(409).json({ error: 'sold_out', message: 'All slots are gone. Sorry!' });
  }

  const reservationId = `res_${productId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  await db.query(
    `INSERT INTO orders (product_id, email, reservation_id, status) VALUES ($1, $2, $3, 'pending')`,
    [productId, email.toLowerCase(), reservationId]
  );

  await redis.publish('flash:stock:update', JSON.stringify({ productId, remaining }));

  await orderConfirmQueue.add('confirm-order', {
    name, email: email.toLowerCase(), reservationId, productId,
  }, { attempts: 3, backoff: { type: 'exponential', delay: 3000 } });

  return res.status(202).json({ status: 'reserved', reservationId, message: 'Your slot is reserved!' });
});

// ── POST /api/admin/products/:productId/launch ────────────────────────────
launchRouter.post('/admin-launch', requireAdmin, async (req, res) => {
  const { productId } = req.params;
  const { rows: [product] } = await db.query(`SELECT * FROM products WHERE id = $1`, [productId]);
  if (!product) return res.status(404).json({ error: 'not_found' });

  await db.query(`UPDATE products SET is_launched = true, launch_at = NOW() WHERE id = $1`, [productId]);
  await redis.set(`flash:active:${productId}`, '1');
  await redis.publish('launch:fired', JSON.stringify({ productId, launchedAt: new Date().toISOString() }));

  const { rows: regs } = await db.query('SELECT name, email FROM registrations WHERE product_id = $1', [productId]);
  let queued = 0;
  for (const reg of regs) {
    await launchNotifyQueue.add('notify', {
      name: reg.name, email: reg.email, productName: product.product_name,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, delay: queued * 10 });
    queued++;
  }

  console.log(`[admin] ${product.product_name} launched — ${queued} emails queued`);
  return res.json({ status: 'launched', emailsQueued: queued });
});

// ── POST /api/admin/products/:productId/reset ─────────────────────────────
launchRouter.post('/admin-reset', requireAdmin, async (req, res) => {
  const { productId } = req.params;
  const { rows: [product] } = await db.query(`SELECT flash_slots FROM products WHERE id = $1`, [productId]);
  if (!product) return res.status(404).json({ error: 'not_found' });

  await db.query(`UPDATE products SET is_launched = false, launch_at = NOW() + INTERVAL '5 minutes' WHERE id = $1`, [productId]);
  await redis.set(`flash:stock:${productId}`,  String(product.flash_slots));
  await redis.set(`flash:active:${productId}`, '0');
  await db.query(`DELETE FROM orders WHERE product_id = $1`, [productId]);
  await redis.publish('launch:reset', JSON.stringify({ productId, resetAt: new Date().toISOString() }));
  return res.json({ status: 'reset' });
});

// ── GET /api/admin/products/:productId/stats ──────────────────────────────
launchRouter.get('/admin-stats', requireAdmin, async (req, res) => {
  const { productId } = req.params;
  const [regRes, ordRes, prodRes] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM registrations WHERE product_id = $1`, [productId]),
    db.query(`SELECT status, COUNT(*) FROM orders WHERE product_id = $1 GROUP BY status`, [productId]),
    db.query(`SELECT * FROM products WHERE id = $1`, [productId]),
  ]);
  if (!prodRes.rows[0]) return res.status(404).json({ error: 'not_found' });
  const stockRaw = await redis.get(`flash:stock:${productId}`);
  return res.json({
    product:         prodRes.rows[0],
    totalRegistered: parseInt(regRes.rows[0].count, 10),
    orders:          Object.fromEntries(ordRes.rows.map(r => [r.status, parseInt(r.count, 10)])),
    flashStock:      Math.max(0, parseInt(stockRaw ?? String(prodRes.rows[0].flash_slots), 10)),
  });
});

// ── GET /api/admin/products/:productId/registrations ──────────────────────
launchRouter.get('/admin-registrations', requireAdmin, async (req, res) => {
  const { productId } = req.params;
  const limit  = Math.min(parseInt(req.query.limit  ?? '50', 10), 200);
  const offset = parseInt(req.query.offset ?? '0', 10);
  const { rows } = await db.query(
    `SELECT id, email, name, created_at, source FROM registrations WHERE product_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [productId, limit, offset]
  );
  const { rows: [{ count }] } = await db.query(
    `SELECT COUNT(*) FROM registrations WHERE product_id = $1`, [productId]
  );
  return res.json({ data: rows, total: parseInt(count, 10), limit, offset });
});

// ── GET /api/admin/all-stats — global overview ────────────────────────────
launchRouter.get('/admin-all-stats', requireAdmin, async (req, res) => {
  const { rows: products } = await db.query(`SELECT * FROM products ORDER BY sort_order ASC`);
  const summary = await Promise.all(products.map(async (p) => {
    const [regRes, ordRes] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM registrations WHERE product_id = $1`, [p.id]),
      db.query(`SELECT COUNT(*) FROM orders WHERE product_id = $1 AND status = 'completed'`, [p.id]),
    ]);
    const stockRaw = await redis.get(`flash:stock:${p.id}`);
    return {
      ...p,
      totalRegistered: parseInt(regRes.rows[0].count, 10),
      completedOrders: parseInt(ordRes.rows[0].count, 10),
      flashStock:      Math.max(0, parseInt(stockRaw ?? String(p.flash_slots), 10)),
    };
  }));
  return res.json(summary);
});
