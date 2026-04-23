// src/admin/BatchWordIllustrationModal.jsx
// Adapted from BatchIllustrationModal.jsx.
// Changes:
//   - Works with clf_words (not jgw_characters)
//   - Respects illustratable flag (auto-excludes words marked not illustratable)
//   - Filters: theme (not hsk_level+source), only_missing, limit
//   - Same endpoint: batch-generate-illustrations-background
//     (backend needs to accept target_type: 'word' and write to clf_words.image_url
//      + word-illustrations bucket)
//   - Same providers: stability, dalle3
//   - Word-specific styles (5 new ones)
//
// BACKEND CHANGE REQUIRED (your batch-generate-illustrations-background.js):
//   - Accept {target_type: 'word', word_ids: [...]} branch
//   - Store results in clf_words.image_url
//   - Upload to word-illustrations bucket
//   - Job tracking via character_extraction_jobs (reused) OR new clf_word_jobs table

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const THEMES = [
  'greetings','family','food','numbers','colors','body','time','travel',
];

const STYLES = [
  { v: 'flashcard', l: '📚 闪卡风' },
  { v: 'photo',     l: '📷 实景照' },
  { v: 'emoji',     l: '😀 表情符' },
  { v: 'cartoon',   l: '🎨 卡通画' },
  { v: 'abstract',  l: '🌀 抽象画' },
];

export default function BatchWordIllustrationModal({
  open, onClose, onComplete, selectedWordIds = [],
}) {
  const hasSelection = selectedWordIds && selectedWordIds.length > 0;

  const [filter, setFilter] = useState({
    theme: null,
    only_missing: true,
    only_illustratable: true,
    limit: 50,
  });
  const [provider, setProvider] = useState('stability');
  const [style, setStyle]       = useState('flashcard');
  const [previewCount, setPreviewCount] = useState(0);
  const [previewWords, setPreviewWords] = useState([]);

  const [running, setRunning]   = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, errors: 0 });
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setRunning(false);
    setError(null);
    setProgress({ completed: 0, total: 0, errors: 0 });
  }, [open]);

  // Preview
  useEffect(() => {
    if (!open) return;

    if (hasSelection) {
      (async () => {
        const { data } = await supabase
          .from('clf_words')
          .select('id, word_zh, pinyin, image_url, meaning_en, illustratable')
          .in('id', selectedWordIds);
        const candidates = (data || []).filter(w =>
          (!filter.only_missing      || !w.image_url) &&
          (!filter.only_illustratable || w.illustratable !== false)
        );
        setPreviewWords(data || []);
        setPreviewCount(candidates.length);
      })();
      return;
    }

    // Filter mode
    (async () => {
      let q = supabase.from('clf_words').select('*', { count: 'exact', head: true });
      if (filter.theme)              q = q.eq('theme', filter.theme);
      if (filter.only_missing)       q = q.is('image_url', null);
      if (filter.only_illustratable) q = q.neq('illustratable', false);

      const { count } = await q;
      setPreviewCount(Math.min(count || 0, filter.limit));
    })();
  }, [filter, open, hasSelection, selectedWordIds.length]);

  async function start() {
    setRunning(true);
    setError(null);

    try {
      const payload = hasSelection
        ? {
            target_type: 'word',
            word_ids: selectedWordIds,
            only_missing: filter.only_missing,
            only_illustratable: filter.only_illustratable,
            provider, style,
          }
        : {
            target_type: 'word',
            filter: {
              theme: filter.theme,
              only_missing: filter.only_missing,
              only_illustratable: filter.only_illustratable,
              limit: filter.limit,
            },
            provider, style,
          };

      const res = await fetch('/.netlify/functions/batch-generate-illustrations-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok && res.status !== 202) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      pollProgress();
    } catch (err) {
      setError(`启动失败: ${err.message}`);
      setRunning(false);
    }
  }

  async function pollProgress() {
    let attempts = 0;
    const maxAttempts = 600;    // 30 min

    const poll = async () => {
      attempts++;
      // Reuse character_extraction_jobs table — backend should insert with
      // extraction_method='word_illustration_batch' to distinguish from
      // character jobs. If you've created a separate clf_word_jobs table,
      // change .from() below and .eq() filter accordingly.
      const { data } = await supabase
        .from('character_extraction_jobs')
        .select('*')
        .eq('extraction_method', 'word_illustration_batch')
        .order('started_at', { ascending: false, nullsLast: true })
        .limit(1)
        .maybeSingle();

      if (!data) {
        if (attempts < maxAttempts) setTimeout(poll, 3000);
        return;
      }

      setProgress({
        completed: data.total_added   || 0,
        total:     data.total_candidates || 0,
        errors:    data.total_skipped || 0,
      });

      if (data.status === 'complete') {
        setDone(true);
        setRunning(false);
      } else if (data.status === 'error') {
        setError('批处理出错: ' + (data.error_message || ''));
        setRunning(false);
      } else if (attempts < maxAttempts) {
        setTimeout(poll, 3000);
      }
    };

    setTimeout(poll, 2000);
  }

  if (!open) return null;

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.header}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#2E7D32' }}>
            🎨 批量生成词语插图
          </h2>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        <div style={S.body}>
          {!running && !done && hasSelection && (
            <>
              <h3 style={S.h3}>已选词语 ({selectedWordIds.length} 个)</h3>
              <div style={S.chipsBox}>
                {previewWords.map(w => (
                  <div key={w.id} style={{
                    ...S.chip,
                    border: `1px solid ${w.image_url ? '#0a7' : w.illustratable === false ? '#999' : '#2E7D32'}`,
                    background: w.image_url ? '#e8f5e9' : w.illustratable === false ? '#eee' : '#FFF',
                  }}>
                    <span style={{ fontSize: 15, fontWeight: 600, marginRight: 4 }}>
                      {w.word_zh}
                    </span>
                    <span style={{ fontSize: 10, color: '#666' }}>{w.pinyin}</span>
                    {w.image_url && <span style={{ marginLeft: 4, fontSize: 10, color: '#0a7' }}>✓</span>}
                    {w.illustratable === false && <span style={{ marginLeft: 4, fontSize: 10, color: '#999' }}>⊘</span>}
                  </div>
                ))}
              </div>

              <label style={S.checkboxRow}>
                <input type="checkbox" checked={filter.only_missing}
                  onChange={e => setFilter({ ...filter, only_missing: e.target.checked })}/>
                只处理没图的词 (跳过已有图的, 推荐)
              </label>
              <label style={S.checkboxRow}>
                <input type="checkbox" checked={filter.only_illustratable}
                  onChange={e => setFilter({ ...filter, only_illustratable: e.target.checked })}/>
                跳过标记为「不需要插图」的词
              </label>
            </>
          )}

          {!running && !done && !hasSelection && (
            <>
              <h3 style={S.h3}>筛选词语</h3>
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={S.label}>按主题:</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Btn selected={!filter.theme}
                      onClick={() => setFilter({ ...filter, theme: null })}>
                      全部
                    </Btn>
                    {THEMES.map(th => (
                      <Btn key={th} selected={filter.theme === th}
                        onClick={() => setFilter({ ...filter, theme: th })}>
                        {th}
                      </Btn>
                    ))}
                  </div>
                </div>

                <label style={S.checkboxRow}>
                  <input type="checkbox" checked={filter.only_missing}
                    onChange={e => setFilter({ ...filter, only_missing: e.target.checked })}/>
                  只处理没有图片的词
                </label>
                <label style={S.checkboxRow}>
                  <input type="checkbox" checked={filter.only_illustratable}
                    onChange={e => setFilter({ ...filter, only_illustratable: e.target.checked })}/>
                  跳过标记为「不需要插图」的词
                </label>

                <div>
                  <label style={S.label}>最多生成: {filter.limit} 张</label>
                  <input type="range" min="5" max="200" step="5" value={filter.limit}
                    onChange={e => setFilter({ ...filter, limit: +e.target.value })}
                    style={{ width: '100%' }}/>
                </div>
              </div>
            </>
          )}

          {!running && !done && (
            <>
              <h3 style={S.h3}>生成配置</h3>
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={S.label}>生图模型:</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Btn selected={provider === 'stability'}
                      onClick={() => setProvider('stability')}>
                      Stability AI
                    </Btn>
                    <Btn selected={provider === 'dalle3'}
                      onClick={() => setProvider('dalle3')}>
                      DALL-E 3
                    </Btn>
                  </div>
                </div>
                <div>
                  <label style={S.label}>风格:</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {STYLES.map(o => (
                      <Btn key={o.v} selected={style === o.v}
                        onClick={() => setStyle(o.v)}>
                        {o.l}
                      </Btn>
                    ))}
                  </div>
                </div>
              </div>

              <div style={S.summaryBox}>
                <div>📊 预计处理 <strong>{previewCount}</strong> 个词语</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  预计时间: ~{Math.ceil(previewCount * 15 / 60)} 分钟
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  预计成本: ~${(previewCount * (provider === 'dalle3' ? 0.04 : 0.02)).toFixed(2)}
                </div>
              </div>
            </>
          )}

          {running && !done && (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
              <div style={{ fontSize: 16, marginBottom: 16 }}>
                生成中 ({progress.completed} / {progress.total})
              </div>
              <div style={S.progressBar}>
                <div style={{
                  ...S.progressFill,
                  width: progress.total > 0
                    ? `${(progress.completed / progress.total) * 100}%`
                    : '0%',
                }}/>
              </div>
              {progress.errors > 0 && (
                <div style={{ marginTop: 12, color: '#e69', fontSize: 13 }}>
                  ⚠ {progress.errors} 错误
                </div>
              )}
              <div style={{ marginTop: 16, fontSize: 11, color: '#999' }}>
                后台运行中, 每张图约 10-30 秒.<br/>
                你可以关闭这个窗口, 稍后回来看进度.
              </div>
            </div>
          )}

          {done && (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 16, marginBottom: 16 }}>批量生成完成!</div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 16 }}>
                <Stat label="成功" value={progress.completed} color="#0a7"/>
                {progress.errors > 0 && <Stat label="失败" value={progress.errors} color="#e69"/>}
              </div>
            </div>
          )}

          {error && (
            <div style={{ ...S.summaryBox, background: '#FFEBEE', color: '#c0392b' }}>
              {error}
            </div>
          )}
        </div>

        <div style={S.footer}>
          {!running && !done && (
            <>
              <button onClick={onClose} style={S.btnCancel}>取消</button>
              <button onClick={start} disabled={previewCount === 0}
                style={{
                  ...S.btnStart,
                  background: previewCount === 0 ? '#ccc' : '#2E7D32',
                  cursor: previewCount === 0 ? 'not-allowed' : 'pointer',
                }}>
                {previewCount === 0 ? '无可处理词语' : `开始生成 ${previewCount} 张`}
              </button>
            </>
          )}
          {running && (
            <button onClick={onClose} style={S.btnStart}>
              后台运行, 关闭
            </button>
          )}
          {done && (
            <button onClick={() => { onComplete?.(); onClose(); }}
              style={S.btnStart}>完成 ✓</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Btn({ selected, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', fontSize: 12,
      border: `2px solid ${selected ? '#2E7D32' : '#e5e5e5'}`,
      background: selected ? '#E8F5E9' : '#fff',
      color: selected ? '#2E7D32' : '#333',
      borderRadius: 6, cursor: 'pointer',
      fontWeight: selected ? 500 : 400,
    }}>{children}</button>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ padding: '14px 20px', background: '#f9f9f9', borderRadius: 8 }}>
      <div style={{ fontSize: 24, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#666' }}>{label}</div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    width: '90%', maxWidth: 600, maxHeight: '90vh',
    background: '#fff', borderRadius: 12,
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  },
  header: {
    padding: '14px 20px', borderBottom: '1px solid #e5e5e5',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  body: { padding: 20, flex: 1, overflow: 'auto' },
  footer: {
    padding: '12px 20px', borderTop: '1px solid #e5e5e5',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 10,
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
    color: '#999',
  },
  h3: { margin: '0 0 10px 0', fontSize: 14, color: '#2E7D32' },
  label: { display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 500 },
  checkboxRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 12, marginBottom: 8,
  },
  chipsBox: {
    maxHeight: 150, overflowY: 'auto',
    border: '1px solid #e5e5e5', borderRadius: 6, padding: 8,
    marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  chip: {
    padding: '4px 8px', fontSize: 13, borderRadius: 6,
    display: 'inline-flex', alignItems: 'center',
  },
  summaryBox: {
    padding: 12, background: '#F1F8E9', borderRadius: 8, fontSize: 13,
  },
  progressBar: {
    width: '100%', height: 10, background: '#f0f0f0',
    borderRadius: 5, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', background: '#2E7D32', transition: 'width 0.3s',
  },
  btnCancel: {
    padding: '8px 16px', background: '#fff',
    border: '1px solid #e5e5e5', borderRadius: 8, cursor: 'pointer',
    fontSize: 13,
  },
  btnStart: {
    padding: '8px 20px', background: '#2E7D32', color: '#fff',
    border: 'none', borderRadius: 8, cursor: 'pointer',
    fontSize: 13, fontWeight: 500,
  },
};
