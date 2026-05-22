// src/admin/v2/AccountsManagement.jsx
// Unified accounts page for AdminAppV2.
// Stats + toolbar + user cards. Per-user actions: 权限 (modal) / 角色 (dropdown) / 删除.
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { writeAuditLog } from '../../lib/adminAudit';
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
  const [instUser, setInstUser] = useState(null); // user being edited for institution

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clf_user_profiles')
      .select('user_id, name, email, role, created_at, last_sign_in_at, institution_name, institution_logo_url')
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
    const target = users.find(u => u.user_id === userId);
    const oldRole = target?.role;
    if (oldRole === newRole) return;

    // Confirmation — role changes are privileged and the UI used to fire
    // silently on a dropdown change. Confirm explicitly, especially for
    // demotions and super_admin grants.
    const targetLabel = target?.name || target?.email || userId.slice(0, 8);
    const oldLbl = ROLES.find(r => r.id === oldRole)?.label || oldRole || '(none)';
    const newLbl = ROLES.find(r => r.id === newRole)?.label || newRole;
    const warn = newRole === 'super_admin' ? '\n\n⚠️ This grants full admin access. Confirm carefully.' : '';
    if (!confirm(`将 "${targetLabel}" 的角色从「${oldLbl}」改为「${newLbl}」？${warn}`)) {
      load(); // re-load to reset the dropdown to its on-screen old value
      return;
    }

    const { error } = await supabase
      .from('clf_user_profiles')
      .update({ role: newRole })
      .eq('user_id', userId);
    if (error) {
      alert('角色更新失败: ' + error.message);
      load();
      return;
    }
    // Best-effort audit log (never blocks)
    writeAuditLog({
      targetUserId: userId,
      action: 'role_change',
      before: { role: oldRole },
      after:  { role: newRole },
    });
    load();
  };

  const updateInstitution = async (userId, institutionName, logoUrl) => {
    const { error } = await supabase
      .from('clf_user_profiles')
      .update({
        institution_name: institutionName || null,
        institution_logo_url: logoUrl || null,
      })
      .eq('user_id', userId);
    if (error) {
      alert('机构信息更新失败: ' + error.message);
    } else {
      load();
      setInstUser(null);
    }
  };

  const resetPassword = async (user) => {
    const label = user.name || user.email || user.user_id.slice(0, 8);
    if (!confirm(`为 "${label}" 重置密码？将生成一个新的临时密码并显示一次。`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/.netlify/functions/admin-manage-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ action: 'reset_password', user_id: user.user_id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert('重置失败: ' + (data.error || res.status));
        return;
      }
      writeAuditLog({
        targetUserId: user.user_id,
        action: 'password_reset',
        before: null,
        after: { reset_at: new Date().toISOString() },  // never log the password
      });
      // Show the new password ONCE so admin can share out-of-band.
      // Wrap in prompt for easy copy (most browsers preselect content in prompt).
      window.prompt(
        `✓ ${label} 的新密码已生成。请复制并通过线下渠道告知用户（仅显示一次）：`,
        data.new_password
      );
    } catch (e) {
      alert('重置失败: ' + (e?.message || 'Network error'));
    }
  };

  const removeUser = async (user) => {
    if (!confirm(`确定删除用户 \"${user.name || user.email}\"？此操作不可撤销。`)) return;
    // Snapshot the row BEFORE delete so the audit log has the full record.
    const beforeSnapshot = {
      user_id: user.user_id,
      name:    user.name,
      email:   user.email,
      role:    user.role,
      institution_name: user.institution_name,
    };
    const { error } = await supabase
      .from('clf_user_profiles')
      .delete()
      .eq('user_id', user.user_id);
    if (error) {
      alert('删除失败: ' + error.message);
      return;
    }
    writeAuditLog({
      targetUserId: user.user_id,
      action: 'user_delete',
      before: beforeSnapshot,
      after:  null,
    });
    load();
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
              onInstitutionClick={() => setInstUser(u)}
              onRoleChange={(newRole) => updateRole(u.user_id, newRole)}
              onResetPassword={() => resetPassword(u)}
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

      {/* Institution modal */}
      {instUser && (
        <InstitutionModal user={instUser}
          onClose={() => setInstUser(null)}
          onSave={(name, logo) => updateInstitution(instUser.user_id, name, logo)}/>
      )}

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

function UserCard({ user, onPermsClick, onInstitutionClick, onRoleChange, onResetPassword, onDelete }) {
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
        <button onClick={onInstitutionClick} style={{
          padding: '6px 10px', fontSize: 11,
          background: user.institution_name ? '#10b98115' : '#fef3e2',
          color: user.institution_name ? '#047857' : '#92400e',
          border: `1px solid ${user.institution_name ? '#10b98140' : '#f59e0b40'}`,
          borderRadius: 6, cursor: 'pointer', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }} title={user.institution_name || '未设置机构'}>
          {user.institution_logo_url
            ? <img src={user.institution_logo_url} alt="" style={{ width: 14, height: 14, borderRadius: 2, objectFit: 'cover' }}/>
            : '🏢'}
          {user.institution_name || '机构'}
        </button>
        <UserModulesButton user={user} style={{
          padding: '6px 10px', fontSize: 11,
          background: '#9333ea15', color: '#7e22ce',
          border: '1px solid #9333ea40', borderRadius: 6,
          cursor: 'pointer', fontWeight: 600,
        }}/>
        <button onClick={onResetPassword} title="重置密码" style={{
          padding: '6px 8px', fontSize: 11,
          background: '#fff7ed', color: '#9a3412',
          border: '1px solid #f59e0b40', borderRadius: 6,
          cursor: 'pointer', fontWeight: 600,
        }}>🔑</button>
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

function InstitutionModal({ user, onClose, onSave }) {
  const [name, setName] = useState(user.institution_name || '');
  const [logoUrl, setLogoUrl] = useState(user.institution_logo_url || '');
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('文件大小不能超过 2MB');
      return;
    }
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.user_id}/${Date.now()}.${fileExt}`;
      const { error: upErr } = await supabase.storage
        .from('institution-logos')
        .upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage
        .from('institution-logos')
        .getPublicUrl(filePath);
      setLogoUrl(publicUrl);
    } catch (err) {
      alert('上传失败: ' + err.message + '\n\n确认 institution-logos 存储桶已在 Supabase 中创建（公开，2MB 限制）');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 0,
        maxWidth: 500, width: '90%',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #e8d5b0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a0a05' }}>
              机构信息 · {user.name || user.email}
            </div>
            <div style={{ fontSize: 11, color: '#8b6f47', marginTop: 2 }}>
              该用户所属的学校或机构
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 6, color: '#8b6f47',
          }}>
            <X size={18}/>
          </button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Preview */}
          <div style={{
            background: 'linear-gradient(90deg, #c41e3a 0%, #8b0000 100%)',
            color: '#fff5e6', padding: 14, borderRadius: 10,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700,
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 3 }}>大卫学中文</div>
            {(name || logoUrl) && (
              <>
                <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.3)' }}/>
                {logoUrl && (
                  <img src={logoUrl} alt="" style={{
                    width: 28, height: 28, borderRadius: 4,
                    objectFit: 'cover', background: '#fff',
                  }} onError={e => { e.target.style.display = 'none'; }}/>
                )}
                <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>
                  {name || '(机构名称)'}
                </div>
              </>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#8b6f47', textAlign: 'center', marginTop: -4 }}>
            ↑ 顶部横幅预览
          </div>

          {/* Name input */}
          <div>
            <label style={{ fontSize: 11, color: '#8b6f47', display: 'block', marginBottom: 4 }}>
              机构名称
            </label>
            <input type="text" value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：佛罗伦萨中文学校"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 12px', fontSize: 13,
                border: '1px solid #e8d5b0', borderRadius: 6,
              }}/>
          </div>

          {/* Logo upload + URL paste */}
          <div>
            <label style={{ fontSize: 11, color: '#8b6f47', display: 'block', marginBottom: 4 }}>
              机构 Logo
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                placeholder="粘贴图片 URL 或上传 →"
                style={{
                  flex: 1, padding: '8px 12px', fontSize: 12,
                  border: '1px solid #e8d5b0', borderRadius: 6,
                }}/>
              <label style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                background: '#fff', color: '#5d4630',
                border: '1px solid #e8d5b0', borderRadius: 6,
                cursor: uploading ? 'wait' : 'pointer',
                whiteSpace: 'nowrap',
              }}>
                {uploading ? '上传中…' : '上传'}
                <input type="file" accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}/>
              </label>
            </div>
            <div style={{ fontSize: 10, color: '#a07850', marginTop: 4 }}>
              支持 PNG / JPG / SVG / WebP，最大 2MB
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button onClick={() => onSave(name, logoUrl)} style={{
              flex: 1, padding: '10px', fontSize: 13, fontWeight: 600,
              background: '#c41e3a', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer',
            }}>
              保存
            </button>
            <button onClick={() => onSave('', '')} style={{
              padding: '10px 16px', fontSize: 13,
              background: '#fff', color: '#991b1b',
              border: '1px solid #991b1b40', borderRadius: 8, cursor: 'pointer',
            }}>
              清除
            </button>
            <button onClick={onClose} style={{
              padding: '10px 16px', fontSize: 13,
              background: '#fff', color: '#5d4630',
              border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer',
            }}>
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [name, setName]         = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail]       = useState('');
  const [role, setRole]         = useState('student');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState(null);   // shown after success: { username, password, ... }

  const submit = async () => {
    setError('');
    if (!name.trim()) { setError('姓名必填'); return; }
    if (password && password.length < 8) {
      setError('密码至少 8 位');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/.netlify/functions/admin-create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          mode: 'single',
          name: name.trim(),
          username: username.trim() || undefined,
          password: password.trim() || undefined,    // server generates if blank
          email: email.trim() || undefined,
          role,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || `Create failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      setResult(data.result);
      writeAuditLog({
        targetUserId: data.result.user_id,
        action: 'user_create',
        before: null,
        after: { username: data.result.username, role, name: name.trim() },
      });
      onCreated?.(data.result);
    } catch (e) {
      setError(e?.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  // After successful creation, show credentials so admin can share out-of-band.
  if (result) {
    return (
      <div onClick={onClose} style={modalBackdrop}>
        <div onClick={e => e.stopPropagation()} style={{
          background: '#fff', borderRadius: 14, padding: 24,
          maxWidth: 460, width: '92%',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#166534' }}>✓ 用户已创建</div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: '#8b6f47' }}>
              <X size={18}/>
            </button>
          </div>
          <div style={{ background: '#fef3e2', border: '1px solid #f59e0b40', borderRadius: 10, padding: 12, fontSize: 12, color: '#92400e', marginBottom: 12 }}>
            请妥善保存以下凭证（密码仅显示一次）。建议通过线下渠道告知用户。
          </div>
          <CredentialRow label="姓名"     value={result.name}/>
          <CredentialRow label="用户名"   value={result.username} copyable/>
          <CredentialRow label="初始密码" value={result.password} copyable mono/>
          {result.qr_token && <CredentialRow label="QR token" value={result.qr_token} copyable mono/>}
          <button onClick={onClose} style={{ ...btnPrimary, width: '100%', marginTop: 12 }}>完成</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={modalBackdrop}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, padding: 24,
        maxWidth: 460, width: '92%',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a0a05' }}>新建用户</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, color: '#8b6f47' }}>
            <X size={18}/>
          </button>
        </div>

        <FormField label="姓名 *" hint="必填，可中文">
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} autoFocus/>
        </FormField>

        <FormField label="用户名" hint="留空则由系统自动生成。仅小写字母数字下划线。">
          <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} style={inputStyle} placeholder="自动"/>
        </FormField>

        <FormField label="角色">
          <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </FormField>

        <FormField label="初始密码" hint="留空则系统生成。至少 8 位。">
          <input value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace' }} placeholder="自动"/>
        </FormField>

        <FormField label="真实邮箱（可选）" hint="如需密码自助重置，需提供真实邮箱。">
          <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} type="email" placeholder="留空使用合成邮箱"/>
        </FormField>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 8, padding: 10, fontSize: 12, marginTop: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={submit} disabled={submitting} style={{ ...btnPrimary, flex: 1, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? '创建中…' : '创建'}
          </button>
          <button onClick={onClose} disabled={submitting} style={btnSecondary}>取消</button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#5d4630', marginBottom: 4 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 10, color: '#a07850', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function CredentialRow({ label, value, copyable, mono }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* ignore */ }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f5e6c8' }}>
      <div style={{ width: 80, fontSize: 11, color: '#5d4630', fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: '#1a0a05', fontFamily: mono ? 'ui-monospace, monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</div>
      {copyable && (
        <button onClick={copy} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11 }}>
          {copied ? '✓ 已复制' : '复制'}
        </button>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e8d5b0', borderRadius: 8,
  background: '#fff', color: '#1a0a05',
  boxSizing: 'border-box',
};

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
