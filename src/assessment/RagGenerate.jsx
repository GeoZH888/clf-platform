// src/assessment/RagGenerate.jsx
//
// Draft test questions from the school's own teaching material.
//
// Admin-only surface. The plain 批量生成 in 题库 asks the model to invent
// questions from a topic string; this one retrieves passages from the RAG
// corpus first and asks it to write questions *about those passages*. The
// result is questions that match what the school actually teaches, and each
// saved item keeps the passage it came from (source_quote) so a reviewer can
// check the question against its source.
//
// Pipeline:
//   topic → rag-search (voyage-3 embedding → match_chunks) → passages
//         → ai-gateway with the passages as context → draft questions
//         → staff review → clf_placement_items with source_id + source_quote
//
// Needs a populated corpus. Upload material in /admin → 语料库 RAG first;
// with no documents the retrieve step returns nothing and says so.

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { askAIForJSON } from '../admin/lib/aiFields.js';
import { SKILLS, SKILL_LABELS, YCT_LABELS, YCT_MIN, YCT_MAX } from '../lib/placement.js';
import { Database, Search, Wand2, X } from 'lucide-react';

const ACCENT = '#c41e3a';
const INK    = '#1a0a05';
const MUTED  = '#a07850';

const AI_PROVIDERS = [
  { id: 'claude',   label: 'Claude' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'openai',   label: 'GPT-4o' },
  { id: 'gemini',   label: 'Gemini' },
];

export default function RagGenerate({ onClose, onSaved }) {
  const [sources,  setSources]  = useState([]);
  const [sourceId, setSourceId] = useState('');
  const [topic,    setTopic]    = useState('');
  const [level,    setLevel]    = useState(2);
  const [skill,    setSkill]    = useState('reading');
  const [count,    setCount]    = useState(5);
  const [provider, setProvider] = useState('claude');

  const [chunks,   setChunks]   = useState(null);   // null = not searched yet
  const [draft,    setDraft]    = useState([]);
  const [busy,     setBusy]     = useState('');
  const [err,      setErr]      = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('content_sources')
        .select('id, filename, category, subcategory, status')
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(200);
      setSources(data || []);
    })();
  }, []);

  // ── 1. Retrieve ────────────────────────────────────────────────────
  const retrieve = async () => {
    if (!topic.trim()) { setErr('请填写要检索的知识点'); return; }
    setBusy('retrieve'); setErr(''); setChunks(null); setDraft([]);
    try {
      const res = await fetch('/.netlify/functions/rag-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: topic.trim(),
          match_count: 8,
          match_threshold: 0.3,
          synthesize: false,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      let got = json.chunks || [];
      // rag-search has no source_id filter, so narrow client-side when the
      // admin picked one document.
      if (sourceId) {
        got = got.filter(c => c.source_id === sourceId
                           || c.metadata?.source_id === sourceId);
      }
      setChunks(got);
      if (got.length === 0) {
        setErr(sources.length === 0
          ? '语料库还没有文档 — 请先在「语料库 RAG」上传教材'
          : '没有检索到相关内容，换个说法或放宽筛选再试');
      }
    } catch (e) {
      setErr(String(e.message || e));
    }
    setBusy('');
  };

  // ── 2. Generate from the retrieved passages ────────────────────────
  const generate = async () => {
    if (!chunks?.length) { setErr('请先检索教材内容'); return; }
    setBusy('generate'); setErr('');
    try {
      const json = await askAIForJSON({
        prompt: ragPrompt({ chunks, topic: topic.trim(), level, skill, count }),
        provider,
        maxTokens: 420 * count + 600,
      });
      const arr = Array.isArray(json) ? json : (json.questions || []);
      if (!arr.length) throw new Error('AI 没有返回题目，换个知识点再试一次');
      setDraft(arr.map(q => ({ ...normalise(q), keep: true })));
    } catch (e) {
      setErr(String(e.message || e));
    }
    setBusy('');
  };

  // ── 3. Save with provenance ────────────────────────────────────────
  const save = async () => {
    const rows = draft.filter(d => d.keep).map(d => ({
      yct_level: level, skill,
      prompt: d.prompt, prompt_hint: d.prompt_hint || null,
      audio_text: d.audio_text || null,
      options: d.options, options_kind: 'text',
      correct_index: d.correct_index,
      source_id: sourceId || firstSourceId(chunks) || null,
      source_quote: d.source_quote || null,
      origin: 'ai_rag',
      active: true,
    })).filter(r => r.prompt && r.options?.length >= 2);
    if (!rows.length) { setErr('没有选中的题目'); return; }
    setSaving(true); setErr('');
    const { error } = await supabase.from('clf_placement_items').insert(rows);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved(rows.length);
  };

  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ flex: 1, fontSize: 14, color: INK, fontWeight: 600 }}>
          <Database size={14}/> 从教材生成
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>
            {' '}· 先检索语料库，再让 AI 依据检索到的内容出题
          </span>
        </div>
        <button onClick={onClose} style={iconBtn}><X size={16}/></button>
      </div>

      {sources.length === 0 && (
        <div style={{ background: '#fff8ec', border: '1px solid #e8d5b0', borderRadius: 8,
          padding: 10, fontSize: 12, color: '#8a6a45', marginBottom: 10 }}>
          语料库里还没有已处理完成的文档。先到「语料库 RAG」上传教材并等待处理完成，
          这里才能检索到内容。
        </div>
      )}

      <div style={{ display: 'grid', gap: 10,
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Field label="限定文档（可留空 = 全部）">
          <select value={sourceId} onChange={e => setSourceId(e.target.value)} style={input}>
            <option value="">全部文档</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>
                {s.filename}{s.subcategory ? ` · ${s.subcategory}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="等级">
          <select value={level} onChange={e => setLevel(Number(e.target.value))} style={input}>
            {levels().map(l => <option key={l} value={l}>{YCT_LABELS[l]}</option>)}
          </select>
        </Field>
        <Field label="技能">
          <select value={skill} onChange={e => setSkill(e.target.value)} style={input}>
            {SKILLS.map(s => <option key={s} value={s}>{SKILL_LABELS[s]}</option>)}
          </select>
        </Field>
        <Field label="题目数量">
          <input type="number" min={1} max={20} value={count}
            onChange={e => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            style={input}/>
        </Field>
        <Field label="AI 模型">
          <select value={provider} onChange={e => setProvider(e.target.value)} style={input}>
            {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
      </div>

      <Field label="知识点 / 检索词 *">
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={topic} onChange={e => setTopic(e.target.value)} style={{ ...input, flex: 1 }}
            placeholder="例：量词的用法  ·  第三课 家庭成员  ·  把字句"/>
          <button onClick={retrieve} disabled={busy === 'retrieve'} style={ghostBtn}>
            <Search size={13}/> {busy === 'retrieve' ? '检索中…' : '检索教材'}
          </button>
        </div>
      </Field>

      {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>{err}</div>}

      {/* retrieved passages */}
      {chunks && chunks.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>
            检索到 {chunks.length} 段教材内容 — AI 只会依据这些内容出题
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e8d5b0',
            borderRadius: 8, background: '#fff' }}>
            {chunks.map((c, i) => (
              <div key={i} style={{ padding: '8px 10px', borderBottom: '1px solid #fdf6e3',
                fontSize: 12, color: '#5d4630' }}>
                <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>
                  {c.document_title || '文档'}
                  {c.similarity != null && ` · 相似度 ${Number(c.similarity).toFixed(2)}`}
                </div>
                {String(c.content || '').slice(0, 220)}
                {String(c.content || '').length > 220 ? '…' : ''}
              </div>
            ))}
          </div>
          <button onClick={generate} disabled={busy === 'generate'}
            style={{ ...primaryBtn, marginTop: 10 }}>
            <Wand2 size={14}/> {busy === 'generate' ? '生成中…' : `依据这些内容生成 ${count} 道题`}
          </button>
        </div>
      )}

      {/* drafts */}
      {draft.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: MUTED, margin: '14px 0 6px' }}>
            取消勾选不想要的题目。每题下方是它依据的教材原文，保存后仍可查。
          </div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
            {draft.map((d, i) => (
              <label key={i} style={{
                display: 'flex', gap: 8, padding: 9, cursor: 'pointer',
                background: d.keep ? '#fff8ec' : '#f6f0e4',
                border: '1px solid #e8d5b0', borderRadius: 8,
              }}>
                <input type="checkbox" checked={d.keep} style={{ marginTop: 3 }}
                  onChange={e => setDraft(p => p.map((x, j) =>
                    j === i ? { ...x, keep: e.target.checked } : x))}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: INK }}>{d.prompt}</div>
                  <div style={{ fontSize: 11, marginTop: 3 }}>
                    {(d.options || []).map((o, k) => (
                      <span key={k} style={{
                        marginRight: 10,
                        color: k === d.correct_index ? '#217a41' : MUTED,
                        fontWeight: k === d.correct_index ? 600 : 400,
                      }}>{k === d.correct_index ? '✓ ' : ''}{o}</span>
                    ))}
                  </div>
                  {d.source_quote && (
                    <div style={{ fontSize: 10, color: '#8a6a45', marginTop: 4,
                      borderLeft: '2px solid #e8d5b0', paddingLeft: 6 }}>
                      教材依据：{d.source_quote}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={save} disabled={saving} style={primaryBtn}>
              {saving ? '保存中…' : `保存选中的 ${draft.filter(d => d.keep).length} 道题`}
            </button>
            <button onClick={() => setDraft([])} style={ghostBtn}>清空</button>
          </div>
        </>
      )}
    </Panel>
  );
}

// ── Prompt ───────────────────────────────────────────────────────────

function ragPrompt({ chunks, topic, level, skill, count }) {
  const passages = chunks
    .map((c, i) => `[${i + 1}] ${String(c.content || '').slice(0, 1200)}`)
    .join('\n\n');

  const YCT_SCOPE = {
    1: 'YCT 1 — about 80 words. Greetings, numbers, family, simple concrete nouns.',
    2: 'YCT 2 — about 150 words. Time, weekdays, colours, school, 喜欢/想/会, measure words.',
    3: 'YCT 3 — about 300 words. 比, 正在, 已经, 因为…所以, the complement 得.',
    4: 'YCT 4 — about 600 words. 虽然…但是, 不但…而且, 把, 被, 如果, 除了…以外.',
  };

  return `You are an experienced teacher of Chinese to young foreign learners, writing YCT test questions grounded in this school's own teaching material.

Below are passages retrieved from that material for the topic "${topic}".

${passages}

Write ${count} multiple-choice question${count > 1 ? 's' : ''} that test what these passages teach.

Hard rules:
- Base every question on the passages above. Do not test vocabulary or grammar that does not appear in them.
- If the passages are too thin to support ${count} good questions, write fewer. Never pad with invented material.
- Target level: ${YCT_SCOPE[level]} If a passage is above that level, simplify what you test — do not exceed the level.
- Skill: ${skill}. For listening, put the sentence to be spoken in audio_text (no punctuation) and make the prompt an instruction.
- Everything the child reads must be in Simplified Chinese. The same question serves English- and Italian-speaking learners, so a question needing an English gloss is unusable.
- Exactly 4 options, exactly one correct, and the three wrong options must be plausible at this level.
- correct_index is the 0-based index of the right option.
- source_quote: the short sentence or phrase FROM THE PASSAGES the question is based on, copied verbatim. This is how a reviewer checks your work — never invent it.

Return ONLY a JSON array, no prose, no markdown fence:
[
  {
    "prompt": "…",
    "prompt_hint": "",
    "audio_text": "",
    "options": ["…","…","…","…"],
    "correct_index": 0,
    "source_quote": "…"
  }
]`;
}

function normalise(q = {}) {
  const options = Array.isArray(q.options) ? q.options.map(String) : [];
  let ci = Number.isInteger(q.correct_index) ? q.correct_index : 0;
  if (ci < 0 || ci >= options.length) ci = 0;
  return {
    prompt:       String(q.prompt || '').trim(),
    prompt_hint:  String(q.prompt_hint || '').trim(),
    audio_text:   String(q.audio_text || '').trim(),
    source_quote: String(q.source_quote || '').trim().slice(0, 500),
    options,
    correct_index: ci,
  };
}

function firstSourceId(chunks) {
  for (const c of chunks || []) {
    const id = c.source_id || c.metadata?.source_id;
    if (id) return id;
  }
  return null;
}

// ── Bits ─────────────────────────────────────────────────────────────

const levels = () => Array.from({ length: YCT_MAX - YCT_MIN + 1 }, (_, i) => YCT_MIN + i);

const Panel = ({ children }) => (
  <div style={{ background: '#fff', border: '1px solid #e8d5b0', borderRadius: 12,
    padding: 14, marginBottom: 14 }}>{children}</div>
);

const Field = ({ label, children }) => (
  <label style={{ display: 'block', marginTop: 8 }}>
    <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
    {children}
  </label>
);

const input = {
  width: '100%', padding: '8px 10px', fontSize: 13, color: INK,
  border: '1px solid #e8d5b0', borderRadius: 8, background: '#fff',
  boxSizing: 'border-box',
};

const primaryBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 14px', fontSize: 13, background: ACCENT, color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer',
};

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 12px', fontSize: 12, background: '#fdf6e3', color: MUTED,
  border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
};

const iconBtn = {
  background: 'transparent', border: 'none', color: MUTED,
  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
};
