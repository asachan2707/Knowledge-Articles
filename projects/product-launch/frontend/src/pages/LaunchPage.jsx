import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../components/SocketProvider.jsx';
import { CountdownTimer } from '../components/CountdownTimer.jsx';
import { WaitlistForm } from '../components/WaitlistForm.jsx';
import { FlashSaleBuy } from '../components/FlashSaleBuy.jsx';
import { LiveStats } from '../components/LiveStats.jsx';

const s = {
  page: { minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 1rem 4rem' },
  hero: { width: '100%', maxWidth: '900px', position: 'relative', borderRadius: '0 0 20px 20px', overflow: 'hidden', marginBottom: '3rem', height: 'min(45vw, 380px)', background: '#13131a' },
  heroImg: { width: '100%', height: '100%', objectFit: 'cover', opacity: .5 },
  heroOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, var(--bg) 100%)' },
  heroKicker: { position: 'absolute', top: '1.25rem', left: '1.5rem', background: 'rgba(99,102,241,.85)', color: '#fff', fontWeight: 700, fontSize: '.75rem', letterSpacing: '.1em', textTransform: 'uppercase', padding: '.3rem .75rem', borderRadius: '20px' },
  content: { width: '100%', maxWidth: '680px', textAlign: 'center' },
  tag: { display: 'inline-block', background: 'rgba(99,102,241,.15)', color: '#818cf8', fontWeight: 700, fontSize: '.75rem', letterSpacing: '.1em', textTransform: 'uppercase', padding: '.3rem .9rem', borderRadius: '20px', marginBottom: '1.1rem', border: '1px solid rgba(99,102,241,.25)' },
  h1: { fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-.03em', marginBottom: '.75rem' },
  tagline: { fontSize: '1.1rem', color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.6 },
  divider: { width: '100%', maxWidth: '680px', border: 'none', borderTop: '1px solid var(--border)', margin: '2.5rem 0' },
  sectionTitle: { fontSize: '1.35rem', fontWeight: 800, marginBottom: '.5rem' },
  sectionSub: { color: 'var(--muted)', fontSize: '.9rem', marginBottom: '1.5rem' },
  launchBanner: { width: '100%', maxWidth: '680px', background: 'linear-gradient(135deg, rgba(99,102,241,.2), rgba(139,92,246,.2))', border: '1px solid rgba(99,102,241,.4)', borderRadius: 'var(--radius)', padding: '2rem', textAlign: 'center', marginBottom: '2rem' },
};

export function LaunchPage() {
  const { id: productId }   = useParams();
  const { socket, connected } = useSocket();

  const [config,        setConfig]        = useState(null);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [viewers,       setViewers]       = useState(0);
  const [flashStock,    setFlashStock]    = useState(null);
  const [flashActive,   setFlashActive]   = useState(false);
  const [launched,      setLaunched]      = useState(false);
  const [notification,  setNotification]  = useState(null);
  const notifTimer = useRef(null);

  function showNotification(msg, type = 'info') {
    setNotification({ msg, type });
    clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotification(null), 4500);
  }

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/products/${productId}`)
      .then(r => r.json())
      .then(d => {
        setConfig(d);
        setFlashStock(d.flash_stock ?? null);
        setFlashActive(d.flash_active ?? false);
        setLaunched(d.is_launched ?? false);
        setWaitlistCount(d.waitlist_count ?? 0);
      })
      .catch(console.error);
  }, [productId]);

  // Only listen for events scoped to this product
  useEffect(() => {
    if (!socket || !productId) return;

    socket.on('waitlist:count', ({ productId: pid, count }) => {
      if (pid === productId) setWaitlistCount(count);
    });
    socket.on('viewers:update', ({ count }) => setViewers(count));
    socket.on('flash:stock', ({ productId: pid, remaining }) => {
      if (pid === productId) setFlashStock(Math.max(0, remaining));
    });
    socket.on('launch:fired', ({ productId: pid }) => {
      if (pid === productId) { setLaunched(true); setFlashActive(true); showNotification('🚀 We just launched! Grab your slot.', 'success'); }
    });
    socket.on('launch:reset', ({ productId: pid }) => {
      if (pid === productId) { setLaunched(false); setFlashActive(false); setFlashStock(config?.flash_slots ?? 100); showNotification('Demo reset.', 'info'); }
    });

    return () => {
      socket.off('waitlist:count');
      socket.off('viewers:update');
      socket.off('flash:stock');
      socket.off('launch:fired');
      socket.off('launch:reset');
    };
  }, [socket, productId]);

  const heroImg = config?.hero_image ||
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1600&h=700&fit=crop&auto=format&q=80';

  return (
    <div style={s.page}>
      {/* Toast */}
      {notification && (
        <div style={{ position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', background: notification.type === 'success' ? 'rgba(34,197,94,.15)' : 'rgba(99,102,241,.15)', border: `1px solid ${notification.type === 'success' ? 'rgba(34,197,94,.4)' : 'rgba(99,102,241,.4)'}`, color: notification.type === 'success' ? '#4ade80' : '#818cf8', padding: '.75rem 1.5rem', borderRadius: '10px', fontWeight: 600, fontSize: '.9rem', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,.4)', whiteSpace: 'nowrap' }}>
          {notification.msg}
        </div>
      )}

      {/* Hero */}
      <div style={s.hero}>
        <img src={heroImg} alt="" style={s.heroImg} />
        <div style={s.heroOverlay} />
        <span style={s.heroKicker}>{launched ? 'Live Now' : 'Coming Soon'}</span>
      </div>

      {/* Back link */}
      <div style={{ width: '100%', maxWidth: '680px', marginBottom: '-.5rem' }}>
        <Link to="/" style={{ color: 'var(--muted)', fontSize: '.82rem', textDecoration: 'none' }}>← All Products</Link>
      </div>

      {/* Content */}
      <div style={s.content}>
        <span style={s.tag}>Early Access</span>
        <h1 style={s.h1}>{config?.product_name ?? '...'}</h1>
        <p style={s.tagline}>{config?.tagline ?? ''}</p>

        <LiveStats viewers={viewers} waitlistCount={waitlistCount} connected={connected} />
        <hr style={s.divider} />

        {launched ? (
          <div style={s.launchBanner}>
            <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>🚀</div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '.5rem' }}>We're Live!</h2>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
              {flashStock !== null && flashStock > 0
                ? `${flashStock} early-access slots remaining.`
                : 'All early-access slots are taken.'}
            </p>
            <FlashSaleBuy stock={flashStock} isActive={flashActive} productId={productId} />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '2rem' }}>
              <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>Launching in</p>
              <CountdownTimer launchAt={config?.launch_at} onExpire={() => setLaunched(true)} />
            </div>
            <hr style={s.divider} />
            <h2 style={s.sectionTitle}>Be the first to know</h2>
            <p style={s.sectionSub}>
              Join {waitlistCount > 0 ? `${waitlistCount.toLocaleString()} others` : 'the waitlist'} — members get early access the moment we launch.
            </p>
            <WaitlistForm productId={productId} onSuccess={(data) => {
              setWaitlistCount(c => Math.max(c, data.position ?? c));
              showNotification(`You're #${data.position} — confirmation sent!`, 'success');
            }} />
          </>
        )}

        {launched && (
          <>
            <hr style={s.divider} />
            <h2 style={s.sectionTitle}>Stay in the loop</h2>
            <p style={s.sectionSub}>Join the waitlist for future drops.</p>
            <WaitlistForm productId={productId} />
          </>
        )}
      </div>
    </div>
  );
}
