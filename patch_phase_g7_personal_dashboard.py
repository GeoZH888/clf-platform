# patch_phase_g7_personal_dashboard.py
# Phase G.7 — Personal learning dashboard.
#
# Adds 6th entrance card "我的" to /community alongside 教学/社区/HSK/游戏/非遗.
# Click expands inline (mutual exclusion) showing:
#   - Stat strip (mastered/practicing/due)
#   - Mastery by type (5 bars)
#   - Recent activity (last 5 attempts)
#   - Due for review (next 5 atoms)
#
# Reads from learningState.js (G.3). No writes, no breaking changes.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# ============================================================
# 1. Create PersonalDashboard.jsx
# ============================================================
DASHBOARD = '''// src/community/dashboard/PersonalDashboard.jsx
// Phase G.7 — Personal learning dashboard.
// Read-only. Calls learningState.js queries.
// Empty state handled gracefully (most users will have no data initially).

import React, { useEffect, useState } from 'react';
import {
  getMasterySummary,
  getRecentActivity,
  getDueAtoms,
} from '../../lib/learningState';

const TYPE_LABELS = {
  character: { label: '汉字', icon: '✍️', color: '#3b82f6' },
  word:      { label: '词语', icon: '📚', color: '#8b5cf6' },
  pinyin:    { label: '拼音', icon: '🔤', color: '#06b6d4' },
  grammar:   { label: '语法', icon: '📐', color: '#10b981' },
  chengyu:   { label: '成语', icon: '🎋', color: '#f59e0b' },
  poem:      { label: '诗歌', icon: '🪶', color: '#ec4899' },
  topic:     { label: '游戏', icon: '🏮', color: '#ef4444' },
};

const STATE_COLORS = {
  unseen:     '#e8d5b0',
  exposed:    '#fde68a',
  practicing: '#fbbf24',
  mastered:   '#10b981',
  forgotten:  '#dc2626',
};

const STATE_LABELS = {
  unseen:     '未学',
  exposed:    '已见',
  practicing: '练习中',
  mastered:   '已掌握',
  forgotten:  '需复习',
};

function relativeTime(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const s = ms / 1000;
  if (s < 60) return '刚刚';
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

export default function PersonalDashboard({ user }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [recent, setRecent] = useState([]);
  const [due, setDue] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getMasterySummary(user.id),
      getRecentActivity(user.id, 5),
      getDueAtoms(user.id, 5),
    ])
      .then(([s, r, d]) => {
        if (cancelled) return;
        setSummary(s || {});
        setRecent(r || []);
        setDue(d || []);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[PersonalDashboard] load error:', err);
        setError(err.message || String(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Compute totals across all types
  const totals = Object.values(summary).reduce(
    (acc, t) => ({
      total:      acc.total      + (t.total      || 0),
      mastered:   acc.mastered   + (t.mastered   || 0),
      practicing: acc.practicing + (t.practicing || 0),
      forgotten:  acc.forgotten  + (t.forgotten  || 0),
    }),
    { total: 0, mastered: 0, practicing: 0, forgotten: 0 }
  );

  if (!user?.id) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
        <div style={{ fontSize: 14, color: '#5d4630' }}>请先登录</div>
      </div>
    );
  }
  if (loading) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 13, color: '#8b6f47' }}>加载中…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontSize: 13, color: '#991b1b' }}>加载失败</div>
        <div style={{ fontSize: 11, color: '#a07850', marginTop: 4 }}>{error}</div>
      </div>
    );
  }

  // Detect empty state — no learning state at all
  const isEmpty = totals.total === 0 && recent.length === 0 && due.length === 0;
  if (isEmpty) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#5d4630', marginBottom: 6 }}>
          欢迎，{user.name || user.username || '学习者'}
        </div>
        <div style={{ fontSize: 12, color: '#8b6f47', marginBottom: 14 }}>
          你还没有学习记录。开始一个模块，记录就会出现在这里。
        </div>
        <div style={{ fontSize: 11, color: '#a07850' }}>
          建议从「社区」中选择一个模块开始
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* === Stat strip === */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
      }}>
        <StatCard label="已掌握" value={totals.mastered} total={totals.total} color="#10b981" icon="✅"/>
        <StatCard label="练习中" value={totals.practicing} total={totals.total} color="#fbbf24" icon="📖"/>
        <StatCard label="待复习" value={due.length} total={null} color="#3b82f6" icon="🔁"/>
      </div>

      {/* === Mastery by type === */}
      <Section title="按类型掌握情况" icon="📊">
        {Object.keys(TYPE_LABELS)
          .filter(t => summary[t]?.total > 0)
          .map(t => (
            <MasteryBar key={t} type={t} stats={summary[t]} typeMeta={TYPE_LABELS[t]}/>
          ))}
        {Object.values(summary).every(s => !s?.total) && (
          <div style={{ fontSize: 11, color: '#a07850', padding: 8 }}>
            （还没有任何类型的学习记录）
          </div>
        )}
      </Section>

      {/* === Recent activity === */}
      <Section title="最近学习" icon="🕐">
        {recent.length === 0 ? (
          <div style={{ fontSize: 11, color: '#a07850', padding: 8 }}>
            （没有近期活动）
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map(a => {
              const atomMeta = a.clf_atoms || {};
              const typeMeta = TYPE_LABELS[atomMeta.type] || { icon: '·', color: '#8b6f47' };
              return (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', background: '#fff',
                  border: '1px solid #f3e7d2', borderRadius: 6,
                  fontSize: 12,
                }}>
                  <span style={{ fontSize: 14 }}>{typeMeta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#1a0a05', fontWeight: 600,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {atomMeta.display_text || '(unknown atom)'}
                    </div>
                    <div style={{ fontSize: 10, color: '#8b6f47' }}>
                      {a.context || 'practice'} · {relativeTime(a.attempt_at)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: a.outcome >= 0.5 ? '#047857' : '#991b1b',
                  }}>
                    {a.outcome >= 1 ? '✓' : a.outcome >= 0.5 ? '◐' : '✗'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* === Due for review === */}
      <Section title="待复习" icon="🔁">
        {due.length === 0 ? (
          <div style={{ fontSize: 11, color: '#a07850', padding: 8 }}>
            （目前没有待复习的内容）
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {due.map(d => {
              const atomMeta = d.clf_atoms || {};
              const typeMeta = TYPE_LABELS[atomMeta.type] || { icon: '·', color: '#8b6f47' };
              return (
                <div key={d.atom_id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', background: '#fff',
                  border: '1px solid #f3e7d2', borderRadius: 6,
                  fontSize: 12,
                }}>
                  <span style={{ fontSize: 14 }}>{typeMeta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#1a0a05', fontWeight: 600,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {atomMeta.display_text || '(atom)'}
                    </div>
                    <div style={{ fontSize: 10, color: '#8b6f47' }}>
                      {typeMeta.label || atomMeta.type} · 等级 {atomMeta.level ?? '?'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================
function StatCard({ label, value, total, color, icon }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #f3e7d2',
      borderRadius: 10, padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#8b6f47', marginTop: 2 }}>
        {label}{total !== null && total > 0 ? ` / ${total}` : ''}
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div>
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#5d4630',
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>{icon}</span><span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function MasteryBar({ type, stats, typeMeta }) {
  const total = stats.total || 0;
  if (total === 0) return null;
  const segs = [
    { state: 'mastered',   n: stats.mastered   || 0 },
    { state: 'practicing', n: stats.practicing || 0 },
    { state: 'exposed',    n: stats.exposed    || 0 },
    { state: 'forgotten',  n: stats.forgotten  || 0 },
    { state: 'unseen',     n: stats.unseen     || 0 },
  ].filter(s => s.n > 0);

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, color: '#5d4630', marginBottom: 4,
      }}>
        <span>{typeMeta.icon}</span>
        <span style={{ fontWeight: 600 }}>{typeMeta.label}</span>
        <span style={{ marginLeft: 'auto', color: '#8b6f47' }}>
          {stats.mastered || 0} / {total} 已掌握
        </span>
      </div>
      <div style={{
        display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden',
        background: STATE_COLORS.unseen,
      }}>
        {segs.map((s, i) => (
          <div key={i} style={{
            flex: s.n,
            background: STATE_COLORS[s.state],
          }} title={`${STATE_LABELS[s.state]}: ${s.n}`}/>
        ))}
      </div>
    </div>
  );
}

const emptyStyle = {
  padding: 40, textAlign: 'center',
  background: '#fff', border: '1px dashed #e8d5b0',
  borderRadius: 12,
};
'''

p_dash = ROOT / "src" / "community" / "dashboard" / "PersonalDashboard.jsx"
p_dash.parent.mkdir(parents=True, exist_ok=True)
data = DASHBOARD.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_dash.write_bytes(data)
print(f"[OK] wrote src/community/dashboard/PersonalDashboard.jsx ({len(data)} bytes)")

# ============================================================
# 2. Patch CommunityHome.jsx — add 6th card
# ============================================================
p_home = ROOT / "src" / "community" / "CommunityHome.jsx"
src = p_home.read_text(encoding="utf-8")

# Edit 1: Add import for PersonalDashboard
old_imports = "import { supabase } from"
new_imports = "import PersonalDashboard from './dashboard/PersonalDashboard';\nimport { supabase } from"
if "PersonalDashboard" not in src and old_imports in src:
    src = src.replace(old_imports, new_imports, 1)
    print("[OK] added PersonalDashboard import")
elif "PersonalDashboard" in src:
    print("[SKIP] PersonalDashboard import already present")
else:
    print("[FAIL] could not find supabase import line")

# Edit 2: Find an existing card to copy structure from, then add 我的 card
# Look for the pattern of how cards are rendered. The expansion sections
# use openSection state — we add 'mine' as a new section value.
#
# We need to find the location where existing cards (教学/社区/HSK/游戏/非遗)
# are rendered as buttons + their expand panels.
# Strategy: find the array of cards if defined, or find an existing card div
# and insert our new card alongside.

# Let's first inspect by locating known landmarks
landmarks = ['openSection', 'setOpenSection', '教学', '非遗']
print()
print("=== Landmarks found in CommunityHome.jsx ===")
for lm in landmarks:
    n = src.count(lm)
    print(f"  '{lm}': {n} occurrences")

# Look for the cards definition pattern
import re
# Find lines that look like card definitions
card_def_pattern = re.compile(
    r"\{\s*id:\s*['\"](\w+)['\"]\s*,[^}]*pillar"
)
matches = card_def_pattern.findall(src)
print(f"  Card-like definitions found: {matches}")

# Look for a CARDS array specifically
cards_array_match = re.search(
    r"const\s+CARDS\s*=\s*\[",
    src
)
if cards_array_match:
    print(f"  CARDS array starts at offset {cards_array_match.start()}")

# We'll now inject the 我的 card and its expansion handler.
# Approach: find the last card in the array and insert a new one before the
# closing bracket. Look for '非遗' card and add 我的 right after it.

# Find the 非遗 card object definition
feiyi_pattern = re.compile(
    r"(\{\s*id:\s*['\"]feiyi['\"][^}]+?\},?)\s*\n\s*\];",
    re.DOTALL
)
feiyi_match = feiyi_pattern.search(src)
if feiyi_match and "id: 'mine'" not in src and "id: \"mine\"" not in src:
    # Insert 我的 card AFTER 非遗 card, before closing bracket
    new_card_def = """  {
    id: 'mine',
    label: '我的',
    icon: '🌸',
    sub: '学习记录',
    desc: '查看你的学习进度、待复习内容和近期活动。',
    color: '#ec4899',
    bg: '#fdf2f8',
    pillar: 'profile',
  },
"""
    # Insert before the ];
    insertion_point = feiyi_match.end() - 2  # right before "];" -> position before "]"
    # Find the actual position of "]" in feiyi_match
    end_idx = src.find('];', feiyi_match.start())
    if end_idx > 0:
        src = src[:end_idx] + new_card_def + src[end_idx:]
        print("[OK] added 我的 card to CARDS array")
    else:
        print("[FAIL] couldn't locate end of CARDS array")
else:
    if "id: 'mine'" in src or "id: \"mine\"" in src:
        print("[SKIP] 我的 card already in CARDS")
    else:
        print("[WARN] could not find 非遗 card pattern — CARDS structure may be different")
        print("       PersonalDashboard component is created but not wired into entrance")
        print("       Manual wiring required: add a card with id='mine' and render")
        print("       <PersonalDashboard user={user}/> in its expand panel")

# Edit 3: Add expand panel for 我的 card
# Find where openSection is checked for 'feiyi' and add a 'mine' branch nearby
mine_panel_marker = "openSection === 'mine'"
if mine_panel_marker not in src:
    # Find the feiyi expand section
    feiyi_panel_pattern = re.compile(
        r"(\{openSection\s*===\s*['\"]feiyi['\"]\s*&&\s*\([\s\S]+?\)\s*\})"
    )
    feiyi_panel_match = feiyi_panel_pattern.search(src)
    if feiyi_panel_match:
        # Insert mine panel right after feiyi panel
        mine_panel = """

      {openSection === 'mine' && (
        <div style={{
          marginTop: 12, padding: 16,
          background: '#fdf2f8',
          border: '1px solid #fbcfe8',
          borderRadius: 12,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#831843',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>🌸</span><span>我的学习记录</span>
          </div>
          <PersonalDashboard user={user}/>
        </div>
      )}"""
        insert_at = feiyi_panel_match.end()
        src = src[:insert_at] + mine_panel + src[insert_at:]
        print("[OK] added 我的 expand panel")
    else:
        print("[WARN] could not find feiyi panel pattern")
        print("       Card is in CARDS but expand panel not wired")
        print("       Manual wiring required for the expand panel")
else:
    print("[SKIP] 我的 panel already in CommunityHome")

data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_home.write_bytes(data)
print(f"\n[OK] wrote CommunityHome.jsx ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
final = p_home.read_text(encoding="utf-8")
checks = [
    ('PersonalDashboard.jsx exists', p_dash.exists()),
    ('PersonalDashboard import in CommunityHome', "PersonalDashboard from './dashboard/PersonalDashboard'" in final),
    ('我的 card defined (id mine)', "id: 'mine'" in final or "id: \"mine\"" in final),
    ('我的 expand panel wired', "openSection === 'mine'" in final),
    ('PersonalDashboard rendered', '<PersonalDashboard' in final),
]
all_ok = True
for label, val in checks:
    print(f"  [{'OK' if val else 'FAIL'}] {label}")
    if not val: all_ok = False

# Escape check
hex_chars = set('0123456789abcdefABCDEF')
total_escapes = 0
for f in [p_home, p_dash]:
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
print("=" * 60)
print("PHASE G.7 SHIPPED — Personal Dashboard")
print("=" * 60)
print()
print("Test in browser:")
print("  1. npm run dev (if not running)")
print("  2. Login as marco (or any role)")
print("  3. On /community, look for 6th card 我的 (pink, 🌸)")
print("  4. Click → expands inline")
print("  5. Should show empty state for marco (no learning history yet)")
print("     'Welcome marco. You have no learning records yet.'")
print()
print("Empty state is EXPECTED for v1 — no users have practiced yet.")
print("Once attempts are recorded (next phase: wire G.3 hooks into modules),")
print("the dashboard will populate.")
print()
print("If pattern matching FAILED above (CARDS array different shape):")
print("  Open src/community/CommunityHome.jsx manually")
print("  Find where the existing cards (教学/社区/HSK/游戏/非遗) are defined")
print("  Add a card object with id='mine' alongside them")
print("  Add an expand panel: {openSection === 'mine' && <PersonalDashboard user={user}/>}")
print()
print("Build to verify:")
print("  npm run build")
