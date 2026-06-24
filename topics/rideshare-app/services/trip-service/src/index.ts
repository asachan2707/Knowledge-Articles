/**
 * Trip Service — port 3004
 * Pure in-memory store (Map). No Postgres, no Redis needed.
 * Full state machine: requesting → accepted → driver_arrived → in_progress → completed | cancelled
 */
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { v4 as uuid } from 'uuid';

const PORT = Number(process.env.PORT ?? 3004);

type TripStatus = 'requesting'|'accepted'|'driver_arrived'|'in_progress'|'completed'|'cancelled';

interface Trip {
  id: string;
  rider_id: string;
  driver_id?: string;
  driver_name?: string;
  driver_rating?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  license_plate?: string;
  status: TripStatus;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  base_fare?: number;
  surge_mult: number;
  final_fare?: number;
  distance_km?: number;
  duration_sec?: number;
  created_at: string;
  accepted_at?: string;
  arrived_at?: string;
  started_at?: string;
  ended_at?: string;
}

const TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  requesting:     ['accepted', 'cancelled'],
  accepted:       ['driver_arrived', 'cancelled'],
  driver_arrived: ['in_progress', 'cancelled'],
  in_progress:    ['completed', 'cancelled'],
  completed:      [],
  cancelled:      [],
};

// Seed driver profiles (mirrors DB seed)
const DRIVER_PROFILES: Record<string, { name: string; rating: number; vehicle_make: string; vehicle_model: string; license_plate: string }> = {
  'd0000000-0000-0000-0000-000000000001': { name: 'Dave Driver',  rating: 4.85, vehicle_make: 'Toyota', vehicle_model: 'Prius 2022',    license_plate: 'DAVE001' },
  'd0000000-0000-0000-0000-000000000002': { name: 'Eve Driver',   rating: 4.92, vehicle_make: 'Honda',  vehicle_model: 'Accord 2021',   license_plate: 'EVE0002' },
  'd0000000-0000-0000-0000-000000000003': { name: 'Frank Driver', rating: 4.75, vehicle_make: 'Ford',   vehicle_model: 'Explorer 2023', license_plate: 'FRANK03' },
};

const trips = new Map<string, Trip>();

async function start() {
  const app = Fastify({ logger: { level: 'info' } });
  await app.register(fastifyCors, { origin: '*' });

  app.get('/health', async () => ({ status: 'ok', service: 'trip-service', trips: trips.size }));

  // ── POST /trips — create ──────────────────────────────────────────────────
  app.post('/trips', async (req, reply) => {
    const { riderId, originLat, originLng, destLat, destLng } = req.body as {
      riderId: string; originLat: number; originLng: number; destLat: number; destLng: number;
    };
    const trip: Trip = {
      id: uuid(), rider_id: riderId, status: 'requesting',
      origin_lat: originLat, origin_lng: originLng,
      dest_lat: destLat, dest_lng: destLng,
      surge_mult: 1.0, created_at: new Date().toISOString(),
    };
    trips.set(trip.id, trip);
    return reply.status(201).send(trip);
  });

  // ── GET /trips/:id ────────────────────────────────────────────────────────
  app.get('/trips/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const trip = trips.get(id);
    if (!trip) return reply.status(404).send({ error: 'Not found' });
    return trip;
  });

  // ── GET /trips?riderId= ───────────────────────────────────────────────────
  app.get('/trips', async (req) => {
    const { riderId, driverId, status, limit = '20' } = req.query as Record<string, string>;
    let list = Array.from(trips.values());
    if (riderId)  list = list.filter(t => t.rider_id === riderId);
    if (driverId) list = list.filter(t => t.driver_id === driverId);
    if (status)   list = list.filter(t => t.status === status);
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { trips: list.slice(0, Number(limit)) };
  });

  // ── PATCH /trips/:id — update fields (driver, fares) ─────────────────────
  app.patch('/trips/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const trip = trips.get(id);
    if (!trip) return reply.status(404).send({ error: 'Not found' });
    const updates = req.body as Partial<Trip>;
    // Attach driver profile info automatically
    if (updates.driver_id && DRIVER_PROFILES[updates.driver_id]) {
      const p = DRIVER_PROFILES[updates.driver_id];
      Object.assign(updates, {
        driver_name:    p.name,
        driver_rating:  p.rating,
        vehicle_make:   p.vehicle_make,
        vehicle_model:  p.vehicle_model,
        license_plate:  p.license_plate,
      });
    }
    Object.assign(trip, updates);
    return trip;
  });

  // ── PATCH /trips/:id/status — state machine ───────────────────────────────
  app.patch('/trips/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const trip = trips.get(id);
    if (!trip) return reply.status(404).send({ error: 'Not found' });

    const { status: next, driverId } = req.body as { status: TripStatus; driverId?: string };
    if (!TRANSITIONS[trip.status].includes(next)) {
      return reply.status(409).send({
        error: `Invalid transition: ${trip.status} → ${next}`,
        allowed: TRANSITIONS[trip.status],
      });
    }

    trip.status = next;
    const now = new Date().toISOString();
    if (next === 'accepted')       { trip.accepted_at = now; if (driverId) { trip.driver_id = driverId; const p = DRIVER_PROFILES[driverId]; if (p) { trip.driver_name = p.name; trip.driver_rating = p.rating; trip.vehicle_make = p.vehicle_make; trip.vehicle_model = p.vehicle_model; trip.license_plate = p.license_plate; } } }
    if (next === 'driver_arrived') { trip.arrived_at = now; }
    if (next === 'in_progress')    { trip.started_at = now; }
    if (next === 'completed')      { trip.ended_at   = now; }

    return trip;
  });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`✓ trip-service      → http://localhost:${PORT}`);
}

start().catch(err => { console.error(err); process.exit(1); });
