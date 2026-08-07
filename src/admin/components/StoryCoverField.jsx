// src/admin/components/StoryCoverField.jsx
//
// The 封面图 field, with AI generation attached.
//
// Used by both the create modal and the story info editor, so a cover can be
// made before the story row exists — nothing here needs a story id, only the
// titles that steer the prompt.

import { useState } from 'react';
import { COVER_STYLES, IMAGE_PROVIDERS, generateCover } from '../lib/storyImage.js';

const C = {
  border: '#e8d5b0', bg: '#fdf6e3', text2: '#6b4c2a', text3: '#a07850',
  vermillion: '#8B4513', ok: '#2E7D32', err: '#C62828', warn: '#E65100',
};

export default function StoryCoverField({ value, onChange, titles = {}, slug }) {
  const [style,    setStyle]    = useState(COVER_STYLES[0].id);
  const [provider, setProvider] = useState(IMAGE_PROVIDERS[0].id);
  const [busy,     setBusy]     = useState(false);
  const [status,   setStatus]   = useState('');

  const canGenerate = !!(titles.title_zh || titles.title_en || titles.summary_zh || titles.summary_en);

  async function run() {
    setBusy(true);
    setStatus('生成中… 约 10-20 秒 · Generating…');
    try {
      const { url, stored } = await generateCover({ slug, style, provider, titles });
      onChange(url);
      setStatus(stored
        ? '✓ 已生成并保存 · Generated and stored'
        : '⚠ 已生成,但未能存入图库 — 该链接会在约一小时后失效,请先保存并尽快替换');
    } catch (e) {
      setStatus(`✗ ${e.message}`);
    }
    setBusy(false);
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: C.text3, marginBottom: 3 }}>
        封面图 · Cover
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 8, flexShrink: 0,
          background: value ? `url(${value}) center/cover` : '#fff',
          border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!value && <span style={{ fontSize: 26 }}>📖</span>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <input value={value || ''} onChange={e => onChange(e.target.value)}
            placeholder="https://…  留空则显示 📖 占位图"
            style={{ width: '100%', padding: 7, fontSize: 12, borderRadius: 6,
              border: `1px solid ${C.border}`, marginBottom: 6 }} />

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={style} onChange={e => setStyle(e.target.value)}
              title="画风 · Style"
              style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6,
                border: `1px solid ${C.border}`, background: '#fff', color: C.text2 }}>
              {COVER_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>

            <select value={provider} onChange={e => setProvider(e.target.value)}
              title="绘图引擎 · Image provider"
              style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6,
                border: `1px solid ${C.border}`, background: '#fff', color: C.text2 }}>
              {IMAGE_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>

            <div style={{ flex: 1 }} />

            {value && !busy && (
              <button type="button" onClick={() => { onChange(''); setStatus(''); }}
                title="清除封面 · Clear"
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${C.border}`, background: '#fff', color: C.text3 }}>
                清除
              </button>
            )}

            <button type="button" onClick={run} disabled={busy || !canGenerate}
              title={canGenerate
                ? '根据标题和摘要生成封面 · Generate from the title and summary'
                : '请先填写标题或摘要 · Fill a title or summary first'}
              style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                border: 'none', background: C.vermillion, color: '#fdf6e3',
                cursor: busy || !canGenerate ? 'default' : 'pointer',
                opacity: busy || !canGenerate ? 0.5 : 1 }}>
              {busy ? '⏳ 生成中…' : value ? '🎨 重新生成' : '🎨 AI 生成封面'}
            </button>
          </div>
        </div>
      </div>

      {status && (
        <div style={{ fontSize: 10, marginTop: 6, lineHeight: 1.5,
          color: status.startsWith('✓') ? C.ok
               : status.startsWith('⚠') ? C.warn
               : status.startsWith('✗') ? C.err : C.text3 }}>
          {status}
        </div>
      )}
    </div>
  );
}
