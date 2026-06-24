import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../db/pool.js';
import { redis } from '../redis.js';
import { waitlistConfirmQueue } from '../queues/emailQueue.js';

export const waitlistRouter = Router({ mergeParams: true }); // receives :productId from parent

const joinLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit', message: 'Too many attempts. Try again in a minute.' },
});

// POST /api/products/:productId/waitlist/join
waitlistRouter.post('/join', joinLimiter, async (req, res) => {
  const { productId } = req.params;
  const { email, name, source = 'organic' } = req.body;

  if (!email || !name) return res.status(400).json({ error: 'email and name are required' });

  const emailLower = email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  // Verify product exists
  const { rows: [product] } = await db.query(
    `SELECT id, product_name FROM products WHERE id = $1`, [productId]
  );
  if (!product) return res.status(404).json({ error: 'product_not_found' });

  try {
    const { rows } = await db.query(
      `INSERT INTO registrations (product_id, email, name, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, email) DO NOTHING
       RETURNING id, email, name, created_at`,
      [productId, emailLower, name.trim(), source]
    );

    if (rows.length === 0) {
      const { rows: existing } = await db.query(
        'SELECT id FROM registrations WHERE product_id = $1 AND email = $2',
        [productId, emailLower]
      );
      return res.json({ status: 'already_registered', id: existing[0]?.id });
    }

    const registration = rows[0];
    const { rows: [{ count }] } = await db.query(
      'SELECT COUNT(*) FROM registrations WHERE product_id = $1', [productId]
    );
    const position = parseInt(count, 10);

    await redis.set(`waitlist:count:${productId}`, String(position));
    await redis.publish('waitlist:joined', JSON.stringify({ productId, count: position }));

    await waitlistConfirmQueue.add('confirm', {
      name:        registration.name,
      email:       registration.email,
      position,
      productName: product.product_name,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });

    return res.status(201).json({ status: 'registered', id: registration.id, position });
  } catch (err) {
    console.error('[waitlist/join]', err.message);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/products/:productId/waitlist/count
waitlistRouter.get('/count', async (req, res) => {
  const { productId } = req.params;
  const cached = await redis.get(`waitlist:count:${productId}`);
  if (cached !== null) return res.json({ count: parseInt(cached, 10) });
  const { rows: [{ count }] } = await db.query(
    'SELECT COUNT(*) FROM registrations WHERE product_id = $1', [productId]
  );
  const n = parseInt(count, 10);
  await redis.set(`waitlist:count:${productId}`, String(n));
  return res.json({ count: n });
});
