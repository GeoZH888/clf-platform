# patch_v2_accounts.py
# 1. Create src/admin/v2/AccountsManagement.jsx (new polished unified accounts page)
# 2. Replace UserManagementPage usage in AdminAppV2 with AccountsManagement
# 3. Remove 模块权限 from FOUNDATION_TABS (since merged into accounts)
# 4. Remove the module-perm route handler from TabContent

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# ============================================================
# 1. New AccountsManagement component
# ============================================================
ACCOUNTS_MGMT = '''// src/admin/v2/AccountsManagement.jsx
// Unified accounts page for AdminAppV2.
// Stats + toolbar + user cards. Per-user actions: 权限 (modal) / 角色 (dropdown) / 删除.
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import UserModulesButton from '../UserModulesButton';
import { Search, RefreshCw, Plus, Trash2, X, ChevronDown } from 'lucide-react';

const ROLES = [
  { id: 'super_admin',   label: '超级管理员', short: '超管', bg: '#fef2f2', fg: '#991b1b' },
  { id: 'school_master', label: '校长',       short: '校长', bg: '#fef3e2', fg: '#92400e' },
  { id: 'teacher',       label: '教师',       short: '教师', bg: '#eff6ff', fg: '#1e40af' },
  { id: 'student',       label: '学生',       short: '学生', bg: '#f0fdf4', fg: '#166534' },
  { id: 'parent',        label: '家长',       short: '家长', bg: '#faf5ff', fg: '#6b21a8' },
];

export default function AccountsManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [permsUser, setPermsUser] = useState(null); // user being edited in modal
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clf_user_profiles')
      .select('user_id, name, email, role, created_at, last_sign_in_at')
      .order('role')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Accounts] load error:', error);
    }
    setUsers(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const counts = ROLES.reduce((acc, r) => {
    acc[r.id] = users.filter(u => u.role === r.id).length;
    return acc;
  }, {});

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (u.name || '').toLowerCase().includes(s) ||
             (u.email || '').toLowerCase().includes(s);
    }
    return true;
  });

  const updateRole = async (userId, newRole) => {
    const { error } = await supabase
      .from('clf_user_profiles')
      .update({ role: newRole })
      .eq('user_id', userId);
    if (error) {
      alert('角色更新失败: ' + error.message);
    } else {
      load();
    }
  };

  const removeUser = async (user) => {
    if (!confirm(`确定删除用户 \\"${user.name || user.email}\\"？此操作不可撤销。`)) return;
    const { error } = await supabase
      .from('clf_user_profiles')
      .delete()
      .eq('user_id', user.user_id);
    if (error) {
      alert('删除失败: ' + error.message);
    } else {
      load();
    }
  };

  return (
    <div>
      {/* Stat cards row */}
      <div style={{
        display: 'grid', gap: 10, marginBottom: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      }}>
        <StatCard label="总用户" value={users.length} bg="#fff" fg="#1a0a05" />
        {ROLES.map(r => (
          <StatCard key={r.id} label={r.label} value={counts[r.id] || 0}
            bg={r.bg} fg={r.fg}/>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{
        background: '#fff', border: '1px solid #e8d5b0',
        borderRadius: 12, padding: 12, marginBottom: 14,
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{
          flex: 1, minWidth: 200,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', border: '1px solid #e8d5b0', borderRadius: 8,
          background: '#fafafa',
        }}>
          <Search size={14} color="#a07850"/>
          <input type="text" placeholder="搜索姓名 / 邮箱…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              outline: 'none', fontSize: 13, color: '#1a0a05',
            }}/>
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{
            padding: '8px 12px', fontSize: 13, color: '#1a0a05',
            border: '1px solid #e8d5b0', borderRadius: 8, background: '#fff',
            cursor: 'pointer',
          }}>
          <option value="all">所有角色</option>
          {ROLES.map(r => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
        <button onClick={load} style={btnSecondary}>
          <RefreshCw size={12}/> 刷新
        </button>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>
          <Plus size={12}/> 新建用户
        </button>
      </div>

      {/* User list */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#a07850' }}>加载中…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', color: '#a07850',
          background: '#fff', border: '1px dashed #e8d5b0', borderRadius: 12,
        }}>
          {search || roleFilter !== 'all' ? '无匹配用户' : '还没有用户'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filtered.map(u => (
            <UserCard key={u.user_id} user={u}
              onPermsClick={() => setPermsUser(u)}
              onRoleChange={(newRole) => updateRole(u.user_id, newRole)}
              onDelete={() => removeUser(u)}/>
          ))}
        </div>
      )}

      <div style={{
        marginTop: 12, fontSize: 11, color: '#8b6f47',
        textAlign: 'right',
      }}>
        显示 {filtered.length} / 共 {users.length} 个用户
      </div>

      {/* Module permissions modal */}
      {permsUser && (
        <PermsModal user={permsUser} onClose={() => setPermsUser(null)}/>
      )}

      {/* Create user modal placeholder */}
      {showCreate && (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }}/>
      )}
    </div>
  );
}

function StatCard({ label, value, bg, fg }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${fg}25`,
      borderRadius: 10, padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ fontSize: 11, color: fg, opacity: 0.8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: fg,
        fontFamily: "'STKaiti','KaiTi',serif" }}>
        {value}
      </div>
    </div>
  );
}

function UserCard({ user, onPermsClick, onRoleChange, onDelete }) {
  const role = ROLES.find(r => r.id === user.role);
  const lastLogin = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('zh-CN')
    : '未登录';
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8d5b0',
      borderRadius: 10, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'all 0.15s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = '#c41e3a40';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(196,30,58,0.08)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = '#e8d5b0';
      e.currentTarget.style.boxShadow = 'none';
    }}>
      {/* Avatar */}
      <div style={{
        width: 40, height: 40, borderRadius: 20,
        background: role ? role.bg : '#f3f4f6',
        color: role ? role.fg : '#6b7280',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, flexShrink: 0,
        fontFamily: "'STKaiti','KaiTi',serif",
      }}>
        {(user.name || user.email || '?')[0].toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{
            fontSize: 14, fontWeight: 700, color: '#1a0a05',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{user.name || '(无名)'}</span>
          {role && <RoleBadge role={role}/>}
        </div>
        <div style={{
          fontSize: 11, color: '#8b6f47',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {user.email} · 最后登录: {lastLogin}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <select value={user.role || ''}
          onChange={e => onRoleChange(e.target.value)}
          style={{
            padding: '6px 8px', fontSize: 11,
            border: '1px solid #e8d5b0', borderRadius: 6,
            background: '#fafafa', color: '#1a0a05', cursor: 'pointer',
          }}>
          {ROLES.map(r => (
            <option key={r.id} value={r.id}>{r.short}</option>
          ))}
        </select>
        <UserModulesButton user={user} style={{
          padding: '6px 10px', fontSize: 11,
          background: '#9333ea15', color: '#7e22ce',
          border: '1px solid #9333ea40', borderRadius: 6,
          cursor: 'pointer', fontWeight: 600,
        }}/>
        <button onClick={onDelete} style={{
          padding: '6px 8px', fontSize: 11,
          background: '#fef2f2', color: '#991b1b',
          border: '1px solid #99322820', borderRadius: 6,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3,
        }}>
          <Trash2 size={11}/>
        </button>
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
      background: role.bg, color: role.fg,
      border: `1px solid ${role.fg}30`,
      whiteSpace: 'nowrap',
    }}>{role.short}</span>
  );
}

function PermsModal({ user, onClose }) {
  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 0,
        maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e8d5b0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a0a05' }}>
              模块权限 · {user.name || user.email}
            </div>
            <div style={{ fontSize: 11, color: '#8b6f47', marginTop: 2 }}>
              配置该用户可见的功能模块
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 6, color: '#8b6f47',
          }}>
            <X size={18}/>
          </button>
        </div>
        <div style={{ padding: 18, overflow: 'auto', flex: 1 }}>
          <div style={{
            background: '#fef3e2', border: '1px solid #f59e0b40',
            borderRadius: 10, padding: 12, fontSize: 12, color: '#92400e',
            marginBottom: 14,
          }}>
            点击下面的按钮打开模块权限编辑器（沿用旧后台 UserModulesButton 组件）。
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <UserModulesButton user={user} style={{
              padding: '10px 20px', fontSize: 13,
              background: '#9333ea', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
            }}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 24,
        maxWidth: 420, width: '90%',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a0a05' }}>
            新建用户
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 6, color: '#8b6f47',
          }}>
            <X size={18}/>
          </button>
        </div>
        <div style={{
          background: '#fef3e2', border: '1px solid #f59e0b40',
          borderRadius: 10, padding: 12, fontSize: 12, color: '#92400e',
        }}>
          创建用户的完整流程仍在旧 /admin 后台。
          请前往 <a href="/admin" style={{ color: '#92400e', textDecoration: 'underline' }}>旧后台</a> 创建用户，
          完成后返回此处刷新即可。
        </div>
      </div>
    </div>
  );
}

const btnPrimary = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600,
  background: '#c41e3a', color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const btnSecondary = {
  padding: '8px 12px', fontSize: 12, fontWeight: 600,
  background: '#fff', color: '#5d4630',
  border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const modalBackdrop = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
};
'''

# Make the v2 dir
v2_dir = ROOT / "src" / "admin" / "v2"
v2_dir.mkdir(parents=True, exist_ok=True)

# Write the new component
p_acc = v2_dir / "AccountsManagement.jsx"
data = ACCOUNTS_MGMT.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_acc.write_bytes(data)
print(f"[OK] wrote src/admin/v2/AccountsManagement.jsx ({len(data)} bytes)")

# ============================================================
# 2. Patch AdminAppV2.jsx
# ============================================================
p_v2 = ROOT / "src" / "admin" / "AdminAppV2.jsx"
src = p_v2.read_text(encoding="utf-8")

# Replace UserManagementPage import with AccountsManagement
old_imp = "import UserManagementPage from './UserManagementPage';"
new_imp = "import AccountsManagement from './v2/AccountsManagement';"
if old_imp in src:
    src = src.replace(old_imp, new_imp, 1)
    print("[OK] replaced UserManagementPage import with AccountsManagement")
elif new_imp in src:
    print("[SKIP] AccountsManagement already imported")
else:
    print("[FAIL] neither import found")

# Replace <UserManagementPage/> with <AccountsManagement/>
old_use = "<UserManagementPage/>"
new_use = "<AccountsManagement/>"
if old_use in src:
    src = src.replace(old_use, new_use, 1)
    print("[OK] replaced <UserManagementPage/> with <AccountsManagement/>")
elif new_use in src:
    print("[SKIP] AccountsManagement already in JSX")
else:
    print("[FAIL] component usage not found")

# Remove module-perm tab from FOUNDATION_TABS
old_perm_tab = "  { id: 'module-perm', icon: '🔐', label: '模块权限',    desc: '每个用户可见模块配置' },\n"
if old_perm_tab in src:
    src = src.replace(old_perm_tab, "", 1)
    print("[OK] removed 模块权限 from FOUNDATION_TABS")
else:
    print("[SKIP] 模块权限 tab entry not found (may already be removed)")

# Remove the module-perm route handler in TabContent
# Find from "// 模块权限" comment through its closing }
old_route_marker = "  // 模块权限"
old_route_end_marker = "\n  // 系统日志"
start_idx = src.find(old_route_marker)
end_idx = src.find(old_route_end_marker)
if start_idx != -1 and end_idx != -1:
    src = src[:start_idx] + src[end_idx + 1:]  # +1 to keep the leading \n of next block
    print("[OK] removed module-perm route handler in TabContent")
else:
    print(f"[INFO] module-perm route handler markers not found (start={start_idx}, end={end_idx})")
    print("       this is OK if the previous patch had different markers")

# Write back
data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_v2.write_bytes(data)
print(f"\n[OK] wrote src/admin/AdminAppV2.jsx ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
final = p_v2.read_text(encoding="utf-8")
checks = [
    ('AccountsManagement import', "import AccountsManagement from './v2/AccountsManagement'"),
    ('AccountsManagement JSX', '<AccountsManagement/>'),
    ('No old UserManagementPage import', "import UserManagementPage" not in final),
    ('No 模块权限 tab def', "id: 'module-perm'" not in final),
]
all_ok = True
for label, val in checks:
    ok = val if isinstance(val, bool) else (val in final)
    print(f"  [{'OK' if ok else 'FAIL'}] {label}")
    if not ok: all_ok = False

# Escape check
hex_chars = set('0123456789abcdefABCDEF')
total_escapes = 0
for f in [p_v2, p_acc]:
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
print("Hot-reload: changes pick up automatically if npm run dev is running")
print("Otherwise: npm run build && netlify deploy --prod --dir dist --no-build")
print()
print("Test in browser at /admin-v2:")
print("  - Sidebar should now have 4 foundation tabs (no 模块权限)")
print("  - 账户管理 tab shows: stat cards row + toolbar + user cards")
print("  - Each user row has: avatar + name + role badge + role dropdown + 权限 button + 删除")
print("  - Click 权限 -> modal opens with UserModulesButton")
