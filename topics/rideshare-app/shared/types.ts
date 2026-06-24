// ─── Shared domain types used across all services ─────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export type TripStatus =
  | 'requesting'
  | 'accepted'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Trip {
  id: string;
  riderId: string;
  driverId?: string;
  status: TripStatus;
  origin: LatLng;
  destination: LatLng;
  originAddress?: string;
  destAddress?: string;
  baseFare?: number;
  surgeMult: number;
  finalFare?: number;
  distanceKm?: number;
  durationSec?: number;
  createdAt: string;
  acceptedAt?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  rating: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  licensePlate?: string;
  isOnline: boolean;
}

export interface DriverLocation {
  driverId: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  ts: number;
}

export interface RideOffer {
  offerId: string;
  rideId: string;
  driverId: string;
  pickup: LatLng;
  dropoff: LatLng;
  estKm: number;
  estMin: number;
  surgeMult: number;
  expiresInSec: number;
}

// ─── Kafka topic names ─────────────────────────────────────────────────────────
export const TOPICS = {
  DRIVER_LOCATIONS: 'driver-locations',
  RIDE_REQUESTS:    'ride-requests',
  SURGE_UPDATES:    'surge-updates',
  TRIP_EVENTS:      'trip-events',
  OFFERS:           'offers',
} as const;

// ─── WebSocket message types ──────────────────────────────────────────────────
export type WsMessageType =
  // Rider ← Server
  | 'driver_accepted'
  | 'driver_location'
  | 'driver_arrived'
  | 'trip_started'
  | 'trip_completed'
  | 'trip_cancelled'
  // Driver ← Server
  | 'ride_offer'
  | 'offer_confirmed'
  | 'offer_expired'
  // Both directions
  | 'subscribe'
  | 'location_update'
  | 'accept_offer'
  | 'ping'
  | 'pong';

export interface WsMessage {
  type: WsMessageType;
  payload?: unknown;
}
