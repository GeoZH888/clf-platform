-- 015_item_media.sql
-- Video on test items + a bucket to hold uploaded question media.
--
-- Items already carried image_url, audio_url and audio_text (the last drives
-- runtime TTS, so listening questions need no stored file). This adds video
-- and a place to put uploads.
--
-- video_url holds either an uploaded file's public URL or a pasted link
-- (YouTube / Bilibili / any direct .mp4) — the column doesn't care which, and
-- the player picks an <iframe> or a <video> based on the host.
--
-- Requires: 012_placement_assessment.sql. Safe to re-run.

alter table public.clf_placement_items
  add column if not exists video_url text;

comment on column public.clf_placement_items.video_url is
  'Uploaded file URL or an embed link (YouTube / Bilibili / direct .mp4).';

-- ─── Storage bucket for uploaded question media ───────────────────────
-- Public read: the placement quiz is taken by anonymous candidates, who have
-- no session to authorise a signed URL against.
insert into storage.buckets (id, name, public)
  values ('placement-media', 'placement-media', true)
  on conflict (id) do nothing;

-- Anyone may read (candidates are anonymous); only teaching staff may write.
drop policy if exists "placement_media_read" on storage.objects;
create policy "placement_media_read"
  on storage.objects for select
  using (bucket_id = 'placement-media');

drop policy if exists "placement_media_insert" on storage.objects;
create policy "placement_media_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'placement-media' and public.clf_is_teaching_staff());

drop policy if exists "placement_media_update" on storage.objects;
create policy "placement_media_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'placement-media' and public.clf_is_teaching_staff())
  with check (bucket_id = 'placement-media' and public.clf_is_teaching_staff());

drop policy if exists "placement_media_delete" on storage.objects;
create policy "placement_media_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'placement-media' and public.clf_is_teaching_staff());

-- If the policy statements above fail with "must be owner of table objects",
-- your SQL-editor role can't manage storage policies — create the bucket in
-- the dashboard (Storage → New bucket → 'placement-media', public) and the
-- defaults will do. The rest of this file is the required part.

-- ─── Both item-delivery RPCs must hand video_url to the quiz ──────────
-- They build the item payload column by column (so correct_index can't leak),
-- which means a new column is invisible until it is named here.

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
    'options', v_item.options
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
    'options', v_item.options
  ));
end $$;

grant execute on function public.clf_placement_next(text, int, text)  to anon, authenticated;
grant execute on function public.clf_assessment_next(uuid, int, text) to authenticated;
