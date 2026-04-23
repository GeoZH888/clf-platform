// src/admin/CreatedUsersListPanel.jsx
// Lists all admin-created accounts + their quick-login QR tokens.
// Supports: view invitation card, regenerate QR, reset password, delete user.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import InvitationCardModal from './InvitationCardModal.jsx';

const V = {
  bg: '#fdf6e3', card: '#fff', border: '#e8d5b0',
  text: '#1a0a05', text2: '#6b4c2a', text3: '#a07850',
  accent: '#8B4513', green: '#2E7D32', red: '#c62828',
};

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
const buildQrUrl = (token) => `${BASE_URL}/quick-login?t=${token}`;

export default function CreatedUsersListPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');   // all | active | expired | noqr
  const [search, setSearch] = useState('');
  const [showCard, setShowCard] = useState(null);
  const [regenUser, setRegenUser] = useState(null);
  const [flash, setFlash] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Get all admin-created registrations
    const { data: regs, error } = await supabase
      .from('jgw_registrations')
      .select('id, username, name, email, approved_user_id, created_at, reason')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) { console.warn('[created-users] load:', error); setLoading(false); return; }

    // Get tokens for those users
    const userIds = regs.filter(r => r.approved_user_id).map(r => r.approved_user_id);
    const { data: tokens } = userIds.length > 0 ? await supabase
      .from('clf_quicklogin_tokens')
      .select('*')
      .in('user_id', userIds) : { data: [] };
    const tokByUser = new Map();
    (tokens || []).forEach(t => tokByUser.set(t.user_id, t));

    setRows(regs.map(r => ({
      ...r,
      token: r.approved_user_id ? tokByUser.get(r.approved_user_id) : null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function callManage(body) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('未登录');
    const res = await fetch('/.netlify/functions/admin-manage-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function doReset(row) {
    if (!confirm(`重置 ${row.name} (${row.username}) 的密码？旧密码立即失效。`)) return;
    try {
      const { new_password } = await callManage({
        action: 'reset_password', user_id: row.approved_user_id,
      });
      setFlash({ type: 'success', msg: `新密码: ${new_password} (请复制并告知用户)`, persist: true });
    } catch (e) {
      setFlash({ type: 'error', msg: e.message });
    }
  }

  async function doDelete(row) {
    if (!confirm(`⚠ 永久删除账号 ${row.name} (${row.username})？\n此操作不可撤销！`)) return;
    try {
      await callManage({ action: 'delete_user', user_id: row.approved_user_id });
      setFlash({ type: 'success', msg: `已删除 ${row.name}` });
      load();
    } catch (e) {
      setFlash({ type: 'error', msg: e.message });
    }
  }

  async function doRevoke(row) {
    if (!confirm(`撤销 ${row.name} 的扫码邀请？此 QR 立即失效。账号密码登录仍可用。`)) return;
    try {
      await callManage({ action: 'revoke_qr', user_id: row.approved_user_id });
      setFlash({ type: 'success', msg: `已撤销 ${row.name} 的 QR 邀请` });
      load();
    } catch (e) {
      setFlash({ type: 'error', msg: e.message });
    }
  }

  async function doRegenerate(row, options) {
    try {
      await callManage({
        action: 'regenerate_qr',
        user_id: row.approved_user_id,
        ...options,
      });
      setFlash({ type: 'success', msg: `已为 ${row.name} 生成新 QR` });
      setRegenUser(null);
      load();
    } catch (e) {
      setFlash({ type: 'error', msg: e.message });
    }
  }

  // Filtering
  const filtered = rows.filter(r => {
    if (search) {
      const s = search.toLowerCase();
      if (!r.name.toLowerCase().includes(s)
        && !r.username.toLowerCase().includes(s)
        && !(r.token?.label || '').toLowerCase().includes(s)) return false;
    }
    if (filter === 'active') {
      if (!r.token) return false;
      if (r.token.expires_at && new Date(r.token.expires_at) < new Date()) return false;
      return true;
    }
    if (filter === 'expired') {
      return r.token?.expires_at && new Date(r.token.expires_at) < new Date();
    }
    if (filter === 'noqr') return !r.token;
    return true;
  });

  return (
    <div style={{
      background: V.card, border: `1px solid ${V.border}`,
      borderRadius: 12, padding: 16, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 4, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, color: V.accent, flex: 1 }}>
          📋 已创建账号 · {rows.length}
        </h3>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索姓名/用户名/标签"
          style={{ padding: '4px 10px', fontSize: 12,
            border: `1px solid ${V.border}`, borderRadius: 6,
            minWidth: 180 }}/>
        <button onClick={load} style={btnSecondary}>🔄</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, marginTop: 10 }}>
        {[
          ['all',     `全部 (${rows.length})`],
          ['active',  `有效 QR (${rows.filter(r => r.token && (!r.token.expires_at || new Date(r.token.expires_at) > new Date())).length})`],
          ['expired', `已过期 (${rows.filter(r => r.token?.expires_at && new Date(r.token.expires_at) < new Date()).length})`],
          ['noqr',    `无 QR (${rows.filter(r => !r.token).length})`],
        ].map(([id, lbl]) => (
          <FilterBtn key={id} active={filter === id} onClick={() => setFilter(id)}>
            {lbl}
          </FilterBtn>
        ))}
      </div>

      {flash && (
        <div style={{
          padding: 10, marginBottom: 10, fontSize: 12, borderRadius: 6,
          background: flash.type === 'success' ? '#E8F5E9' : '#FFEBEE',
          color:      flash.type === 'success' ? V.green : V.red,
          border: `1px solid ${flash.type === 'success' ? '#A5D6A7' : '#FFCDD2'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{flash.type === 'success' ? '✓' : '⚠'} {flash.msg}</span>
          <button onClick={() => setFlash(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: 'inherit' }}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: V.text3 }}>加载中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: V.text3,
          background: V.bg, borderRadius: 8, border: `1px dashed ${V.border}` }}>
          {rows.length === 0 ? '还没有创建任何账号' : '没有匹配的结果'}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
          {filtered.map(row => <UserRow key={row.id} row={row}
            onShowCard={() => setShowCard(row)}
            onRegen={() => setRegenUser(row)}
            onReset={() => doReset(row)}
            onRevoke={() => doRevoke(row)}
            onDelete={() => doDelete(row)}/>)}
        </div>
      )}

      {/* Invitation card modal (re-usable) */}
      {showCard && showCard.token && (
        <InvitationCardModal
          result={{
            name: showCard.name,
            username: showCard.username,
            password: '（已设置，不可再次查看）',
            qr_token: showCard.token.token,
          }}
          hidePassword
          onClose={() => setShowCard(null)}/>
      )}

      {/* Regenerate modal */}
      {regenUser && (
        <RegenerateModal user={regenUser}
          onClose={() => setRegenUser(null)}
          onSubmit={(opts) => doRegenerate(regenUser, opts)}/>
      )}
    </div>
  );
}

// ── User row ───────────────────────────────────────────────────
function UserRow({ row, onShowCard, onRegen, onReset, onRevoke, onDelete }) {
  const t = row.token;
  const isExpired = t?.expires_at && new Date(t.expires_at) < new Date();
  const daysLeft = t?.expires_at
    ? Math.ceil((new Date(t.expires_at) - Date.now()) / 864e5)
    : null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.3fr 1.3fr 0.9fr 1.1fr 1fr auto',
      gap: 8, alignItems: 'center', padding: '8px 10px',
      background: isExpired ? '#fafafa' : V.card,
      border: `1px solid ${V.border}`, borderRadius: 6,
      fontSize: 12, opacity: isExpired ? 0.75 : 1,
    }}>
      <div style={{ color: V.text2, fontWeight: 500 }}>{row.name}</div>
      <code style={{ color: V.accent, fontSize: 11 }}>{row.username}</code>
      <div style={{ fontSize: 10, color: V.text3 }}>
        {t ? `${t.device_count}/${t.max_devices} 台` : '无 QR'}
      </div>
      <div style={{ fontSize: 10 }}>
        {!t ? <span style={{ color: V.text3 }}>—</span>
          : !t.expires_at ? <span style={{ color: V.green }}>永久</span>
          : isExpired ? <span style={{ color: V.red }}>⏱ 已过期</span>
          : daysLeft <= 7 ? <span style={{ color: '#E65100' }}>{daysLeft}天后过期</span>
          : <span style={{ color: V.text3 }}>{daysLeft}天后过期</span>}
      </div>
      <div style={{ fontSize: 10, color: V.text3, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {t?.label || ''}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {t && !isExpired && (
          <IconBtn title="查看邀请函" onClick={onShowCard}>📱</IconBtn>
        )}
        <IconBtn title={t ? '重新生成 QR' : '生成 QR'} onClick={onRegen}>
          {t ? '🔄' : '➕'}
        </IconBtn>
        <IconBtn title="重置密码" onClick={onReset}>🔑</IconBtn>
        {t && <IconBtn title="撤销 QR" onClick={onRevoke}>🚫</IconBtn>}
        <IconBtn title="删除账号" danger onClick={onDelete}>🗑</IconBtn>
      </div>
    </div>
  );
}

// ── Regenerate modal ───────────────────────────────────────────
function RegenerateModal({ user, onClose, onSubmit }) {
  const [maxDevices, setMaxDevices] = useState(user.token?.max_devices || 2);
  const [expiryDays, setExpiryDays] = useState(30);
  const [label, setLabel] = useState(user.token?.label || '');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    await onSubmit({
      max_devices: maxDevices,
      expires_at: expiryDays > 0
        ? new Date(Date.now() + expiryDays * 864e5).toISOString()
        : null,
      label: label || null,
    });
    setSubmitting(false);
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 9999, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 20 }}>
      <div style={{ background: V.card, borderRadius: 12, padding: 20,
        maxWidth: 400, width: '100%' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, color: V.accent }}>
          {user.token ? '🔄 重新生成' : '➕ 生成'} QR · {user.name}
        </h3>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>最多可登录设备数</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 5, 10].map(n => (
              <PillBtn key={n} active={maxDevices===n} onClick={() => setMaxDevices(n)}>{n}</PillBtn>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>有效期</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[7, 30, 90, 365, 0].map(d => (
              <PillBtn key={d} active={expiryDays===d} onClick={() => setExpiryDays(d)}>
                {d === 0 ? '永不过期' : `${d} 天`}
              </PillBtn>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: V.text3, marginBottom: 4 }}>标签（可选）</div>
          <input value={label} onChange={e => setLabel(e.target.value)}
            placeholder="如: 2026春季班"
            style={{ width: '100%', padding: '6px 10px', fontSize: 12,
              border: `1px solid ${V.border}`, borderRadius: 6,
              boxSizing: 'border-box' }}/>
        </div>

        {user.token && (
          <div style={{ fontSize: 11, color: '#E65100', marginBottom: 12,
            padding: 8, background: '#FFF8E1', borderRadius: 4 }}>
            ⚠ 旧 QR 码将失效，需要重新分发新的给用户
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>取消</button>
          <button onClick={submit} disabled={submitting} style={{
            ...btnPrimary, opacity: submitting ? 0.5 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? '处理中…' : (user.token ? '重新生成' : '生成')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Atoms ───────────────────────────────────────────────────────
function FilterBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', fontSize: 11,
      background: active ? V.accent : 'transparent',
      color: active ? '#fff' : V.text2,
      border: `1px solid ${active ? V.accent : V.border}`,
      borderRadius: 4, cursor: 'pointer',
    }}>{children}</button>
  );
}

function IconBtn({ title, onClick, children, danger }) {
  return (
    <button title={title} onClick={onClick} style={{
      padding: '3px 7px', fontSize: 13,
      background: danger ? '#FFEBEE' : V.bg,
      border: `1px solid ${danger ? '#FFCDD2' : V.border}`,
      borderRadius: 4, cursor: 'pointer',
      color: danger ? V.red : V.text,
    }}>{children}</button>
  );
}

function PillBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', fontSize: 12,
      border: `1px solid ${active ? V.accent : V.border}`,
      background: active ? '#FFF8F0' : V.card,
      color: active ? V.accent : V.text, borderRadius: 5,
      cursor: 'pointer', fontWeight: active ? 500 : 400,
    }}>{children}</button>
  );
}

const btnPrimary = { padding: '6px 14px', background: V.accent, color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 };
const btnSecondary = { padding: '6px 10px', background: V.card, color: V.accent,
  border: `1px solid ${V.accent}`, borderRadius: 6, cursor: 'pointer', fontSize: 12 };
