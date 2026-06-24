/**
 * Public products list + per-product detail.
 * GET /api/products           — list all (for the homepage grid)
 * GET /api/products/:id       — single product status with live stock
 */
import { Router } from 'express';
import { db } from '../db/pool.js';
import { redis } from '../redis.js';

export const productsRouter = Router();

// GET /api/products
productsRouter.get('/', async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, product_name, tagline, launch_at, is_launched, hero_image, flash_slots, sort_order
       FROM products ORDER BY sort_order ASC, created_at DESC`
    );

    // Attach live Redis stock to each product
    const withStock = await Promise.all(rows.map(async (p) => {
      const stockRaw  = await redis.get(`flash:stock:${p.id}`);
      const isActive  = (await redis.get(`flash:active:${p.id}`)) === '1';
      const countRaw  = await redis.get(`waitlist:count:${p.id}`);
      return {
        ...p,
        flash_stock:   Math.max(0, parseInt(stockRaw  ?? String(p.flash_slots), 10)),
        flash_active:  isActive,
        waitlist_count: parseInt(countRaw ?? '0', 10),
      };
    }));

    res.json(withStock);
  } catch (err) {
    console.error('[products/list]', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});

// GET /api/products/:id
productsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT id, product_name, tagline, launch_at, is_launched, hero_image, flash_slots
       FROM products WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });

    const stockRaw  = await redis.get(`flash:stock:${id}`);
    const isActive  = (await redis.get(`flash:active:${id}`)) === '1';
    const countRaw  = await redis.get(`waitlist:count:${id}`);

    res.json({
      ...rows[0],
      flash_stock:    Math.max(0, parseInt(stockRaw  ?? String(rows[0].flash_slots), 10)),
      flash_active:   isActive,
      waitlist_count: parseInt(countRaw ?? '0', 10),
    });
  } catch (err) {
    console.error('[products/get]', err.message);
    res.status(500).json({ error: 'internal_error' });
  }
});
