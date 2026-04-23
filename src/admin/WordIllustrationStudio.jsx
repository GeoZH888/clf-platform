// src/admin/WordIllustrationStudio.jsx
// Adapted from IllustrationStudio.jsx (which targets jgw_characters).
// Changes:
//   - Target table: clf_words (not jgw_characters)
//   - Target column: image_url (not illustration_url)
//   - Storage bucket: word-illustrations (not character-illustrations)
//   - Primary key: word_zh is UNIQUE; we filter by id uuid
//   - 5 new word-specific style presets + custom
//   - Same providers as character version (ai-gateway endpoint)
//
// Netlify function expectation (BACKEND CHANGE REQUIRED):
//   /.netlify/functions/ai-gateway with action='generate_image' already works.
//   We pass {target_type: 'word'} so if you want the backend to store results
//   you need to branch on that. Alternatively, we save the generated URL
//   ourselves via uploadToSupabase(), which is what we do here.

import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

const AI_PROVIDERS = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'openai', label: 'GPT-4o (OpenAI)' },
  { id: 'gemini', label: 'Gemini 1.5 (Google)' },
];

// Word-specific style presets (the 5 chosen + custom)
const STYLE_PRESETS = [
  { id: 'flashcard', label: '📚 闪卡风',
    prompt: (zh, en) =>
      `Clean educational flashcard illustration of "${en}" (Chinese: ${zh}) for vocabulary learners. ` +
      `Single central subject, white background, bright primary colors, bold clean shapes, no text, ` +
      `suitable for language-learning app. Simple and instantly recognizable.` },
  { id: 'photo', label: '📷 实景照',
    prompt: (zh, en) =>
      `High-quality educational photograph of "${en}" (Chinese: ${zh}). Clear focus, neutral background, ` +
      `well-lit studio style, single subject. Suitable for language-learning flashcard. ` +
      `Photorealistic, no text.` },
  { id: 'emoji', label: '😀 表情符',
    prompt: (zh, en) =>
      `Large emoji-style illustration of "${en}" on a plain white background. ` +
      `Round, friendly, glossy aesthetic similar to Apple/Google emoji design. ` +
      `Single centered subject, bright colors, soft shadow, no text.` },
  { id: 'cartoon', label: '🎨 卡通画',
    prompt: (zh, en) =>
      `Cute cartoon illustration of "${en}" (Chinese: ${zh}) for children's Chinese textbook. ` +
      `Friendly characters or objects, pastel colors, rounded shapes, playful style, ` +
      `white background, no text. Evokes warmth and fun.` },
  { id: 'abstract', label: '🌀 抽象画',
    prompt: (zh, en) =>
      `Abstract minimalist illustration evoking the concept of "${en}". ` +
      `Geometric shapes, muted color palette, flat design, symbolic rather than literal. ` +
      `Suitable for modern educational material. No text.` },
  { id: 'custom', label: '✏️ 自定义',
    prompt: () => '' },
];

// Sanitize word_zh for Supabase Storage key — Chinese chars are allowed,
// but we strip anything weird that could break URL encoding
function wordFilename(word_zh, ext = 'png') {
  const safe = (word_zh || '').replace(/[^\p{L}\p{N}_-]/gu, '_');
  return `word_${safe}.${ext}`;
}

export default function WordIllustrationStudio({ words = [], initialWord = null, onUpdate, onClose }) {
  const [selectedWord,  setSelectedWord]  = useState(initialWord);
  const [provider,      setProvider]      = useState('claude');
  const [stylePreset,   setStylePreset]   = useState('flashcard');
  const [customPrompt,  setCustomPrompt]  = useState('');
  const [generatedUrl,  setGeneratedUrl]  = useState(null);
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [isUploading,   setIsUploading]   = useState(false);
  const [status,        setStatus]        = useState(null);
  const fileInputRef = useRef(null);

  const setMsg   = (type, message) => setStatus({ type, message });
  const clearMsg = () => setStatus(null);

  const getPrompt = () => {
    const zh = selectedWord?.word_zh || '?';
    const en = selectedWord?.meaning_en || selectedWord?.meaning_zh || '';

    if (stylePreset === 'custom') return customPrompt;

    const preset = STYLE_PRESETS.find(p => p.id === stylePreset);
    return preset?.prompt(zh, en) || '';
  };

  // ── Generate via ai-gateway ────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedWord) return setMsg('error', '请先选择一个词语。');
    const prompt = getPrompt();
    if (!prompt.trim()) return setMsg('error', '请输入提示词。');

    setIsGenerating(true);
    clearMsg();
    setGeneratedUrl(null);

    try {
      const res  = await fetch('/.netlify/functions/ai-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_image',
          provider,
          prompt,
          // hint for backend in case you add target-type routing later
          target_type: 'word',
          target_key: selectedWord.word_zh,
          // character field preserved for backend compatibility
          character: selectedWord.word_zh,
        }),
      });

      const text = await res.text();
      if (!text) throw new Error('服务器返回空响应');

      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(`服务器返回非 JSON: ${text.slice(0, 200)}`); }

      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      if (data.url) {
        setGeneratedUrl(data.url);
        setMsg('success', '✅ 图片生成成功！点击「上传到 Supabase」保存。');
      } else if (data.enhancedPrompt) {
        setMsg('info', `✏️ Enhanced prompt:\n${data.enhancedPrompt}`);
      } else {
        setMsg('error', '生成未返回图片 URL');
      }
    } catch (err) {
      setMsg('error', `生成失败: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Upload to Supabase Storage + update clf_words.image_url ──────
  const uploadToSupabase = async (source, filenameOverride) => {
    setIsUploading(true);
    setMsg('info', '⏳ 上传中…');

    try {
      let blob;
      if (source instanceof Blob) {
        blob = source;
      } else if (typeof source === 'string' && source.startsWith('data:')) {
        const [header, base64] = source.split(',');
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(base64);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        blob = new Blob([arr], { type: mime });
      } else {
        const r = await fetch(source);
        blob = await r.blob();
      }

      const ext = blob.type.includes('png') ? 'png'
                : blob.type.includes('jpeg') || blob.type.includes('jpg') ? 'jpg'
                : blob.type.includes('webp') ? 'webp'
                : 'png';
      const path = filenameOverride || wordFilename(selectedWord.word_zh, ext);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('word-illustrations')
        .upload(path, blob, { upsert: true, contentType: blob.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('word-illustrations')
        .getPublicUrl(uploadData.path);

      // Cache-bust so re-uploads appear immediately
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('clf_words')
        .update({ image_url: publicUrl })
        .eq('id', selectedWord.id);
      if (dbError) throw dbError;

      setMsg('success', '✅ 已上传并保存！');
      if (onUpdate) onUpdate({ ...selectedWord, image_url: publicUrl });
    } catch (err) {
      setMsg('error', `上传失败: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWord) return;
    const ext = file.name.split('.').pop() || 'png';
    await uploadToSupabase(file, wordFilename(selectedWord.word_zh, ext));
  };

  // Clear image
  const handleClearImage = async () => {
    if (!selectedWord?.image_url) return;
    if (!confirm(`删除 "${selectedWord.word_zh}" 的插图？`)) return;
    try {
      // Try to remove from storage too (best effort)
      const urlParts = selectedWord.image_url.split('/word-illustrations/');
      if (urlParts[1]) {
        const path = urlParts[1].split('?')[0];
        await supabase.storage.from('word-illustrations').remove([path]);
      }
      const { error } = await supabase
        .from('clf_words').update({ image_url: null }).eq('id', selectedWord.id);
      if (error) throw error;
      setMsg('success', '已删除插图');
      if (onUpdate) onUpdate({ ...selectedWord, image_url: null });
    } catch (err) {
      setMsg('error', `删除失败: ${err.message}`);
    }
  };

  const filteredWords = words.filter(w => w.illustratable !== false);
  const currentImageUrl = selectedWord?.image_url;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#2E7D32' }}>
          🎨 词语插图工作室
        </h2>
        {onClose && (
          <button onClick={onClose} style={S.closeBtn}>✕</button>
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
              setGeneratedUrl(null);
              clearMsg();
            }}
            style={S.select}>
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
        </section>

        {/* Provider */}
        <section style={S.section}>
          <label style={S.label}>AI 提供商 Provider</label>
          <div style={S.pills}>
            {AI_PROVIDERS.map(p => (
              <button key={p.id} type="button"
                onClick={() => setProvider(p.id)}
                style={provider === p.id ? S.pillActive : S.pill}>
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
              <button key={s.id} type="button"
                onClick={() => setStylePreset(s.id)}
                style={stylePreset === s.id ? S.pillActive : S.pill}>
                {s.label}
              </button>
            ))}
          </div>

          {stylePreset === 'custom' ? (
            <textarea rows={3}
              placeholder="自定义提示词..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              style={S.textarea}/>
          ) : selectedWord && (
            <div style={S.promptPreview}>
              <em style={{ fontSize: 12, color: '#666' }}>{getPrompt()}</em>
            </div>
          )}
        </section>

        {/* Action buttons */}
        <section style={S.actions}>
          <button onClick={handleGenerate}
            disabled={isGenerating || !selectedWord}
            style={S.btnPrimary}>
            {isGenerating ? '⏳ 生成中…' : '✨ AI 生成插图'}
          </button>
          <span style={S.divider}>或</span>
          <button onClick={() => fileInputRef.current?.click()}
            disabled={!selectedWord}
            style={S.btnSecondary}>
            📁 手动上传
          </button>
          <input ref={fileInputRef} type="file" accept="image/*"
            style={{ display: 'none' }} onChange={handleFileUpload}/>
        </section>

        {/* Status */}
        {status && (
          <div style={{
            ...S.statusBanner,
            background: status.type === 'success' ? '#d4edda'
                      : status.type === 'error'   ? '#f8d7da' : '#d1ecf1',
            color:      status.type === 'success' ? '#155724'
                      : status.type === 'error'   ? '#721c24' : '#0c5460',
          }}>
            {status.message}
          </div>
        )}

        {/* Preview of generated image */}
        {generatedUrl && (
          <section style={S.preview}>
            <img src={generatedUrl} alt={selectedWord?.word_zh}
              style={S.previewImg}/>
            <button onClick={() => uploadToSupabase(generatedUrl)}
              disabled={isUploading}
              style={S.btnPrimary}>
              {isUploading ? '⏳ 上传中…' : '☁️ 上传到 Supabase'}
            </button>
          </section>
        )}

        {/* Current image (if not currently previewing a new one) */}
        {currentImageUrl && !generatedUrl && (
          <section style={S.preview}>
            <div style={S.previewLabel}>
              当前插图 Current illustration:
              <button onClick={handleClearImage} style={S.btnTextDanger}>
                🗑 删除
              </button>
            </div>
            <img src={currentImageUrl} alt={selectedWord?.word_zh}
              style={S.previewImg}/>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const S = {
  root: {
    padding: '1.5rem', maxWidth: 640, background: '#fff',
    borderRadius: 12, border: '1px solid #e8d5b0',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e8d5b0',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 22, cursor: 'pointer',
    color: '#999',
  },
  body: { display: 'flex', flexDirection: 'column', gap: 16 },
  section: { marginBottom: 4 },
  label: {
    display: 'block', fontWeight: 600, marginBottom: 6,
    fontSize: 13, color: '#5D2E0C',
  },
  select: {
    width: '100%', padding: 8, border: '1px solid #e8d5b0',
    borderRadius: 6, fontSize: 14,
  },
  pills: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  pill: {
    padding: '6px 12px', borderRadius: 16, border: '1px solid #e8d5b0',
    background: '#fff', cursor: 'pointer', fontSize: 12,
    transition: 'all 0.15s',
  },
  pillActive: {
    padding: '6px 12px', borderRadius: 16, border: '1px solid #2E7D32',
    background: '#2E7D32', color: '#fff', cursor: 'pointer', fontSize: 12,
    fontWeight: 500,
  },
  textarea: {
    width: '100%', padding: 8, border: '1px solid #e8d5b0',
    borderRadius: 6, fontSize: 13, marginTop: 6,
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  promptPreview: {
    marginTop: 8, padding: '8px 10px', background: '#f5ede0',
    borderRadius: 6, fontSize: 12, lineHeight: 1.5,
  },
  actions: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    paddingTop: 6,
  },
  divider: { color: '#999', fontSize: 12 },
  btnPrimary: {
    padding: '9px 18px', background: '#2E7D32', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 500,
  },
  btnSecondary: {
    padding: '9px 18px', background: '#fff', color: '#2E7D32',
    border: '1.5px solid #2E7D32', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 500,
  },
  btnTextDanger: {
    background: 'none', border: 'none', color: '#c0392b',
    fontSize: 11, cursor: 'pointer', padding: 0,
  },
  warnBanner: {
    marginTop: 8, padding: '8px 10px', background: '#FFF3CD',
    borderRadius: 6, fontSize: 12, color: '#8B6914',
    border: '1px solid #FFE082',
  },
  statusBanner: {
    padding: '10px 14px', borderRadius: 8, fontSize: 13,
    whiteSpace: 'pre-wrap',
  },
  preview: {
    display: 'flex', flexDirection: 'column', gap: 10,
    alignItems: 'flex-start', paddingTop: 6,
  },
  previewLabel: {
    fontSize: 12, color: '#6b4c2a',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%',
  },
  previewImg: {
    maxWidth: '100%', width: 300, borderRadius: 10,
    border: '1px solid #e8d5b0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
};
