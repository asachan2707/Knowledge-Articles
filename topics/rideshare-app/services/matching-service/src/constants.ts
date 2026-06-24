export const TOPICS = {
  DRIVER_LOCATIONS: 'driver-locations',
  RIDE_REQUESTS:    'ride-requests',
  SURGE_UPDATES:    'surge-updates',
  TRIP_EVENTS:      'trip-events',
  OFFERS:           'offers',
} as const;

export const H3_RESOLUTION        = 10;
export const MAX_SEARCH_RINGS     = 5;
export const SUPPLY_POOL_TARGET   = 20;   // candidates to score
export const ETA_TIMEOUT_MS       = 100;  // fast ETA budget per driver
export const OFFER_WAVE_TIMEOUTS  = [30, 20, 15]; // seconds per wave
export const LOCK_TTL_SEC         = 10;
export const BASE_FARE_USD        = 2.50; // flag-fall
export const FARE_PER_KM          = 1.20;
export const FARE_PER_MIN         = 0.25;
