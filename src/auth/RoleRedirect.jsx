import React, { useEffect } from 'react';
import { useAuth } from '../school/contexts/AuthContext';
import { IS_TEACHING } from '../lib/appMode.js';

// allinone site (zhongwen-allinone): everyone lands on /community; the 教学 card
// there links teaching roles over to the teaching site.
const ROLE_HOME_ALLINONE = {
  super_admin:   '/admin',
  school_master: '/community',
  teacher:       '/community',
  student:       '/community',
  parent:        '/community',
};
// teaching site (david-zhongwen.net): land each role directly in its own panel.
const ROLE_HOME_TEACHING = {
  super_admin:   '/admin',
  school_master: '/school-master',
  teacher:       '/teacher',
  student:       '/student',
  parent:        '/parent',
};
const ROLE_HOME = IS_TEACHING ? ROLE_HOME_TEACHING : ROLE_HOME_ALLINONE;

export default function RoleRedirect() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!user) { window.location.replace('/login'); return; }
    window.location.replace(ROLE_HOME[user.role] || '/');
  }, [loading, user]);
  return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>Redirecting…</div>;
}
