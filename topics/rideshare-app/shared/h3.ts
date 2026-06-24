// ─── H3 geospatial helpers ────────────────────────────────────────────────────
// Resolution 10: each cell ≈ 170 m — driver-level matching precision.

import * as h3 from 'h3-js';

export const H3_RESOLUTION = 10;
export const MAX_SEARCH_RINGS = 5; // ~5 km radius at res 10

export function latLngToCell(lat: number, lng: number): string {
  return h3.latLngToCell(lat, lng, H3_RESOLUTION);
}

export function getCellCenter(cellId: string): { lat: number; lng: number } {
  const [lat, lng] = h3.cellToLatLng(cellId);
  return { lat, lng };
}

/** Returns center cell + all cells within k rings (total 1 + 6k cells for ring k). */
export function getSearchCells(lat: number, lng: number, rings = 1): string[] {
  const center = latLngToCell(lat, lng);
  return h3.gridDisk(center, rings);
}

/** Great-circle distance in km between two lat/lng points (Haversine). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
