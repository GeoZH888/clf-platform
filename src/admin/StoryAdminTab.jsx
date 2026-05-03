// src/admin/StoryAdminTab.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 故事会 Admin Tab
// Manages clf_stories + clf_story_pages.
//   • List view with search/filter/publish toggle
//   • Create new story (modal)
//   • Edit story pages (inline panel: text + pinyin + image_url + reorder)
//   • Publish / unpublish toggle
//   • Delete (cascades to clf_story_pages)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  vermillion:'#8B4513',
};

const DIFFICULTIES = [
  { id: 1, label: '⭐ 入门 (HSK1)' },
  { id: 2, label: '⭐⭐ 基础 (HSK2-3)' },
  { id: 3, label: '⭐⭐⭐ 中级 (HSK3-4)' },
  { id: 4, label: '⭐⭐⭐⭐ 进阶 (HSK4+)' },
];

export default function StoryAdminTab() {
  const [stories,  setStories]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [toast,    setToast]    = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('clf_stories')
      .select('*')
      .order('order_idx', { ascending: true })
      .order('created_at', { ascending: false });
    if (error) flash('error', error.message);
    setStories(data || []);
    setLoading(false);
  }

  function flash(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  async function togglePublish(s) {
    const { error } = await supabase
      .from('clf_stories')
      .update({ is_published: !s.is_published })
      .eq('id', s.id);
    if (error) return flash('error', error.message);
    flash('ok', s.is_published ? '已下线' : '已发布 Published');
    load();
  }

  async function deleteStory(s) {
    if (!confirm(`删除故事"${s.title_zh}"?\n所有页面将一并删除。Cannot be undone.`)) return;
    const { error } = await supabase.from('clf_stories').delete().eq('id', s.id);
    if (error) return flash('error', error.message);
    flash('ok', '已删除 Deleted');
    load();
  }

  async function createStory(form) {
    const { error } = await supabase.from('clf_stories').insert({
      slug:            form.slug,
      title_zh:        form.title_zh,
      title_en:        form.title_en,
      title_it:        form.title_it,
      summary_zh:      form.summary_zh || null,
      summary_en:      form.summary_en || null,
      summary_it:      form.summary_it || null,
      difficulty:      parseInt(form.difficulty),
      cover_image_url: form.cover_image_url || null,
      is_published:    false,
      order_idx:       stories.length,
    });
    if (error) throw new Error(error.message);
    flash('ok', '已创建 Created');
    setShowCreate(false);
    load();
  }

  const list = stories.filter(s => {
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
          ➕ 新建故事
        </button>
        <button onClick={load} disabled={loading}
          style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer',
            borderRadius: 8, border: `1px solid ${V.border}`, background: V.bg }}>
          ↻
        </button>
      </div>

      <div style={{ fontWeight: 600, color: V.vermillion, fontSize: 13, marginBottom: 8 }}>
        故事列表 · Stories ({list.length})
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: V.text3, padding: 40 }}>加载中…</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', color: V.text3, padding: 40,
          background: V.card, borderRadius: 12, border: `1px dashed ${V.border}` }}>
          {search ? '没有匹配的故事' : '还没有故事 — 点击「➕ 新建故事」开始'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(s => (
            <StoryCard
              key={s.id} story={s}
              isOpen={editingId === s.id}
              onToggleEdit={() => setEditingId(editingId === s.id ? null : s.id)}
              onTogglePublish={() => togglePublish(s)}
              onDelete={() => deleteStory(s)}
              onPagesUpdated={load}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateStoryModal
          onClose={() => setShowCreate(false)}
          onSubmit={createStory}
        />
      )}

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

// ─── Story card with inline pages editor ──────────────────────────────────
function StoryCard({ story, isOpen, onToggleEdit, onTogglePublish, onDelete, onPagesUpdated }) {
  return (
    <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0,
          background: story.cover_image_url ? `url(${story.cover_image_url}) center/cover` : '#f5ede0',
          border: `1px solid ${V.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!story.cover_image_url && <span style={{ fontSize: 28 }}>📖</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: V.text }}>{story.title_zh}</span>
            <span style={{ fontSize: 12, color: V.text3 }}>{story.title_en} · {story.title_it}</span>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8,
              background: story.is_published ? '#e8f5e9' : '#fff3e0',
              color: story.is_published ? '#1b5e20' : '#e65100' }}>
              {story.is_published ? '已发布' : '草稿'}
            </span>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8,
              background: '#fff8e1', color: '#f57f17' }}>L{story.difficulty}</span>
          </div>
          {story.summary_zh && (
            <div style={{ fontSize: 12, color: V.text2, marginTop: 4 }}>{story.summary_zh}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onToggleEdit}
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer',
              borderRadius: 8, border: `1px solid ${V.border}`,
              background: isOpen ? V.vermillion : V.bg,
              color: isOpen ? '#fdf6e3' : V.text2 }}>
            {isOpen ? '收起' : '✎ 故事页'}
          </button>
          <button onClick={onTogglePublish}
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 8,
              border: `1px solid ${story.is_published ? '#a5d6a7' : V.border}`,
              background: story.is_published ? '#e8f5e9' : V.bg,
              color: story.is_published ? '#1b5e20' : V.text2 }}>
            {story.is_published ? '✓ 已发布' : '发布'}
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
          <StoryPagesEditor storyId={story.id} onUpdated={onPagesUpdated} />
        </div>
      )}
    </div>
  );
}

// ─── Story pages editor ───────────────────────────────────────────────────
function StoryPagesEditor({ storyId, onUpdated }) {
  const [pages,   setPages]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { loadPages(); }, [storyId]);

  async function loadPages() {
    setLoading(true);
    const { data, error } = await supabase
      .from('clf_story_pages')
      .select('*')
      .eq('story_id', storyId)
      .order('page_order', { ascending: true });
    if (!error) setPages(data || []);
    setLoading(false);
  }

  async function addPage() {
    const nextOrder = (pages.length > 0 ? Math.max(...pages.map(p => p.page_order)) : 0) + 1;
    const { data, error } = await supabase
      .from('clf_story_pages')
      .insert({ story_id: storyId, page_order: nextOrder, text_zh: '' })
      .select().single();
    if (error) return alert('添加失败: ' + error.message);
    setPages([...pages, data]);
  }

  async function updatePage(id, patch) {
    setSaving(true);
    const { error } = await supabase.from('clf_story_pages').update(patch).eq('id', id);
    setSaving(false);
    if (error) return alert('保存失败: ' + error.message);
    setPages(pages.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  async function deletePage(id) {
    if (!confirm('删除这一页?')) return;
    const { error } = await supabase.from('clf_story_pages').delete().eq('id', id);
    if (error) return alert('删除失败: ' + error.message);
    setPages(pages.filter(p => p.id !== id));
  }

  async function movePage(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= pages.length) return;
    const a = pages[idx], b = pages[newIdx];
    await supabase.from('clf_story_pages').update({ page_order: b.page_order }).eq('id', a.id);
    await supabase.from('clf_story_pages').update({ page_order: a.page_order }).eq('id', b.id);
    loadPages();
  }

  if (loading) return <div style={{ color: V.text3, fontSize: 12 }}>加载页面…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: V.text2 }}>
          故事页 · Pages ({pages.length})  {saving && <span style={{ color: V.text3 }}>保存中…</span>}
        </div>
        <button onClick={addPage}
          style={{ padding: '4px 10px', fontSize: 11, cursor: 'pointer',
            borderRadius: 6, border: 'none', background: V.vermillion, color: '#fdf6e3' }}>
          ➕ 加一页
        </button>
      </div>
      {pages.length === 0 ? (
        <div style={{ color: V.text3, fontSize: 12, textAlign: 'center', padding: 20 }}>
          还没有故事页 — 点击「➕ 加一页」
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pages.map((p, idx) => (
            <PageRow key={p.id} page={p} index={idx} total={pages.length}
              onChange={patch => updatePage(p.id, patch)}
              onDelete={() => deletePage(p.id)}
              onMoveUp={() => movePage(idx, -1)}
              onMoveDown={() => movePage(idx, +1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PageRow({ page, index, total, onChange, onDelete, onMoveUp, onMoveDown }) {
  return (
    <div style={{ background: V.bg, border: `1px solid ${V.border}`, borderRadius: 8, padding: 10 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {/* Image preview */}
        <div style={{ width: 80, height: 80, borderRadius: 8, flexShrink: 0,
          background: page.image_url ? `url(${page.image_url}) center/cover` : '#fff',
          border: `1px solid ${V.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!page.image_url && <span style={{ fontSize: 24, color: V.text3 }}>🖼</span>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: V.text3, fontWeight: 600 }}>第 {page.page_order} 页</span>
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
          <input value={page.image_url || ''} onChange={e => onChange({ image_url: e.target.value })}
            placeholder="🖼 插图 URL (留空显示占位图)"
            style={{ width: '100%', fontSize: 11, padding: 6, borderRadius: 4,
              border: `1px solid ${V.border}` }} />
        </div>
      </div>
      <textarea value={page.text_zh || ''} onChange={e => onChange({ text_zh: e.target.value })}
        placeholder="中文 (必填,可多句)"
        style={{ width: '100%', fontSize: 13, padding: 6, borderRadius: 4,
          border: `1px solid ${V.border}`, marginBottom: 4, resize: 'vertical', minHeight: 50 }} />
      <input value={page.pinyin || ''} onChange={e => onChange({ pinyin: e.target.value })}
        placeholder="pinyin"
        style={{ width: '100%', fontSize: 12, padding: 6, borderRadius: 4,
          border: `1px solid ${V.border}`, marginBottom: 4 }} />
      <div style={{ display: 'flex', gap: 4 }}>
        <textarea value={page.text_en || ''} onChange={e => onChange({ text_en: e.target.value })}
          placeholder="English"
          style={{ flex: 1, fontSize: 12, padding: 6, borderRadius: 4, border: `1px solid ${V.border}`,
            resize: 'vertical', minHeight: 40 }} />
        <textarea value={page.text_it || ''} onChange={e => onChange({ text_it: e.target.value })}
          placeholder="Italiano"
          style={{ flex: 1, fontSize: 12, padding: 6, borderRadius: 4, border: `1px solid ${V.border}`,
            resize: 'vertical', minHeight: 40 }} />
      </div>
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────
function CreateStoryModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    slug: '', title_zh: '', title_en: '', title_it: '',
    summary_zh: '', summary_en: '', summary_it: '',
    difficulty: 1, cover_image_url: '',
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
      return setErr('Slug 只能包含小写字母、数字、连字符');
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
        <div style={{ fontSize: 18, fontWeight: 600, color: V.text, marginBottom: 4 }}>新建故事</div>
        <div style={{ fontSize: 12, color: V.text3, marginBottom: 16 }}>Create new story</div>

        <Field label="Slug *" hint="URL 友好的 ID,只能小写字母+数字+连字符"
          value={form.slug} onChange={v => set('slug', v)} placeholder="kitten-fishing" />
        <Field label="中文标题 *" value={form.title_zh} onChange={v => set('title_zh', v)} placeholder="小猫钓鱼" />
        <Field label="English Title" value={form.title_en} onChange={v => set('title_en', v)} placeholder="The Kitten Goes Fishing" />
        <Field label="Titolo Italiano" value={form.title_it} onChange={v => set('title_it', v)} placeholder="Il Gattino va a Pescare" />

        <Field label="中文摘要" value={form.summary_zh} onChange={v => set('summary_zh', v)} multiline />
        <Field label="English summary" value={form.summary_en} onChange={v => set('summary_en', v)} multiline />
        <Field label="Sommario italiano" value={form.summary_it} onChange={v => set('summary_it', v)} multiline />

        <Field label="难度" select value={form.difficulty}
          onChange={v => set('difficulty', v)} options={DIFFICULTIES} />

        <Field label="封面图 URL" value={form.cover_image_url} onChange={v => set('cover_image_url', v)}
          placeholder="https://..." hint="留空则显示 📖 占位图" />

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
