-- ═══════════════════════════════════════════════════════════════════
--  Migration: jgw_contributors table
--  Allows non-admin users to record pinyin audio + edit IPA overrides
--  without access to the rest of the admin panel (characters, API keys, etc).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS jgw_contributors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  notes      text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE jgw_contributors ENABLE ROW LEVEL SECURITY;

-- Contributors can read their own row (so the UI can show "Welcome, wenping")
CREATE POLICY "Contributors read own row"
  ON jgw_contributors FOR SELECT
  USING (auth.uid() = user_id);

-- Only authenticated (admin) users can manage contributors — but we don't
-- enforce which specific admins. You manage contributors via SQL editor or
-- an admin-only UI later.
CREATE POLICY "Authenticated manage contributors"
  ON jgw_contributors FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════════
-- Adding wenping as a contributor:
--
-- Step 1: Create the user account in Supabase
--   Dashboard → Authentication → Users → Add User
--   Email:    wenping@example.com  (use a real email you control if possible)
--   Password: [generate via password manager, NOT 'wenping111']
--
-- Step 2: Get wenping's user_id from Authentication → Users list
--
-- Step 3: Insert into jgw_contributors:
--   INSERT INTO jgw_contributors (user_id, display_name)
--   VALUES ('<paste uuid here>', 'wenping');
--
-- Step 4: Hand the password to wenping through Signal / password manager
-- ═══════════════════════════════════════════════════════════════════
