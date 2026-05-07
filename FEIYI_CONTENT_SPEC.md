# 非遗 Content Management Spec

**Status:** Design spec for next session.
**Decisions locked this session (May 06 2026):**
- Format: **Mixed** (hub + articles + media gallery + interactive)
- Content source: **AI-generated initial draft, super_admin reviews and edits**
- Trilingual: **Yes**, per-article zh/en/it versions

---

## Page hierarchy

```
/feiyi                                  ← landing (light theme, 4 category tiles)
/feiyi/folklore                         ← category hub (民俗故事)
/feiyi/folklore/article/dragon-king     ← single article (slug-based URL)
/feiyi/opera                            ← 传统戏曲 hub
/feiyi/opera/article/kunqu              ← article on 昆曲
/feiyi/crafts                           ← 民间工艺 hub
/feiyi/crafts/gallery                   ← media gallery view
/feiyi/festivals                        ← 节庆文化 hub
/feiyi/festivals/article/spring-festival
```

---

## Category hub layout (mixed elements)

Each category page (e.g. `/feiyi/opera`) has these sections, in order:

1. **Hero**: category title + intro paragraph (translatable)
2. **Featured article**: large card linking to a chosen flagship article
3. **Article grid**: 6-12 article cards (smaller, with thumbnail + title + excerpt)
4. **Media gallery**: grid of images / videos with lightbox
5. **Interactive element**:
   - 民俗故事 → "Read aloud" with TTS audio
   - 传统戏曲 → embedded YouTube/Bilibili video samples
   - 民间工艺 → step-by-step craft tutorial (slideshow)
   - 节庆文化 → calendar widget showing upcoming festivals
6. **Related categories** (cross-links)

---

## Database schema

```sql
-- Articles (one row per language version)
CREATE TABLE clf_feiyi_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,           -- 'folklore' | 'opera' | 'crafts' | 'festivals'
  slug TEXT NOT NULL,               -- e.g. 'kunqu', 'dragon-king'
  language TEXT NOT NULL,           -- 'zh' | 'en' | 'it'
  title TEXT NOT NULL,
  excerpt TEXT,                     -- short preview (1-2 sentences)
  body_md TEXT NOT NULL,            -- markdown content
  cover_image_url TEXT,
  audio_url TEXT,                   -- optional TTS audio
  video_url TEXT,                   -- YouTube/Bilibili embed URL
  status TEXT DEFAULT 'draft',      -- 'draft' | 'published' | 'archived'
  is_featured BOOLEAN DEFAULT false,
  created_by UUID REFERENCES clf_user_profiles(user_id),
  reviewed_by UUID REFERENCES clf_user_profiles(user_id),
  reviewed_at TIMESTAMPTZ,
  ai_generated BOOLEAN DEFAULT false,    -- did AI draft this?
  ai_provider TEXT,                      -- which provider drafted it
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (category, slug, language)
);

-- Media gallery items (separate from articles)
CREATE TABLE clf_feiyi_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  type TEXT NOT NULL,               -- 'image' | 'video' | 'audio'
  url TEXT NOT NULL,
  caption_zh TEXT,
  caption_en TEXT,
  caption_it TEXT,
  display_order INT DEFAULT 0,
  status TEXT DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Interactive elements (festival calendar entries, craft tutorial steps, etc.)
CREATE TABLE clf_feiyi_interactives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  kind TEXT NOT NULL,               -- 'calendar' | 'tutorial' | 'audio_story' | 'video_clip'
  payload JSONB NOT NULL,           -- shape varies by kind
  language TEXT,                    -- nullable if non-textual
  display_order INT DEFAULT 0,
  status TEXT DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: public read for status='published', super_admin full access
```

---

## AI-assisted authoring workflow

In admin panel, super_admin clicks "新建非遗文章" and:

1. **Picks category + slug** (e.g. opera / kunqu)
2. **Selects target language** (start with one, e.g. zh)
3. **Writes a brief** (3-5 sentence prompt or outline)
4. **Picks AI provider** (uses the AI provider config from Phase E.2 — text feature)
5. **Clicks "生成草稿"** → AI returns markdown draft
6. **Edits inline** (markdown editor)
7. **Saves as draft** OR **publishes**
8. After zh version saved, button: **"翻译为英文"** / **"Tradurre in italiano"** → AI translates and creates linked rows in en/it

The AI prompts are tuned per category:
- **Folklore**: "写一篇关于 {topic} 的中国民间传说，500字以内，文学性强，适合非中文母语读者，包含故事背景、主要情节、文化寓意。"
- **Opera**: "介绍 {topic} 这一中国传统戏曲形式，包含历史源流、艺术特色、代表剧目、当代传承现状。"
- **Crafts**: "介绍 {topic} 这一中国民间工艺，包含工艺历史、制作流程、地域分布、文化意义、当代发展。"
- **Festivals**: "介绍 {topic} 这一中国传统节日，包含日期、起源、习俗活动、各地差异、与现代生活的联系。"

---

## File structure to build

```
src/heritage/
  HeritageApp.jsx              ← already exists, needs router for sub-pages
  pages/
    CategoryHub.jsx            ← hub layout (hero + articles + media + interactive)
    ArticleDetail.jsx          ← single article with markdown render
    MediaGallery.jsx           ← grid + lightbox

src/admin/feiyi/
  FeiyiAdminTab.jsx            ← list articles, filter by category/status/language
  ArticleEditor.jsx            ← create/edit with AI draft + translate
  MediaUploader.jsx            ← bulk upload to clf_feiyi_media
  InteractiveBuilder.jsx       ← per-kind editor (calendar, tutorial, etc.)

netlify/functions/
  feiyi-ai-draft.js            ← takes brief + category, returns markdown
  feiyi-ai-translate.js        ← takes article id + target lang, returns translated markdown
```

---

## Estimated scope

| Phase | Work | Sessions |
|---|---|---|
| F.1 | Schema + admin list view + manual article CRUD | 1 |
| F.2 | AI draft generation + markdown editor | 1 |
| F.3 | AI translation flow + zh/en/it linking | 1 |
| F.4 | Public hub page with article grid + media gallery | 1 |
| F.5 | Article detail page with TTS audio + video embed | 1 |
| F.6 | Interactive elements per category (calendar, tutorial, etc.) | 1-2 |

Total: 6-7 sessions for full vision.

**MVP path (3 sessions):**
- F.1: Schema + admin CRUD (no AI yet)
- F.2: Public reading view
- F.3: AI draft generation + translation

That gets you a usable 非遗 with curated content quickly. Interactive elements come later.

---

## Decision log

- **Article model: separate row per language** vs one row with jsonb of translations.
  Chose: separate rows. Easier RLS, easier search, AI translate flow naturally creates new rows.

- **Slug + language unique key**: same article in 3 languages share slug, differ by language. Listing pages query by language; detail page can offer "view in another language" toggle.

- **AI provider per draft**: stored in `ai_provider` column for audit. Super_admin can re-generate with different provider if not satisfied.

- **Featured article**: only one per category at a time (enforced in app code, not DB constraint, to allow temporary rotation).

- **Media not tied to articles**: 媒体 gallery is independent (clf_feiyi_media). Lets super_admin upload images/videos without writing articles. Articles can reference media URLs but it's not a hard FK.

---

## Out of scope (for any 非遗 sessions)

- User-generated comments / discussion (would need account-aware UX, contradicts "public" goal)
- User contributions / submissions (governance becomes complex)
- Cross-platform sharing (Twitter/WeChat embed) — Phase G+ if at all
- Search / full-text indexing — defer until 50+ articles exist
- Recommendation engine — same

---

## Notes for next session resume

When picking this up, bring this doc + run schema discovery first to see if `clf_feiyi_*` tables exist. Likely they don't — start from scratch.

The first session should produce:

1. SQL migration with the 3 tables above
2. `FeiyiAdminTab.jsx` in `/admin` with article list + simple new/edit forms (NO AI yet — get CRUD working first)
3. Public-facing CategoryHub.jsx as a basic article grid (NO interactive elements yet)
4. One seed article hand-written in zh+en+it to test the trilingual flow

Once that works on production, add AI generation in next session.
