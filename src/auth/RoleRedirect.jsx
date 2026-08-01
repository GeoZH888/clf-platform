import React, { useEffect } from 'react';
import { useAuth } from '../school/contexts/AuthContext';

// This site is the community platform. Every non-admin role lands on
// /community — the teaching panels moved to david-zhongwen.net, which runs its
// own role dispatch. (This map used to have a second teaching variant switched
// by IS_TEACHING; that build mode is gone — see lib/appMode.js.)
const ROLE_HOME = {
  super_admin:   '/admin-v2',
  school_master: '/community',
  teacher:       '/community',
  student:       '/community',
  parent:        '/community',
};

export default function RoleRedirect() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!user) { window.location.replace('/login'); return; }
    // Unknown role still gets the public hub rather than '/', which would
    // bounce back through RootRedirect.
    window.location.replace(ROLE_HOME[user.role] || '/community');
  }, [loading, user]);
  return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>Redirecting…</div>;
}
