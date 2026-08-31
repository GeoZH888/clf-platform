-- 017_ai_calls.sql
-- One row per AI call, so "how is the AI doing?" becomes a question with an answer.
--
-- Nothing about AI usage is recorded today. Every generation, translation,
-- illustration and narration leaves no trace, so there is no way to know how
-- often a provider fails, how close calls run to the function timeout, what any
-- of it costs, or which feature is actually used.
--
-- Two incidents this session would have been visible here immediately: the
-- Opus-5 empty-response bug (ok=true, output_tokens=0) and the 504 timeout
-- (latency_ms pressed against the ceiling). Both took manual reproduction to
-- find.

create table if not exists clf_ai_calls (
  id            bigserial primary key,

  -- What was being attempted, in product terms rather than API terms:
  -- 'story_draft', 'translate', 'cover_image', 'story_tts', 'pronunciation'.
  feature       text        not null,
  action        text,                       -- the gateway action, where relevant
  provider      text,                       -- claude | openai | deepseek | gemini | azure | stability | ideogram
  model         text,

  ok            boolean     not null,
  -- Coarse failure class, NOT the raw message: 'timeout', 'rate_limit',
  -- 'auth', 'empty_response', 'bad_json', 'provider_error', 'network'.
  -- Groupable, and it cannot accidentally carry user content.
  error_kind    text,
  error_detail  text,                       -- first 200 chars, for diagnosis

  latency_ms    integer,
  input_tokens  integer,
  output_tokens integer,

  -- Deliberately NOT stored: prompts and completions. They are large, they
  -- contain learner content, and none of the questions this table exists to
  -- answer need them.
  meta          jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

comment on table clf_ai_calls is
  'One row per AI provider call. No prompt or completion text is stored.';

create index if not exists clf_ai_calls_time_idx    on clf_ai_calls (created_at desc);
create index if not exists clf_ai_calls_feature_idx on clf_ai_calls (feature, created_at desc);
create index if not exists clf_ai_calls_fail_idx    on clf_ai_calls (created_at desc) where not ok;

-- ── Dashboard rollup ──────────────────────────────────────────────────────
-- Per feature, per provider, per day: volume, failure rate, latency, tokens.
-- p95 rather than a mean: an average hides the slow tail, and the slow tail is
-- what hits the function timeout.
create or replace view clf_ai_daily as
select
  (created_at at time zone 'UTC')::date               as day,
  feature,
  provider,
  count(*)                                            as calls,
  count(*) filter (where not ok)                      as failures,
  round(100.0 * count(*) filter (where not ok) / nullif(count(*), 0), 1) as failure_pct,
  round(avg(latency_ms))                              as avg_ms,
  percentile_disc(0.95) within group (order by latency_ms) as p95_ms,
  max(latency_ms)                                     as max_ms,
  sum(coalesce(input_tokens, 0))                      as in_tokens,
  sum(coalesce(output_tokens, 0))                     as out_tokens
from clf_ai_calls
group by day, feature, provider;

comment on view clf_ai_daily is
  'Feeds the AI performance dashboard. p95 is the number that predicts timeouts.';

-- ── RLS ───────────────────────────────────────────────────────────────────
alter table clf_ai_calls enable row level security;

-- Written by Netlify functions using the service role, which bypasses RLS —
-- so no insert policy is granted to anyone else. A browser cannot forge usage.
drop policy if exists "staff read ai calls" on clf_ai_calls;
create policy "staff read ai calls" on clf_ai_calls
  for select using (
    exists (
      select 1 from clf_user_profiles p
       where p.user_id = auth.uid()
         and p.role in ('super_admin', 'school_master')
         and coalesce(p.is_active, true)
    )
  );
