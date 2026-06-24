/**
 * Pricing Service — port 3003
 * In-memory surge map — no Kafka, no Redis.
 * Surge is computed from request frequency per location bucket.
 */
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';

const PORT = Number(process.env.PORT ?? 3003);

// Simple lat/lng bucket key (1 decimal ≈ 11 km grid)
function bucket(lat: number, lng: number): string {
  return `${lat.toFixed(1)},${lng.toFixed(1)}`;
}

// request count per bucket in last window
const requestCounts = new Map<string, number>();
const surgeMap      = new Map<string, number>();

// Decay surge every 30 s
setInterval(() => {
  for (const [key, val] of surgeMap.entries()) {
    const next = 1 + (val - 1) * 0.8; // decay toward 1.0
    if (next <= 1.02) surgeMap.delete(key);
    else surgeMap.set(key, Math.round(next * 100) / 100);
  }
  requestCounts.clear();
}, 30_000);

function recordRequest(lat: number, lng: number) {
  const key = bucket(lat, lng);
  const count = (requestCounts.get(key) ?? 0) + 1;
  requestCounts.set(key, count);

  // Simple surge: >3 requests in window → surge kicks in
  const raw    = 1.0 + Math.max(0, count - 2) * 0.3;
  const clamped = Math.min(Math.max(raw, 1.0), 5.0);
  const prev   = surgeMap.get(key) ?? 1.0;
  const smooth = 0.4 * clamped + 0.6 * prev;
  surgeMap.set(key, Math.round(smooth * 100) / 100);
}

async function start() {
  const app = Fastify({ logger: { level: 'info' } });
  await app.register(fastifyCors, { origin: '*' });

  app.get('/health', async () => ({ status: 'ok', service: 'pricing-service', activeCells: surgeMap.size }));

  // GET /surge?lat=&lng=
  app.get('/surge', async (req) => {
    const { lat, lng } = req.query as { lat: string; lng: string };
    if (!lat || !lng) return { surgeMult: 1.0 };
    const key = bucket(Number(lat), Number(lng));
    return { surgeMult: surgeMap.get(key) ?? 1.0, cell: key };
  });

  // GET /surge/all
  app.get('/surge/all', async () => {
    return Object.fromEntries(surgeMap);
  });

  // POST /surge/record — called by matching-service when a ride is requested
  app.post('/surge/record', async (req) => {
    const { lat, lng } = req.body as { lat: number; lng: number };
    if (lat && lng) recordRequest(lat, lng);
    const key = bucket(lat, lng);
    return { surgeMult: surgeMap.get(key) ?? 1.0 };
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`✓ pricing-service   → http://localhost:${PORT}`);
}

start().catch(err => { console.error(err); process.exit(1); });
