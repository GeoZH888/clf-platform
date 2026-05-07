# patch_community_pillar.py
# Wire 社区 pillar in AdminAppV2.
# 8 components, 6 simple wrappers, 1 modal wrapper, 1 with prop.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

pillars_dir = ROOT / "src" / "admin" / "v2" / "pillars"
pillars_dir.mkdir(parents=True, exist_ok=True)

# ============================================================
# CommunityPillar.jsx
# ============================================================
COMM = '''// src/admin/v2/pillars/CommunityPillar.jsx
// 社区 pillar — 8 sub-modules.
// Each sub-tab renders an existing admin component.
// CharacterImportWizard is a modal so it gets a trigger button.
// ChengyuAdminTab needs apiKeys prop (passed empty for now).
import React, { useState } from 'react';

import CharacterImportWizard from '../../CharacterImportWizard';
// CLFWordsAdminTab.jsx exports `WordsAdminTab` (not CLFWordsAdminTab)
import WordsAdminTab from '../../CLFWordsAdminTab';
import PinyinAdminTab from '../../PinyinAdminTab';
import GrammarAdminTab from '../../GrammarAdminTab';
import ChengyuAdminTab from '../../ChengyuAdminTab';
import PoetryAdminTab from '../../PoetryAdminTab';
import StoryAdminTab from '../../StoryAdminTab';
import ScenarioAdminTab from '../../ScenarioAdminTab';

const TABS = [
  { id: 'characters', icon: '✍️', label: '汉字',     desc: '汉字导入与管理' },
  { id: 'words',      icon: '📚', label: '词语',     desc: '词语库' },
  { id: 'pinyin',     icon: '🔤', label: '拼音',     desc: '拼音教学' },
  { id: 'grammar',    icon: '📐', label: '语法',     desc: '语法点' },
  { id: 'chengyu',    icon: '🎋', label: '成语',     desc: '成语库' },
  { id: 'poetry',     icon: '🪶', label: '诗歌',     desc: '诗词库' },
  { id: 'story',      icon: '📖', label: '故事会',   desc: '故事内容' },
  { id: 'scenario',   icon: '💬', label: '场景对话', desc: '对话场景' },
];

class TabErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(err, info) { console.error('[CommunityPillar] tab error:', err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 20, background: '#fef2f2',
          border: '1px solid #fecaca', borderRadius: 10,
          color: '#991b1b',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            ⚠ 此模块加载失败
          </div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>
            可以从旧 /admin 后台访问此功能，或在下次会话中调试。
            其他 sub-tab 不受影响。
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function CharactersWrapper() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{
        background: '#fff', border: '1px solid #e8d5b0',
        borderRadius: 10, padding: 16, marginBottom: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a0a05', marginBottom: 6 }}>
          汉字导入向导
        </div>
        <div style={{ fontSize: 12, color: '#5d4630', marginBottom: 12 }}>
          从语料库批量导入汉字，自动获取拼音、释义、插画。
        </div>
        <button onClick={() => setOpen(true)} style={{
          padding: '8px 16px', fontSize: 13, fontWeight: 600,
          background: '#3b82f6', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>
          打开导入向导
        </button>
      </div>
      {open && (
        <CharacterImportWizard
          open={open}
          onClose={() => setOpen(false)}
          onComplete={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export default function CommunityPillar() {
  const [active, setActive] = useState('chengyu'); // start on something likely to render

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16, padding: 6,
        background: '#fff', borderRadius: 10, border: '1px solid #e8d5b0',
        flexWrap: 'wrap',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            title={t.desc}
            style={{
              padding: '7px 12px', borderRadius: 6, border: 'none',
              background: active === t.id ? '#3b82f6' : 'transparent',
              color: active === t.id ? '#fff' : '#5d4630',
              cursor: 'pointer', fontSize: 12,
              fontWeight: active === t.id ? 700 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Active sub-tab content with error boundary */}
      <div style={{
        background: '#fff', border: '1px solid #e8d5b0',
        borderRadius: 12, padding: 16, minHeight: 200,
      }}>
        <TabErrorBoundary key={active}>
          {active === 'characters' && <CharactersWrapper/>}
          {active === 'words'      && <WordsAdminTab/>}
          {active === 'pinyin'     && <PinyinAdminTab/>}
          {active === 'grammar'    && <GrammarAdminTab/>}
          {active === 'chengyu'    && <ChengyuAdminTab apiKeys={{}}/>}
          {active === 'poetry'     && <PoetryAdminTab/>}
          {active === 'story'      && <StoryAdminTab/>}
          {active === 'scenario'   && <ScenarioAdminTab/>}
        </TabErrorBoundary>
      </div>
    </div>
  );
}
'''

p_comm = pillars_dir / "CommunityPillar.jsx"
data = COMM.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_comm.write_bytes(data)
print(f"[OK] wrote src/admin/v2/pillars/CommunityPillar.jsx ({len(data)} bytes)")

# ============================================================
# Patch AdminAppV2.jsx
# ============================================================
p_v2 = ROOT / "src" / "admin" / "AdminAppV2.jsx"
src = p_v2.read_text(encoding="utf-8")

# Edit 1: Add import after GamePillar import
old1 = "import GamePillar from './v2/pillars/GamePillar';"
new1 = """import GamePillar from './v2/pillars/GamePillar';
import CommunityPillar from './v2/pillars/CommunityPillar';"""
if old1 in src and "CommunityPillar" not in src:
    src = src.replace(old1, new1, 1)
    print("[OK] added CommunityPillar import")
elif "CommunityPillar" in src:
    print("[SKIP] CommunityPillar import already present")
else:
    print("[FAIL] could not find GamePillar import line")

# Edit 2: Add pillar-community handler before generic module pillars
old2 = "  // Module pillars"
new2 = """  // 社区 pillar
  if (activeTab === 'pillar-community') {
    return (
      <div>
        <SectionHeader icon="🌐" title="社区" subtitle="练字、词语、拼音、成语、诗歌、语法、课程等" color="#3b82f6"/>
        <CommunityPillar/>
      </div>
    );
  }

  // Module pillars"""

if old2 in src and "if (activeTab === 'pillar-community')" not in src:
    src = src.replace(old2, new2, 1)
    print("[OK] added pillar-community handler")
elif "if (activeTab === 'pillar-community')" in src:
    print("[SKIP] pillar-community handler already present")
else:
    print("[FAIL] could not find '// Module pillars' marker")

data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_v2.write_bytes(data)
print(f"\n[OK] wrote AdminAppV2.jsx ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
final = p_v2.read_text(encoding="utf-8")
checks = [
    ('CommunityPillar import', "import CommunityPillar from './v2/pillars/CommunityPillar'" in final),
    ('pillar-community handler', "if (activeTab === 'pillar-community')" in final),
    ('<CommunityPillar/> JSX', '<CommunityPillar/>' in final),
    ('CommunityPillar.jsx file', p_comm.exists()),
]
all_ok = True
for label, val in checks:
    print(f"  [{'OK' if val else 'FAIL'}] {label}")
    if not val: all_ok = False

# Escape check
hex_chars = set('0123456789abcdefABCDEF')
total_escapes = 0
for f in [p_v2, p_comm]:
    txt = f.read_text(encoding="utf-8")
    i = 0
    while i < len(txt) - 5:
        if txt[i] == chr(92) and txt[i+1] == 'u':
            if all(c in hex_chars for c in txt[i+2:i+6]):
                total_escapes += 1
                i += 6
                continue
        i += 1
print(f"  Raw escapes: {total_escapes}")

print("\n" + ("=== ALL OK ===" if all_ok and total_escapes == 0 else "=== SOME FAIL ==="))

print()
print("Hot-reload picks up changes if npm run dev is running.")
print()
print("EXPECTED OUTCOMES at /admin-v2 -> 模块内容 -> 社区:")
print("  - Sub-tab bar with 8 buttons")
print("  - Default active: 成语 (likely most stable)")
print("  - Each tab has error boundary - failure on one doesn't break others")
print()
print("HONEST EXPECTATIONS:")
print("  - 词语/拼音/语法/诗歌/故事会/场景对话 likely render OK (no props needed)")
print("  - 成语 may error if ChengyuAdminTab requires real apiKeys to mount")
print("  - 汉字 should render the wrapper button; clicking opens the wizard modal")
print("  - Some components built for old /admin context may show internal errors")
print("    that the error boundary will catch and display gracefully")
