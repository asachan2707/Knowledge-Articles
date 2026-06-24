// ─── A* ETA Engine ────────────────────────────────────────────────────────────
// Models a city road network as a weighted directed graph.
// Uses A* with great-circle heuristic (always admissible — never over-estimates).
// Two tiers: fast (shallow depth, rank supply pool) and accurate (full graph, top 3).

export interface LatLng { lat: number; lng: number }

interface Edge {
  to: number;
  distKm: number;
  speedKmh: number; // blended: 40% live + 60% historical
}

interface Node {
  id: number;
  lat: number;
  lng: number;
  edges: Edge[];
}

// ─── Haversine great-circle distance (km) ────────────────────────────────────
function haversine(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toRad(d: number) { return (d * Math.PI) / 180; }

// ─── Synthetic road graph builder ────────────────────────────────────────────
// In production this loads from a real OSM/PostGIS graph.
// Here we build a grid of nodes around the origin + destination so A* has
// a realistic graph to traverse, giving real-looking ETAs.

function buildLocalGraph(origin: LatLng, dest: LatLng): { nodes: Node[]; originIdx: number; destIdx: number } {
  const nodes: Node[] = [];
  const GRID = 7; // 7×7 = 49 nodes
  const spanLat = Math.abs(dest.lat - origin.lat) + 0.02;
  const spanLng = Math.abs(dest.lng - origin.lng) + 0.02;
  const minLat = Math.min(origin.lat, dest.lat) - 0.01;
  const minLng = Math.min(origin.lng, dest.lng) - 0.01;

  // Create grid nodes
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      nodes.push({
        id: r * GRID + c,
        lat: minLat + (r / (GRID - 1)) * spanLat,
        lng: minLng + (c / (GRID - 1)) * spanLng,
        edges: [],
      });
    }
  }

  // Connect horizontal + vertical neighbours (bidirectional)
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const idx = r * GRID + c;
      // Blend: 40% live speed (simulate 28 kmh in grid) + 60% historical (35 kmh)
      const blendedSpeed = 0.4 * 28 + 0.6 * 35; // = 32.2 kmh
      if (c + 1 < GRID) {
        const right = r * GRID + (c + 1);
        const d = haversine(nodes[idx], nodes[right]);
        nodes[idx].edges.push({ to: right, distKm: d, speedKmh: blendedSpeed });
        nodes[right].edges.push({ to: idx, distKm: d, speedKmh: blendedSpeed });
      }
      if (r + 1 < GRID) {
        const down = (r + 1) * GRID + c;
        const d = haversine(nodes[idx], nodes[down]);
        nodes[idx].edges.push({ to: down, distKm: d, speedKmh: blendedSpeed });
        nodes[down].edges.push({ to: idx, distKm: d, speedKmh: blendedSpeed });
      }
    }
  }

  // Find closest node to origin and dest
  const closestTo = (pt: LatLng) =>
    nodes.reduce((best, n, i) =>
      haversine(pt, n) < haversine(pt, nodes[best]) ? i : best, 0);

  return { nodes, originIdx: closestTo(origin), destIdx: closestTo(dest) };
}

// ─── A* pathfinder ────────────────────────────────────────────────────────────
// Returns estimated travel time in seconds, or null if unreachable.
function astar(nodes: Node[], startIdx: number, endIdx: number): number | null {
  const MAX_SPEED_KMH = 120;
  const dest = nodes[endIdx];

  // heuristic: great-circle / max speed (admissible — never over-estimates)
  const h = (idx: number) =>
    (haversine(nodes[idx], dest) / MAX_SPEED_KMH) * 3600; // seconds

  const gScore = new Array(nodes.length).fill(Infinity);
  const fScore = new Array(nodes.length).fill(Infinity);
  gScore[startIdx] = 0;
  fScore[startIdx] = h(startIdx);

  // Min-heap via sorted array (sufficient for < 100 nodes)
  const open = new Set<number>([startIdx]);

  while (open.size > 0) {
    // Pick node in open with lowest fScore
    let current = -1;
    let bestF = Infinity;
    for (const idx of open) {
      if (fScore[idx] < bestF) { bestF = fScore[idx]; current = idx; }
    }
    if (current === endIdx) return gScore[endIdx];

    open.delete(current);

    for (const edge of nodes[current].edges) {
      const edgeTimeSec = (edge.distKm / edge.speedKmh) * 3600;
      const tentative = gScore[current] + edgeTimeSec;
      if (tentative < gScore[edge.to]) {
        gScore[edge.to] = tentative;
        fScore[edge.to] = tentative + h(edge.to);
        open.add(edge.to);
      }
    }
  }
  return null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ETAResult {
  driverId: string;
  etaSec: number;
  distanceKm: number;
}

/** Fast ETA — used to rank the full supply pool (< 50 ms per driver). */
export function computeFastETA(driverId: string, driverPos: LatLng, riderPos: LatLng): ETAResult {
  const { nodes, originIdx, destIdx } = buildLocalGraph(driverPos, riderPos);
  const etaSec = astar(nodes, originIdx, destIdx) ?? (haversine(driverPos, riderPos) / 30 * 3600);
  const distanceKm = haversine(driverPos, riderPos);
  return { driverId, etaSec: Math.round(etaSec), distanceKm: Math.round(distanceKm * 10) / 10 };
}

/** Accurate ETA — used for the top-3 finalists and the quote shown to the rider. */
export function computeAccurateETA(driverId: string, driverPos: LatLng, riderPos: LatLng): ETAResult {
  // Same algorithm; in production would use a fuller graph + finer speed profiles
  return computeFastETA(driverId, driverPos, riderPos);
}

/** Score a driver candidate. Higher = better match for rider. */
export function scoreDriver(
  etaSec: number,
  maxEtaSec: number,
  rating: number,
  surgeMult: number,
): number {
  const etaScore   = 0.5 * (1 - etaSec / Math.max(maxEtaSec, 1));
  const ratingScore = 0.3 * (rating / 5.0);
  const surgeScore  = 0.2 * (1 - Math.min(surgeMult, 10) / 10);
  return etaScore + ratingScore + surgeScore;
}
