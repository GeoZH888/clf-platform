-- 017_item_provenance.sql
-- Where a question came from.
--
-- Questions can now be drafted from the RAG corpus — retrieve chunks of the
-- school's own teaching material, then write items grounded in them. When a
-- teacher later asks "why does this question say 一本书 and not 一个书", the
-- answer should be a passage from a textbook, not a shrug.
--
-- No RPC republish needed, unlike 015 and 016: provenance is staff-only
-- metadata, never sent to the quiz, so the item-delivery functions don't
-- name these columns on purpose.
--
-- Requires: 012_placement_assessment.sql and 001_new_infrastructure.sql
-- (content_sources). Safe to re-run.

alter table public.clf_placement_items
  add column if not exists source_id    uuid references public.content_sources(id) on delete set null,
  add column if not exists source_quote text,
  add column if not exists origin       text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clf_placement_items_origin_chk'
  ) then
    alter table public.clf_placement_items
      add constraint clf_placement_items_origin_chk
      check (origin in ('manual', 'seed', 'ai', 'ai_rag'));
  end if;
end $$;

comment on column public.clf_placement_items.source_id is
  'Corpus document this question was drafted from (RAG), if any.';
comment on column public.clf_placement_items.source_quote is
  'The retrieved passage the question was grounded in — shown to staff for review.';
comment on column public.clf_placement_items.origin is
  'manual = typed by a person, seed = shipped with 012, ai = AI-drafted from a topic, ai_rag = AI-drafted from corpus material.';

create index if not exists idx_placement_items_source
  on public.clf_placement_items (source_id);

-- The 32 items shipped in 012 predate this column; label them so the bank can
-- distinguish "came with the platform" from "we wrote this".
update public.clf_placement_items
   set origin = 'seed'
 where code is not null and origin = 'manual';
