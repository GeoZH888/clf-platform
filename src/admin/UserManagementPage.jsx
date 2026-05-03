// =====================================================================
// src/pages/UserManagementPage.jsx
// =====================================================================
// Phase 4 — Super Admin User Management panel.
//
// Features:
//   • Lists everyone in clf_user_profiles (joined with auth.users
//     via the clf_admin_list_users() RPC)
//   • Role dropdown — change role inline (super_admin / school_master /
//     teacher / student / parent)
//   • Active toggle — enable/disable a user
//   • Search by email or name
//   • Filter by role
//   • Create new user (modal → POST to /.netlify/functions/admin-users)
//   • Delete user (confirm → DELETE on Netlify function)
//
// Reads/role-updates use the anon key (RLS allows super_admin).
// Create/delete go through the Netlify function (uses service role).
//
// Wire it up:
//   <Route element={<RequireSuperAdmin />}>
//     <Route path="/admin/users" element={<UserManagementPage />} />
//   </Route>
// =====================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase'; // ← adjust path as needed

const ROLE_OPTIONS = [
  { value: 'super_admin',   label: '超级管理员',  labelEn: 'Super Admin'    },
  { value: 'school_master', label: '校长',       labelEn: 'School Master'  },
  { value: 'teacher',       label: '老师',       labelEn: 'Teacher'        },
  { value: 'student',       label: '学生',       labelEn: 'Student'        },
  { value: 'parent',        label: '家长',       labelEn: 'Parent'         },
];

const ROLE_BADGE = {
  super_admin:   'bg-rose-100 text-rose-900 border-rose-200',
  school_master: 'bg-violet-100 text-violet-900 border-violet-200',
  teacher:       'bg-amber-100 text-amber-900 border-amber-200',
  student:       'bg-emerald-100 text-emerald-900 border-emerald-200',
  parent:        'bg-sky-100 text-sky-900 border-sky-200',
};

export default function UserManagementPage() {
  const [users,           setUsers]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [search,          setSearch]          = useState('');
  const [roleFilter,      setRoleFilter]      = useState('all');
  const [showCreate,      setShowCreate]      = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState(null);
  const [savingUserId,    setSavingUserId]    = useState(null);
  const [toast,           setToast]           = useState(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.rpc('clf_admin_list_users');
    if (error) {
      setError(error.message);
      setUsers([]);
    } else {
      setUsers(data || []);
      setError(null);
    }
    setLoading(false);
  }

  async function changeRole(userId, newRole) {
    setSavingUserId(userId);
    // optimistic
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
    const { error } = await supabase
      .from('clf_user_profiles')
      .update({ role: newRole })
      .eq('user_id', userId);
    setSavingUserId(null);
    if (error) {
      flash('error', `角色更新失败: ${error.message}`);
      loadUsers(); // rollback
    } else {
      flash('success', '角色已更新 · Role updated');
    }
  }

  async function toggleActive(userId, current) {
    setSavingUserId(userId);
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_active: !current } : u));
    const { error } = await supabase
      .from('clf_user_profiles')
      .update({ is_active: !current })
      .eq('user_id', userId);
    setSavingUserId(null);
    if (error) {
      flash('error', `状态更新失败: ${error.message}`);
      loadUsers();
    } else {
      flash('success', !current ? '已激活 · Activated' : '已停用 · Deactivated');
    }
  }

  async function createUser(form) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/.netlify/functions/admin-users', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action: 'create', ...form }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Create failed');
    flash('success', `用户已创建 · Created ${form.email}`);
    setShowCreate(false);
    await loadUsers();
  }

  async function deleteUser(userId, email) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/.netlify/functions/admin-users', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action: 'delete', user_id: userId }),
    });
    const json = await res.json();
    if (!res.ok) {
      flash('error', `删除失败: ${json.error}`);
    } else {
      flash('success', `已删除 · Deleted ${email}`);
      await loadUsers();
    }
    setDeleteTarget(null);
  }

  function flash(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  // -------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (u.email || '').toLowerCase().includes(q)
          || (u.display_name || '').toLowerCase().includes(q)
          || (u.display_name_zh || '').toLowerCase().includes(q);
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    const counts = {};
    for (const u of users) counts[u.role] = (counts[u.role] || 0) + 1;
    return counts;
  }, [users]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#fdf5e6] py-10 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-serif text-stone-800">用户管理</h1>
            <p className="text-stone-500 mt-1">User Management · Gestione Utenti</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 rounded-lg bg-[#7c2d12] text-amber-50 hover:bg-[#5c1f0a] transition shadow-sm font-medium"
          >
            + 新建用户 · Create User
          </button>
        </header>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {ROLE_OPTIONS.map(opt => (
            <div
              key={opt.value}
              className="bg-white rounded-xl border border-amber-100 px-4 py-3 shadow-sm"
            >
              <div className="text-2xl font-serif text-stone-800">{stats[opt.value] || 0}</div>
              <div className="text-xs text-stone-500 mt-0.5">
                {opt.label} · {opt.labelEn}
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-amber-100 p-4 mb-4 flex flex-col sm:flex-row gap-3 shadow-sm">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索 邮箱 / 姓名 · Search email or name"
            className="flex-1 px-3 py-2 rounded-lg border border-amber-100 bg-amber-50/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
          />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-amber-100 bg-amber-50/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
          >
            <option value="all">所有角色 · All roles</option>
            {ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} · {opt.labelEn}
              </option>
            ))}
          </select>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-amber-200 hover:bg-amber-50 transition text-stone-700 disabled:opacity-50"
          >
            {loading ? '加载中…' : '↻ 刷新'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
            <strong>加载失败:</strong> {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50/60 text-stone-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">姓名 · Name</th>
                  <th className="text-left px-4 py-3 font-medium">角色 · Role</th>
                  <th className="text-left px-4 py-3 font-medium">状态 · Active</th>
                  <th className="text-left px-4 py-3 font-medium">最后登录 · Last login</th>
                  <th className="text-right px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {loading && (
                  <tr><td colSpan={6} className="text-center py-8 text-stone-400">加载中… Loading</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-stone-400">无匹配用户 · No matching users</td></tr>
                )}
                {filtered.map(u => (
                  <tr key={u.user_id} className="hover:bg-amber-50/30 transition">
                    <td className="px-4 py-3 font-mono text-xs text-stone-700">{u.email}</td>
                    <td className="px-4 py-3 text-stone-800">
                      {u.display_name_zh && <div>{u.display_name_zh}</div>}
                      <div className="text-stone-500 text-xs">{u.display_name || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.user_id, e.target.value)}
                        disabled={savingUserId === u.user_id}
                        className={`px-2.5 py-1 rounded-md border text-xs font-medium ${ROLE_BADGE[u.role] || 'bg-stone-100 border-stone-200'}`}
                      >
                        {ROLE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label} · {opt.labelEn}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(u.user_id, u.is_active)}
                        disabled={savingUserId === u.user_id}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${u.is_active ? 'bg-emerald-500' : 'bg-stone-300'}`}
                        title={u.is_active ? '点击停用' : '点击激活'}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition ${u.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString()
                        : <span className="text-stone-300 italic">未登录 · never</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(u)}
                        className="text-rose-600 hover:text-rose-800 hover:underline text-xs"
                      >
                        删除 Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-stone-400 mt-4 text-right">
          {filtered.length} of {users.length} users
        </p>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onSubmit={createUser}
        />
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          user={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteUser(deleteTarget.user_id, deleteTarget.email)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg border ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Modals
// =====================================================================
function CreateUserModal({ onClose, onSubmit }) {
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [displayName,   setDisplayName]   = useState('');
  const [displayNameZh, setDisplayNameZh] = useState('');
  const [role,          setRole]          = useState('student');
  const [submitting,    setSubmitting]    = useState(false);
  const [err,           setErr]           = useState(null);

  async function handleSubmit() {
    setErr(null);
    if (!email.trim() || !password) {
      setErr('Email and password are required');
      return;
    }
    if (password.length < 8) {
      setErr('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        email:           email.trim().toLowerCase(),
        password,
        display_name:    displayName.trim() || null,
        display_name_zh: displayNameZh.trim() || null,
        role,
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-2xl font-serif text-stone-800 mb-1">新建用户</h2>
      <p className="text-stone-500 text-sm mb-5">Create new user · Crea nuovo utente</p>

      <div className="space-y-3">
        <Field label="Email *" value={email} onChange={setEmail} type="email" placeholder="user@example.com" />
        <Field label="密码 Password *" value={password} onChange={setPassword} type="password" placeholder="≥ 8 characters" />
        <Field label="显示姓名 · Display name (English)" value={displayName} onChange={setDisplayName} placeholder="e.g. Marco Rossi" />
        <Field label="中文姓名 · Chinese name" value={displayNameZh} onChange={setDisplayNameZh} placeholder="例如 张三" />

        <div>
          <label className="block text-xs text-stone-500 mb-1">角色 · Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-amber-100 bg-amber-50/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
          >
            {ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} · {opt.labelEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && (
        <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-sm">
          {err}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onClose}
          disabled={submitting}
          className="px-4 py-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          取消 Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-[#7c2d12] text-amber-50 hover:bg-[#5c1f0a] disabled:opacity-50"
        >
          {submitting ? '创建中…' : '创建 Create'}
        </button>
      </div>
    </ModalShell>
  );
}

function DeleteConfirmModal({ user, onCancel, onConfirm }) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    await onConfirm();
    setSubmitting(false);
  }

  return (
    <ModalShell onClose={onCancel}>
      <h2 className="text-2xl font-serif text-stone-800 mb-1">删除用户?</h2>
      <p className="text-stone-500 text-sm mb-5">Delete user · Eliminare utente?</p>

      <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 mb-5">
        <p className="text-rose-900">
          You are about to permanently delete:
        </p>
        <p className="font-mono mt-2 text-rose-950">{user.email}</p>
        <p className="text-rose-700 text-xs mt-3">
          This deletes the auth user, the CLF profile, and cascades to all dependent rows. Cannot be undone.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          取消 Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {submitting ? '删除中…' : '确认删除 Delete'}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm px-4">
      <div className="bg-[#fffaf0] rounded-2xl shadow-2xl border border-amber-100 max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs text-stone-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-amber-100 bg-amber-50/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 transition"
      />
    </div>
  );
}
