-- 016_image_options.sql
-- Picture answer options, for children who can't read the characters yet.
--
-- Items already supported an image *alongside* the question (image_url), but
-- every answer option was text — so a child who knows the word 猫 but can't
-- read it still can't answer. This lets the four options be pictures: hear
-- "māo", tap the cat.
--
-- options stays a jsonb array. options_kind says how to read it:
--   'text'  → each entry is the option's label (existing behaviour)
--   'image' → each entry is an image URL; the quiz renders a picture grid
-- correct_index is unchanged — still the 0-based index into options.
--
-- Requires: 012_placement_assessment.sql. Safe to re-run.

-- video_url belongs to 015, but the RPC bodies below name it. If 015 hasn't
-- been applied, republishing them here compiles fine and then fails at call
-- time with "record v_item has no field video_url" — which takes the quiz
-- down for every student. Add it defensively so 016 stands alone.
alter table public.clf_placement_items
  add column if not exists video_url    text,
  add column if not exists options_kind text not null default 'text';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clf_placement_items_options_kind_chk'
  ) then
    alter table public.clf_placement_items
      add constraint clf_placement_items_options_kind_chk
      check (options_kind in ('text', 'image'));
  end if;
end $$;

comment on column public.clf_placement_items.options_kind is
  'text = options are labels; image = options are image URLs (picture-choice item).';

-- ─── Republish both item-delivery RPCs ────────────────────────────────
-- They enumerate columns explicitly so correct_index cannot leak, which
-- means options_kind is invisible to the quiz until named here — the same
-- reason 015 had to republish them for video_url.

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
    'video_url', v_item.video_url,
    'options', v_item.options,
    'options_kind', v_item.options_kind
  ));
end $$;

create or replace function public.clf_assessment_next(
  p_run uuid, p_level int default null, p_skill text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_run record; v_a record; v_item record;
begin
  select * into v_run from public.clf_assessment_runs
   where id = p_run and student_user_id = auth.uid() and status = 'in_progress';
  if v_run.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_run');
  end if;

  if v_run.kind = 'fixed' then
    select * into v_a from public.clf_assessments where id = v_run.assessment_id;
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
    'id', v_item.id,
    'yct_level', v_item.yct_level,
    'skill', v_item.skill,
    'prompt', v_item.prompt,
    'prompt_hint', v_item.prompt_hint,
    'audio_text', v_item.audio_text,
    'audio_url', v_item.audio_url,
    'image_url', v_item.image_url,
    'video_url', v_item.video_url,
    'options', v_item.options,
    'options_kind', v_item.options_kind
  ));
end $$;

-- Item-bank browser used by the fixed-test builder needs it too, so the
-- picker can show a thumbnail instead of a raw URL.
--
-- This one returns a table, and adding a column changes its OUT-parameter row
-- type — which `create or replace` refuses (42P13). Drop it first. The two
-- functions above return plain jsonb, so their shape never changes and
-- replace works on them.
drop function if exists public.clf_assessment_item_bank(int, text);

create function public.clf_assessment_item_bank(
  p_level int default null, p_skill text default null
) returns table (
  id uuid, code text, yct_level int, skill text, prompt text,
  options jsonb, options_kind text
)
language sql stable security definer set search_path = public as $$
  select i.id, i.code, i.yct_level, i.skill, i.prompt, i.options, i.options_kind
    from public.clf_placement_items i
   where i.active
     and public.clf_is_teaching_staff()
     and (p_level is null or i.yct_level = p_level)
     and (p_skill is null or i.skill = p_skill)
   order by i.yct_level, i.skill, i.sort_order;
$$;

grant execute on function public.clf_placement_next(text, int, text)     to anon, authenticated;
grant execute on function public.clf_assessment_next(uuid, int, text)    to authenticated;
grant execute on function public.clf_assessment_item_bank(int, text)     to authenticated;
