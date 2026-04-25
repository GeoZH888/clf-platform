// src/admin/PromptTemplatesTab.jsx
// ═══════════════════════════════════════════════════════════════════════════
// SuperAdmin: Prompt Templates editor
// Lists all rows in clf_prompt_templates. Each one expands to:
//   - textarea (template body)
//   - variables panel (click chip to insert at cursor)
//   - preview button (substitute example values, render preview)
//   - save / 恢复默认 buttons
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { DEFAULTS } from '../lib/prompts.js';

export default function PromptTemplatesTab({ currentUser }) {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(null);   // key
  const [drafts,    setDrafts]    = useState({});      // key -> edited body
  const [saving,    setSaving]    = useState({});
  const [previews,  setPreviews]  = useState({});      // key -> preview text
  const [toast,     setToast]     = useState(null);    // { key, msg, kind }
  const textareaRefs = useRef({});

  const V = {
    bg:'#fdf6e3', border:'#e8d5b0', verm:'#8B4513',
    text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  };

  // ── Load all templates ──────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('clf_prompt_templates').select('*').order('key')
      .then(({ data, error }) => {
        if (error) {
          setToast({ key: '_', msg: '加载失败: ' + error.message, kind: 'err' });
        }
        setTemplates(data ?? []);
        setLoading(false);
      });
  }, []);

  function flash(key, msg, kind = 'ok') {
    setToast({ key, msg, kind });
    setTimeout(() => setToast(t => (t && t.key === key && t.msg === msg) ? null : t), 3000);
  }

  function setDraft(key, val) {
    setDrafts(d => ({ ...d, [key]: val }));
  }

  function currentBody(t) {
    return drafts[t.key] !== undefined ? drafts[t.key] : t.template;
  }

  function isDirty(t) {
    return drafts[t.key] !== undefined && drafts[t.key] !== t.template;
  }

  // ── Click {var} chip -> insert at cursor ────────────────────────────────
  function insertVar(t, varName) {
    const ta = textareaRefs.current[t.key];
    const body = currentBody(t);
    if (!ta) {
      setDraft(t.key, body + `{${varName}}`);
      return;
    }
    const start = ta.selectionStart ?? body.length;
    const end   = ta.selectionEnd   ?? body.length;
    const next  = body.slice(0, start) + `{${varName}}` + body.slice(end);
    setDraft(t.key, next);
    // Restore cursor after react re-render
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + varName.length + 2;
      ta.setSelectionRange(pos, pos);
    });
  }

  // ── Build preview by substituting example values ────────────────────────
  function buildPreview(t) {
    let out = currentBody(t);
    for (const [k, meta] of Object.entries(t.variables || {})) {
      out = out.replaceAll(`{${k}}`, String(meta?.example ?? `<${k}>`));
    }
    setPreviews(p => ({ ...p, [t.key]: out }));
  }

  function clearPreview(key) {
    setPreviews(p => { const { [key]: _, ...rest } = p; return rest; });
  }

  // ── Save ────────────────────────────────────────────────────────────────
  async function save(t) {
    if (!isDirty(t)) { flash(t.key, '没有改动', 'info'); return; }
    setSaving(s => ({ ...s, [t.key]: true }));
    const body = drafts[t.key];
    const { data, error } = await supabase
      .from('clf_prompt_templates')
      .update({ template: body, updated_by: currentUser?.email || null })
      .eq('key', t.key)
      .select()
      .maybeSingle();
    setSaving(s => ({ ...s, [t.key]: false }));
    if (error) {
      flash(t.key, '保存失败: ' + error.message, 'err');
      return;
    }
    setTemplates(prev => prev.map(p => p.key === data.key ? data : p));
    setDrafts(d => { const { [t.key]: _, ...rest } = d; return rest; });
    flash(t.key, '✓ 已保存');
  }

  // ── Restore default from code ───────────────────────────────────────────
  function restoreDefault(t) {
    const def = DEFAULTS[t.key];
    if (!def) {
      flash(t.key, `代码 DEFAULTS 里没有 "${t.key}"`, 'err');
      return;
    }
    if (!confirm(`将 "${t.name}" 的草稿重置为代码里的默认值？\n（点击保存才会写入数据库）`)) return;
    setDraft(t.key, def);
    flash(t.key, '已恢复为默认（未保存）', 'info');
  }

  // ── Styles ──────────────────────────────────────────────────────────────
  const card = {
    background:'#fff', border:`1px solid ${V.border}`, borderRadius:12,
    marginBottom:12, overflow:'hidden',
  };
  const head = (open) => ({
    padding:'12px 16px', cursor:'pointer', userSelect:'none',
    display:'flex', justifyContent:'space-between', alignItems:'center',
    background: open ? '#f5ede0' : '#fff',
    borderBottom: open ? `1px solid ${V.border}` : 'none',
  });
  const btn = (kind = 'default') => ({
    padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:600,
    border:`1px solid ${V.border}`, cursor:'pointer',
    background: kind === 'primary' ? V.verm : '#fff',
    color: kind === 'primary' ? '#fff' : V.text2,
  });
  const chip = {
    display:'inline-block', padding:'4px 10px', margin:'3px 4px 3px 0',
    fontSize:11, fontFamily:'monospace', borderRadius:6,
    background:'#f5ede0', color:V.verm, border:`1px solid ${V.border}`,
    cursor:'pointer', userSelect:'none',
  };

  if (loading) {
    return <div style={{ padding:24, color:V.text3 }}>加载中…</div>;
  }

  return (
    <div style={{ padding:'4px 0' }}>
      <div style={{ marginBottom:16, color:V.text2, fontSize:13, lineHeight:1.6 }}>
        编辑 AI prompt 模板。变量用 <code style={{ background:'#f5ede0', padding:'1px 6px', borderRadius:4 }}>{'{name}'}</code> 占位。
        保存后实时生效（无需 deploy）。「恢复默认」从代码里的 <code>DEFAULTS</code> 重置草稿。
      </div>

      {templates.length === 0 && (
        <div style={{ padding:20, textAlign:'center', color:V.text3, fontSize:13 }}>
          还没有任何模板。先跑 <code>clf_prompt_templates_setup.sql</code>。
        </div>
      )}

      {templates.map(t => {
        const open = expanded === t.key;
        const dirty = isDirty(t);
        const vars = t.variables || {};
        return (
          <div key={t.key} style={card}>
            {/* Header */}
            <div style={head(open)} onClick={() => setExpanded(open ? null : t.key)}>
              <div>
                <div style={{ fontWeight:700, color:V.verm, fontSize:14 }}>
                  {t.name} {dirty && <span style={{ color:'#d97706', fontSize:11 }}>● 未保存</span>}
                </div>
                <div style={{ fontSize:11, color:V.text3, marginTop:2 }}>
                  <code>{t.key}</code> · {t.description || '—'}
                  {t.updated_at && <> · 更新于 {new Date(t.updated_at).toLocaleString('zh-CN')}</>}
                  {t.updated_by && <> by {t.updated_by}</>}
                </div>
              </div>
              <div style={{ fontSize:18, color:V.text3 }}>{open ? '▾' : '▸'}</div>
            </div>

            {/* Body */}
            {open && (
              <div style={{ padding:'14px 16px' }}>

                {/* Variables panel */}
                {Object.keys(vars).length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, color:V.verm, fontWeight:600, marginBottom:6 }}>
                      可用变量（点击插入到光标位置）
                    </div>
                    <div>
                      {Object.entries(vars).map(([name, meta]) => (
                        <span key={name} style={chip} onClick={() => insertVar(t, name)}
                          title={`${meta?.desc || ''}\n示例: ${meta?.example ?? ''}`}>
                          {`{${name}}`} <span style={{ color:V.text3, fontWeight:400 }}>
                            {meta?.type || ''}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Editor */}
                <textarea
                  ref={el => { textareaRefs.current[t.key] = el; }}
                  value={currentBody(t)}
                  onChange={e => setDraft(t.key, e.target.value)}
                  spellCheck={false}
                  style={{
                    width:'100%', minHeight:260, boxSizing:'border-box',
                    padding:'12px 14px', borderRadius:8,
                    border:`1px solid ${V.border}`, background:'#fafafa',
                    fontFamily:'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize:13, lineHeight:1.55, color:V.text, resize:'vertical',
                  }}
                />
                <div style={{ fontSize:11, color:V.text3, marginTop:4 }}>
                  {currentBody(t).length} 字符 · {currentBody(t).split('\n').length} 行
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
                  <button style={btn('primary')} onClick={() => save(t)} disabled={saving[t.key] || !dirty}>
                    {saving[t.key] ? '保存中…' : '💾 保存'}
                  </button>
                  <button style={btn()} onClick={() => buildPreview(t)}>
                    👁 预览（替换示例值）
                  </button>
                  <button style={btn()} onClick={() => restoreDefault(t)}>
                    ↺ 恢复默认
                  </button>
                  {dirty && (
                    <button style={btn()} onClick={() => {
                      setDrafts(d => { const { [t.key]: _, ...rest } = d; return rest; });
                      clearPreview(t.key);
                    }}>
                      丢弃改动
                    </button>
                  )}
                  {toast && toast.key === t.key && (
                    <span style={{
                      alignSelf:'center', fontSize:12, fontWeight:600,
                      color: toast.kind === 'err' ? '#c62828' : toast.kind === 'info' ? V.text2 : '#2e7d32',
                    }}>
                      {toast.msg}
                    </span>
                  )}
                </div>

                {/* Preview */}
                {previews[t.key] !== undefined && (
                  <div style={{ marginTop:14 }}>
                    <div style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      marginBottom:6,
                    }}>
                      <div style={{ fontSize:11, color:V.verm, fontWeight:600 }}>
                        预览（变量已替换为示例值）
                      </div>
                      <button onClick={() => clearPreview(t.key)}
                        style={{ ...btn(), padding:'3px 9px', fontSize:11 }}>
                        关闭
                      </button>
                    </div>
                    <pre style={{
                      background:'#f5ede0', padding:'12px 14px', borderRadius:8,
                      border:`1px solid ${V.border}`, fontSize:12, lineHeight:1.55,
                      whiteSpace:'pre-wrap', wordBreak:'break-word', color:V.text,
                      maxHeight:380, overflow:'auto', margin:0,
                    }}>
                      {previews[t.key]}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
