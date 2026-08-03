// src/assessment/ItemBankTab.jsx
//
// 题库 — authoring for the shared test item bank (clf_placement_items).
//
// One bank feeds everything: 分班测试 intake, adaptive 测评, and the fixed
// tests teachers assemble. A question written here is immediately available
// to all three.
//
// Mounted in two places (same component):
//   /test/teacher, /teacher/assessment, /school-master/assessment  — 题库 tab
//   /admin                                                          — 题库 tab
//
// Writes go straight to the table; RLS (012) already limits that to teaching
// staff, so there is no privileged path here.
//
// AI: the shared AiFieldAssistant bar handles per-field fill and translation.
// Whole-question and bulk drafting go through askAIForJSON, the same
// ai-gateway the other admin tabs use — provider switchable.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { SKILLS, SKILL_LABELS, YCT_LABELS, YCT_MIN, YCT_MAX } from '../lib/placement.js';
import { askAIForJSON } from '../admin/lib/aiFields.js';
import AiFieldAssistant from '../admin/components/AiFieldAssistant.jsx';
import { speakChinese } from './QuizUI.jsx';
import RagGenerate from './RagGenerate.jsx';
import {
  Plus, Trash2, Pencil, Sparkles, Upload, Volume2, X, Check, RefreshCw, Wand2,
  Database,
} from 'lucide-react';

const ACCENT = '#c41e3a';
const INK    = '#1a0a05';
const MUTED  = '#a07850';
const KAI    = "'STKaiti','KaiTi',serif";
const BUCKET = 'placement-media';

// Providers the ai-gateway can route to. Claude is the default; the others are
// here because a provider's key can be missing or rejected on one site while
// the rest work — the gateway reports that per-provider, so let staff switch
// rather than be blocked.
const AI_PROVIDERS = [
  { id: 'claude',   label: 'Claude' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'openai',   label: 'GPT-4o' },
  { id: 'gemini',   label: 'Gemini' },
];

const BLANK = {
  yct_level: 2, skill: 'vocab', prompt: '', prompt_hint: '',
  audio_text: '', audio_url: '', image_url: '', video_url: '',
  options: ['', '', '', ''], options_kind: 'text', correct_index: 0, active: true,
};

// Field spec for the per-field ✨ bar. Options and the answer are structured,
// so they stay out of it — whole-question drafting handles those.
const AI_ITEM_FIELDS = [
  { key: 'prompt',      label: '题干',   hint: 'the question as a child reads it, in Simplified Chinese, one line, no answer options inside it' },
  { key: 'prompt_hint', label: '提示',   hint: 'a short hint under the question — pinyin or a one-word category. Leave empty if the question needs none' },
  { key: 'audio_text',  label: '听力文本', hint: 'for a listening question only: the exact Chinese text to be spoken aloud, no punctuation, otherwise empty' },
];

/**
 * `rag` enables the corpus-grounded generation panel. It's passed only where
 * the tab is mounted in /admin — teachers author questions by hand or from a
 * topic; drafting from the school's uploaded material is an admin job because
 * it writes items carrying a claim about what the textbook says.
 */
export default function ItemBankTab({ rag = false }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [fLevel,  setFLevel]  = useState('');
  const [fSkill,  setFSkill]  = useState('');
  const [search,  setSearch]  = useState('');
  const [editing, setEditing] = useState(null);   // item object or BLANK
  const [bulk,    setBulk]    = useState(false);
  const [ragOpen, setRagOpen] = useState(false);
  const [msg,     setMsg]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('clf_placement_items')
      .select('*')
      .order('yct_level').order('skill').order('sort_order');
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const visible = items.filter(i =>
    (fLevel === '' || i.yct_level === Number(fLevel)) &&
    (fSkill === '' || i.skill === fSkill) &&
    (search === '' || (i.prompt || '').includes(search)
                   || (i.options || []).some(o => String(o).includes(search))));

  const remove = async (item) => {
    if (!window.confirm(`删除这道题？\n\n${item.prompt}`)) return;
    const { error } = await supabase.from('clf_placement_items').delete().eq('id', item.id);
    if (error) { flash(`删除失败：${error.message}`); return; }
    setItems(p => p.filter(x => x.id !== item.id));
    flash('已删除');
  };

  const toggleActive = async (item) => {
    const { error } = await supabase.from('clf_placement_items')
      .update({ active: !item.active }).eq('id', item.id);
    if (error) { flash(error.message); return; }
    setItems(p => p.map(x => x.id === item.id ? { ...x, active: !x.active } : x));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: INK, fontFamily: KAI, flex: 1 }}>
          题库 <span style={{ fontSize: 12, color: MUTED, fontWeight: 400 }}>
            {items.length} 题 · 分班测试与学生测评共用
          </span>
        </h2>
        <button onClick={load} style={ghostBtn}><RefreshCw size={13}/> 刷新</button>
        <button onClick={() => setBulk(v => !v)} style={ghostBtn}><Wand2 size={13}/> 批量生成</button>
        {rag && (
          <button onClick={() => setRagOpen(v => !v)} style={ghostBtn}>
            <Database size={13}/> 从教材生成
          </button>
        )}
        <button onClick={() => setEditing({ ...BLANK })} style={primaryBtn}><Plus size={14}/> 新建题目</button>
      </div>

      {msg && <Banner>{msg}</Banner>}

      {rag && ragOpen && (
        <RagGenerate
          onClose={() => setRagOpen(false)}
          onSaved={(n) => { setRagOpen(false); load(); flash(`已从教材保存 ${n} 道题`); }}
        />
      )}

      {bulk && (
        <BulkGenerate
          onClose={() => setBulk(false)}
          onSaved={(n) => { setBulk(false); load(); flash(`已保存 ${n} 道题`); }}
        />
      )}

      {editing && (
        <ItemEditor
          item={editing}
          onCancel={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setEditing(null);
            setItems(p => isNew ? [saved, ...p] : p.map(x => x.id === saved.id ? saved : x));
            flash(isNew ? '已新建' : '已保存');
          }}
        />
      )}

      {/* filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={fLevel} onChange={e => setFLevel(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="">全部等级</option>
          {levels().map(l => <option key={l} value={l}>{YCT_LABELS[l]}</option>)}
        </select>
        <select value={fSkill} onChange={e => setFSkill(e.target.value)} style={{ ...input, width: 'auto' }}>
          <option value="">全部技能</option>
          {SKILLS.map(s => <option key={s} value={s}>{SKILL_LABELS[s]}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索题干或选项" style={{ ...input, width: 200 }}/>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, color: MUTED, alignSelf: 'center' }}>显示 {visible.length} 题</div>
      </div>

      {loading ? <Empty>加载中…</Empty>
       : visible.length === 0 ? <Empty>没有符合条件的题目</Empty> : (
        <div style={{ display: 'grid', gap: 6 }}>
          {visible.map(it => (
            <div key={it.id} style={{
              background: '#fff', border: '1px solid #e8d5b0', borderRadius: 10,
              padding: 10, display: 'flex', gap: 10, alignItems: 'flex-start',
              opacity: it.active ? 1 : .55,
            }}>
              <span style={{ fontSize: 11, color: MUTED, minWidth: 74, paddingTop: 2 }}>
                YCT{it.yct_level} · {SKILL_LABELS[it.skill] || it.skill}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: INK }}>{it.prompt}</div>
                {it.options_kind === 'image' ? (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    {(it.options || []).map((o, i) => (
                      <img key={i} src={o} alt="" style={{
                        width: 34, height: 34, objectFit: 'contain', borderRadius: 5,
                        background: '#fff',
                        border: `2px solid ${i === it.correct_index ? '#217a41' : '#e8d5b0'}`,
                      }}/>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                    {(it.options || []).map((o, i) => (
                      <span key={i} style={{
                        marginRight: 10,
                        color: i === it.correct_index ? '#217a41' : MUTED,
                        fontWeight: i === it.correct_index ? 600 : 400,
                      }}>{i === it.correct_index ? '✓ ' : ''}{o}</span>
                    ))}
                  </div>
                )}
                {(it.audio_text || it.image_url || it.video_url || it.audio_url) && (
                  <div style={{ fontSize: 10, color: '#c9a06a', marginTop: 3 }}>
                    {it.audio_text && `🔊 ${it.audio_text}  `}
                    {it.audio_url && '🎵 音频  '}
                    {it.image_url && '🖼 图片  '}
                    {it.video_url && '🎬 视频'}
                  </div>
                )}
                {it.origin === 'ai_rag' && it.source_quote && (
                  <div style={{ fontSize: 10, color: '#8a6a45', marginTop: 3,
                    borderLeft: '2px solid #e8d5b0', paddingLeft: 6 }}>
                    教材依据：{String(it.source_quote).slice(0, 120)}
                  </div>
                )}
              </div>
              {it.audio_text && (
                <button onClick={() => speakChinese(it.audio_text, it.audio_url)}
                  title="试听" style={iconBtn}><Volume2 size={14}/></button>
              )}
              <button onClick={() => toggleActive(it)} title={it.active ? '停用' : '启用'}
                style={iconBtn}>{it.active ? <Check size={14}/> : <X size={14}/>}</button>
              <button onClick={() => setEditing({ ...it, options: [...(it.options || [])] })}
                title="编辑" style={iconBtn}><Pencil size={14}/></button>
              <button onClick={() => remove(it)} title="删除"
                style={{ ...iconBtn, color: ACCENT }}><Trash2 size={14}/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────────

function ItemEditor({ item, onCancel, onSaved }) {
  const [f,       setF]       = useState(item);
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [drafting, setDrafting] = useState(false);
  const [topic,   setTopic]   = useState('');
  const [provider, setProvider] = useState('claude');
  const isNew = !item.id;

  const set = (patch) => setF(prev => ({ ...prev, ...patch }));
  const setOpt = (i, v) => setF(prev => {
    const options = [...prev.options];
    options[i] = v;
    return { ...prev, options };
  });

  // ── AI: draft the whole question ───────────────────────────────────
  const draft = async () => {
    if (!topic.trim()) { setErr('请先填写要考的知识点'); return; }
    setDrafting(true); setErr('');
    try {
      const json = await askAIForJSON({
        prompt: wholeQuestionPrompt({ topic: topic.trim(), level: f.yct_level, skill: f.skill, count: 1 }),
        provider,
        maxTokens: 900,
      });
      const q = Array.isArray(json) ? json[0] : (json.questions?.[0] || json);
      applyDraft(q, set);
    } catch (e) {
      setErr(e.message || String(e));
    }
    setDrafting(false);
  };

  const save = async () => {
    const opts = f.options.map(o => (o || '').trim()).filter(Boolean);
    if (!f.prompt.trim())  { setErr('请填写题干'); return; }
    if (opts.length < 2)   {
      setErr(f.options_kind === 'image' ? '至少需要两张图片' : '至少需要两个选项');
      return;
    }
    if (f.correct_index >= opts.length) { setErr('正确答案指向了空选项'); return; }
    if (f.skill === 'listening' && !f.audio_text.trim() && !f.audio_url) {
      setErr('听力题需要听力文本或音频文件'); return;
    }
    setSaving(true); setErr('');

    const row = {
      yct_level: f.yct_level, skill: f.skill,
      prompt: f.prompt.trim(), prompt_hint: f.prompt_hint.trim() || null,
      audio_text: f.audio_text.trim() || null,
      audio_url: f.audio_url || null, image_url: f.image_url || null,
      video_url: f.video_url || null,
      options: opts, options_kind: f.options_kind || 'text',
      correct_index: f.correct_index, active: f.active,
    };
    const q = isNew
      ? supabase.from('clf_placement_items').insert(row).select().single()
      : supabase.from('clf_placement_items').update(row).eq('id', item.id).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onSaved(data, isNew);
  };

  return (
    <Panel>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ flex: 1, fontSize: 14, color: INK, fontWeight: 600 }}>
          {isNew ? '新建题目' : '编辑题目'}
        </div>
        <button onClick={onCancel} style={iconBtn}><X size={16}/></button>
      </div>

      {/* AI whole-question drafting */}
      <div style={{ background: '#fff8ec', border: '1px solid #e8d5b0', borderRadius: 10,
        padding: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>
          <Sparkles size={11}/> 让 AI 起草整道题 — 填写要考的知识点，等级和技能用下面的选择
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={topic} onChange={e => setTopic(e.target.value)} style={{ ...input, flex: 1 }}
            placeholder="例：量词 个/只/本  ·  颜色词  ·  把字句"/>
          <select value={provider} onChange={e => setProvider(e.target.value)}
            style={{ ...input, width: 'auto' }}>
            {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button onClick={draft} disabled={drafting} style={primaryBtn}>
            {drafting ? '生成中…' : '生成'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10,
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Field label="等级">
          <select value={f.yct_level} onChange={e => set({ yct_level: Number(e.target.value) })} style={input}>
            {levels().map(l => <option key={l} value={l}>{YCT_LABELS[l]}</option>)}
          </select>
        </Field>
        <Field label="技能">
          <select value={f.skill} onChange={e => set({ skill: e.target.value })} style={input}>
            {SKILLS.map(s => <option key={s} value={s}>{SKILL_LABELS[s]}</option>)}
          </select>
        </Field>
      </div>

      <Field label="题干 *">
        <textarea value={f.prompt} onChange={e => set({ prompt: e.target.value })}
          rows={2} style={{ ...input, resize: 'vertical' }}/>
      </Field>
      <Field label="提示（拼音或分类，可留空）">
        <input value={f.prompt_hint} onChange={e => set({ prompt_hint: e.target.value })} style={input}/>
      </Field>

      <AiFieldAssistant
        values={{ prompt: f.prompt, prompt_hint: f.prompt_hint, audio_text: f.audio_text }}
        onPatch={patch => set(patch)}
        context={`a YCT ${f.yct_level} ${f.skill} test question for a child learning Chinese`}
        generate={{ subject: topic || f.prompt, fields: AI_ITEM_FIELDS }}
        compact
      />

      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: MUTED, flex: 1 }}>
            选项 — 点圆点标记正确答案（题目显示时会自动打乱顺序）
          </div>
          {[{ k: 'text', label: '文字选项' }, { k: 'image', label: '图片选项' }].map(t => (
            <button key={t.k} onClick={() => {
              if (f.options_kind === t.k) return;
              // Text labels are not image URLs and vice versa — carrying them
              // across would render broken <img> tags, so start the four slots
              // clean whenever the kind changes.
              set({ options_kind: t.k, options: ['', '', '', ''], correct_index: 0 });
            }} style={{
              padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
              background: f.options_kind === t.k ? ACCENT : '#fff',
              color: f.options_kind === t.k ? '#fff' : MUTED,
              border: `1px solid ${f.options_kind === t.k ? ACCENT : '#e8d5b0'}`,
            }}>{t.label}</button>
          ))}
        </div>
        {f.options_kind === 'image' && (
          <div style={{ fontSize: 11, color: '#8a6a45', marginBottom: 8 }}>
            孩子看图选答案，不需要认字。题干通常用听力：把要读的词写进下面的「听力文本」。
          </div>
        )}
        {f.options.map((o, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <button
              onClick={() => set({ correct_index: i })}
              title="标记为正确答案"
              style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                border: `2px solid ${f.correct_index === i ? '#217a41' : '#e8d5b0'}`,
                background: f.correct_index === i ? '#217a41' : '#fff',
              }}
            />
            {f.options_kind === 'image' ? (
              <OptionImage index={i} value={o} onChange={v => setOpt(i, v)}/>
            ) : (
              <input value={o} onChange={e => setOpt(i, e.target.value)} style={input}
                placeholder={`选项 ${i + 1}`}/>
            )}
          </div>
        ))}
      </div>

      <Field label="听力文本（听力题：朗读的内容，不含标点）">
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={f.audio_text} onChange={e => set({ audio_text: e.target.value })} style={input}/>
          <button onClick={() => speakChinese(f.audio_text, f.audio_url)}
            disabled={!f.audio_text && !f.audio_url} style={ghostBtn}>
            <Volume2 size={13}/> 试听
          </button>
        </div>
      </Field>

      <MediaField label="图片" kind="image" value={f.image_url} onChange={v => set({ image_url: v })}/>
      <MediaField label="音频文件（留空则用上面的听力文本实时朗读）" kind="audio"
        value={f.audio_url} onChange={v => set({ audio_url: v })}/>
      <MediaField label="视频（上传文件，或粘贴 YouTube / Bilibili / .mp4 链接）" kind="video"
        value={f.video_url} onChange={v => set({ video_url: v })}/>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
        color: MUTED, marginTop: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.active} onChange={e => set({ active: e.target.checked })}/>
        启用（停用后不会再出现在测试中）
      </label>

      {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={save} disabled={saving} style={primaryBtn}>
          {saving ? '保存中…' : '保存'}
        </button>
        <button onClick={onCancel} style={ghostBtn}>取消</button>
      </div>
    </Panel>
  );
}

// ── Media: upload a file or paste a link ─────────────────────────────

const ACCEPT = { image: 'image/*', audio: 'audio/*', video: 'video/*' };

function MediaField({ label, kind, value, onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setErr('');
    // Name by timestamp, not by the original filename — Chinese filenames and
    // spaces break the public URL.
    const ext  = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) {
      setErr(error.message.includes('Bucket not found')
        ? `存储桶 ${BUCKET} 不存在 — 请先执行 015 迁移或在 Supabase 面板创建`
        : error.message);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    onChange(data.publicUrl);
    setBusy(false);
  };

  return (
    <Field label={label}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={value || ''} onChange={e => onChange(e.target.value)} style={input}
          placeholder="粘贴链接，或点右边上传"/>
        <input ref={fileRef} type="file" accept={ACCEPT[kind]} style={{ display: 'none' }}
          onChange={e => upload(e.target.files?.[0])}/>
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={ghostBtn}>
          <Upload size={13}/> {busy ? '上传中…' : '上传'}
        </button>
        {value && <button onClick={() => onChange('')} style={iconBtn}><X size={14}/></button>}
      </div>
      {err && <div style={{ color: ACCENT, fontSize: 11, marginTop: 4 }}>{err}</div>}
      {value && kind === 'image' && (
        <img src={value} alt="" style={{ maxHeight: 90, marginTop: 6, borderRadius: 6 }}/>
      )}
      {value && kind === 'audio' && (
        <audio src={value} controls style={{ marginTop: 6, height: 30, width: '100%' }}/>
      )}
      {value && kind === 'video' && (
        <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
          {isEmbed(value) ? '将以嵌入播放器显示' : '将以视频播放器显示'}
        </div>
      )}
    </Field>
  );
}

/** One picture option: upload a file or paste a URL, with a thumbnail. */
function OptionImage({ index, value, onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');

  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setErr('');
    const ext  = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `option/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) {
      setErr(error.message.includes('Bucket not found')
        ? `存储桶 ${BUCKET} 不存在 — 请先执行 015 迁移`
        : error.message);
      setBusy(false);
      return;
    }
    onChange(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    setBusy(false);
  };

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {value ? (
          <img src={value} alt="" style={{
            width: 44, height: 44, objectFit: 'contain', flexShrink: 0,
            border: '1px solid #e8d5b0', borderRadius: 6, background: '#fff',
          }}/>
        ) : (
          <div style={{
            width: 44, height: 44, flexShrink: 0, borderRadius: 6,
            border: '1px dashed #e8d5b0', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#c9b08a', fontSize: 11,
          }}>{index + 1}</div>
        )}
        <input value={value} onChange={e => onChange(e.target.value)} style={input}
          placeholder={`图片 ${index + 1} — 粘贴链接或上传`}/>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => upload(e.target.files?.[0])}/>
        <button onClick={() => fileRef.current?.click()} disabled={busy} style={ghostBtn}>
          <Upload size={13}/> {busy ? '…' : '上传'}
        </button>
      </div>
      {err && <div style={{ color: ACCENT, fontSize: 11, marginTop: 3 }}>{err}</div>}
    </div>
  );
}

export function isEmbed(url = '') {
  return /youtube\.com|youtu\.be|bilibili\.com|vimeo\.com/i.test(url);
}

// ── Bulk generation ──────────────────────────────────────────────────

function BulkGenerate({ onClose, onSaved }) {
  const [level, setLevel] = useState(2);
  const [skill, setSkill] = useState('vocab');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [provider, setProvider] = useState('claude');
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState('');
  const [draft, setDraft] = useState([]);      // [{ ...question, keep:bool }]
  const [saving, setSaving] = useState(false);

  const run = async () => {
    setBusy(true); setErr(''); setDraft([]);
    try {
      const json = await askAIForJSON({
        prompt: wholeQuestionPrompt({ topic: topic.trim() || '综合', level, skill, count }),
        provider,
        maxTokens: 400 * count + 400,
      });
      const arr = Array.isArray(json) ? json : (json.questions || []);
      if (!arr.length) throw new Error('AI 没有返回题目，换个说法再试一次');
      setDraft(arr.map(q => ({ ...normalise(q), keep: true })));
    } catch (e) {
      setErr(e.message || String(e));
    }
    setBusy(false);
  };

  const saveKept = async () => {
    const rows = draft.filter(d => d.keep).map(d => ({
      yct_level: level, skill,
      prompt: d.prompt, prompt_hint: d.prompt_hint || null,
      audio_text: d.audio_text || null,
      options: d.options, correct_index: d.correct_index, active: true,
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
          <Wand2 size={14}/> 批量生成
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>
            {' '}· AI 起草，保存前请逐题过目
          </span>
        </div>
        <button onClick={onClose} style={iconBtn}><X size={16}/></button>
      </div>

      <div style={{ display: 'grid', gap: 10,
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
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
        <Field label="知识点（可留空）">
          <input value={topic} onChange={e => setTopic(e.target.value)} style={input}
            placeholder="例：家庭成员"/>
        </Field>
        <Field label="AI 模型">
          <select value={provider} onChange={e => setProvider(e.target.value)} style={input}>
            {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={run} disabled={busy} style={primaryBtn}>
          {busy ? '生成中…' : `生成 ${count} 道题`}
        </button>
      </div>
      {err && <div style={{ color: ACCENT, fontSize: 12, marginTop: 8 }}>{err}</div>}

      {draft.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: MUTED, margin: '14px 0 6px' }}>
            取消勾选不想要的题目。✓ 标记的是正确答案。
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
                  {d.audio_text && (
                    <div style={{ fontSize: 10, color: '#c9a06a', marginTop: 3 }}>🔊 {d.audio_text}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={saveKept} disabled={saving} style={primaryBtn}>
              {saving ? '保存中…' : `保存选中的 ${draft.filter(d => d.keep).length} 道题`}
            </button>
            <button onClick={() => setDraft([])} style={ghostBtn}>清空</button>
          </div>
        </>
      )}
    </Panel>
  );
}

// ── AI prompt + response handling ────────────────────────────────────

function wholeQuestionPrompt({ topic, level, skill, count }) {
  const YCT_SCOPE = {
    1: 'YCT 1 — about 80 words. Greetings, numbers 1-10, family, simple nouns like 猫 书 水.',
    2: 'YCT 2 — about 150 words. Time, weekdays, colours, body, school, 喜欢/想/会, measure words.',
    3: 'YCT 3 — about 300 words. Comparison 比, 正在, 已经, 因为…所以, the complement 得.',
    4: 'YCT 4 — about 600 words. 虽然…但是, 不但…而且, 把, 被, 如果, 除了…以外.',
  };
  const SKILL_SHAPE = {
    vocab:     'a vocabulary question — pinyin recognition, or picking the word that belongs to a category.',
    listening: 'a listening question. Put the sentence to be spoken in audio_text (no punctuation) and make the prompt an instruction like 听录音，选出你听到的句子。',
    reading:   'a short reading question: give a sentence in the prompt, then ask about it.',
    grammar:   'a grammar question — fill the blank, written with ＿ for the gap.',
  };
  return `You are an experienced teacher of Chinese to young foreign learners, writing questions for a YCT placement and evaluation test.

Write ${count} multiple-choice question${count > 1 ? 's' : ''}.

Level: ${YCT_SCOPE[level]}
Skill: ${SKILL_SHAPE[skill]}
Topic: ${topic}

Hard rules:
- Everything the child reads must be in Simplified Chinese. Do NOT rely on English or Italian — the same question is used for learners of both, so a question that needs an English gloss is unusable.
- Exactly 4 options. Exactly one correct.
- The three wrong options must be plausible to a child at this level, not absurd.
- Stay inside the vocabulary of the stated level.
- correct_index is the 0-based index of the right option.
- audio_text only for listening questions, otherwise "".
- prompt_hint is optional; use "" when the question needs none.

Return ONLY a JSON array, no prose, no markdown fence:
[
  {
    "prompt": "…",
    "prompt_hint": "",
    "audio_text": "",
    "options": ["…","…","…","…"],
    "correct_index": 0
  }
]`;
}

/** Coerce whatever the model returned into our shape. */
function normalise(q = {}) {
  const options = Array.isArray(q.options) ? q.options.map(String) : [];
  let ci = Number.isInteger(q.correct_index) ? q.correct_index : 0;
  if (ci < 0 || ci >= options.length) ci = 0;
  return {
    prompt:      String(q.prompt || '').trim(),
    prompt_hint: String(q.prompt_hint || '').trim(),
    audio_text:  String(q.audio_text || '').trim(),
    options,
    correct_index: ci,
  };
}

function applyDraft(q, set) {
  const n = normalise(q);
  set({
    prompt: n.prompt,
    prompt_hint: n.prompt_hint,
    audio_text: n.audio_text,
    options: [0, 1, 2, 3].map(i => n.options[i] || ''),
    correct_index: n.correct_index,
  });
}

// ── Bits ─────────────────────────────────────────────────────────────

const levels = () => Array.from({ length: YCT_MAX - YCT_MIN + 1 }, (_, i) => YCT_MIN + i);

const Panel = ({ children }) => (
  <div style={{ background: '#fff', border: '1px solid #e8d5b0', borderRadius: 12,
    padding: 14, marginBottom: 14 }}>{children}</div>
);

const Banner = ({ children }) => (
  <div style={{ background: '#eefaf0', border: '1px solid #b7e2c4', color: '#217a41',
    padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12 }}>{children}</div>
);

const Field = ({ label, children }) => (
  <label style={{ display: 'block', marginTop: 8 }}>
    <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
    {children}
  </label>
);

const Empty = ({ children }) => (
  <div style={{ background: '#fff', padding: 26, borderRadius: 12,
    border: '1px dashed #e8d5b0', textAlign: 'center', color: MUTED }}>{children}</div>
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
