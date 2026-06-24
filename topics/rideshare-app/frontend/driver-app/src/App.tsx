import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Config ───────────────────────────────────────────────────────────────────
const LOC_WS     = 'ws://localhost:3001';
const NOTIF_WS   = 'ws://localhost:3005';
const MATCH_API  = 'http://localhost:3002';
const TRIP_API   = 'http://localhost:3004';

// ─── Seed drivers (matches DB seed) ──────────────────────────────────────────
const DRIVERS = [
  { id: 'd0000000-0000-0000-0000-000000000001', name: 'Dave Driver',  plate: 'DAVE001', vehicle: 'Toyota Prius 2022',    rating: 4.85 },
  { id: 'd0000000-0000-0000-0000-000000000002', name: 'Eve Driver',   plate: 'EVE0002', vehicle: 'Honda Accord 2021',    rating: 4.92 },
  { id: 'd0000000-0000-0000-0000-000000000003', name: 'Frank Driver', plate: 'FRANK03', vehicle: 'Ford Explorer 2023',   rating: 4.75 },
];

// ─── Demo starting positions (near NYC locations) ─────────────────────────────
const START_POSITIONS = [
  { lat: 40.7128, lng: -74.0060 },  // Lower Manhattan
  { lat: 40.7282, lng: -73.7949 },  // Queens
  { lat: 40.6782, lng: -73.9442 },  // Brooklyn
];

interface Offer {
  offerId: string;
  rideId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  estKm?: number;
  estMin?: number;
  surgeMult?: number;
  expiresInSec: number;
}

interface TripStats {
  tripsToday: number;
  earnings: number;
  rating: number;
}

export default function App() {
  const [driverIdx, setDriverIdx]   = useState(0);
  const [isOnline, setIsOnline]     = useState(false);
  const [offer, setOffer]           = useState<Offer | null>(null);
  const [activeRide, setActiveRide] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<string>('');
  const [position, setPosition]     = useState(START_POSITIONS[0]);
  const [offerTimer, setOfferTimer] = useState(0);
  const [events, setEvents]         = useState<{time:string;type:string;detail:string}[]>([]);
  const [stats] = useState<TripStats>({ tripsToday: 7, earnings: 124.50, rating: 4.85 });

  const locWsRef   = useRef<WebSocket | null>(null);
  const notifWsRef = useRef<WebSocket | null>(null);
  const gpsInterval= useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const driver = DRIVERS[driverIdx];

  const addEvent = useCallback((type: string, detail: Record<string,unknown> = {}) => {
    const time = new Date().toLocaleTimeString();
    const detailStr = Object.entries(detail)
      .filter(([k]) => k !== 'type')
      .map(([k,v]) => `${k}: ${v}`)
      .join(' · ');
    setEvents(prev => [{ time, type, detail: detailStr }, ...prev].slice(0, 30));
  }, []);

  // ─── Go online ────────────────────────────────────────────────────────────
  const goOnline = useCallback(() => {
    const startPos = START_POSITIONS[driverIdx];
    setPosition(startPos);

    // Location WebSocket — streams GPS to location-service
    const locWs = new WebSocket(`${LOC_WS}/ws/driver/${driver.id}`);
    locWsRef.current = locWs;

    locWs.onopen = () => {
      locWs.send(JSON.stringify({ type: 'go_online' }));
      addEvent('connected', { service: 'location-service' });

      // Stream GPS every 4 seconds with slight drift to simulate movement
      let tick = 0;
      gpsInterval.current = setInterval(() => {
        if (locWs.readyState !== WebSocket.OPEN) return;
        tick++;
        const jLat = (Math.random() - 0.5) * 0.0008;
        const jLng = (Math.random() - 0.5) * 0.0008;
        setPosition(prev => {
          const newPos = { lat: prev.lat + jLat, lng: prev.lng + jLng };
          locWs.send(JSON.stringify({
            type: 'location_update',
            payload: { lat: newPos.lat, lng: newPos.lng, heading: tick * 15 % 360, speedKmh: 28 + Math.random() * 10 },
          }));
          return newPos;
        });
      }, 4000);
    };

    locWs.onmessage = e => {
      const msg = JSON.parse(e.data);
      addEvent(msg.type, msg);
    };

    locWs.onerror = () => addEvent('loc_ws_error', {});

    // Notification WebSocket — receives offers and trip events
    const notifWs = new WebSocket(`${NOTIF_WS}/ws/driver/${driver.id}`);
    notifWsRef.current = notifWs;

    notifWs.onopen = () => addEvent('notif_connected', { service: 'notification-service' });

    notifWs.onmessage = e => {
      const msg = JSON.parse(e.data) as { type: string; payload?: Offer; [k: string]: unknown };
      addEvent(msg.type, msg);

      if (msg.type === 'ride_offer' && msg.payload) {
        setOffer(msg.payload);
        setOfferTimer(msg.payload.expiresInSec);
        // Start countdown
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setOfferTimer(t => {
            if (t <= 1) {
              clearInterval(timerRef.current!);
              setOffer(null);
              addEvent('offer_expired', {});
              return 0;
            }
            return t - 1;
          });
        }, 1000);
      }

      if (msg.type === 'offer_confirmed') {
        const o = offer;
        if (o) setActiveRide(o.rideId);
        setRideStatus('accepted');
        setOffer(null);
        if (timerRef.current) clearInterval(timerRef.current);
      }

      if (msg.type === 'offer_expired') {
        setOffer(null);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    notifWs.onerror = () => addEvent('notif_ws_error', {});

    setIsOnline(true);
    addEvent('driver_online', { driver: driver.name });
  }, [driver.id, driver.name, driverIdx, addEvent, offer]);

  // ─── Go offline ───────────────────────────────────────────────────────────
  const goOffline = useCallback(() => {
    if (gpsInterval.current) clearInterval(gpsInterval.current);
    if (timerRef.current)    clearInterval(timerRef.current);

    if (locWsRef.current) {
      locWsRef.current.send(JSON.stringify({ type: 'go_offline' }));
      locWsRef.current.close();
    }
    if (notifWsRef.current) notifWsRef.current.close();

    setIsOnline(false);
    setOffer(null);
    addEvent('driver_offline', { driver: driver.name });
  }, [driver.name, addEvent]);

  useEffect(() => () => { goOffline(); }, []);

  // ─── Accept offer ─────────────────────────────────────────────────────────
  const acceptOffer = async () => {
    if (!offer) return;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await fetch(`${MATCH_API}/rides/${offer.rideId}/accept`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ driverId: driver.id }),
      });
      setActiveRide(offer.rideId);
      setRideStatus('accepted');
      setOffer(null);
      addEvent('offer_accepted', { rideId: offer.rideId });
    } catch { addEvent('accept_failed', {}); }
  };

  // ─── Reject offer ─────────────────────────────────────────────────────────
  const rejectOffer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    addEvent('offer_rejected', { rideId: offer?.rideId });
    setOffer(null);
  };

  // ─── Trip state machine buttons ───────────────────────────────────────────
  const advanceTrip = async (nextStatus: string) => {
    if (!activeRide) return;
    try {
      await fetch(`${TRIP_API}/trips/${activeRide}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, driverId: driver.id }),
      });
      setRideStatus(nextStatus);
      addEvent(`status_${nextStatus}`, { rideId: activeRide });
      if (nextStatus === 'completed') {
        setTimeout(() => { setActiveRide(null); setRideStatus(''); }, 2000);
      }
    } catch { addEvent('status_update_failed', {}); }
  };

  const timerPct = offer ? (offerTimer / offer.expiresInSec) * 100 : 0;

  return (
    <div className="app">
      <header className="header">
        <h1>RideShare · Driver</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`online-dot ${isOnline ? 'online' : ''}`} />
          <span style={{ fontSize: '0.82rem', color: isOnline ? '#4ade80' : '#94a3b8' }}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </header>

      <main className="main">

        {/* ── Driver selector + stats ── */}
        <div className="card">
          <h2>Driver</h2>
          <div className="field">
            <label>Select driver</label>
            <select
              value={driverIdx}
              onChange={e => { if (isOnline) goOffline(); setDriverIdx(Number(e.target.value)); }}
            >
              {DRIVERS.map((d, i) => (
                <option key={d.id} value={i}>{d.name} · {d.vehicle} · ★ {d.rating}</option>
              ))}
            </select>
          </div>

          <div className="stat-row">
            <div className="stat">
              <div className="val">{stats.tripsToday}</div>
              <div className="lbl">Trips today</div>
            </div>
            <div className="stat">
              <div className="val">${stats.earnings.toFixed(0)}</div>
              <div className="lbl">Earnings</div>
            </div>
            <div className="stat">
              <div className="val">★ {driver.rating}</div>
              <div className="lbl">Rating</div>
            </div>
          </div>
        </div>

        {/* ── Online toggle ── */}
        {!isOnline ? (
          <button className="btn btn-go" onClick={goOnline}>
            Go Online
          </button>
        ) : (
          <button className="btn btn-off" onClick={goOffline} disabled={!!activeRide}>
            Go Offline
          </button>
        )}

        {/* ── Live GPS stream ── */}
        {isOnline && (
          <div className="card">
            <h2>Live location (streaming every 4s)</h2>
            <div className="loc-box">
              {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Sending GPS → location-service → Redis GEOADD → Kafka
            </div>
          </div>
        )}

        {/* ── Incoming ride offer ── */}
        {offer && (
          <div className="offer-card">
            <h2>New ride offer ⚡</h2>
            <div className="timer-bar">
              <div className="timer-fill" style={{ width: `${timerPct}%` }} />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.5rem', textAlign: 'right' }}>
              {offerTimer}s to respond
            </div>
            <div className="offer-route">
              <p>📍 <strong>Pick up:</strong> {offer.pickup.lat.toFixed(4)}, {offer.pickup.lng.toFixed(4)}</p>
              <p>🏁 <strong>Drop off:</strong> {offer.dropoff.lat.toFixed(4)}, {offer.dropoff.lng.toFixed(4)}</p>
            </div>
            <div className="offer-stats">
              {offer.estKm != null && (
                <div className="offer-stat">
                  <div className="val">{offer.estKm} km</div>
                  <div className="lbl">Distance</div>
                </div>
              )}
              {offer.estMin != null && (
                <div className="offer-stat">
                  <div className="val">{offer.estMin} min</div>
                  <div className="lbl">Duration</div>
                </div>
              )}
              {offer.surgeMult && offer.surgeMult > 1 && (
                <div className="offer-stat">
                  <div className="val">{offer.surgeMult}×</div>
                  <div className="lbl">Surge</div>
                </div>
              )}
            </div>
            <button className="btn btn-accept" onClick={acceptOffer}>Accept</button>
            <button className="btn btn-reject" onClick={rejectOffer}>Reject</button>
          </div>
        )}

        {/* ── Active trip controls ── */}
        {activeRide && !offer && (
          <div className="card" style={{ border: '1.5px solid #22c55e' }}>
            <h2>Active trip · {rideStatus.replace('_', ' ')}</h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem', fontFamily: 'monospace' }}>
              {activeRide}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {rideStatus === 'accepted' && (
                <button className="btn btn-accept" onClick={() => advanceTrip('driver_arrived')}>
                  Mark Arrived at Pickup
                </button>
              )}
              {rideStatus === 'driver_arrived' && (
                <button className="btn btn-accept" onClick={() => advanceTrip('in_progress')}>
                  Start Trip
                </button>
              )}
              {rideStatus === 'in_progress' && (
                <button className="btn btn-accept" onClick={() => advanceTrip('completed')}>
                  Complete Trip
                </button>
              )}
              {rideStatus === 'completed' && (
                <p style={{ color: '#4ade80', textAlign: 'center', fontWeight: 700 }}>
                  Trip completed ✓
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Live events log ── */}
        {events.length > 0 && (
          <div className="card">
            <h2>Events (WebSocket + REST)</h2>
            <div className="events">
              {events.map((ev, i) => (
                <div key={i} className="event-item">
                  <span className="event-time">{ev.time}</span>
                  <div>
                    <span className="event-type">{ev.type}</span>
                    {ev.detail && <span style={{ color: '#64748b', marginLeft: '0.4rem' }}>{ev.detail}</span>}
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
  const [status, setStatus] = useState<Record<string,'ok'|'down'|'check'>>({});

  useEffect(() => {
    const check = async () => {
      const r: Record<string,'ok'|'down'> = {};
      await Promise.all(services.map(async s => {
        try { r[s.name] = (await fetch(s.url, { signal: AbortSignal.timeout(2000) })).ok ? 'ok' : 'down'; }
        catch { r[s.name] = 'down'; }
      }));
      setStatus(r);
    };
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card">
      <h2>Services</h2>
      <div className="health-row">
        {services.map(s => (
          <span key={s.name} className={`health-chip ${status[s.name] ?? 'check'}`}>
            {status[s.name] === 'ok' ? '● ' : '○ '}{s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
