// src/lib/appMode.js
// This file used to carry a VITE_APP_MODE build flag, because one bundle served
// two products: 中文世界 (allinone) and the 教务管理系统 (teaching). The teaching
// system now has its own repo and deployment — github.com/GeoZH888/lingua-school
// → david-zhongwen.net — so there is no mode to branch on any more and
// APP_MODE / IS_TEACHING / IS_ALLINONE are gone.
//
// Both sites still share ONE Supabase project (yqcojudvvjntaajnrilr): one
// clf_user_profiles table, one set of class/homework tables, role-based access
// via RLS. A schema change here can break the other repo.
//
// What remains is just the cross-links between the two.

// The teaching portal's public URL — used for the 教学 entry on the community
// home and to forward retired /teacher, /student, /parent and /school-master
// paths (see App.jsx → TeachingRedirect).
export const TEACHING_URL = 'https://david-zhongwen.net';

// This site's own public URL, for absolute links in emails/invites.
export const ALLINONE_URL = 'https://zhongwen.ci-world.com';
