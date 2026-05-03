// src/admin/ScenarioAdminTab.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 场景对话 Admin Tab
// Manages clf_scenarios + clf_scenario_lines.
//   • List view with search/filter/publish toggle
//   • Create new scenario (modal)
//   • Edit dialogue lines (inline panel: add/delete/reorder/three-language text)
//   • Publish / unpublish toggle (gates student visibility)
//   • Delete (cascades to clf_scenario_lines)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  vermillion:'#8B4513',
};

const CATEGORIES = [
  { id: 'daily',   label: '日常 Daily' },
  { id: 'school',  label: '学校 School' },
  { id: 'family',  label: '家庭 Family' },
  { id: 'travel',  label: '出行 Travel' },
  { id: 'health',  label: '健康 Health' },
  { id: 'shop',    label: '购物 Shop' },
  { id: 'food',    label: '饮食 Food' },
  { id: 'other',   label: '其他 Other' },
];

const DIFFICULTIES = [
  { id: 1, label: '⭐ 入门 (HSK1)' },
  { id: 2, label: '⭐⭐ 基础 (HSK2-3)' },
  { id: 3, label: '⭐⭐⭐ 中级 (HSK3-4)' },
  { id: 4, label: '⭐⭐⭐⭐ 进阶 (HSK4+)' },
];

export default function ScenarioAdminTab() {
  const [scenarios, setScenarios] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('all');  // all | published | draft
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);   // open inline lines editor
  const [toast,     setToast]     = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('clf_scenarios')
      .select('*')
      .order('order_idx', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) flash('error', error.message);
    setScenarios(data || []);
    setLoading(false);
  }

  function flash(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function togglePublish(s) {
    const { error } = await supabase
      .from('clf_scenarios')
      .update({ is_published: !s.is_published })
      .eq('id', s.id);
    if (error) return flash('error', error.message);
    flash('ok', s.is_published ? '已下线' : '已发布 Published');
    load();
  }

  async function deleteScenario(s) {
    if (!confirm(`删除场景"${s.title_zh}"?\n所有对话行将一并删除。Cannot be undone.`)) return;
    const { error } = await supabase.from('clf_scenarios').delete().eq('id', s.id);
    if (error) return flash('error', error.message);
    flash('ok', '已删除 Deleted');
    load();
  }

  async function createScenario(form) {
    const { error } = await supabase.from('clf_scenarios').insert({
      slug:           form.slug,
      title_zh:       form.title_zh,
      title_en:       form.title_en,
      title_it:       form.title_it,
      summary_zh:     form.summary_zh || null,
      summary_en:     form.summary_en || null,
      summary_it:     form.summary_it || null,
      difficulty:     parseInt(form.difficulty),
      category:       form.category,
      cover_emoji:    form.cover_emoji || '💬',
      speaker_a_name: form.speaker_a_name || '小明',
      speaker_b_name: form.speaker_b_name || '老师',
      is_published:   false,
      order_idx:      scenarios.length,
    });
    if (error) throw new Error(error.message);
    flash('ok', '已创建 Created');
    setShowCreate(false);
    load();
  }

  // --- filtered list ---
  const list = scenarios.filter(s => {
    if (filter === 'published' && !s.is_published) return false;
    if (filter === 'draft'     &&  s.is_published) return false;
    if (search) {
      const q = search.toLowerCase();
      return (s.title_zh || '').toLowerCase().includes(q)
          || (s.title_en || '').toLowerCase().includes(q)
          || (s.slug     || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索 标题/slug · Search…"
          style={{ flex: 1, minWidth: 240, padding: '9px 12px', fontSize: 14,
            borderRadius: 8, border: `1px solid ${V.border}` }} />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding: '9px 12px', fontSize: 13, borderRadius: 8,
            border: `1px solid ${V.border}`, background: '#fff' }}>
          <option value="all">全部 All</option>
          <option value="published">已发布 Published</option>
          <option value="draft">草稿 Draft</option>
        </select>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '9px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            borderRadius: 8, border: 'none', background: V.vermillion, color: '#fdf6e3' }}>
          ➕ 新建场景
        </button>
        <button onClick={load} disabled={loading}
          style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer',
            borderRadius: 8, border: `1px solid ${V.border}`, background: V.bg }}>
          ↻
        </button>
      </div>

      <div style={{ fontWeight: 600, color: V.vermillion, fontSize: 13, marginBottom: 8 }}>
        场景列表 · Scenarios ({list.length})
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', color: V.text3, padding: 40 }}>加载中…</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', color: V.text3, padding: 40,
          background: V.card, borderRadius: 12, border: `1px dashed ${V.border}` }}>
          {search ? '没有匹配的场景' : '还没有场景 — 点击「➕ 新建场景」开始'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(s => (
            <ScenarioCard
              key={s.id} scenario={s}
              isOpen={editingId === s.id}
              onToggleEdit={() => setEditingId(editingId === s.id ? null : s.id)}
              onTogglePublish={() => togglePublish(s)}
              onDelete={() => deleteScenario(s)}
              onLinesUpdated={load}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateScenarioModal
          onClose={() => setShowCreate(false)}
          onSubmit={createScenario}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          padding: '10px 18px', borderRadius: 10,
          background: toast.type === 'ok' ? '#e8f5e9' : '#ffebee',
          color: toast.type === 'ok' ? '#1b5e20' : '#b71c1c',
          border: `1px solid ${toast.type === 'ok' ? '#a5d6a7' : '#ef9a9a'}`,
          fontSize: 13,
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

// ─── Single scenario card with inline lines editor ─────────────────────────
function ScenarioCard({ scenario, isOpen, onToggleEdit, onTogglePublish, onDelete, onLinesUpdated }) {
  return (
    <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>{scenario.cover_emoji || '💬'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: V.text }}>{scenario.title_zh}</span>
            <span style={{ fontSize: 12, color: V.text3 }}>{scenario.title_en} · {scenario.title_it}</span>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8,
              background: scenario.is_published ? '#e8f5e9' : '#fff3e0',
              color: scenario.is_published ? '#1b5e20' : '#e65100' }}>
              {scenario.is_published ? '已发布' : '草稿'}
            </span>
            {scenario.category && (
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8,
                background: '#e3f2fd', color: '#1565c0' }}>{scenario.category}</span>
            )}
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8,
              background: '#fff8e1', color: '#f57f17' }}>L{scenario.difficulty}</span>
          </div>
          {scenario.summary_zh && (
            <div style={{ fontSize: 12, color: V.text2, marginTop: 4 }}>{scenario.summary_zh}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onToggleEdit}
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer',
              borderRadius: 8, border: `1px solid ${V.border}`,
              background: isOpen ? V.vermillion : V.bg,
              color: isOpen ? '#fdf6e3' : V.text2 }}>
            {isOpen ? '收起' : '✎ 对话行'}
          </button>
          <button onClick={onTogglePublish}
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 8,
              border: `1px solid ${scenario.is_published ? '#a5d6a7' : V.border}`,
              background: scenario.is_published ? '#e8f5e9' : V.bg,
              color: scenario.is_published ? '#1b5e20' : V.text2 }}>
            {scenario.is_published ? '✓ 已发布' : '发布'}
          </button>
          <button onClick={onDelete}
            style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer',
              borderRadius: 8, border: '1px solid #FFCDD2', background: '#FFEBEE', color: '#C62828' }}>
            ✕
          </button>
        </div>
      </div>
      {isOpen && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${V.border}` }}>
          <ScenarioLinesEditor
            scenarioId={scenario.id}
            speakerA={scenario.speaker_a_name}
            speakerB={scenario.speaker_b_name}
            onUpdated={onLinesUpdated}
          />
        </div>
      )}
    </div>
  );
}

// ─── Inline editor for clf_scenario_lines ─────────────────────────────────
function ScenarioLinesEditor({ scenarioId, speakerA, speakerB, onUpdated }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadLines(); }, [scenarioId]);

  async function loadLines() {
    setLoading(true);
    const { data, error } = await supabase
      .from('clf_scenario_lines')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('line_order', { ascending: true });
    if (!error) setLines(data || []);
    setLoading(false);
  }

  async function addLine() {
    const nextOrder = (lines.length > 0 ? Math.max(...lines.map(l => l.line_order)) : 0) + 1;
    const { data, error } = await supabase
      .from('clf_scenario_lines')
      .insert({
        scenario_id: scenarioId,
        line_order:  nextOrder,
        speaker:     lines.length % 2 === 0 ? 'A' : 'B',
        text_zh:     '',
      })
      .select().single();
    if (error) return alert('添加失败: ' + error.message);
    setLines([...lines, data]);
  }

  async function updateLine(id, patch) {
    setSaving(true);
    const { error } = await supabase.from('clf_scenario_lines').update(patch).eq('id', id);
    setSaving(false);
    if (error) return alert('保存失败: ' + error.message);
    setLines(lines.map(l => l.id === id ? { ...l, ...patch } : l));
  }

  async function deleteLine(id) {
    if (!confirm('删除这一行?')) return;
    const { error } = await supabase.from('clf_scenario_lines').delete().eq('id', id);
    if (error) return alert('删除失败: ' + error.message);
    setLines(lines.filter(l => l.id !== id));
  }

  async function moveLine(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= lines.length) return;
    const a = lines[idx], b = lines[newIdx];
    // Swap line_order
    await supabase.from('clf_scenario_lines').update({ line_order: b.line_order }).eq('id', a.id);
    await supabase.from('clf_scenario_lines').update({ line_order: a.line_order }).eq('id', b.id);
    loadLines();
  }

  if (loading) return <div style={{ color: V.text3, fontSize: 12 }}>加载对话行…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: V.text2 }}>
          对话行 · Lines ({lines.length})  {saving && <span style={{ color: V.text3 }}>保存中…</span>}
        </div>
        <button onClick={addLine}
          style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer',
            borderRadius: 6, border: 'none', background: V.vermillion, color: '#fdf6e3' }}>
          ➕ 加一行
        </button>
      </div>
      {lines.length === 0 ? (
        <div style={{ color: V.text3, fontSize: 12, textAlign: 'center', padding: 20 }}>
          还没有对话行 — 点击「➕ 加一行」
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lines.map((l, idx) => (
            <LineRow key={l.id} line={l} index={idx} total={lines.length}
              speakerA={speakerA} speakerB={speakerB}
              onChange={p => updateLine(l.id, p)}
              onDelete={() => deleteLine(l.id)}
              onMoveUp={() => moveLine(idx, -1)}
              onMoveDown={() => moveLine(idx, +1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LineRow({ line, index, total, speakerA, speakerB, onChange, onDelete, onMoveUp, onMoveDown }) {
  return (
    <div style={{ background: V.bg, border: `1px solid ${V.border}`, borderRadius: 8, padding: 8 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: V.text3, minWidth: 24 }}>{line.line_order}.</span>
        <select value={line.speaker} onChange={e => onChange({ speaker: e.target.value })}
          style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: `1px solid ${V.border}` }}>
          <option value="A">A · {speakerA}</option>
          <option value="B">B · {speakerB}</option>
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={onMoveUp} disabled={index === 0}
          style={{ padding: '2px 6px', fontSize: 10, cursor: 'pointer',
            border: `1px solid ${V.border}`, borderRadius: 4, background: '#fff' }}>↑</button>
        <button onClick={onMoveDown} disabled={index === total - 1}
          style={{ padding: '2px 6px', fontSize: 10, cursor: 'pointer',
            border: `1px solid ${V.border}`, borderRadius: 4, background: '#fff' }}>↓</button>
        <button onClick={onDelete}
          style={{ padding: '2px 6px', fontSize: 10, cursor: 'pointer',
            border: '1px solid #FFCDD2', borderRadius: 4, background: '#FFEBEE', color: '#C62828' }}>✕</button>
      </div>
      <textarea value={line.text_zh || ''} onChange={e => onChange({ text_zh: e.target.value })}
        placeholder="中文 (必填)"
        style={{ width: '100%', fontSize: 13, padding: 6, borderRadius: 4,
          border: `1px solid ${V.border}`, marginBottom: 4, resize: 'vertical', minHeight: 32 }} />
      <input value={line.pinyin || ''} onChange={e => onChange({ pinyin: e.target.value })}
        placeholder="pinyin (例: Nǐ hǎo!)"
        style={{ width: '100%', fontSize: 12, padding: 6, borderRadius: 4,
          border: `1px solid ${V.border}`, marginBottom: 4 }} />
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={line.text_en || ''} onChange={e => onChange({ text_en: e.target.value })}
          placeholder="English"
          style={{ flex: 1, fontSize: 12, padding: 6, borderRadius: 4, border: `1px solid ${V.border}` }} />
        <input value={line.text_it || ''} onChange={e => onChange({ text_it: e.target.value })}
          placeholder="Italiano"
          style={{ flex: 1, fontSize: 12, padding: 6, borderRadius: 4, border: `1px solid ${V.border}` }} />
      </div>
      <input value={line.notes_zh || ''} onChange={e => onChange({ notes_zh: e.target.value })}
        placeholder="生词/文化注释 (可选)"
        style={{ width: '100%', fontSize: 11, padding: 6, borderRadius: 4,
          border: `1px solid ${V.border}`, marginTop: 4, color: V.text3 }} />
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────
function CreateScenarioModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    slug: '', title_zh: '', title_en: '', title_it: '',
    summary_zh: '', summary_en: '', summary_it: '',
    difficulty: 1, category: 'daily', cover_emoji: '💬',
    speaker_a_name: '小明', speaker_b_name: '老师',
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit() {
    setErr(null);
    if (!form.slug || !form.title_zh) {
      return setErr('Slug 和中文标题必填');
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      return setErr('Slug 只能包含小写字母、数字、连字符 (例: bakery-morning)');
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (e) {
      setErr(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: V.card, borderRadius: 16, maxWidth: 500, width: '100%',
        maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: V.text, marginBottom: 4 }}>新建场景</div>
        <div style={{ fontSize: 12, color: V.text3, marginBottom: 16 }}>Create new scenario</div>

        <Field label="Slug *" hint="URL 友好的 ID,只能小写字母+数字+连字符"
          value={form.slug} onChange={v => set('slug', v)} placeholder="bakery-morning" />
        <Field label="中文标题 *" value={form.title_zh} onChange={v => set('title_zh', v)} placeholder="在面包店" />
        <Field label="English Title" value={form.title_en} onChange={v => set('title_en', v)} placeholder="At the Bakery" />
        <Field label="Titolo Italiano" value={form.title_it} onChange={v => set('title_it', v)} placeholder="Al Panificio" />

        <Field label="中文摘要" value={form.summary_zh} onChange={v => set('summary_zh', v)} multiline />
        <Field label="English summary" value={form.summary_en} onChange={v => set('summary_en', v)} multiline />
        <Field label="Sommario italiano" value={form.summary_it} onChange={v => set('summary_it', v)} multiline />

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Field label="难度" select value={form.difficulty}
              onChange={v => set('difficulty', v)} options={DIFFICULTIES} />
          </div>
          <div style={{ flex: 1 }}>
            <Field label="分类" select value={form.category}
              onChange={v => set('category', v)} options={CATEGORIES} />
          </div>
        </div>
        <Field label="封面 emoji" value={form.cover_emoji} onChange={v => set('cover_emoji', v)} placeholder="💬" />

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Field label="角色 A 名" value={form.speaker_a_name} onChange={v => set('speaker_a_name', v)} />
          </div>
          <div style={{ flex: 1 }}>
            <Field label="角色 B 名" value={form.speaker_b_name} onChange={v => set('speaker_b_name', v)} />
          </div>
        </div>

        {err && (
          <div style={{ background: '#ffebee', color: '#b71c1c', padding: '8px 12px',
            borderRadius: 8, fontSize: 12, marginTop: 8 }}>{err}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={submitting}
            style={{ padding: '8px 16px', fontSize: 13, cursor: 'pointer',
              borderRadius: 8, border: `1px solid ${V.border}`, background: V.bg }}>
            取消
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              borderRadius: 8, border: 'none', background: V.vermillion, color: '#fdf6e3' }}>
            {submitting ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange, placeholder, select, options, multiline }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: V.text3, marginBottom: 3 }}>{label}</label>
      {select ? (
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', padding: 8, fontSize: 13, borderRadius: 6,
            border: `1px solid ${V.border}`, background: '#fff' }}>
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      ) : multiline ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', padding: 8, fontSize: 13, borderRadius: 6,
            border: `1px solid ${V.border}`, resize: 'vertical', minHeight: 50 }} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', padding: 8, fontSize: 13, borderRadius: 6,
            border: `1px solid ${V.border}` }} />
      )}
      {hint && <div style={{ fontSize: 10, color: V.text3, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
