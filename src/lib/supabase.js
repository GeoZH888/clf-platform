import { createClient } from '@supabase/supabase-js';
import { cookieStorage } from './cookieStorage.js';
import { IS_TEACHING } from './appMode.js';

// THE canonical Supabase client. Every other file MUST import `supabase`
// from this module — do not call createClient() elsewhere. Multiple clients
// against the same URL produce "Multiple GoTrueClient instances" warnings
// and cause session mismatches (one client signs in, another doesn't see it).
//
// Session storage uses cookies scoped to .david-zhongwen.net so a login on
// david-zhongwen.net is visible to feiyi.david-zhongwen.net. See
// docs/cross-subdomain-auth.md and src/lib/cookieStorage.js.

// Fallbacks point at the production project (anon key is public by design,
// RLS-protected — see netlify.toml).
const FALLBACK_URL = 'https://yqcojudvvjntaajnrilr.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxY29qdWR2dmpudGFham5yaWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNDkxNzQsImV4cCI6MjA5MDkyNTE3NH0.pJuxsTRieYTnZtEysOLcPfUZ9Map0z74o2lKtc8uGAk';

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

// Mode selects which project this deployment talks to (see appMode.js).
//   teaching → VITE_TEACHING_SUPABASE_*  (new project)
//   allinone → VITE_SUPABASE_*           (current project, the default)
// Teaching has no hardcoded fallback (project-specific, not in repo); if its
// env isn't set yet we fall back to the main project so the app never crashes
// at import — teaching mode just isn't functional until its key is provided.
const rawUrl = IS_TEACHING
  ? import.meta.env.VITE_TEACHING_SUPABASE_URL
  : import.meta.env.VITE_SUPABASE_URL;
const rawKey = IS_TEACHING
  ? import.meta.env.VITE_TEACHING_SUPABASE_ANON_KEY
  : import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseUrl = validUrl(rawUrl) || FALLBACK_URL;
if (IS_TEACHING && !validUrl(rawUrl)) {
  console.warn('[supabase] teaching mode but VITE_TEACHING_SUPABASE_URL is unset/invalid — falling back to the main project. Set the teaching env vars.');
}

// Prefer the env key when it matches the resolved project; else the main
// fallback (valid pair for the main project). keyMatchesRef guards against a
// wrong/truncated key being used (which would cause "Invalid API key").
const supabaseKey = keyMatchesRef(rawKey, projectRef(supabaseUrl))
  ? rawKey.trim()
  : FALLBACK_KEY;

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
