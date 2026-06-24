import * as h3 from 'h3-js';

export const H3_RESOLUTION = 10;

export function latLngToCell(lat: number, lng: number): string {
  return h3.latLngToCell(lat, lng, H3_RESOLUTION);
}

export function getSearchCells(lat: number, lng: number, rings = 1): string[] {
  const center = latLngToCell(lat, lng);
  return h3.gridDisk(center, rings);
}
