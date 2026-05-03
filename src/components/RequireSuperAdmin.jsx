// =====================================================================
// src/components/RequireSuperAdmin.jsx
// =====================================================================
// Phase 3a — Route guard. Wrap any super-admin-only route in this.
//
// Usage in your router (react-router-dom v6):
//   <Route element={<RequireSuperAdmin />}>
//     <Route path="/admin"        element={<AdminLayout />}>
//       <Route index             element={<AdminHome />} />
//       <Route path="users"      element={<UserManagementPage />} />
//     </Route>
//   </Route>
//
// Or wrap a single page directly:
//   <RequireSuperAdmin><UserManagementPage/></RequireSuperAdmin>
// =====================================================================

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUserProfile } from '../hooks/useUserProfile';

export default function RequireSuperAdmin({ children, fallback = '/login' }) {
  const { user, profile, loading } = useUserProfile();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  // Not signed in at all → redirect to login, remember where they wanted to go
  if (!user) {
    return <Navigate to={fallback} state={{ from: location }} replace />;
  }

  // Signed in but no CLF profile → user belongs to another platform
  if (!profile) {
    return <NoProfileScreen email={user.email} />;
  }

  // Signed in but wrong role → access denied
  if (profile.role !== 'super_admin') {
    return <AccessDeniedScreen profile={profile} />;
  }

  return children ?? <Outlet />;
}

// ---------------------------------------------------------------------
// Visual states (kept in this file for drop-in convenience)
// ---------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdf5e6]">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">🐼</div>
        <p className="text-stone-600 font-serif">正在验证身份…</p>
        <p className="text-stone-400 text-sm mt-1">Verifying access</p>
      </div>
    </div>
  );
}

function NoProfileScreen({ email }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdf5e6] px-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-amber-100 p-8 text-center">
        <div className="text-5xl mb-3">🐼</div>
        <h1 className="text-2xl font-serif text-stone-800 mb-1">无访问权限</h1>
        <p className="text-stone-500 text-sm mb-4">No CLF account · Nessun account CLF</p>
        <p className="text-stone-700 leading-relaxed">
          The account <span className="font-mono text-amber-900">{email}</span> exists in
          authentication but has no CLF user profile. Ask a super_admin to grant access.
        </p>
        <a
          href="/login"
          className="inline-block mt-6 px-5 py-2 rounded-lg bg-[#7c2d12] text-amber-50 hover:bg-[#5c1f0a] transition"
        >
          返回登录 · Back to Login
        </a>
      </div>
    </div>
  );
}

function AccessDeniedScreen({ profile }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdf5e6] px-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md border border-amber-100 p-8 text-center">
        <div className="text-5xl mb-3">🚫</div>
        <h1 className="text-2xl font-serif text-stone-800 mb-1">权限不足</h1>
        <p className="text-stone-500 text-sm mb-4">Access denied · Accesso negato</p>
        <p className="text-stone-700 leading-relaxed">
          This area is for super administrators only. Your role is{' '}
          <span className="font-mono text-amber-900">{profile.role}</span>.
        </p>
        <a
          href="/"
          className="inline-block mt-6 px-5 py-2 rounded-lg bg-[#7c2d12] text-amber-50 hover:bg-[#5c1f0a] transition"
        >
          返回首页 · Home
        </a>
      </div>
    </div>
  );
}
