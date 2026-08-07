// src/admin/StoryAdminTab.jsx
// ═══════════════════════════════════════════════════════════════════════════
// 故事会 Admin Tab
// Manages clf_stories + clf_story_pages.
//   • List view with search/filter/publish toggle
//   • Create new story (modal) — by hand, or drafted end-to-end by AI
//   • Edit story pages (inline panel: text + pinyin + image_url + reorder)
//   • Batch AI: fill missing translations, fill pinyin
//   • Batch TTS: Azure narration per page → clf_story_pages.audio_url
//   • Publish / unpublish toggle
//   • Delete (cascades to clf_story_pages)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import AiFieldAssistant from './components/AiFieldAssistant.jsx';
import {
  draftStory, translatePages, pinyinForPages, STORY_VOICES,
} from './lib/storyAi.js';

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
  // Which card is expanded, and onto which panel: { id, tab:'info'|'pages' }
  const [openPanel, setOpenPanel] = useState(null);
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

  async function createStory(form, draftPages = []) {
    const { data: created, error } = await supabase.from('clf_stories').insert({
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
    }).select().single();
    if (error) throw new Error(error.message);

    // AI-drafted pages come in with the story — insert them in one go.
    if (draftPages.length) {
      const { error: pagesErr } = await supabase.from('clf_story_pages').insert(
        draftPages.map((p, i) => ({
          story_id:   created.id,
          page_order: i + 1,
          text_zh:    p.text_zh || '',
          pinyin:     p.pinyin  || null,
          text_en:    p.text_en || null,
          text_it:    p.text_it || null,
        }))
      );
      // The story row itself is saved — report the partial success and let the
      // admin add pages by hand, rather than leaving the modal open on a story
      // that already exists (a retry would collide on slug).
      if (pagesErr) {
        setShowCreate(false);
        load();
        flash('error', `故事已创建，但故事页写入失败: ${pagesErr.message}`);
        return;
      }
    }

    flash('ok', draftPages.length
      ? `已创建 · ${draftPages.length} 页`
      : '已创建 Created');
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
              openTab={openPanel?.id === s.id ? openPanel.tab : null}
              onToggleTab={tab => setOpenPanel(p =>
                (p?.id === s.id && p.tab === tab) ? null : { id: s.id, tab })}
              onTogglePublish={() => togglePublish(s)}
              onDelete={() => deleteStory(s)}
              onPagesUpdated={load}
              onSaved={load}
              flash={flash}
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
function StoryCard({
  story, openTab, onToggleTab, onTogglePublish, onDelete, onPagesUpdated, onSaved, flash,
}) {
  const isOpen = !!openTab;
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
          <button onClick={() => onToggleTab('info')}
            title="编辑标题/摘要,并用 AI 补全翻译 · Edit titles and summaries"
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer',
              borderRadius: 8, border: `1px solid ${V.border}`,
              background: openTab === 'info' ? V.vermillion : V.bg,
              color: openTab === 'info' ? '#fdf6e3' : V.text2 }}>
            {openTab === 'info' ? '收起' : '✎ 信息'}
          </button>
          <button onClick={() => onToggleTab('pages')}
            style={{ padding: '6px 12px', fontSize: 12, cursor: 'pointer',
              borderRadius: 8, border: `1px solid ${V.border}`,
              background: openTab === 'pages' ? V.vermillion : V.bg,
              color: openTab === 'pages' ? '#fdf6e3' : V.text2 }}>
            {openTab === 'pages' ? '收起' : '✎ 故事页'}
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
          {openTab === 'info'
            ? <StoryInfoEditor story={story} onSaved={onSaved} flash={flash} />
            : <StoryPagesEditor story={story} onUpdated={onPagesUpdated} />}
        </div>
      )}
    </div>
  );
}

// ─── Story info editor ────────────────────────────────────────────────────
// Story-level fields were previously only editable at creation time, so the
// AI translate bar could not reach stories already in the table.
const INFO_COLS = [
  'slug', 'title_zh', 'title_en', 'title_it',
  'summary_zh', 'summary_en', 'summary_it',
  'difficulty', 'cover_image_url',
];

function StoryInfoEditor({ story, onSaved, flash }) {
  const seed = () => Object.fromEntries(
    INFO_COLS.map(k => [k, story[k] ?? (k === 'difficulty' ? 1 : '')]));

  const [form,     setForm]     = useState(seed);
  const [baseline, setBaseline] = useState(seed);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState(null);

  // Deliberately not synced to `story` after mount: a background list refresh
  // must not wipe edits the admin has not saved yet.
  const dirty = INFO_COLS.some(k => String(form[k] ?? '') !== String(baseline[k] ?? ''));

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function save() {
    setErr(null);
    if (!form.slug || !form.title_zh) return setErr('Slug 和中文标题必填');
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      return setErr('Slug 只能包含小写字母、数字、连字符');
    }
    setSaving(true);
    const { error } = await supabase.from('clf_stories').update({
      slug:            form.slug,
      title_zh:        form.title_zh,
      title_en:        form.title_en || null,
      title_it:        form.title_it || null,
      summary_zh:      form.summary_zh || null,
      summary_en:      form.summary_en || null,
      summary_it:      form.summary_it || null,
      difficulty:      parseInt(form.difficulty) || 1,
      cover_image_url: form.cover_image_url || null,
    }).eq('id', story.id);
    setSaving(false);
    if (error) return setErr(error.message);
    setBaseline(form);
    flash?.('ok', '已保存 Saved');
    onSaved?.();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: V.text2 }}>
          故事信息 · Story info
        </div>
        {dirty && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8,
            background: '#fff3e0', color: '#e65100' }}>
            未保存 unsaved
          </span>
        )}
      </div>

      {/* Fills whichever of the zh/en/it titles + summaries are still empty. */}
      <AiFieldAssistant
        values={form}
        onPatch={patch => setForm(f => ({ ...f, ...patch }))}
        context={`A children's story for Chinese learners${form.title_zh ? `: ${form.title_zh}` : ''}`}
        compact
      />

      <Field label="Slug *" value={form.slug} onChange={v => set('slug', v)}
        hint="改动会影响分享链接 · changing this changes the story's URL" />
      <Field label="中文标题 *" value={form.title_zh} onChange={v => set('title_zh', v)} />
      <Field label="English Title" value={form.title_en} onChange={v => set('title_en', v)} />
      <Field label="Titolo Italiano" value={form.title_it} onChange={v => set('title_it', v)} />
      <Field label="中文摘要" value={form.summary_zh} onChange={v => set('summary_zh', v)} multiline />
      <Field label="English summary" value={form.summary_en} onChange={v => set('summary_en', v)} multiline />
      <Field label="Sommario italiano" value={form.summary_it} onChange={v => set('summary_it', v)} multiline />
      <Field label="难度" select value={form.difficulty}
        onChange={v => set('difficulty', v)} options={DIFFICULTIES} />
      <Field label="封面图 URL" value={form.cover_image_url}
        onChange={v => set('cover_image_url', v)} placeholder="https://..." />

      {err && (
        <div style={{ background: '#ffebee', color: '#b71c1c', padding: '8px 12px',
          borderRadius: 8, fontSize: 12, marginTop: 8 }}>{err}</div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
        <button onClick={() => { setForm(baseline); setErr(null); }}
          disabled={!dirty || saving}
          style={{ padding: '7px 14px', fontSize: 12, borderRadius: 8,
            border: `1px solid ${V.border}`, background: V.bg, color: V.text2,
            cursor: !dirty || saving ? 'default' : 'pointer', opacity: !dirty || saving ? 0.5 : 1 }}>
          还原
        </button>
        <button onClick={save} disabled={!dirty || saving}
          style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            border: 'none', background: V.vermillion, color: '#fdf6e3',
            cursor: !dirty || saving ? 'default' : 'pointer', opacity: !dirty || saving ? 0.5 : 1 }}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}

// ─── Story pages editor ───────────────────────────────────────────────────
function StoryPagesEditor({ story, onUpdated }) {
  const storyId = story.id;
  const [pages,   setPages]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // AI / TTS toolbar state
  const [provider,  setProvider]  = useState('claude');
  const [voice,     setVoice]     = useState(STORY_VOICES[0].id);
  const [overwrite, setOverwrite] = useState(false);
  const [busy,      setBusy]      = useState(null);   // 'translate'|'pinyin'|'audio'|null
  const [logLines,  setLogLines]  = useState([]);
  const [audioBusy, setAudioBusy] = useState({});     // { [pageId]: true }

  const log = m => setLogLines(prev =>
    [`${new Date().toLocaleTimeString()} ${m}`, ...prev].slice(0, 24));

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

  // ── Write a { [pageId]: patch } map back to the DB and to local state ────
  async function applyPatches(patches) {
    const ids = Object.keys(patches);
    if (!ids.length) return 0;
    setSaving(true);
    const okIds = new Set();
    const failed = [];
    for (const id of ids) {
      const { error } = await supabase.from('clf_story_pages').update(patches[id]).eq('id', id);
      if (error) failed.push(error.message);
      else okIds.add(id);
    }
    setSaving(false);
    setPages(prev => prev.map(p => okIds.has(p.id) ? { ...p, ...patches[p.id] } : p));
    if (failed.length) log(`✗ ${failed.length} 页保存失败: ${failed[0]}`);
    return okIds.size;
  }

  // ── AI: fill missing translations across every page at once ─────────────
  async function runTranslate() {
    setBusy('translate');
    log(`🌐 [${provider}] 翻译 ${pages.length} 页…`);
    try {
      const patches = await translatePages({
        pages, sourceLang: 'zh', overwrite, provider,
        storyTitle: story.title_zh || story.title_en || '',
      });
      const n = Object.keys(patches).length;
      if (!n) log('没有需要翻译的页面（勾选「覆盖」可重译已有内容）');
      else log(`✓ 已翻译 ${await applyPatches(patches)} 页`);
    } catch (e) { log(`✗ 翻译失败: ${e.message}`); }
    setBusy(null);
  }

  // ── AI: fill pinyin ─────────────────────────────────────────────────────
  async function runPinyin() {
    setBusy('pinyin');
    log(`🔤 [${provider}] 生成拼音…`);
    try {
      const patches = await pinyinForPages({ pages, overwrite, provider });
      const n = Object.keys(patches).length;
      if (!n) log('没有需要注音的页面（勾选「覆盖」可重新注音）');
      else log(`✓ 已注音 ${await applyPatches(patches)} 页`);
    } catch (e) { log(`✗ 注音失败: ${e.message}`); }
    setBusy(null);
  }

  // ── TTS: one page ───────────────────────────────────────────────────────
  // Returns true on success so the batch loop can count.
  async function generateAudio(page, { force = false, quiet = false } = {}) {
    setAudioBusy(prev => ({ ...prev, [page.id]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('请重新登录 admin');

      const res = await fetch('/.netlify/functions/story-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ page_id: page.id, voice, force }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(`服务器返回非 JSON: ${text.slice(0, 160)}`); }
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      setPages(prev => prev.map(x => x.id === page.id
        ? { ...x, audio_url: data.audio_url, audio_voice: voice, audio_provider: 'azure' }
        : x));
      if (!quiet) {
        log(`✓ 第 ${page.page_order} 页朗读完成${data.cached ? '（缓存）' : ''}`);
      }
      return true;
    } catch (e) {
      log(`✗ 第 ${page.page_order} 页朗读失败: ${e.message}`);
      return false;
    } finally {
      setAudioBusy(prev => ({ ...prev, [page.id]: false }));
    }
  }

  // ── TTS: every page that still needs this voice ─────────────────────────
  async function runBatchAudio() {
    const todo = pages.filter(p =>
      (p.text_zh || '').trim() &&
      (overwrite || !p.audio_url || p.audio_voice !== voice || p.audio_provider !== 'azure')
    );
    if (!todo.length) return log(`所有页面已有 ${voice} 朗读`);

    setBusy('audio');
    log(`🔊 [${voice}] 生成 ${todo.length} 页朗读…`);
    let done = 0;
    // Sequential: Azure throttles per-key, and a 15-page story finishes in
    // well under the time a parallel burst would spend on retries.
    for (const p of todo) {
      if (await generateAudio(p, { force: overwrite, quiet: true })) done++;
    }
    log(`✓ 朗读完成 ${done}/${todo.length} 页`);
    setBusy(null);
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

  const withAudio = pages.filter(p => p.audio_url).length;
  const anyBusy   = !!busy;

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

      {/* ── AI + 朗读 toolbar ───────────────────────────────────────────── */}
      {pages.length > 0 && (
        <div style={{ background: V.bg, border: `1px solid ${V.border}`, borderRadius: 10,
          padding: '8px 10px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: V.vermillion }}>🤖 整篇处理</span>
            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8,
              background: withAudio === pages.length ? '#e8f5e9' : '#f5ede0',
              color: withAudio === pages.length ? '#2E7D32' : V.text3 }}>
              🔊 {withAudio}/{pages.length}
            </span>

            <div style={{ flex: 1 }} />

            <select value={provider} onChange={e => setProvider(e.target.value)}
              title="AI 引擎 · Provider"
              style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6,
                border: `1px solid ${V.border}`, background: '#fff', color: V.text2 }}>
              <option value="claude">Claude</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">GPT-4o</option>
              <option value="gemini">Gemini</option>
            </select>

            <select value={voice} onChange={e => setVoice(e.target.value)}
              title="朗读音色 · Voice"
              style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6,
                border: `1px solid ${V.border}`, background: '#fff', color: V.text2 }}>
              {STORY_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>

            <label title="重做已有内容 · Redo pages that already have content"
              style={{ fontSize: 11, color: V.text3, display: 'flex',
                alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={overwrite}
                onChange={e => setOverwrite(e.target.checked)} style={{ cursor: 'pointer' }} />
              覆盖
            </label>

            <ToolBtn onClick={runPinyin} disabled={anyBusy}
              title="为所有缺拼音的页面注音 · Fill missing pinyin">
              {busy === 'pinyin' ? '⏳ 注音中…' : '🔤 生成拼音'}
            </ToolBtn>
            <ToolBtn onClick={runTranslate} disabled={anyBusy}
              title="以中文为源补全英文/意大利文 · Fill missing EN/IT from Chinese">
              {busy === 'translate' ? '⏳ 翻译中…' : '🌐 补全翻译'}
            </ToolBtn>
            <ToolBtn onClick={runBatchAudio} disabled={anyBusy} primary
              title="为所有页面生成朗读 · Generate narration for every page">
              {busy === 'audio' ? '⏳ 朗读中…' : '🔊 批量朗读'}
            </ToolBtn>
          </div>

          {logLines.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: 96, overflowY: 'auto',
              fontSize: 10, lineHeight: 1.6, color: V.text3,
              fontFamily: 'ui-monospace, Menlo, monospace' }}>
              {logLines.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>
      )}
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
              audioBusy={!!audioBusy[p.id]}
              audioStale={!!p.audio_url && p.audio_voice !== voice}
              onGenerateAudio={() => generateAudio(p, { force: !!p.audio_url })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ToolBtn({ onClick, disabled, title, primary, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      style={{
        padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        border: primary ? 'none' : `1px solid ${V.vermillion}`,
        background: primary ? V.vermillion : '#fff',
        color: primary ? '#fdf6e3' : V.vermillion,
      }}>
      {children}
    </button>
  );
}

function PageRow({
  page, index, total, onChange, onDelete, onMoveUp, onMoveDown,
  audioBusy, audioStale, onGenerateAudio,
}) {
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

      {/* ── Narration ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <button type="button" onClick={onGenerateAudio}
          disabled={audioBusy || !(page.text_zh || '').trim()}
          title={page.audio_url ? '用当前音色重新生成 · Regenerate with the selected voice'
                                : '生成本页朗读 · Generate narration for this page'}
          style={{ padding: '4px 10px', fontSize: 11, borderRadius: 6,
            border: `1px solid ${V.border}`, background: page.audio_url ? '#fff8e1' : '#fff',
            color: V.text2, flexShrink: 0,
            cursor: audioBusy || !(page.text_zh || '').trim() ? 'default' : 'pointer',
            opacity: audioBusy || !(page.text_zh || '').trim() ? 0.5 : 1 }}>
          {audioBusy ? '⏳ 生成中…' : page.audio_url ? '🔊 重新朗读' : '🔊 朗读'}
        </button>

        {page.audio_url ? (
          <>
            <audio key={page.audio_url} controls preload="none" src={page.audio_url}
              style={{ height: 30, flex: 1, minWidth: 0 }} />
            <span style={{ fontSize: 10, color: audioStale ? '#E65100' : V.text3, flexShrink: 0 }}>
              {page.audio_voice}{audioStale ? ' · 与所选音色不同' : ''}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 10, color: V.text3 }}>还没有朗读音频</span>
        )}
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

  // AI drafting
  const [idea,       setIdea]       = useState('');
  const [pageCount,  setPageCount]  = useState(6);
  const [provider,   setProvider]   = useState('claude');
  const [drafting,   setDrafting]   = useState(false);
  const [draftPages, setDraftPages] = useState([]);
  const [draftNote,  setDraftNote]  = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function runDraft() {
    setDrafting(true);
    setErr(null);
    setDraftNote('AI 正在写故事… Writing the story…');
    try {
      const story = await draftStory({
        idea,
        pageCount,
        difficulty: parseInt(form.difficulty) || 1,
        provider,
      });
      setForm(f => ({
        ...f,
        slug:       story.slug       || f.slug,
        title_zh:   story.title_zh   || f.title_zh,
        title_en:   story.title_en   || f.title_en,
        title_it:   story.title_it   || f.title_it,
        summary_zh: story.summary_zh || f.summary_zh,
        summary_en: story.summary_en || f.summary_en,
        summary_it: story.summary_it || f.summary_it,
      }));
      setDraftPages(story.pages);
      setDraftNote(`✓ 已生成 ${story.pages.length} 页 — 创建后可继续编辑、注音、朗读`);
    } catch (e) {
      setDraftNote('');
      setErr(e.message);
    }
    setDrafting(false);
  }

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
      await onSubmit(form, draftPages);
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

        {/* ── AI: draft the whole story from one line ──────────────────── */}
        <div style={{ background: V.bg, border: `1px solid ${V.border}`,
          borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: V.vermillion, marginBottom: 6 }}>
            ✨ AI 一键成文
          </div>
          <textarea value={idea} onChange={e => setIdea(e.target.value)}
            placeholder="一句话故事灵感,中英意皆可 — 例:小猫钓鱼,三心二意最后什么也没钓到"
            style={{ width: '100%', padding: 8, fontSize: 13, borderRadius: 6,
              border: `1px solid ${V.border}`, resize: 'vertical', minHeight: 52 }} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center',
            flexWrap: 'wrap', marginTop: 8 }}>
            <label style={{ fontSize: 11, color: V.text3 }}>页数</label>
            <input type="number" min={1} max={20} value={pageCount}
              onChange={e => setPageCount(e.target.value)}
              style={{ width: 58, padding: '4px 6px', fontSize: 12, borderRadius: 6,
                border: `1px solid ${V.border}` }} />

            <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)}
              title="难度 · Level"
              style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6,
                border: `1px solid ${V.border}`, background: '#fff', color: V.text2 }}>
              {DIFFICULTIES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>

            <select value={provider} onChange={e => setProvider(e.target.value)}
              title="AI 引擎 · Provider"
              style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6,
                border: `1px solid ${V.border}`, background: '#fff', color: V.text2 }}>
              <option value="claude">Claude</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">GPT-4o</option>
              <option value="gemini">Gemini</option>
            </select>

            <div style={{ flex: 1 }} />

            <button type="button" onClick={runDraft} disabled={drafting || !idea.trim()}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                border: 'none', background: V.vermillion, color: '#fdf6e3',
                cursor: drafting || !idea.trim() ? 'default' : 'pointer',
                opacity: drafting || !idea.trim() ? 0.5 : 1 }}>
              {drafting ? '⏳ 生成中…' : '✨ 生成故事'}
            </button>
          </div>

          {draftNote && (
            <div style={{ fontSize: 11, marginTop: 8,
              color: draftNote.startsWith('✓') ? '#2E7D32' : V.text3 }}>
              {draftNote}
            </div>
          )}

          {draftPages.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: 150, overflowY: 'auto',
              background: '#fff', border: `1px solid ${V.border}`, borderRadius: 8, padding: 8 }}>
              {draftPages.map((p, i) => (
                <div key={i} style={{ fontSize: 11, color: V.text2, marginBottom: 6, lineHeight: 1.5 }}>
                  <span style={{ color: V.text3 }}>{i + 1}. </span>{p.text_zh}
                  {p.pinyin && (
                    <div style={{ fontSize: 10, color: V.text3, fontStyle: 'italic' }}>{p.pinyin}</div>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => { setDraftPages([]); setDraftNote(''); }}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                  border: '1px solid #FFCDD2', background: '#FFEBEE', color: '#C62828' }}>
                丢弃这些页 · Discard pages
              </button>
            </div>
          )}
        </div>

        {/* Fills whichever of zh/en/it titles + summaries are still empty. */}
        <AiFieldAssistant
          values={form}
          onPatch={patch => setForm(f => ({ ...f, ...patch }))}
          context={`A children's story for Chinese learners${form.title_zh ? `: ${form.title_zh}` : ''}`}
          compact
        />

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
