/**
 * Location Service — port 3001
 * In-memory geo store replaces Redis GEOADD.
 * WebSocket: drivers stream GPS here every 4 s.
 * REST:      GET /drivers/nearby  (used by matching-service)
 */
import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import type { SocketStream } from '@fastify/websocket';
import fastifyCors from '@fastify/cors';

const PORT = Number(process.env.PORT ?? 3001);

interface DriverRecord {
  driverId: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  updatedAt: number;
}

// ── In-memory driver location store ──────────────────────────────────────────
const drivers = new Map<string, DriverRecord>();

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
    Math.cos((bLat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function start() {
  const app = Fastify({ logger: { level: 'info' } });
  await app.register(fastifyCors, { origin: '*' });
  await app.register(fastifyWebSocket);

  // ── Health ────────────────────────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok', service: 'location-service', onlineDrivers: drivers.size,
  }));

  // ── GET /drivers/nearby ───────────────────────────────────────────────────
  app.get('/drivers/nearby', async (req) => {
    const { lat, lng, radiusKm = '5' } = req.query as Record<string, string>;
    if (!lat || !lng) return { drivers: [] };

    const rLat = Number(lat);
    const rLng = Number(lng);
    const radius = Number(radiusKm);
    const now = Date.now();

    const nearby = Array.from(drivers.values())
      .filter(d => (now - d.updatedAt) < 60_000) // only drivers active in last 60 s
      .map(d => ({ ...d, distKm: haversineKm(rLat, rLng, d.lat, d.lng) }))
      .filter(d => d.distKm <= radius)
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, 20);

    return { drivers: nearby };
  });

  // ── GET /drivers/:driverId ────────────────────────────────────────────────
  app.get('/drivers/:driverId', async (req, reply) => {
    const { driverId } = req.params as { driverId: string };
    const d = drivers.get(driverId);
    if (!d) return reply.status(404).send({ error: 'Driver not found or offline' });
    return d;
  });

  // ── WebSocket: driver GPS stream ──────────────────────────────────────────
  app.get('/ws/driver/:driverId', { websocket: true }, (conn: SocketStream, req) => {
    const { driverId } = req.params as { driverId: string };
    const socket = conn.socket;
    app.log.info(`Driver ${driverId} connected`);

    // Heartbeat
    let alive = true;
    const hb = setInterval(() => {
      if (!alive) { socket.terminate(); clearInterval(hb); return; }
      alive = false;
      socket.ping();
    }, 30_000);
    socket.on('pong', () => { alive = true; });

    socket.on('message', (raw) => {
      let msg: { type: string; payload?: Record<string, number> };
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === 'go_online') {
        socket.send(JSON.stringify({ type: 'online_ack' }));
      }

      if (msg.type === 'location_update' && msg.payload) {
        const { lat, lng, heading = 0, speedKmh = 0 } = msg.payload;
        drivers.set(driverId, { driverId, lat, lng, heading, speedKmh, updatedAt: Date.now() });
      }

      if (msg.type === 'go_offline') {
        drivers.delete(driverId);
        socket.send(JSON.stringify({ type: 'offline_ack' }));
      }
    });

    socket.on('close', () => {
      app.log.info(`Driver ${driverId} disconnected`);
      clearInterval(hb);
      drivers.delete(driverId);
    });
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`✓ location-service  → http://localhost:${PORT}`);
}

start().catch(err => { console.error(err); process.exit(1); });
