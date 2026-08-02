-- 014_assessment_resume_scope.sql
-- Narrow which run clf_assessment_start() resumes.
--
-- 013 resumed any in-progress run for the same assessment. Two ways that
-- goes wrong:
--
--   1. Repeatable adaptive tests. A run left in progress under September's
--      assignment would be handed back for January's re-assessment, so the
--      new assignment could never be completed on its own terms.
--
--   2. Practice bleeding into official results. A child who starts 自由练习
--      and then opens the test their teacher assigned would resume the
--      practice run — is_practice stays true, and the official result never
--      shows up in the teacher's default results view.
--
-- A run is now only resumed when the assignment AND the practice flag match
-- what the caller asked for. `is not distinct from` so a null assignment
-- (free practice) matches a null assignment rather than nothing.
--
-- Requires: 013_assessment_system.sql. Safe to re-run.

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

  select * into v_a from public.clf_assessments
   where id = p_assessment and is_active;
  if v_a.id is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_assessment');
  end if;

  if p_practice and not v_a.allow_practice then
    return jsonb_build_object('ok', false, 'error', 'practice_not_allowed');
  end if;

  -- Resume only a run of this same assignment and the same kind (practice or
  -- official). Anything else gets a fresh run.
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
    'ok', true,
    'run_id', v_run.id,
    'kind', v_a.kind,
    'title', v_a.title,
    'start_level', v_a.start_level,
    'max_items', case when v_a.kind = 'fixed'
                      then coalesce(array_length(v_a.item_ids, 1), 0)
                      else v_a.max_items end,
    'answered', v_answered
  );
end $$;

grant execute on function public.clf_assessment_start(uuid, uuid, boolean) to authenticated;
