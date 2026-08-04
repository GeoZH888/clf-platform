-- 020_hsk_scale.sql
-- Let the item bank hold HSK questions alongside YCT ones.
--
-- The bank was YCT-only: yct_level was constrained to 1-4 and every consumer
-- assumed that range. HSK runs 1-6 (and 1-9 in HSK 3.0), so both the range
-- and the meaning of the number have to widen.
--
-- Design: one bank, two scales, never mixed inside a single test.
--
--   level_scale  'yct' | 'hsk'  — which ladder the number belongs to
--   yct_level    the level within that ladder, 1-9
--
-- yct_level keeps its name deliberately. Renaming it would touch both answer
-- tables, three RPCs and every consumer for no behavioural gain; the column
-- comment carries the meaning instead.
--
-- Mixing scales in one test would be incoherent — a staircase can't compare a
-- YCT 2 result against an HSK 2 one — so retrieval filters by scale, and an
-- assessment declares the scale it runs on.
--
-- Requires: 012, 013. Safe to re-run.

-- ─── Items ────────────────────────────────────────────────────────────
alter table public.clf_placement_items
  add column if not exists level_scale text not null default 'yct';

do $$
declare c record;
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'clf_placement_items_level_scale_chk') then
    alter table public.clf_placement_items
      add constraint clf_placement_items_level_scale_chk
      check (level_scale in ('yct', 'hsk'));
  end if;

  -- The original 012 check pinned yct_level to 1-4. Find it by definition
  -- rather than by name: it was created inline, so its generated name isn't
  -- guaranteed across environments. Skip the new range check itself.
  for c in
    select conname from pg_constraint
     where conrelid = 'public.clf_placement_items'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%yct_level%'
       and conname <> 'clf_placement_items_level_range_chk'
  loop
    execute format('alter table public.clf_placement_items drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint
                  where conname = 'clf_placement_items_level_range_chk') then
    alter table public.clf_placement_items
      add constraint clf_placement_items_level_range_chk
      check (yct_level between 1 and 9);
  end if;
end $$;

comment on column public.clf_placement_items.level_scale is
  'Which ladder yct_level refers to: yct (1-4) or hsk (1-6, up to 9 for HSK 3.0).';
comment on column public.clf_placement_items.yct_level is
  'Level within level_scale. Named yct_level for history; read it with level_scale.';

create index if not exists idx_placement_items_scale_pick
  on public.clf_placement_items (active, level_scale, yct_level, skill);

-- ─── Assessments declare their scale ──────────────────────────────────
alter table public.clf_assessments
  add column if not exists level_scale text not null default 'yct';

do $$
declare c record;
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'clf_assessments_level_scale_chk') then
    alter table public.clf_assessments
      add constraint clf_assessments_level_scale_chk
      check (level_scale in ('yct', 'hsk'));
  end if;

  for c in
    select conname from pg_constraint
     where conrelid = 'public.clf_assessments'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%start_level%'
  loop
    execute format('alter table public.clf_assessments drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint
                  where conname = 'clf_assessments_start_level_chk') then
    alter table public.clf_assessments
      add constraint clf_assessments_start_level_chk
      check (start_level between 1 and 9);
  end if;
end $$;

-- ─── Placement sessions record which ladder they were graded on ───────
alter table public.clf_placement_sessions
  add column if not exists level_scale text not null default 'yct';

-- ─── Retrieval filters by scale ───────────────────────────────────────
-- p_scale defaults to 'yct', so callers that predate this keep their old
-- behaviour rather than suddenly drawing HSK items into a YCT test.

create or replace function public.clf_placement_next(
  p_code text, p_level int, p_skill text default null, p_scale text default 'yct'
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
     and i.level_scale = coalesce(p_scale, 'yct')
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
    'id', v_item.id, 'yct_level', v_item.yct_level, 'level_scale', v_item.level_scale,
    'skill', v_item.skill, 'prompt', v_item.prompt, 'prompt_hint', v_item.prompt_hint,
    'audio_text', v_item.audio_text, 'audio_url', v_item.audio_url,
    'image_url', v_item.image_url, 'video_url', v_item.video_url,
    'options', v_item.options, 'options_kind', v_item.options_kind
  ));
end $$;

-- The assessment knows its own scale, so this reads it rather than taking it
-- from the caller — a client can't accidentally pull the wrong ladder.
create or replace function public.clf_assessment_next(
  p_run uuid, p_level int default null, p_skill text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_run record; v_a record; v_item record; v_scale text;
begin
  select * into v_run from public.clf_assessment_runs
   where id = p_run and student_user_id = auth.uid() and status = 'in_progress';
  if v_run.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_run');
  end if;

  select * into v_a from public.clf_assessments where id = v_run.assessment_id;
  v_scale := coalesce(v_a.level_scale, 'yct');

  if v_run.kind = 'fixed' then
    select i.* into v_item
      from unnest(v_a.item_ids) with ordinality as t(item_id, ord)
      join public.clf_placement_items i on i.id = t.item_id and i.active
     where not exists (
       select 1 from public.clf_assessment_answers a
        where a.run_id = v_run.id and a.item_id = i.id)
     order by t.ord
     limit 1;
  else
    select i.* into v_item
      from public.clf_placement_items i
     where i.active
       and i.level_scale = v_scale
       and (p_level is null or i.yct_level = p_level)
       and (p_skill is null or i.skill = p_skill)
       and not exists (
         select 1 from public.clf_assessment_answers a
          where a.run_id = v_run.id and a.item_id = i.id)
     order by random()
     limit 1;
  end if;

  if v_item.id is null then
    return jsonb_build_object('ok', true, 'item', null);
  end if;

  return jsonb_build_object('ok', true, 'item', jsonb_build_object(
    'id', v_item.id, 'yct_level', v_item.yct_level, 'level_scale', v_item.level_scale,
    'skill', v_item.skill, 'prompt', v_item.prompt, 'prompt_hint', v_item.prompt_hint,
    'audio_text', v_item.audio_text, 'audio_url', v_item.audio_url,
    'image_url', v_item.image_url, 'video_url', v_item.video_url,
    'options', v_item.options, 'options_kind', v_item.options_kind
  ));
end $$;

-- Return type changes, so drop before create (42P13).
drop function if exists public.clf_assessment_item_bank(int, text);
drop function if exists public.clf_assessment_item_bank(int, text, text);

create function public.clf_assessment_item_bank(
  p_level int default null, p_skill text default null, p_scale text default null
) returns table (
  id uuid, code text, yct_level int, level_scale text, skill text,
  prompt text, options jsonb, options_kind text
)
language sql stable security definer set search_path = public as $$
  select i.id, i.code, i.yct_level, i.level_scale, i.skill,
         i.prompt, i.options, i.options_kind
    from public.clf_placement_items i
   where i.active
     and public.clf_is_teaching_staff()
     and (p_level is null or i.yct_level = p_level)
     and (p_skill is null or i.skill = p_skill)
     and (p_scale is null or i.level_scale = p_scale)
   order by i.level_scale, i.yct_level, i.skill, i.sort_order;
$$;

-- Start the assessment RPC reporting the scale so the client can label levels.
create or replace function public.clf_assessment_start(
  p_assessment uuid,
  p_assignment uuid default null,
  p_practice   boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_a record; v_run record; v_answered int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_a from public.clf_assessments where id = p_assessment and is_active;
  if v_a.id is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_assessment');
  end if;

  if p_practice and not v_a.allow_practice then
    return jsonb_build_object('ok', false, 'error', 'practice_not_allowed');
  end if;

  select * into v_run from public.clf_assessment_runs
   where student_user_id = auth.uid()
     and assessment_id   = p_assessment
     and assignment_id   is not distinct from p_assignment
     and is_practice     =  coalesce(p_practice, false)
     and status = 'in_progress'
   order by started_at desc
   limit 1;

  if v_run.id is null then
    insert into public.clf_assessment_runs
      (assessment_id, assignment_id, student_user_id, kind, is_practice)
    values (p_assessment, p_assignment, auth.uid(), v_a.kind, coalesce(p_practice, false))
    returning * into v_run;
  end if;

  select count(*) into v_answered
    from public.clf_assessment_answers where run_id = v_run.id;

  return jsonb_build_object(
    'ok', true, 'run_id', v_run.id, 'kind', v_a.kind, 'title', v_a.title,
    'level_scale', coalesce(v_a.level_scale, 'yct'),
    'start_level', v_a.start_level,
    'max_items', case when v_a.kind = 'fixed'
                      then coalesce(array_length(v_a.item_ids, 1), 0)
                      else v_a.max_items end,
    'answered', v_answered
  );
end $$;

grant execute on function public.clf_placement_next(text, int, text, text) to anon, authenticated;
grant execute on function public.clf_assessment_next(uuid, int, text)       to authenticated;
grant execute on function public.clf_assessment_item_bank(int, text, text)  to authenticated;
grant execute on function public.clf_assessment_start(uuid, uuid, boolean)  to authenticated;
