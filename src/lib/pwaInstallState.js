// src/lib/pwaInstallState.js
//
// Whether we may still ask this person to install the app. Ask once; never
// nag.
//
// The two nudges used to disagree. The banner stored its dismissal in
// localStorage, but the card used sessionStorage — which is cleared when the
// browser closes, so the card came back on every new session no matter how
// many times it had been waved away.
//
// Neither noticed an actual install either. `display-mode: standalone` is only
// true inside the installed window, so someone who installed the app and later
// opened the site in an ordinary tab was asked to install it again.

const KEY = 'pwa_install_v1';      // 'installed' | 'dismissed'
const LEGACY_DISMISSED = 'pwa_dismissed';   // what the banner used to write

function read() {
  try {
    const v = localStorage.getItem(KEY);
    if (v) return v;
    // Someone who already said no should not be asked again just because the
    // storage key changed.
    if (localStorage.getItem(LEGACY_DISMISSED)) return 'dismissed';
    return null;
  } catch { return null; }
}

function write(v) {
  try { localStorage.setItem(KEY, v); } catch { /* private mode */ }
}

/** True when running inside the installed app window. */
export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  } catch { return false; }
}

export function markInstalled() { write('installed'); }
export function markDismissed() { write('dismissed'); }

/**
 * The single question both nudges should ask.
 * False once the app is installed, once we are running inside it, or once the
 * person has declined.
 */
export function canPromptInstall() {
  if (isStandalone()) return false;
  return read() === null;
}

// `appinstalled` fires on Chromium once the install completes — including
// installs started from the browser's own menu rather than from our button.
// Recording it here is what stops the nudge reappearing in a normal tab.
// iOS Safari never fires it, so there the dismissal is the only signal, which
// is why the iOS path marks dismissed when the instructions are shown.
if (typeof window !== 'undefined') {
  window.addEventListener('appinstalled', () => markInstalled());
}
