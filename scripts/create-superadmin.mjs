// scripts/create-superadmin.mjs
// One-shot: create a super_admin user in Supabase.
//
//   Usage:  node scripts/create-superadmin.mjs <email> <password> [display_name]
//   Example: node scripts/create-superadmin.mjs superadmin@ci-world.com 'Admn123_**' '超级管理员'
//
// Reads SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
// from .env. Idempotent-ish: if the email already exists in auth, it updates
// the password and ensures the profile row is set to super_admin / active.
//
// Mirrors the schema used by netlify/functions/admin-create-user.js
// (auth.users + clf_user_profiles).
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Tiny .env loader (we don't want to require a dotenv dep just for this).
function loadDotenv(path = '.env') {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch { /* no .env, fall back to process env */ }
}

loadDotenv();

const [, , emailArg, passwordArg, ...nameArgs] = process.argv;
if (!emailArg || !passwordArg) {
  console.error('Usage: node scripts/create-superadmin.mjs <email> <password> [display_name]');
  process.exit(2);
}
const email = emailArg.toLowerCase().trim();
const password = passwordArg;
const displayName = nameArgs.join(' ').trim() || 'Super Admin';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Look up an existing auth user by email. The admin API has no "getByEmail",
// so we page through listUsers. Fine for the size of this project.
async function findAuthUserByEmail(targetEmail) {
  const perPage = 1000;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = (data?.users || []).find(u => (u.email || '').toLowerCase() === targetEmail);
    if (hit) return hit;
    if ((data?.users || []).length < perPage) return null;
  }
  return null;
}

async function main() {
  console.log(`→ target email: ${email}`);
  const existing = await findAuthUserByEmail(email);

  let userId;
  if (existing) {
    console.log(`  found existing auth user ${existing.id}; updating password`);
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(existing.user_metadata || {}), display_name: displayName },
    });
    if (error) { console.error('  updateUserById failed:', error.message); process.exit(1); }
    userId = existing.id;
  } else {
    console.log('  creating new auth user');
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, created_by: 'create-superadmin-script' },
    });
    if (error) { console.error('  createUser failed:', error.message); process.exit(1); }
    userId = data.user.id;
  }

  // Upsert the profile row with role=super_admin.
  const profileRow = {
    user_id: userId,
    email,
    role: 'super_admin',
    display_name: displayName,
    is_active: true,
  };
  if (/[一-鿿]/.test(displayName)) profileRow.display_name_zh = displayName;

  const { error: profErr } = await supabase
    .from('clf_user_profiles')
    .upsert(profileRow, { onConflict: 'user_id' });
  if (profErr) { console.error('  profile upsert failed:', profErr.message); process.exit(1); }

  console.log(`✓ super_admin ready: ${email}  (user_id=${userId})`);
}

main().catch(e => { console.error(e); process.exit(1); });
