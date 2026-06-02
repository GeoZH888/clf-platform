// src/lib/appMode.js
// Which deployment is this build? Set per Netlify site via the VITE_APP_MODE
// build env var. One codebase, two sites:
//
//   teaching  → david-zhongwen.net              → new Supabase (wrpyhgklasdtgdtyuief)
//   allinone  → zhongwen-allinone.ci-world.com  → current Supabase (yqcojudvvjntaajnrilr)
//
// Default is 'allinone' so local dev and any unconfigured build behave exactly
// like today (no surprises).

export const APP_MODE = (import.meta.env.VITE_APP_MODE || 'allinone').toLowerCase();

export const IS_TEACHING = APP_MODE === 'teaching';
export const IS_ALLINONE = !IS_TEACHING;

// The teaching portal's public URL — used by the allinone site to link the
// 教学 entry across to the teaching deployment.
export const TEACHING_URL = 'https://david-zhongwen.net';
// The all-in-one platform's public URL — used by the teaching site to link back.
export const ALLINONE_URL = 'https://zhongwen-allinone.ci-world.com';
