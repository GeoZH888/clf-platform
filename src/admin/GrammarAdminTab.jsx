// src/admin/GrammarAdminTab.jsx
// Admin panel for managing clf_grammar_topics and clf_grammar_exercises.
// Replaces the legacy jgw_grammar_patterns-based UI.
//
// Layout (2 columns on desktop, stacked on mobile):
//   Left:  Topic list by level, with search + [+ new topic]
//   Right: Editor for selected topic + its exercises list

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import GrammarPointBatchPanel from './GrammarPointBatchPanel.jsx';

const V = {
  bg: '#fdf6e3', card: '#fff', border: '#e8d5b0',
  text: '#1a0a05', text2: '#6b4c2a', text3: '#a07850',
  accent: '#7B3F3F',   // 墨红 grammar theme
  accentLight: '#F5E8E8',
  green: '#2E7D32', orange: '#E65100', red: '#c62828',
};

const EMPTY_TOPIC = {
  id: '', title_zh: '', title_en: '', title_it: '',
  level: 1, order_idx: 0, explanation: '', examples: [],
};

const EMPTY_EXERCISE = {
  type: 'fill', difficulty: 0,
  question: '', options: null, answer: '', explanation: '',
};

export default function GrammarAdminTab() {
  const [topics, setTopics]       = useState([]);
  const [exercises, setExercises] = useState([]);   // only for selected topic
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selId, setSelId]         = useState(null);
  const [showBatch, setShowBatch] = useState(false);

  // Topic editor form
  const [topicForm, setTopicForm] = useState(EMPTY_TOPIC);
  const [savingTopic, setSavingTopic] = useState(false);
  const [topicFlash, setTopicFlash]   = useState(null);

  // Exercise editor modal
  const [exModal, setExModal] = useState(null);
  const [savingEx, setSavingEx] = useState(false);

  // ── Load topics ──
  const loadTopics = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clf_grammar_topics')
      .select('*')
      .order('level', { ascending: true })
      .order('order_idx', { ascending: true });
    if (error) console.warn('[grammar-admin]', error);
    setTopics(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadTopics(); }, [loadTopics]);

  // ── Load exercises when topic selected ──
  useEffect(() => {
    if (!selId) { setExercises([]); return; }
    (async () => {
      const { data } = await supabase
        .from('clf_grammar_exercises')
        .select('*')
        .eq('topic_id', selId)
        .order('difficulty', { ascending: true })
        .order('created_at', { ascending: true });
      setExercises(data || []);
    })();
  }, [selId]);

  // When a topic becomes selected, populate the form
  useEffect(() => {
    if (!selId) { setTopicForm(EMPTY_TOPIC); return; }
    const t = topics.find(t => t.id === selId);
    if (t) setTopicForm({
      id: t.id,
      title_zh: t.title_zh || '',
      title_en: t.title_en || '',
      title_it: t.title_it || '',
      level: t.level || 1,
      order_idx: t.order_idx || 0,
      explanation: t.explanation || '',
      examples: t.examples || [],
    });
  }, [selId, topics]);

  // Filter + group topics for left column
  const filtered = topics.filter(t => {
    if (!search) return true;
    const s = search.toLowerCase();
    return t.id.toLowerCase().includes(s)
      || (t.title_zh || '').includes(search)
      || (t.title_en || '').toLowerCase().includes(s);
  });
  const byLevel = {};
  filtered.forEach(t => { (byLevel[t.level] = byLevel[t.level] || []).push(t); });
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);

  // Exercise count per topic (for badge)
  const [exCounts, setExCounts] = useState({});
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clf_grammar_exercises')
        .select('topic_id');
      const c = {};
      (data || []).forEach(r => { c[r.topic_id] = (c[r.topic_id] || 0) + 1; });
      setExCounts(c);
    })();
  }, [selId, exercises.length]);  // refresh after save

  // ── TOPIC ACTIONS ──

  async function saveTopic() {
    if (!topicForm.id.trim()) {
      setTopicFlash({ type: 'error', msg: 'ID 不能为空（例如 ba_zi_ju）' });
      return;
    }
    if (!topicForm.title_zh.trim()) {
      setTopicFlash({ type: 'error', msg: '中文标题不能为空' });
      return;
    }
    setSavingTopic(true);
    const payload = {
      id: topicForm.id.trim(),
      title_zh: topicForm.title_zh.trim(),
      title_en: topicForm.title_en.trim() || null,
      title_it: topicForm.title_it.trim() || null,
      level: Number(topicForm.level) || 1,
      order_idx: Number(topicForm.order_idx) || 0,
      explanation: topicForm.explanation || null,
      examples: topicForm.examples || [],
    };
    const { error } = await supabase
      .from('clf_grammar_topics')
      .upsert(payload);
    if (error) {
      setTopicFlash({ type: 'error', msg: '保存失败: ' + error.message });
    } else {
      setTopicFlash({ type: 'success', msg: '已保存' });
      await loadTopics();
      setSelId(payload.id);
    }
    setSavingTopic(false);
  }

  async function deleteTopic() {
    if (!selId) return;
    if (!confirm(`永久删除「${topicForm.title_zh}」？\n所有相关题目和学生进度也会一起删除。`)) return;
    const { error } = await supabase
      .from('clf_grammar_topics')
      .delete()
      .eq('id', selId);
    if (error) {
      setTopicFlash({ type: 'error', msg: '删除失败: ' + error.message });
      return;
    }
    setSelId(null);
    await loadTopics();
  }

  function newTopic() {
    setSelId(null);
    setTopicForm(EMPTY_TOPIC);
    setTopicFlash(null);
  }

  // ── EXAMPLES EDITOR (inline JSON) ──
  function setExamplesRaw(raw) {
    try {
      const parsed = raw.trim() ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) throw new Error('Must be an array');
      setTopicForm(f => ({ ...f, examples: parsed }));
      setTopicFlash(null);
    } catch (e) {
      setTopicFlash({ type: 'warn', msg: 'JSON 无效: ' + e.message });
      // Still update the raw text so user can fix
    }
  }

  // ── EXERCISE ACTIONS ──

  async function saveExercise(form) {
    setSavingEx(true);
    const payload = {
      topic_id: selId,
      type: form.type,
      difficulty: Number(form.difficulty),
      question: form.question,
      options: form.type === 'choose'
        ? (Array.isArray(form.options) ? form.options : null)
        : null,
      answer: form.answer,
      explanation: form.explanation || null,
    };
    let res;
    if (form.id) {
      res = await supabase.from('clf_grammar_exercises')
        .update(payload).eq('id', form.id);
    } else {
      res = await supabase.from('clf_grammar_exercises')
        .insert(payload);
    }
    setSavingEx(false);
    if (res.error) {
      alert('保存失败: ' + res.error.message);
      return;
    }
    setExModal(null);
    // Reload exercises
    const { data } = await supabase
      .from('clf_grammar_exercises')
      .select('*')
      .eq('topic_id', selId)
      .order('difficulty', { ascending: true })
      .order('created_at', { ascending: true });
    setExercises(data || []);
  }

  async function deleteExercise(id) {
    if (!confirm('删除此题？')) return;
    const { error } = await supabase
      .from('clf_grammar_exercises').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    setExercises(exs => exs.filter(e => e.id !== id));
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr',
      gap: 12, padding: 12, background: V.bg, minHeight: 'calc(100vh - 120px)' }}>

      {/* ═══ LEFT: Topic list ═══ */}
      <div style={{ background: V.card, border: `1px solid ${V.border}`,
        borderRadius: 10, padding: 12, overflow: 'auto', maxHeight: 'calc(100vh - 140px)' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索语法点"
            style={{ flex: 1, padding: '5px 10px', fontSize: 12,
              border: `1px solid ${V.border}`, borderRadius: 6,
              boxSizing: 'border-box' }}/>
          <button onClick={newTopic} style={{
            padding: '5px 10px', fontSize: 12, background: V.accent, color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer' }}>+ 新</button>
        </div>
        <div style={{ fontSize: 11, color: V.text3, marginBottom: 6 }}>
          {topics.length} 个主题 · {Object.values(exCounts).reduce((a,b)=>a+b, 0)} 道题
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: V.text3 }}>加载中…</div>
        ) : levels.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: V.text3 }}>
            {topics.length === 0 ? '暂无语法点' : '无匹配结果'}
          </div>
        ) : levels.map(lvl => (
          <div key={lvl} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: V.accent, fontWeight: 500,
              margin: '4px 4px 4px', letterSpacing: 1,
              fontFamily: "'STKaiti','KaiTi',serif" }}>
              Level {lvl}
            </div>
            <div style={{ display: 'grid', gap: 3 }}>
              {byLevel[lvl].map(t => (
                <button key={t.id} onClick={() => setSelId(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 9px',
                    background: selId === t.id ? V.accent : 'transparent',
                    color:      selId === t.id ? '#fff'   : V.text,
                    border: `1px solid ${selId === t.id ? V.accent : V.border}`,
                    borderRadius: 5, cursor: 'pointer', textAlign: 'left',
                    fontSize: 12, width: '100%',
                  }}>
                  <span style={{ flex: 1,
                    fontFamily: "'STKaiti','KaiTi',serif", fontWeight: 500 }}>
                    {t.title_zh}
                  </span>
                  <span style={{ fontSize: 10,
                    opacity: selId === t.id ? 0.8 : 0.5 }}>
                    {exCounts[t.id] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ═══ RIGHT: Editor ═══ */}
      <div style={{ background: V.card, border: `1px solid ${V.border}`,
        borderRadius: 10, padding: 16, overflow: 'auto', maxHeight: 'calc(100vh - 140px)' }}>

        {/* Flash messages */}
        {topicFlash && (
          <div style={{
            padding: 8, marginBottom: 10, fontSize: 12, borderRadius: 6,
            background: topicFlash.type === 'success' ? '#E8F5E9'
                      : topicFlash.type === 'warn'    ? '#FFF8E1' : '#FFEBEE',
            color:      topicFlash.type === 'success' ? V.green
                      : topicFlash.type === 'warn'    ? V.orange : V.red,
          }}>
            {topicFlash.msg}
          </div>
        )}

        {/* AI 批量生成 — 只在新建模式显示 */}
        {!selId && (
          <>
            <button
              onClick={() => setShowBatch(s => !s)}
              style={{
                width: '100%', marginBottom: 12, padding: '8px 12px', fontSize: 12,
                background: showBatch ? V.accent : '#fff',
                color: showBatch ? '#fff' : V.text,
                border: `1px solid ${V.accent}`, borderRadius: 6, cursor: 'pointer',
                fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1,
              }}>
              {showBatch ? '✕ 关闭批量生成' : '🪄 AI 批量生成（推荐）'}
            </button>
            {showBatch && (
              <GrammarPointBatchPanel
                onSaved={() => { setShowBatch(false); loadTopics(); }}
              />
            )}
          </>
        )}

        <div style={{ fontSize: 12, color: V.text3, marginBottom: 10 }}>
          {selId ? '编辑语法点' : '新建语法点'}
        </div>

        {/* ── Topic form ── */}
        <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          <Row label="ID (slug)" hint="英文小写 + 下划线，如 ba_zi_ju">
            <input value={topicForm.id}
              onChange={e => setTopicForm(f => ({ ...f, id: e.target.value }))}
              placeholder="ba_zi_ju"
              disabled={!!selId}
              style={inputStyle(!!selId)}/>
          </Row>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Row label="中文标题 *">
              <input value={topicForm.title_zh}
                onChange={e => setTopicForm(f => ({ ...f, title_zh: e.target.value }))}
                placeholder="把字句"
                style={inputStyle()}/>
            </Row>
            <Row label="英文标题">
              <input value={topicForm.title_en}
                onChange={e => setTopicForm(f => ({ ...f, title_en: e.target.value }))}
                placeholder="Disposal: 把"
                style={inputStyle()}/>
            </Row>
            <Row label="意大利文标题">
              <input value={topicForm.title_it}
                onChange={e => setTopicForm(f => ({ ...f, title_it: e.target.value }))}
                placeholder="Frase con 把"
                style={inputStyle()}/>
            </Row>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Row label="级别 (1-5)">
              <select value={topicForm.level}
                onChange={e => setTopicForm(f => ({ ...f, level: Number(e.target.value) }))}
                style={inputStyle()}>
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Level {n}</option>)}
              </select>
            </Row>
            <Row label="级别内排序">
              <input type="number" value={topicForm.order_idx}
                onChange={e => setTopicForm(f => ({ ...f, order_idx: Number(e.target.value) }))}
                style={inputStyle()}/>
            </Row>
          </div>

          <Row label="讲解 (Markdown)" hint="支持 **bold**；换行用两个换行">
            <textarea value={topicForm.explanation}
              onChange={e => setTopicForm(f => ({ ...f, explanation: e.target.value }))}
              rows={6}
              placeholder="**结构**：主语 + 把 + 宾语 + 动词 + 补语/了/结果"
              style={{ ...inputStyle(), minHeight: 100, fontFamily: 'ui-monospace, monospace',
                fontSize: 12, resize: 'vertical' }}/>
          </Row>

          <Row label="例句 JSON" hint='[{"zh":"...", "pinyin":"...", "en":"...", "it":"..."}]'>
            <textarea
              defaultValue={JSON.stringify(topicForm.examples || [], null, 2)}
              onBlur={e => setExamplesRaw(e.target.value)}
              rows={6}
              style={{ ...inputStyle(), minHeight: 120, fontFamily: 'ui-monospace, monospace',
                fontSize: 11, resize: 'vertical' }}/>
          </Row>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveTopic} disabled={savingTopic} style={{
              flex: 1, padding: '8px', background: V.accent, color: '#fff',
              border: 'none', borderRadius: 6, cursor: savingTopic ? 'not-allowed' : 'pointer',
              opacity: savingTopic ? 0.5 : 1, fontSize: 13,
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2,
            }}>
              {savingTopic ? '保存中…' : '💾 保存'}
            </button>
            {selId && (
              <button onClick={deleteTopic} style={{
                padding: '8px 16px', background: V.card, color: V.red,
                border: `1px solid ${V.red}`, borderRadius: 6, cursor: 'pointer',
                fontSize: 12,
              }}>🗑 删除主题</button>
            )}
          </div>
        </div>

        {/* ── Exercises list ── */}
        {selId && (
          <div style={{ paddingTop: 16, borderTop: `1px dashed ${V.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: V.text, fontWeight: 500,
                fontFamily: "'STKaiti','KaiTi',serif" }}>
                练习题 · {exercises.length}
              </div>
              <button onClick={() => setExModal({ ...EMPTY_EXERCISE })}
                style={{ padding: '5px 12px', fontSize: 12, background: V.accent,
                  color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                + 新题
              </button>
            </div>

            {exercises.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: V.text3,
                background: V.bg, borderRadius: 6, fontSize: 12 }}>
                还没有题目
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 4 }}>
                {exercises.map(ex => <ExerciseRow key={ex.id} exercise={ex}
                  onEdit={() => setExModal(ex)}
                  onDelete={() => deleteExercise(ex.id)}/>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Exercise modal ═══ */}
      {exModal && (
        <ExerciseModal exercise={exModal}
          onClose={() => setExModal(null)}
          onSave={saveExercise}
          saving={savingEx}/>
      )}
    </div>
  );
}

// ── Row helper ─────────────────────────────────────────────────
function Row({ label, hint, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: V.text3, marginBottom: 3 }}>
        {label}
        {hint && <span style={{ marginLeft: 6, opacity: 0.7 }}>· {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function inputStyle(disabled) {
  return {
    width: '100%', padding: '6px 10px', fontSize: 12,
    border: `1px solid ${V.border}`, borderRadius: 6,
    background: disabled ? '#f5f0e8' : '#fff',
    color: disabled ? V.text3 : V.text,
    boxSizing: 'border-box', outline: 'none',
    fontFamily: 'inherit',
  };
}

// ── Exercise row ──────────────────────────────────────────────
function ExerciseRow({ exercise, onEdit, onDelete }) {
  const diffLabel = ['易', '中', '难'][exercise.difficulty];
  const diffColor = ['#2E7D32', '#E65100', '#c62828'][exercise.difficulty];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', background: V.bg,
      border: `1px solid ${V.border}`, borderRadius: 5,
      fontSize: 12,
    }}>
      <span style={{
        padding: '1px 6px', fontSize: 10,
        background: diffColor + '22', color: diffColor,
        borderRadius: 8, fontFamily: "'STKaiti','KaiTi',serif",
        minWidth: 20, textAlign: 'center',
      }}>{diffLabel}</span>
      <span style={{
        padding: '1px 6px', fontSize: 10,
        background: V.border, color: V.text2, borderRadius: 3,
      }}>{exercise.type === 'fill' ? '填' : '选'}</span>
      <span style={{ flex: 1,
        fontFamily: "'STKaiti','KaiTi',serif",
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {exercise.question}
      </span>
      <span style={{ fontSize: 10, color: V.text3 }}>
        → {exercise.answer}
      </span>
      <button onClick={onEdit} style={miniBtn}>编辑</button>
      <button onClick={onDelete} style={{ ...miniBtn, color: V.red, borderColor: '#FFCDD2' }}>删</button>
    </div>
  );
}

const miniBtn = {
  padding: '2px 8px', fontSize: 11,
  background: V.card, border: `1px solid ${V.border}`,
  borderRadius: 4, cursor: 'pointer', color: V.text2,
};

// ── Exercise edit modal ──────────────────────────────────────
function ExerciseModal({ exercise, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    ...exercise,
    options: exercise.options
      ? (Array.isArray(exercise.options) ? exercise.options : [])
      : ['', '', '', ''],
  });

  function updateOpt(i, val) {
    const next = [...(form.options || ['', '', '', ''])];
    next[i] = val;
    setForm(f => ({ ...f, options: next }));
  }

  function addOpt() {
    setForm(f => ({ ...f, options: [...(f.options || []), ''] }));
  }

  function removeOpt(i) {
    setForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }));
  }

  function submit() {
    if (!form.question.trim() || !form.answer.trim()) {
      alert('题面和答案不能为空');
      return;
    }
    if (form.type === 'choose') {
      const opts = (form.options || []).filter(o => o.trim());
      if (opts.length < 2) {
        alert('选择题至少需要 2 个选项');
        return;
      }
      if (!opts.includes(form.answer.trim())) {
        if (!confirm('答案不在选项列表中，确定保存？')) return;
      }
      onSave({ ...form, options: opts });
    } else {
      onSave({ ...form, options: null });
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 9999, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{
        background: V.card, borderRadius: 10, padding: 20,
        maxWidth: 500, width: '100%', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: V.accent,
          fontFamily: "'STKaiti','KaiTi',serif" }}>
          {exercise.id ? '编辑题目' : '新建题目'}
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Row label="类型">
              <select value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                style={inputStyle()}>
                <option value="fill">填空</option>
                <option value="choose">选择</option>
              </select>
            </Row>
            <Row label="难度">
              <select value={form.difficulty}
                onChange={e => setForm(f => ({ ...f, difficulty: Number(e.target.value) }))}
                style={inputStyle()}>
                <option value={0}>易</option>
                <option value={1}>中</option>
                <option value={2}>难</option>
              </select>
            </Row>
          </div>

          <Row label="题面" hint="填空用 ___ 标记空格">
            <textarea value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              rows={2}
              style={{ ...inputStyle(), fontFamily: "'STKaiti','KaiTi',serif", fontSize: 14 }}/>
          </Row>

          {form.type === 'choose' && (
            <Row label="选项" hint="点 + 添加更多">
              <div style={{ display: 'grid', gap: 4 }}>
                {(form.options || []).map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: V.text3, width: 20 }}>
                      {['A','B','C','D','E','F'][i] || i}
                    </span>
                    <input value={opt}
                      onChange={e => updateOpt(i, e.target.value)}
                      style={{ ...inputStyle(), flex: 1 }}/>
                    <button onClick={() => removeOpt(i)} style={miniBtn}>×</button>
                  </div>
                ))}
                <button onClick={addOpt} style={{ ...miniBtn, alignSelf: 'flex-start' }}>
                  + 添加选项
                </button>
              </div>
            </Row>
          )}

          <Row label="正确答案">
            <input value={form.answer}
              onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              style={{ ...inputStyle(), fontFamily: "'STKaiti','KaiTi',serif" }}/>
          </Row>

          <Row label="解析（可选）">
            <textarea value={form.explanation || ''}
              onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
              rows={2}
              style={inputStyle()}/>
          </Row>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button onClick={onClose} style={{
              padding: '6px 14px', background: V.card, color: V.text2,
              border: `1px solid ${V.border}`, borderRadius: 5, cursor: 'pointer',
              fontSize: 12,
            }}>取消</button>
            <button onClick={submit} disabled={saving} style={{
              padding: '6px 14px', background: V.accent, color: '#fff',
              border: 'none', borderRadius: 5, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1, fontSize: 12,
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2,
            }}>
              {saving ? '保存中…' : '💾 保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
