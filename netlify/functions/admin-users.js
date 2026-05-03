// =====================================================================
// netlify/functions/admin-users.js
// =====================================================================
// Phase 4 backend — admin-only operations on auth.users.
// Cannot run from frontend because they require the SERVICE ROLE key.
//
// Endpoints (single function, action in body):
//   POST /.netlify/functions/admin-users
//     headers:  Authorization: Bearer <super_admin's access_token>
//     body:     { action: 'create', email, password, display_name?, display_name_zh?, role }
//               { action: 'delete', user_id }
//
// Auth flow:
//   1. Decode caller's JWT via the anon-key client
//   2. Read their clf_user_profiles.role via the service-role client
//   3. Reject if role !== 'super_admin'
//   4. Perform the requested admin operation
//
// Required env vars (Netlify dashboard → Site settings → Environment):
//   SUPABASE_URL                  — same as VITE_SUPABASE_URL
//   SUPABASE_ANON_KEY             — same as VITE_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY     — KEEP SECRET, never expose to frontend
// =====================================================================

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_ROLES = ['super_admin', 'school_master', 'teacher', 'student', 'parent'];

const json = (status, body) => ({
  statusCode: status,
  headers: {
    'Content-Type':                 'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Server misconfigured: missing Supabase env vars' });
  }

  // ------- 1. Auth: extract bearer token -------
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json(401, { error: 'Missing Authorization header' });
  }
  const token = authHeader.slice(7);

  // Anon-key client just for verifying the JWT and getting the auth user
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user: caller }, error: getUserErr } = await anonClient.auth.getUser(token);
  if (getUserErr || !caller) {
    return json(401, { error: 'Invalid or expired session' });
  }

  // Service-role client for all admin operations
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ------- 2. Authorize: caller must be super_admin -------
  const { data: callerProfile, error: profileErr } = await admin
    .from('clf_user_profiles')
    .select('role')
    .eq('user_id', caller.id)
    .single();

  if (profileErr || !callerProfile) {
    return json(403, { error: 'No CLF profile for caller' });
  }
  if (callerProfile.role !== 'super_admin') {
    return json(403, { error: 'Forbidden: super_admin role required' });
  }

  // ------- 3. Parse body -------
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }
  const { action } = body;

  // ------- 4. Dispatch -------
  try {
    if (action === 'create')      return await handleCreate(admin, body);
    if (action === 'delete')      return await handleDelete(admin, body, caller.id);
    return json(400, { error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[admin-users] uncaught:', err);
    return json(500, { error: err.message || 'Internal server error' });
  }
};

// ---------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------

async function handleCreate(admin, body) {
  const { email, password, display_name, display_name_zh, role } = body;

  if (!email || !password) {
    return json(400, { error: 'email and password required' });
  }
  if (password.length < 8) {
    return json(400, { error: 'password must be ≥ 8 characters' });
  }
  if (!VALID_ROLES.includes(role)) {
    return json(400, { error: `role must be one of ${VALID_ROLES.join(', ')}` });
  }

  // 1. Create auth user (with role hint in metadata so the on_auth_user_created
  //    trigger sets the right role at profile creation time)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name:    display_name    || email.split('@')[0],
      display_name_zh: display_name_zh || null,
      role,
    },
  });
  if (createErr) return json(400, { error: createErr.message });

  // 2. The trigger created a profile with role=student by default (or the role
  //    from metadata if the trigger reads it). Ensure all fields are correct.
  const { error: updateErr } = await admin
    .from('clf_user_profiles')
    .update({
      email,
      role,
      display_name:    display_name    || email.split('@')[0],
      display_name_zh: display_name_zh || null,
      is_active:       true,
    })
    .eq('user_id', created.user.id);

  if (updateErr) {
    // Roll back the auth user so we don't leave orphans
    await admin.auth.admin.deleteUser(created.user.id);
    return json(500, { error: `Profile init failed: ${updateErr.message}` });
  }

  return json(200, {
    ok:      true,
    user_id: created.user.id,
    email,
    role,
  });
}

async function handleDelete(admin, body, callerId) {
  const { user_id } = body;
  if (!user_id) return json(400, { error: 'user_id required' });

  // Safety: don't let a super_admin delete themselves (bricks the system)
  if (user_id === callerId) {
    return json(400, { error: 'Cannot delete your own account' });
  }

  // Safety: don't let the LAST super_admin be deleted
  const { data: target } = await admin
    .from('clf_user_profiles')
    .select('role, email')
    .eq('user_id', user_id)
    .single();

  if (target?.role === 'super_admin') {
    const { count } = await admin
      .from('clf_user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'super_admin');
    if ((count ?? 0) <= 1) {
      return json(400, { error: 'Cannot delete the last super_admin' });
    }
  }

  // auth.users delete cascades to clf_user_profiles via FK ON DELETE CASCADE
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user_id);
  if (deleteErr) return json(400, { error: deleteErr.message });

  return json(200, { ok: true, deleted: target?.email || user_id });
}
