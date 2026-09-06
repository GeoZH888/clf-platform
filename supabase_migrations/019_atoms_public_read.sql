-- 019_atoms_public_read.sql
-- Let a signed-out visitor read the curriculum, so 知识地图 works without login.
--
-- clf_atoms holds the learning units themselves — characters, words, grammar
-- points. It is the syllabus, not anybody's private data: every atom in it is
-- already visible in the modules that teach it. What IS private is
-- clf_user_learning_state (who has learned what), and that stays untouched.
--
-- Querying this table with the anon key returns zero rows today. That is either
-- an empty table or RLS with no anon policy, and the two are indistinguishable
-- from outside — PostgREST returns [] for both. This migration settles the
-- second case and is inert in the first.
--
-- Deliberately NOT running `alter table ... enable row level security`: if RLS
-- is currently off, switching it on here would start blocking every write that
-- works today, to fix a read problem. A select policy on a table without RLS is
-- simply inert, so this is safe whichever state the table is in.

drop policy if exists "public reads atoms" on clf_atoms;
create policy "public reads atoms" on clf_atoms
  for select using (true);

comment on table clf_atoms is
  'The curriculum: one row per learning unit. Publicly readable — who has learned what lives in clf_user_learning_state, which is not.';
