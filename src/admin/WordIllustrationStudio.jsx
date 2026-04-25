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

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { getPrompt } from '../lib/prompts.js';

// Image generation providers (mirrors ChengyuAdminTab IMG_PROVIDERS).
// dalle3   → direct OpenAI call (needs admin_key_openai in localStorage)
// stability→ /.netlify/functions/stability-proxy
// flux     → /.netlify/functions/ai-gateway with type='image'
const IMG_PROVIDERS = [
  { id: 'dalle3',    label: 'DALL-E 3',     keyId: 'openai' },
  { id: 'stability', label: 'Stability AI', keyId: null     },
  { id: 'flux',      label: 'Flux (JINAN)',  keyId: null     },
];

// Style preset ids — must match clf_prompt_templates keys: word_image_<id>
// Custom doesn't go through getPrompt; user types prompt directly.
const STYLE_PRESETS = [
  { id: 'flashcard', label: '📚 闪卡风' },
  { id: 'photo',     label: '📷 实景照' },
  { id: 'emoji',     label: '😀 表情符' },
  { id: 'cartoon',   label: '🎨 卡通画' },
  { id: 'abstract',  label: '🌀 抽象画' },
  { id: 'custom',    label: '✏️ 自定义' },
];

// Sanitize word_zh for Supabase Storage key — Chinese chars are allowed,
// but we strip anything weird that could break URL encoding
function wordFilename(word_zh, ext = 'png') {
  const safe = (word_zh || '').replace(/[^\p{L}\p{N}_-]/gu, '_');
  return `word_${safe}.${ext}`;
}

export default function WordIllustrationStudio({ words = [], initialWord = null, onUpdate, onClose }) {
  const [selectedWord,  setSelectedWord]  = useState(initialWord);
  const [provider,      setProvider]      = useState('stability');
  const [stylePreset,   setStylePreset]   = useState('flashcard');
  const [customPrompt,  setCustomPrompt]  = useState('');
  const [generatedUrl,  setGeneratedUrl]  = useState(null);
  const [isGenerating,  setIsGenerating]  = useState(false);
  const [isUploading,   setIsUploading]   = useState(false);
  const [status,        setStatus]        = useState(null);
  const [promptPreview, setPromptPreview] = useState('');
  const fileInputRef = useRef(null);

  const setMsg   = (type, message) => setStatus({ type, message });
  const clearMsg = () => setStatus(null);

  // ── Async fetch + cache the resolved prompt for preview ─────────────
  useEffect(() => {
    if (!selectedWord || stylePreset === 'custom') {
      setPromptPreview('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await getPrompt(`word_image_${stylePreset}`, {
          word_zh:    selectedWord.word_zh    || '',
          meaning_en: selectedWord.meaning_en || selectedWord.meaning_zh || '',
        });
        if (!cancelled) setPromptPreview(p);
      } catch (e) {
        if (!cancelled) setPromptPreview(`(prompt 加载失败: ${e.message})`);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWord, stylePreset]);

  // Returns the actual prompt to send (may differ from preview if user
  // is on 'custom' style — preview is empty in that case)
  async function resolvePrompt() {
    if (stylePreset === 'custom') return customPrompt;
    return await getPrompt(`word_image_${stylePreset}`, {
      word_zh:    selectedWord?.word_zh    || '',
      meaning_en: selectedWord?.meaning_en || selectedWord?.meaning_zh || '',
    });
  }

  // ── Generate via correct image-generation provider ─────────────────
  const handleGenerate = async () => {
    if (!selectedWord) return setMsg('error', '请先选择一个词语。');
    let prompt;
    try {
      prompt = await resolvePrompt();
    } catch (e) {
      return setMsg('error', `Prompt 解析失败: ${e.message}`);
    }
    if (!prompt.trim()) return setMsg('error', '请输入提示词。');

    setIsGenerating(true);
    clearMsg();
    setGeneratedUrl(null);

    try {
      let imageUrl;

      if (provider === 'dalle3') {
        const key = localStorage.getItem('admin_key_openai');
        if (!key) throw new Error('需要在 🔑 API Keys 设置 OpenAI key');
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
          }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error.message);
        imageUrl = d.data?.[0]?.url;
        if (!imageUrl) throw new Error('DALL-E 未返回图片 URL');
      } else if (provider === 'stability') {
        const res = await fetch('/.netlify/functions/stability-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            negative_prompt: 'text, watermark, blurry',
            width: 1024,
            height: 1024,
          }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        imageUrl = d.image_base64
          ? `data:image/png;base64,${d.image_base64}`
          : d.url;
        if (!imageUrl) throw new Error('Stability 未返回图片');
      } else {
        // flux (or any other) via ai-gateway
        const res = await fetch('/.netlify/functions/ai-gateway', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            prompt,
            type: 'image',
          }),
        });
        const text = await res.text();
        let d;
        try { d = JSON.parse(text); }
        catch { throw new Error(`服务器返回非 JSON: ${text.slice(0, 200)}`); }
        if (!res.ok || d.error) throw new Error(d.error || `HTTP ${res.status}`);
        imageUrl = d.url || d.image_url;
        if (!imageUrl) throw new Error('ai-gateway 未返回图片 URL');
      }

      setGeneratedUrl(imageUrl);
      setMsg('success', '✅ 图片生成成功！点击「上传到 Supabase」保存。');
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
            {IMG_PROVIDERS.map(p => (
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
          ) : selectedWord && promptPreview && (
            <div style={S.promptPreview}>
              <em style={{ fontSize: 12, color: '#666' }}>{promptPreview}</em>
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
