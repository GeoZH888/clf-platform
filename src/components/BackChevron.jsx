// src/components/BackChevron.jsx
// Universal back button: fixed top-left chevron. Lives at App.jsx top level
// so it shows on every page except the public home (/community itself).
//
// Click behaviour: if the browser has prior in-app history, use history.back()
// so the user returns to the exact spot they came from (mid-scroll, etc).
// If there's no usable history (deep-linked landing, e.g. a QR scan straight
// into /learn?module=lianzi), fall back to a hard nav to /community.
import React, { useEffect, useState } from 'react';

export default function BackChevron() {
  // Re-read the path on each browser nav (popstate/hashchange) so the
  // chevron auto-hides when the user lands on the public home and
  // re-appears as they go deeper.
  const [path, setPath] = useState(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const onNav = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onNav);
    window.addEventListener('hashchange', onNav);
    return () => {
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('hashchange', onNav);
    };
  }, []);

  // Hide on the root community home — there's no useful place "back" goes.
  const isCommunityRoot =
    path === '/' || path === '/community' || path === '/community/';
  if (isCommunityRoot) return null;

  function onClick() {
    // history.length includes the initial entry, so > 1 means there's at
    // least one prior in-app step we can pop back to. Anything else (direct
    // landing, QR scan) falls back to a hard navigation to /community.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.replace('/community');
    }
  }

  return (
    <button onClick={onClick} aria-label="Back" style={{
      position: 'fixed',
      top: 'calc(8px + var(--safe-top, 0px))',
      left: 8,
      zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', color: '#fff5e6',
      border: '1px solid rgba(255,255,255,0.25)',
      width: 36, height: 36, borderRadius: 18, padding: 0,
      cursor: 'pointer', fontSize: 18, lineHeight: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
    }}>
      ‹
    </button>
  );
}
