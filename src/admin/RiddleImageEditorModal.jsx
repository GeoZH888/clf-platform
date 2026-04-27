// src/admin/RiddleImageEditorModal.jsx
//
// Modal for editing a riddle's image prompt and regenerating with a chosen
// provider. Each successful generation persists the prompt+provider to
// clf_riddles. Failed attempts don't persist.
//
// Usage:
//   <RiddleImageEditorModal
//     riddle={riddle}
//     type="illustration"   // or "answer"
//     onClose={() => setEditing(null)}
//     onUpdated={(updatedRiddle) => loadRiddles()}
//   />

import { useState, useEffect, useMemo } from 'react';

const PROVIDERS = [
  { id: 'stability', label: 'Stability AI',  hint: '通用·便宜·中等质量' },
  { id: 'openai',    label: 'DALL-E 3',      hint: '高质量·中文好·偏贵' },
  { id: 'ideogram',  label: 'Ideogram',      hint: '文字渲染好·避免字符干扰需提示' },
];

export default function RiddleImageEditorModal({ riddle, type, onClose, onUpdated }) {
  const isIllustration = type === 'illustration';
  const label          = isIllustration ? '插图（谜面）' : '答案图（谜底）';

  const savedPrompt    = isIllustration ? riddle.illustration_prompt    : riddle.answer_prompt;
  const savedProvider  = isIllustration ? riddle.illustration_provider  : riddle.answer_provider;
  const currentUrl     = isIllustration ? riddle.illustration_url       : riddle.answer_image_url;

  const defaultPrompt  = useMemo(() => buildDefaultPromptClient(riddle, type), [riddle, type]);

  const [prompt,   setPrompt]   = useState(savedPrompt || defaultPrompt);
  const [provider, setProvider] = useState(savedProvider || 'stability');
  const [previewUrl, setPreviewUrl] = useState(currentUrl || null);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus]         = useState(null);
  const [history, setHistory]       = useState([]);  // last few attempts in this session

  function resetToDefault() {
    if (prompt !== defaultPrompt && !confirm('当前内容将被替换为默认提示词，继续？')) return;
    setPrompt(defaultPrompt);
    setStatus({ kind: 'info', text: '已重置为默认提示词' });
  }

  async function generate() {
    if (!prompt.trim()) {
      setStatus({ kind: 'error', text: '提示词不能为空' });
      return;
    }
    setGenerating(true);
    setStatus({ kind: 'info', text: `正在用 ${labelOf(provider)} 生成...` });

    try {
      const res = await fetch('/.netlify/functions/generate-riddle-images', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riddle_id: riddle.id,
          type,
          provider,
          prompt: prompt.trim(),
          force: true,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setStatus({
          kind: 'error',
          text: `生成失败: ${data.error || `HTTP ${res.status}`}`,
        });
        // Failed prompt does NOT persist (the function won't save it).
        return;
      }

      setPreviewUrl(data.url);
      setHistory(h => [{ url: data.url, provider, ts: Date.now() }, ...h].slice(0, 4));
      setStatus({ kind: 'success', text: `生成成功 · 使用 ${labelOf(provider)} · 已保存` });
      onUpdated?.();   // tell parent to refresh
    } catch (err) {
      setStatus({ kind: 'error', text: `异常: ${err.message}` });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>🎨 {label}</h3>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              <strong style={{ color: '#5D4037' }}>{riddle.riddle_text}</strong>
              {' → '}
              <strong style={{ color: '#C62828' }}>{riddle.answer}</strong>
              {riddle.category_hint && <span style={{ color: '#999' }}> · {riddle.category_hint}</span>}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn} aria-label="关闭">✕</button>
        </div>

        <div style={S.body}>
          <div style={S.row}>
            {/* Left: editor */}
            <div style={S.editor}>
              <label style={S.label}>
                AI 提供商
                <span style={S.hint}> · {hintOf(provider)}</span>
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                style={S.select}
                disabled={generating}
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>

              <div style={S.labelRow}>
                <label style={S.label}>提示词 Prompt</label>
                <button
                  onClick={resetToDefault}
                  style={S.btnTextSmall}
                  disabled={generating}
                  title="重置为默认提示词（基于谜面字面意思+解释）"
                >
                  ↺ 重置默认
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={10}
                style={S.textarea}
                disabled={generating}
                placeholder="描述要生成的图片..."
              />

              <div style={S.charCount}>
                {prompt.length} 字符
                {savedPrompt && prompt === savedPrompt && (
                  <span style={{ marginLeft: 8, color: '#4CAF50' }}>✓ 当前为已保存的提示词</span>
                )}
                {prompt === defaultPrompt && (
                  <span style={{ marginLeft: 8, color: '#888' }}>· 默认提示词</span>
                )}
              </div>

              {status && (
                <div style={
                  status.kind === 'error'   ? S.statusError :
                  status.kind === 'success' ? S.statusSuccess :
                  S.statusInfo
                }>
                  {status.text}
                </div>
              )}

              <div style={S.actions}>
                <button onClick={onClose} style={S.btnSecondary} disabled={generating}>
                  关闭
                </button>
                <button
                  onClick={generate}
                  disabled={generating || !prompt.trim()}
                  style={generating || !prompt.trim() ? S.btnPrimaryDisabled : S.btnPrimary}
                >
                  {generating ? '⏳ 生成中...' : '🎨 生成'}
                </button>
              </div>
            </div>

            {/* Right: preview */}
            <div style={S.preview}>
              <div style={S.previewLabel}>预览</div>
              <div style={S.previewBox}>
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" style={S.previewImg} />
                ) : (
                  <div style={S.previewEmpty}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>🎨</div>
                    <div>尚未生成</div>
                  </div>
                )}
              </div>

              {history.length > 0 && (
                <div style={S.historyBox}>
                  <div style={S.historyLabel}>本次会话历史</div>
                  <div style={S.historyRow}>
                    {history.map((h, i) => (
                      <button
                        key={h.ts}
                        onClick={() => setPreviewUrl(h.url)}
                        style={S.historyThumb}
                        title={`${labelOf(h.provider)} · ${new Date(h.ts).toLocaleTimeString()}`}
                      >
                        <img src={h.url} alt={`v${history.length - i}`} style={S.historyImg} />
                        {previewUrl === h.url && <span style={S.historyMarker}>当前</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Default prompt — mirrors the server-side buildDefaultPrompt in
// generate-riddle-images.js so admin sees the same default in the modal
// as the function would compute when called without a custom prompt.
// ─────────────────────────────────────────────────────────────────────────────
function buildDefaultPromptClient(riddle, type) {
  const { riddle_text, answer, answer_type, category_hint, explanation } = riddle;

  if (type === 'answer') {
    const subjectKind =
      answer_type === 'idiom'   ? '成语' :
      answer_type === 'word'    ? '词语' :
      answer_type === 'object'  ? '事物' :
      '汉字';

    return [
      `中国传统插画，表现「${answer}」这个${subjectKind}的含义。`,
      `谜面背景：${riddle_text}。`,
      explanation ? `含义解释：${explanation}。` : '',
      `风格：温暖喜庆的中国节日艺术，红金色调，工笔或水彩风格。`,
      `单一中心主体，简洁背景。`,
      `重要：图中不要出现任何中文字符或汉字。`,
      `适合作为灯谜揭晓时的展示图。`,
    ].filter(Boolean).join('\n');
  }

  const lines = [
    `中国传统装饰插画，基于谜面的字面意思创作。`,
    `谜面：${riddle_text}`,
  ];
  if (category_hint) lines.push(`谜目：${category_hint}`);
  if (explanation)   lines.push(`谜底解释：${explanation}`);
  lines.push(
    `风格：中国水墨画或工笔画，温暖的灯笼节日氛围。`,
    `重要：图中不要出现任何中文字符或汉字。`,
  );
  if (answer_type === 'character') {
    lines.push(`特别注意：避免在图中画出任何与答案「${answer}」相关的字形、部首或显眼线索。`);
  }
  return lines.join('\n');
}

function labelOf(id) { return PROVIDERS.find(p => p.id === id)?.label || id; }
function hintOf(id)  { return PROVIDERS.find(p => p.id === id)?.hint  || ''; }

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  backdrop:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 },
  modal:     { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 920, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.2)' },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', borderBottom: '1px solid #eee', flexShrink: 0 },
  closeBtn:  { background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', padding: 4 },
  body:      { padding: '16px 20px', overflowY: 'auto' },
  row:       { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'flex-start' },

  editor:    { display: 'flex', flexDirection: 'column' },
  label:     { fontSize: 12, fontWeight: 600, color: '#5D4037', marginBottom: 4, display: 'block' },
  labelRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  hint:      { color: '#999', fontWeight: 400 },
  select:    { width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 8 },
  textarea:  { width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 6, fontSize: 13, fontFamily: 'monospace, "Noto Sans Mono CJK SC"', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 },
  charCount: { fontSize: 11, color: '#888', marginTop: 4 },

  preview:      { display: 'flex', flexDirection: 'column' },
  previewLabel: { fontSize: 12, fontWeight: 600, color: '#5D4037', marginBottom: 8 },
  previewBox:   { width: '100%', aspectRatio: '1', border: '2px solid #FFD180', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF8E1' },
  previewImg:   { width: '100%', height: '100%', objectFit: 'cover' },
  previewEmpty: { textAlign: 'center', color: '#A0522D', fontSize: 14 },

  historyBox:    { marginTop: 12 },
  historyLabel:  { fontSize: 11, color: '#888', marginBottom: 6 },
  historyRow:    { display: 'flex', gap: 6, flexWrap: 'wrap' },
  historyThumb:  { width: 60, height: 60, padding: 0, border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer', overflow: 'hidden', position: 'relative' },
  historyImg:    { width: '100%', height: '100%', objectFit: 'cover' },
  historyMarker: { position: 'absolute', bottom: 0, left: 0, right: 0, fontSize: 9, background: 'rgba(76,175,80,0.9)', color: '#fff', padding: '1px 0' },

  actions:      { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 },
  btnPrimary:   { padding: '10px 20px', background: '#C62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 },
  btnPrimaryDisabled: { padding: '10px 20px', background: '#bbb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'not-allowed', fontSize: 14 },
  btnSecondary: { padding: '10px 16px', background: '#fff', color: '#666', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  btnTextSmall: { padding: '4px 8px', background: 'transparent', color: '#FF9800', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500 },

  statusInfo:    { padding: 8, marginTop: 10, background: '#E3F2FD', color: '#0C5460', borderRadius: 4, fontSize: 12 },
  statusSuccess: { padding: 8, marginTop: 10, background: '#D4EDDA', color: '#155724', borderRadius: 4, fontSize: 12 },
  statusError:   { padding: 8, marginTop: 10, background: '#F8D7DA', color: '#721C24', borderRadius: 4, fontSize: 12 },
};
