# PostgREST schema cache & `.order()` audit

A reference for two related Supabase pain points we've hit on this project:

1. **Stale PostgREST schema cache** — REST API returns 404 / "could not find the table" for tables that exist, or query plans get out of sync with the actual schema and time out (57014).
2. **Multi-column `.order()` calls** — some Supabase queries chain `.order('a').order('b')` against tables without a covering index, which forces an in-memory sort and can hit `statement_timeout` on tables of any meaningful size.

---

## Part 1 — PostgREST schema cache

### What it is

Supabase's REST API (PostgREST) keeps a cached snapshot of your DB schema (tables, columns, constraints, RLS policies, function signatures). When you run a query like `from('clf_poems').select('*')`, PostgREST resolves it against this cache, not the live DB.

The cache is loaded at PostgREST startup and refreshed when PostgREST receives a `NOTIFY` on the `pgrst` channel.

### When it goes stale

- **You ran a migration that added a table, column, function, or RLS policy.** PostgREST still believes the old schema.
- **You manually edited the schema via the Supabase dashboard** (not via a migration). Same effect.
- **The DB itself was restarted but PostgREST wasn't restarted alongside it,** or vice versa.

### Symptoms

| Symptom | What it means |
|---|---|
| `404 not found` / `relation "public.X" does not exist` on a table that you just created | PostgREST hasn't seen the new table yet |
| `column "X" does not exist` after you added the column | PostgREST hasn't seen the new column |
| Function signature mismatch on `.rpc(...)` | PostgREST cached the old function args |
| **`500` + Postgres error code `57014` (statement timeout)** on a query that runs in milliseconds in the SQL editor | PostgREST is generating a worse-than-necessary query plan based on the stale schema, often falling back to a sort or seq scan |

The third row is the one we hit on `clf_chengyu` and `clf_poems`.

### Fix — the one-line reload

In the Supabase dashboard → **SQL editor** → New query:

```sql
notify pgrst, 'reload schema';
```

Click Run. PostgREST listens on that channel and refreshes within ~1 second. No downtime, no project restart, no client reconnect.

### Heavier alternatives (only when notify doesn't work)

If `notify pgrst, 'reload schema';` doesn't resolve the issue (rare):

- **Restart PostgREST**: Dashboard → Project Settings → API → "Restart server" (~30s of API downtime; existing connections drop).
- **Reload schema config**: `select pgrst_watch();` — only on self-hosted Supabase, not on the managed service.

### Verification

After running the notify, verify two ways:

**1. SQL editor** — should immediately succeed:
```sql
select count(*) from <new_table>;
```

**2. REST API** — should immediately stop returning 404 / 500:
```bash
# Replace with your URL + anon key
curl -s -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  "$VITE_SUPABASE_URL/rest/v1/<new_table>?select=*&limit=1"
# Should return [] (empty array — no rows yet, but the table is visible)
# Or rows if there's data.
# Should NOT return {"code":"PGRST205","message":"Could not find the table..."}
```

**3. The browser app** — hard-reload (`Ctrl+Shift+R`) once, since the previous failure may be cached. The query that was 500-ing should now succeed.

If you're still seeing the old error after the notify + hard-reload, the issue isn't a stale schema cache — it's something else (missing index, RLS policy, real timeout). Move on to Part 2.

### When to run it

- **Always after applying a migration** that adds/changes tables, columns, functions, or RLS policies. Stick `notify pgrst, 'reload schema';` at the bottom of every migration as a habit.
- **After any manual schema edit** in the Supabase dashboard.

---

## Part 2 — `.order()` audit

PostgREST honors `.order()` chains by appending `?order=col1.dir,col2.dir` to the URL, which Postgres interprets as `ORDER BY col1 dir, col2 dir`. **Without a covering composite index, a multi-column order on a large table triggers an in-memory sort.** Combined with Postgres's default `statement_timeout` (10s on Supabase free tier), that hits `57014` and surfaces as an HTTP 500.

### The audit

Found by `grep '\.order(' src/`:

#### Multi-column orders (composite-index candidates)

| File:line | Table | Order columns | Risk |
|---|---|---|---|
| `src/poetry/PoetryApp.jsx:553` | `clf_poems` | `difficulty, sort_order` | **HIGH** — user has reported 500s on this table |
| `src/clf/modules/CharactersModule.jsx:336` | `clf_characters` (or similar) | `hsk_level, sort_order` | MED — likely large, no LIMIT given before .limit(200) at end |
| `src/grammar/GrammarHomeScreen.jsx:33-34` | grammar topics | `level, order_idx` | LOW — topics list usually small |
| `src/hooks/useCharacters.js:226-227` | characters | `set_id, difficulty` | MED — `.limit(1000)` mitigates |
| `src/parent/pages/NoticesPage.jsx:20-21` | `clf_notices` | `pinned, created_at` | MED — class-scoped via `.in('class_id', ids)` |
| `src/student/pages/NoticesPage.jsx:21-22` | `clf_notices` | `pinned, created_at` | MED — same |
| `src/school-master/pages/NoticesPage.jsx:12-13` | `clf_notices` | `pinned, created_at` | MED |
| `src/teacher/pages/NoticesPage.jsx:19-20` | `clf_notices` | `pinned, created_at` | LOW — also `.eq('teacher_id', user.id)` |
| `src/admin/AIConfigTab.jsx:19` | `clf_ai_provider_config` | `feature, is_default` | LOW — small config table |
| `src/admin/AdminAppV2.jsx:391-392` | `clf_user_profiles` | `role, name` | MED — full user list can be 1000s |

#### Single-column orders on tables we've seen 500 on

| File:line | Table | Order | Notes |
|---|---|---|---|
| `src/chengyu/ChengyuApp.jsx:80` | `clf_chengyu` | `hsk_level` | Single column, but `.select('*').eq('active', true)` — if there's no index on `(active, hsk_level)` and the table is large, this still sorts in-memory |

#### Likely bug — comma-separated column string

| File:line | Issue |
|---|---|
| `src/admin/WordsAdminTab.jsx:408` | `.order('theme,hsk_level')` — passes a comma-separated string as a single column name. The Supabase JS client serializes this as `?order=theme%2Chsk_level.asc`. Postgres tries to find a column literally named `theme,hsk_level`, fails. Should be `.order('theme').order('hsk_level')` instead. |

### Recommended fixes (in priority order)

**1. Add composite indexes** for the high-risk queries. Indexes are cheap; the read-side cost of sort-no-index on a 100k-row table is far worse than the write-side cost of maintaining an extra index. SQL to add:

```sql
-- clf_poems — fixes the reported 500 on PoetryApp
create index if not exists idx_clf_poems_difficulty_sort
  on public.clf_poems (difficulty, sort_order)
  where active = true;

-- clf_chengyu — fixes the reported 500 on ChengyuApp
create index if not exists idx_clf_chengyu_active_hsk
  on public.clf_chengyu (active, hsk_level);

-- clf_notices — all four NoticesPage callers hit it
create index if not exists idx_clf_notices_class_pinned_created
  on public.clf_notices (class_id, pinned desc, created_at desc);

-- clf_characters — CharactersModule + useCharacters
create index if not exists idx_clf_characters_hsk_sort
  on public.clf_characters (hsk_level, sort_order);

-- clf_user_profiles — admin user list
create index if not exists idx_clf_user_profiles_role_name
  on public.clf_user_profiles (role, name);
```

After applying these, run `notify pgrst, 'reload schema';` so PostgREST picks up the new indexes in its plan.

**2. Fix the WordsAdminTab bug** — one-line code change:

```diff
- const { data } = await supabase.from('jgw_words').select('*').order('theme,hsk_level');
+ const { data } = await supabase.from('jgw_words').select('*').order('theme').order('hsk_level');
```

**3. Add `.limit()` to queries that don't have one.** Several of the multi-column queries have no limit (`grammar/GrammarHomeScreen.jsx`, `parent/pages/NoticesPage.jsx`, etc.). Even with an index, an unbounded query against a growing table will eventually slow down. Cap at something reasonable for the UI (e.g. `.limit(100)`).

**4. Consider simplifying `.order('pinned').order('created_at')` to `.order('created_at')`** on the four NoticesPage callers, then handle pinning client-side. Cuts the composite index requirement. Trade-off: more rows shipped to the client. Worth it only if notices table grows huge.

### How to verify a fix worked

After applying an index migration:

```sql
-- 1. Reload PostgREST so it picks up the new index
notify pgrst, 'reload schema';

-- 2. Use EXPLAIN to confirm the index is being used
explain
select * from clf_poems
where active = true
order by difficulty, sort_order
limit 100;
```

You want to see `Index Scan using idx_clf_poems_difficulty_sort` in the plan. If you see `Seq Scan` or `Sort` at the top, the index isn't being picked — check column types, NULL handling, and whether the index's `WHERE active = true` clause matches the query's filter.

```bash
# 3. Hit the REST endpoint and time it
time curl -s -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  "$VITE_SUPABASE_URL/rest/v1/clf_poems?select=*&active=eq.true&order=difficulty.asc,sort_order.asc&limit=100" \
  > /dev/null
# Should be sub-200ms even on a slow connection.
```

---

## Why we hit both at once

The schema cache and the `.order()` issues compound:

1. A migration adds a new column or index.
2. PostgREST cache hasn't been reloaded, so it doesn't know the new index exists.
3. The query plan PostgREST generates skips the index → falls back to in-memory sort.
4. The sort takes longer than `statement_timeout` → 500.
5. SQL editor runs the same query *with a fresh plan* and uses the index → fast.

The diagnosis "fast in SQL editor, slow via REST" almost always points here. Run the notify first.
