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

export const MODULES = [
  // ── Always-on infrastructure ────────────────────────────────────────
  { id: 'home',       label: '主页',     icon: '🏠', gateable: false, defaultEnabled: true,  category: 'core' , pillar: 'home' },
  { id: 'profile',    label: '我的',     icon: '👤', gateable: false, defaultEnabled: true,  category: 'core' , pillar: 'profile' },
  { id: 'progress',   label: '学习进度', icon: '📊', gateable: false, defaultEnabled: true,  category: 'core' , pillar: 'progress' },

  // ── Standard bundle (defaultEnabled: true) ──────────────────────────
  { id: 'lianzi',     label: '练字',     icon: '✍️', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'community' },
  { id: 'words',      label: '词语',     icon: '📚', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'community' },
  { id: 'pinyin',     label: '拼音',     icon: '🔤', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'community' },
  { id: 'chengyu',    label: '成语',     icon: '🎋', gateable: true,  defaultEnabled: true,  category: 'cultural' , pillar: 'community' },
  { id: 'poetry',     label: '诗歌',     icon: '🪶', gateable: true,  defaultEnabled: true,  category: 'cultural' , pillar: 'community' },
  { id: 'grammar',    label: '语法',     icon: '📐', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'community' },
  { id: 'hsk',        label: 'HSK',     icon: '🎯', gateable: true,  defaultEnabled: true,  category: 'learning' , pillar: 'hsk' },
  { id: 'riddles',    label: '猜灯谜',   icon: '🏮', gateable: true,  defaultEnabled: true,  category: 'cultural' , pillar: 'community' },  // 游戏 merged into 社区
  { id: 'scenario',   label: '场景对话', icon: '💬', gateable: true,  defaultEnabled: true,  category: 'practice' , pillar: 'community' },
  { id: 'story',      label: '故事会',   icon: '📖', gateable: true,  defaultEnabled: true,  category: 'practice' , pillar: 'community' },

  // ── Premium / opt-in (defaultEnabled: false) ────────────────────────
  { id: 'lessons',    label: '课程',     icon: '📖', gateable: true,  defaultEnabled: false, category: 'learning' , pillar: 'community' },
  { id: 'chat',       label: '问答聊天', icon: '💬', gateable: true,  defaultEnabled: false, category: 'practice' , pillar: 'community' },
  { id: 'voice',      label: '语音评测', icon: '🎤', gateable: true,  defaultEnabled: false, category: 'practice' , pillar: 'community' },
  { id: 'homework',   label: '作业',     icon: '✏️', gateable: true,  defaultEnabled: false, category: 'practice' , pillar: 'community' },

  // ── Future placeholder (defaultEnabled: false, hidden until built) ──
  { id: 'shop',       label: '小卖部',   icon: '🛒', gateable: true,  defaultEnabled: false, category: 'future' , pillar: 'community' },
  { id: 'parents',    label: '家长',     icon: '👨‍👩‍👧', gateable: true,  defaultEnabled: false, category: 'future' , pillar: 'community' },
];

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
