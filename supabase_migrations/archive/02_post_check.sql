-- ════════════════════════════════════════════════════════════════════
-- STAGE 2 POST-CHECK
-- ════════════════════════════════════════════════════════════════════
-- Run on CLF Supabase AFTER 01_dwxz_schema.sql succeeds.
-- All checks should match expected values.

-- 1. Count of dwxz_ tables created
SELECT count(*) AS dwxz_table_count
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'dwxz_%';
-- Expected: 66 (65 newly created + 1 dwxz_panda_assets that was already there from CLF prior)
-- If dwxz_panda_assets is NOT in CLF currently, expected: 65

-- 2. List of created dwxz_ tables (sanity check)
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'dwxz_%'
ORDER BY tablename;

-- 3. Verify FKs to jgw_registrations exist (5 expected)
SELECT
  tc.table_name AS child_table,
  kcu.column_name AS child_column,
  ccu.table_name AS parent_table,
  ccu.column_name AS parent_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND ccu.table_name = 'jgw_registrations'
ORDER BY tc.table_name, kcu.column_name;
-- Expected: 5 rows
--   dwxz_attendance, student_id → jgw_registrations.approved_user_id
--   dwxz_class_students, student_id → jgw_registrations.approved_user_id
--   dwxz_grades, student_id → jgw_registrations.approved_user_id
--   dwxz_parent_student_links, parent_id → jgw_registrations.approved_user_id
--   dwxz_parent_student_links, student_id → jgw_registrations.approved_user_id

-- 4. Total FK constraints on dwxz_ tables (33 expected)
SELECT count(*) AS dwxz_fk_count
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name LIKE 'dwxz_%';
-- Expected: 33

-- 5. Verify vector extension enabled (for rag_chunks)
SELECT extname FROM pg_extension WHERE extname = 'vector';
-- Expected: 1 row

-- 6. Spot check: dwxz_rag_chunks has expected columns including embedding
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'dwxz_rag_chunks' AND table_schema = 'public'
ORDER BY ordinal_position;
-- Expected: id, document_id, knowledge_base_id, content, chunk_index, metadata, created_at, embedding
-- embedding row should show data_type=USER-DEFINED, udt_name=vector

-- 7. All dwxz_ tables are empty (no data was migrated, only schema)
SELECT 'dwxz_users_total_rows' AS metric, 
       (SELECT count(*) FROM dwxz_classes) +
       (SELECT count(*) FROM dwxz_homework) +
       (SELECT count(*) FROM dwxz_rag_chunks) +
       (SELECT count(*) FROM dwxz_schools)
       AS value;
-- Expected: 0

-- 8. CLF data is intact (no impact from Stage 2)
SELECT count(*) FROM jgw_registrations;
-- Expected: 4 (unchanged from Stage 1A)
