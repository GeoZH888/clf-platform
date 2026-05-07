// src/admin/AIConfigTab.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../school/services/supabase';

const FEATURES = [
  { id: 'text',  label: '文字生成', desc: '课程备课、作业批改建议、教学问答' },
  { id: 'image', label: '图片生成', desc: '课程插图、字符插画' },
  { id: 'audio', label: '语音合成', desc: 'TTS 朗读、音频教学' },
];

export default function AIConfigTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clf_ai_provider_config')
      .select('*').order('feature').order('is_default', { ascending: false });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setDefault = async (row) => {
    await supabase.from('clf_ai_provider_config')
      .update({ is_default: false }).eq('feature', row.feature);
    await supabase.from('clf_ai_provider_config')
      .update({ is_default: true }).eq('id', row.id);
    load();
  };

  const toggle = async (row) => {
    await supabase.from('clf_ai_provider_config')
      .update({ enabled: !row.enabled }).eq('id', row.id);
    load();
  };

  if (loading) return <div style={{ padding: 24, color: '#a07850' }}>加载中…</div>;

  return (
    <div>
      <div style={{
        background: '#fff', padding: 16, borderRadius: 12,
        border: '1px solid #e8d5b0', marginBottom: 16, fontSize: 13, color: '#5d4630',
      }}>
        <strong>AI 服务商配置</strong> · 选择每个功能的默认 AI 提供商。
        每个用户可在个人资料中覆盖默认值。
      </div>

      {FEATURES.map(f => {
        const featureRows = rows.filter(r => r.feature === f.id);
        return (
          <section key={f.id} style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#1a0a05' }}>
              {f.label}
            </h3>
            <div style={{ fontSize: 12, color: '#a07850', marginBottom: 10 }}>{f.desc}</div>
            <div style={{ display: 'grid', gap: 8,
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {featureRows.map(row => (
                <div key={row.id} style={{
                  background: row.is_default ? '#fff5f0' : '#fff',
                  border: `1.5px solid ${row.is_default ? '#c41e3a' : '#e8d5b0'}`,
                  borderRadius: 10, padding: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <strong style={{ fontSize: 13, color: '#1a0a05' }}>{row.provider}</strong>
                    {row.is_default && (
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8,
                        background: '#c41e3a', color: '#fff', fontWeight: 700 }}>默认</span>
                    )}
                    <label style={{ marginLeft: 'auto', fontSize: 11,
                      display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="checkbox" checked={row.enabled}
                        onChange={() => toggle(row)}/> 启用
                    </label>
                  </div>
                  <div style={{ fontSize: 11, color: '#5d4630',
                    fontFamily: 'monospace', marginBottom: 8 }}>
                    {row.model || '(no model)'}
                  </div>
                  {!row.is_default && row.enabled && (
                    <button onClick={() => setDefault(row)} style={{
                      padding: '4px 10px', fontSize: 11,
                      background: '#c41e3a', color: '#fff', border: 'none',
                      borderRadius: 6, cursor: 'pointer',
                    }}>设为默认</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div style={{
        marginTop: 24, padding: 12,
        background: '#fef3e2', border: '1px solid #f59e0b40',
        borderRadius: 10, fontSize: 12, color: '#92400e',
      }}>
        <strong>注意：</strong> 这里只配置默认提供商。实际调用需要在 Netlify 环境变量中设置对应的 API Key
        （ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY 等）。
        如果某个提供商没设密钥，调用时会返回 401 错误。
      </div>
    </div>
  );
}
