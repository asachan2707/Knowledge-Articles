import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../components/SocketProvider.jsx';
import { CountdownTimer } from '../components/CountdownTimer.jsx';

function statusLabel(p) {
  if (p.is_launched) return { text: 'Live Now',    bg: 'rgba(34,197,94,.15)',  color: '#4ade80',  dot: '#22c55e' };
  if (p.flash_stock <= 0) return { text: 'Sold Out', bg: 'rgba(239,68,68,.12)', color: '#f87171',  dot: '#ef4444' };
  return                   { text: 'Coming Soon', bg: 'rgba(99,102,241,.15)', color: '#818cf8',  dot: '#6366f1' };
}

const s = {
  page: { minHeight: '100dvh', padding: '0 1rem 4rem' },
  header: {
    maxWidth:    '960px',
    margin:      '0 auto',
    padding:     '3rem 0 2rem',
    textAlign:   'center',
  },
  eyebrow: {
    display:       'inline-block',
    background:    'rgba(99,102,241,.15)',
    color:         '#818cf8',
    fontWeight:    700,
    fontSize:      '.72rem',
    letterSpacing: '.12em',
    textTransform: 'uppercase',
    padding:       '.25rem .8rem',
    borderRadius:  '20px',
    marginBottom:  '.9rem',
    border:        '1px solid rgba(99,102,241,.25)',
  },
  h1: { fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', fontWeight: 900, letterSpacing: '-.03em', marginBottom: '.6rem' },
  sub: { color: 'var(--muted)', fontSize: '1rem', maxWidth: '500px', margin: '0 auto' },
  grid: {
    maxWidth:            '960px',
    margin:              '0 auto',
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap:                 '1.25rem',
  },
  card: {
    background:   'var(--surface)',
    border:       '1px solid var(--border)',
    borderRadius: '16px',
    overflow:     'hidden',
    display:      'flex',
    flexDirection: 'column',
    textDecoration: 'none',
    color:        'inherit',
    transition:   'border-color 150ms, transform 120ms, box-shadow 150ms',
    cursor:       'pointer',
  },
  img: { width: '100%', height: '160px', objectFit: 'cover', display: 'block' },
  body: { padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '.5rem' },
  footer: {
    padding:    '.9rem 1.25rem',
    borderTop:  '1px solid var(--border)',
    display:    'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize:   '.8rem',
  },
};

function ProductCard({ product, onCountUpdate }) {
  const status = statusLabel(product);

  return (
    <Link
      to={`/product/${product.id}`}
      style={s.card}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(99,102,241,.5)';
        e.currentTarget.style.transform   = 'translateY(-2px)';
        e.currentTarget.style.boxShadow   = '0 8px 32px rgba(0,0,0,.3)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform   = '';
        e.currentTarget.style.boxShadow   = '';
      }}
    >
      <div style={{ position: 'relative' }}>
        <img
          src={product.hero_image || 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=400&fit=crop&auto=format&q=70'}
          alt={product.product_name}
          style={s.img}
        />
        <span style={{
          position:      'absolute', top: '.75rem', left: '.75rem',
          background:    status.bg,
          color:         status.color,
          fontSize:      '.7rem', fontWeight: 700,
          padding:       '.2rem .65rem', borderRadius: '20px',
          border:        `1px solid ${status.color}44`,
          display:       'flex', alignItems: 'center', gap: '5px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.dot, flexShrink: 0,
            animation: product.is_launched ? 'pulse 2s infinite' : 'none' }} />
          {status.text}
        </span>
      </div>

      <div style={s.body}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
          {product.product_name}
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '.85rem', margin: 0, lineHeight: 1.5 }}>
          {product.tagline}
        </p>

        {!product.is_launched && product.launch_at && (
          <div style={{ marginTop: 'auto', paddingTop: '.5rem' }}>
            <p style={{ color: 'var(--muted)', fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: '.4rem' }}>
              Launching in
            </p>
            <CountdownTimer launchAt={product.launch_at} compact />
          </div>
        )}
      </div>

      <div style={s.footer}>
        <span style={{ color: 'var(--muted)' }}>
          🔖 <strong style={{ color: 'var(--text)' }}>{product.waitlist_count?.toLocaleString() ?? 0}</strong> waiting
        </span>
        {product.is_launched ? (
          <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '.8rem' }}>
            {product.flash_stock} slots left ⚡
          </span>
        ) : (
          <span style={{ color: '#6366f1', fontWeight: 600, fontSize: '.8rem' }}>
            Join waitlist →
          </span>
        )}
      </div>
    </Link>
  );
}

export function ProductsPage() {
  const { socket, connected } = useSocket();
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(d => { setProducts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Live socket updates — patch matching product in-place
  useEffect(() => {
    if (!socket) return;

    socket.on('waitlist:count', ({ productId, count }) => {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, waitlist_count: count } : p));
    });

    socket.on('flash:stock', ({ productId, remaining }) => {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, flash_stock: Math.max(0, remaining) } : p));
    });

    socket.on('launch:fired', ({ productId }) => {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_launched: true, flash_active: true } : p));
    });

    socket.on('launch:reset', ({ productId }) => {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_launched: false } : p));
    });

    return () => {
      socket.off('waitlist:count');
      socket.off('flash:stock');
      socket.off('launch:fired');
      socket.off('launch:reset');
    };
  }, [socket]);

  const live    = products.filter(p =>  p.is_launched);
  const upcoming= products.filter(p => !p.is_launched);

  return (
    <div style={s.page}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>

      {/* Header */}
      <div style={s.header}>
        <span style={s.eyebrow}>Product Hub</span>
        <h1 style={s.h1}>Upcoming & Live Products</h1>
        <p style={s.sub}>Join the waitlist for upcoming launches or claim your early-access slot on live products.</p>
        <div style={{ marginTop: '.85rem', fontSize: '.8rem', color: 'var(--muted)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', animation: connected ? 'pulse 2s infinite' : 'none', display: 'inline-block' }} />
          {connected ? 'Live updates active' : 'Connecting...'}
          {products.length > 0 && <span>· {products.length} product{products.length !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '4rem 0' }}>Loading products...</div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '4rem 0' }}>No products found.</div>
      ) : (
        <>
          {live.length > 0 && (
            <section style={{ maxWidth: '960px', margin: '0 auto 2.5rem' }}>
              <h2 style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#4ade80', marginBottom: '1rem' }}>
                🚀 Live Now
              </h2>
              <div style={s.grid}>
                {live.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section style={{ maxWidth: '960px', margin: '0 auto' }}>
              <h2 style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)', marginBottom: '1rem' }}>
                ⏳ Coming Soon
              </h2>
              <div style={s.grid}>
                {upcoming.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            </section>
          )}
        </>
      )}

      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        <Link to="/admin" style={{ color: 'var(--muted)', fontSize: '.78rem' }}>Admin →</Link>
      </div>
    </div>
  );
}
