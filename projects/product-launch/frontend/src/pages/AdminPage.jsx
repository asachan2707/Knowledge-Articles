import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../components/SocketProvider.jsx';

const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'change_me_in_production';
const IS_MOCK      = import.meta.env.VITE_USE_MOCKS === 'true';

const s = {
  page: { minHeight: '100dvh', padding: '2rem 1rem 4rem', maxWidth: '900px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' },
  h1: { fontSize: '1.5rem', fontWeight: 800 },
  tag: { background: 'rgba(99,102,241,.15)', color: '#818cf8', fontSize: '.75rem', fontWeight: 700, padding: '.2rem .65rem', borderRadius: '20px', border: '1px solid rgba(99,102,241,.25)', textTransform: 'uppercase', letterSpacing: '.08em' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' },
  stat: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem' },
  statNum: { fontSize: '2.2rem', fontWeight: 900, lineHeight: 1, color: '#818cf8' },
  statLabel: { color: 'var(--muted)', fontSize: '.8rem', marginTop: '.3rem', textTransform: 'uppercase', letterSpacing: '.07em' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem' },
  cardTitle: { fontWeight: 700, fontSize: '1rem', marginBottom: '1rem', color: '#a5b4fc' },
  btn: (variant = 'primary') => ({
    padding: '.65rem 1.4rem', borderRadius: '8px', fontWeight: 700, fontSize: '.9rem', border: 'none', cursor: 'pointer',
    background: variant === 'primary' ? '#6366f1' : variant === 'danger' ? '#ef4444' : variant === 'success' ? '#22c55e' : 'rgba(255,255,255,.07)',
    color: '#fff', transition: 'opacity 150ms',
  }),
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' },
  th: { background: 'rgba(255,255,255,.04)', padding: '.6rem .9rem', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.07em' },
  td: { padding: '.6rem .9rem', borderBottom: '1px solid var(--border)', color: 'var(--text)' },
  badge: (status) => ({
    padding: '.15rem .5rem', borderRadius: '4px', fontSize: '.72rem', fontWeight: 700,
    background: status === 'completed' || status === 'live' ? 'rgba(34,197,94,.15)' : status === 'pending' ? 'rgba(251,191,36,.15)' : 'rgba(239,68,68,.15)',
    color: status === 'completed' || status === 'live' ? '#4ade80' : status === 'pending' ? '#fbbf24' : '#f87171',
  }),
};

function MockBanner() {
  if (!IS_MOCK) return null;
  return (
    <div style={{ background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.35)', borderRadius: '8px', padding: '.65rem 1.1rem', marginBottom: '1.25rem', fontSize: '.83rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
      <span>⚡</span>
      <span><strong>Mock mode active</strong> — all data is in-memory. No PostgreSQL or Redis required.</span>
    </div>
  );
}

function Toast({ msg, onClose }) {
  if (!msg) return null;
  const ok = msg.startsWith('✅');
  return (
    <div style={{ background: ok ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', border: `1px solid ${ok ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`, borderRadius: '8px', padding: '.75rem 1.25rem', marginBottom: '1.5rem', fontSize: '.9rem', fontWeight: 600, color: ok ? '#4ade80' : '#f87171' }}>
      {msg}
      <button onClick={onClose} style={{ background: 'none', color: 'inherit', float: 'right', fontSize: '1rem', opacity: .6, border: 'none', cursor: 'pointer' }}>×</button>
    </div>
  );
}

// ── All-products overview ──────────────────────────────────────────────────
function AdminOverview({ connected }) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const headers = { Authorization: `Bearer ${ADMIN_SECRET}` };

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/all-stats', { headers });
      const data = await res.json();
      if (res.ok) setProducts(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>;

  const totalReg    = products.reduce((a, p) => a + (p.totalRegistered ?? 0), 0);
  const totalOrders = products.reduce((a, p) => a + (p.totalOrders ?? 0), 0);
  const liveCount   = products.filter(p => p.is_launched).length;

  return (
    <>
      <div style={s.grid}>
        <div style={s.stat}><div style={s.statNum}>{products.length}</div><div style={s.statLabel}>Total Products</div></div>
        <div style={s.stat}><div style={{ ...s.statNum, color: '#4ade80' }}>{liveCount}</div><div style={s.statLabel}>Live Now</div></div>
        <div style={s.stat}><div style={s.statNum}>{totalReg.toLocaleString()}</div><div style={s.statLabel}>Total Waitlist</div></div>
        <div style={s.stat}><div style={s.statNum}>{totalOrders.toLocaleString()}</div><div style={s.statLabel}>Total Orders</div></div>
      </div>

      <div style={s.card}>
        <div style={{ ...s.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>All Products</span>
          <button style={{ ...s.btn('default'), fontSize: '.75rem', padding: '.35rem .75rem', opacity: .7 }} onClick={load}>↻ Refresh</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>{['Product', 'Status', 'Waitlist', 'Orders', 'Stock', 'Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td style={s.td}>
                    <div style={{ fontWeight: 700 }}>{p.product_name}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{p.tagline}</div>
                  </td>
                  <td style={s.td}><span style={s.badge(p.is_launched ? 'live' : 'pending')}>{p.is_launched ? 'LIVE' : 'PRE-LAUNCH'}</span></td>
                  <td style={s.td}>{(p.totalRegistered ?? 0).toLocaleString()}</td>
                  <td style={s.td}>{(p.totalOrders ?? 0).toLocaleString()}</td>
                  <td style={s.td}>{p.flashStock ?? p.flash_slots}</td>
                  <td style={s.td}>
                    <Link to={`/admin/${p.id}`} style={{ color: '#818cf8', fontWeight: 700, fontSize: '.8rem', textDecoration: 'none' }}>Manage →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ── Per-product admin controls ─────────────────────────────────────────────
function AdminProduct({ productId, connected }) {
  const [stats,   setStats]   = useState(null);
  const [regs,    setRegs]    = useState([]);
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [action,  setAction]  = useState('');
  const [msg,     setMsg]     = useState('');

  const { socket } = useSocket();
  const headers = { Authorization: `Bearer ${ADMIN_SECRET}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    try {
      const requests = [
        fetch(`/api/products/${productId}/admin-stats`,         { headers }),
        fetch(`/api/products/${productId}/admin-registrations`, { headers }),
      ];
      if (IS_MOCK) requests.push(fetch('/api/admin/jobs', { headers }));

      const [statsRes, regsRes, jobsRes] = await Promise.all(requests);
      if (statsRes.ok) setStats(await statsRes.json());
      if (regsRes.ok)  setRegs((await regsRes.json()).data ?? []);
      if (jobsRes?.ok) setJobs((await jobsRes.json()).jobs ?? []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const refresh = ({ productId: pid }) => { if (!pid || pid === productId) load(); };
    socket.on('waitlist:count', refresh);
    socket.on('flash:stock',    refresh);
    socket.on('launch:fired',   refresh);
    socket.on('launch:reset',   refresh);
    return () => {
      socket.off('waitlist:count', refresh);
      socket.off('flash:stock',    refresh);
      socket.off('launch:fired',   refresh);
      socket.off('launch:reset',   refresh);
    };
  }, [socket, productId, load]);

  async function triggerLaunch() {
    if (!window.confirm('Fire the launch? This will notify everyone on the waitlist and open the flash sale.')) return;
    setAction('launching');
    try {
      const res = await fetch(`/api/products/${productId}/admin-launch`, { method: 'POST', headers });
      const d   = await res.json();
      setMsg(res.ok ? `✅ Launched! ${d.emailsQueued} emails queued.` : `❌ ${d.error}`);
      load();
    } finally { setAction(''); }
  }

  async function triggerReset() {
    if (!window.confirm('Reset this product? Clears orders and returns to pre-launch state.')) return;
    setAction('resetting');
    try {
      const res = await fetch(`/api/products/${productId}/admin-reset`, { method: 'POST', headers });
      const d   = await res.json();
      setMsg(res.ok ? '✅ Reset complete.' : `❌ ${d.error}`);
      load();
    } finally { setAction(''); }
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading product data...</p>;

  const cfg      = stats?.product ?? {};
  const orders   = stats?.orders ?? {};
  const totalReg = stats?.totalRegistered ?? 0;
  const stock    = stats?.flashStock ?? 0;

  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/admin" style={{ color: 'var(--muted)', fontSize: '.82rem', textDecoration: 'none' }}>← All Products</Link>
      </div>

      <div style={s.header}>
        <div>
          <h1 style={s.h1}>{cfg.product_name ?? 'Product'}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: '.25rem' }}>{cfg.tagline ?? ''}</p>
        </div>
        <span style={s.tag}>{connected ? '● Live' : '○ Offline'}</span>
      </div>

      <Toast msg={msg} onClose={() => setMsg('')} />

      {/* KPI stats */}
      <div style={s.grid}>
        <div style={s.stat}><div style={s.statNum}>{totalReg.toLocaleString()}</div><div style={s.statLabel}>Waitlist</div></div>
        <div style={s.stat}><div style={s.statNum}>{stock}</div><div style={s.statLabel}>Slots Remaining</div></div>
        <div style={{ ...s.stat, borderColor: cfg.is_launched ? 'rgba(34,197,94,.4)' : 'var(--border)' }}>
          <div style={{ ...s.statNum, color: cfg.is_launched ? '#4ade80' : '#f87171' }}>{cfg.is_launched ? 'LIVE' : 'PRE-LAUNCH'}</div>
          <div style={s.statLabel}>Status</div>
        </div>
        <div style={s.stat}><div style={s.statNum}>{(orders.completed ?? 0).toLocaleString()}</div><div style={s.statLabel}>Orders</div></div>
      </div>

      {/* Launch controls */}
      <div style={s.card}>
        <div style={s.cardTitle}>Launch Controls</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={{ ...s.btn('success'), opacity: action || cfg.is_launched ? .5 : 1 }} disabled={!!action || cfg.is_launched} onClick={triggerLaunch}>
            {action === 'launching' ? 'Launching...' : '🚀 Fire Launch'}
          </button>
          <button style={{ ...s.btn('default'), opacity: action ? .5 : 1 }} disabled={!!action} onClick={triggerReset}>
            {action === 'resetting' ? 'Resetting...' : '↺ Reset Demo'}
          </button>
          <button style={{ ...s.btn('default'), opacity: .7 }} onClick={load}>↻ Refresh</button>
          <Link to={`/product/${productId}`} style={{ ...s.btn('default'), textDecoration: 'none', opacity: .7 }}>View Page ↗</Link>
        </div>
        {cfg.launch_at && (
          <p style={{ color: 'var(--muted)', fontSize: '.82rem', marginTop: '.85rem' }}>
            Scheduled: {new Date(cfg.launch_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Flash sale state */}
      <div style={s.card}>
        <div style={s.cardTitle}>Flash Sale State</div>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.3rem' }}>Active</div><span style={s.badge(cfg.is_launched ? 'completed' : 'failed')}>{cfg.is_launched ? 'YES' : 'NO'}</span></div>
          <div><div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.3rem' }}>Remaining</div><strong>{stock} / {cfg.flash_slots ?? 100}</strong></div>
          <div><div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.3rem' }}>Sold</div><strong>{(cfg.flash_slots ?? 100) - stock}</strong></div>
          <div><div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.3rem' }}>Pending</div><strong>{orders.pending ?? 0}</strong></div>
          <div><div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.3rem' }}>Confirmed</div><strong>{orders.completed ?? 0}</strong></div>
        </div>
      </div>

      {/* Registrations table */}
      <div style={s.card}>
        <div style={{ ...s.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Waitlist ({totalReg})</span>
          <span style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 400 }}>Showing latest {regs.length}</span>
        </div>
        {regs.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>No registrations yet.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead><tr>{['Name', 'Email', 'Joined'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {regs.map(reg => (
                  <tr key={reg.id}>
                    <td style={s.td}>{reg.name}</td>
                    <td style={s.td}>{reg.email}</td>
                    <td style={s.td}>{new Date(reg.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mock job log */}
      {IS_MOCK && (
        <div style={s.card}>
          <div style={{ ...s.cardTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Job Queue Log (mock) — {jobs.length} total</span>
            <button style={{ ...s.btn('default'), fontSize: '.75rem', padding: '.35rem .75rem', opacity: .7 }} onClick={load}>↻</button>
          </div>
          {jobs.length === 0 ? <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>No jobs yet.</p> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead><tr>{['Queue', 'Job', 'Status', 'Email', 'Queued'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {jobs.map(job => (
                    <tr key={job.id}>
                      <td style={s.td}><code style={{ fontSize: '.75rem', color: '#a5b4fc' }}>{job.queue.replace('email:', '')}</code></td>
                      <td style={s.td}>{job.jobName}</td>
                      <td style={s.td}><span style={s.badge(job.status)}>{job.status}</span></td>
                      <td style={s.td}>{job.data?.email ?? '—'}</td>
                      <td style={s.td}>{new Date(job.queuedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Root admin component ───────────────────────────────────────────────────
export function AdminPage() {
  const { id: productId } = useParams();
  const { connected }     = useSocket();

  return (
    <div style={s.page}>
      <MockBanner />

      {!productId && (
        <div style={s.header}>
          <div>
            <h1 style={s.h1}>Admin Dashboard</h1>
            <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: '.25rem' }}>All products overview</p>
          </div>
          <span style={s.tag}>{connected ? '● Live' : '○ Offline'}</span>
        </div>
      )}

      {productId
        ? <AdminProduct productId={productId} connected={connected} />
        : <AdminOverview connected={connected} />
      }

      <p style={{ color: 'var(--muted)', fontSize: '.78rem', textAlign: 'center', marginTop: '1rem' }}>
        <Link to="/" style={{ color: 'var(--accent)' }}>← Back to product hub</Link>
      </p>
    </div>
  );
}
