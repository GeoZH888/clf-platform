# Phase 1.1 — Feiyi public routing decision

> Decision doc. No code yet — Phase 2.A implements.

## Current state (from audit)

- **Routing already bypasses auth.** `App.jsx:95,580` — `/feiyi/*` is checked at the top-level route cascade BEFORE LoginGate. HeritageApp mounts directly, no auth required to reach it.
- **HeritageApp is a static placeholder.** `src/heritage/HeritageApp.jsx:7-16` defines four hardcoded categories (folklore, opera, crafts, festivals). Clicking any tile shows an alert: `"内容建设中…"`. No DB queries.
- **The CommunityHome feiyi card mirrors this.** `CommunityHome.jsx:60-73,514,669` — same four categories, same placeholder alert.
- **tangka-2026june is a proxy** to `https://feiyi.david-zhongwen.net/mostra/tangka-2026june/` via `netlify.toml:59-62`. That upstream is a separate site, public from David Chinese's side.
- **No `clf_feiyi_*` content tables exist** in any migration in this repo. There's a `heritage` *module* row in `clf_modules` flagged `is_public = true` (per `supabase_migrations/phase_a_tiers.sql:82`), but no content storage.

## Decision

**Two layers, both required:**

### Layer 1 — Client-side: leave the bypass as-is

Already done. App.jsx routes `/feiyi/*` → HeritageApp without touching LoginGate. Don't change this — it's correct.

What to verify in Phase 2.A: hard-load `/feiyi/folklore` in an incognito browser. The page must render without a login redirect. If it does, we're good. If LoginGate has been altered to require auth more aggressively, fix the route check ordering in `App.jsx`.

### Layer 2 — Server-side: anon SELECT on every feiyi content table

When real feiyi content is added (not in Phase 1 — Phase 2.A or later), every table backing feiyi pages must have RLS allowing anonymous reads:

```sql
alter table public.clf_feiyi_<topic> enable row level security;
create policy "anon read public feiyi" on public.clf_feiyi_<topic>
  for select to anon, authenticated using (true);
```

The `to anon, authenticated` clause is critical — without it, only logged-in users can read, defeating the whole point.

**WRITE policies stay restrictive** — only super_admin can edit feiyi content. Treat feiyi tables like a CMS: public read, super-admin write, no exceptions.

## What Phase 2.A actually delivers

1. **Migration `006_feiyi_content_tables.sql`** — defines whatever feiyi content schema we decide (the right shape depends on what content we want to ship; likely an article-style table with title/body/lang/category fields).
2. **Update HeritageApp** to query the new tables instead of rendering hardcoded categories.
3. **RLS policies** per Layer 2 above.
4. **Verify with curl** as an anon (no auth):
   ```bash
   curl -s -H "apikey: $VITE_SUPABASE_ANON_KEY" \
     "$VITE_SUPABASE_URL/rest/v1/clf_feiyi_articles?select=title&limit=1"
   # → should return rows (or empty array if no content yet), NOT 401
   ```

## Risks

1. **The CommunityHome feiyi card opens an alert,** not a navigation. Phase 2.A should change `FeiyiTile`'s onClick to `window.location.href = '/feiyi/<slug>'` instead of `alert(...)`. Small change, `CommunityHome.jsx:669`.
2. **Anyone can scrape** the feiyi REST endpoints once public. Acceptable — it's *intended* to be public, akin to a Wikipedia article. Just be aware.
3. **No rate limiting on anon reads.** Supabase free/pro tier has org-level rate limits but not per-IP for anon. Heavy traffic could be a cost issue. Phase 2.A or later may want a CDN cache layer in front of the feiyi REST endpoints.

## Out of scope for Phase 1

Designing the actual feiyi content schema (what fields? markdown? rich text? trilingual columns? translation table?). That's a Phase 2.A design call, after a stakeholder conversation about what content actually goes there.
