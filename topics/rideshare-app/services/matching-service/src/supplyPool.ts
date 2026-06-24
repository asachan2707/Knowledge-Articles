// ─── Supply pool search via H3 ring expansion ────────────────────────────────
// Expands outward ring by ring until SUPPLY_POOL_TARGET drivers found or
// MAX_SEARCH_RINGS exhausted.

import * as h3 from 'h3-js';
import { getRedis } from './redis';
import { H3_RESOLUTION, MAX_SEARCH_RINGS, SUPPLY_POOL_TARGET } from './constants';

export interface NearbyDriver {
  driverId: string;
  lat: number;
  lng: number;
  distKm: number;
}

export async function findNearbyDrivers(
  lat: number,
  lng: number,
): Promise<NearbyDriver[]> {
  const redis = getRedis();
  const center = h3.latLngToCell(lat, lng, H3_RESOLUTION);
  const seen = new Set<string>();
  const results: NearbyDriver[] = [];

  for (let ring = 0; ring <= MAX_SEARCH_RINGS; ring++) {
    const cells = h3.gridDisk(center, ring);

    for (const cell of cells) {
      // Redis GEORADIUS on the per-cell sorted set
      const members = await redis.georadius(
        `drivers:cell:${cell}`,
        lng, lat,
        10, 'km',         // generous radius — H3 ring already narrows the set
        'ASC', 'COUNT', 50, 'WITHCOORD', 'WITHDIST',
      ) as Array<[string, string, [string, string]]>;

      for (const [driverId, dist, [dLng, dLat]] of (members ?? [])) {
        if (seen.has(driverId)) continue;
        // only include drivers actively online (TTL key exists)
        const online = await redis.get(`driver:${driverId}:online`);
        if (!online) continue;
        seen.add(driverId);
        results.push({
          driverId,
          lat: Number(dLat),
          lng: Number(dLng),
          distKm: Number(dist),
        });
      }
    }

    if (results.length >= SUPPLY_POOL_TARGET) break;
  }

  return results.slice(0, SUPPLY_POOL_TARGET);
}
