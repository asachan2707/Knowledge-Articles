import React from 'react';

export function LiveStats({ viewers, waitlistCount, connected }) {
  const dot = {
    width:        '8px',
    height:       '8px',
    borderRadius: '50%',
    background:   connected ? '#22c55e' : '#ef4444',
    display:      'inline-block',
    marginRight:  '5px',
    boxShadow:    connected ? '0 0 6px #22c55e' : 'none',
    animation:    connected ? 'pulse 2s infinite' : 'none',
  };

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
      `}</style>
      <div style={{
        display:        'flex',
        gap:            '1.5rem',
        justifyContent: 'center',
        flexWrap:       'wrap',
        marginTop:      '1.25rem',
        fontSize:       '.85rem',
        color:          'var(--muted)',
      }}>
        <span>
          <span style={dot} />
          {connected ? 'Live' : 'Connecting...'}
        </span>
        {viewers > 0 && (
          <span>
            👁 <strong style={{ color: 'var(--text)' }}>{viewers.toLocaleString()}</strong> watching
          </span>
        )}
        {waitlistCount > 0 && (
          <span>
            🔖 <strong style={{ color: 'var(--text)' }}>{waitlistCount.toLocaleString()}</strong> on waitlist
          </span>
        )}
      </div>
    </>
  );
}
