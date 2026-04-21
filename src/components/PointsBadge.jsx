// src/components/PointsBadge.jsx
// Displays current points total + animated +N popup when points are earned
// Used in module headers and platform home

import { useState, useEffect, useRef } from 'react';

// ── Floating +N animation ─────────────────────────────────────────────────────
function PointsPopup({ delta, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'absolute', top: -28, left: '50%',
      transform: 'translateX(-50%)',
      background: '#FFD700', color: '#5D2E0C',
      borderRadius: 12, padding: '3px 10px',
      fontSize: 13, fontWeight: 700,
      pointerEvents: 'none', zIndex: 100,
      animation: 'floatUp 1.2s ease-out forwards',
    }}>
      +{delta}
      <style>{`
        @keyframes floatUp {
          0%   { opacity:1; transform:translateX(-50%) translateY(0); }
          100% { opacity:0; transform:translateX(-50%) translateY(-24px); }
        }
      `}</style>
    </div>
  );
}

// ── Main badge ────────────────────────────────────────────────────────────────
export default function PointsBadge({
  total = 0,
  delta = 0,          // pass a new delta to trigger +N animation
  size = 'normal',    // 'small' | 'normal' | 'large'
  color = '#8B4513',
  showIcon = true,
}) {
  const [popups, setPopups] = useState([]);
  const [displayTotal, setDisplayTotal] = useState(total);
  const prevTotal = useRef(total);
  const idRef = useRef(0);

  useEffect(() => {
    if (total !== prevTotal.current) {
      const gained = total - prevTotal.current;
      if (gained > 0) {
        const id = ++idRef.current;
        setPopups(prev => [...prev, { id, delta: gained }]);
      }
      prevTotal.current = total;
      // Animate count-up
      const start = displayTotal;
      const end   = total;
      const dur   = 600;
      const t0    = Date.now();
      function tick() {
        const p = Math.min(1, (Date.now() - t0) / dur);
        setDisplayTotal(Math.round(start + (end - start) * p));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  }, [total]);

  const fontSize = size === 'small' ? 12 : size === 'large' ? 18 : 14;
  const iconSize = size === 'small' ? 14 : size === 'large' ? 20 : 16;

  return (
    <div style={{ position: 'relative', display: 'inline-flex',
      alignItems: 'center', gap: 4 }}>

      {popups.map(p => (
        <PointsPopup key={p.id} delta={p.delta}
          onDone={() => setPopups(prev => prev.filter(x => x.id !== p.id))} />
      ))}

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: color + '15',
        border: `1px solid ${color}44`,
        borderRadius: 20, padding: '3px 10px',
      }}>
        {showIcon && <span style={{ fontSize: iconSize }}>⭐</span>}
        <span style={{ fontSize, fontWeight: 700, color, lineHeight: 1 }}>
          {displayTotal.toLocaleString()}
        </span>
        <span style={{ fontSize: fontSize - 2, color: color + 'aa' }}>
          {size !== 'small' ? '积分' : ''}
        </span>
      </div>
    </div>
  );
}
