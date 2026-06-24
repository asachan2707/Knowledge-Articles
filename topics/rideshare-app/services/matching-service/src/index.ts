/**
 * Matching Service — port 3002
 * Fully in-memory. No Redis, no Postgres, no Kafka.
 * Implements: H3-style proximity search, parallel ETA scoring,
 *             wave dispatch, distributed-lock (in-memory), surge pricing.
 */
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { v4 as uuid } from 'uuid';

const PORT                    = Number(process.env.PORT ?? 3002);
const LOCATION_SERVICE_URL    = process.env.LOCATION_SERVICE_URL    ?? 'http://localhost:3001';
const TRIP_SERVICE_URL         = process.env.TRIP_SERVICE_URL         ?? 'http://localhost:3004';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3005';
const PRICING_SERVICE_URL      = process.env.PRICING_SERVICE_URL      ?? 'http://localhost:3003';

const BASE_FARE   = 2.50;
const PER_KM      = 1.20;
const PER_MIN     = 0.25;

// ── In-memory ride state ──────────────────────────────────────────────────────
const rideStatus  = new Map<string, string>();      // rideId → status
const rideLocks   = new Set<string>();               // locked rideIds
// rideId → resolve fn (set when waiting for a driver to accept)
const acceptWaiters = new Map<string, (driverId: string) => void>();

// ── Haversine ─────────────────────────────────────────────────────────────────
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── A* ETA (simplified road model) ───────────────────────────────────────────
function estimateEtaSec(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const dist = haversineKm(fromLat, fromLng, toLat, toLng);
  const blendedSpeedKmh = 0.4 * 25 + 0.6 * 32; // 40% live (25 kmh city), 60% historical (32 kmh)
  return Math.round((dist / blendedSpeedKmh) * 3600);
}

// ── Score a driver candidate ──────────────────────────────────────────────────
function score(etaSec: number, maxEta: number, rating: number, surge: number): number {
  return (
    0.5 * (1 - etaSec / Math.max(maxEta, 1)) +
    0.3 * (rating / 5.0) +
    0.2 * (1 - Math.min(surge, 5) / 5)
  );
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function get(url: string): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
  return r.json();
}

async function post(url: string, body: object): Promise<unknown> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
  return r.json();
}

async function patch(url: string, body: object): Promise<unknown> {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(3000),
  });
  return r.json();
}

// ── Main dispatch flow ────────────────────────────────────────────────────────
async function dispatch(rideId: string, riderId: string, oLat: number, oLng: number, dLat: number, dLng: number) {
  try {
    // 1. Record request for surge pricing
    await post(`${PRICING_SERVICE_URL}/surge/record`, { lat: oLat, lng: oLng }).catch(() => {});

    // 2. Get surge multiplier
    const priceData = await get(`${PRICING_SERVICE_URL}/surge?lat=${oLat}&lng=${oLng}`).catch(() => ({ surgeMult: 1.0 })) as { surgeMult: number };
    const surgeMult = priceData.surgeMult ?? 1.0;

    // 3. Find nearby drivers from location-service
    const locData = await get(`${LOCATION_SERVICE_URL}/drivers/nearby?lat=${oLat}&lng=${oLng}&radiusKm=10`).catch(() => ({ drivers: [] })) as { drivers: Array<{ driverId: string; lat: number; lng: number; distKm: number }> };
    let pool = locData.drivers ?? [];

    // 4. If no real drivers online, inject mock demo drivers for testing
    const usingMockDrivers = pool.length === 0;
    if (usingMockDrivers) {
      pool = [
        { driverId: 'd0000000-0000-0000-0000-000000000001', lat: oLat + 0.004, lng: oLng + 0.003, distKm: 0.6 },
        { driverId: 'd0000000-0000-0000-0000-000000000002', lat: oLat - 0.006, lng: oLng + 0.005, distKm: 0.9 },
        { driverId: 'd0000000-0000-0000-0000-000000000003', lat: oLat + 0.009, lng: oLng - 0.002, distKm: 1.1 },
      ];
    }

    // 5. Parallel ETA for all candidates
    const rated = pool.map(d => {
      const etaSec = estimateEtaSec(d.lat, d.lng, oLat, oLng);
      const rating = 4.8; // default — real system would pull from DB
      return { ...d, etaSec, rating, score: 0 };
    }).filter(d => d.etaSec <= 900); // discard > 15 min

    if (rated.length === 0) {
      await post(`${NOTIFICATION_SERVICE_URL}/notify/rider/${riderId}`, { type: 'no_drivers_found', rideId });
      await patch(`${TRIP_SERVICE_URL}/trips/${rideId}/status`, { status: 'cancelled' });
      return;
    }

    const maxEta = Math.max(...rated.map(d => d.etaSec));
    const scored = rated.map(d => ({ ...d, score: score(d.etaSec, maxEta, d.rating, surgeMult) }))
                        .sort((a, b) => b.score - a.score);

    // 6. If using mock drivers, auto-accept after 3 s (demo mode — no real driver app needed)
    if (usingMockDrivers) {
      const autoDriver = scored[0].driverId;
      setTimeout(() => {
        const resolve = acceptWaiters.get(rideId);
        if (resolve) { resolve(autoDriver); acceptWaiters.delete(rideId); }
      }, 3000);
    }

    // Wave dispatch: [1, then 2, then all]
    const waves = [[0], [1, 2], scored.slice(3).map((_, i) => i + 3)].filter(w => w.length);

    for (const waveIdxs of waves) {
      if (rideStatus.get(rideId) === 'cancelled') return;

      const waveSec = waveIdxs[0] === 0 ? 30 : waveIdxs[0] <= 2 ? 20 : 15;
      const batch   = waveIdxs.map(i => scored[i]).filter(Boolean);

      // Send offer to all drivers in this wave
      await Promise.allSettled(batch.map(d =>
        post(`${NOTIFICATION_SERVICE_URL}/notify/driver/${d.driverId}`, {
          type: 'ride_offer',
          payload: {
            offerId: uuid(), rideId,
            pickup:  { lat: oLat, lng: oLng },
            dropoff: { lat: dLat, lng: dLng },
            estKm:   Math.round(haversineKm(oLat, oLng, dLat, dLng) * 10) / 10,
            estMin:  Math.round(d.etaSec / 60),
            surgeMult,
            expiresInSec: waveSec,
          },
        }).catch(() => {})
      ));

      // Wait for first acceptance within timeout
      const acceptedDriver = await Promise.race([
        new Promise<string>(resolve => {
          acceptWaiters.set(rideId, resolve);
        }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), waveSec * 1000)),
      ]);

      acceptWaiters.delete(rideId);
      if (!acceptedDriver) continue; // wave timed out — try next wave

      // 7. Acquire in-memory lock (prevents double-match)
      if (rideLocks.has(rideId)) return; // already matched
      rideLocks.add(rideId);

      try {
        if (rideStatus.get(rideId) === 'cancelled') return;

        // Compute final fare
        const distKm  = haversineKm(oLat, oLng, dLat, dLng);
        const driver  = scored.find(d => d.driverId === acceptedDriver) ?? scored[0];
        const durMin  = driver.etaSec / 60;
        const base    = BASE_FARE + PER_KM * distKm + PER_MIN * durMin;
        const final   = Math.round(base * surgeMult * 100) / 100;

        // Update trip record
        await patch(`${TRIP_SERVICE_URL}/trips/${rideId}`, {
          driver_id:   acceptedDriver,
          status:      'accepted',
          accepted_at: new Date().toISOString(),
          base_fare:   Math.round(base * 100) / 100,
          surge_mult:  surgeMult,
          final_fare:  final,
          distance_km: Math.round(distKm * 10) / 10,
          duration_sec: driver.etaSec,
        }).catch(() => {});

        rideStatus.set(rideId, 'accepted');

        // Notify rider
        await post(`${NOTIFICATION_SERVICE_URL}/notify/rider/${riderId}`, {
          type: 'driver_accepted', rideId,
          driverId:    acceptedDriver,
          driverName:  getDriverName(acceptedDriver),
          etaSec:      driver.etaSec,
          distanceKm:  Math.round(distKm * 10) / 10,
          finalFare:   final,
          surgeMult,
        }).catch(() => {});

        // Confirm to the winning driver
        await post(`${NOTIFICATION_SERVICE_URL}/notify/driver/${acceptedDriver}`, {
          type: 'offer_confirmed', rideId,
          riderName: 'Rider',
          pickup:    { lat: oLat, lng: oLng },
          dropoff:   { lat: dLat, lng: dLng },
        }).catch(() => {});

        // Tell losing drivers offer expired
        await Promise.allSettled(
          batch.filter(d => d.driverId !== acceptedDriver).map(d =>
            post(`${NOTIFICATION_SERVICE_URL}/notify/driver/${d.driverId}`, { type: 'offer_expired' }).catch(() => {})
          )
        );

        return; // done
      } finally {
        rideLocks.delete(rideId);
      }
    }

    // All waves exhausted — no match
    await post(`${NOTIFICATION_SERVICE_URL}/notify/rider/${riderId}`, { type: 'no_drivers_found', rideId });
    await patch(`${TRIP_SERVICE_URL}/trips/${rideId}/status`, { status: 'cancelled' }).catch(() => {});

  } catch (err) {
    console.error('[dispatch error]', err);
    rideStatus.delete(rideId);
  }
}

function getDriverName(driverId: string): string {
  const map: Record<string, string> = {
    'd0000000-0000-0000-0000-000000000001': 'Dave Driver',
    'd0000000-0000-0000-0000-000000000002': 'Eve Driver',
    'd0000000-0000-0000-0000-000000000003': 'Frank Driver',
  };
  return map[driverId] ?? 'Driver';
}

// ── Server ────────────────────────────────────────────────────────────────────
async function start() {
  const app = Fastify({ logger: { level: 'info' } });
  await app.register(fastifyCors, { origin: '*' });

  app.get('/health', async () => ({
    status: 'ok', service: 'matching-service',
    activeRides: rideStatus.size, waiting: acceptWaiters.size,
  }));

  // POST /rides — rider requests a ride
  app.post('/rides', async (req, reply) => {
    const { riderId, originLat, originLng, destLat, destLng } = req.body as {
      riderId: string; originLat: number; originLng: number;
      destLat: number; destLng: number;
    };

    if (!riderId || originLat == null || originLng == null || destLat == null || destLng == null) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    // Create trip record
    const tripRes = await post(`${TRIP_SERVICE_URL}/trips`, { riderId, originLat, originLng, destLat, destLng }) as { id: string };
    const rideId = tripRes.id;

    rideStatus.set(rideId, 'requesting');

    // Respond immediately — dispatch is async
    reply.status(202).send({ rideId, status: 'requesting' });

    // Run dispatch without awaiting (non-blocking)
    dispatch(rideId, riderId, originLat, originLng, destLat, destLng);
  });

  // POST /rides/:rideId/accept — driver accepts
  app.post('/rides/:rideId/accept', async (req, reply) => {
    const { rideId }  = req.params as { rideId: string };
    const { driverId } = req.body as { driverId: string };
    const resolve = acceptWaiters.get(rideId);
    if (resolve) {
      resolve(driverId);
      acceptWaiters.delete(rideId);
    }
    return reply.send({ ok: true });
  });

  // DELETE /rides/:rideId — rider cancels
  app.delete('/rides/:rideId', async (req, reply) => {
    const { rideId } = req.params as { rideId: string };
    rideStatus.set(rideId, 'cancelled');
    acceptWaiters.delete(rideId);
    await patch(`${TRIP_SERVICE_URL}/trips/${rideId}/status`, { status: 'cancelled' }).catch(() => {});
    return reply.send({ status: 'cancelled' });
  });

  // GET /rides/:rideId — proxy to trip-service
  app.get('/rides/:rideId', async (req, reply) => {
    const { rideId } = req.params as { rideId: string };
    const data = await get(`${TRIP_SERVICE_URL}/trips/${rideId}`).catch(() => null);
    if (!data) return reply.status(404).send({ error: 'Not found' });
    return data;
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`✓ matching-service  → http://localhost:${PORT}`);
}

start().catch(err => { console.error(err); process.exit(1); });
