// tests/rls.integration.test.js
// Integration tests against real Supabase to verify RLS policies actually
// block cross-role data access. These are the high-value tests that prove
// the DB-side security boundary works.
//
// REQUIRES seeded test users. Set these in .env to enable:
//   TEST_STUDENT_EMAIL    + TEST_STUDENT_PASSWORD
//   TEST_TEACHER_EMAIL    + TEST_TEACHER_PASSWORD
//   TEST_PEER_STUDENT_ID  (a different student's user_id — used as the
//                          "other student" in the peer-leak test)
//
// Run with:
//   VITE_RUN_RLS_TESTS=1 npm test
//
// Without VITE_RUN_RLS_TESTS=1 the whole file is skipped — keeps CI green
// even on machines that don't have a Supabase project handy.

import { describe, test, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const RUN = process.env.VITE_RUN_RLS_TESTS === '1';

const URL  = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const STUDENT_EMAIL    = process.env.TEST_STUDENT_EMAIL;
const STUDENT_PASSWORD = process.env.TEST_STUDENT_PASSWORD;
const TEACHER_EMAIL    = process.env.TEST_TEACHER_EMAIL;
const TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD;
const PEER_STUDENT_ID  = process.env.TEST_PEER_STUDENT_ID;

function newAnonClient() {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(!RUN || !URL || !ANON)('RLS integration', () => {
  describe.skipIf(!STUDENT_EMAIL || !STUDENT_PASSWORD || !PEER_STUDENT_ID)
    ('signed in as student', () => {

    let client;
    beforeAll(async () => {
      client = newAnonClient();
      const { error } = await client.auth.signInWithPassword({
        email: STUDENT_EMAIL, password: STUDENT_PASSWORD,
      });
      if (error) throw new Error(`Student login failed: ${error.message}`);
    });

    test('cannot read another student\'s homework submissions', async () => {
      // The audit flagged this as a CRITICAL gap: clf_homework_submissions
      // has only a teacher-side read policy. If a student crafts a query
      // for another student's row, RLS should still return [].
      const { data, error } = await client
        .from('clf_homework_submissions')
        .select('id, student_id')
        .eq('student_id', PEER_STUDENT_ID)
        .limit(1);

      // Either error (RLS reject) or empty data — both prove RLS holds.
      // Returning the peer's row would be the gap.
      expect(error == null || error.code).toBeDefined();
      expect(data || []).toEqual([]);
    });

    test('cannot enumerate clf_user_profiles by listing all rows', async () => {
      // Probe whether profile data is properly scoped. A student should
      // see at most their own profile row.
      const { data: { user } } = await client.auth.getUser();
      const { data } = await client
        .from('clf_user_profiles')
        .select('user_id, role')
        .limit(10);

      // Acceptable outcomes:
      //   - empty (very strict RLS)
      //   - exactly one row, and it's the signed-in student's own row
      // Anything else (e.g. seeing other users' profiles) is a leak.
      if ((data || []).length > 0) {
        for (const row of data) {
          expect(row.user_id).toBe(user.id);
        }
      }
    });
  });

  describe.skipIf(!TEACHER_EMAIL || !TEACHER_PASSWORD)('signed in as teacher', () => {
    let client;
    let myId;

    beforeAll(async () => {
      client = newAnonClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: TEACHER_EMAIL, password: TEACHER_PASSWORD,
      });
      if (error) throw new Error(`Teacher login failed: ${error.message}`);
      myId = data.user.id;
    });

    test('cannot read classes owned by another teacher', async () => {
      // RLS on clf_classes (per the audit) is teacher_id = auth.uid().
      // We probe by asking for rows that aren't ours — should be [].
      const { data } = await client
        .from('clf_classes')
        .select('id, teacher_id')
        .neq('teacher_id', myId)
        .limit(1);

      expect(data || []).toEqual([]);
    });
  });
});
