-- ============================================================
-- Phase 3a/4 — Admin helper RPCs
-- Run in Supabase SQL Editor
-- ============================================================
-- Provides SECURITY DEFINER functions that the User Management
-- panel calls via supabase.rpc(). They join clf_user_profiles
-- with auth.users (which the client cannot read directly), and
-- enforce super_admin role at the function entry.
-- ============================================================

-- ------------------------------------------------------------
-- 1. List all users for admin panel
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS clf_admin_list_users();

CREATE OR REPLACE FUNCTION clf_admin_list_users()
RETURNS TABLE (
  user_id            uuid,
  email              text,
  role               clf_user_role,
  display_name       text,
  display_name_zh    text,
  school_id          uuid,
  is_active          boolean,
  created_at         timestamptz,
  updated_at         timestamptz,
  last_sign_in_at    timestamptz,
  email_confirmed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin role required';
  END IF;

  RETURN QUERY
    SELECT
      p.user_id,
      p.email,
      p.role,
      p.display_name,
      p.display_name_zh,
      p.school_id,
      p.is_active,
      p.created_at,
      p.updated_at,
      u.last_sign_in_at,
      u.email_confirmed_at
    FROM clf_user_profiles p
    JOIN auth.users u ON u.id = p.user_id
    ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION clf_admin_list_users() TO authenticated;

-- ------------------------------------------------------------
-- 2. Quick stats for admin dashboard header
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS clf_admin_user_stats();

CREATE OR REPLACE FUNCTION clf_admin_user_stats()
RETURNS TABLE (
  role         clf_user_role,
  total        bigint,
  active       bigint,
  inactive     bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'unauthorized: super_admin role required';
  END IF;

  RETURN QUERY
    SELECT
      p.role,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE p.is_active)        AS active,
      COUNT(*) FILTER (WHERE NOT p.is_active)    AS inactive
    FROM clf_user_profiles p
    GROUP BY p.role
    ORDER BY p.role;
END;
$$;

GRANT EXECUTE ON FUNCTION clf_admin_user_stats() TO authenticated;

-- ------------------------------------------------------------
-- 3. Verify install
-- ------------------------------------------------------------
SELECT
  routine_name,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'clf_admin_%'
ORDER BY routine_name;

-- Quick smoke test (must be run while logged in as super_admin):
--   SELECT * FROM clf_admin_list_users() LIMIT 3;
--   SELECT * FROM clf_admin_user_stats();
