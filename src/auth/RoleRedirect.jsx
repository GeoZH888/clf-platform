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
    // This is the installed app's launch target, so it is reached by guests as
    // well as by members. Sending a signed-out visitor to /login would demand a
    // password from someone who is allowed to look around first — the community
    // home carries its own 登录 button for when they want it.
    if (!user) { window.location.replace('/community'); return; }
    window.location.replace(ROLE_HOME[user.role] || '/community');
  }, [loading, user]);
  return <div style={{ padding:40, textAlign:'center', color:'#8B4513' }}>Redirecting…</div>;
}
