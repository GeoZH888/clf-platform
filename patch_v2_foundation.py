# patch_v2_foundation.py
# Wire AI 配置 + RAG 管理 + 模块权限 into AdminAppV2.

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

p = ROOT / "src" / "admin" / "AdminAppV2.jsx"
src = p.read_text(encoding="utf-8")

# ============================================================
# Edit 1: Add component imports after UserManagementPage import
# ============================================================
old1 = "import UserManagementPage from './UserManagementPage';"
new1 = '''import UserManagementPage from './UserManagementPage';
import AIConfigTab from './AIConfigTab';
import ApiKeyManager from './ApiKeyManager';
import PromptTemplatesTab from './PromptTemplatesTab';
import CorpusTab from './CorpusTab';
import UserModulesButton from './UserModulesButton';
import { supabase } from '../lib/supabase';'''

if old1 in src:
    if "import AIConfigTab from './AIConfigTab'" in src:
        print("Edit 1: SKIPPED (already imported)")
    else:
        src = src.replace(old1, new1, 1)
        print("Edit 1: Foundation imports added")
else:
    print("Edit 1: FAIL - UserManagementPage import line not found")
    sys.exit(1)

# ============================================================
# Edit 2: Replace TabContent — add real renderers for foundation tabs
# ============================================================
# Find the existing TabContent function and replace it
old2_start = "// Tab content"
old2_marker = "function TabContent({ activeTab }) {"

# Build the new TabContent function (replace the whole function)
new_tab_content = '''// Tab content
// ============================================================
function TabContent({ activeTab }) {
  const { user } = useAuth();

  // Real accounts tab
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

  // AI 配置 — 3 sub-tabs
  if (activeTab === 'ai-config') {
    return (
      <div>
        <SectionHeader icon="🤖" title="AI 配置" subtitle="API Keys + 默认提供商 + 提示模板" color="#c41e3a"/>
        <AIConfigSection currentUser={user}/>
      </div>
    );
  }

  // RAG 管理 — wraps CorpusTab
  if (activeTab === 'rag') {
    return (
      <div>
        <SectionHeader icon="📚" title="RAG 管理" subtitle="知识库、文档上传、嵌入、检索（暨南教材等）" color="#c41e3a"/>
        <div style={{
          background: '#fff', border: '1px solid #e8d5b0',
          borderRadius: 12, padding: 16,
        }}>
          <CorpusTab/>
        </div>
      </div>
    );
  }

  // 模块权限 — user list with UserModulesButton per row
  if (activeTab === 'module-perm') {
    return (
      <div>
        <SectionHeader icon="🔐" title="模块权限" subtitle="为每个用户配置可见的功能模块" color="#c41e3a"/>
        <ModulePermissionsSection/>
      </div>
    );
  }

  // 系统日志 — placeholder
  if (activeTab === 'logs') {
    return (
      <div>
        <SectionHeader icon="📜" title="系统日志" subtitle="操作日志、错误日志、审计" color="#c41e3a"/>
        <Placeholder hints={['(待建)']}/>
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

// ============================================================
// AI Config section with 3 sub-tabs
// ============================================================
function AIConfigSection({ currentUser }) {
  const [subTab, setSubTab] = useState('providers');
  const tabs = [
    { id: 'providers', label: '默认提供商', icon: '🤖' },
    { id: 'apikeys',   label: 'API Keys',   icon: '🔑' },
    { id: 'prompts',   label: '提示模板',   icon: '📝' },
  ];
  return (
    <div>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16, padding: 6,
        background: '#fff', borderRadius: 10, border: '1px solid #e8d5b0',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            background: subTab === t.id ? '#c41e3a' : 'transparent',
            color: subTab === t.id ? '#fff' : '#5d4630',
            cursor: 'pointer', fontSize: 13,
            fontWeight: subTab === t.id ? 700 : 400,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>
      <div style={{
        background: '#fff', border: '1px solid #e8d5b0',
        borderRadius: 12, padding: 16,
      }}>
        {subTab === 'providers' && <AIConfigTab/>}
        {subTab === 'apikeys'   && <ApiKeyManager/>}
        {subTab === 'prompts'   && <PromptTemplatesTab currentUser={currentUser}/>}
      </div>
    </div>
  );
}

// ============================================================
// Module Permissions — list users + show UserModulesButton per row
// ============================================================
function ModulePermissionsSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('clf_user_profiles')
        .select('user_id, name, email, role')
        .order('role')
        .order('name');
      if (!error) setUsers(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (u.name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s);
    }
    return true;
  });

  const roleBadge = (role) => {
    const colors = {
      super_admin:   { bg: '#fef2f2', fg: '#991b1b', label: '超管' },
      school_master: { bg: '#fef3e2', fg: '#92400e', label: '校长' },
      teacher:       { bg: '#eff6ff', fg: '#1e40af', label: '教师' },
      student:       { bg: '#f0fdf4', fg: '#166534', label: '学生' },
      parent:        { bg: '#faf5ff', fg: '#6b21a8', label: '家长' },
    };
    const c = colors[role] || { bg: '#f3f4f6', fg: '#6b7280', label: role };
    return (
      <span style={{
        padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
        background: c.bg, color: c.fg, border: `1px solid ${c.fg}30`,
      }}>{c.label}</span>
    );
  };

  return (
    <div style={{
      background: '#fff', border: '1px solid #e8d5b0',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input type="text" placeholder="搜索姓名 / 邮箱…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 180,
            padding: '8px 12px', fontSize: 13,
            border: '1px solid #e8d5b0', borderRadius: 8,
          }}/>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{
            padding: '8px 12px', fontSize: 13,
            border: '1px solid #e8d5b0', borderRadius: 8, background: '#fff',
          }}>
          <option value="all">所有角色</option>
          <option value="super_admin">超管</option>
          <option value="school_master">校长</option>
          <option value="teacher">教师</option>
          <option value="student">学生</option>
          <option value="parent">家长</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#a07850' }}>加载中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#a07850' }}>无匹配用户</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(u => (
            <div key={u.user_id} style={{
              padding: 12, border: '1px solid #e8d5b0', borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fafafa',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a0a05' }}>
                    {u.name || '(no name)'}
                  </span>
                  {roleBadge(u.role)}
                </div>
                <div style={{ fontSize: 11, color: '#8b6f47', marginTop: 2 }}>
                  {u.email}
                </div>
              </div>
              <UserModulesButton user={u} style={{
                padding: '6px 12px', fontSize: 12,
              }}/>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: '#8b6f47', textAlign: 'right' }}>
        共 {filtered.length} 个用户（共 {users.length}）
      </div>
    </div>
  );
}'''

# Replace from "// Tab content" comment up to (but not including) the next function "function GroupHeader"
# We'll use a different strategy — find the start marker and end marker
end_marker = "function GroupHeader({ label"

start_idx = src.find(old2_start)
end_idx = src.find(end_marker)

if start_idx == -1:
    print("Edit 2: FAIL - '// Tab content' marker not found")
    sys.exit(1)
if end_idx == -1:
    print("Edit 2: FAIL - 'function GroupHeader' marker not found")
    sys.exit(1)

# Find existing TabContent + helpers block range
# We replace everything between // Tab content (start_idx) and function GroupHeader (end_idx)
# Actually we want to keep GroupHeader. Replace just what's BEFORE it.

# But GroupHeader and helpers are BEFORE TabContent in the original file.
# Let me search for the actual function in current file
existing_tab_content_idx = src.find("function TabContent({ activeTab })")
if existing_tab_content_idx == -1:
    print("Edit 2: FAIL - existing TabContent function not found")
    sys.exit(1)

# Find "// ====" comment block above existing function
above_search_start = max(0, existing_tab_content_idx - 200)
banner_idx = src.rfind("// ====", above_search_start, existing_tab_content_idx)
if banner_idx == -1:
    banner_idx = existing_tab_content_idx

# Find the end: search for next top-level "function " that is NOT inside TabContent
# Easier: find the last function in the file before "function SectionHeader"
section_header_idx = src.find("function SectionHeader")
if section_header_idx == -1:
    print("Edit 2: FAIL - SectionHeader marker not found")
    sys.exit(1)

# Replace from the // Tab content banner down to (but not including) function SectionHeader
# This replaces TabContent, AIConfigSection (placeholder space), ModulePermissionsSection — all in the new code
old_block = src[banner_idx:section_header_idx]
new_block = new_tab_content + "\n\n"

if "function AIConfigSection" in src:
    print("Edit 2: SKIPPED (AIConfigSection already exists, foundation already wired)")
else:
    src = src[:banner_idx] + new_block + src[section_header_idx:]
    print("Edit 2: TabContent + helpers replaced with foundation-wired version")

# ============================================================
# Write back
# ============================================================
data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p.write_bytes(data)
print(f"\nWrote {p} ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
final = p.read_text(encoding="utf-8")
print("\n=== Verification ===")
checks = [
    ('AIConfigTab import', "import AIConfigTab from './AIConfigTab'"),
    ('CorpusTab import', "import CorpusTab from './CorpusTab'"),
    ('UserModulesButton import', "import UserModulesButton from './UserModulesButton'"),
    ('supabase import', "from '../lib/supabase'"),
    ('AIConfigSection function', 'function AIConfigSection'),
    ('ModulePermissionsSection', 'function ModulePermissionsSection'),
    ('CorpusTab usage', '<CorpusTab/>'),
    ('AIConfigTab usage', '<AIConfigTab/>'),
]
all_ok = True
for label, marker in checks:
    if marker in final:
        print(f"  [OK] {label}")
    else:
        print(f"  [FAIL] {label}: missing '{marker}'")
        all_ok = False

# Escape check
hex_chars = set('0123456789abcdefABCDEF')
escapes = 0
i = 0
while i < len(final) - 5:
    if final[i] == chr(92) and final[i+1] == 'u':
        if all(c in hex_chars for c in final[i+2:i+6]):
            escapes += 1
            i += 6
            continue
    i += 1
print(f"  Raw escapes: {escapes}")

print("\n" + ("=== ALL OK ===" if all_ok and escapes == 0 else "=== SOME FAIL ==="))

print()
print("Hot-reload should pick up changes immediately if npm run dev is running.")
print("Otherwise: npm run build + netlify deploy --prod --dir dist --no-build")
print()
print("Test in browser:")
print("  /admin-v2 -> AI 配置 tab -> see 3 sub-tabs (默认提供商 / API Keys / 提示模板)")
print("  /admin-v2 -> RAG 管理 tab -> CorpusTab renders")
print("  /admin-v2 -> 模块权限 tab -> user list with UserModulesButton per row")
