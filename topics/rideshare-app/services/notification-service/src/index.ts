/**
 * Notification Service — port 3005
 * WebSocket hub. No Kafka, no Redis.
 * Internal REST endpoints used by matching-service to push events.
 */
import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import type { SocketStream } from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import type { WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 3005);

const riderSockets  = new Map<string, WebSocket>();
const driverSockets = new Map<string, WebSocket>();

// pending queue for users not yet connected
const pendingRider  = new Map<string, object[]>();
const pendingDriver = new Map<string, object[]>();

function push(map: Map<string, WebSocket>, id: string, payload: object): boolean {
  const ws = map.get(id);
  if (!ws || ws.readyState !== 1) return false;
  ws.send(JSON.stringify(payload));
  return true;
}

function heartbeat(socket: WebSocket, onDead: () => void) {
  let alive = true;
  const iv = setInterval(() => {
    if (!alive) { socket.terminate(); onDead(); clearInterval(iv); return; }
    alive = false;
    socket.ping();
  }, 30_000);
  socket.on('pong', () => { alive = true; });
  socket.on('close', () => clearInterval(iv));
}

async function start() {
  const app = Fastify({ logger: { level: 'info' } });
  await app.register(fastifyCors, { origin: '*' });
  await app.register(fastifyWebSocket);

  app.get('/health', async () => ({
    status: 'ok', service: 'notification-service',
    riders: riderSockets.size, drivers: driverSockets.size,
  }));

  // ── WS rider ──────────────────────────────────────────────────────────────
  app.get('/ws/rider/:riderId', { websocket: true }, (conn: SocketStream, req) => {
    const { riderId } = req.params as { riderId: string };
    const socket = conn.socket;
    riderSockets.set(riderId, socket);
    app.log.info(`Rider ${riderId} connected`);

    // Flush any queued events
    const queue = pendingRider.get(riderId) ?? [];
    for (const evt of queue) socket.send(JSON.stringify(evt));
    pendingRider.delete(riderId);

    heartbeat(socket, () => riderSockets.delete(riderId));
    socket.on('message', raw => {
      try { const m = JSON.parse(raw.toString()); if (m.type === 'ping') socket.send(JSON.stringify({ type: 'pong' })); } catch { /**/ }
    });
    socket.on('close', () => riderSockets.delete(riderId));
  });

  // ── WS driver ─────────────────────────────────────────────────────────────
  app.get('/ws/driver/:driverId', { websocket: true }, (conn: SocketStream, req) => {
    const { driverId } = req.params as { driverId: string };
    const socket = conn.socket;
    driverSockets.set(driverId, socket);
    app.log.info(`Driver ${driverId} notification connected`);

    const queue = pendingDriver.get(driverId) ?? [];
    for (const evt of queue) socket.send(JSON.stringify(evt));
    pendingDriver.delete(driverId);

    heartbeat(socket, () => driverSockets.delete(driverId));
    socket.on('message', raw => {
      try { const m = JSON.parse(raw.toString()); if (m.type === 'ping') socket.send(JSON.stringify({ type: 'pong' })); } catch { /**/ }
    });
    socket.on('close', () => driverSockets.delete(driverId));
  });

  // ── REST: notify rider ────────────────────────────────────────────────────
  app.post('/notify/rider/:riderId', async (req, reply) => {
    const { riderId } = req.params as { riderId: string };
    const event = req.body as object;
    const ok = push(riderSockets, riderId, event);
    if (!ok) {
      const q = pendingRider.get(riderId) ?? [];
      q.push(event);
      pendingRider.set(riderId, q);
    }
    return reply.send({ delivered: ok, queued: !ok });
  });

  // ── REST: notify driver ───────────────────────────────────────────────────
  app.post('/notify/driver/:driverId', async (req, reply) => {
    const { driverId } = req.params as { driverId: string };
    const event = req.body as object;
    const ok = push(driverSockets, driverId, event);
    if (!ok) {
      const q = pendingDriver.get(driverId) ?? [];
      q.push(event);
      pendingDriver.set(driverId, q);
    }
    return reply.send({ delivered: ok, queued: !ok });
  });

  // ── REST: broadcast driver location to rider ──────────────────────────────
  app.post('/broadcast/location', async (req, reply) => {
    const body = req.body as { riderId: string; driverId: string; lat: number; lng: number; etaSec: number; bearing?: number };
    push(riderSockets, body.riderId, { type: 'driver_location', ...body });
    return reply.send({ ok: true });
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`✓ notification-svc  → http://localhost:${PORT}`);
}

start().catch(err => { console.error(err); process.exit(1); });
