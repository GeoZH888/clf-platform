# Cross-subdomain Supabase auth (david-zhongwen.net ↔ feiyi.david-zhongwen.net)

> Hand this doc to whoever maintains the feiyi app. Both apps must agree on the cookie storage adapter for session sharing to work.

## What this enables

A user logged in on `david-zhongwen.net` is **also logged in** on `feiyi.david-zhongwen.net` without having to authenticate again — and vice versa. Their session, role, tier, and credits are all the same identity.

## Why localStorage doesn't work

Supabase JS client's default session storage is `localStorage`, which is **origin-bound**. `david-zhongwen.net` and `feiyi.david-zhongwen.net` are different origins, so they can't see each other's localStorage. Logging in on one site does not log you in on the other.

## The fix — cookies on the parent domain

Cookies with `domain=.david-zhongwen.net` are sent to **every subdomain** of `david-zhongwen.net`. That's what lets the session travel.

## What both apps must do

**Both `clf-platform` and the feiyi app** must:

1. Use this storage adapter (`src/lib/cookieStorage.js` in clf-platform):

```js
// Copy this adapter into the feiyi app's src/lib/cookieStorage.js verbatim.
// Identical implementation required — both apps read and write the same cookie.

const COOKIE_DOMAIN = (typeof window !== 'undefined'
  && window.location.hostname.endsWith('david-zhongwen.net'))
  ? '.david-zhongwen.net'
  : null;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function buildAttrs() {
  const parts = ['path=/', 'samesite=lax'];
  if (COOKIE_DOMAIN) {
    parts.push(`domain=${COOKIE_DOMAIN}`);
    parts.push('secure');
  }
  return parts.join('; ');
}

export const cookieStorage = {
  getItem(key) {
    if (typeof document === 'undefined') return null;
    const target = encodeURIComponent(key) + '=';
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
    document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE_SECONDS}; ${buildAttrs()}`;
  },
  removeItem(key) {
    if (typeof document === 'undefined') return;
    document.cookie = `${encodeURIComponent(key)}=; max-age=0; ${buildAttrs()}`;
  },
};
```

2. Pass it to `createClient` with **the exact same storageKey**:

```js
import { createClient } from '@supabase/supabase-js';
import { cookieStorage } from './cookieStorage.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: cookieStorage,
    storageKey: 'sb-david-zhongwen-auth',    // ← MUST match clf-platform
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
```

3. Point at the **same Supabase project** (same `SUPABASE_URL`, same `SUPABASE_ANON_KEY`).

That's it. Once both apps deploy with this, the session shares.

## Why these specific options

| Option | Why |
|---|---|
| `domain=.david-zhongwen.net` | Sends cookie to every subdomain |
| `samesite=lax` | Allows cookie on top-level navigation between subdomains (clicking a link), blocks cross-site embed exploits |
| `secure` | Cookie only sent over HTTPS — both david-zhongwen.net and feiyi.david-zhongwen.net are HTTPS in production |
| `max-age=31536000` (1 year) | Long-lived; Supabase's refresh-token rotation re-issues anyway. Avoids forcing re-login on long-idle users. |
| `storageKey: 'sb-david-zhongwen-auth'` | Both apps must use the same key — that's the cookie name they both read |
| `path=/` | Available to all routes on both subdomains |

## Migration of existing sessions

Users currently logged in via localStorage will **not** be auto-migrated. On first visit after the deploy:

- The Supabase client reads from cookieStorage (empty for them)
- No active session detected → they're treated as logged-out
- They re-login → new session written to cookie → cross-subdomain works going forward

The old localStorage entries are harmless dead data. They could be swept by a one-time cleanup script on app load:

```js
// Optional, in src/lib/supabase.js after createClient — runs once on app load
try {
  // Clean up legacy localStorage keys from before cookie auth landed
  localStorage.removeItem('supabase.auth.token');
  localStorage.removeItem('sb-' + new URL(supabaseUrl).hostname.split('.')[0] + '-auth-token');
} catch {}
```

I don't ship this cleanup in the cookie-domain branch — most apps don't bother. The orphaned keys cost nothing.

## How to verify it works

After both apps are deployed:

1. **Log in on `david-zhongwen.net`** as any user.
2. Open DevTools → Application → Cookies → `david-zhongwen.net`. Find `sb-david-zhongwen-auth`. Confirm `Domain` column shows `.david-zhongwen.net` (note the leading dot).
3. Navigate to `https://feiyi.david-zhongwen.net/` in the **same browser tab**.
4. Open DevTools console on the feiyi side. Run:
   ```js
   const { data: { session } } = await supabase.auth.getSession();
   console.log(session?.user?.email);
   ```
5. Should print your email. If `null`, something's off — check the cookie's Domain attribute on both subdomains.

## Common pitfalls

- **Leading dot.** `domain=david-zhongwen.net` (no dot) is treated by most browsers as `domain=.david-zhongwen.net` but some legacy contexts differ. We set `.david-zhongwen.net` explicitly for safety.
- **Path mismatch.** If one app sets `path=/feiyi` and the other reads from `path=/`, the cookie won't be visible on `/`. Always use `path=/`.
- **HTTPS only.** `secure` cookies don't get set on `http://`. Local dev (localhost) skips the secure flag — handled in the adapter via the `COOKIE_DOMAIN` check.
- **storageKey drift.** If the two apps use different `storageKey` values (e.g. one defaults to `sb-yqcojudvvjntaajnrilr-auth-token` from the Supabase URL hash, the other uses `sb-david-zhongwen-auth`), they're reading different cookies and won't share.
- **Browser cookie size limits.** Supabase sessions are typically ~2–3KB which fits comfortably under the 4KB-per-cookie limit. If it ever overflows, switch to `@supabase/ssr`'s cookie-chunking adapter instead.

## What this does NOT do

- Doesn't share storage like IndexedDB or localStorage between subdomains (those stay origin-bound)
- Doesn't share React state — each app has its own component tree
- Doesn't enable cross-origin XHR — REST calls to Supabase still go from each app's origin directly to the Supabase API, with the JWT lifted from the cookie

## What to do if you need to log out everywhere

Calling `supabase.auth.signOut()` on either app removes the cookie (via the adapter's `removeItem`). Since both apps share the same cookie, the other app sees no session on its next read — effectively logged out everywhere.

If you ever need to force-logout a single user globally (e.g. for security incident response), the Supabase dashboard's "Revoke user session" admin action invalidates the JWT server-side, so even cached cookies stop working.
