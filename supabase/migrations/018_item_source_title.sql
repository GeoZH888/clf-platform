-- 018_item_source_title.sql
-- Record which document a RAG-drafted question came from, by name.
--
-- 017 added source_id pointing at content_sources, on the assumption that
-- retrieval would hand back a document id. It doesn't: rag-search returns
-- content, document_title, collection_slug, subject_slug, grade_level and
-- similarity — no id — so source_id was always going to be null on every
-- RAG-drafted item.
--
-- Store the title and collection instead. That is what retrieval actually
-- knows, and it is what a reviewer needs to find the passage again.
-- source_id stays for anything that can supply one.
--
-- Requires: 017_item_provenance.sql. Safe to re-run.

alter table public.clf_placement_items
  add column if not exists source_title      text,
  add column if not exists source_collection text;

comment on column public.clf_placement_items.source_title is
  'Title of the corpus document the question was drafted from (from rag-search).';
comment on column public.clf_placement_items.source_collection is
  'Corpus collection slug the passage came from: renjiao / hsk / chengyu / jijiao_fujian.';
