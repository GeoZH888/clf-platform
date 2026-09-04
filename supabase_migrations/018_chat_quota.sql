-- 018_chat_quota.sql
-- The free-tier allowance for 智能对话 (the AI chat tutor).
--
-- One row. No new table, no DDL beyond the insert — clf_app_settings already
-- exists from 014, and is already readable by anonymous visitors by design.
--
-- WHY A SECOND ALLOWANCE, rather than reusing free_minutes_per_day:
-- the minute meter is the wrong unit for a conversation. Reading a reply,
-- looking up a character and composing an answer is mostly thinking time, and
-- thinking time is exactly what a language learner ought to be spending. A
-- learner who takes four minutes over one sentence has done the exercise
-- properly and would be cut off for it. Cost is incurred per message, so
-- messages are what is counted.
--
-- Seeded at 0 = UNLIMITED, matching free_minutes_per_day and the launch policy
-- of open free use. The machinery ships switched off rather than absent:
-- turning it on later is a number here, not a deploy.

insert into clf_app_settings (key, value, description) values
  ('chat_free_messages_per_day',
   '0'::jsonb,
   'Tutor replies an unpaid visitor gets per day in 智能对话. 0 = unlimited (launch setting). Counted per device like the minute meter, so clearing browser storage resets it — a nudge toward an account, not a wall.')
on conflict (key) do nothing;
