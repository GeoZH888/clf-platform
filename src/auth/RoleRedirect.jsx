import React, { useEffect } from 'react';
import { useAuth } from '../school/contexts/AuthContext';

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
    window.location.replace(ROLE_HOME[user.role] || '/');
  }, [loading, user]);
  return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>Redirecting…</div>;
}
