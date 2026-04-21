// src/admin/IllustrationStudio.jsx
// ⚠️ FIX: Uncomment the ONE import line that matches your project structure
// Check AdminApp.jsx to see which path it uses

import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const AI_PROVIDERS = [
  { id: "claude", label: "Claude (Anthropic)" },
  { id: "openai", label: "GPT-4o (OpenAI)" },
  { id: "gemini", label: "Gemini 1.5 (Google)" },
];

const STYLE_PRESETS = [
  { id: "oracle", label: "甲骨文风格",
    prompt: (c, m) => `Oracle bone script style educational illustration. Ancient Chinese pictograph of "${c}" (meaning: ${m}). Show the original pictographic meaning visually. Monochrome brush on aged bone texture, minimalist, symbolic, ancient Chinese art style. The image should help a student understand WHY this character looks the way it does.` },
  { id: "ink",    label: "水墨画",
    prompt: (c, m) => `Chinese ink wash painting (水墨画) illustrating the concept of "${m}" (Chinese: ${c}). Expressive sumi-e brushwork, black ink on white, traditional East Asian aesthetic. Educational illustration showing the meaning clearly.` },
  { id: "flat",   label: "现代插图",
    prompt: (c, m) => `Flat vector educational illustration for Chinese character "${c}" meaning "${m}". Clean bold shapes, bright colors, white background, child-friendly cartoon style. Clear and simple — helps a student instantly understand the meaning.` },
  { id: "seal",   label: "篆刻风格",
    prompt: (c, m) => `Chinese seal carving (篆刻) art style. Red and white composition illustrating "${m}" (${c}). Bold geometric strokes, traditional stamp aesthetic, symmetrical composition.` },
  { id: "custom", label: "自定义",
    prompt: () => "" },
];

export default function IllustrationStudio({ characters = [], initialChar = null, onUpdate, onClose }) {
  const [selectedChar, setSelectedChar] = useState(initialChar);
  const [provider, setProvider]         = useState("claude");
  const [stylePreset, setStylePreset]   = useState("oracle");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading]   = useState(false);
  const [status, setStatus]             = useState(null);
  const fileInputRef = useRef(null);

  const setMsg   = (type, message) => setStatus({ type, message });
  const clearMsg = () => setStatus(null);

  const getPrompt = () => {
    const char    = selectedChar?.glyph_modern || selectedChar?.character || '?';
    const meaning = selectedChar?.meaning_en || selectedChar?.meaning_zh || '';
    const pinyin  = selectedChar?.pinyin || '';
    const etymology = selectedChar?.etymology || '';

    if (stylePreset === "custom") return customPrompt;

    const preset = STYLE_PRESETS.find(p => p.id === stylePreset);
    let base = preset?.prompt(char, meaning) || '';

    // Add etymology context if available — helps AI produce more accurate pictographic image
    if (etymology && stylePreset === 'oracle') {
      base += ` Etymology context: ${etymology}`;
    }
    if (pinyin) base += ` Pinyin: ${pinyin}.`;

    return base;
  };

  // ── Generate via ai-gateway ────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedChar) return setMsg("error", "请先选择一个汉字。");
    const prompt = getPrompt();
    if (!prompt.trim()) return setMsg("error", "请输入提示词。");

    setIsGenerating(true);
    clearMsg();
    setGeneratedUrl(null);

    try {
      const res  = await fetch("/.netlify/functions/ai-gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_image", provider, prompt, character: selectedChar.glyph_modern || selectedChar.character }),
      });

      const text = await res.text();
      if (!text) throw new Error("Empty response from server.");

      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(`Server returned non-JSON: ${text.slice(0, 200)}`); }

      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      if (data.url) {
        setGeneratedUrl(data.url);
        setMsg("success", "✅ 图片生成成功！点击「上传到 Supabase」保存。");
      } else {
        setMsg("info", `✏️ Enhanced prompt (paste into ComfyUI/Midjourney):\n${data.enhancedPrompt}`);
      }
    } catch (err) {
      setMsg("error", `生成失败: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const uploadToSupabase = async (source, filename) => {
    setIsUploading(true);
    setMsg("info", "⏳ 上传中…");

    try {
      let blob;
      if (source instanceof Blob) {
        blob = source;
      } else if (typeof source === "string" && source.startsWith("data:")) {
        const [header, base64] = source.split(",");
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(base64);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        blob = new Blob([arr], { type: mime });
      } else {
        const r = await fetch(source);
        blob = await r.blob();
      }

      const ext  = blob.type.includes("png") ? "png" : "jpg";
      const path = `illustrations/${selectedChar.glyph_modern || selectedChar.character}/${filename || `${Date.now()}.${ext}`}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("character-illustrations")
        .upload(path, blob, { upsert: true, contentType: blob.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("character-illustrations")
        .getPublicUrl(uploadData.path);

      const publicUrl = urlData.publicUrl;

      const { error: dbError } = await supabase
        .from("jgw_characters")
        .update({ illustration_url: publicUrl })
        .eq("id", selectedChar.id);

      if (dbError) throw dbError;

      setMsg("success", "✅ 已上传并保存！");
      if (onUpdate) onUpdate({ ...selectedChar, illustration_url: publicUrl });
    } catch (err) {
      setMsg("error", `上传失败: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChar) return;
    await uploadToSupabase(file, `manual_${Date.now()}.${file.name.split(".").pop()}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="illustration-studio">
      <h2>🎨 Illustration Studio</h2>

      <section className="studio-section">
        <label>选择汉字 Character</label>
        <select
          value={selectedChar?.id || ""}
          onChange={(e) => {
            const ch = characters.find((c) => String(c.id) === e.target.value);
            setSelectedChar(ch || null);
            setGeneratedUrl(null);
            clearMsg();
          }}
        >
          <option value="">-- 选择 --</option>
          {characters.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.glyph_modern || ch.character} {ch.pinyin} — {ch.meaning_zh || ch.meaning_en}
            </option>
          ))}
        </select>
      </section>

      <section className="studio-section">
        <label>AI 提供商 Provider</label>
        <div className="pills">
          {AI_PROVIDERS.map((p) => (
            <button key={p.id} type="button"
              className={`pill ${provider === p.id ? "active" : ""}`}
              onClick={() => setProvider(p.id)}
            >{p.label}</button>
          ))}
        </div>
      </section>

      <section className="studio-section">
        <label>风格预设 Style</label>
        <div className="pills">
          {STYLE_PRESETS.map((s) => (
            <button key={s.id} type="button"
              className={`pill ${stylePreset === s.id ? "active" : ""}`}
              onClick={() => setStylePreset(s.id)}
            >{s.label}</button>
          ))}
        </div>
        {stylePreset === "custom" ? (
          <textarea className="prompt-input" rows={3}
            placeholder="自定义提示词…"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
          />
        ) : selectedChar && (
          <div>
            <p className="prompt-preview"><em>{getPrompt()}</em></p>
            <p style={{ fontSize:11, color:'#a07850', marginTop:4 }}>
              💡 {stylePreset === 'oracle'
                ? '甲骨文风格：展示字的象形起源，帮助学生理解字义'
                : stylePreset === 'ink'
                ? '水墨画风格：传统艺术，适合高年级学生'
                : stylePreset === 'flat'
                ? '现代插图：清晰易懂，最适合初学者'
                : '篆刻风格：艺术感强，适合文化学习'}
            </p>
          </div>
        )}
      </section>

      <section className="studio-actions">
        <button type="button" className="btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating || !selectedChar}
        >{isGenerating ? "⏳ 生成中…" : "✨ AI 生成插图"}</button>

        <span className="divider">或</span>

        <button type="button" className="btn-secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={!selectedChar}
        >📁 手动上传</button>
        <input ref={fileInputRef} type="file" accept="image/*"
          style={{ display: "none" }} onChange={handleFileUpload} />
      </section>

      {status && (
        <div className={`status-banner status-${status.type}`}>
          {status.message}
        </div>
      )}

      {generatedUrl && (
        <section className="studio-preview">
          <img src={generatedUrl} alt={selectedChar?.character} />
          <button type="button" className="btn-primary"
            onClick={() => uploadToSupabase(generatedUrl)}
            disabled={isUploading}
          >{isUploading ? "⏳ 上传中…" : "☁️ 上传到 Supabase"}</button>
        </section>
      )}

      {selectedChar?.illustration_url && !generatedUrl && (
        <section className="studio-preview">
          <p className="preview-label">当前插图 Current illustration:</p>
          <img src={selectedChar.illustration_url} alt={selectedChar.glyph_modern || selectedChar.character} />
        </section>
      )}

      <style>{`
        .illustration-studio { padding: 1.5rem; max-width: 640px; }
        .studio-section { margin-bottom: 1.2rem; }
        .studio-section label { display: block; font-weight: 600; margin-bottom: .4rem; }
        .studio-section select, .prompt-input {
          width: 100%; padding: .5rem; border: 1px solid #ddd;
          border-radius: 6px; font-size: 1rem; box-sizing: border-box;
        }
        .pills { display: flex; flex-wrap: wrap; gap: .5rem; }
        .pill {
          padding: .35rem .8rem; border-radius: 20px; border: 1px solid #ccc;
          background: #f5f5f5; cursor: pointer; font-size: .85rem; transition: all .15s;
        }
        .pill.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
        .prompt-preview { font-size: .8rem; color: #666; margin-top: .5rem; }
        .studio-actions { display: flex; align-items: center; gap: 1rem; margin: 1rem 0; flex-wrap: wrap; }
        .divider { color: #999; font-size: .85rem; }
        .btn-primary {
          padding: .6rem 1.2rem; background: #1a1a2e; color: #fff;
          border: none; border-radius: 8px; cursor: pointer; font-size: .9rem;
        }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
        .btn-secondary {
          padding: .6rem 1.2rem; background: #fff; color: #1a1a2e;
          border: 2px solid #1a1a2e; border-radius: 8px; cursor: pointer; font-size: .9rem;
        }
        .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }
        .status-banner {
          padding: .7rem 1rem; border-radius: 8px; margin: .8rem 0;
          font-size: .88rem; white-space: pre-wrap;
        }
        .status-success { background: #d4edda; color: #155724; }
        .status-error   { background: #f8d7da; color: #721c24; }
        .status-info    { background: #d1ecf1; color: #0c5460; }
        .studio-preview {
          margin-top: 1rem; display: flex; flex-direction: column;
          gap: .8rem; align-items: flex-start;
        }
        .studio-preview img {
          max-width: 300px; border-radius: 10px;
          border: 1px solid #eee; box-shadow: 0 2px 8px rgba(0,0,0,.1);
        }
        .preview-label { color: #888; font-size: .85rem; margin: 0; }
      `}</style>
    </div>
  );
}
