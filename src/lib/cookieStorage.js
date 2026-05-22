// src/lib/cookieStorage.js
// A Supabase Auth storage adapter that uses cookies scoped to the parent
// domain, so a session set on david-zhongwen.net is visible on
// feiyi.david-zhongwen.net (and any other subdomain).
//
// The default Supabase JS client stores sessions in localStorage, which is
// origin-bound — different subdomains can't see each other's sessions.
// Cookies with `domain=.david-zhongwen.net` solve this.
//
// Same-site setup contract:
//   - Both apps must use this storage adapter
//   - Both must use the same `storageKey` ('sb-david-zhongwen-auth')
//   - Both must point at the same Supabase project
//
// Security notes:
//   - Cookies are JS-readable (NOT HttpOnly). Equivalent XSS exposure to
//     localStorage. We need JS access because the Supabase client reads the
//     session to attach JWTs to API calls.
//   - secure + samesite=lax in production. samesite=lax allows top-level
//     cross-site navigations (regular link clicks between subdomains) to
//     send the cookie, which is what we need.
//   - In dev (localhost), domain is omitted and secure is off so the cookie
//     works without HTTPS.

const COOKIE_DOMAIN = (typeof window !== 'undefined'
  && window.location.hostname.endsWith('david-zhongwen.net'))
  ? '.david-zhongwen.net'
  : null; // localhost / preview-deploy / anywhere else → host-scoped cookie

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year; refresh-token rotation handles re-issue

function buildAttrs() {
  const parts = ['path=/', 'samesite=lax'];
  if (COOKIE_DOMAIN) {
    parts.push(`domain=${COOKIE_DOMAIN}`);
    parts.push('secure'); // required when samesite=none, recommended otherwise
  }
  return parts.join('; ');
}

export const cookieStorage = {
  getItem(key) {
    if (typeof document === 'undefined') return null;
    const target = encodeURIComponent(key) + '=';
    // document.cookie is a single string like "a=1; b=2" — split and find.
    for (const part of document.cookie.split('; ')) {
      if (part.startsWith(target)) {
        try { return decodeURIComponent(part.slice(target.length)); }
        catch { return part.slice(target.length); }
      }
    }
    return null;
  },

  setItem(key, value) {
    if (typeof document === 'undefined') return;
    const v = encodeURIComponent(value);
    document.cookie = `${encodeURIComponent(key)}=${v}; max-age=${COOKIE_MAX_AGE_SECONDS}; ${buildAttrs()}`;
  },

  removeItem(key) {
    if (typeof document === 'undefined') return;
    document.cookie = `${encodeURIComponent(key)}=; max-age=0; ${buildAttrs()}`;
  },
};
