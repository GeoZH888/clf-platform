// src/admin/UserModulesButton.jsx
//
// Drop-in icon button for the user list row.
// Click → opens a modal with module checkboxes for that user.
//
// Usage in CreatedUsersListPanel.jsx:
//
//   import UserModulesButton from './UserModulesButton';
//   ...
//   <UserModulesButton user={user} />
//
// Place it inline with your existing row buttons (📲 🔄 🔑 🚫 🗑).

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MODULES, STANDARD_BUNDLE, MODULE_BY_ID } from '../config/modules';

// ─────────────────────────────────────────────────────────────────────────────
// Public component — the row button
// ─────────────────────────────────────────────────────────────────────────────
export default function UserModulesButton({ user, style }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(null);

  // Lightweight count: how many gateable modules are enabled for this user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('clf_user_modules')
        .select('module_id, enabled')
        .eq('user_id', user.id);
      if (cancelled) return;
      // Compute effective count
      const flags = {};
      (data || []).forEach(r => { flags[r.module_id] = r.enabled; });
      const enabled = MODULES.filter(m => {
        if (!m.gateable) return false;
        if (m.id in flags) return flags[m.id];
        return m.defaultEnabled;
      }).length;
      setCount(enabled);
    })();
    return () => { cancelled = true; };
  }, [user?.id, open]);

  const totalGateable = MODULES.filter(m => m.gateable).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '4px 8px',
          background: '#FFF8E1',
          border: '1px solid #FFD54F',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 13,
          ...style,
        }}
        title={`模块权限${count !== null ? `: ${count}/${totalGateable} 开启` : ''}`}
      >
        🔐{count !== null && <span style={{ fontSize: 10, marginLeft: 2, color: '#666' }}>{count}</span>}
      </button>

      {open && (
        <UserModulesModal
          user={user}
          onClose={() => setOpen(false)}
          onSaved={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The modal
// ─────────────────────────────────────────────────────────────────────────────
function UserModulesModal({ user, onClose, onSaved }) {
  const [flags, setFlags]       = useState({});  // { module_id: enabled }
  const [original, setOriginal] = useState({});  // for change detection
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);

  // Load current state
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('clf_user_modules')
        .select('module_id, enabled')
        .eq('user_id', user.id);
      if (error) {
        setMsg({ kind: 'error', text: `加载失败: ${error.message}` });
      } else {
        const map = {};
        (data || []).forEach(r => { map[r.module_id] = r.enabled; });
        setFlags(map);
        setOriginal(map);
      }
      setLoading(false);
    })();
  }, [user.id]);

  // Effective state for a module given current draft flags
  function isEffective(modId) {
    const m = MODULE_BY_ID[modId];
    if (!m) return false;
    if (!m.gateable) return true;
    if (modId in flags) return flags[modId];
    return m.defaultEnabled;
  }

  function toggle(modId, value) {
    if (value === null) {
      // Remove explicit flag → revert to default
      const next = { ...flags };
      delete next[modId];
      setFlags(next);
    } else {
      setFlags({ ...flags, [modId]: value });
    }
  }

  function applyStandardBundle() {
    const next = {};
    for (const m of MODULES) {
      if (!m.gateable) continue;
      next[m.id] = STANDARD_BUNDLE.includes(m.id);
    }
    setFlags(next);
  }

  function enableAll() {
    const next = {};
    for (const m of MODULES) {
      if (m.gateable) next[m.id] = true;
    }
    setFlags(next);
  }

  function disableAll() {
    const next = {};
    for (const m of MODULES) {
      if (m.gateable) next[m.id] = false;
    }
    setFlags(next);
  }

  function resetAllToDefault() {
    setFlags({});
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      // Compute diff
      const upserts = [];
      const deletes = [];
      const allKeys = new Set([...Object.keys(flags), ...Object.keys(original)]);
      for (const modId of allKeys) {
        const inDraft  = modId in flags;
        const inOrig   = modId in original;
        if (inDraft && (!inOrig || flags[modId] !== original[modId])) {
          upserts.push({ user_id: user.id, module_id: modId, enabled: flags[modId] });
        } else if (!inDraft && inOrig) {
          deletes.push(modId);
        }
      }

      if (upserts.length) {
        const { error } = await supabase.from('clf_user_modules')
          .upsert(upserts, { onConflict: 'user_id,module_id' });
        if (error) throw error;
      }
      if (deletes.length) {
        const { error } = await supabase.from('clf_user_modules')
          .delete()
          .eq('user_id', user.id)
          .in('module_id', deletes);
        if (error) throw error;
      }

      setMsg({ kind: 'success', text: `已保存 (${upserts.length} 修改, ${deletes.length} 重置)` });
      setOriginal({ ...flags });
      setTimeout(() => onSaved?.(), 800);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message || String(err) });
    } finally {
      setSaving(false);
    }
  }

  // Group modules by category for display
  const grouped = MODULES.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  const categoryLabels = {
    core:     '🏠 核心 (始终开启)',
    learning: '📚 学习',
    practice: '✍️ 练习',
    cultural: '🏮 文化',
    admin:    '⚙️ 管理',
  };

  const dirty = JSON.stringify(flags) !== JSON.stringify(original);

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>🔐 模块权限</h3>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {user.name || user.display_name || user.username || user.id?.slice(0,8)}
              {user.username && user.username !== user.name && (
                <span> · {user.username}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn} aria-label="关闭">✕</button>
        </div>

        {loading ? (
          <div style={S.empty}>加载中...</div>
        ) : (
          <>
            <div style={S.toolbar}>
              <button onClick={applyStandardBundle} style={S.btnPreset}>
                📦 应用标准套餐
              </button>
              <button onClick={enableAll}  style={S.btnPresetGreen}>✓ 全部开启</button>
              <button onClick={disableAll} style={S.btnPresetGray}>✗ 全部关闭</button>
              <button onClick={resetAllToDefault} style={S.btnTextSmall} title="清除所有设置，恢复默认">
                ↺ 全部恢复默认
              </button>
            </div>

            {msg && (
              <div style={msg.kind === 'error' ? S.statusError : S.statusSuccess}>
                {msg.text}
              </div>
            )}

            <div style={S.modulesArea}>
              {Object.entries(grouped).map(([cat, mods]) => (
                <div key={cat} style={S.categoryBlock}>
                  <div style={S.categoryHeader}>{categoryLabels[cat] || cat}</div>
                  <div style={S.modulesGrid}>
                    {mods.map(m => {
                      const effective  = isEffective(m.id);
                      const explicit   = m.id in flags;
                      const isAlwaysOn = !m.gateable;
                      return (
                        <div key={m.id} style={effective ? S.modOn : S.modOff}>
                          <div style={S.modHead}>
                            <span style={{ fontSize: 18 }}>{m.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
                              <div style={{ fontSize: 10, color: '#888' }}>
                                {isAlwaysOn ? '始终可用' : (
                                  explicit
                                    ? <span style={{ color: '#FF8F00' }}>✏️ 自定义</span>
                                    : <span>默认 {m.defaultEnabled ? '开启' : '关闭'}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {!isAlwaysOn && (
                            <div style={S.modActions}>
                              <button
                                onClick={() => toggle(m.id, true)}
                                style={flags[m.id] === true ? S.btnTinyOnA : S.btnTinyOn}
                              >✓</button>
                              <button
                                onClick={() => toggle(m.id, false)}
                                style={flags[m.id] === false ? S.btnTinyOffA : S.btnTinyOff}
                              >✗</button>
                              {explicit && (
                                <button
                                  onClick={() => toggle(m.id, null)}
                                  style={S.btnTinyReset}
                                  title="清除自定义，恢复默认"
                                >↺</button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={S.footer}>
              <div style={{ fontSize: 11, color: '#888', flex: 1 }}>
                {dirty
                  ? <span style={{ color: '#E65100' }}>⚠ 有未保存的更改</span>
                  : '所有更改已保存'}
              </div>
              <button onClick={onClose} style={S.btnSecondary}>取消</button>
              <button
                onClick={save}
                disabled={!dirty || saving}
                style={(!dirty || saving) ? S.btnPrimaryDisabled : S.btnPrimary}
              >
                {saving ? '⏳ 保存中...' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  backdrop:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 },
  modal:     { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', borderBottom: '1px solid #eee' },
  closeBtn:  { background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', padding: 4 },
  toolbar:   { display: 'flex', gap: 6, padding: '12px 20px', background: '#FAFAFA', borderBottom: '1px solid #eee', flexWrap: 'wrap' },
  modulesArea: { flex: 1, overflowY: 'auto', padding: '12px 20px' },
  categoryBlock: { marginBottom: 16 },
  categoryHeader: { fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  modulesGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 },
  modOn:     { padding: 10, border: '2px solid #4CAF50', borderRadius: 6, background: '#F1F8E9' },
  modOff:    { padding: 10, border: '2px solid #ddd',    borderRadius: 6, background: '#FAFAFA', opacity: 0.7 },
  modHead:   { display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  modActions:{ display: 'flex', gap: 4 },
  empty:     { padding: 40, textAlign: 'center', color: '#999' },
  footer:    { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid #eee', background: '#FAFAFA' },

  btnPreset:      { padding: '6px 12px', background: '#FFF8E1', color: '#5D4037', border: '1px solid #FFD54F', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 },
  btnPresetGreen: { padding: '6px 10px', background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  btnPresetGray:  { padding: '6px 10px', background: '#F5F5F5', color: '#666',    border: '1px solid #ccc',    borderRadius: 6, cursor: 'pointer', fontSize: 12 },
  btnTextSmall:   { padding: '6px 10px', background: 'transparent', color: '#999', border: 'none', cursor: 'pointer', fontSize: 11 },
  btnPrimary:     { padding: '8px 16px', background: '#5D4037', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnPrimaryDisabled: { padding: '8px 16px', background: '#bbb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'not-allowed', fontSize: 13 },
  btnSecondary:   { padding: '8px 16px', background: '#fff', color: '#666', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 13 },

  btnTinyOn:    { padding: '3px 8px', background: '#fff', color: '#2E7D32', border: '1px solid #C8E6C9', borderRadius: 3, cursor: 'pointer', fontSize: 11 },
  btnTinyOnA:   { padding: '3px 8px', background: '#4CAF50', color: '#fff', border: '1px solid #4CAF50', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontWeight: 600 },
  btnTinyOff:   { padding: '3px 8px', background: '#fff', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: 3, cursor: 'pointer', fontSize: 11 },
  btnTinyOffA:  { padding: '3px 8px', background: '#F44336', color: '#fff', border: '1px solid #F44336', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontWeight: 600 },
  btnTinyReset: { padding: '3px 8px', background: '#FFF8E1', color: '#5D4037', border: '1px solid #FFD54F', borderRadius: 3, cursor: 'pointer', fontSize: 11 },

  statusSuccess: { padding: 8, margin: '0 20px 8px', background: '#D4EDDA', color: '#155724', borderRadius: 4, fontSize: 12 },
  statusError:   { padding: 8, margin: '0 20px 8px', background: '#F8D7DA', color: '#721C24', borderRadius: 4, fontSize: 12 },
};
