# patch_three_card_home.py
# Two fixes in one:
#   1. Replace mojibate document.title in App.jsx with proper Chinese
#   2. Rewrite CommunityHome.jsx with 3-card layout (教学/社区/非遗) + flat modules grid
#
# Run from clf-platform root:
#   python patch_three_card_home.py

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# ============================================================
# 1. Fix App.jsx mojibate document.title
# ============================================================
print("=== Fixing App.jsx tab title ===")
app = ROOT / "src" / "App.jsx"
src = app.read_text(encoding="utf-8")

# Find ANY mojibate document.title (use regex on the whole file)
import re
title_pattern = re.compile(r"document\.title\s*=\s*'[^']*';")
matches = title_pattern.findall(src)
print(f"  found {len(matches)} document.title assignments:")
for m in matches:
    print(f"    {m}")

# Replace with the correct UTF-8 string
correct_title_line = "document.title = '\u5927\u536b\u5b66\u4e2d\u6587';"  # 大卫学中文
src_new = title_pattern.sub(correct_title_line, src)

if src_new != src:
    app.write_text(src_new, encoding="utf-8")
    print(f"  replaced with: {correct_title_line}")
else:
    print("  no changes needed")

# ============================================================
# 2. Rewrite CommunityHome.jsx with 3-card layout + flat module grid
# ============================================================
print("\n=== Rewriting CommunityHome.jsx ===")
ch = ROOT / "src" / "community" / "CommunityHome.jsx"

NEW_HOME = '''// src/community/CommunityHome.jsx
// 3-card home: 教学 / 社区 / 非遗
// Click 教学 -> role panel
// Click 社区 -> expand inline module grid
// Click 非遗 -> /feiyi
import React, { useEffect, useState } from 'react';
import { useAuth } from '../school/contexts/AuthContext';
import { supabase } from '../school/services/supabase';
import { LogOut, GraduationCap, Globe, Theater, Lock } from 'lucide-react';

const ROLE_HOME = {
  super_admin:   '/admin',
  school_master: '/school-master',
  teacher:       '/teacher',
  student:       '/student',
  parent:        '/parent',
};

const ROLE_LABEL = {
  super_admin:   '\u7ba1\u7406\u540e\u53f0',
  school_master: '\u6821\u957f\u9762\u677f',
  teacher:       '\u6559\u5e08\u5de5\u4f5c\u53f0',
  student:       '\u5b66\u751f\u9762\u677f',
  parent:        '\u5bb6\u957f\u9762\u677f',
};

// Flat module list (no categories)
const MODULES = [
  { id: 'characters', icon: '\u270d\ufe0f', name: '\u7ec3\u5b57',     route: '/characters' },
  { id: 'words',      icon: '\ud83d\udcda', name: '\u8bcd\u8bed',     route: '/words' },
  { id: 'pinyin',     icon: '\ud83d\udd24', name: '\u62fc\u97f3',     route: '/pinyin' },
  { id: 'grammar',    icon: '\ud83d\udcd0', name: '\u8bed\u6cd5',     route: '/grammar' },
  { id: 'hsk',        icon: '\ud83c\udfaf', name: 'HSK',              route: '/hsk' },
  { id: 'courses',    icon: '\ud83d\udcd6', name: '\u8bfe\u7a0b',     route: '/courses' },
  { id: 'chengyu',    icon: '\ud83c\udf38', name: '\u6210\u8bed',     route: '/chengyu' },
  { id: 'poetry',     icon: '\ud83c\udf43', name: '\u8bd7\u6b4c',     route: '/poetry' },
  { id: 'riddles',    icon: '\ud83c\udfee', name: '\u731c\u706f\u8c1c', route: '/riddles' },
  { id: 'home',       icon: '\ud83c\udfe0', name: '\u4e3b\u9875',     route: '/' },
  { id: 'me',         icon: '\ud83d\udc64', name: '\u6211\u7684',     route: '/me' },
  { id: 'progress',   icon: '\ud83d\udcca', name: '\u5b66\u4e60\u8fdb\u5ea6', route: '/progress' },
];

export default function CommunityHome() {
  const { user, logout } = useAuth();
  const [allowedIds, setAllowedIds] = useState(null);
  const [showModules, setShowModules] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      if (user.role === 'super_admin') {
        setAllowedIds(MODULES.map(m => m.id));
        return;
      }
      try {
        const { data } = await supabase
          .from('clf_user_modules')
          .select('module_id, enabled')
          .eq('user_id', user.id);
        const overrides = {};
        (data || []).forEach(r => { overrides[r.module_id] = r.enabled; });
        const allowed = MODULES.filter(m => overrides[m.id] === true).map(m => m.id);
        setAllowedIds(allowed);
      } catch (e) {
        console.warn('[CommunityHome]', e);
        setAllowedIds([]);
      }
    })();
  }, [user?.id, user?.role]);

  const myRole = user?.role;
  const schoolUrl = ROLE_HOME[myRole];
  const schoolLabel = ROLE_LABEL[myRole] || '\u6559\u5b66';

  return (
    <div style={{ minHeight: '100dvh', background: '#fdf6e3' }}>
      <header style={{
        background: '#c41e3a', color: '#fff',
        padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontSize: 20, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 4,
          }}>\u5927\u536b\u5b66\u4e2d\u6587</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            {user?.name || user?.email} \u00B7 {myRole || 'visitor'}
          </div>
        </div>
        <button onClick={logout} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.5)',
          color: '#fff', padding: '8px 12px', borderRadius: 8,
          cursor: 'pointer', fontSize: 12,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <LogOut size={12}/> \u9000\u51fa
        </button>
      </header>

      <main style={{ padding: '32px 20px', maxWidth: 1100, margin: '0 auto' }}>
        {/* 3 big cards */}
        <div style={{
          display: 'grid', gap: 18,
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}>
          <BigCard
            icon={GraduationCap}
            title="\u6559\u5b66"
            subtitle={schoolLabel}
            color="#c41e3a"
            onClick={() => schoolUrl && (window.location.href = schoolUrl)}
            disabled={!schoolUrl}
          />
          <BigCard
            icon={Globe}
            title="\u793e\u533a"
            subtitle={showModules ? '\u70b9\u51fb\u6536\u8d77' : '\u5b66\u4e60\u6a21\u5757'}
            color="#3b82f6"
            onClick={() => setShowModules(s => !s)}
            highlighted={showModules}
          />
          <BigCard
            icon={Theater}
            title="\u975e\u9057"
            subtitle="\u4e2d\u534e\u6587\u5316"
            color="#a07850"
            onClick={() => window.location.href = '/feiyi'}
          />
        </div>

        {/* Flat module grid (only when 社区 expanded) */}
        {showModules && (
          <section style={{ marginTop: 28 }}>
            <div style={{
              fontSize: 13, color: '#5d4630', marginBottom: 12,
              borderTop: '1px solid #e8d5b0', paddingTop: 18,
            }}>
              {allowedIds === null
                ? '\u52a0\u8f7d\u4e2d\u00b7\u00b7\u00b7'
                : `\u53ef\u7528\u6a21\u5757 \u00B7 ${allowedIds.length} / ${MODULES.length}`}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 10,
            }}>
              {MODULES.map(m => {
                const allowed = allowedIds?.includes(m.id);
                return <ModuleTile key={m.id} mod={m} allowed={allowed}/>;
              })}
            </div>
            {user?.role !== 'super_admin' && allowedIds && allowedIds.length === 0 && (
              <div style={{
                marginTop: 16, padding: 14,
                background: '#fff', borderRadius: 10,
                border: '1px dashed #e8d5b0', textAlign: 'center',
                fontSize: 12, color: '#a07850',
              }}>
                \u8fd8\u6ca1\u6709\u5f00\u542f\u4efb\u4f55\u6a21\u5757\u3002\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u5206\u914d\u3002
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function BigCard({ icon: Icon, title, subtitle, color, onClick, disabled, highlighted }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: highlighted ? `${color}15` : '#fff',
      border: `2px solid ${highlighted ? color : color + '33'}`,
      borderRadius: 16,
      padding: '32px 24px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      textAlign: 'center',
      transition: 'all 0.2s',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      minHeight: 180,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={32} color={color}/>
      </div>
      <div style={{
        fontSize: 26, fontWeight: 700, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 6,
      }}>{title}</div>
      <div style={{ fontSize: 12, color: '#a07850' }}>{subtitle}</div>
    </button>
  );
}

function ModuleTile({ mod, allowed }) {
  const handleClick = () => { if (allowed) window.location.href = mod.route; };
  return (
    <button onClick={handleClick} disabled={!allowed} style={{
      background: allowed ? '#fff' : '#f5f0e0',
      border: `1px solid ${allowed ? '#3b82f633' : '#e8d5b0'}`,
      borderRadius: 10, padding: '14px 10px',
      cursor: allowed ? 'pointer' : 'not-allowed',
      opacity: allowed ? 1 : 0.5,
      textAlign: 'center', position: 'relative',
    }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{mod.icon}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1a0a05' }}>{mod.name}</div>
      {!allowed && (
        <div style={{ position: 'absolute', top: 4, right: 4, color: '#a07850' }}>
          <Lock size={10}/>
        </div>
      )}
    </button>
  );
}
'''

ch.write_text(NEW_HOME, encoding="utf-8")
print(f"  CommunityHome.jsx rewritten ({ch.stat().st_size} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
new_app = app.read_text(encoding="utf-8")
if "document.title = '\u5927\u536b\u5b66\u4e2d\u6587'" in new_app:
    print("  [OK] App.jsx tab title is correct UTF-8 Chinese")
elif "å¤§å«" in new_app:
    print("  [FAIL] App.jsx still has mojibate")
else:
    print("  [WARN] App.jsx state unclear")

new_ch = ch.read_text(encoding="utf-8")
if "BigCard" in new_ch and "GraduationCap" in new_ch and "Theater" in new_ch:
    print("  [OK] CommunityHome has 3 cards (教学/社区/非遗)")
else:
    print("  [FAIL] CommunityHome rewrite incomplete")
if "CATEGORIES" in new_ch:
    print("  [WARN] Old categories still in CommunityHome")
else:
    print("  [OK] No more categories in CommunityHome")

print("\n=== DONE ===")
print()
print("NEXT:")
print("  npm run build")
print("  netlify deploy --prod --dir dist --no-build")
