-- ════════════════════════════════════════════════════════════════════
-- STAGE 2 SCHEMA AUDIT
-- ════════════════════════════════════════════════════════════════════
-- Run on DAVID's Supabase (https://wrpyhgklasdtgdtyuief.supabase.co)
-- READ-ONLY. Extracts the schema of all 63 David tables so we can
-- recreate them in CLF with dwxz_ prefix.

-- Run each query separately. Save each output as CSV.

-- ─────────────────────────────────────────────────────────────────
-- Query 1: All columns of all tables (the schema)
-- ─────────────────────────────────────────────────────────────────
SELECT
  table_name,
  column_name,
  data_type,
  udt_name,
  character_maximum_length,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Save as: 1_david_columns.csv


-- ─────────────────────────────────────────────────────────────────
-- Query 2: Primary keys
-- ─────────────────────────────────────────────────────────────────
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.ordinal_position;

-- Save as: 2_david_pks.csv


-- ─────────────────────────────────────────────────────────────────
-- Query 3: Foreign keys
-- ─────────────────────────────────────────────────────────────────
SELECT
  tc.table_name AS child_table,
  kcu.column_name AS child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column,
  tc.constraint_name,
  rc.update_rule,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Save as: 3_david_fks.csv


-- ─────────────────────────────────────────────────────────────────
-- Query 4: Indexes (excluding primary keys)
-- ─────────────────────────────────────────────────────────────────
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;

-- Save as: 4_david_indexes.csv


-- ─────────────────────────────────────────────────────────────────
-- Query 5: CHECK constraints
-- ─────────────────────────────────────────────────────────────────
SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Save as: 5_david_checks.csv


-- ─────────────────────────────────────────────────────────────────
-- Query 6: Unique constraints
-- ─────────────────────────────────────────────────────────────────
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- Save as: 6_david_uniques.csv
