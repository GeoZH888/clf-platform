-- ═══════════════════════════════════════════════════════════════════════════
-- clf_prompt_templates : DB-backed prompt editing for AI features
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this once in the Supabase SQL editor. Idempotent (safe to re-run).
-- Future prompt edits happen via the SuperAdmin "Prompt Templates" tab,
-- not via SQL.

-- ── Table ───────────────────────────────────────────────────────────────────
create table if not exists clf_prompt_templates (
  key         text primary key,
  name        text not null,
  description text,
  template    text not null,
  variables   jsonb default '{}'::jsonb,
  updated_at  timestamptz default now(),
  updated_by  text
);

-- ── Auto-touch updated_at on UPDATE ─────────────────────────────────────────
create or replace function clf_prompt_templates_touch()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists clf_prompt_templates_touch_trg on clf_prompt_templates;
create trigger clf_prompt_templates_touch_trg
  before update on clf_prompt_templates
  for each row execute function clf_prompt_templates_touch();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Mirrors the permissive pattern of clf_chengyu. Tighten later by replacing
-- the "write" policy with a superadmin email check if you wire that up.
alter table clf_prompt_templates enable row level security;

drop policy if exists "clf_prompt_templates read"  on clf_prompt_templates;
drop policy if exists "clf_prompt_templates write" on clf_prompt_templates;

create policy "clf_prompt_templates read"
  on clf_prompt_templates for select using (true);

create policy "clf_prompt_templates write"
  on clf_prompt_templates for all
  using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Seed: initial templates (only inserts if key doesn't already exist)
-- ═══════════════════════════════════════════════════════════════════════════

insert into clf_prompt_templates (key, name, description, template, variables) values
(
  'chengyu_text',
  '成语文本生成',
  '批量生成成语条目（成语 + 拼音 + 三语释义 + 典故 + 例句）',
  $prompt$生成 {count} 条中文成语，要求：
- 主题：{theme}
- HSK等级：{hsk}
- 每条包含：成语、拼音、中文意思、英语意思、意大利语意思、历史典故（中文，200字以内）、例句（中文）、难度（1-4）
- 返回纯 JSON 数组，不要任何 markdown 或说明文字
- ⚠️ 字符串中的双引号必须用反斜杠转义（例如 "他说\"你好\""），不要使用中文引号 " " 『 』
格式：[{"idiom":"...","pinyin":"...","meaning_zh":"...","meaning_en":"...","meaning_it":"...","story_zh":"...","example_zh":"...","difficulty":2,"theme":"{theme}","hsk_level":{hsk}}]$prompt$,
  $vars${
    "count": {"type":"number","example":5,"desc":"生成数量 1-50"},
    "theme": {"type":"enum","example":"animals","desc":"wisdom / animals / nature / history / general / emotion / achievement / warning"},
    "hsk":   {"type":"number","example":4,"desc":"HSK 等级 1-6"}
  }$vars$::jsonb
),
(
  'chengyu_image',
  '成语图片生成',
  '为成语生成插图的 prompt（英文，传给 DALL-E / Stability / Flux）',
  $prompt$Children's book illustration depicting this scene from a Chinese fable:

{story}

Visual focus: the narrative moment from this story. Show characters, setting, and action clearly. A single coherent scene, not a collage of symbols.

Style: {style}.

STRICTLY AVOID: any Chinese text, calligraphy, or written characters; Chinese New Year decorations (red lanterns, couplets, firecrackers, gold ingots); holiday motifs; symbolic objects unrelated to the story. No text or watermarks anywhere in the image.

Composition: square format, balanced, focal subject centered, soft natural lighting, period-appropriate ancient Chinese rural or village setting.$prompt$,
  $vars${
    "story": {"type":"text","example":"战国时期，楚国有个人在祭祀后画蛇比赛喝酒，他先画完，又给蛇添上脚，结果输了酒。","desc":"历史典故全文（已在 JS 端 fallback 到 meaning_zh）"},
    "idiom": {"type":"text","example":"画蛇添足","desc":"成语本身（4字，当前模板未使用，可手动加入）"},
    "style": {"type":"text","example":"flat vector cartoon illustration, bright colors, cute Chinese style","desc":"英文风格描述串（来自 IMG_STYLES[i].prompt）"}
  }$vars$::jsonb
)
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verify
-- ═══════════════════════════════════════════════════════════════════════════
select key, name, length(template) as tpl_len, jsonb_object_keys(variables) as var
  from clf_prompt_templates
  order by key;
