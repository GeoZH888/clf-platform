-- 013_assessment_system.sql
-- 学生测评 · in-panel evaluation for enrolled kids
--
-- Distinct from 012 (分班测试), which is for prospective students who have no
-- account and enter through a code. This one is for kids who already have a
-- login: they take tests inside /student, and their teacher sees the results.
--
-- Shares 012's item bank (clf_placement_items) and its rule that the answer
-- key never leaves the server — but authorises on auth.uid() instead of an
-- access code, since these candidates are logged in.
--
-- Two test kinds:
--   adaptive — the YCT staircase from 012, repeatable. Produces a level
--              estimate, so a teacher can watch a child move YCT 2 → 3.
--   fixed    — a teacher-picked ordered list of items, same for every kid,
--              scored as a percentage.
--
-- Two ways to reach a test:
--   assigned — teacher assigns to a class or an individual; official.
--   practice — student self-starts; logged with is_practice = true and kept
--              out of the teacher's default results view.
--
-- Requires: 012_placement_assessment.sql (clf_placement_items,
--           clf_is_teaching_staff()).
--
-- Safe to re-run.

-- ─── Test definitions ─────────────────────────────────────────────────
create table if not exists public.clf_assessments (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  kind           text not null check (kind in ('adaptive','fixed')),

  -- adaptive only
  start_level    int not null default 2 check (start_level between 1 and 4),
  max_items      int not null default 16 check (max_items between 4 and 60),

  -- fixed only: ordered item list. Order is the order kids see them in.
  item_ids       uuid[],

  allow_practice boolean not null default true,   -- may a student self-start it?
  is_active      boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),

  constraint clf_assessments_fixed_needs_items
    check (kind <> 'fixed' or (item_ids is not null and array_length(item_ids, 1) > 0))
);

create index if not exists idx_assessments_active
  on public.clf_assessments (is_active, kind, created_at desc);

-- ─── Assignments ──────────────────────────────────────────────────────
-- Either a whole class or one student. Both null is meaningless; both set is
-- allowed but pointless, so we require at least one.
create table if not exists public.clf_assessment_assignments (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references public.clf_assessments(id) on delete cascade,
  class_id        uuid references public.clf_classes(id) on delete cascade,
  student_user_id uuid references auth.users(id) on delete cascade,
  due_at          timestamptz,
  assigned_by     uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint clf_assignment_has_target
    check (class_id is not null or student_user_id is not null)
);

create index if not exists idx_assignments_class
  on public.clf_assessment_assignments (class_id);
create index if not exists idx_assignments_student
  on public.clf_assessment_assignments (student_user_id);

-- ─── Runs ─────────────────────────────────────────────────────────────
create table if not exists public.clf_assessment_runs (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid references public.clf_assessments(id) on delete set null,
  assignment_id   uuid references public.clf_assessment_assignments(id) on delete set null,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  kind            text not null check (kind in ('adaptive','fixed')),
  is_practice     boolean not null default false,
  status          text not null default 'in_progress'
                  check (status in ('in_progress','submitted')),
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,

  -- results
  n_items         int,
  n_correct       int,
  score_pct       numeric,      -- fixed tests: correct / total, 0-1
  auto_level      int,          -- adaptive tests: estimated YCT level
  auto_confidence numeric,
  level_scores    jsonb,
  skill_scores    jsonb
);

create index if not exists idx_runs_student
  on public.clf_assessment_runs (student_user_id, started_at desc);
create index if not exists idx_runs_assessment
  on public.clf_assessment_runs (assessment_id, is_practice, submitted_at desc);

-- ─── Answers ──────────────────────────────────────────────────────────
create table if not exists public.clf_assessment_answers (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references public.clf_assessment_runs(id) on delete cascade,
  item_id      uuid not null references public.clf_placement_items(id) on delete cascade,
  yct_level    int  not null,
  skill        text not null,
  chosen_index int,
  is_correct   boolean not null default false,
  ms_taken     int,
  answered_at  timestamptz not null default now(),
  unique (run_id, item_id)
);

create index if not exists idx_assessment_answers_run
  on public.clf_assessment_answers (run_id, answered_at);

-- ─── Helper: classes the current user is a student of ─────────────────
create or replace function public.clf_my_class_ids()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select class_id from public.clf_class_members where user_id = auth.uid();
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table public.clf_assessments             enable row level security;
alter table public.clf_assessment_assignments  enable row level security;
alter table public.clf_assessment_runs         enable row level security;
alter table public.clf_assessment_answers      enable row level security;

-- Catalog: staff manage, any logged-in user may read. Nothing sensitive
-- lives here — item_ids are opaque without read access to the item bank,
-- which stays staff-only under 012.
drop policy if exists "assessments_staff" on public.clf_assessments;
create policy "assessments_staff"
  on public.clf_assessments for all to authenticated
  using (public.clf_is_teaching_staff())
  with check (public.clf_is_teaching_staff());

drop policy if exists "assessments_read" on public.clf_assessments;
create policy "assessments_read"
  on public.clf_assessments for select to authenticated
  using (is_active);

-- Assignments: staff manage; a student sees the ones aimed at them.
drop policy if exists "assignments_staff" on public.clf_assessment_assignments;
create policy "assignments_staff"
  on public.clf_assessment_assignments for all to authenticated
  using (public.clf_is_teaching_staff())
  with check (public.clf_is_teaching_staff());

drop policy if exists "assignments_read_own" on public.clf_assessment_assignments;
create policy "assignments_read_own"
  on public.clf_assessment_assignments for select to authenticated
  using (
    student_user_id = auth.uid()
    or class_id in (select public.clf_my_class_ids())
  );

-- Runs and answers: written only by the SECURITY DEFINER RPCs below, so no
-- insert/update policy for students. They may read their own history.
drop policy if exists "runs_staff" on public.clf_assessment_runs;
create policy "runs_staff"
  on public.clf_assessment_runs for all to authenticated
  using (public.clf_is_teaching_staff())
  with check (public.clf_is_teaching_staff());

drop policy if exists "runs_read_own" on public.clf_assessment_runs;
create policy "runs_read_own"
  on public.clf_assessment_runs for select to authenticated
  using (student_user_id = auth.uid());

drop policy if exists "assessment_answers_staff" on public.clf_assessment_answers;
create policy "assessment_answers_staff"
  on public.clf_assessment_answers for all to authenticated
  using (public.clf_is_teaching_staff())
  with check (public.clf_is_teaching_staff());

drop policy if exists "assessment_answers_read_own" on public.clf_assessment_answers;
create policy "assessment_answers_read_own"
  on public.clf_assessment_answers for select to authenticated
  using (run_id in (
    select id from public.clf_assessment_runs where student_user_id = auth.uid()
  ));

-- ─── RPC: start (or resume) a run ─────────────────────────────────────
-- Resuming matters: a kid who closes the tab mid-test must land back in the
-- same run, not start a fresh one and get double the questions.
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

  -- An unfinished run for this assessment wins over creating a new one.
  select * into v_run from public.clf_assessment_runs
   where student_user_id = auth.uid()
     and assessment_id  = p_assessment
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

-- ─── RPC: next item ───────────────────────────────────────────────────
-- adaptive → an unseen item at p_level (p_skill narrows, null = any).
-- fixed    → the next unanswered item in the assessment's own order;
--            p_level / p_skill are ignored.
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
    'options', v_item.options
  ));
end $$;

-- ─── RPC: grade one answer ────────────────────────────────────────────
create or replace function public.clf_assessment_answer(
  p_run uuid, p_item uuid, p_choice int, p_ms int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_run record; v_item record; v_correct boolean;
begin
  select * into v_run from public.clf_assessment_runs
   where id = p_run and student_user_id = auth.uid() and status = 'in_progress';
  if v_run.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_run');
  end if;

  select * into v_item from public.clf_placement_items where id = p_item and active;
  if v_item.id is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_item');
  end if;

  v_correct := (p_choice is not distinct from v_item.correct_index);

  insert into public.clf_assessment_answers
    (run_id, item_id, yct_level, skill, chosen_index, is_correct, ms_taken)
  values (v_run.id, v_item.id, v_item.yct_level, v_item.skill, p_choice, v_correct, p_ms)
  on conflict (run_id, item_id) do nothing;

  -- Practice runs reveal the right answer so the child learns something;
  -- official runs stay silent so a wrong answer doesn't discourage them
  -- mid-test (and so answers can't be farmed from an assigned run).
  return jsonb_build_object(
    'ok', true,
    'is_correct', v_correct,
    'correct_index', case when v_run.is_practice then v_item.correct_index else null end
  );
end $$;

-- ─── RPC: submit + score ──────────────────────────────────────────────
create or replace function public.clf_assessment_submit(p_run uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_run     record;
  v_levels  jsonb := '{}'::jsonb;
  v_skills  jsonb := '{}'::jsonb;
  v_auto    int   := 1;
  v_conf    numeric := 0;
  v_n       int; v_correct int;
  r         record;
  c_min     constant int     := 3;
  c_pass    constant numeric := 0.70;
begin
  select * into v_run from public.clf_assessment_runs
   where id = p_run and student_user_id = auth.uid() and status = 'in_progress';
  if v_run.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_run');
  end if;

  select count(*)::int, count(*) filter (where is_correct)::int
    into v_n, v_correct
    from public.clf_assessment_answers where run_id = v_run.id;

  for r in
    select yct_level as lvl, count(*)::int as n,
           count(*) filter (where is_correct)::int as correct
      from public.clf_assessment_answers
     where run_id = v_run.id
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
      from public.clf_assessment_answers
     where run_id = v_run.id
     group by skill
  loop
    v_skills := v_skills || jsonb_build_object(
      r.skill, round(r.correct::numeric / greatest(r.n, 1), 2));
  end loop;

  update public.clf_assessment_runs
     set status          = 'submitted',
         submitted_at    = now(),
         n_items         = v_n,
         n_correct       = v_correct,
         score_pct       = case when v_n > 0
                                then round(v_correct::numeric / v_n, 2) else null end,
         auto_level      = case when v_run.kind = 'adaptive' then v_auto else null end,
         auto_confidence = case when v_run.kind = 'adaptive' then v_conf else null end,
         level_scores    = v_levels,
         skill_scores    = v_skills
   where id = v_run.id;

  return jsonb_build_object(
    'ok', true,
    'kind', v_run.kind,
    'n_items', v_n,
    'n_correct', v_correct,
    'score_pct', case when v_n > 0 then round(v_correct::numeric / v_n, 2) else null end,
    'auto_level', case when v_run.kind = 'adaptive' then v_auto else null end,
    'auto_confidence', case when v_run.kind = 'adaptive' then v_conf else null end,
    'level_scores', v_levels,
    'skill_scores', v_skills
  );
end $$;

-- ─── RPC: item bank browser for the fixed-test builder ────────────────
-- Teachers can already read clf_placement_items directly under 012's policy;
-- this exists so the builder can show a preview without the answer key
-- leaking into a component that a student-role user might also load.
create or replace function public.clf_assessment_item_bank(
  p_level int default null, p_skill text default null
) returns table (
  id uuid, code text, yct_level int, skill text, prompt text, options jsonb
)
language sql stable security definer set search_path = public as $$
  select i.id, i.code, i.yct_level, i.skill, i.prompt, i.options
    from public.clf_placement_items i
   where i.active
     and public.clf_is_teaching_staff()
     and (p_level is null or i.yct_level = p_level)
     and (p_skill is null or i.skill = p_skill)
   order by i.yct_level, i.skill, i.sort_order;
$$;

grant execute on function public.clf_assessment_start(uuid, uuid, boolean) to authenticated;
grant execute on function public.clf_assessment_next(uuid, int, text)      to authenticated;
grant execute on function public.clf_assessment_answer(uuid, uuid, int, int) to authenticated;
grant execute on function public.clf_assessment_submit(uuid)               to authenticated;
grant execute on function public.clf_assessment_item_bank(int, text)       to authenticated;
grant execute on function public.clf_my_class_ids()                        to authenticated;

-- ─── Seed one adaptive test so the panel isn't empty ──────────────────
insert into public.clf_assessments (title, description, kind, start_level, max_items, allow_practice)
  select 'YCT 水平测评', '自适应测评，估算当前 YCT 等级。可重复参加，用来看进步。',
         'adaptive', 2, 16, true
   where not exists (select 1 from public.clf_assessments where kind = 'adaptive');
