import React, { useState } from 'react';

const styles = {
  wrap: {
    background:   'rgba(99,102,241,.08)',
    border:       '1px solid rgba(99,102,241,.3)',
    borderRadius: 'var(--radius)',
    padding:      '2rem',
    textAlign:    'center',
    maxWidth:     '460px',
    margin:       '0 auto',
  },
  stock: {
    fontSize:   '3rem',
    fontWeight: 900,
    color:      '#a78bfa',
    lineHeight: 1,
  },
  stockLabel: {
    color:     'var(--muted)',
    fontSize:  '.85rem',
    marginTop: '.25rem',
  },
  btn: {
    background:   'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color:        '#fff',
    fontWeight:   700,
    fontSize:     '1.05rem',
    padding:      '.9rem 2rem',
    borderRadius: '10px',
    border:       'none',
    cursor:       'pointer',
    width:        '100%',
    marginTop:    '1.25rem',
    transition:   'opacity 150ms, transform 80ms',
  },
  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '.7rem',
    marginTop:     '1.25rem',
  },
  success: {
    background:   'rgba(34,197,94,.1)',
    border:       '1px solid rgba(34,197,94,.3)',
    borderRadius: '10px',
    padding:      '1.25rem',
    color:        '#4ade80',
    marginTop:    '1rem',
  },
  soldOut: {
    color:     '#f87171',
    fontWeight: 700,
    fontSize:  '1.1rem',
    marginTop: '1rem',
  },
  error: { color: '#f87171', fontSize: '.85rem', marginTop: '.5rem' },
};

export function FlashSaleBuy({ stock, isActive, productId }) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState(null);

  async function handleBuy(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/products/${productId}/buy`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setError('All slots are gone — sorry!');
        return;
      }
      if (res.status === 429) {
        setError('High demand! Please wait a moment and try again.');
        return;
      }
      if (!res.ok) {
        setError(data.message || 'Something went wrong.');
        return;
      }

      setResult(data);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  const soldOut = stock !== null && stock <= 0;

  return (
    <div style={styles.wrap}>
      <div style={styles.stock}>{stock !== null ? Math.max(0, stock) : '—'}</div>
      <div style={styles.stockLabel}>early-access slots remaining</div>

      {result ? (
        <div style={styles.success}>
          <div style={{ fontSize: '1.4rem' }}>🎉 Slot reserved!</div>
          <div style={{ fontSize: '.85rem', marginTop: '.5rem', opacity: .8 }}>
            Reservation ID: <code style={{ background: 'rgba(0,0,0,.3)', padding: '2px 6px', borderRadius: '4px' }}>{result.reservationId}</code>
          </div>
          <div style={{ fontSize: '.8rem', marginTop: '.4rem', opacity: .7 }}>
            Confirmation email on its way.
          </div>
        </div>
      ) : soldOut ? (
        <div style={styles.soldOut}>😬 Sold out — all slots are gone.</div>
      ) : !isActive ? (
        <p style={{ color: 'var(--muted)', marginTop: '1rem', fontSize: '.9rem' }}>
          Flash sale opens at launch. Stay tuned!
        </p>
      ) : (
        <form style={styles.form} onSubmit={handleBuy}>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.btn, opacity: loading ? .6 : 1 }}
            onMouseEnter={e => { if (!loading) e.target.style.opacity = '.85'; }}
            onMouseLeave={e => { e.target.style.opacity = loading ? '.6' : '1'; }}
          >
            {loading ? 'Reserving...' : '⚡ Claim My Slot →'}
          </button>
          {error && <p style={styles.error}>{error}</p>}
        </form>
      )}
    </div>
  );
}
