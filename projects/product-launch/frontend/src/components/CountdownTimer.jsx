import React, { useState, useEffect } from 'react';

function pad(n) { return String(n).padStart(2, '0'); }

function calcRemaining(targetIso) {
  if (!targetIso) return null;
  const diff = new Date(targetIso) - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const total   = Math.floor(diff / 1000);
  const days    = Math.floor(total / 86400);
  const hours   = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds, done: false };
}

export function CountdownTimer({ launchAt, onExpire, compact = false }) {
  const [remaining, setRemaining] = useState(() => calcRemaining(launchAt));

  useEffect(() => {
    setRemaining(calcRemaining(launchAt));
    const id = setInterval(() => {
      const r = calcRemaining(launchAt);
      setRemaining(r);
      if (r?.done) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [launchAt]);

  if (!remaining) {
    return <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Launch date not set yet.</p>;
  }

  if (remaining.done) {
    return <p style={{ color: 'var(--success)', fontWeight: 700, fontSize: '1.1rem' }}>🚀 We're live!</p>;
  }

  const units = [
    { label: 'Days',    value: remaining.days    },
    { label: 'Hours',   value: remaining.hours   },
    { label: 'Minutes', value: remaining.minutes },
    { label: 'Seconds', value: remaining.seconds },
  ];

  if (compact) {
    const parts = units.filter(u => u.label !== 'Days' || u.value > 0);
    return (
      <div style={{ display: 'flex', gap: '.4rem', fontSize: '.78rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
        {parts.map(({ label, value }, i) => (
          <span key={label}>
            <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{pad(value)}</strong>
            <span style={{ fontSize: '.65rem', marginLeft: '2px', opacity: .7 }}>{label.slice(0, 1).toLowerCase()}</span>
            {i < parts.length - 1 && <span style={{ opacity: .3, marginLeft: '.4rem' }}>:</span>}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
      {units.map(({ label, value }) => (
        <div key={label} style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          background:    'rgba(255,255,255,.04)',
          border:        '1px solid var(--border)',
          borderRadius:  'var(--radius)',
          padding:       '.75rem 1.25rem',
          minWidth:      '70px',
        }}>
          <span style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1 }}>
            {pad(value)}
          </span>
          <span style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.3rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
