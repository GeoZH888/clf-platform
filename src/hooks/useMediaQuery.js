// src/hooks/useMediaQuery.js
// Subscribe to a CSS media query from React. Used by inline-styled screens
// (CommunityHome, etc.) to adapt layout to phone widths without a CSS rewrite.
//
// Usage:
//   const isPhone = useMediaQuery('(max-width: 600px)');
//   <div style={{ padding: isPhone ? 16 : 28 }} />
//
// Convenience wrappers below cover the breakpoints this app uses.

import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const get = () =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(get);

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange(); // sync in case the query changed between render and effect
    // addEventListener('change') is supported everywhere we run; older Safari
    // used addListener — keep a fallback so nothing breaks on old iOS.
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
}

// ── Shared breakpoints ───────────────────────────────────────────────
// Phone: single-column, tight padding. Tablet-and-up gets the roomy layout.
export const usePhone  = () => useMediaQuery('(max-width: 600px)');
export const useTablet = () => useMediaQuery('(max-width: 900px)');

export default useMediaQuery;
