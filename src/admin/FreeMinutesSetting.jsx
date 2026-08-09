// src/admin/FreeMinutesSetting.jsx
//
// The one number that decides how long an unpaid visitor may learn each day.
// Stored in clf_app_settings so changing it needs no deploy; RLS restricts the
// write to super_admin, so this panel is safe to render anywhere in /admin.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const V = {
  bg: '#fdf6e3', card: '#fff', border: '#e8d5b0',
  text: '#1a0a05', text2: '#6b4c2a', text3: '#a07850', vermillion: '#8B4513',
};

const KEY = 'free_minutes_per_day';

export default function FreeMinutesSetting() {
  const [value,   setValue]   = useState('');
  const [saved,   setSaved]   = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('clf_app_settings').select('value').eq('key', KEY).maybeSingle();
    if (error) setMsg(`✗ ${error.message}`);
    const v = data?.value != null ? String(data.value) : '4';
    setValue(v);
    setSaved(v);
    setLoading(false);
  }

  async function save() {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return setMsg('✗ 请输入 0 或更大的数字');
    setSaving(true);
    setMsg('');
    // upsert, so this still works if the migration row was never seeded.
    const { error } = await supabase.from('clf_app_settings').upsert({
      key: KEY,
      value: n,
      description: 'Minutes of learning an unpaid visitor gets per day.',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    setSaving(false);
    if (error) return setMsg(`✗ ${error.message}`);
    setSaved(String(n));
    setMsg('✓ 已保存 · Saved');
  }

  const dirty = value !== saved;

  return (
    <div style={{
      background: V.card, border: `1px solid ${V.border}`,
      borderRadius: 12, padding: 16, maxWidth: 520,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: V.vermillion, marginBottom: 4 }}>
        ⏳ 免费体验时长 · Free trial length
      </div>
      <div style={{ fontSize: 12, color: V.text3, lineHeight: 1.6, marginBottom: 12 }}>
        未付费访客每天可以学习的分钟数。付费账号不受限制。
        <br/>
        Minutes an unpaid visitor may learn per day. Paid accounts are never limited.
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: V.text3 }}>加载中…</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" min={0} step={1}
              value={value}
              onChange={e => { setValue(e.target.value); setMsg(''); }}
              style={{
                width: 90, padding: '8px 10px', fontSize: 15, borderRadius: 8,
                border: `1px solid ${V.border}`, textAlign: 'center',
              }}
            />
            <span style={{ fontSize: 13, color: V.text2 }}>分钟 / 天 · min per day</span>
            <div style={{ flex: 1 }} />
            <button onClick={save} disabled={!dirty || saving}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: 'none', background: V.vermillion, color: '#fdf6e3',
                cursor: !dirty || saving ? 'default' : 'pointer',
                opacity: !dirty || saving ? 0.5 : 1,
              }}>
              {saving ? '保存中…' : '保存'}
            </button>
          </div>

          <div style={{ fontSize: 11, color: V.text3, marginTop: 10, lineHeight: 1.6 }}>
            设为 <strong>0</strong> 表示不限制 — 所有人都可以无限使用。
            <br/>
            计时按设备记录,清除浏览器数据即可重置:这是引导付费的提示,不是硬性封锁。
          </div>

          {msg && (
            <div style={{
              fontSize: 12, marginTop: 10,
              color: msg.startsWith('✓') ? '#2E7D32' : '#C62828',
            }}>{msg}</div>
          )}
        </>
      )}
    </div>
  );
}
