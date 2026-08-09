-- ════════════════════════════════════════════════════════════════════
-- STAGE 2 ROLLBACK
-- ════════════════════════════════════════════════════════════════════
-- Drops all dwxz_* tables created by Stage 2.
-- WARNING: any data inserted into these tables will be lost.
--
-- Does NOT drop dwxz_panda_assets (existed before Stage 2).
-- Does NOT touch jgw_registrations or other CLF tables.

BEGIN;

DROP TABLE IF EXISTS public.dwxz_ai_agent_conversations CASCADE;
DROP TABLE IF EXISTS public.dwxz_ai_jobs CASCADE;
DROP TABLE IF EXISTS public.dwxz_ai_recommendations CASCADE;
DROP TABLE IF EXISTS public.dwxz_ai_settings CASCADE;
DROP TABLE IF EXISTS public.dwxz_ai_usage_logs CASCADE;
DROP TABLE IF EXISTS public.dwxz_attendance CASCADE;
DROP TABLE IF EXISTS public.dwxz_attendance_records CASCADE;
DROP TABLE IF EXISTS public.dwxz_attendance_sessions CASCADE;
DROP TABLE IF EXISTS public.dwxz_captioning_stats CASCADE;
DROP TABLE IF EXISTS public.dwxz_chengyu CASCADE;
DROP TABLE IF EXISTS public.dwxz_class_attendance CASCADE;
DROP TABLE IF EXISTS public.dwxz_class_enrollments CASCADE;
DROP TABLE IF EXISTS public.dwxz_class_lessons CASCADE;
DROP TABLE IF EXISTS public.dwxz_class_students CASCADE;
DROP TABLE IF EXISTS public.dwxz_classes CASCADE;
DROP TABLE IF EXISTS public.dwxz_custom_knowledge_points CASCADE;
DROP TABLE IF EXISTS public.dwxz_dataset_stats CASCADE;
DROP TABLE IF EXISTS public.dwxz_events CASCADE;
DROP TABLE IF EXISTS public.dwxz_exhibition_plans CASCADE;
DROP TABLE IF EXISTS public.dwxz_grades CASCADE;
DROP TABLE IF EXISTS public.dwxz_homework CASCADE;
DROP TABLE IF EXISTS public.dwxz_homework_submissions CASCADE;
DROP TABLE IF EXISTS public.dwxz_hsk_audio_files CASCADE;
DROP TABLE IF EXISTS public.dwxz_hsk_test_answers CASCADE;
DROP TABLE IF EXISTS public.dwxz_hsk_test_attempts CASCADE;
DROP TABLE IF EXISTS public.dwxz_hsk_test_papers CASCADE;
DROP TABLE IF EXISTS public.dwxz_hsk_test_questions CASCADE;
DROP TABLE IF EXISTS public.dwxz_hsk_test_sections CASCADE;
DROP TABLE IF EXISTS public.dwxz_hsk_test_stats CASCADE;
DROP TABLE IF EXISTS public.dwxz_invitation_codes CASCADE;
DROP TABLE IF EXISTS public.dwxz_invites CASCADE;
DROP TABLE IF EXISTS public.dwxz_join_requests CASCADE;
DROP TABLE IF EXISTS public.dwxz_knowledge_categories CASCADE;
DROP TABLE IF EXISTS public.dwxz_knowledge_materials CASCADE;
DROP TABLE IF EXISTS public.dwxz_material_categories CASCADE;
DROP TABLE IF EXISTS public.dwxz_messages CASCADE;
DROP TABLE IF EXISTS public.dwxz_notifications CASCADE;
DROP TABLE IF EXISTS public.dwxz_panda_assets CASCADE;
DROP TABLE IF EXISTS public.dwxz_parent_messages CASCADE;
DROP TABLE IF EXISTS public.dwxz_parent_student_links CASCADE;
DROP TABLE IF EXISTS public.dwxz_point_transactions CASCADE;
DROP TABLE IF EXISTS public.dwxz_points_transactions CASCADE;
DROP TABLE IF EXISTS public.dwxz_rag_chunks CASCADE;
DROP TABLE IF EXISTS public.dwxz_rag_config CASCADE;
DROP TABLE IF EXISTS public.dwxz_rag_config_backup CASCADE;
DROP TABLE IF EXISTS public.dwxz_rag_documents CASCADE;
DROP TABLE IF EXISTS public.dwxz_rag_files CASCADE;
DROP TABLE IF EXISTS public.dwxz_rag_knowledge_bases CASCADE;
DROP TABLE IF EXISTS public.dwxz_rag_query_logs CASCADE;
DROP TABLE IF EXISTS public.dwxz_reward_redemptions CASCADE;
DROP TABLE IF EXISTS public.dwxz_rewards CASCADE;
DROP TABLE IF EXISTS public.dwxz_schools CASCADE;
DROP TABLE IF EXISTS public.dwxz_student_learning_profiles CASCADE;
DROP TABLE IF EXISTS public.dwxz_student_mistake_patterns CASCADE;
DROP TABLE IF EXISTS public.dwxz_student_points CASCADE;
DROP TABLE IF EXISTS public.dwxz_system_settings CASCADE;
DROP TABLE IF EXISTS public.dwxz_teacher_teaching_profiles CASCADE;
DROP TABLE IF EXISTS public.dwxz_teaching_materials CASCADE;
DROP TABLE IF EXISTS public.dwxz_teaching_progress CASCADE;
DROP TABLE IF EXISTS public.dwxz_training_configs CASCADE;
DROP TABLE IF EXISTS public.dwxz_training_images CASCADE;
DROP TABLE IF EXISTS public.dwxz_training_materials CASCADE;
DROP TABLE IF EXISTS public.dwxz_training_stats CASCADE;
DROP TABLE IF EXISTS public.dwxz_user_applications CASCADE;
DROP TABLE IF EXISTS public.dwxz_user_points CASCADE;

COMMIT;

-- Verify rollback
SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'dwxz_%';
-- Expected: 1 (dwxz_panda_assets remaining)
