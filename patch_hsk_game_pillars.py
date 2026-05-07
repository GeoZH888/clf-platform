# patch_hsk_game_pillars.py
# Wire HSK pillar + 游戏 pillar into AdminAppV2.
# Both are simple single-component wrappers.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# Make pillars dir
pillars_dir = ROOT / "src" / "admin" / "v2" / "pillars"
pillars_dir.mkdir(parents=True, exist_ok=True)

# ============================================================
# 1. HskPillar.jsx
# ============================================================
HSK_PILLAR = '''// src/admin/v2/pillars/HskPillar.jsx
// HSK pillar wrapper. Currently just wraps HSKAdminTab.
// Future: add tabs for 题库 / 等级配置 / 统计.
import React from 'react';
import HSKAdminTab from '../../HSKAdminTab';

export default function HskPillar() {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e8d5b0',
      borderRadius: 12,
      padding: 16,
    }}>
      <HSKAdminTab/>
    </div>
  );
}
'''

p_hsk = pillars_dir / "HskPillar.jsx"
data = HSK_PILLAR.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_hsk.write_bytes(data)
print(f"[OK] wrote src/admin/v2/pillars/HskPillar.jsx ({len(data)} bytes)")

# ============================================================
# 2. GamePillar.jsx
# ============================================================
GAME_PILLAR = '''// src/admin/v2/pillars/GamePillar.jsx
// 游戏 pillar — currently 猜灯谜 only.
// Future: tabs for additional games (字源记忆、拼字游戏、etc).
import React, { useState } from 'react';
import RiddleAdminTab from '../../RiddleAdminTab';

const GAMES = [
  { id: 'riddles', icon: '🏮', label: '猜灯谜', component: RiddleAdminTab, active: true },
  { id: 'memory',  icon: '🧠', label: '字源记忆', component: null, active: false },
  { id: 'spelling', icon: '🔤', label: '拼字游戏', component: null, active: false },
];

export default function GamePillar() {
  const [activeGame, setActiveGame] = useState('riddles');
  const game = GAMES.find(g => g.id === activeGame);
  const Component = game?.component;

  return (
    <div>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16, padding: 6,
        background: '#fff', borderRadius: 10, border: '1px solid #e8d5b0',
      }}>
        {GAMES.map(g => (
          <button key={g.id}
            onClick={() => g.active && setActiveGame(g.id)}
            disabled={!g.active}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none',
              background: activeGame === g.id ? '#10b981' : 'transparent',
              color: activeGame === g.id
                ? '#fff'
                : g.active ? '#5d4630' : '#a07850',
              cursor: g.active ? 'pointer' : 'not-allowed',
              opacity: g.active ? 1 : 0.5,
              fontSize: 13,
              fontWeight: activeGame === g.id ? 700 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <span>{g.icon}</span> {g.label}
            {!g.active && <span style={{ fontSize: 9, opacity: 0.7 }}>· 待建</span>}
          </button>
        ))}
      </div>
      <div style={{
        background: '#fff',
        border: '1px solid #e8d5b0',
        borderRadius: 12,
        padding: 16,
      }}>
        {Component ? (
          <Component/>
        ) : (
          <div style={{
            padding: 30, textAlign: 'center',
            background: '#fef3e2',
            border: '1px solid #f59e0b40',
            borderRadius: 10,
            color: '#92400e',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🚧</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {game.label} · 建设中
            </div>
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>
              下一阶段开发
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
'''

p_game = pillars_dir / "GamePillar.jsx"
data = GAME_PILLAR.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_game.write_bytes(data)
print(f"[OK] wrote src/admin/v2/pillars/GamePillar.jsx ({len(data)} bytes)")

# ============================================================
# 3. Patch AdminAppV2.jsx — add imports + wire 2 pillars
# ============================================================
p_v2 = ROOT / "src" / "admin" / "AdminAppV2.jsx"
src = p_v2.read_text(encoding="utf-8")

# Edit 1: Add pillar imports near existing imports
old1 = "import AccountsManagement from './v2/AccountsManagement';"
new1 = """import AccountsManagement from './v2/AccountsManagement';
import HskPillar from './v2/pillars/HskPillar';
import GamePillar from './v2/pillars/GamePillar';"""
if old1 in src and "HskPillar" not in src:
    src = src.replace(old1, new1, 1)
    print("[OK] added HskPillar + GamePillar imports")
elif "HskPillar" in src:
    print("[SKIP] pillar imports already present")
else:
    print("[FAIL] could not find AccountsManagement import line")

# Edit 2: Add pillar handlers in TabContent
# Find the line "// Module pillars" and inject before it
old2 = "  // Module pillars"
new2 = """  // HSK pillar
  if (activeTab === 'pillar-hsk') {
    return (
      <div>
        <SectionHeader icon="🎯" title="HSK" subtitle="HSK1-HSK6 等级内容" color="#9333ea"/>
        <HskPillar/>
      </div>
    );
  }

  // 游戏 pillar
  if (activeTab === 'pillar-game') {
    return (
      <div>
        <SectionHeader icon="🎮" title="游戏" subtitle="猜灯谜及其他趣味模块" color="#10b981"/>
        <GamePillar/>
      </div>
    );
  }

  // Module pillars"""

if old2 in src and "if (activeTab === 'pillar-hsk')" not in src:
    src = src.replace(old2, new2, 1)
    print("[OK] added pillar-hsk + pillar-game handlers")
elif "if (activeTab === 'pillar-hsk')" in src:
    print("[SKIP] pillar handlers already present")
else:
    print("[FAIL] could not find '// Module pillars' marker")

# Write back
data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_v2.write_bytes(data)
print(f"\n[OK] wrote AdminAppV2.jsx ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
final = p_v2.read_text(encoding="utf-8")
checks = [
    ('HskPillar import', "import HskPillar from './v2/pillars/HskPillar'" in final),
    ('GamePillar import', "import GamePillar from './v2/pillars/GamePillar'" in final),
    ('pillar-hsk handler', "if (activeTab === 'pillar-hsk')" in final),
    ('pillar-game handler', "if (activeTab === 'pillar-game')" in final),
    ('<HskPillar/> JSX', '<HskPillar/>' in final),
    ('<GamePillar/> JSX', '<GamePillar/>' in final),
    ('HskPillar.jsx file', p_hsk.exists()),
    ('GamePillar.jsx file', p_game.exists()),
]
all_ok = True
for label, val in checks:
    print(f"  [{'OK' if val else 'FAIL'}] {label}")
    if not val: all_ok = False

# Escape check
hex_chars = set('0123456789abcdefABCDEF')
total_escapes = 0
for f in [p_v2, p_hsk, p_game]:
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
print("If npm run dev is running, hot-reload picks up changes.")
print("Test at /admin-v2:")
print("  - Click 模块内容 > HSK -> renders HSKAdminTab")
print("  - Click 模块内容 > 游戏 -> renders 3-tab interface (猜灯谜 active, others 'coming soon')")
