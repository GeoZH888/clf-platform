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

//   - Values are CHUNKED. Browsers cap a single cookie at ~4096 bytes
//     including name and attributes, and silently drop anything larger — no
//     error, the write just does not happen. A Supabase session (access token +
//     refresh token + the whole user object with metadata) regularly lands
//     between 2 and 5 KB, so a session that fit on Monday can vanish on Tuesday
//     when a user gains one more metadata field. The symptom is the one users
//     report: signed out again on every visit. Splitting across `key.0`,
//     `key.1`, … keeps every individual cookie well under the cap.

const COOKIE_DOMAIN = (typeof window !== 'undefined'
  && window.location.hostname.endsWith('david-zhongwen.net'))
  ? '.david-zhongwen.net'
  : null; // localhost / preview-deploy / anywhere else → host-scoped cookie

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year; refresh-token rotation handles re-issue

// Encoded characters per cookie. 3000 leaves ample room for the name, the
// domain and the rest of the attributes inside the ~4096-byte budget.
const CHUNK_SIZE = 3000;

// Bounds the probe when reading or clearing chunks; 20 × 3000 is far more than
// any session, and stops a malformed cookie jar spinning forever.
const MAX_CHUNKS = 20;

const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

function buildAttrs() {
  const parts = ['path=/', 'samesite=lax'];
  if (COOKIE_DOMAIN) parts.push(`domain=${COOKIE_DOMAIN}`);
  // Secure belongs on every HTTPS origin, not only the shared-domain one.
  if (isHttps) parts.push('secure');
  return parts.join('; ');
}

function readRaw(name) {
  const target = encodeURIComponent(name) + '=';
  // document.cookie is a single string like "a=1; b=2" — split and find.
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(target)) return part.slice(target.length);
  }
  return null;
}

function writeRaw(name, encodedValue, maxAge) {
  document.cookie =
    `${encodeURIComponent(name)}=${encodedValue}; max-age=${maxAge}; ${buildAttrs()}`;
}

function clearChunks(key) {
  for (let i = 0; i < MAX_CHUNKS; i++) {
    if (readRaw(`${key}.${i}`) === null) break;
    writeRaw(`${key}.${i}`, '', 0);
  }
}

export const cookieStorage = {
  getItem(key) {
    if (typeof document === 'undefined') return null;

    const plain = readRaw(key);
    if (plain !== null && plain !== '') {
      try { return decodeURIComponent(plain); } catch { return plain; }
    }

    // Chunked write, or nothing at all.
    let joined = '';
    for (let i = 0; i < MAX_CHUNKS; i++) {
      const part = readRaw(`${key}.${i}`);
      if (part === null) break;
      joined += part;
    }
    if (!joined) return null;
    try { return decodeURIComponent(joined); } catch { return joined; }
  },

  setItem(key, value) {
    if (typeof document === 'undefined') return;
    const encoded = encodeURIComponent(value);

    if (encoded.length <= CHUNK_SIZE) {
      writeRaw(key, encoded, COOKIE_MAX_AGE_SECONDS);
      clearChunks(key);            // may have been chunked before it shrank
      return;
    }

    // Too big for one cookie — drop the single form so a stale copy can never
    // win the read, then lay it down in pieces.
    writeRaw(key, '', 0);
    let i = 0;
    for (let pos = 0; pos < encoded.length; pos += CHUNK_SIZE, i++) {
      writeRaw(`${key}.${i}`, encoded.slice(pos, pos + CHUNK_SIZE), COOKIE_MAX_AGE_SECONDS);
    }
    // Clear any leftovers from a previously longer value.
    for (; i < MAX_CHUNKS; i++) {
      if (readRaw(`${key}.${i}`) === null) break;
      writeRaw(`${key}.${i}`, '', 0);
    }
  },

  removeItem(key) {
    if (typeof document === 'undefined') return;
    writeRaw(key, '', 0);
    clearChunks(key);
  },
};
