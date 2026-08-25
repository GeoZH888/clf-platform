// src/config/modules.js
//
// Single source of truth for what modules exist on the platform and which
// ones can be turned off per user.
//
// To add a new module:
//   1. Add an entry below
//   2. The admin UI auto-shows it
//   3. Wrap the new module's UI with isEnabled('your_id') in code
//
// gateable: false  → always available (e.g. home, profile) — admin can't toggle
// defaultEnabled:  → if a user has no row in clf_user_modules for this id,
//                    this is the value used (i.e. is it in the standard bundle?)
//
// CANONICAL IDS: All gateable IDs match what student-facing PlatformHome
// renders. No more "characters" vs "lianzi" split — both refer to 练字
// using the canonical id "lianzi".

// `audience` says WHO a module is for, and therefore which panel shows it.
// Without it every entry here was assumed to be a learner tile, which is why
// staff-facing tools (the teacher results portal, placement administration)
// had to live in a separate hand-maintained tab list instead of the registry.
//
//   learner  the community grid — children and self-study visitors
//   teacher  the teaching panels
//   admin    /admin only
//   parent   the parent panel
//
// A module can serve two audiences, but only by being two entries: the student
// test portal and the teacher results portal are different screens, different
// permissions and different routes. Lumping them under one id is what made them
// impossible to place.
export const AUDIENCES = ['learner', 'teacher', 'admin', 'parent'];

export const MODULES = [
  // ── Always-on infrastructure ────────────────────────────────────────
  { id: 'home',       label: '主页',     icon: '🏠', gateable: false, defaultEnabled: true,  category: 'core' , pillar: 'home',      audience: 'learner' },
  { id: 'profile',    label: '我的',     icon: '👤', gateable: false, defaultEnabled: true,  category: 'core' , pillar: 'profile',   audience: 'learner' },
  { id: 'progress',   label: '学习进度', icon: '📊', gateable: false, defaultEnabled: true,  category: 'core' , pillar: 'progress',  audience: 'learner' },

  // ── Standard bundle (defaultEnabled: true) ──────────────────────────
  { id: 'lianzi',     label: '练字',     icon: '✍️', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'community', audience: 'learner' },
  { id: 'words',      label: '词语',     icon: '📚', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'community', audience: 'learner' },
  { id: 'pinyin',     label: '拼音',     icon: '🔤', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'community', audience: 'learner' },
  { id: 'chengyu',    label: '成语',     icon: '🎋', gateable: true,  defaultEnabled: true,  category: 'cultural' , pillar: 'community', audience: 'learner' },
  { id: 'poetry',     label: '诗歌',     icon: '🪶', gateable: true,  defaultEnabled: true,  category: 'cultural' , pillar: 'community', audience: 'learner' },
  { id: 'grammar',    label: '语法',     icon: '📐', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'community', audience: 'learner' },
  { id: 'riddles',    label: '猜灯谜',   icon: '🏮', gateable: true,  defaultEnabled: true,  category: 'games' , pillar: 'community', audience: 'learner' },
  { id: 'radicals',   label: '部首听音', icon: '🧩', gateable: true,  defaultEnabled: true,  category: 'games' , pillar: 'community', audience: 'learner' },  // 偏旁部首 + 读音 drill
  { id: 'compose',    label: '组字工坊', icon: '🧱', gateable: true,  defaultEnabled: true,  category: 'games' , pillar: 'community', audience: 'learner' },  // 义符+声符 composition
  { id: 'scenario',   label: '场景对话', icon: '💬', gateable: true,  defaultEnabled: true,  category: 'practice' , pillar: 'community', audience: 'learner' },
  { id: 'story',      label: '故事会',   icon: '📖', gateable: true,  defaultEnabled: true,  category: 'practice' , pillar: 'community', audience: 'learner' },

  // ── Built, previously reachable only by URL ─────────────────────────
  // ~725 lines of working app that no tile ever pointed at.
  { id: 'knowledge',  label: '知识地图', icon: '🗺️', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'community', audience: 'learner' },

  // ── A separate product, linked rather than embedded ─────────────────
  // 非遗百科 is its own deployment on its own Supabase project. `external`
  // makes that visible here so nothing tries to treat it as a local route:
  // it opens in a new tab, and its content and accounts are not ours.
  { id: 'feiyi',      label: '非遗百科', icon: '🪭', gateable: true,  defaultEnabled: true,  category: 'cultural' , pillar: 'community', audience: 'learner', external: true },
  // HSK 1-6 courses, mock exams and error reports — its own deployment on its
  // own Supabase project, so linked for the same reason 非遗百科 is.
  { id: 'hsk',        label: 'HSK 进阶', icon: '🎓', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'community', audience: 'learner', external: true },

  // NOT here on purpose: 分班测试 (placement) and 学生测评 (assessment).
  // Those are school functions and belong to Lingua_School, which already has
  // both. Their code is still in this repo only because PR #4 — the branch that
  // strips the teaching system out — has not merged yet; it deletes
  // src/placement/ and src/assessment/. Giving them community tiles would have
  // meant advertising features that are about to be removed from this app.

  // ── Premium / opt-in (defaultEnabled: false) ────────────────────────
  { id: 'lessons',    label: '课程',     icon: '📖', gateable: true,  defaultEnabled: false, category: 'learning' , pillar: 'community', audience: 'learner' },
  { id: 'chat',       label: '问答聊天', icon: '💬', gateable: true,  defaultEnabled: false, category: 'practice' , pillar: 'community', audience: 'learner' },
  // Built now — per-character tone and pronunciation scoring. On by default:
  // step one is open free use, and this is the feature that distinguishes the
  // platform from tools that return one vague overall score.
  { id: 'voice',      label: '语音评测', icon: '🎤', gateable: true,  defaultEnabled: true,  category: 'practice' , pillar: 'community', audience: 'learner' },
  { id: 'homework',   label: '作业',     icon: '✏️', gateable: true,  defaultEnabled: false, category: 'practice' , pillar: 'community', audience: 'learner' },

  // ── Future placeholder (defaultEnabled: false, hidden until built) ──
  { id: 'shop',       label: '小卖部',   icon: '🛒', gateable: true,  defaultEnabled: false, category: 'future' , pillar: 'community', audience: 'learner' },
  { id: 'parents',    label: '家长',     icon: '👨‍👩‍👧', gateable: true,  defaultEnabled: false, category: 'future' , pillar: 'community', audience: 'parent' },
];

/**
 * Modules for one panel. Anything without an explicit audience is treated as a
 * learner module, so an entry added without the field still lands somewhere
 * visible rather than disappearing.
 */
export function modulesFor(audience = 'learner') {
  return MODULES.filter(m => (m.audience || 'learner') === audience);
}

// Module IDs that make up the "标准套餐" preset — what new students get by default.
export const STANDARD_BUNDLE = MODULES
  .filter(m => m.gateable && m.defaultEnabled)
  .map(m => m.id);

// Module IDs that are always available regardless of admin settings.
export const ALWAYS_ON = MODULES
  .filter(m => !m.gateable)
  .map(m => m.id);

// Lookup helper
export const MODULE_BY_ID = MODULES.reduce((acc, m) => {
  acc[m.id] = m;
  return acc;
}, {});

// ── Compatibility shim ─────────────────────────────────────────────
// Some legacy data (jgw_invites.modules) may contain non-canonical IDs.
// This map normalizes them to canonical. Will be retired in Phase 2 once
// jgw_invites.modules is fully migrated.
export const LEGACY_ID_MAP = {
  'characters': 'lianzi',     // English term used in early development
  'flashcards': 'words',      // sub-mode of words; gating is at parent level
  'dictation':  'lianzi',     // sub-mode of lianzi
  'completion': 'lianzi',     // sub-mode of lianzi
  'games':      null,         // orphan in legacy data — drop
};

/**
 * Normalize a list of module IDs (some may be legacy) to canonical IDs.
 * Drops nulls (orphans) and deduplicates.
 *
 * Use this when reading legacy module arrays (e.g. from jgw_invites.modules)
 * before passing to UI filtering logic.
 */
export function normalizeModuleIds(ids) {
  if (!Array.isArray(ids)) return [];
  const normalized = ids
    .map(id => id in LEGACY_ID_MAP ? LEGACY_ID_MAP[id] : id)
    .filter(Boolean);
  return [...new Set(normalized)];
}
