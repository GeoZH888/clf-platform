// src/admin/components/AiFieldAssistant.jsx
//
// Drop-in AI bar for any admin edit form.
//
//   <AiFieldAssistant
//     values={form}                       // { meaning_en:'four', meaning_zh:'' , ... }
//     onPatch={patch => setForm(f => ({ ...f, ...patch }))}
//     context="Chinese character 四 (sì)"
//     generate={{ subject: form.glyph_modern, fields: [{ key:'meaning_en', label:'…' }] }}
//   />
//
// Translation needs no configuration: it detects *_zh / *_en / *_it groups in
// `values`, picks whichever language is most filled as the source, and fills
// the rest. Generation is opt-in — pass `generate` with the field spec.
import { useMemo, useState } from 'react';
import {
  LANGS, LANG_BY_CODE, detectLangGroups, langCoverage, bestSourceLang,
  translateFields, generateFields,
} from '../lib/aiFields.js';

const C = {
  border:'#e8d5b0', bg:'#fdf6e3', text2:'#6b4c2a', text3:'#a07850',
  vermillion:'#8B4513', ok:'#2E7D32', err:'#C62828',
};

const PROVIDERS = [
  { id:'claude',   label:'Claude' },
  { id:'deepseek', label:'DeepSeek' },
  { id:'openai',   label:'GPT-4o' },
  { id:'gemini',   label:'Gemini' },
];

export default function AiFieldAssistant({
  values = {},
  onPatch,
  context = '',
  generate = null,          // { subject, fields:[{key,label,hint}] } → enables ✨ 生成
  groups: groupsProp,       // override auto-detection if a table is unusual
  defaultProvider = 'claude',
  compact = false,
}) {
  const [provider,  setProvider]  = useState(defaultProvider);
  const [overwrite, setOverwrite] = useState(false);
  const [busy,      setBusy]      = useState(null);   // 'translate' | 'generate' | null
  const [status,    setStatus]    = useState('');
  const [srcLang,   setSrcLang]   = useState('auto');

  const groups   = useMemo(
    () => groupsProp || detectLangGroups(Object.keys(values)),
    [groupsProp, values]);
  const coverage = useMemo(() => langCoverage(values, groups), [values, groups]);
  const autoSrc  = useMemo(() => bestSourceLang(values, groups), [values, groups]);
  const source   = srcLang === 'auto' ? autoSrc : srcLang;

  const canTranslate = groups.length > 0 && !!source;

  async function runTranslate() {
    setBusy('translate'); setStatus('翻译中… Translating…');
    try {
      const patch = await translateFields({
        values, groups, sourceLang: source, overwrite, context, provider,
      });
      const n = Object.keys(patch).length;
      if (!n) {
        setStatus('没有需要填充的字段 · Nothing to fill (tick 覆盖 to redo existing).');
      } else {
        onPatch?.(patch);
        setStatus(`✓ 已填充 ${n} 个字段 · Filled ${n} field${n > 1 ? 's' : ''}`);
      }
    } catch (e) {
      setStatus(`✗ ${e.message}`);
    } finally {
      setBusy(null);
      setTimeout(() => setStatus(s => (s.startsWith('翻译中') ? '' : s)), 100);
    }
  }

  async function runGenerate() {
    setBusy('generate'); setStatus('生成中… Generating…');
    try {
      const patch = await generateFields({
        subject: generate.subject,
        fields:  generate.fields,
        values, overwrite,
        context: generate.context ?? context,
        provider,
      });
      const n = Object.keys(patch).length;
      if (!n) {
        setStatus('没有需要生成的字段 · Nothing to generate (tick 覆盖 to redo existing).');
      } else {
        onPatch?.(patch);
        setStatus(`✓ 已生成 ${n} 个字段 · Generated ${n} field${n > 1 ? 's' : ''}`);
      }
    } catch (e) {
      setStatus(`✗ ${e.message}`);
    } finally {
      setBusy(null);
    }
  }

  if (!groups.length && !generate) return null;

  return (
    <div style={{
      background:C.bg, border:`1px solid ${C.border}`, borderRadius:10,
      padding: compact ? '8px 10px' : '10px 12px', marginBottom:10,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, fontWeight:600, color:C.vermillion }}>
          🤖 AI 助手
        </span>

        {/* Per-language coverage */}
        {groups.length > 0 && (
          <div style={{ display:'flex', gap:4 }}>
            {LANGS.filter(l => coverage[l.code]?.total).map(l => {
              const { filled, total } = coverage[l.code];
              const full = filled === total;
              return (
                <span key={l.code}
                  title={`${l.label}: ${filled}/${total} 字段已填 · fields filled`}
                  style={{
                    fontSize:10, padding:'2px 7px', borderRadius:8,
                    background: full ? '#e8f5e9' : filled ? '#FFF3E0' : '#f5ede0',
                    color:      full ? C.ok      : filled ? '#E65100' : C.text3,
                    border: source === l.code ? `1px solid ${C.vermillion}` : '1px solid transparent',
                    fontWeight: source === l.code ? 600 : 400,
                  }}>
                  {l.label} {filled}/{total}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ flex:1 }}/>

        <select value={provider} onChange={e => setProvider(e.target.value)}
          title="AI 引擎 · Provider"
          style={{ fontSize:11, padding:'3px 6px', borderRadius:6,
            border:`1px solid ${C.border}`, background:'#fff', color:C.text2 }}>
          {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>

        <label title="重新生成已有内容 · Redo fields that already have text"
          style={{ fontSize:11, color:C.text3, display:'flex', alignItems:'center', gap:4, cursor:'pointer' }}>
          <input type="checkbox" checked={overwrite}
            onChange={e => setOverwrite(e.target.checked)} style={{ cursor:'pointer' }}/>
          覆盖
        </label>

        {generate && (
          <button type="button" onClick={runGenerate} disabled={!!busy}
            title="根据主词条生成所有空字段 · Generate every empty field"
            style={{ padding:'5px 12px', fontSize:11, fontWeight:600, borderRadius:8,
              border:`1px solid ${C.vermillion}`, cursor: busy ? 'default' : 'pointer',
              background:'#fff', color:C.vermillion, opacity: busy ? 0.5 : 1 }}>
            {busy === 'generate' ? '⏳ 生成中…' : '✨ AI 生成'}
          </button>
        )}

        <button type="button" onClick={runTranslate} disabled={!!busy || !canTranslate}
          title={canTranslate
            ? `以 ${LANG_BY_CODE[source]?.label} 为源，翻译到其它语言 · Translate from ${LANG_BY_CODE[source]?.name}`
            : '请先填写任意一种语言 · Fill any one language first'}
          style={{ padding:'5px 12px', fontSize:11, fontWeight:600, borderRadius:8, border:'none',
            cursor: busy || !canTranslate ? 'default' : 'pointer',
            background: busy || !canTranslate ? '#E0E0E0' : C.vermillion,
            color: busy || !canTranslate ? '#aaa' : '#fff' }}>
          {busy === 'translate' ? '⏳ 翻译中…' : '🌐 补全翻译'}
        </button>
      </div>

      {/* Source language override — only worth showing once something is filled */}
      {canTranslate && !compact && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
          <span style={{ fontSize:10, color:C.text3 }}>翻译源 · From:</span>
          <button type="button" onClick={() => setSrcLang('auto')}
            style={chip(srcLang === 'auto')}>
            自动{autoSrc ? ` (${LANG_BY_CODE[autoSrc]?.label})` : ''}
          </button>
          {LANGS.filter(l => coverage[l.code]?.filled).map(l => (
            <button key={l.code} type="button" onClick={() => setSrcLang(l.code)}
              style={chip(srcLang === l.code)}>
              {l.label}
            </button>
          ))}
        </div>
      )}

      {status && (
        <div style={{ fontSize:10, marginTop:6, lineHeight:1.5,
          color: status.startsWith('✓') ? C.ok : status.startsWith('✗') ? C.err : C.text3 }}>
          {status}
        </div>
      )}
    </div>
  );
}

const chip = (active) => ({
  fontSize:10, padding:'2px 8px', borderRadius:8, cursor:'pointer',
  border:`1px solid ${active ? C.vermillion : C.border}`,
  background: active ? C.vermillion : '#fff',
  color: active ? '#fff' : C.text2,
  fontWeight: active ? 600 : 400,
});
