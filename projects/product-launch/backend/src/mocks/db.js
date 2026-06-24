/**
 * In-memory mock — multi-product version.
 * Pre-seeded with 3 products in different states so every UI path is visible
 * without needing real PostgreSQL.
 */
import { randomUUID } from 'crypto';

const P1 = 'prod-1111-1111-1111-111111111111';
const P2 = 'prod-2222-2222-2222-222222222222';
const P3 = 'prod-3333-3333-3333-333333333333';

export const store = {
  products: [
    {
      id:           P1,
      product_name: 'NovaSpark Pro',
      tagline:      'The fastest way to ship production-grade apps.',
      launch_at:    new Date(Date.now() + 10 * 60_000).toISOString(),
      is_launched:  false,
      hero_image:   'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1600&h=900&fit=crop&auto=format&q=80',
      flash_slots:  100,
      sort_order:   0,
      created_at:   new Date(Date.now() - 5 * 60_000).toISOString(),
    },
    {
      id:           P2,
      product_name: 'FlowCanvas 2.0',
      tagline:      'Visual workflows that actually ship to production.',
      launch_at:    new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString(),
      is_launched:  false,
      hero_image:   'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=1600&h=900&fit=crop&auto=format&q=80',
      flash_slots:  50,
      sort_order:   1,
      created_at:   new Date(Date.now() - 60 * 60_000).toISOString(),
    },
    {
      id:           P3,
      product_name: 'DataPulse Analytics',
      tagline:      'Real-time dashboards, zero infrastructure headaches.',
      launch_at:    new Date(Date.now() - 30 * 60_000).toISOString(),
      is_launched:  true,
      hero_image:   'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1600&h=900&fit=crop&auto=format&q=80',
      flash_slots:  200,
      sort_order:   2,
      created_at:   new Date(Date.now() - 120 * 60_000).toISOString(),
    },
  ],

  // Per-product registrations
  registrations: [
    { id: randomUUID(), product_id: P1, email: 'alice@example.com', name: 'Alice Chen',   source: 'organic',  created_at: new Date(Date.now() - 3 * 60_000).toISOString(), notified_at: null },
    { id: randomUUID(), product_id: P1, email: 'bob@example.com',   name: 'Bob Ramirez', source: 'referral', created_at: new Date(Date.now() - 2 * 60_000).toISOString(), notified_at: null },
    { id: randomUUID(), product_id: P2, email: 'carol@example.com', name: 'Carol Singh', source: 'organic',  created_at: new Date(Date.now() - 4 * 60_000).toISOString(), notified_at: null },
    { id: randomUUID(), product_id: P3, email: 'dave@example.com',  name: 'Dave Kim',    source: 'ad',       created_at: new Date(Date.now() - 5 * 60_000).toISOString(), notified_at: null },
    { id: randomUUID(), product_id: P3, email: 'eve@example.com',   name: 'Eve Torres',  source: 'organic',  created_at: new Date(Date.now() - 6 * 60_000).toISOString(), notified_at: null },
  ],

  orders: [],
};

// ── Query router ──────────────────────────────────────────────────────────
export const db = {
  async query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (s === 'select 1') return { rows: [{ '?column?': 1 }] };

    // ── products ──────────────────────────────────────────────────────────
    if (s.startsWith('select') && s.includes('from products') && s.includes('where id')) {
      const id = params[0];
      const row = store.products.find(p => p.id === id);
      return { rows: row ? [{ ...row }] : [] };
    }

    if (s.startsWith('select') && s.includes('from products') && !s.includes('where')) {
      return { rows: store.products.map(p => ({ ...p })).sort((a, b) => a.sort_order - b.sort_order) };
    }

    if (s.startsWith('insert into products')) {
      const [product_name, tagline, launch_at, hero_image, flash_slots, sort_order] = params;
      const row = {
        id: randomUUID(), product_name, tagline,
        launch_at: launch_at || null,
        is_launched: false,
        hero_image: hero_image || '',
        flash_slots: flash_slots || 100,
        sort_order: sort_order || store.products.length,
        created_at: new Date().toISOString(),
      };
      store.products.push(row);
      return { rows: [row] };
    }

    if (s.startsWith('update products set is_launched = true')) {
      const id = params[0];
      const p = store.products.find(p => p.id === id);
      if (p) { p.is_launched = true; p.launch_at = new Date().toISOString(); }
      return { rows: [] };
    }

    if (s.startsWith('update products set is_launched = false')) {
      const id = params[0];
      const p = store.products.find(p => p.id === id);
      if (p) { p.is_launched = false; p.launch_at = new Date(Date.now() + 5 * 60_000).toISOString(); }
      return { rows: [] };
    }

    if (s.startsWith('update products set')) {
      const id = params[params.length - 1];
      const p = store.products.find(p => p.id === id);
      if (p) {
        if (s.includes('launch_at')) p.launch_at = params[0];
        if (s.includes('flash_slots')) p.flash_slots = parseInt(params[0], 10);
      }
      return { rows: [] };
    }

    if (s.startsWith('delete from products')) {
      const id = params[0];
      store.products = store.products.filter(p => p.id !== id);
      store.registrations = store.registrations.filter(r => r.product_id !== id);
      store.orders = store.orders.filter(o => o.product_id !== id);
      return { rows: [] };
    }

    // ── registrations ─────────────────────────────────────────────────────
    if (s.startsWith('insert into registrations')) {
      const [product_id, email, name, source] = params;
      const exists = store.registrations.find(r => r.product_id === product_id && r.email === email);
      if (exists) return { rows: [] };
      const row = { id: randomUUID(), product_id, email, name, source: source ?? 'organic', created_at: new Date().toISOString(), notified_at: null };
      store.registrations.push(row);
      return { rows: [{ id: row.id, email: row.email, name: row.name, created_at: row.created_at }] };
    }

    if (s.startsWith('select id from registrations where product_id')) {
      const [product_id, email] = params;
      const row = store.registrations.find(r => r.product_id === product_id && r.email === email);
      return { rows: row ? [{ id: row.id }] : [] };
    }

    if (s.includes('count(*) from registrations') && s.includes('where product_id')) {
      const [product_id] = params;
      const n = store.registrations.filter(r => r.product_id === product_id).length;
      return { rows: [{ count: String(n) }] };
    }

    if (s.startsWith('select name, email from registrations')) {
      const [product_id] = params;
      const rows = store.registrations.filter(r => r.product_id === product_id).map(r => ({ name: r.name, email: r.email }));
      return { rows };
    }

    if (s.startsWith('select id, email, name') && s.includes('from registrations')) {
      const product_id = params[0];
      const limit  = params[1] ? parseInt(params[1], 10) : 9999;
      const offset = params[2] ? parseInt(params[2], 10) : 0;
      const sorted = store.registrations
        .filter(r => r.product_id === product_id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { rows: sorted.slice(offset, offset + limit).map(r => ({ id: r.id, email: r.email, name: r.name, created_at: r.created_at, source: r.source })) };
    }

    // ── orders ────────────────────────────────────────────────────────────
    if (s.startsWith('insert into orders')) {
      const [product_id, email, reservationId] = params;
      const row = { id: randomUUID(), product_id, email, reservation_id: reservationId, status: 'pending', created_at: new Date().toISOString() };
      store.orders.push(row);
      return { rows: [row] };
    }

    if (s.includes('count(*)') && s.includes('from orders') && s.includes('where product_id')) {
      const [product_id] = params;
      const n = store.orders.filter(o => o.product_id === product_id).length;
      return { rows: [{ count: String(n) }] };
    }

    if (s.startsWith('select status, count') && s.includes('from orders') && s.includes('where product_id')) {
      const [product_id] = params;
      const grouped = {};
      store.orders.filter(o => o.product_id === product_id).forEach(o => { grouped[o.status] = (grouped[o.status] || 0) + 1; });
      return { rows: Object.entries(grouped).map(([status, count]) => ({ status, count: String(count) })) };
    }

    if (s.startsWith('delete from orders where product_id')) {
      const [product_id] = params;
      store.orders = store.orders.filter(o => o.product_id !== product_id);
      return { rows: [] };
    }

    if (s.startsWith('update orders set status')) {
      const reservationId = params[params.length - 1];
      const order = store.orders.find(o => o.reservation_id === reservationId);
      if (order) order.status = params[0];
      return { rows: [] };
    }

    console.warn('[mock-db] Unhandled query:', s.slice(0, 140));
    return { rows: [] };
  },

  async end() {},
  on()      {},
};
