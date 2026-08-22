-- ════════════════════════════════════════════════════════════════════
-- STAGE 2: CLONE DAVID SCHEMA AS dwxz_* IN CLF
-- ════════════════════════════════════════════════════════════════════
-- Generated from David's actual schema audit.
-- Run on CLF Supabase. Atomic — wrapped in BEGIN/COMMIT.
--
-- Skips:
--   - dwxz_panda_assets (already prefixed in David, would collide)
--   - users (already migrated to jgw_registrations in Stage 1A)
--
-- Foreign keys to public.users → rewritten to jgw_registrations(approved_user_id)
-- All other FKs → rewritten to dwxz_<parent_table>

-- Required extensions (safe to run if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;       -- for rag_chunks.embedding (pgvector)
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- for gen_random_uuid()

BEGIN;

-- ── ai_agent_conversations → dwxz_ai_agent_conversations ──
CREATE TABLE IF NOT EXISTS public.dwxz_ai_agent_conversations (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                        uuid,
  agent_type                     text NOT NULL,
  session_id                     uuid,
  role                           text NOT NULL,
  content                        text NOT NULL,
  metadata                       jsonb,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── ai_jobs → dwxz_ai_jobs ──
CREATE TABLE IF NOT EXISTS public.dwxz_ai_jobs (
  id                             uuid NOT NULL,
  status                         text DEFAULT 'pending'::text,
  action                         text,
  result                         jsonb,
  created_at                     timestamptz DEFAULT now(),
  updated_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── ai_recommendations → dwxz_ai_recommendations ──
CREATE TABLE IF NOT EXISTS public.dwxz_ai_recommendations (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                        uuid,
  recommendation_type            text,
  title                          text,
  description                    text,
  resource_id                    uuid,
  resource_type                  text,
  priority                       integer DEFAULT 0,
  is_completed                   boolean DEFAULT false,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── ai_settings → dwxz_ai_settings ──
CREATE TABLE IF NOT EXISTS public.dwxz_ai_settings (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  provider                       text DEFAULT 'anthropic'::character varying,
  model                          text DEFAULT 'claude-sonnet-4-20250514'::character varying,
  api_key                        text,
  api_url                        text,
  max_tokens                     integer DEFAULT 4096,
  temperature                    numeric DEFAULT 0.7,
  system_prompt                  text,
  is_active                      boolean DEFAULT true,
  updated_by                     uuid,
  updated_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── ai_usage_logs → dwxz_ai_usage_logs ──
CREATE TABLE IF NOT EXISTS public.dwxz_ai_usage_logs (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  provider                       text NOT NULL,
  model                          text,
  action                         text,
  tokens_used                    integer DEFAULT 0,
  cost_estimate                  numeric DEFAULT 0,
  user_id                        uuid,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── attendance → dwxz_attendance ──
CREATE TABLE IF NOT EXISTS public.dwxz_attendance (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id                       uuid,
  student_id                     uuid,
  date                           date NOT NULL,
  status                         text DEFAULT 'absent'::text,
  recorded_by                    uuid,
  created_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── attendance_records → dwxz_attendance_records ──
CREATE TABLE IF NOT EXISTS public.dwxz_attendance_records (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id                     uuid,
  student_id                     uuid,
  check_in_time                  timestamp DEFAULT now(),
  check_in_method                text DEFAULT 'qr'::character varying,
  status                         text DEFAULT 'present'::character varying,
  notes                          text,
  PRIMARY KEY (id)
);

-- ── attendance_sessions → dwxz_attendance_sessions ──
CREATE TABLE IF NOT EXISTS public.dwxz_attendance_sessions (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id                       uuid,
  teacher_id                     uuid,
  session_date                   date NOT NULL,
  start_time                     timestamp,
  end_time                       timestamp,
  qr_code                        text,
  status                         text DEFAULT 'active'::character varying,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── captioning_stats → dwxz_captioning_stats ──
CREATE TABLE IF NOT EXISTS public.dwxz_captioning_stats (
  ready_for_training             bigint,
  approved_no_caption            bigint,
  captioned_not_approved         bigint,
  caption_pct                    numeric,
  approved_pct                   numeric
);

-- ── chengyu → dwxz_chengyu ──
CREATE TABLE IF NOT EXISTS public.dwxz_chengyu (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  chengyu                        text NOT NULL,
  pinyin                         text,
  literal                        text,
  meaning_zh                     text,
  meaning_en                     text,
  meaning_it                     text,
  story                          text,
  story_en                       text,
  example                        text,
  example_en                     text,
  category                       text DEFAULT 'fable'::character varying,
  hsk_level                      integer DEFAULT 3,
  is_active                      boolean DEFAULT true,
  created_at                     timestamp DEFAULT now(),
  updated_at                     timestamp DEFAULT now(),
  created_by                     uuid,
  PRIMARY KEY (id),
  CONSTRAINT dwxz_chengyu_hsk_level_check CHECK (((hsk_level >= 1) AND (hsk_level <= 6)))
);

-- ── class_attendance → dwxz_class_attendance ──
CREATE TABLE IF NOT EXISTS public.dwxz_class_attendance (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id                       uuid,
  student_id                     uuid,
  date                           date NOT NULL,
  status                         text,
  recorded_by                    uuid,
  created_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT dwxz_class_attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'excused'::text])))
);

-- ── class_enrollments → dwxz_class_enrollments ──
CREATE TABLE IF NOT EXISTS public.dwxz_class_enrollments (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id                       uuid,
  student_id                     uuid,
  enrolled_at                    timestamp DEFAULT now(),
  status                         text DEFAULT 'active'::character varying,
  PRIMARY KEY (id)
);

-- ── class_lessons → dwxz_class_lessons ──
CREATE TABLE IF NOT EXISTS public.dwxz_class_lessons (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id                       uuid,
  title                          text NOT NULL,
  lesson_date                    date,
  start_time                     time,
  end_time                       time,
  room                           text,
  notes                          text,
  created_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── class_students → dwxz_class_students ──
CREATE TABLE IF NOT EXISTS public.dwxz_class_students (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id                       uuid,
  student_id                     uuid,
  status                         text DEFAULT 'active'::text,
  joined_at                      timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── classes → dwxz_classes ──
CREATE TABLE IF NOT EXISTS public.dwxz_classes (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id                      uuid,
  teacher_id                     uuid,
  name                           text NOT NULL,
  name_zh                        text,
  description                    text,
  hsk_level                      integer DEFAULT 1,
  schedule                       text,
  max_students                   integer DEFAULT 30,
  is_active                      boolean DEFAULT true,
  created_at                     timestamp DEFAULT now(),
  level                          text,
  room                           text,
  color                          text DEFAULT '#c41e3a'::text,
  PRIMARY KEY (id)
);

-- ── custom_knowledge_points → dwxz_custom_knowledge_points ──
CREATE TABLE IF NOT EXISTS public.dwxz_custom_knowledge_points (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id                       uuid,
  hsk_level                      integer,
  label                          text,
  teacher_id                     uuid,
  created_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── dataset_stats → dwxz_dataset_stats ──
CREATE TABLE IF NOT EXISTS public.dwxz_dataset_stats (
  project_id                     text,
  total_images                   bigint,
  approved_count                 bigint,
  captioned_count                bigint,
  score_5                        bigint,
  score_4                        bigint,
  score_3                        bigint,
  score_2                        bigint,
  score_1                        bigint,
  unscored                       bigint,
  avg_quality                    numeric,
  total_mb                       numeric
);

-- ── events → dwxz_events ──
CREATE TABLE IF NOT EXISTS public.dwxz_events (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  title                          text,
  title_zh                       text,
  description                    text,
  description_zh                 text,
  start_date                     timestamptz,
  end_date                       timestamptz,
  location                       text,
  event_type                     text,
  is_active                      boolean DEFAULT true,
  created_by                     uuid,
  created_at                     timestamptz DEFAULT now(),
  updated_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── exhibition_plans → dwxz_exhibition_plans ──
CREATE TABLE IF NOT EXISTS public.dwxz_exhibition_plans (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id                     text NOT NULL,
  planned                        boolean DEFAULT false,
  notes                          text DEFAULT ''::text,
  quantity                       integer DEFAULT 0,
  budget_cny                     numeric DEFAULT 0,
  supplier                       text DEFAULT ''::text,
  deadline                       date,
  created_at                     timestamptz DEFAULT now(),
  updated_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── grades → dwxz_grades ──
CREATE TABLE IF NOT EXISTS public.dwxz_grades (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id                       uuid,
  student_id                     uuid,
  score                          numeric,
  note                           text,
  date                           date DEFAULT CURRENT_DATE,
  created_by                     uuid,
  created_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── homework → dwxz_homework ──
CREATE TABLE IF NOT EXISTS public.dwxz_homework (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id                       uuid,
  teacher_id                     uuid,
  title                          text NOT NULL,
  title_zh                       text,
  description                    text,
  description_zh                 text,
  instructions                   text,
  instructions_zh                text,
  reading_text                   text,
  reading_text_zh                text,
  type                           text DEFAULT 'general'::character varying,
  due_date                       timestamp NOT NULL,
  max_score                      integer DEFAULT 100,
  is_active                      boolean DEFAULT true,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── homework_submissions → dwxz_homework_submissions ──
CREATE TABLE IF NOT EXISTS public.dwxz_homework_submissions (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  homework_id                    uuid,
  student_id                     uuid,
  content                        text,
  voice_recording                text,
  file_url                       text,
  status                         text DEFAULT 'submitted'::character varying,
  score                          integer,
  feedback                       text,
  teacher_correction_audio       text,
  graded_at                      timestamp,
  graded_by                      uuid,
  submitted_at                   timestamp DEFAULT now(),
  updated_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── hsk_audio_files → dwxz_hsk_audio_files ──
CREATE TABLE IF NOT EXISTS public.dwxz_hsk_audio_files (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id                       uuid,
  filename                       text NOT NULL,
  original_filename              text,
  file_url                       text,
  file_size                      integer,
  duration                       integer,
  transcript                     text,
  transcript_pinyin              text,
  transcript_source              text DEFAULT 'none'::character varying,
  transcription_status           text DEFAULT 'pending'::character varying,
  transcription_error            text,
  language                       text DEFAULT 'zh'::character varying,
  speaker_count                  integer DEFAULT 1,
  created_at                     timestamp DEFAULT now(),
  updated_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── hsk_test_answers → dwxz_hsk_test_answers ──
CREATE TABLE IF NOT EXISTS public.dwxz_hsk_test_answers (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id                     uuid,
  question_id                    uuid,
  student_answer                 text,
  is_correct                     boolean,
  points_earned                  numeric DEFAULT 0,
  teacher_score                  numeric,
  teacher_feedback               text,
  graded_by                      uuid,
  graded_at                      timestamp,
  answered_at                    timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── hsk_test_attempts → dwxz_hsk_test_attempts ──
CREATE TABLE IF NOT EXISTS public.dwxz_hsk_test_attempts (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id                     uuid NOT NULL,
  paper_id                       uuid,
  status                         text DEFAULT 'in_progress'::character varying,
  started_at                     timestamp DEFAULT now(),
  completed_at                   timestamp,
  time_spent                     integer DEFAULT 0,
  total_score                    numeric DEFAULT 0,
  max_score                      numeric DEFAULT 0,
  percentage                     numeric DEFAULT 0,
  listening_score                numeric DEFAULT 0,
  reading_score                  numeric DEFAULT 0,
  writing_score                  numeric DEFAULT 0,
  correct_count                  integer DEFAULT 0,
  wrong_count                    integer DEFAULT 0,
  unanswered_count               integer DEFAULT 0,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── hsk_test_papers → dwxz_hsk_test_papers ──
CREATE TABLE IF NOT EXISTS public.dwxz_hsk_test_papers (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  name                           text NOT NULL,
  name_zh                        text,
  hsk_level                      integer NOT NULL,
  year                           integer,
  test_type                      text DEFAULT 'official'::character varying,
  source                         text,
  description                    text,
  total_questions                integer DEFAULT 0,
  total_duration                 integer DEFAULT 0,
  listening_questions            integer DEFAULT 0,
  reading_questions              integer DEFAULT 0,
  writing_questions              integer DEFAULT 0,
  is_active                      boolean DEFAULT true,
  created_by                     uuid,
  created_at                     timestamp DEFAULT now(),
  updated_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT dwxz_hsk_test_papers_hsk_level_check CHECK (((hsk_level >= 1) AND (hsk_level <= 6)))
);

-- ── hsk_test_questions → dwxz_hsk_test_questions ──
CREATE TABLE IF NOT EXISTS public.dwxz_hsk_test_questions (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id                       uuid,
  section_id                     uuid,
  question_number                integer NOT NULL,
  question_type                  text NOT NULL,
  question_text                  text,
  question_text_zh               text,
  question_image_url             text,
  audio_url                      text,
  audio_duration                 integer,
  audio_transcript               text,
  audio_transcript_pinyin        text,
  transcript_source              text DEFAULT 'none'::character varying,
  options                        jsonb DEFAULT '[]'::jsonb,
  correct_answer                 text,
  answer_explanation             text,
  answer_explanation_zh          text,
  difficulty                     integer DEFAULT 3,
  points                         integer DEFAULT 1,
  tags                           text[],
  is_indexed                     boolean DEFAULT false,
  embedding_id                   uuid,
  sort_order                     integer DEFAULT 0,
  created_at                     timestamp DEFAULT now(),
  updated_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT dwxz_hsk_test_questions_difficulty_check CHECK (((difficulty >= 1) AND (difficulty <= 5)))
);

-- ── hsk_test_sections → dwxz_hsk_test_sections ──
CREATE TABLE IF NOT EXISTS public.dwxz_hsk_test_sections (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id                       uuid,
  section_type                   text NOT NULL,
  section_number                 integer DEFAULT 1,
  title                          text,
  title_zh                       text,
  instructions                   text,
  instructions_zh                text,
  duration                       integer DEFAULT 0,
  question_count                 integer DEFAULT 0,
  sort_order                     integer DEFAULT 0,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── hsk_test_stats → dwxz_hsk_test_stats ──
CREATE TABLE IF NOT EXISTS public.dwxz_hsk_test_stats (
  id                             uuid,
  name_zh                        text,
  hsk_level                      integer,
  year                           integer,
  attempt_count                  bigint,
  student_count                  bigint,
  avg_score                      numeric,
  highest_score                  numeric
);

-- ── invitation_codes → dwxz_invitation_codes ──
CREATE TABLE IF NOT EXISTS public.dwxz_invitation_codes (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  code                           text NOT NULL,
  role                           text NOT NULL,
  school_id                      uuid,
  class_id                       uuid,
  max_uses                       integer DEFAULT 1,
  current_uses                   integer DEFAULT 0,
  expires_at                     timestamp,
  created_by                     uuid,
  is_active                      boolean DEFAULT true,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── invites → dwxz_invites ──
CREATE TABLE IF NOT EXISTS public.dwxz_invites (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  code                           text NOT NULL,
  role                           text NOT NULL,
  used                           integer DEFAULT 0,
  max_uses                       integer DEFAULT 10,
  note                           text,
  school_id                      uuid,
  is_active                      boolean DEFAULT true,
  created_at                     timestamptz DEFAULT now(),
  expires_at                     date,
  PRIMARY KEY (id)
);

-- ── join_requests → dwxz_join_requests ──
CREATE TABLE IF NOT EXISTS public.dwxz_join_requests (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_name                      text,
  user_name_zh                   text,
  class_name                     text,
  school                         text,
  role                           text DEFAULT 'student'::text,
  status                         text DEFAULT 'pending'::text,
  note                           text,
  created_at                     timestamptz DEFAULT now(),
  updated_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── knowledge_categories → dwxz_knowledge_categories ──
CREATE TABLE IF NOT EXISTS public.dwxz_knowledge_categories (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  name                           text NOT NULL,
  name_zh                        text,
  parent_id                      uuid,
  icon                           text,
  sort_order                     integer DEFAULT 0,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── knowledge_materials → dwxz_knowledge_materials ──
CREATE TABLE IF NOT EXISTS public.dwxz_knowledge_materials (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  knowledge_base_id              uuid,
  title                          text,
  title_zh                       text,
  file_name                      text,
  file_type                      text,
  file_size                      integer,
  file_url                       text,
  file_data                      text,
  category                       text DEFAULT 'textbook'::character varying,
  hsk_levels                     int4[] DEFAULT '{1,2,3,4,5,6}'::integer[],
  extracted_text                 text,
  chunk_count                    integer DEFAULT 0,
  status                         text DEFAULT 'pending'::character varying,
  tags                           text[],
  metadata                       jsonb DEFAULT '{}'::jsonb,
  uploaded_by                    uuid,
  created_at                     timestamp DEFAULT now(),
  updated_at                     timestamp DEFAULT now(),
  ai_classify_confidence         double precision,
  ai_classify_method             text,
  summary                        text,
  storage_path                   text,
  storage_url                    text,
  pages                          integer,
  pages_read                     integer,
  pagesRead                      integer,
  PRIMARY KEY (id)
);

-- ── material_categories → dwxz_material_categories ──
CREATE TABLE IF NOT EXISTS public.dwxz_material_categories (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  name                           text NOT NULL,
  name_zh                        text,
  parent_id                      uuid,
  description                    text,
  created_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── messages → dwxz_messages ──
-- Note: David's audit reported a composite PK (id, inserted_at) which appears
-- to be a Supabase realtime.messages constraint leaking into the public schema
-- audit. The actual public.messages table has only `id, sender_id, receiver_id,
-- subject, content, is_read, parent_id, created_at` — no `inserted_at` column.
-- Using simple PK on id only.
CREATE TABLE IF NOT EXISTS public.dwxz_messages (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id                      uuid,
  receiver_id                    uuid,
  subject                        text,
  content                        text NOT NULL,
  is_read                        boolean DEFAULT false,
  parent_id                      uuid,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── notifications → dwxz_notifications ──
CREATE TABLE IF NOT EXISTS public.dwxz_notifications (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                        uuid,
  type                           text NOT NULL,
  title                          text NOT NULL,
  content                        text,
  is_read                        boolean DEFAULT false,
  link                           text,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── panda_assets → dwxz_panda_assets ──
CREATE TABLE IF NOT EXISTS public.dwxz_panda_assets (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  emotion                        text NOT NULL,
  emotion_zh                     text,
  image_url                      text,
  prompt                         text,
  color                          text,
  usage_desc                     text,
  created_at                     timestamptz DEFAULT now(),
  updated_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── parent_messages → dwxz_parent_messages ──
CREATE TABLE IF NOT EXISTS public.dwxz_parent_messages (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  from_id                        uuid,
  from_name                      text,
  to_id                          uuid,
  subject                        text,
  content                        text,
  is_read                        boolean DEFAULT false,
  created_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── parent_student_links → dwxz_parent_student_links ──
CREATE TABLE IF NOT EXISTS public.dwxz_parent_student_links (
  parent_id                      uuid NOT NULL,
  student_id                     uuid NOT NULL,
  PRIMARY KEY (parent_id, student_id)
);

-- ── point_transactions → dwxz_point_transactions ──
CREATE TABLE IF NOT EXISTS public.dwxz_point_transactions (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id                     uuid,
  amount                         integer NOT NULL,
  reason                         text,
  source                         text,
  created_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── points_transactions → dwxz_points_transactions ──
CREATE TABLE IF NOT EXISTS public.dwxz_points_transactions (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                        uuid,
  points                         integer NOT NULL,
  type                           text NOT NULL,
  description                    text,
  reference_id                   uuid,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── rag_chunks → dwxz_rag_chunks ──
CREATE TABLE IF NOT EXISTS public.dwxz_rag_chunks (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id                    uuid,
  knowledge_base_id              uuid,
  content                        text NOT NULL,
  chunk_index                    integer,
  metadata                       jsonb,
  created_at                     timestamp DEFAULT now(),
  embedding                      vector(1536),
  PRIMARY KEY (id)
);

-- ── rag_config → dwxz_rag_config ──
CREATE TABLE IF NOT EXISTS public.dwxz_rag_config (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  embedding_provider             text DEFAULT 'openai'::character varying,
  embedding_model                text DEFAULT 'text-embedding-3-small'::character varying,
  embedding_api_key              text,
  embedding_api_url              text,
  search_top_k                   integer DEFAULT 5,
  similarity_threshold           numeric DEFAULT 0.7,
  include_sources                boolean DEFAULT true,
  max_context_length             integer DEFAULT 4000,
  system_prompt_template         text,
  updated_by                     uuid,
  updated_at                     timestamp DEFAULT now(),
  chat_model                     text DEFAULT 'gpt-4o-mini'::character varying,
  chat_api_key                   text,
  chunk_size                     integer DEFAULT 500,
  chunk_overlap                  integer DEFAULT 50,
  top_k                          integer DEFAULT 5,
  ai_provider                    text DEFAULT 'openai'::character varying,
  openai_api_key                 text,
  openai_model                   text DEFAULT 'gpt-4o-mini'::character varying,
  claude_api_key                 text,
  claude_model                   text DEFAULT 'claude-sonnet-4-20250514'::character varying,
  deepseek_api_key               text,
  deepseek_model                 text DEFAULT 'deepseek-chat'::character varying,
  auto_process_uploads           boolean DEFAULT true,
  auto_generate_embeddings       boolean DEFAULT true,
  auto_classify_materials        boolean DEFAULT true,
  PRIMARY KEY (id)
);

-- ── rag_config_backup → dwxz_rag_config_backup ──
CREATE TABLE IF NOT EXISTS public.dwxz_rag_config_backup (
  id                             uuid,
  embedding_provider             text,
  embedding_model                text,
  embedding_api_key              text,
  embedding_api_url              text,
  search_top_k                   integer,
  similarity_threshold           numeric,
  include_sources                boolean,
  max_context_length             integer,
  system_prompt_template         text,
  updated_by                     uuid,
  updated_at                     timestamp,
  chat_model                     text,
  chat_api_key                   text,
  chunk_size                     integer,
  chunk_overlap                  integer,
  top_k                          integer
);

-- ── rag_documents → dwxz_rag_documents ──
CREATE TABLE IF NOT EXISTS public.dwxz_rag_documents (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  knowledge_base_id              uuid,
  title                          text NOT NULL,
  title_zh                       text,
  file_name                      text,
  file_type                      text,
  file_size                      integer,
  file_url                       text,
  raw_content                    text,
  category                       text,
  hsk_levels                     int4[],
  tags                           text[],
  status                         text DEFAULT 'pending'::character varying,
  chunk_count                    integer DEFAULT 0,
  error_message                  text,
  metadata                       jsonb,
  uploaded_by                    uuid,
  created_at                     timestamp DEFAULT now(),
  processed_at                   timestamp,
  PRIMARY KEY (id)
);

-- ── rag_files → dwxz_rag_files ──
CREATE TABLE IF NOT EXISTS public.dwxz_rag_files (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  name                           text NOT NULL,
  size                           text,
  file_type                      text,
  file_url                       text,
  status                         text DEFAULT 'processing'::text,
  chunks                         integer DEFAULT 0,
  tags                           text[] DEFAULT '{}'::text[],
  uploaded_by                    uuid,
  created_at                     timestamptz DEFAULT now(),
  indexed_at                     timestamptz,
  PRIMARY KEY (id)
);

-- ── rag_knowledge_bases → dwxz_rag_knowledge_bases ──
CREATE TABLE IF NOT EXISTS public.dwxz_rag_knowledge_bases (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  name                           text NOT NULL,
  name_zh                        text,
  description                    text,
  embedding_model                text DEFAULT 'text-embedding-3-small'::character varying,
  chunk_size                     integer DEFAULT 500,
  chunk_overlap                  integer DEFAULT 50,
  is_active                      boolean DEFAULT true,
  document_count                 integer DEFAULT 0,
  total_chunks                   integer DEFAULT 0,
  last_updated                   timestamp,
  created_by                     uuid,
  created_at                     timestamp DEFAULT now(),
  category                       text DEFAULT 'general'::character varying,
  chunk_count                    integer DEFAULT 0,
  PRIMARY KEY (id)
);

-- ── rag_query_logs → dwxz_rag_query_logs ──
CREATE TABLE IF NOT EXISTS public.dwxz_rag_query_logs (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                        uuid,
  query                          text NOT NULL,
  knowledge_base_ids             uuid[],
  retrieved_chunks               jsonb,
  retrieval_time_ms              integer,
  generated_response             text,
  generation_time_ms             integer,
  user_rating                    integer,
  user_feedback                  text,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── reward_redemptions → dwxz_reward_redemptions ──
CREATE TABLE IF NOT EXISTS public.dwxz_reward_redemptions (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                        uuid,
  reward_id                      uuid,
  points_spent                   integer NOT NULL,
  status                         text DEFAULT 'pending'::character varying,
  redeemed_at                    timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── rewards → dwxz_rewards ──
CREATE TABLE IF NOT EXISTS public.dwxz_rewards (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  name                           text NOT NULL,
  name_zh                        text,
  description                    text,
  points_cost                    integer NOT NULL,
  category                       text,
  image_url                      text,
  stock                          integer DEFAULT '-1'::integer,
  is_active                      boolean DEFAULT true,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── schools → dwxz_schools ──
CREATE TABLE IF NOT EXISTS public.dwxz_schools (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  name                           text NOT NULL,
  name_zh                        text,
  address                        text,
  phone                          text,
  email                          text,
  is_active                      boolean DEFAULT true,
  created_at                     timestamp DEFAULT now(),
  city                           text,
  code                           text,
  max_teachers                   integer DEFAULT 10,
  max_students                   integer DEFAULT 50,
  current_teachers               integer DEFAULT 0,
  current_students               integer DEFAULT 0,
  updated_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── student_learning_profiles → dwxz_student_learning_profiles ──
CREATE TABLE IF NOT EXISTS public.dwxz_student_learning_profiles (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id                     uuid,
  current_hsk_level              integer DEFAULT 1,
  target_hsk_level               integer DEFAULT 2,
  estimated_vocabulary           integer DEFAULT 0,
  skill_listening                integer DEFAULT 50,
  skill_speaking                 integer DEFAULT 50,
  skill_reading                  integer DEFAULT 50,
  skill_writing                  integer DEFAULT 50,
  skill_grammar                  integer DEFAULT 50,
  strengths                      text[],
  weaknesses                     text[],
  learning_style                 text,
  streak_days                    integer DEFAULT 0,
  total_study_time               integer DEFAULT 0,
  last_study_date                date,
  updated_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── student_mistake_patterns → dwxz_student_mistake_patterns ──
CREATE TABLE IF NOT EXISTS public.dwxz_student_mistake_patterns (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id                     uuid,
  mistake_type                   text NOT NULL,
  description                    text,
  related_words                  text[],
  occurrence_count               integer DEFAULT 1,
  first_occurred                 timestamp DEFAULT now(),
  last_occurred                  timestamp DEFAULT now(),
  is_resolved                    boolean DEFAULT false,
  PRIMARY KEY (id)
);

-- ── student_points → dwxz_student_points ──
CREATE TABLE IF NOT EXISTS public.dwxz_student_points (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id                     uuid,
  total_xp                       integer DEFAULT 0,
  streak_days                    integer DEFAULT 0,
  last_active                    date DEFAULT CURRENT_DATE,
  updated_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── system_settings → dwxz_system_settings ──
CREATE TABLE IF NOT EXISTS public.dwxz_system_settings (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  setting_key                    text NOT NULL,
  setting_value                  text,
  category                       text DEFAULT 'general'::text,
  updated_at                     timestamptz DEFAULT now(),
  updated_by                     uuid,
  PRIMARY KEY (id)
);

-- ── teacher_teaching_profiles → dwxz_teacher_teaching_profiles ──
CREATE TABLE IF NOT EXISTS public.dwxz_teacher_teaching_profiles (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id                     uuid,
  specializations                text[],
  teaching_style                 text,
  years_experience               integer DEFAULT 0,
  certifications                 text[],
  preferred_materials            text[],
  updated_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── teaching_materials → dwxz_teaching_materials ──
CREATE TABLE IF NOT EXISTS public.dwxz_teaching_materials (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  title                          text NOT NULL,
  title_zh                       text,
  description                    text,
  type                           text,
  hsk_levels                     int4[],
  content                        text,
  file_url                       text,
  source_type                    text DEFAULT 'internal'::character varying,
  tags                           text[],
  is_active                      boolean DEFAULT true,
  uploaded_by                    uuid,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── teaching_progress → dwxz_teaching_progress ──
CREATE TABLE IF NOT EXISTS public.dwxz_teaching_progress (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  class_id                       uuid,
  hsk_level                      integer,
  point_key                      text,
  completed                      boolean DEFAULT false,
  teacher_id                     uuid,
  updated_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── training_configs → dwxz_training_configs ──
CREATE TABLE IF NOT EXISTS public.dwxz_training_configs (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  name                           text NOT NULL DEFAULT 'ZANG LoRA v1'::text,
  base_model                     text DEFAULT 'sdxl'::text,
  base_model_path                text DEFAULT ''::text,
  lora_rank                      integer DEFAULT 32,
  lora_alpha                     integer DEFAULT 16,
  learning_rate                  double precision DEFAULT 0.00008,
  max_steps                      integer DEFAULT 4000,
  repeat_factor                  integer DEFAULT 8,
  batch_size                     integer DEFAULT 2,
  resolution                     integer DEFAULT 1024,
  save_every                     integer DEFAULT 500,
  trigger_word                   text DEFAULT 'ZANG'::text,
  mixed_precision                text DEFAULT 'bf16'::text,
  optimizer                      text DEFAULT 'AdamW8bit'::text,
  lr_scheduler                   text DEFAULT 'cosine_with_restarts'::text,
  notes                          text DEFAULT ''::text,
  created_at                     timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── training_images → dwxz_training_images ──
CREATE TABLE IF NOT EXISTS public.dwxz_training_images (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  filename                       text NOT NULL,
  storage_path                   text NOT NULL,
  public_url                     text,
  width                          integer DEFAULT 0,
  height                         integer DEFAULT 0,
  file_size                      integer DEFAULT 0,
  caption                        text DEFAULT ''::text,
  trigger_word                   text DEFAULT 'ZANG'::text,
  tags                           text DEFAULT ''::text,
  style_notes                    text DEFAULT ''::text,
  quality_score                  integer DEFAULT 0,
  approved                       boolean DEFAULT false,
  created_at                     timestamptz DEFAULT now(),
  updated_at                     timestamptz DEFAULT now(),
  project_id                     text NOT NULL DEFAULT 'ZANG'::text,
  PRIMARY KEY (id),
  CONSTRAINT dwxz_training_images_quality_score_check CHECK (((quality_score >= 0) AND (quality_score <= 5)))
);

-- ── training_materials → dwxz_training_materials ──
CREATE TABLE IF NOT EXISTS public.dwxz_training_materials (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  knowledge_base_id              uuid,
  file_name                      text NOT NULL,
  file_type                      text NOT NULL,
  file_size                      integer,
  file_data                      text,
  file_url                       text,
  category                       text,
  hsk_levels                     int4[],
  tags                           text[],
  description                    text,
  review_status                  text DEFAULT 'pending'::character varying,
  reviewed_by                    uuid,
  reviewed_at                    timestamp,
  reject_reason                  text,
  process_status                 text DEFAULT 'pending'::character varying,
  chunk_count                    integer DEFAULT 0,
  processed_at                   timestamp,
  error_message                  text,
  uploaded_by                    uuid,
  created_at                     timestamp DEFAULT now(),
  updated_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── training_stats → dwxz_training_stats ──
CREATE TABLE IF NOT EXISTS public.dwxz_training_stats (
  knowledge_base_id              uuid,
  pending_count                  bigint,
  approved_count                 bigint,
  rejected_count                 bigint,
  processed_count                bigint,
  total_chunks                   bigint,
  total_size                     bigint
);

-- ── user_applications → dwxz_user_applications ──
CREATE TABLE IF NOT EXISTS public.dwxz_user_applications (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  username                       text NOT NULL,
  email                          text,
  name                           text,
  name_zh                        text,
  phone                          text,
  requested_role                 text NOT NULL,
  reason                         text,
  status                         text DEFAULT 'pending'::character varying,
  reviewed_by                    uuid,
  reviewed_at                    timestamp,
  review_notes                   text,
  created_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── user_points → dwxz_user_points ──
CREATE TABLE IF NOT EXISTS public.dwxz_user_points (
  id                             uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                        uuid,
  total_points                   integer DEFAULT 0,
  current_points                 integer DEFAULT 0,
  level                          integer DEFAULT 1,
  updated_at                     timestamp DEFAULT now(),
  PRIMARY KEY (id)
);

-- ════════════════════════════════════════════════════════════════════
-- FOREIGN KEY CONSTRAINTS
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.dwxz_attendance
  ADD CONSTRAINT dwxz_attendance_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.dwxz_classes(id);

ALTER TABLE public.dwxz_attendance
  ADD CONSTRAINT dwxz_attendance_student_id_fkey
  FOREIGN KEY (student_id)
  REFERENCES public.jgw_registrations(approved_user_id); -- FK rewritten: users.id → jgw_registrations.approved_user_id

ALTER TABLE public.dwxz_attendance_records
  ADD CONSTRAINT dwxz_attendance_records_session_id_fkey
  FOREIGN KEY (session_id)
  REFERENCES public.dwxz_attendance_sessions(id);

ALTER TABLE public.dwxz_attendance_sessions
  ADD CONSTRAINT dwxz_attendance_sessions_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.dwxz_classes(id);

ALTER TABLE public.dwxz_class_attendance
  ADD CONSTRAINT dwxz_class_attendance_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.dwxz_classes(id);

ALTER TABLE public.dwxz_class_enrollments
  ADD CONSTRAINT dwxz_class_enrollments_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.dwxz_classes(id);

ALTER TABLE public.dwxz_class_lessons
  ADD CONSTRAINT dwxz_class_lessons_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.dwxz_classes(id);

ALTER TABLE public.dwxz_class_students
  ADD CONSTRAINT dwxz_class_students_student_id_fkey
  FOREIGN KEY (student_id)
  REFERENCES public.jgw_registrations(approved_user_id); -- FK rewritten: users.id → jgw_registrations.approved_user_id

ALTER TABLE public.dwxz_class_students
  ADD CONSTRAINT dwxz_class_students_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.dwxz_classes(id);

ALTER TABLE public.dwxz_classes
  ADD CONSTRAINT dwxz_classes_school_id_fkey
  FOREIGN KEY (school_id)
  REFERENCES public.dwxz_schools(id);

ALTER TABLE public.dwxz_custom_knowledge_points
  ADD CONSTRAINT dwxz_custom_knowledge_points_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.dwxz_classes(id);

ALTER TABLE public.dwxz_grades
  ADD CONSTRAINT dwxz_grades_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.dwxz_classes(id);

ALTER TABLE public.dwxz_grades
  ADD CONSTRAINT dwxz_grades_student_id_fkey
  FOREIGN KEY (student_id)
  REFERENCES public.jgw_registrations(approved_user_id); -- FK rewritten: users.id → jgw_registrations.approved_user_id

ALTER TABLE public.dwxz_homework
  ADD CONSTRAINT dwxz_homework_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.dwxz_classes(id);

ALTER TABLE public.dwxz_homework_submissions
  ADD CONSTRAINT dwxz_homework_submissions_homework_id_fkey
  FOREIGN KEY (homework_id)
  REFERENCES public.dwxz_homework(id);

ALTER TABLE public.dwxz_hsk_audio_files
  ADD CONSTRAINT dwxz_hsk_audio_files_paper_id_fkey
  FOREIGN KEY (paper_id)
  REFERENCES public.dwxz_hsk_test_papers(id);

ALTER TABLE public.dwxz_hsk_test_answers
  ADD CONSTRAINT dwxz_hsk_test_answers_question_id_fkey
  FOREIGN KEY (question_id)
  REFERENCES public.dwxz_hsk_test_questions(id);

ALTER TABLE public.dwxz_hsk_test_answers
  ADD CONSTRAINT dwxz_hsk_test_answers_attempt_id_fkey
  FOREIGN KEY (attempt_id)
  REFERENCES public.dwxz_hsk_test_attempts(id);

ALTER TABLE public.dwxz_hsk_test_attempts
  ADD CONSTRAINT dwxz_hsk_test_attempts_paper_id_fkey
  FOREIGN KEY (paper_id)
  REFERENCES public.dwxz_hsk_test_papers(id);

ALTER TABLE public.dwxz_hsk_test_questions
  ADD CONSTRAINT dwxz_hsk_test_questions_section_id_fkey
  FOREIGN KEY (section_id)
  REFERENCES public.dwxz_hsk_test_sections(id);

ALTER TABLE public.dwxz_hsk_test_questions
  ADD CONSTRAINT dwxz_hsk_test_questions_paper_id_fkey
  FOREIGN KEY (paper_id)
  REFERENCES public.dwxz_hsk_test_papers(id);

ALTER TABLE public.dwxz_hsk_test_sections
  ADD CONSTRAINT dwxz_hsk_test_sections_paper_id_fkey
  FOREIGN KEY (paper_id)
  REFERENCES public.dwxz_hsk_test_papers(id);

ALTER TABLE public.dwxz_knowledge_categories
  ADD CONSTRAINT dwxz_knowledge_categories_parent_id_fkey
  FOREIGN KEY (parent_id)
  REFERENCES public.dwxz_knowledge_categories(id);

ALTER TABLE public.dwxz_knowledge_materials
  ADD CONSTRAINT dwxz_knowledge_materials_knowledge_base_id_fkey
  FOREIGN KEY (knowledge_base_id)
  REFERENCES public.dwxz_rag_knowledge_bases(id);

ALTER TABLE public.dwxz_material_categories
  ADD CONSTRAINT dwxz_material_categories_parent_id_fkey
  FOREIGN KEY (parent_id)
  REFERENCES public.dwxz_material_categories(id);

ALTER TABLE public.dwxz_parent_student_links
  ADD CONSTRAINT dwxz_parent_student_links_parent_id_fkey
  FOREIGN KEY (parent_id)
  REFERENCES public.jgw_registrations(approved_user_id); -- FK rewritten: users.id → jgw_registrations.approved_user_id

ALTER TABLE public.dwxz_parent_student_links
  ADD CONSTRAINT dwxz_parent_student_links_student_id_fkey
  FOREIGN KEY (student_id)
  REFERENCES public.jgw_registrations(approved_user_id); -- FK rewritten: users.id → jgw_registrations.approved_user_id

ALTER TABLE public.dwxz_rag_chunks
  ADD CONSTRAINT dwxz_rag_chunks_knowledge_base_id_fkey
  FOREIGN KEY (knowledge_base_id)
  REFERENCES public.dwxz_rag_knowledge_bases(id);

ALTER TABLE public.dwxz_rag_chunks
  ADD CONSTRAINT dwxz_rag_chunks_document_id_fkey
  FOREIGN KEY (document_id)
  REFERENCES public.dwxz_rag_documents(id);

ALTER TABLE public.dwxz_rag_documents
  ADD CONSTRAINT dwxz_rag_documents_knowledge_base_id_fkey
  FOREIGN KEY (knowledge_base_id)
  REFERENCES public.dwxz_rag_knowledge_bases(id);

ALTER TABLE public.dwxz_reward_redemptions
  ADD CONSTRAINT dwxz_reward_redemptions_reward_id_fkey
  FOREIGN KEY (reward_id)
  REFERENCES public.dwxz_rewards(id);

ALTER TABLE public.dwxz_teaching_progress
  ADD CONSTRAINT dwxz_teaching_progress_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES public.dwxz_classes(id);

ALTER TABLE public.dwxz_training_materials
  ADD CONSTRAINT dwxz_training_materials_knowledge_base_id_fkey
  FOREIGN KEY (knowledge_base_id)
  REFERENCES public.dwxz_rag_knowledge_bases(id);

-- ════════════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS dwxz_idx_conversations_user ON public.dwxz_ai_agent_conversations USING btree (user_id);
CREATE INDEX IF NOT EXISTS dwxz_ai_jobs_created_at_idx ON public.dwxz_ai_jobs USING btree (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_attendance_class_id_student_id_date_key ON public.dwxz_attendance USING btree (class_id, student_id, date);
CREATE INDEX IF NOT EXISTS dwxz_idx_attendance_session ON public.dwxz_attendance_records USING btree (session_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_chengyu_hsk ON public.dwxz_chengyu USING btree (hsk_level);
CREATE INDEX IF NOT EXISTS dwxz_idx_chengyu_text ON public.dwxz_chengyu USING btree (chengyu);
CREATE INDEX IF NOT EXISTS dwxz_idx_chengyu_category ON public.dwxz_chengyu USING btree (category);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_class_attendance_class_id_student_id_date_key ON public.dwxz_class_attendance USING btree (class_id, student_id, date);
CREATE INDEX IF NOT EXISTS dwxz_idx_enrollments_student ON public.dwxz_class_enrollments USING btree (student_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_enrollments_class ON public.dwxz_class_enrollments USING btree (class_id);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_class_students_class_id_student_id_key ON public.dwxz_class_students USING btree (class_id, student_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_classes_teacher ON public.dwxz_classes USING btree (teacher_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_classes_school ON public.dwxz_classes USING btree (school_id);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_exhibition_plans_product_id_key ON public.dwxz_exhibition_plans USING btree (product_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_homework_due ON public.dwxz_homework USING btree (due_date);
CREATE INDEX IF NOT EXISTS dwxz_idx_homework_class ON public.dwxz_homework USING btree (class_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_submissions_homework ON public.dwxz_homework_submissions USING btree (homework_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_submissions_student ON public.dwxz_homework_submissions USING btree (student_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_hsk_answers_attempt ON public.dwxz_hsk_test_answers USING btree (attempt_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_hsk_attempts_paper ON public.dwxz_hsk_test_attempts USING btree (paper_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_hsk_attempts_student ON public.dwxz_hsk_test_attempts USING btree (student_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_hsk_papers_level ON public.dwxz_hsk_test_papers USING btree (hsk_level);
CREATE INDEX IF NOT EXISTS dwxz_idx_hsk_questions_paper ON public.dwxz_hsk_test_questions USING btree (paper_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_hsk_questions_section ON public.dwxz_hsk_test_questions USING btree (section_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_invitations_code ON public.dwxz_invitation_codes USING btree (code);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_invitation_codes_code_key ON public.dwxz_invitation_codes USING btree (code);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_invites_code_key ON public.dwxz_invites USING btree (code);
CREATE INDEX IF NOT EXISTS dwxz_idx_materials_status ON public.dwxz_knowledge_materials USING btree (status);
CREATE INDEX IF NOT EXISTS dwxz_idx_materials_kb ON public.dwxz_knowledge_materials USING btree (knowledge_base_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_knowledge_materials_category ON public.dwxz_knowledge_materials USING btree (category);
CREATE INDEX IF NOT EXISTS dwxz_idx_knowledge_materials_status ON public.dwxz_knowledge_materials USING btree (status);
CREATE INDEX IF NOT EXISTS dwxz_idx_knowledge_materials_kb ON public.dwxz_knowledge_materials USING btree (knowledge_base_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_messages_receiver ON public.dwxz_messages USING btree (receiver_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_notifications_user ON public.dwxz_notifications USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_panda_assets_emotion_key ON public.dwxz_panda_assets USING btree (emotion);
CREATE INDEX IF NOT EXISTS dwxz_idx_transactions_user ON public.dwxz_points_transactions USING btree (user_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_rag_chunks_kb ON public.dwxz_rag_chunks USING btree (knowledge_base_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_rag_chunks_doc ON public.dwxz_rag_chunks USING btree (document_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_rag_chunks_document ON public.dwxz_rag_chunks USING btree (document_id);
CREATE INDEX IF NOT EXISTS dwxz_rag_chunks_embedding_idx ON public.dwxz_rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');
CREATE INDEX IF NOT EXISTS dwxz_idx_rag_chunks_content ON public.dwxz_rag_chunks USING gin (to_tsvector('simple'::regconfig, content));
CREATE INDEX IF NOT EXISTS dwxz_idx_rag_docs_kb ON public.dwxz_rag_documents USING btree (knowledge_base_id);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_student_learning_profiles_student_id_key ON public.dwxz_student_learning_profiles USING btree (student_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_profiles_student ON public.dwxz_student_learning_profiles USING btree (student_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_mistakes_student ON public.dwxz_student_mistake_patterns USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_student_points_student_id_key ON public.dwxz_student_points USING btree (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_system_settings_setting_key_key ON public.dwxz_system_settings USING btree (setting_key);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_teacher_teaching_profiles_teacher_id_key ON public.dwxz_teacher_teaching_profiles USING btree (teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_teaching_progress_class_id_hsk_level_point_key_key ON public.dwxz_teaching_progress USING btree (class_id, hsk_level, point_key);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_training_images_storage_path_key ON public.dwxz_training_images USING btree (storage_path);
CREATE INDEX IF NOT EXISTS dwxz_idx_training_images_approved ON public.dwxz_training_images USING btree (approved);
CREATE INDEX IF NOT EXISTS dwxz_idx_training_images_project ON public.dwxz_training_images USING btree (project_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_training_images_created ON public.dwxz_training_images USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS dwxz_idx_training_images_quality ON public.dwxz_training_images USING btree (quality_score);
CREATE INDEX IF NOT EXISTS dwxz_idx_training_process_status ON public.dwxz_training_materials USING btree (process_status);
CREATE INDEX IF NOT EXISTS dwxz_idx_training_kb ON public.dwxz_training_materials USING btree (knowledge_base_id);
CREATE INDEX IF NOT EXISTS dwxz_idx_training_uploaded_by ON public.dwxz_training_materials USING btree (uploaded_by);
CREATE INDEX IF NOT EXISTS dwxz_idx_training_review_status ON public.dwxz_training_materials USING btree (review_status);
CREATE INDEX IF NOT EXISTS dwxz_idx_applications_status ON public.dwxz_user_applications USING btree (status);
CREATE INDEX IF NOT EXISTS dwxz_idx_points_user ON public.dwxz_user_points USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS dwxz_user_points_user_id_key ON public.dwxz_user_points USING btree (user_id);

COMMIT;

-- ════════════════════════════════════════════════════════════════════
-- Generated 65 tables, 33 FKs
-- ════════════════════════════════════════════════════════════════════