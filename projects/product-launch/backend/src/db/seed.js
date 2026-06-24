import { db } from './pool.js';

async function seed() {
  console.log('[seed] Seeding launch config...');
  await db.query(`
    UPDATE launch_config SET
      product_name = 'NovaSpark Pro',
      tagline      = 'The fastest way to ship production-grade apps.',
      launch_at    = NOW() + INTERVAL '10 minutes',
      is_launched  = false,
      hero_image   = 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1600&h=900&fit=crop&auto=format&q=80'
    WHERE id = 1
  `);

  // Seed Redis flash stock counter — 100 early-access slots
  console.log('[seed] Seeding Redis flash stock...');
  const { createClient } = await import('redis');
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  await redis.set('flash:stock', '100');
  await redis.set('flash:active', '0');  // starts inactive; admin activates on launch
  await redis.quit();

  console.log('[seed] Done.');
  await db.end();
}

seed().catch((err) => { console.error(err); process.exit(1); });
