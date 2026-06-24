// ─── Wave dispatch protocol ───────────────────────────────────────────────────
// Step 1: find supply pool (H3)
// Step 2: parallel ETA for all candidates
// Step 3: score and rank
// Step 4: wave-offer with timeout chain
// Step 5: first accept → acquire Redis lock → create trip

import { v4 as uuid } from 'uuid';
import { findNearbyDrivers } from './supplyPool';
import { computeFastETA, computeAccurateETA, scoreDriver, ETAResult } from './eta';
import { acquireLock, releaseLock } from './lock';
import { getRedis } from './redis';
import {
  OFFER_WAVE_TIMEOUTS, ETA_TIMEOUT_MS,
  BASE_FARE_USD, FARE_PER_KM, FARE_PER_MIN,
} from './constants';

export interface DispatchRequest {
  rideId: string;
  riderId: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}

export interface DispatchResult {
  driverId: string;
  etaSec: number;
  distanceKm: number;
  baseFare: number;
  surgeMult: number;
  finalFare: number;
}

// Injected by index.ts — sends offer to a specific driver via notification-service
export type SendOfferFn = (driverId: string, offer: object) => Promise<void>;
// Injected — waits for a driver acceptance within timeoutMs, returns driverId or null
export type WaitAcceptFn = (
  rideId: string,
  candidateIds: string[],
  timeoutMs: number,
) => Promise<string | null>;

export async function runDispatch(
  req: DispatchRequest,
  sendOffer: SendOfferFn,
  waitAccept: WaitAcceptFn,
): Promise<DispatchResult | null> {
  const redis = getRedis();

  // ── Step 1: Supply pool ──────────────────────────────────────────────────
  const pool = await findNearbyDrivers(req.originLat, req.originLng);
  if (pool.length === 0) return null;

  // ── Step 2: Parallel fast ETA (within ETA_TIMEOUT_MS budget) ────────────
  const etaResults: ETAResult[] = await Promise.all(
    pool.map(d =>
      Promise.race([
        Promise.resolve(
          computeFastETA(d.driverId, { lat: d.lat, lng: d.lng }, { lat: req.originLat, lng: req.originLng })
        ),
        new Promise<ETAResult>(res =>
          setTimeout(() => res({ driverId: d.driverId, etaSec: 9999, distanceKm: d.distKm }), ETA_TIMEOUT_MS)
        ),
      ])
    )
  );

  // Filter drivers unreachable or too far (> 15 min)
  const reachable = etaResults.filter(e => e.etaSec <= 900);
  if (reachable.length === 0) return null;

  // ── Step 3: Score and rank ───────────────────────────────────────────────
  const surgeMult = await getSurgeMult(redis, req.originLat, req.originLng);
  const maxEta = Math.max(...reachable.map(e => e.etaSec));

  const scored = reachable.map(e => ({
    ...e,
    score: scoreDriver(e.etaSec, maxEta, 4.8 /* default rating */, surgeMult),
  })).sort((a, b) => b.score - a.score);

  // ── Step 4: Wave dispatch ────────────────────────────────────────────────
  const waveSizes = [1, 3, 8];
  let offset = 0;

  for (let wave = 0; wave < waveSizes.length; wave++) {
    const batch = scored.slice(offset, offset + waveSizes[wave]);
    if (batch.length === 0) break;
    offset += batch.length;

    const timeoutSec = OFFER_WAVE_TIMEOUTS[wave] ?? 15;

    // Mark ride as "being offered" to prevent duplicate dispatch
    await redis.set(`ride:${req.rideId}:status`, 'offering', 'EX', 120);

    const offerPayload = {
      offerId: uuid(),
      rideId: req.rideId,
      pickup:  { lat: req.originLat, lng: req.originLng },
      dropoff: { lat: req.destLat,   lng: req.destLng },
      expiresInSec: timeoutSec,
    };

    // Broadcast offers to all drivers in this wave simultaneously
    await Promise.allSettled(batch.map(d => sendOffer(d.driverId, offerPayload)));

    const acceptedDriverId = await waitAccept(req.rideId, batch.map(d => d.driverId), timeoutSec * 1000);
    if (!acceptedDriverId) continue;

    // ── Step 5: Acquire lock and create trip ─────────────────────────────
    const token = await acquireLock(req.rideId);
    if (!token) {
      // Another wave already locked it — stop dispatching
      return null;
    }

    try {
      // Verify ride still open (rider may have cancelled)
      const rideStatus = await redis.get(`ride:${req.rideId}:status`);
      if (rideStatus === 'matched' || rideStatus === 'cancelled') return null;

      await redis.set(`ride:${req.rideId}:status`, 'matched', 'EX', 3600);
      await redis.set(`ride:${req.rideId}:driver`, acceptedDriverId, 'EX', 3600);

      // Accurate ETA for accepted driver (for fare + display)
      const winner = scored.find(s => s.driverId === acceptedDriverId)!;
      const accurate = computeAccurateETA(
        acceptedDriverId,
        { lat: pool.find(d => d.driverId === acceptedDriverId)!.lat, lng: pool.find(d => d.driverId === acceptedDriverId)!.lng },
        { lat: req.originLat, lng: req.originLng },
      );

      const distKm  = winner.distanceKm;
      const durMin  = accurate.etaSec / 60;
      const base    = BASE_FARE_USD + FARE_PER_KM * distKm + FARE_PER_MIN * durMin;
      const final   = Math.round(base * surgeMult * 100) / 100;

      return {
        driverId: acceptedDriverId,
        etaSec: accurate.etaSec,
        distanceKm: distKm,
        baseFare: Math.round(base * 100) / 100,
        surgeMult,
        finalFare: final,
      };
    } finally {
      await releaseLock(req.rideId, token);
    }
  }

  return null; // all waves exhausted
}

async function getSurgeMult(redis: ReturnType<typeof getRedis>, lat: number, lng: number): Promise<number> {
  // Import H3 inline to avoid circular deps
  const { latLngToCell } = await import('h3-js');
  const cell = latLngToCell(lat, lng, 10);
  const val = await redis.get(`surge:${cell}`);
  return val ? parseFloat(val) : 1.0;
}
