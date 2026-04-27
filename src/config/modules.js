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

export const MODULES = [
  // Always-on infrastructure
  { id: 'home',       label: '主页',     icon: '🏠', gateable: false, defaultEnabled: true,  category: 'core' },
  { id: 'profile',    label: '我的',     icon: '👤', gateable: false, defaultEnabled: true,  category: 'core' },
  { id: 'progress',   label: '学习进度', icon: '📊', gateable: false, defaultEnabled: true,  category: 'core' },

  // Standard bundle (defaultEnabled: true, gateable: true)
  { id: 'words',      label: '词语',     icon: '📚', gateable: true,  defaultEnabled: true,  category: 'learning' },
  { id: 'flashcards', label: '闪卡',     icon: '🎴', gateable: true,  defaultEnabled: true,  category: 'learning' },
  { id: 'dictation',  label: '听写',     icon: '✍️', gateable: true,  defaultEnabled: true,  category: 'practice' },
  { id: 'completion', label: '补全',     icon: '📝', gateable: true,  defaultEnabled: true,  category: 'practice' },
  { id: 'pinyin',     label: '拼音',     icon: '🔤', gateable: true,  defaultEnabled: true,  category: 'learning' },

  // Premium / opt-in (defaultEnabled: false)
  { id: 'characters', label: '汉字',     icon: '汉', gateable: true,  defaultEnabled: false, category: 'learning' },
  { id: 'riddles',    label: '猜灯谜',   icon: '🏮', gateable: true,  defaultEnabled: false, category: 'cultural' },
  { id: 'chat',       label: 'AI聊天',   icon: '💬', gateable: true,  defaultEnabled: false, category: 'practice' },
  { id: 'voice',      label: '语音评测', icon: '🎤', gateable: true,  defaultEnabled: false, category: 'practice' },
  { id: 'lessons',    label: '课程',     icon: '📖', gateable: true,  defaultEnabled: false, category: 'learning' },
  { id: 'homework',   label: '作业',     icon: '✏️', gateable: true,  defaultEnabled: false, category: 'practice' },
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
