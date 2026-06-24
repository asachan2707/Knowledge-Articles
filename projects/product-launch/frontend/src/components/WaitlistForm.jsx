import React, { useState } from 'react';

const styles = {
  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '.85rem',
    width:         '100%',
    maxWidth:      '420px',
    margin:        '0 auto',
  },
  row: {
    display: 'flex',
    gap:     '.6rem',
    flexWrap: 'wrap',
  },
  btn: {
    background:   'var(--accent)',
    color:        '#fff',
    fontWeight:   700,
    fontSize:     '1rem',
    padding:      '.8rem 1.75rem',
    borderRadius: '8px',
    border:       'none',
    cursor:       'pointer',
    transition:   'background 150ms, opacity 150ms',
    whiteSpace:   'nowrap',
  },
  success: {
    background:   'rgba(34,197,94,.12)',
    border:       '1px solid rgba(34,197,94,.3)',
    borderRadius: 'var(--radius)',
    padding:      '1rem 1.25rem',
    color:        '#4ade80',
    textAlign:    'center',
    fontWeight:   600,
  },
  error: {
    color:      '#f87171',
    fontSize:   '.85rem',
    textAlign:  'center',
  },
};

export function WaitlistForm({ productId, onSuccess }) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [result,  setResult]  = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/products/${productId}/waitlist/join`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || 'Something went wrong.');
        return;
      }

      setResult(data);
      onSuccess?.(data);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div style={styles.success}>
        🎉 You're <strong>#{result.position}</strong> on the list!<br />
        <span style={{ fontSize: '.85rem', opacity: .8, marginTop: '.35rem', display: 'block' }}>
          Check your email for confirmation.
        </span>
      </div>
    );
  }

  return (
    <form style={styles.form} onSubmit={handleSubmit}>
      <div style={styles.row}>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={{ flex: 1, minWidth: '140px' }}
        />
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ flex: 2, minWidth: '180px' }}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        style={{ ...styles.btn, opacity: loading ? .6 : 1 }}
      >
        {loading ? 'Joining...' : 'Join the Waitlist →'}
      </button>
      {error && <p style={styles.error}>{error}</p>}
    </form>
  );
}
