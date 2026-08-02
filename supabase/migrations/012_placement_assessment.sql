-- 012_placement_assessment.sql
-- 新生分班测试 · YCT 1–4 placement assessment
--
-- Flow:
--   1. Staff (teacher / school_master / super_admin) creates a session for a
--      candidate → gets a short access_code.
--   2. Candidate opens /placement?code=XXXXXX (no login) and takes an
--      adaptive quiz. The staircase lives client-side (src/lib/placement.js);
--      item delivery + grading + final scoring are server-side RPCs so the
--      answer key never reaches the browser.
--   3. Staff reviews the auto-suggested YCT level, sets a final level and
--      assigns the candidate to a class → clf_class_members row.
--
-- Assumes clf_classes / clf_class_members / clf_user_profiles already exist
-- (created outside these checked-in migrations). Only adds columns to
-- clf_classes if missing.
--
-- Safe to re-run.

-- ─── Staff predicate ──────────────────────────────────────────────────
-- Anyone who may create/review a placement session. Broader than
-- is_super_admin() from 007 — homeroom teachers do intake too.
-- role is the enum clf_user_role, so comparing against a literal that isn't
-- one of its labels is a parse-time error, not a false. Cast to text: this
-- list stays valid as roles are added or dropped from the enum.
create or replace function public.clf_is_teaching_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clf_user_profiles p
     where p.user_id = auth.uid()
       and p.role::text in ('teacher', 'school_master', 'super_admin')
  );
$$;

-- ─── clf_classes: level + capacity for matching ───────────────────────
alter table public.clf_classes
  add column if not exists yct_level int,
  add column if not exists capacity  int;

comment on column public.clf_classes.yct_level is
  'YCT 1-4 this class teaches. Placement suggests classes at the matching level.';

-- ─── Item bank ────────────────────────────────────────────────────────
create table if not exists public.clf_placement_items (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,                       -- stable seed key, e.g. 'y2-l-01'
  yct_level     int  not null check (yct_level between 1 and 4),
  skill         text not null check (skill in ('vocab','listening','reading','grammar')),
  prompt        text not null,                     -- question shown to the candidate
  prompt_hint   text,                              -- pinyin / instruction hint
  audio_text    text,                              -- listening items: what gets spoken (TTS)
  audio_url     text,                              -- pre-generated audio, optional
  image_url     text,
  options       jsonb not null,                    -- ["A","B","C","D"]
  correct_index int  not null,
  active        boolean not null default true,
  sort_order    int    not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_placement_items_pick
  on public.clf_placement_items (active, yct_level, skill);

-- ─── Sessions ─────────────────────────────────────────────────────────
create table if not exists public.clf_placement_sessions (
  id                uuid primary key default gen_random_uuid(),
  access_code       text not null unique,          -- candidate opens /placement?code=…
  candidate_name    text not null,
  candidate_age     int,
  contact           text,                          -- phone / email of parent
  student_user_id   uuid references auth.users(id) on delete set null,
  status            text not null default 'in_progress'
                    check (status in ('in_progress','submitted','reviewed','placed','cancelled')),
  started_at        timestamptz,
  submitted_at      timestamptz,

  -- auto result (written by clf_placement_submit)
  auto_level        int,
  auto_confidence   numeric,                       -- accuracy at the chosen level, 0-1
  level_scores      jsonb,                         -- {"1":{"n":4,"correct":4}, …}
  skill_scores      jsonb,                         -- {"vocab":0.75, …}

  -- teacher decision
  final_level       int,
  teacher_note      text,
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  assigned_class_id uuid references public.clf_classes(id) on delete set null,

  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_placement_sessions_status
  on public.clf_placement_sessions (status, created_at desc);

-- ─── Answers ──────────────────────────────────────────────────────────
create table if not exists public.clf_placement_answers (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.clf_placement_sessions(id) on delete cascade,
  item_id      uuid not null references public.clf_placement_items(id)    on delete cascade,
  yct_level    int  not null,
  skill        text not null,
  chosen_index int,
  is_correct   boolean not null default false,
  ms_taken     int,
  answered_at  timestamptz not null default now(),
  unique (session_id, item_id)
);

create index if not exists idx_placement_answers_session
  on public.clf_placement_answers (session_id, answered_at);

-- ─── RLS ──────────────────────────────────────────────────────────────
-- Nothing here is reachable by anon directly. The candidate quiz talks to
-- the SECURITY DEFINER RPCs below, which gate on access_code. Items in
-- particular must stay staff-only — they carry correct_index.
alter table public.clf_placement_items     enable row level security;
alter table public.clf_placement_sessions  enable row level security;
alter table public.clf_placement_answers   enable row level security;

drop policy if exists "placement_items_staff" on public.clf_placement_items;
create policy "placement_items_staff"
  on public.clf_placement_items for all to authenticated
  using (public.clf_is_teaching_staff())
  with check (public.clf_is_teaching_staff());

drop policy if exists "placement_sessions_staff" on public.clf_placement_sessions;
create policy "placement_sessions_staff"
  on public.clf_placement_sessions for all to authenticated
  using (public.clf_is_teaching_staff())
  with check (public.clf_is_teaching_staff());

drop policy if exists "placement_answers_staff" on public.clf_placement_answers;
create policy "placement_answers_staff"
  on public.clf_placement_answers for all to authenticated
  using (public.clf_is_teaching_staff())
  with check (public.clf_is_teaching_staff());

-- ─── RPC: resume / open a session by code ─────────────────────────────
create or replace function public.clf_placement_session(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s record; v_answered int;
begin
  select * into v_s from public.clf_placement_sessions
   where access_code = p_code;
  if v_s.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select count(*) into v_answered
    from public.clf_placement_answers where session_id = v_s.id;

  if v_s.status = 'in_progress' and v_s.started_at is null then
    update public.clf_placement_sessions set started_at = now() where id = v_s.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'candidate_name', v_s.candidate_name,
    'status', v_s.status,
    'answered', v_answered,
    'auto_level', v_s.auto_level
  );
end $$;

-- ─── RPC: next item ───────────────────────────────────────────────────
-- Returns one unseen active item at p_level. p_skill narrows it; pass null
-- to take any skill at that level. Never returns correct_index.
create or replace function public.clf_placement_next(
  p_code text, p_level int, p_skill text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_item record;
begin
  select id into v_session from public.clf_placement_sessions
   where access_code = p_code and status = 'in_progress';
  if v_session is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select i.* into v_item
    from public.clf_placement_items i
   where i.active
     and i.yct_level = p_level
     and (p_skill is null or i.skill = p_skill)
     and not exists (
       select 1 from public.clf_placement_answers a
        where a.session_id = v_session and a.item_id = i.id)
   order by random()
   limit 1;

  if v_item.id is null then
    return jsonb_build_object('ok', true, 'item', null);
  end if;

  return jsonb_build_object('ok', true, 'item', jsonb_build_object(
    'id', v_item.id,
    'yct_level', v_item.yct_level,
    'skill', v_item.skill,
    'prompt', v_item.prompt,
    'prompt_hint', v_item.prompt_hint,
    'audio_text', v_item.audio_text,
    'audio_url', v_item.audio_url,
    'image_url', v_item.image_url,
    'options', v_item.options
  ));
end $$;

-- ─── RPC: grade one answer ────────────────────────────────────────────
create or replace function public.clf_placement_answer(
  p_code text, p_item uuid, p_choice int, p_ms int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session uuid; v_item record; v_correct boolean;
begin
  select id into v_session from public.clf_placement_sessions
   where access_code = p_code and status = 'in_progress';
  if v_session is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_item from public.clf_placement_items where id = p_item and active;
  if v_item.id is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_item');
  end if;

  v_correct := (p_choice is not distinct from v_item.correct_index);

  insert into public.clf_placement_answers
    (session_id, item_id, yct_level, skill, chosen_index, is_correct, ms_taken)
  values (v_session, v_item.id, v_item.yct_level, v_item.skill, p_choice, v_correct, p_ms)
  on conflict (session_id, item_id) do nothing;

  return jsonb_build_object('ok', true, 'is_correct', v_correct,
                            'correct_index', v_item.correct_index);
end $$;

-- ─── RPC: submit + auto-score ─────────────────────────────────────────
-- auto_level = highest YCT level where the candidate answered at least
-- MIN_ITEMS (3) and got at least PASS (70%) right. Falls back to 1.
create or replace function public.clf_placement_submit(p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_session uuid;
  v_levels  jsonb := '{}'::jsonb;
  v_skills  jsonb := '{}'::jsonb;
  v_auto    int   := 1;
  v_conf    numeric := 0;
  r         record;
  c_min     constant int     := 3;
  c_pass    constant numeric := 0.70;
begin
  select id into v_session from public.clf_placement_sessions
   where access_code = p_code and status = 'in_progress';
  if v_session is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  for r in
    select yct_level as lvl, count(*)::int as n,
           count(*) filter (where is_correct)::int as correct
      from public.clf_placement_answers
     where session_id = v_session
     group by yct_level order by yct_level
  loop
    v_levels := v_levels || jsonb_build_object(
      r.lvl::text, jsonb_build_object('n', r.n, 'correct', r.correct));
    if r.n >= c_min and (r.correct::numeric / r.n) >= c_pass then
      v_auto := r.lvl;
      v_conf := round(r.correct::numeric / r.n, 2);
    end if;
  end loop;

  for r in
    select skill, count(*)::int as n,
           count(*) filter (where is_correct)::int as correct
      from public.clf_placement_answers
     where session_id = v_session
     group by skill
  loop
    v_skills := v_skills || jsonb_build_object(
      r.skill, round(r.correct::numeric / greatest(r.n, 1), 2));
  end loop;

  update public.clf_placement_sessions
     set status          = 'submitted',
         submitted_at    = now(),
         auto_level      = v_auto,
         auto_confidence = v_conf,
         level_scores    = v_levels,
         skill_scores    = v_skills
   where id = v_session;

  return jsonb_build_object('ok', true, 'auto_level', v_auto,
                            'auto_confidence', v_conf,
                            'level_scores', v_levels,
                            'skill_scores', v_skills);
end $$;

-- Candidate-facing RPCs are callable without a login; they gate on
-- access_code themselves. Everything else stays behind RLS.
grant execute on function public.clf_placement_session(text) to anon, authenticated;
grant execute on function public.clf_placement_next(text, int, text) to anon, authenticated;
grant execute on function public.clf_placement_answer(text, uuid, int, int) to anon, authenticated;
grant execute on function public.clf_placement_submit(text) to anon, authenticated;

-- ─── Seed item bank ───────────────────────────────────────────────────
-- 32 items · 8 per YCT level · 2 per skill. All prompts are in Chinese with
-- no L1 dependency, so the same bank works for Italian- and English-speaking
-- candidates. correct_index is 0 throughout the seed only because options are
-- shuffled client-side before display.
insert into public.clf_placement_items
  (code, yct_level, skill, prompt, prompt_hint, audio_text, options, correct_index, sort_order)
values
  -- ── YCT 1 ──────────────────────────────────────────────────────────
  ('y1-v-01', 1, 'vocab',     '「三」的拼音是？', '数字 · numbers', null,
   '["sān","shān","sāng","cān"]'::jsonb, 0, 10),
  ('y1-v-02', 1, 'vocab',     '下面哪个字是数字？', null, null,
   '["七","猫","书","水"]'::jsonb, 0, 20),
  ('y1-l-01', 1, 'listening', '听录音，选出你听到的词。', null, '妈妈',
   '["妈妈","爸爸","哥哥","姐姐"]'::jsonb, 0, 30),
  ('y1-l-02', 1, 'listening', '听录音，选出你听到的词。', null, '谢谢',
   '["谢谢","再见","你好","请坐"]'::jsonb, 0, 40),
  ('y1-r-01', 1, 'reading',   '读句子：我有一只小猫。句子里说的动物是？', null, null,
   '["猫","狗","鱼","鸟"]'::jsonb, 0, 50),
  ('y1-r-02', 1, 'reading',   '读句子：他今年七岁。他几岁？', null, null,
   '["七岁","八岁","九岁","十岁"]'::jsonb, 0, 60),
  ('y1-g-01', 1, 'grammar',   '选词填空：我＿老师。', null, null,
   '["是","有","在","和"]'::jsonb, 0, 70),
  ('y1-g-02', 1, 'grammar',   '选词填空：这是我＿书。', null, null,
   '["的","是","在","和"]'::jsonb, 0, 80),

  -- ── YCT 2 ──────────────────────────────────────────────────────────
  ('y2-v-01', 2, 'vocab',     '「星期」的拼音是？', null, null,
   '["xīng qī","xīn qí","xìng qī","xīng jī"]'::jsonb, 0, 110),
  ('y2-v-02', 2, 'vocab',     '下面哪个词是颜色？', null, null,
   '["红色","苹果","眼睛","上午"]'::jsonb, 0, 120),
  ('y2-l-01', 2, 'listening', '听录音，选出你听到的句子。', null, '今天很热',
   '["今天很热","今天很冷","明天很热","昨天很冷"]'::jsonb, 0, 130),
  ('y2-l-02', 2, 'listening', '听录音，选出你听到的句子。', null, '我喜欢吃苹果',
   '["我喜欢吃苹果","我喜欢吃西瓜","他喜欢吃苹果","我不喜欢苹果"]'::jsonb, 0, 140),
  ('y2-r-01', 2, 'reading',   '读句子：明天是星期六，我们不上课。明天要上课吗？', null, null,
   '["不上课","上课","上半天","不知道"]'::jsonb, 0, 150),
  ('y2-r-02', 2, 'reading',   '读句子：小明有两个姐姐和一个哥哥。小明有几个姐姐？', null, null,
   '["两个","一个","三个","没有"]'::jsonb, 0, 160),
  ('y2-g-01', 2, 'grammar',   '选词填空：妈妈＿医院工作。', null, null,
   '["在","是","有","的"]'::jsonb, 0, 170),
  ('y2-g-02', 2, 'grammar',   '选量词：一＿书', null, null,
   '["本","只","张","杯"]'::jsonb, 0, 180),

  -- ── YCT 3 ──────────────────────────────────────────────────────────
  ('y3-v-01', 3, 'vocab',     '「觉得」的意思最接近下面哪个词？', null, null,
   '["认为","看见","听见","记得"]'::jsonb, 0, 210),
  ('y3-v-02', 3, 'vocab',     '下面哪个词表示时间？', null, null,
   '["刚才","漂亮","便宜","干净"]'::jsonb, 0, 220),
  ('y3-l-01', 3, 'listening', '听录音，选出意思相同的句子。', null, '我已经做完作业了',
   '["我做完作业了","我还没做作业","我正在做作业","我不想做作业"]'::jsonb, 0, 230),
  ('y3-l-02', 3, 'listening', '听录音，回答：几点见面？', null, '明天上午九点在学校门口见',
   '["上午九点","下午九点","上午八点","中午十二点"]'::jsonb, 0, 240),
  ('y3-r-01', 3, 'reading',   '读句子：因为下雨，所以我们没去公园。我们为什么没去公园？', null, null,
   '["因为下雨","因为很热","因为没时间","因为太远"]'::jsonb, 0, 250),
  ('y3-r-02', 3, 'reading',   '读句子：这件衣服比那件贵一点儿。哪件更贵？', null, null,
   '["这件","那件","一样贵","不知道"]'::jsonb, 0, 260),
  ('y3-g-01', 3, 'grammar',   '选词填空：他跑＿很快。', null, null,
   '["得","的","地","了"]'::jsonb, 0, 270),
  ('y3-g-02', 3, 'grammar',   '选词填空：我＿在看电视，别叫我。', null, null,
   '["正","刚","已经","还"]'::jsonb, 0, 280),

  -- ── YCT 4 ──────────────────────────────────────────────────────────
  ('y4-v-01', 4, 'vocab',     '「著名」的意思最接近下面哪个词？', null, null,
   '["有名","漂亮","安静","便宜"]'::jsonb, 0, 310),
  ('y4-v-02', 4, 'vocab',     '「担心」的意思最接近下面哪个词？', null, null,
   '["着急","高兴","满意","轻松"]'::jsonb, 0, 320),
  ('y4-l-01', 4, 'listening', '听录音，选出正确的说法。', null, '虽然今天很累但是我很开心',
   '["他很开心","他不开心","他不累","他很生气"]'::jsonb, 0, 330),
  ('y4-l-02', 4, 'listening', '听录音，说话人请你做什么？', null, '请把窗户关上外面太吵了',
   '["关窗户","开窗户","关门","开灯"]'::jsonb, 0, 340),
  ('y4-r-01', 4, 'reading',   '读句子：除了小明以外，其他人都去过长城。谁没去过长城？', null, null,
   '["小明","其他人","所有人","没有人"]'::jsonb, 0, 350),
  ('y4-r-02', 4, 'reading',   '读句子：他不但会说汉语，而且写得很好。下面哪句话对？', null, null,
   '["他会说也会写","他只会说","他只会写","他都不会"]'::jsonb, 0, 360),
  ('y4-g-01', 4, 'grammar',   '选词填空：我的自行车＿他借走了。', null, null,
   '["被","把","给","让"]'::jsonb, 0, 370),
  ('y4-g-02', 4, 'grammar',   '选词填空：＿明天下雨，我们就不去了。', null, null,
   '["如果","虽然","因为","除了"]'::jsonb, 0, 380)
on conflict (code) do nothing;
