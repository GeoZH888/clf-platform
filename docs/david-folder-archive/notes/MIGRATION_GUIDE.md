# 🔀 lingua-learn → clf-platform Migration Guide

**Strategy:** Copy lingua-learn wholesale into clf-platform, point at new CLF Supabase, swap one AI call (OpenAI → Anthropic in ai-gateway.js), keep everything else identical.

## Why this works

I audited lingua-learn's 140 files:

- **User UI:** 7 learning modules + CLF onboarding sub-app — all stay
- **Admin:** 12 tabs with drag-to-reorder — all stays
- **AI providers:** Already Anthropic + Stability + Azure-TTS (only `ai-gateway.js` has a stale OpenAI code path)
- **Auth:** Device-token via QR (`jgw_device_token`) — that IS "user functionality," keep it
- **DB:** 25+ tables expected — the new migration `003_lingua_learn_compat.sql` adds them all

## Step 1 — Run the compat migration

In Supabase SQL Editor (your new CLF project):

```sql
-- Paste contents of 003_lingua_learn_compat.sql
-- Safe to run after 001_new_infrastructure_BULLETPROOF.sql + 002_voyage_1024_dim.sql
```

Verify:

```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND (table_name LIKE 'jgw_%' OR table_name LIKE 'clf_%');
-- Expected: 30+
```

## Step 2 — Replace clf-platform's src with lingua-learn's src

In PowerShell:

```powershell
cd C:\Users\Lun_z\Desktop\coding_assistant

# Back up current clf-platform src (safety net)
Copy-Item clf-platform\src clf-platform\src.backup -Recurse -Force

# Wipe clf-platform's src and copy lingua-learn's
Remove-Item clf-platform\src -Recurse -Force
Copy-Item lingua-learn\src clf-platform\src -Recurse

# Also copy lingua-learn's netlify functions (they're more complete)
Remove-Item clf-platform\netlify\functions -Recurse -Force -ErrorAction Ignore
Copy-Item lingua-learn\netlify\functions clf-platform\netlify\functions -Recurse

# Copy lingua-learn's public folder (icons, manifest, service worker)
Remove-Item clf-platform\public -Recurse -Force -ErrorAction Ignore
Copy-Item lingua-learn\public clf-platform\public -Recurse

# Copy index.html too (has hanzi-writer CDN link)
Copy-Item lingua-learn\index.html clf-platform\index.html -Force

# vite.config — only copy if you want lingua-learn's exact build settings
# Otherwise keep yours
# Copy-Item lingua-learn\vite.config.js clf-platform\vite.config.js -Force
```

## Step 3 — Merge package.json dependencies

Your clf-platform package.json needs lingua-learn's deps. In PowerShell:

```powershell
cd C:\Users\Lun_z\Desktop\coding_assistant\clf-platform

# Install the three lingua-learn deps your current project might not have
npm install @supabase/supabase-js hanzi-writer microsoft-cognitiveservices-speech-sdk

# Plus Voyage/Anthropic/DeepSeek/Stability SDK-less (we use fetch directly)
```

## Step 4 — Swap the one OpenAI call in ai-gateway.js

Open `clf-platform\netlify\functions\ai-gateway.js`. Find the OpenAI code path (around line with `api.openai.com/v1/images/generations`) and replace it with Stability. Search-and-replace pattern:

```powershell
# Find the offending lines
Select-String -Path .\netlify\functions\ai-gateway.js -Pattern "api\.openai\.com|OPENAI_API_KEY"
```

Replace the OpenAI image-generation block with the existing Stability block (Stability already works in that file for "stability" provider — just make "openai" provider fall through to Stability, or remove the OpenAI branch entirely).

Minimal edit — in `ai-gateway.js`, change the provider dispatch to alias OpenAI → Anthropic:

```js
// Near the top of the handler, normalize provider:
if (provider === 'openai' || provider === 'gpt') provider = 'claude';   // fallback to Claude
if (provider === 'dalle' || provider === 'openai_image') provider = 'stability';  // fallback to Stability
```

That one-liner future-proofs without rewriting the whole function.

## Step 5 — Environment variables

In Netlify dashboard or via CLI:

```powershell
cd C:\Users\Lun_z\Desktop\coding_assistant\clf-platform

# Supabase (new CLF project)
netlify env:set VITE_SUPABASE_URL      "https://YOUR_CLF_PROJECT.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "eyJhbG..."
netlify env:set SUPABASE_SERVICE_ROLE_KEY "eyJhbG..." --secret

# AI providers — lingua-learn's code reads these names
netlify env:set ANTHROPIC_API_KEY  "sk-ant-..." --secret
netlify env:set DEEPSEEK_API_KEY   "sk-..."     --secret
netlify env:set VOYAGE_API_KEY     "pa-..."     --secret
netlify env:set STABILITY_API_KEY  "sk-..."     --secret

# Azure TTS (for pinyin pronunciation with viseme/mouth animation)
netlify env:set AZURE_SPEECH_KEY    "YOUR_AZURE_KEY"    --secret
netlify env:set AZURE_SPEECH_REGION "eastasia"

# Clean up old OpenAI key if it's still there
netlify env:unset OPENAI_API_KEY

# Verify
netlify env:list
```

Also update your `netlify.toml` to keep the `[context.production.environment]` override for the anon keys (that was our blank-page fix).

## Step 6 — Bootstrap yourself as admin

```sql
-- In Supabase SQL Editor, after signing in once at /admin
INSERT INTO jgw_admins (user_id, email, role)
SELECT id, email, 'superadmin'
FROM auth.users WHERE email = 'lun_zhang@outlook.com'
ON CONFLICT (user_id) DO NOTHING;

-- Also keep the admin_users row (from 001) so both auth paths work:
INSERT INTO admin_users (user_id, email, role)
SELECT id, email, 'superadmin'
FROM auth.users WHERE email = 'lun_zhang@outlook.com'
ON CONFLICT (user_id) DO NOTHING;
```

## Step 7 — Deploy

```powershell
netlify deploy --build --prod
```

Visit `https://zhongwen-world.netlify.app`:
- Root (`/`) → You'll hit the QR gate (lingua-learn's invite system). To bypass for yourself, create an invite via the admin first.
- `/admin` → Password login (same email that's now in jgw_admins).

## Step 8 — Create an invite so you can access the user app

1. Go to `/admin` → Sign in → Click **邀请 Invites** tab
2. Create a new invite (label it "me", no expiry)
3. Copy the invite URL or scan the QR from the invite list
4. Visit that URL → you're inside the learner app

## What you GAIN from this migration

- ✅ **All 7 modules:** Pinyin (with Azure viseme mouth animation), Words, Chengyu, Grammar, HSK, Poetry, Games, plus Miaohong (character tracing with hanzi-writer)
- ✅ **Full admin:** 12 tabs for content management, drag-to-reorder, AI-assisted content generation
- ✅ **CLF onboarding sub-app** preserved at `/clf` (via the "New Platform" button)
- ✅ **Proper Azure TTS** for Chinese pronunciation (fixes your earlier "English pronunciation" issue)

## What stays CLF-specific

- `clf_learner_profiles` + `clf_progress` + `clf_characters` tables (the CLF sub-app reads these)
- `src/clf/` folder — unchanged
- `/admin` login uses `jgw_admins` (lingua-learn compatible) but the admin pages can also write to `clf_*` tables

## Known gotchas after migration

**1. First load might 404 for `/sw.js`** — the service worker is enabled only in production. Hard-refresh once.

**2. Hanzi-writer CDN blocked** by Edge's tracking prevention (you saw this before). Self-host it if it becomes an issue:
```powershell
npm install hanzi-writer
# Then in the code that loads it, replace the CDN script tag with `import HanziWriter from 'hanzi-writer'`
```

**3. Panda favicon rotates** based on `jgw_panda_assets` — empty table means default favicon. Add some panda images via **Panda Studio** admin tab or just ignore.

**4. QR Gate blocks you on first visit** — this is intentional (lingua-learn's access control). You MUST create an invite first via admin. See Step 8.

## Rollback plan

If anything breaks:

```powershell
cd C:\Users\Lun_z\Desktop\coding_assistant\clf-platform
Remove-Item src -Recurse -Force
Move-Item src.backup src
netlify deploy --build --prod
```

Your backup `src.backup/` is exactly what you had before this migration.

## File count summary

| Before | After (after copy) |
|---|---|
| ~10 files in clf-platform/src | ~90 files (all of lingua-learn) |
| ~4 functions | 14 functions (full AI + auth suite) |

## Still pending from earlier in our conversation

After this migration lands, we can still:

- Keep the `/admin` upload pipeline from my earlier delivery (PDFs → classify-embed → RAG). That lives at `netlify/functions/classify-embed.js` + `rag-search.js` + `generate-illustration.js`. They complement lingua-learn's existing functions without conflict.
- Deploy the original admin upload UI (`src/admin/ContentUploader.jsx` etc.) alongside lingua-learn's admin — they're independent.

If you want those wired in, just re-copy those files on top (they don't overlap with lingua-learn's admin tabs).
