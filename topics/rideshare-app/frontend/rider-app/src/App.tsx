import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────
const MATCH_API  = 'http://localhost:3002';
const TRIP_API   = 'http://localhost:3004';
const PRICE_API  = 'http://localhost:3003';
const NOTIF_WS   = 'ws://localhost:3005';

// ─── Seed riders (matches DB seed) ───────────────────────────────────────────
const RIDERS = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Alice Rider' },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'Bob Rider' },
];

// ─── Demo locations ───────────────────────────────────────────────────────────
const LOCATIONS = [
  { label: 'Times Square, NYC',     lat: 40.7580, lng: -73.9855 },
  { label: 'Brooklyn Bridge, NYC',  lat: 40.7061, lng: -73.9969 },
  { label: 'Central Park, NYC',     lat: 40.7829, lng: -73.9654 },
  { label: 'JFK Airport, NYC',      lat: 40.6413, lng: -73.7781 },
  { label: 'Grand Central, NYC',    lat: 40.7527, lng: -73.9772 },
];

type TripStatus = 'requesting'|'accepted'|'driver_arrived'|'in_progress'|'completed'|'cancelled';

interface Trip {
  id: string;
  status: TripStatus;
  driver_id?: string;
  driver_name?: string;
  driver_rating?: number;
  vehicle_make?: string;
  vehicle_model?: string;
  license_plate?: string;
  final_fare?: number;
  surge_mult?: number;
  distance_km?: number;
  duration_sec?: number;
  eta_sec?: number;
}

interface WsEvent { type: string; [k: string]: unknown; }

const STATUS_STEPS: TripStatus[] = [
  'requesting','accepted','driver_arrived','in_progress','completed',
];
const STATUS_LABELS: Record<string, string> = {
  requesting:     'Finding driver…',
  accepted:       'Driver accepted',
  driver_arrived: 'Driver arrived',
  in_progress:    'Trip in progress',
  completed:      'Trip completed',
  cancelled:      'Cancelled',
};

export default function App() {
  const [riderId, setRiderId]     = useState(RIDERS[0].id);
  const [originIdx, setOriginIdx] = useState(0);
  const [destIdx, setDestIdx]     = useState(1);
  const [trip, setTrip]           = useState<Trip | null>(null);
  const [surge, setSurge]         = useState(1.0);
  const [events, setEvents]       = useState<{time: string; type: string; detail: string}[]>([]);
  const [busy, setBusy]           = useState(false);
  const [driverLoc, setDriverLoc] = useState<{lat:number;lng:number;etaSec?:number}|null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const riderName = RIDERS.find(r => r.id === riderId)?.name ?? 'Rider';
  const origin = LOCATIONS[originIdx];
  const dest   = LOCATIONS[destIdx];

  // ─── Fetch surge on location change ───────────────────────────────────────
  useEffect(() => {
    fetch(`${PRICE_API}/surge?lat=${origin.lat}&lng=${origin.lng}`)
      .then(r => r.json())
      .then(d => setSurge(d.surgeMult ?? 1.0))
      .catch(() => {});
  }, [origin.lat, origin.lng]);

  // ─── Connect to notification WS when trip exists ──────────────────────────
  useEffect(() => {
    if (!trip) return;
    const ws = new WebSocket(`${NOTIF_WS}/ws/rider/${riderId}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg: WsEvent = JSON.parse(e.data);
      addEvent(msg.type, msg);

      if (msg.type === 'driver_accepted') {
        setTrip(prev => prev ? {
          ...prev,
          status: 'accepted',
          driver_id: msg.driverId as string,
          driver_name: msg.driverName as string ?? 'Driver',
          eta_sec: msg.etaSec as number,
          final_fare: msg.finalFare as number,
          surge_mult: msg.surgeMult as number,
          distance_km: msg.distanceKm as number,
        } : prev);
      }
      if (msg.type === 'driver_location') {
        setDriverLoc({ lat: msg.lat as number, lng: msg.lng as number, etaSec: msg.etaSec as number });
      }
      if (['driver_arrived','trip_started','trip_completed','trip_cancelled'].includes(msg.type)) {
        const statusMap: Record<string,TripStatus> = {
          driver_arrived: 'driver_arrived',
          trip_started:   'in_progress',
          trip_completed: 'completed',
          trip_cancelled: 'cancelled',
        };
        setTrip(prev => prev ? { ...prev, status: statusMap[msg.type] ?? prev.status } : prev);
      }
      if (msg.type === 'no_drivers_found') {
        setTrip(prev => prev ? { ...prev, status: 'cancelled' } : prev);
      }
    };

    ws.onerror = () => addEvent('ws_error', { detail: 'WebSocket error' });
    return () => { ws.close(); wsRef.current = null; };
  }, [trip?.id, riderId]);

  // ─── Poll trip state every 4 s as fallback ────────────────────────────────
  useEffect(() => {
    if (!trip || ['completed','cancelled'].includes(trip.status)) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`${TRIP_API}/trips/${trip.id}`);
        const data = await r.json();
        setTrip(prev => prev ? { ...prev, ...data } : prev);
      } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(id);
  }, [trip?.id, trip?.status]);

  const addEvent = useCallback((type: string, detail: WsEvent | Record<string,unknown>) => {
    const time = new Date().toLocaleTimeString();
    const detailStr = Object.entries(detail)
      .filter(([k]) => !['type'].includes(k))
      .map(([k,v]) => `${k}: ${v}`)
      .join(' · ');
    setEvents(prev => [{ time, type, detail: detailStr }, ...prev].slice(0, 30));
  }, []);

  // ─── Request a ride ───────────────────────────────────────────────────────
  const requestRide = async () => {
    if (originIdx === destIdx) return alert('Origin and destination must differ');
    setBusy(true);
    try {
      const res = await fetch(`${MATCH_API}/rides`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          riderId, originLat: origin.lat, originLng: origin.lng,
          destLat: dest.lat, destLng: dest.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setTrip({ id: data.rideId, status: 'requesting' });
      setDriverLoc(null);
      setEvents([]);
      addEvent('ride_requested', { rideId: data.rideId });
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // ─── Cancel ride ──────────────────────────────────────────────────────────
  const cancelRide = async () => {
    if (!trip) return;
    await fetch(`${MATCH_API}/rides/${trip.id}`, { method: 'DELETE' });
    setTrip(prev => prev ? { ...prev, status: 'cancelled' } : prev);
    addEvent('ride_cancelled', {});
  };

  const surgeClass = surge >= 2 ? 'high' : surge >= 1.3 ? 'medium' : 'low';
  const estFare = ((2.50 + 1.20 * (driverLoc ? 3 : 2)) * surge).toFixed(2);

  const isActive = trip && !['completed','cancelled'].includes(trip.status);

  return (
    <div className="app">
      <header className="header">
        <h1>RideShare · Rider</h1>
        <span className={`badge ${isActive ? 'online' : ''}`}>
          {isActive ? '● Live' : riderName}
        </span>
      </header>

      <main className="main">

        {/* ── Trip form (only when no active trip) ── */}
        {!trip || ['completed','cancelled'].includes(trip.status) ? (
          <div className="card">
            <h2>Book a ride</h2>

            <div className="field">
              <label>Rider</label>
              <select value={riderId} onChange={e => setRiderId(e.target.value)}>
                {RIDERS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>From</label>
              <select value={originIdx} onChange={e => setOriginIdx(Number(e.target.value))}>
                {LOCATIONS.map((l, i) => <option key={i} value={i}>{l.label}</option>)}
              </select>
            </div>

            <div className="field">
              <label>To</label>
              <select value={destIdx} onChange={e => setDestIdx(Number(e.target.value))}>
                {LOCATIONS.map((l, i) => <option key={i} value={i}>{l.label}</option>)}
              </select>
            </div>

            {/* Surge indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '0.82rem', color: '#888' }}>
                Est. fare <strong>${estFare}</strong>
              </span>
              <span className={`surge-pill ${surgeClass}`}>
                {surge.toFixed(2)}× surge
              </span>
            </div>

            <button
              className="btn btn-primary"
              onClick={requestRide}
              disabled={busy || originIdx === destIdx}
            >
              {busy ? <><span className="spinner" />Finding driver…</> : 'Request Ride'}
            </button>

            {trip?.status === 'cancelled' && (
              <p style={{ color: '#ef4444', fontSize: '0.82rem', marginTop: '0.75rem', textAlign: 'center' }}>
                Trip was cancelled or no drivers found nearby.
              </p>
            )}
            {trip?.status === 'completed' && (
              <p style={{ color: '#22c55e', fontSize: '0.82rem', marginTop: '0.75rem', textAlign: 'center' }}>
                Trip completed. Fare: <strong>${trip.final_fare?.toFixed(2)}</strong>
              </p>
            )}
          </div>
        ) : (
          <>
            {/* ── Active trip card ── */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ margin: 0 }}>Active trip</h2>
                <span className={`status-pill ${trip.status}`}>
                  {STATUS_LABELS[trip.status]}
                </span>
              </div>

              {/* Driver info (shown after accepted) */}
              {trip.driver_name && (
                <div className="driver-info" style={{ marginBottom: '0.75rem' }}>
                  <div className="driver-avatar">
                    {trip.driver_name[0]}
                  </div>
                  <div className="driver-details">
                    <h3>{trip.driver_name}</h3>
                    <p>
                      {trip.vehicle_make} {trip.vehicle_model} · {trip.license_plate}
                      {trip.driver_rating && <> · ★ {trip.driver_rating}</>}
                    </p>
                  </div>
                </div>
              )}

              {/* Stats */}
              {(trip.eta_sec || trip.final_fare || trip.distance_km) && (
                <div className="trip-stats">
                  {trip.eta_sec != null && (
                    <div className="trip-stat">
                      <div className="val">{Math.ceil((driverLoc?.etaSec ?? trip.eta_sec) / 60)} min</div>
                      <div className="lbl">ETA</div>
                    </div>
                  )}
                  {trip.final_fare != null && (
                    <div className="trip-stat">
                      <div className="val">${trip.final_fare.toFixed(2)}</div>
                      <div className="lbl">Fare{trip.surge_mult && trip.surge_mult > 1 ? ` (${trip.surge_mult}×)` : ''}</div>
                    </div>
                  )}
                  {trip.distance_km != null && (
                    <div className="trip-stat">
                      <div className="val">{trip.distance_km} km</div>
                      <div className="lbl">Distance</div>
                    </div>
                  )}
                </div>
              )}

              {/* Route mini-map */}
              <div className="map-box" style={{ marginTop: '0.75rem' }}>
                <div>
                  <span className="map-pin">📍</span> {origin.label}
                  <div className="coords">{origin.lat.toFixed(4)}, {origin.lng.toFixed(4)}</div>
                </div>
                {driverLoc && (
                  <div style={{ color: '#fbbf24', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                    🚗 Driver {driverLoc.lat.toFixed(4)}, {driverLoc.lng.toFixed(4)}
                    {driverLoc.etaSec != null && <> · ETA {Math.ceil(driverLoc.etaSec / 60)} min</>}
                  </div>
                )}
                <div>
                  <span className="map-pin">🏁</span> {dest.label}
                  <div className="coords">{dest.lat.toFixed(4)}, {dest.lng.toFixed(4)}</div>
                </div>
              </div>
            </div>

            {/* ── Trip timeline ── */}
            <div className="card">
              <h2>Trip progress</h2>
              <ul className="timeline">
                {STATUS_STEPS.map(step => {
                  const currentIdx = STATUS_STEPS.indexOf(trip.status as TripStatus);
                  const stepIdx    = STATUS_STEPS.indexOf(step);
                  const done   = stepIdx < currentIdx;
                  const active = stepIdx === currentIdx;
                  return (
                    <li key={step} className={done ? 'done' : active ? 'active' : ''}>
                      {STATUS_LABELS[step]}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Cancel button */}
            {['requesting','accepted'].includes(trip.status) && (
              <button className="btn btn-danger" onClick={cancelRide}>
                Cancel Ride
              </button>
            )}
          </>
        )}

        {/* ── Live events log ── */}
        {events.length > 0 && (
          <div className="card">
            <h2>Live events (WebSocket)</h2>
            <div className="events">
              {events.map((ev, i) => (
                <div key={i} className="event-item">
                  <span className="event-time">{ev.time}</span>
                  <div>
                    <span className="event-type">{ev.type}</span>
                    {ev.detail && <span style={{ color: '#888', marginLeft: '0.4rem' }}>{ev.detail}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Service health ── */}
        <ServiceHealth />
      </main>
    </div>
  );
}

// ─── Service health panel ─────────────────────────────────────────────────────
function ServiceHealth() {
  const services = [
    { name: 'Location', url: 'http://localhost:3001/health' },
    { name: 'Matching', url: 'http://localhost:3002/health' },
    { name: 'Pricing',  url: 'http://localhost:3003/health' },
    { name: 'Trip',     url: 'http://localhost:3004/health' },
    { name: 'Notify',   url: 'http://localhost:3005/health' },
  ];
  const [status, setStatus] = useState<Record<string, 'ok'|'down'|'checking'>>({});

  useEffect(() => {
    const check = async () => {
      const results: Record<string, 'ok'|'down'> = {};
      await Promise.all(services.map(async s => {
        try {
          const r = await fetch(s.url, { signal: AbortSignal.timeout(2000) });
          results[s.name] = r.ok ? 'ok' : 'down';
        } catch { results[s.name] = 'down'; }
      }));
      setStatus(results);
    };
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card">
      <h2>Services</h2>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {services.map(s => (
          <span key={s.name} style={{
            padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
            background: status[s.name] === 'ok' ? '#d1fae5' : status[s.name] === 'down' ? '#fee2e2' : '#f1f5f9',
            color: status[s.name] === 'ok' ? '#065f46' : status[s.name] === 'down' ? '#991b1b' : '#888',
          }}>
            {status[s.name] === 'ok' ? '● ' : status[s.name] === 'down' ? '○ ' : '· '}{s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
