// src/admin/WordsBatchGenerateModal.jsx
//
// AI batch-generation modal for clf_words.
// Mirrors the legacy WordsAdminTab.jsx generateWords() flow but in a
// self-contained modal that drops cleanly into CLFWordsAdminTab.jsx.
//
// Flow:
//   1. Admin picks theme + HSK level + count + AI provider
//   2. Click 🤖 生成 → calls /netlify/functions/ai-gateway with
//      action='generate_words'
//   3. Preview shows generated words as chips (click to deselect)
//   4. Click 💾 保存全部 → inserts selected words into clf_words
//   5. Optional: chain into BatchWordIllustrationModal for auto-illustration

import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

// Same THEMES/HSK list as the legacy WordsAdminTab so generated words
// land with valid metadata.
const THEMES = [
  { id: 'greetings', emoji: '👋', zh: '问候', en: 'Greetings' },
  { id: 'family',    emoji: '👨‍👩‍👧', zh: '家庭', en: 'Family' },
  { id: 'food',      emoji: '🍜', zh: '食物', en: 'Food' },
  { id: 'numbers',   emoji: '🔢', zh: '数字', en: 'Numbers' },
  { id: 'colors',    emoji: '🎨', zh: '颜色', en: 'Colors' },
  { id: 'body',      emoji: '👤', zh: '身体', en: 'Body' },
  { id: 'time',      emoji: '⏰', zh: '时间', en: 'Time' },
  { id: 'travel',    emoji: '✈️', zh: '出行', en: 'Travel' },
  { id: 'general',   emoji: '📚', zh: '通用', en: 'General' },
];

const HSK_LEVELS = [
  { id: 1, label: 'HSK 1', desc: '150词 · 基础' },
  { id: 2, label: 'HSK 2', desc: '300词 · 初级' },
  { id: 3, label: 'HSK 3', desc: '600词 · 初中级' },
  { id: 4, label: 'HSK 4', desc: '1200词 · 中级' },
  { id: 5, label: 'HSK 5', desc: '2500词 · 中高级' },
  { id: 6, label: 'HSK 6', desc: '5000词 · 高级' },
];

const PROVIDERS = [
  { id: 'claude',   label: '🤖 Claude' },
  { id: 'openai',   label: '⚡ GPT-4' },
  { id: 'gemini',   label: '✨ Gemini' },
  { id: 'deepseek', label: '🔍 DeepSeek' },
];

const COUNT_PRESETS = [5, 10, 15, 20, 30];

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  accent:'#2E7D32',
};

export default function WordsBatchGenerateModal({ existingWords, onClose, onSaved }) {
  const [theme,    setTheme]    = useState('food');
  const [hskLevel, setHsk]      = useState(1);
  const [count,    setCount]    = useState(10);
  const [provider, setProvider] = useState('claude');

  const [generating, setGenerating] = useState(false);
  const [preview,    setPreview]    = useState(null);   // [{word_zh, pinyin, ...}]
  const [excluded,   setExcluded]   = useState(new Set()); // chip indices admin deselected
  const [status,     setStatus]     = useState(null);
  const [saving,     setSaving]     = useState(false);

  // Build exclusion list from existing DB to avoid duplicates
  const existingZh = (existingWords || []).map(w => w.word_zh).filter(Boolean);

  async function generate() {
    setGenerating(true);
    setStatus({ kind: 'info', text: `生成中… (${provider}, HSK ${hskLevel}, ${count} 词)` });
    setPreview(null);
    setExcluded(new Set());

    try {
      const themeName = THEMES.find(t => t.id === theme);
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:    'generate_words',
          theme:     themeName?.en || theme,
          count,
          exclude:   existingZh,
          hsk_level: hskLevel,
          provider,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const words = data.words || data.result?.words || [];
      if (!Array.isArray(words) || words.length === 0) {
        throw new Error('AI 返回空或非数组. Raw: ' + JSON.stringify(data).slice(0, 200));
      }

      // Tag with current theme/hsk if AI didn't include them
      const tagged = words.map(w => ({
        word_zh:        w.word_zh    || w.word    || w.zh    || '',
        pinyin:         w.pinyin     || '',
        meaning_en:     w.meaning_en || w.en      || '',
        meaning_it:     w.meaning_it || w.it      || '',
        meaning_zh:     w.meaning_zh || w.cn      || '',
        example_zh:     w.example_zh || '',
        example_en:     w.example_en || '',
        example_it:     w.example_it || '',
        theme,
        hsk_level:      hskLevel,
        illustratable:  true,
      })).filter(w => w.word_zh);

      setPreview(tagged);
      setStatus({ kind: 'success', text: `✅ 生成 ${tagged.length} 个词. 检查后点保存` });
    } catch (err) {
      setStatus({ kind: 'error', text: '❌ ' + err.message });
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!preview?.length) return;
    setSaving(true);
    setStatus({ kind: 'info', text: '保存中…' });

    try {
      const toSave = preview.filter((_, i) => !excluded.has(i));
      if (toSave.length === 0) {
        setStatus({ kind: 'error', text: '所有词语都被排除了' });
        setSaving(false);
        return;
      }

      // Filter out duplicates one more time (race-safety)
      const stillNew = toSave.filter(w => !existingZh.includes(w.word_zh));
      if (stillNew.length === 0) {
        setStatus({ kind: 'error', text: '所有词语已存在' });
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.from('clf_words').insert(stillNew).select();
      if (error) throw error;

      setStatus({ kind: 'success', text: `✅ 已保存 ${data?.length || stillNew.length} 个词` });
      setTimeout(() => {
        onSaved?.(data || stillNew);
      }, 800);
    } catch (err) {
      setStatus({ kind: 'error', text: '❌ ' + err.message });
    } finally {
      setSaving(false);
    }
  }

  function toggleChip(i) {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const includedCount = preview ? preview.length - excluded.size : 0;

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={card} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={header}>
          <h3 style={{ margin: 0, fontSize: 16, color: V.accent }}>
            ✨ AI 批量生成词语
          </h3>
          <button onClick={onClose} style={closeBtn} aria-label="关闭">✕</button>
        </div>

        {/* Settings */}
        <div style={{ padding: 18, borderBottom: `1px solid ${V.border}` }}>
          <div style={{ fontSize: 12, color: V.text3, marginBottom: 10 }}>
            生成设置
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="主题">
              <select value={theme} onChange={e => setTheme(e.target.value)}
                style={input} disabled={generating}>
                {THEMES.map(t => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.zh} · {t.en}</option>
                ))}
              </select>
            </Field>
            <Field label="HSK 级别">
              <select value={hskLevel} onChange={e => setHsk(Number(e.target.value))}
                style={input} disabled={generating}>
                {HSK_LEVELS.map(h => (
                  <option key={h.id} value={h.id}>{h.label} — {h.desc}</option>
                ))}
              </select>
            </Field>
            <Field label="数量">
              <select value={count} onChange={e => setCount(Number(e.target.value))}
                style={input} disabled={generating}>
                {COUNT_PRESETS.map(n => <option key={n} value={n}>{n} 个词</option>)}
              </select>
            </Field>
            <Field label="AI 引擎">
              <select value={provider} onChange={e => setProvider(e.target.value)}
                style={input} disabled={generating}>
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ fontSize: 11, color: V.text3, marginBottom: 10 }}>
            将自动排除已存在的 {existingZh.length} 个词语
          </div>

          <button
            onClick={generate}
            disabled={generating}
            style={{
              ...btnPrimary,
              opacity: generating ? 0.5 : 1,
              cursor: generating ? 'not-allowed' : 'pointer',
              width: '100%',
            }}>
            {generating ? '⏳ 生成中…' : '🤖 生成'}
          </button>
        </div>

        {/* Status */}
        {status && (
          <div style={{
            padding: 10, margin: '12px 18px 0',
            background:
              status.kind === 'error'   ? '#FFEBEE' :
              status.kind === 'success' ? '#E8F5E9' : '#E3F2FD',
            color:
              status.kind === 'error'   ? '#c0392b' :
              status.kind === 'success' ? V.accent  : '#1565C0',
            borderRadius: 6, fontSize: 12,
          }}>
            {status.text}
          </div>
        )}

        {/* Preview */}
        {preview && preview.length > 0 && (
          <div style={{ padding: 18 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 10,
            }}>
              <div style={{ fontSize: 12, color: V.text3 }}>
                预览 — 点击词语可排除 ({includedCount} / {preview.length} 选中)
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {preview.map((w, i) => {
                const dup = existingZh.includes(w.word_zh);
                const out = excluded.has(i) || dup;
                return (
                  <button
                    key={i}
                    onClick={() => !dup && toggleChip(i)}
                    title={
                      dup ? '已存在 (跳过)' :
                      out ? '已排除 — 点击恢复' :
                      `${w.pinyin || ''} · ${w.meaning_en || ''}`
                    }
                    style={{
                      padding: '6px 10px', borderRadius: 14,
                      border: `1px solid ${out ? '#bbb' : V.accent}`,
                      background: dup ? '#FFEBEE' : out ? '#f5f5f5' : '#E8F5E9',
                      color: dup ? '#c0392b' : out ? '#999' : V.accent,
                      fontSize: 13, cursor: dup ? 'default' : 'pointer',
                      textDecoration: out ? 'line-through' : 'none',
                      fontFamily: "'STKaiti','KaiTi',Georgia,serif",
                    }}>
                    {w.word_zh}
                    {w.pinyin && (
                      <span style={{
                        fontSize: 10, marginLeft: 4, opacity: 0.7,
                        fontFamily: 'inherit',
                      }}>
                        {w.pinyin}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Save */}
            <button
              onClick={save}
              disabled={saving || includedCount === 0}
              style={{
                ...btnPrimary,
                width: '100%',
                opacity: (saving || includedCount === 0) ? 0.5 : 1,
                cursor: (saving || includedCount === 0) ? 'not-allowed' : 'pointer',
              }}>
              {saving ? '⏳ 保存中…' : `💾 保存 ${includedCount} 个词`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, color: V.text3,
        marginBottom: 4, fontWeight: 500,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 9999, padding: 16,
};
const card = {
  background: V.card, borderRadius: 12, width: '100%', maxWidth: 560,
  maxHeight: '92vh', overflow: 'auto',
  boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
};
const header = {
  padding: '14px 18px', borderBottom: `1px solid ${V.border}`,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const closeBtn = {
  background: 'transparent', border: 'none', fontSize: 18,
  cursor: 'pointer', color: '#999', padding: 4,
};
const input = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  borderRadius: 6, border: `1px solid ${V.border}`,
  boxSizing: 'border-box', background: V.card,
};
const btnPrimary = {
  padding: '10px 18px', background: V.accent, color: '#fff',
  border: 'none', borderRadius: 8,
  fontSize: 14, fontWeight: 500,
};
