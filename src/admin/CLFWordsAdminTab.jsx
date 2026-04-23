// src/admin/WordsAdminTab.jsx
// Admin tab for 词语 (clf_words) — mirrors the pattern of the characters tab.
//
// Features:
//   - List all words with thumbnail, pinyin, meaning, theme
//   - Search + theme filter
//   - Add / Edit / Delete word
//   - Toggle illustratable flag per row (✓/⊘)
//   - Per-row 🎨 button to open WordIllustrationStudio
//   - Batch selection + 🎨 批量生图 button (opens BatchWordIllustrationModal)

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import WordIllustrationStudio from './WordIllustrationStudio.jsx';
import BatchWordIllustrationModal from './BatchWordIllustrationModal.jsx';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  accent:'#2E7D32',
};

const THEMES = ['greetings','family','food','numbers','colors','body','time','travel','general'];

export default function WordsAdminTab() {
  const [words, setWords]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modal state
  const [editWord, setEditWord]       = useState(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [illustrateWord, setIllustrateWord] = useState(null);
  const [showBatch, setShowBatch]     = useState(false);

  const loadWords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clf_words')
      .select('*')
      .order('theme').order('hsk_level').order('word_zh');
    if (error) console.warn('[WordsAdminTab] load:', error.message);
    setWords(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadWords(); }, [loadWords]);

  // Derived
  const filtered = words.filter(w => {
    if (themeFilter && w.theme !== themeFilter) return false;
    if (showMissing && w.image_url) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return w.word_zh?.includes(search) ||
           w.pinyin?.toLowerCase().includes(q) ||
           w.meaning_en?.toLowerCase().includes(q) ||
           w.meaning_it?.toLowerCase().includes(q);
  });

  const withImage = words.filter(w => w.image_url).length;

  async function deleteWord(word) {
    if (!confirm(`删除 "${word.word_zh}"?`)) return;
    const { error } = await supabase.from('clf_words').delete().eq('id', word.id);
    if (error) return alert('删除失败: ' + error.message);
    loadWords();
  }

  async function toggleIllustratable(word) {
    const next = !(word.illustratable ?? true);
    const { error } = await supabase
      .from('clf_words')
      .update({ illustratable: next })
      .eq('id', word.id);
    if (error) return alert('更新失败: ' + error.message);
    loadWords();
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center',
        marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="搜索词语 · 拼音 · 意思..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '8px 12px', fontSize: 13,
            borderRadius: 8, border: `1px solid ${V.border}`,
          }}/>
        <select value={themeFilter} onChange={e => setThemeFilter(e.target.value)}
          style={{
            padding: '8px 12px', fontSize: 13,
            borderRadius: 8, border: `1px solid ${V.border}`,
          }}>
          <option value="">全部主题</option>
          {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ fontSize: 12, color: V.text2, display: 'flex',
          alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={showMissing}
            onChange={e => setShowMissing(e.target.checked)}/>
          只看无图
        </label>
        <button onClick={() => setShowAdd(true)} style={btnPrimary}>
          ➕ 添加词语
        </button>
        {selectedIds.size > 0 && (
          <button onClick={() => setShowBatch(true)} style={{ ...btnPrimary, background: '#F57F17' }}>
            🎨 批量生图 ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div style={{ fontSize: 11, color: V.text3, marginBottom: 10 }}>
        共 <b style={{ color: V.accent }}>{words.length}</b> 个词语 ·
        已有插图 <b style={{ color: '#0a7' }}>{withImage}</b> ·
        筛选显示 <b>{filtered.length}</b>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: V.text3 }}>
          加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: V.text3,
          background: V.card, borderRadius: 12, border: `1px dashed ${V.border}` }}>
          {search || themeFilter ? '没有匹配的词语' : '还没有词语 — 点击 ➕ 添加'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(w => {
            const isSelected = selectedIds.has(w.id);
            const illustratable = w.illustratable ?? true;
            return (
              <div key={w.id}
                onClick={() => setEditWord(w)}
                style={{
                  background: '#fff',
                  border: `1px solid ${isSelected ? V.accent : V.border}`,
                  borderRadius: 10, padding: '8px 10px',
                  display: 'flex', gap: 10, alignItems: 'center',
                  cursor: 'pointer',
                  boxShadow: isSelected ? `0 0 0 2px ${V.accent}22` : 'none',
                }}>

                {/* Checkbox */}
                <input type="checkbox"
                  checked={isSelected}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    e.stopPropagation();
                    const next = new Set(selectedIds);
                    if (e.target.checked) next.add(w.id);
                    else next.delete(w.id);
                    setSelectedIds(next);
                  }}
                  style={{ cursor: 'pointer', width: 14, height: 14, flexShrink: 0 }}/>

                {/* Thumbnail */}
                <div style={{
                  width: 48, height: 48, borderRadius: 8, flexShrink: 0,
                  background: w.image_url ? 'transparent' : '#f5ede0',
                  border: `1px solid ${V.border}`, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {w.image_url
                    ? <img src={w.image_url} alt={w.word_zh}
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                    : illustratable === false
                      ? <span style={{ fontSize: 18, color: V.text3 }}>⊘</span>
                      : <span style={{ fontSize: 20, fontFamily: "'STKaiti',serif",
                          color: V.text3 }}>{w.word_zh.charAt(0)}</span>}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline',
                    flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 18, fontWeight: 600, color: V.accent,
                      fontFamily: "'STKaiti','KaiTi',serif",
                    }}>
                      {w.word_zh}
                    </span>
                    <span style={{ fontSize: 11, color: V.text3 }}>{w.pinyin}</span>
                    {w.theme && (
                      <span style={{
                        fontSize: 9, background: '#f5ede0', color: V.text2,
                        padding: '1px 6px', borderRadius: 6,
                      }}>{w.theme}</span>
                    )}
                    {w.hsk_level && (
                      <span style={{
                        fontSize: 9, background: '#E3F2FD', color: '#1565C0',
                        padding: '1px 6px', borderRadius: 6,
                      }}>HSK{w.hsk_level}</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, color: V.text2, marginTop: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {w.meaning_en} {w.meaning_it ? `· ${w.meaning_it}` : ''}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}
                  onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => toggleIllustratable(w)}
                    title={illustratable ? '标记为「不需要插图」' : '标记为「需要插图」'}
                    style={{
                      ...btnIcon,
                      background: illustratable ? '#E8F5E9' : '#eee',
                      color: illustratable ? V.accent : V.text3,
                    }}>
                    {illustratable ? '✓' : '⊘'}
                  </button>
                  <button
                    onClick={() => setIllustrateWord(w)}
                    title="生成/上传插图"
                    disabled={illustratable === false}
                    style={{
                      ...btnIcon,
                      background: illustratable === false ? '#f5f5f5' : V.bg,
                      color: illustratable === false ? '#ccc' : V.accent,
                      cursor: illustratable === false ? 'not-allowed' : 'pointer',
                    }}>
                    🎨
                  </button>
                  <button onClick={() => deleteWord(w)} title="删除"
                    style={{ ...btnIcon, background: '#FFEBEE', color: '#C62828' }}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <WordFormModal
          title="添加词语"
          onClose={() => setShowAdd(false)}
          onSave={() => { setShowAdd(false); loadWords(); }}
        />
      )}

      {editWord && (
        <WordFormModal
          title="编辑词语"
          word={editWord}
          onClose={() => setEditWord(null)}
          onSave={() => { setEditWord(null); loadWords(); }}
        />
      )}

      {illustrateWord && (
        <div style={modalOverlay} onClick={e => {
          if (e.target === e.currentTarget) setIllustrateWord(null);
        }}>
          <WordIllustrationStudio
            words={words}
            initialWord={illustrateWord}
            onUpdate={(updated) => {
              // refresh local state so the tile reflects the new image
              setWords(prev => prev.map(w => w.id === updated.id ? updated : w));
              setIllustrateWord(updated);
            }}
            onClose={() => { setIllustrateWord(null); loadWords(); }}
          />
        </div>
      )}

      <BatchWordIllustrationModal
        open={showBatch}
        onClose={() => setShowBatch(false)}
        onComplete={() => { setShowBatch(false); setSelectedIds(new Set()); loadWords(); }}
        selectedWordIds={[...selectedIds]}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Add/Edit word modal
// ═══════════════════════════════════════════════════════════════════
function WordFormModal({ title, word, onClose, onSave }) {
  const [form, setForm] = useState(word || {
    word_zh: '', pinyin: '',
    meaning_en: '', meaning_it: '', meaning_zh: '',
    example_zh: '', example_en: '', example_it: '',
    theme: 'general', hsk_level: 1, renjiao_grade: null,
    illustratable: true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  async function save() {
    if (!form.word_zh?.trim()) return setErr('词语不能为空');
    setSaving(true);
    setErr(null);
    try {
      // Drop id from insert payload; keep on update
      const payload = { ...form };
      if (word?.id) {
        const { error } = await supabase.from('clf_words')
          .update(payload).eq('id', word.id);
        if (error) throw error;
      } else {
        const { id, ...insert } = payload;
        const { error } = await supabase.from('clf_words').insert(insert);
        if (error) throw error;
      }
      onSave();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={modalOverlay} onClick={e => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div style={{ ...modalCard, maxWidth: 500 }}>
        <div style={modalHeader}>
          <h3 style={{ margin: 0, fontSize: 16, color: V.accent }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none',
            fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'grid', gap: 10 }}>
          <Row label="词语 (中文)">
            <input value={form.word_zh || ''} onChange={e => set('word_zh', e.target.value)}
              style={inputStyle} placeholder="你好"/>
          </Row>
          <Row label="拼音">
            <input value={form.pinyin || ''} onChange={e => set('pinyin', e.target.value)}
              style={inputStyle} placeholder="nǐ hǎo"/>
          </Row>

          <Row label="English meaning">
            <input value={form.meaning_en || ''} onChange={e => set('meaning_en', e.target.value)}
              style={inputStyle} placeholder="Hello"/>
          </Row>
          <Row label="Italian meaning">
            <input value={form.meaning_it || ''} onChange={e => set('meaning_it', e.target.value)}
              style={inputStyle} placeholder="Ciao"/>
          </Row>
          <Row label="中文释义 (optional)">
            <input value={form.meaning_zh || ''} onChange={e => set('meaning_zh', e.target.value)}
              style={inputStyle}/>
          </Row>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Row label="主题">
              <select value={form.theme || 'general'} onChange={e => set('theme', e.target.value)}
                style={inputStyle}>
                {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Row>
            <Row label="HSK 级别">
              <select value={form.hsk_level || 1} onChange={e => set('hsk_level', +e.target.value)}
                style={inputStyle}>
                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>HSK {n}</option>)}
              </select>
            </Row>
          </div>

          <Row label="例句 (中文)">
            <input value={form.example_zh || ''} onChange={e => set('example_zh', e.target.value)}
              style={inputStyle} placeholder="例句..."/>
          </Row>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, color: V.text2, marginTop: 4 }}>
            <input type="checkbox" checked={form.illustratable ?? true}
              onChange={e => set('illustratable', e.target.checked)}/>
            需要插图 (抽象词如问候语可关闭)
          </label>

          {err && (
            <div style={{ padding: 8, background: '#FFEBEE',
              color: '#c0392b', borderRadius: 6, fontSize: 12 }}>
              {err}
            </div>
          )}
        </div>

        <div style={{ ...modalHeader, borderTop: `1px solid ${V.border}`,
          borderBottom: 'none', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnSecondary}>取消</button>
          <button onClick={save} disabled={saving} style={btnPrimary}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: V.text3, marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const btnPrimary = {
  padding: '8px 14px', background: V.accent, color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer',
  fontSize: 12, fontWeight: 500,
};
const btnSecondary = {
  padding: '8px 14px', background: '#fff', color: V.accent,
  border: `1px solid ${V.accent}`, borderRadius: 8, cursor: 'pointer',
  fontSize: 12,
};
const btnIcon = {
  padding: '4px 8px', borderRadius: 6, border: `1px solid ${V.border}`,
  fontSize: 12, cursor: 'pointer',
};
const inputStyle = {
  width: '100%', padding: '6px 10px', fontSize: 13,
  borderRadius: 6, border: `1px solid ${V.border}`,
  boxSizing: 'border-box',
};
const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  zIndex: 9999, display: 'flex', alignItems: 'center',
  justifyContent: 'center', padding: 20,
};
const modalCard = {
  width: '100%', maxHeight: '90vh', overflow: 'auto',
  background: V.card, borderRadius: 12,
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
};
const modalHeader = {
  padding: '12px 20px', borderBottom: `1px solid ${V.border}`,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
