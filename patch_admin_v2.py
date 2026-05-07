# patch_admin_v2.py
# Build new admin shell at /admin-v2 with sidebar + collapsible groups.
# Old /admin and AdminApp.jsx stay untouched.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# ============================================================
# AdminAppV2.jsx — new sidebar shell
# ============================================================
ADMIN_V2 = '''// src/admin/AdminAppV2.jsx
// New super_admin shell: sidebar with two collapsible groups.
// Foundation group: accounts / AI config / RAG / module permissions / logs
// Modules group:    by pillar (教学/社区/HSK/游戏/非遗/future)
//
// Old /admin (AdminApp.jsx) remains untouched. This is at /admin-v2.
import React, { useState } from 'react';
import { useAuth } from '../school/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Globe, ChevronDown, ChevronRight } from 'lucide-react';

// We'll wrap the existing user management page so accounts tab uses real logic
import UserManagementPage from './UserManagementPage';

// ============================================================
// Tab definitions — grouped
// ============================================================
const FOUNDATION_TABS = [
  { id: 'accounts',    icon: '👥', label: '账户管理',    desc: '用户、角色、学校、班级' },
  { id: 'ai-config',   icon: '🤖', label: 'AI 配置',     desc: '各 AI 提供商 API Key + 默认提供商' },
  { id: 'rag',         icon: '📚', label: 'RAG 管理',    desc: '知识库、文档上传、嵌入、检索（暨南教材等）' },
  { id: 'module-perm', icon: '🔐', label: '模块权限',    desc: '每个用户可见模块配置' },
  { id: 'logs',        icon: '📜', label: '系统日志',    desc: '操作日志、错误日志、审计' },
];

const MODULE_TABS = [
  { id: 'pillar-school',    icon: '🏫', label: '教学',  desc: '作业、班级、课程、教师工具', color: '#c41e3a' },
  { id: 'pillar-community', icon: '🌐', label: '社区',  desc: '练字、词语、拼音、成语、诗歌、语法、课程等', color: '#3b82f6' },
  { id: 'pillar-hsk',       icon: '🎯', label: 'HSK',   desc: 'HSK1-HSK6 等级内容', color: '#9333ea' },
  { id: 'pillar-game',      icon: '🎮', label: '游戏',  desc: '猜灯谜及其他趣味模块', color: '#10b981' },
  { id: 'pillar-feiyi',     icon: '🏮', label: '非遗',  desc: '戏曲、民俗、工艺、节庆', color: '#d97706' },
  { id: 'pillar-future',    icon: '✨', label: '未来',  desc: '小卖部、家长门户、其他规划中模块', color: '#6b7280' },
];

// Existing tabs from old AdminApp that should be reachable inside new sections
// (we leave a hint; actual wiring comes in next sessions)
const PILLAR_HINTS = {
  'pillar-community': [
    { name: 'CharacterImportWizard', desc: '汉字导入向导' },
    { name: 'CLFWordsAdminTab',      desc: '词语管理' },
    { name: 'PinyinAdminTab',        desc: '拼音管理' },
    { name: 'GrammarAdminTab',       desc: '语法管理' },
    { name: 'ChengyuAdminTab',       desc: '成语管理' },
    { name: 'PoetryAdminTab',        desc: '诗歌管理' },
    { name: 'StoryAdminTab',         desc: '故事会管理' },
    { name: 'ScenarioAdminTab',      desc: '场景对话管理' },
  ],
  'pillar-hsk':    [{ name: 'HSKAdminTab', desc: 'HSK 题库管理' }],
  'pillar-game':   [{ name: 'RiddleAdminTab', desc: '猜灯谜管理' }],
  'pillar-feiyi':  [{ name: '(待建)', desc: '非遗内容管理（下一会话构建）' }],
  'pillar-school': [{ name: '(待建)', desc: '教学内容管理（下一会话构建）' }],
  'pillar-future': [{ name: '(待建)', desc: '未来模块（小卖部、家长门户等）' }],
};

const FOUNDATION_HINTS = {
  'ai-config':   ['AIConfigTab', 'ApiKeyManager', 'PromptTemplatesTab'],
  'rag':         ['CorpusTab', 'ExtractFromCorpusWizard'],
  'module-perm': ['UserModulesButton'],
  'logs':        ['(待建)'],
};

// ============================================================
// Main component
// ============================================================
export default function AdminAppV2() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('accounts');
  const [foundationOpen, setFoundationOpen] = useState(true);
  const [modulesOpen, setModulesOpen] = useState(true);

  if (!user) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: '#a07850' }}>
        请先登录…
      </div>
    );
  }
  if (user.role !== 'super_admin') {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: '#c41e3a' }}>
        只有超级管理员可访问此页。
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 100%)',
      color: '#1a0a05', display: 'flex',
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 260,
        background: 'linear-gradient(180deg, #8b0000 0%, #c41e3a 100%)',
        position: 'fixed', height: '100vh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '20px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 26 }}>🐼</span>
            <div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: '#fff5e6',
                fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3,
              }}>大卫学中文</div>
              <div style={{ fontSize: 10, color: 'rgba(255,245,230,0.7)' }}>
                超级管理员后台
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,245,230,0.7)', marginTop: 6 }}>
            {user.name || user.email}
          </div>
        </div>

        <div style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <GroupHeader
            label="基础设施"
            isOpen={foundationOpen}
            onToggle={() => setFoundationOpen(o => !o)}/>
          {foundationOpen && FOUNDATION_TABS.map(t => (
            <NavButton key={t.id} tab={t} active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}/>
          ))}

          <div style={{ height: 8 }}/>

          <GroupHeader
            label="模块内容"
            isOpen={modulesOpen}
            onToggle={() => setModulesOpen(o => !o)}/>
          {modulesOpen && MODULE_TABS.map(t => (
            <NavButton key={t.id} tab={t} active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}/>
          ))}
        </div>

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
          borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <button onClick={() => window.location.href = '/admin'} style={btnSecondary}>
            ↩ 旧后台 /admin
          </button>
          <button onClick={() => window.location.href = '/community'} style={btnSecondary}>
            <Globe size={12}/> 去社区
          </button>
          <button onClick={logout} style={btnDanger}>
            <LogOut size={12}/> 退出
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: 260, padding: 28, overflow: 'auto' }}>
        <TabContent activeTab={activeTab}/>
      </main>
    </div>
  );
}

function GroupHeader({ label, isOpen, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 8px',
      background: 'transparent', border: 'none',
      color: 'rgba(255,245,230,0.6)',
      cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: 3,
      textAlign: 'left',
    }}>
      {isOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
      {label}
    </button>
  );
}

function NavButton({ tab, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px 8px 18px', borderRadius: 8,
      background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
      color: '#fff5e6',
      border: active ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
      cursor: 'pointer', fontSize: 12,
      fontWeight: active ? 700 : 400,
      textAlign: 'left',
    }}>
      <span style={{ fontSize: 14 }}>{tab.icon}</span>
      {tab.label}
    </button>
  );
}

const btnSecondary = {
  padding: '7px 10px', background: 'rgba(255,255,255,0.1)',
  color: '#fff5e6', border: '1px solid rgba(255,255,255,0.25)',
  borderRadius: 8, cursor: 'pointer', fontSize: 11,
  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
};
const btnDanger = {
  padding: '7px 10px', background: 'rgba(0,0,0,0.2)',
  color: '#fff5e6', border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8, cursor: 'pointer', fontSize: 11,
  display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
};

// ============================================================
// Tab content
// ============================================================
function TabContent({ activeTab }) {
  // Real accounts tab — wraps existing UserManagementPage
  if (activeTab === 'accounts') {
    return (
      <div>
        <SectionHeader icon="👥" title="账户管理" subtitle="Accounts · 用户、角色、学校、班级" color="#c41e3a"/>
        <div style={{
          background: '#fff', border: '1px solid #e8d5b0',
          borderRadius: 12, padding: 16,
        }}>
          <UserManagementPage/>
        </div>
      </div>
    );
  }

  // Foundation placeholders
  const foundationTab = FOUNDATION_TABS.find(t => t.id === activeTab);
  if (foundationTab) {
    const hints = FOUNDATION_HINTS[activeTab] || [];
    return (
      <div>
        <SectionHeader
          icon={foundationTab.icon}
          title={foundationTab.label}
          subtitle={foundationTab.desc}
          color="#c41e3a"/>
        <Placeholder hints={hints}/>
      </div>
    );
  }

  // Module pillars
  const moduleTab = MODULE_TABS.find(t => t.id === activeTab);
  if (moduleTab) {
    const hints = PILLAR_HINTS[activeTab] || [];
    return (
      <div>
        <SectionHeader
          icon={moduleTab.icon}
          title={moduleTab.label}
          subtitle={moduleTab.desc}
          color={moduleTab.color}/>
        <PillarPlaceholder hints={hints} color={moduleTab.color}/>
      </div>
    );
  }

  return <div style={{ color: '#a07850' }}>选择左侧标签开始…</div>;
}

function SectionHeader({ icon, title, subtitle, color }) {
  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${color}30`,
      borderRadius: 16, padding: '20px 24px', marginBottom: 18,
      display: 'flex', alignItems: 'center', gap: 14,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -10, right: -10, fontSize: 100, opacity: 0.06,
        lineHeight: 1, color, pointerEvents: 'none', userSelect: 'none',
        fontFamily: 'serif', fontWeight: 900,
      }}>{title}</div>
      <div style={{
        width: 50, height: 50, borderRadius: 14, background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, border: `1px solid ${color}30`, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#8b6f47', marginTop: 2 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function Placeholder({ hints }) {
  return (
    <div style={{
      background: '#fff', border: '1px dashed #e8d5b0',
      borderRadius: 14, padding: '40px 24px',
    }}>
      <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a0a05',
        textAlign: 'center', marginBottom: 8,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>
        建设中 · Coming soon
      </div>
      <div style={{ fontSize: 12, color: '#8b6f47', textAlign: 'center', marginBottom: 20 }}>
        本模块将在下一会话构建。
      </div>
      {hints.length > 0 && (
        <div style={{
          background: '#fef3e2', border: '1px solid #f59e0b40',
          borderRadius: 10, padding: 14, fontSize: 12, color: '#92400e',
        }}>
          <strong>已有相关组件可复用：</strong>
          <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
            {hints.map((h, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                <code style={{ fontSize: 11 }}>{h}</code>
              </li>
            ))}
          </ul>
          <div style={{ fontSize: 11, marginTop: 8, opacity: 0.8 }}>
            可以从旧 /admin 后台访问这些功能。
          </div>
        </div>
      )}
    </div>
  );
}

function PillarPlaceholder({ hints, color }) {
  return (
    <div style={{
      background: '#fff', border: '1px dashed #e8d5b0',
      borderRadius: 14, padding: '32px 24px',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a0a05',
        marginBottom: 14, fontFamily: "'STKaiti','KaiTi',serif" }}>
        本支柱（pillar）下的模块
      </div>
      {hints.length === 0 ? (
        <div style={{ fontSize: 12, color: '#8b6f47' }}>暂无</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {hints.map((h, i) => (
            <div key={i} style={{
              padding: 12, background: `${color}08`,
              border: `1px solid ${color}25`,
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: color, fontWeight: 700,
              }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a0a05' }}>
                  {h.name}
                </div>
                <div style={{ fontSize: 11, color: '#8b6f47', marginTop: 1 }}>
                  {h.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{
        marginTop: 18, padding: 12,
        background: '#fef3e2', border: '1px solid #f59e0b40',
        borderRadius: 10, fontSize: 12, color: '#92400e',
      }}>
        <strong>下一步：</strong> 这些组件目前在旧 /admin 后台中可访问。
        下一会话将把它们重组进新的 sidebar 结构，或为缺失的部分构建新的 CRUD 界面。
      </div>
    </div>
  );
}
'''

# ============================================================
# Patch App.jsx to add /admin-v2 route
# ============================================================
print("=== Writing AdminAppV2.jsx ===")
p_adminv2 = ROOT / "src" / "admin" / "AdminAppV2.jsx"
data = ADMIN_V2.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_adminv2.write_bytes(data)
print(f"  wrote  src/admin/AdminAppV2.jsx ({len(data)} bytes)")

# ============================================================
# Patch App.jsx — add import + route
# ============================================================
print("\n=== Patching App.jsx ===")
p_app = ROOT / "src" / "App.jsx"
if not p_app.exists():
    print("  ERROR: src/App.jsx not found")
    sys.exit(1)

app_src = p_app.read_text(encoding='utf-8')

# Check if already patched
if 'AdminAppV2' in app_src:
    print("  [SKIP] App.jsx already imports AdminAppV2")
else:
    # Find existing AdminApp import line and add V2 right after
    lines = app_src.split('\n')
    new_lines = []
    inserted_import = False
    inserted_route = False
    for i, line in enumerate(lines):
        new_lines.append(line)
        # Insert import after AdminApp import
        if not inserted_import and ('AdminApp' in line and 'import' in line and 'AdminAppV2' not in line):
            new_lines.append("import AdminAppV2 from './admin/AdminAppV2';")
            inserted_import = True
            print(f"  Inserted import after line {i+1}")
        # Insert route before /admin route OR after it
        if not inserted_route and ('/admin' in line and ('Route' in line or 'path=' in line)):
            # Insert v2 route AFTER current admin route
            # Make sure we hit the admin Route line specifically
            if 'AdminApp' in line or 'admin/' in line.lower():
                indent = '  ' * 6
                new_lines.append(f'{indent}<Route path="/admin-v2/*" element={{<AdminAppV2 />}} />')
                inserted_route = True
                print(f"  Inserted route after line {i+1}")

    if inserted_import and inserted_route:
        new_src = '\n'.join(new_lines)
        data = new_src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
        p_app.write_bytes(data)
        print("  App.jsx patched successfully")
    else:
        print(f"  WARN: import inserted={inserted_import}, route inserted={inserted_route}")
        print("  You may need to manually add to App.jsx:")
        print("    import AdminAppV2 from './admin/AdminAppV2';")
        print("    <Route path=\"/admin-v2/*\" element={<AdminAppV2 />} />")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
import re
checks = [
    ('src/admin/AdminAppV2.jsx', 'FOUNDATION_TABS'),
    ('src/admin/AdminAppV2.jsx', 'MODULE_TABS'),
    ('src/admin/AdminAppV2.jsx', 'UserManagementPage'),
    ('src/App.jsx', 'AdminAppV2'),
    ('src/App.jsx', '/admin-v2'),
]
all_ok = True
for rel, marker in checks:
    p = ROOT / rel
    if not p.exists():
        print(f"  [MISSING] {rel}")
        all_ok = False
        continue
    if marker in p.read_text(encoding='utf-8'):
        print(f"  [OK] {rel} :: '{marker}'")
    else:
        print(f"  [FAIL] {rel} :: missing '{marker}'")
        all_ok = False

# Escape check
total_escapes = 0
hex_chars = set('0123456789abcdefABCDEF')
for rel in ['src/admin/AdminAppV2.jsx']:
    p = ROOT / rel
    if not p.exists(): continue
    txt = p.read_text(encoding='utf-8')
    i = 0
    while i < len(txt) - 5:
        if txt[i] == chr(92) and txt[i+1] == 'u':
            if all(c in hex_chars for c in txt[i+2:i+6]):
                total_escapes += 1
                i += 6
                continue
        i += 1
print(f"  Raw \\\\uXXXX escapes: {total_escapes}")

print("\n" + ("=== ALL OK ===" if all_ok and total_escapes == 0 else "=== SOME FAIL ==="))
print()
print("NEXT:")
print("  npm run build")
print("  netlify deploy --prod --dir dist --no-build")
print()
print("THEN:")
print("  Login as super_admin, go to https://david-zhongwen.net/admin-v2")
print("  You should see:")
print("    - Sidebar with 大卫学中文 / 超级管理员后台 header")
print("    - Two collapsible groups: 基础设施 + 模块内容")
print("    - 11 tabs total (5 foundation + 6 module pillars)")
print("    - Click '账户管理' = real UserManagementPage")
print("    - Click any other tab = placeholder with 'hints' showing existing components")
print()
print("OLD /admin still works fully — this is a parallel new shell.")
