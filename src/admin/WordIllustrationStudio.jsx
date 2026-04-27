// src/admin/WordIllustrationStudio.jsx
//
// CLF platform — word illustration studio (single-word generation + manual upload)
//
// Targets:
//   - Table:  clf_words
//   - Column: image_url
//   - Bucket: word-illustrations  (public read, authenticated write)
//
// Fix vs previous version:
//   Supabase Storage object keys must be ASCII (no Chinese, no spaces, no slashes
//   except as path separators). The old code built `word_红色.png` which Supabase
//   rejects with "Invalid key: word_红色.png". This version builds an ASCII slug
//   from pinyin (with tone marks stripped) plus a short hash of the Chinese word
//   to disambiguate homophones.
//
//   Examples:
//     红色 (hóng sè)  → word_hong_se_a3f2.png
//     苹果 (píng guǒ) → word_ping_guo_b71d.png
//     是   (shì)      → word_shi_4e8b.png

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// AI providers (matches ai-gateway.js expected `provider` values)
// ─────────────────────────────────────────────────────────────────────────────
const AI_PROVIDERS = [
  { id: 'dalle',     label: 'DALL-E 3' },
  { id: 'stability', label: 'Stability AI' },
  { id: 'flux',      label: 'Flux (JINAN)' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Style presets — keys match clf_prompt_templates rows
// ─────────────────────────────────────────────────────────────────────────────
const STYLE_PRESETS = [
  {
    id: 'flashcard',
    label: '🎴 闪卡风',
    prompt: ({ word_zh, meaning_en }) =>
      `Clean educational flashcard illustration of "${meaning_en}" (Chinese: ${word_zh}) for vocabulary learners. Single central subject, white background, bright primary colors, bold clean shapes, no text, suitable for language-learning app. Simple and instantly recognizable.`,
  },
  {
    id: 'photo',
    label: '📷 实景照',
    prompt: ({ word_zh, meaning_en }) =>
      `High-quality educational photograph of "${meaning_en}" (Chinese: ${word_zh}). Clear focus, neutral background, well-lit studio style, single subject. Suitable for language-learning flashcard. Photorealistic, no text.`,
  },
  {
    id: 'emoji',
    label: '😀 表情符',
    prompt: ({ meaning_en }) =>
      `Large emoji-style illustration of "${meaning_en}" on a plain white background. Round, friendly, glossy aesthetic similar to Apple/Google emoji design. Single centered subject, bright colors, soft shadow, no text.`,
  },
  {
    id: 'cartoon',
    label: '🎨 卡通画',
    prompt: ({ word_zh, meaning_en }) =>
      `Cute cartoon illustration of "${meaning_en}" (Chinese: ${word_zh}) for children's Chinese textbook. Friendly characters or objects, pastel colors, rounded shapes, playful style, white background, no text. Evokes warmth and fun.`,
  },
  {
    id: 'abstract',
    label: '🌀 抽象画',
    prompt: ({ meaning_en }) =>
      `Abstract minimalist illustration evoking the concept of "${meaning_en}". Geometric shapes, muted color palette, flat design, symbolic rather than literal. Suitable for modern educational material.`,
  },
  {
    id: 'custom',
    label: '✏️ 自定义',
    prompt: null, // user supplies prompt
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Filename utilities — produce ASCII-only Supabase Storage keys
// ─────────────────────────────────────────────────────────────────────────────

/** Strip tone marks from pinyin: hóng → hong, lǜ → lv */
function stripPinyinTones(pinyin) {
  if (!pinyin) return '';
  return pinyin
    .normalize('NFD')                    // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '')     // strip combining tone marks
    .replace(/ü/g, 'v')                  // ü → v
    .replace(/Ü/g, 'V')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')                // spaces → underscore
    .replace(/[^a-z0-9_]/g, '');         // drop anything still non-ASCII
}

/** Tiny stable hash to disambiguate homophones (是 vs 十 vs 事 → all "shi") */
function shortHash(str) {
  if (!str) return '0000';
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 4).padStart(4, '0');
}

/**
 * Build a safe ASCII storage key for a word.
 *   { word_zh: '红色', pinyin: 'hóng sè' } → 'word_hong_se_a3f2.png'
 *   { word_zh: '是',  pinyin: 'shì' }      → 'word_shi_4e8b.png'
 */
function wordFilename(word, ext = 'png') {
  const slug = stripPinyinTones(word?.pinyin) || 'word';
  const hash = shortHash(word?.word_zh || '');
  const safeExt = String(ext).toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  return `word_${slug}_${hash}.${safeExt}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function WordIllustrationStudio({ words = [], onClose, onUpdate }) {
  const [selectedWord, setSelectedWord] = useState(null);
  const [provider, setProvider]         = useState('stability');
  const [styleId, setStyleId]           = useState('emoji');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading]   = useState(false);
  const [msg, setMsgState]              = useState(null); // {kind, text}

  const setMsg   = (kind, text) => setMsgState({ kind, text });
  const clearMsg = () => setMsgState(null);

  // Reset when word changes
  useEffect(() => {
    setGeneratedUrl(null);
    clearMsg();
  }, [selectedWord?.id]);

  // ── Build prompt for current selection ────────────────────────────────────
  const buildPrompt = () => {
    if (!selectedWord) return '';
    if (styleId === 'custom') return customPrompt.trim();
    const preset = STYLE_PRESETS.find(s => s.id === styleId);
    if (!preset?.prompt) return '';
    return preset.prompt({
      word_zh:    selectedWord.word_zh    || '',
      meaning_en: selectedWord.meaning_en || selectedWord.meaning_zh || '',
    });
  };

  const previewPrompt = buildPrompt();

  // ── AI generation via ai-gateway ──────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedWord) {
      setMsg('error', '请先选择词语');
      return;
    }
    const prompt = buildPrompt();
    if (!prompt) {
      setMsg('error', '提示词为空');
      return;
    }

    setIsGenerating(true);
    clearMsg();
    setGeneratedUrl(null);

    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:      'generate_image',
          provider,
          prompt,
          target_type: 'word',
          word_id:     selectedWord.id,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AI gateway ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const url = data.url || data.image_url || data.data?.[0]?.url;
      if (!url) throw new Error('AI gateway 未返回 URL');

      setGeneratedUrl(url);
      setMsg('success', '✨ 生成成功，可点「上传到 Supabase」保存');
    } catch (err) {
      console.error(err);
      setMsg('error', `生成失败: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Upload blob → Supabase Storage → write image_url to clf_words ─────────
  const uploadToSupabase = async (source, filename) => {
    if (!selectedWord) {
      setMsg('error', '请先选择词语');
      return;
    }

    setIsUploading(true);
    clearMsg();

    try {
      // Normalize source → Blob
      let blob;
      if (source instanceof Blob) {
        blob = source;
      } else if (typeof source === 'string' && source.startsWith('data:')) {
        // data: URL
        const [meta, b64] = source.split(',');
        const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/png';
        const bin  = atob(b64);
        const arr  = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        blob = new Blob([arr], { type: mime });
      } else if (typeof source === 'string') {
        // remote URL — fetch through CORS proxy if needed
        const r = await fetch(source);
        if (!r.ok) throw new Error(`Fetch ${r.status}`);
        blob = await r.blob();
      } else {
        throw new Error('不支持的图片来源');
      }

      const ext = (blob.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
      const key = filename || wordFilename(selectedWord, ext);

      // Sanity check — should never trigger after the slug fix, but cheap insurance
      if (!/^[\x20-\x7E]+$/.test(key)) {
        throw new Error(`生成的文件名仍含非 ASCII 字符: ${key}`);
      }

      const { data: up, error: upErr } = await supabase.storage
        .from('word-illustrations')
        .upload(key, blob, {
          upsert:       true,
          contentType:  blob.type || 'image/png',
          cacheControl: '3600',
        });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from('word-illustrations')
        .getPublicUrl(up.path);

      // Cache-bust so the UI refreshes immediately
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from('clf_words')
        .update({ image_url: publicUrl })
        .eq('id', selectedWord.id);

      if (dbErr) throw dbErr;

      setMsg('success', '✅ 已上传并保存');
      setGeneratedUrl(null);
      if (onUpdate) onUpdate({ ...selectedWord, image_url: publicUrl });
    } catch (err) {
      console.error(err);
      setMsg('error', `上传失败: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  // ── Handlers for AI-generated and manual file uploads ─────────────────────
  const handleSaveGenerated = async () => {
    if (!generatedUrl || !selectedWord) return;
    await uploadToSupabase(generatedUrl, wordFilename(selectedWord, 'png'));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWord) return;
    const ext = file.name.split('.').pop() || 'png';
    await uploadToSupabase(file, wordFilename(selectedWord, ext));
    // Reset input so the same file can be re-selected if needed
    e.target.value = '';
  };

  // ── Delete current illustration ───────────────────────────────────────────
  const handleClearImage = async () => {
    if (!selectedWord?.image_url) return;
    if (!confirm(`删除 "${selectedWord.word_zh}" 的插图？`)) return;

    try {
      // Best-effort storage delete
      const m = selectedWord.image_url.match(/\/word-illustrations\/([^?]+)/);
      if (m?.[1]) {
        await supabase.storage.from('word-illustrations').remove([m[1]]);
      }
      const { error } = await supabase
        .from('clf_words')
        .update({ image_url: null })
        .eq('id', selectedWord.id);
      if (error) throw error;
      setMsg('success', '已删除插图');
      if (onUpdate) onUpdate({ ...selectedWord, image_url: null });
    } catch (err) {
      setMsg('error', `删除失败: ${err.message}`);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  const filteredWords  = words.filter(w => w.illustratable !== false);
  const currentImageUrl = selectedWord?.image_url;
  const previewKey     = selectedWord ? wordFilename(selectedWord, 'png') : '';

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#2E7D32' }}>
          🎨 词语插图工作室
        </h2>
        {onClose && (
          <button onClick={onClose} style={S.closeBtn} aria-label="Close">✕</button>
        )}
      </div>

      <div style={S.body}>

        {/* Word picker */}
        <section style={S.section}>
          <label style={S.label}>选择词语 Word</label>
          <select
            value={selectedWord?.id || ''}
            onChange={(e) => {
              const w = words.find(x => String(x.id) === e.target.value);
              setSelectedWord(w || null);
            }}
            style={S.select}
          >
            <option value="">-- 选择 --</option>
            {filteredWords.map(w => (
              <option key={w.id} value={w.id}>
                {w.word_zh} {w.pinyin ? `(${w.pinyin})` : ''} — {w.meaning_en || w.meaning_zh}
              </option>
            ))}
          </select>
          {selectedWord && selectedWord.illustratable === false && (
            <div style={S.warnBanner}>
              ⚠ 此词已标记为「不需要插图」。可在词语列表里修改。
            </div>
          )}
          {selectedWord && (
            <div style={S.hint}>
              📁 文件名: <code>{previewKey}</code>
            </div>
          )}
        </section>

        {/* Provider */}
        <section style={S.section}>
          <label style={S.label}>AI 提供商 Provider</label>
          <div style={S.pills}>
            {AI_PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                style={provider === p.id ? S.pillActive : S.pill}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* Style */}
        <section style={S.section}>
          <label style={S.label}>风格 Style</label>
          <div style={S.pills}>
            {STYLE_PRESETS.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyleId(s.id)}
                style={styleId === s.id ? S.pillActive : S.pill}
              >
                {s.label}
              </button>
            ))}
          </div>

          {styleId === 'custom' ? (
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="自定义提示词（英文效果最好）..."
              rows={3}
              style={S.textarea}
            />
          ) : previewPrompt ? (
            <div style={S.promptPreview}>
              <em>{previewPrompt}</em>
            </div>
          ) : null}
        </section>

        {/* Status */}
        {msg && (
          <div style={msg.kind === 'error' ? S.statusError : msg.kind === 'success' ? S.statusSuccess : S.statusInfo}>
            {msg.text}
          </div>
        )}

        {/* Actions */}
        <section style={S.actions}>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!selectedWord || isGenerating || (styleId === 'custom' && !customPrompt.trim())}
            style={isGenerating ? S.btnPrimaryDisabled : S.btnPrimary}
          >
            {isGenerating ? '⏳ 生成中…' : '✨ AI 生成插图'}
          </button>

          <span style={S.divider}>或</span>

          <label style={S.btnSecondary}>
            📁 手动上传
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              disabled={!selectedWord || isUploading}
            />
          </label>
        </section>

        {/* Generated preview + save */}
        {generatedUrl && (
          <section style={S.preview}>
            <p style={S.previewLabel}>AI 生成预览 (尚未保存):</p>
            <img src={generatedUrl} alt="generated" style={S.previewImg} />
            <button
              type="button"
              onClick={handleSaveGenerated}
              disabled={isUploading}
              style={isUploading ? S.btnPrimaryDisabled : S.btnPrimary}
            >
              {isUploading ? '⏳ 上传中…' : '☁️ 上传到 Supabase'}
            </button>
          </section>
        )}

        {/* Current saved image */}
        {currentImageUrl && !generatedUrl && (
          <section style={S.preview}>
            <p style={S.previewLabel}>当前插图 Current illustration:</p>
            <img src={currentImageUrl} alt={selectedWord.word_zh} style={S.previewImg} />
            <button
              type="button"
              onClick={handleClearImage}
              style={S.btnDanger}
            >
              🗑 删除插图
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (inline, kept identical to original for visual continuity)
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  root: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,.12)',
    maxWidth: 720,
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #eee',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    color: '#888',
  },
  body: {
    padding: 20,
    overflowY: 'auto',
    flex: 1,
  },
  section: { marginBottom: 18 },
  label: {
    display: 'block',
    fontWeight: 600,
    marginBottom: 6,
    color: '#A0522D',
    fontSize: 14,
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 14,
    boxSizing: 'border-box',
  },
  pills: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  pill: {
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid #ccc',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    transition: 'all .15s',
  },
  pillActive: {
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid #2E7D32',
    background: '#2E7D32',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
  },
  textarea: {
    width: '100%',
    padding: 10,
    border: '1px solid #ddd',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    marginTop: 8,
    resize: 'vertical',
  },
  promptPreview: {
    background: '#FAF3E0',
    padding: 10,
    borderRadius: 6,
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    lineHeight: 1.5,
  },
  hint: {
    marginTop: 6,
    fontSize: 11,
    color: '#888',
    fontFamily: 'monospace',
  },
  warnBanner: {
    marginTop: 8,
    padding: '8px 12px',
    background: '#FFF3CD',
    border: '1px solid #FFE69C',
    borderRadius: 6,
    fontSize: 13,
    color: '#664D03',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '14px 0',
    flexWrap: 'wrap',
  },
  divider: { color: '#999', fontSize: 13 },
  btnPrimary: {
    padding: '10px 18px',
    background: '#2E7D32',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  btnPrimaryDisabled: {
    padding: '10px 18px',
    background: '#999',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'not-allowed',
    fontSize: 14,
    fontWeight: 500,
  },
  btnSecondary: {
    padding: '10px 18px',
    background: '#fff',
    color: '#2E7D32',
    border: '2px solid #2E7D32',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    display: 'inline-block',
  },
  btnDanger: {
    padding: '8px 14px',
    background: '#fff',
    color: '#c62828',
    border: '1px solid #c62828',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    marginTop: 8,
  },
  statusSuccess: {
    padding: '10px 12px',
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 13,
    background: '#D4EDDA',
    color: '#155724',
  },
  statusError: {
    padding: '10px 12px',
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 13,
    background: '#F8D7DA',
    color: '#721C24',
  },
  statusInfo: {
    padding: '10px 12px',
    borderRadius: 6,
    marginBottom: 12,
    fontSize: 13,
    background: '#D1ECF1',
    color: '#0C5460',
  },
  preview: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid #eee',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-start',
  },
  previewLabel: { color: '#888', fontSize: 13, margin: 0 },
  previewImg: {
    maxWidth: 280,
    width: '100%',
    borderRadius: 10,
    border: '1px solid #eee',
    boxShadow: '0 2px 8px rgba(0,0,0,.08)',
  },
};
