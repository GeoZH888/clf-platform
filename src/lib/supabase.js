import { createClient } from '@supabase/supabase-js';
import { cookieStorage } from './cookieStorage.js';

// THE canonical Supabase client. Every other file MUST import `supabase`
// from this module — do not call createClient() elsewhere. Multiple clients
// against the same URL produce "Multiple GoTrueClient instances" warnings
// and cause session mismatches (one client signs in, another doesn't see it).
//
// Session storage uses cookies scoped to .david-zhongwen.net so a login on
// david-zhongwen.net is visible to feiyi.david-zhongwen.net. See
// docs/cross-subdomain-auth.md and src/lib/cookieStorage.js.

// There is deliberately NO baked-in key here any more.
//
// A hardcoded anon key is not a secret — it is public by design and RLS is what
// protects the data — but as a *fallback* it is a trap. Rotating the project's
// keys leaves this copy behind, and because the fallback only engages when the
// environment looks wrong, the app quietly carries on with a key that no longer
// works: every call comes back "Invalid API key" and nothing says why. A stale
// value that looks plausible is worse than no value at all.
//
// So the configuration is now required, and a missing or mismatched one says so
// on screen instead of failing somewhere further in.

// IMPORTANT: a plain `import.meta.env.VITE_SUPABASE_URL || fallback` only
// catches empty/undefined. A *malformed-but-truthy* value (e.g. a Netlify
// env var pasted without `https://`, or with stray quotes/whitespace) slips
// past `||` and makes createClient() throw "Invalid supabaseUrl", which crashes
// the entire app at import time (blank white screen). Validate, then fall back.
function validUrl(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().replace(/^["']+|["']+$/g, ''); // strip wrapping quotes/space
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' || u.protocol === 'http:') return v;
  } catch { /* not a parseable URL */ }
  return null;
}

// The project ref is the subdomain: https://<ref>.supabase.co
function projectRef(url) {
  try { return new URL(url).hostname.split('.')[0] || null; }
  catch { return null; }
}

// The anon key is a JWT whose payload carries { ref: "<project>" }. A wrong or
// truncated key is still a non-empty string, so it would sail past a `|| key`
// guard and Supabase then rejects every call with "Invalid API key". Decode the
// JWT and confirm it actually belongs to the same project as the URL; otherwise
// the env key is untrustworthy and we use the matching fallback. This keeps the
// URL and key a consistent pair no matter what a build injects.
function keyMatchesRef(key, ref) {
  if (typeof key !== 'string' || !ref) return false;
  const parts = key.trim().split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.ref === ref;
  } catch { return false; }
}

// A blank page tells whoever is looking at it nothing. If the build shipped
// without usable credentials, say exactly which variable is wrong and where to
// set it — the import below throws immediately afterwards, so this is the last
// chance to put something readable on screen.
function fatalConfig(problem) {
  const msg =
    `Supabase configuration problem: ${problem}\n\n` +
    `Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Netlify site's ` +
    `environment variables (Site configuration → Environment variables), then redeploy. ` +
    `Both must belong to the same Supabase project.`;
  console.error('[supabase]', msg);
  try {
    const root = document.getElementById('root');
    if (root && !root.childElementCount) {
      root.innerHTML =
        '<div style="font:14px/1.7 system-ui,sans-serif;max-width:34rem;margin:12vh auto;' +
        'padding:1.5rem;border:1px solid #e8d5b0;border-radius:12px;background:#fdf6e3;color:#6b4c2a">' +
        '<div style="font-size:1.1rem;font-weight:700;color:#8B4513;margin-bottom:.5rem">' +
        '配置错误 · Configuration error</div>' +
        '<pre style="white-space:pre-wrap;margin:0;font:inherit">' +
        msg.replace(/[<&]/g, c => (c === '<' ? '&lt;' : '&amp;')) + '</pre></div>';
    }
  } catch { /* no DOM (SSR, a worker) — the console line is all we can do */ }
  throw new Error(msg);
}

// Single shared project for BOTH deployments (teaching + allinone). The
// VITE_APP_MODE split only changes the UI/routing per site, not the database —
// one user base, role-based access via RLS. See appMode.js.
const supabaseUrl = validUrl(import.meta.env.VITE_SUPABASE_URL);
if (!supabaseUrl) {
  fatalConfig('VITE_SUPABASE_URL is missing or is not a valid https URL.');
}

// The key must belong to the same project as the URL. A key from another
// project, or a truncated one, is still a non-empty string and would sail past
// a simple presence check — then every request fails with "Invalid API key"
// and the cause is invisible.
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
if (!envKey) {
  fatalConfig('VITE_SUPABASE_ANON_KEY is not set.');
}
if (!keyMatchesRef(envKey, projectRef(supabaseUrl))) {
  fatalConfig(
    `VITE_SUPABASE_ANON_KEY does not belong to the project in VITE_SUPABASE_URL ` +
    `(${projectRef(supabaseUrl)}). After rotating keys, update BOTH variables together.`
  );
}
const supabaseKey = envKey;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: cookieStorage,
    // Both clf-platform and the feiyi app must use this exact storage key
    // for cross-subdomain session sharing to work.
    storageKey: 'sb-david-zhongwen-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Expose for DevTools debugging. Some legacy auth flows used to set this in
// AuthContext; keeping it here so the affordance survives the consolidation.
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
