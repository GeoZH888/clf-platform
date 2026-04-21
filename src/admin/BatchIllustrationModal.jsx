// src/admin/BatchIllustrationModal.jsx
//
// 批量为字符生成插画 UI
//
// 支持 2 种模式:
//   1. 传入 selectedCharIds — 只处理勾选的字 (推荐)
//   2. 不传 — 用过滤条件 (HSK/来源/no image)
//
// Usage:
//   <BatchIllustrationModal
//     open={showBatch}
//     onClose={() => setShowBatch(false)}
//     onComplete={() => { setShowBatch(false); refreshChars(); }}
//     selectedCharIds={[...]}    // 可选: 指定字符 ID 数组
//   />

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

export default function BatchIllustrationModal({ open, onClose, onComplete, selectedCharIds = [] }) {
  const hasSelection = selectedCharIds && selectedCharIds.length > 0;
  
  const [filter, setFilter] = useState({
    hsk_level: null,
    source_label: null,
    only_missing: true,
    limit: 50,
  });
  const [provider, setProvider] = useState('stability');
  const [style, setStyle] = useState('simple_pictograms');
  const [sourceOptions, setSourceOptions] = useState([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewChars, setPreviewChars] = useState([]);
  
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0, errors: 0 });
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setRunning(false);
    setProgress({ completed: 0, total: 0, errors: 0 });
    fetchSourceOptions();
  }, [open]);

  async function fetchSourceOptions() {
    if (hasSelection) return;  // 不需要了
    const { data } = await supabase
      .from('character_source_occurrences')
      .select('source_label');
    const unique = [...new Set((data || []).map(d => d.source_label))].sort();
    setSourceOptions(unique);
  }

  // Preview
  useEffect(() => {
    if (!open) return;
    
    if (hasSelection) {
      // 直接查勾选的字符预览
      (async () => {
        const { data } = await supabase
          .from('jgw_characters')
          .select('id, glyph_modern, pinyin, image_url, meaning_en')
          .in('id', selectedCharIds);
        setPreviewChars(data || []);
        setPreviewCount((data || []).filter(c => !filter.only_missing || !c.image_url).length);
      })();
      return;
    }
    
    // Filter mode
    (async () => {
      let query = supabase.from('jgw_characters').select('id', { count: 'exact', head: true });
      if (filter.hsk_level) query = query.eq('hsk_level', filter.hsk_level);
      if (filter.only_missing) query = query.is('image_url', null);
      
      if (filter.source_label) {
        const { data: occs } = await supabase
          .from('character_source_occurrences')
          .select('character_id')
          .eq('source_label', filter.source_label);
        const ids = [...new Set((occs || []).map(o => o.character_id))];
        if (ids.length > 0) {
          query = query.in('id', ids);
        } else {
          setPreviewCount(0);
          return;
        }
      }
      
      const { count } = await query;
      setPreviewCount(Math.min(count || 0, filter.limit));
    })();
  }, [filter, open, hasSelection, selectedCharIds.length]);

  async function start() {
    setRunning(true);
    setJobId(null);
    
    try {
      const payload = hasSelection
        ? {
            character_ids: selectedCharIds,
            only_missing: filter.only_missing,
            provider,
            style,
          }
        : { filter, provider, style };
      
      const res = await fetch('/.netlify/functions/batch-generate-illustrations-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      pollProgress();
    } catch (err) {
      alert('启动失败: ' + err.message);
      setRunning(false);
    }
  }

  async function pollProgress() {
    let attempts = 0;
    const maxAttempts = 600;  // 30 min max (3s interval)
    
    const poll = async () => {
      attempts++;
      const { data } = await supabase
        .from('character_extraction_jobs')
        .select('*')
        .eq('extraction_method', 'illustration_batch')
        .order('started_at', { ascending: false, nullsLast: true })
        .limit(1)
        .maybeSingle();
      
      if (!data) {
        if (attempts < maxAttempts) setTimeout(poll, 3000);
        return;
      }
      
      setJobId(data.id);
      setProgress({
        completed: data.total_added || 0,
        total: data.total_candidates || 0,
        errors: data.total_skipped || 0,
      });
      
      if (data.status === 'complete') {
        setDone(true);
        setRunning(false);
      } else if (data.status === 'error') {
        alert('批处理出错: ' + (data.error_message || ''));
        setRunning(false);
      } else if (attempts < maxAttempts) {
        setTimeout(poll, 3000);
      }
    };
    
    setTimeout(poll, 2000);  // 先等 2s 让后端创建 job
  }

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#8B4513' }}>🎨 批量生成插画</h2>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ padding: 24, flex: 1, overflow: 'auto' }}>
          {!running && !done && hasSelection && (
            <>
              <h3 style={h3Style}>已选字符 ({selectedCharIds.length} 个)</h3>
              
              <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 6, padding: 8, marginBottom: 16, display:'flex', flexWrap:'wrap', gap: 6 }}>
                {previewChars.map(c => (
                  <div key={c.id} style={{
                    padding: '4px 8px', fontSize: 14,
                    border: `1px solid ${c.image_url ? '#0a7' : '#D2691E'}`,
                    borderRadius: 6,
                    background: c.image_url ? '#e8f5e9' : '#FFF8F0',
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 600, marginRight: 4 }}>{c.glyph_modern}</span>
                    <span style={{ fontSize: 10, color: '#666' }}>{c.pinyin}</span>
                    {c.image_url && <span style={{ marginLeft: 4, fontSize: 10, color: '#0a7' }}>✓ 有图</span>}
                  </div>
                ))}
              </div>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16 }}>
                <input type="checkbox" checked={filter.only_missing} onChange={e => setFilter({ ...filter, only_missing: e.target.checked })}/>
                只处理没图的字 (跳过已有图的, 推荐)
              </label>
            </>
          )}

          {!running && !done && !hasSelection && (
            <>
              <h3 style={h3Style}>筛选字符</h3>
              
              <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>按 HSK 级别:</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <BtnOption selected={!filter.hsk_level} onClick={() => setFilter({ ...filter, hsk_level: null })}>全部</BtnOption>
                    {[1,2,3,4,5,6].map(lv => (
                      <BtnOption key={lv} selected={filter.hsk_level === lv} onClick={() => setFilter({ ...filter, hsk_level: lv })}>
                        HSK {lv}
                      </BtnOption>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label style={labelStyle}>按来源:</label>
                  <select
                    value={filter.source_label || ''}
                    onChange={e => setFilter({ ...filter, source_label: e.target.value || null })}
                    style={{ width: '100%', padding: 8, fontSize: 13, borderRadius: 6, border: '1px solid #e5e5e5' }}
                  >
                    <option value="">全部</option>
                    {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={filter.only_missing} onChange={e => setFilter({ ...filter, only_missing: e.target.checked })}/>
                  只处理没有图片的字 (跳过已有图的)
                </label>
                
                <div>
                  <label style={labelStyle}>最多生成: {filter.limit} 张</label>
                  <input type="range" min="5" max="200" step="5" value={filter.limit}
                    onChange={e => setFilter({ ...filter, limit: +e.target.value })}
                    style={{ width: '100%' }}/>
                </div>
              </div>
            </>
          )}

          {!running && !done && (
            <>
              <h3 style={h3Style}>生成配置</h3>
              
              <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>生图模型:</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <BtnOption selected={provider === 'stability'} onClick={() => setProvider('stability')}>
                      Stability AI (快, 便宜)
                    </BtnOption>
                    <BtnOption selected={provider === 'dalle3'} onClick={() => setProvider('dalle3')}>
                      DALL-E 3 (质量高)
                    </BtnOption>
                  </div>
                </div>
                
                <div>
                  <label style={labelStyle}>风格:</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { v: 'simple_pictograms', l: '简笔画' },
                      { v: 'cartoon', l: '卡通' },
                      { v: 'watercolor', l: '水彩' },
                      { v: 'flat', l: '扁平' },
                    ].map(o => (
                      <BtnOption key={o.v} selected={style === o.v} onClick={() => setStyle(o.v)}>{o.l}</BtnOption>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ padding: 14, background: '#FFF8F0', borderRadius: 8, fontSize: 14 }}>
                <div>📊 预计处理 <strong>{previewCount}</strong> 个字符</div>
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
              <div style={{ fontSize: 18, marginBottom: 20 }}>
                正在生成 ({progress.completed} / {progress.total})
              </div>
              <div style={{ width: '100%', height: 12, background: '#f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                  height: '100%', background: '#8B4513', transition: 'width 0.3s',
                }}/>
              </div>
              {progress.errors > 0 && (
                <div style={{ marginTop: 12, color: '#e69', fontSize: 13 }}>
                  ⚠ {progress.errors} 错误
                </div>
              )}
              <div style={{ marginTop: 20, fontSize: 12, color: '#999' }}>
                后台运行中, 每张图约 10-30 秒.<br/>
                你可以关闭这个窗口, 稍后回来看进度.
              </div>
            </div>
          )}

          {done && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, marginBottom: 16 }}>批量生成完成!</div>
              <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 20 }}>
                <StatBox label="成功" value={progress.completed} color="#0a7"/>
                {progress.errors > 0 && <StatBox label="失败" value={progress.errors} color="#e69"/>}
              </div>
            </div>
          )}
        </div>

        <div style={footerStyle}>
          {!running && !done && (
            <>
              <button onClick={onClose} style={backBtnStyle(false)}>取消</button>
              <div></div>
              <button onClick={start} disabled={previewCount === 0} style={nextBtnStyle(previewCount === 0)}>
                {previewCount === 0 ? '无可处理字符' : `开始生成 ${previewCount} 张`}
              </button>
            </>
          )}
          {running && (
            <>
              <div></div>
              <button onClick={onClose} style={nextBtnStyle(false)}>后台运行,关闭</button>
            </>
          )}
          {done && (
            <>
              <div></div>
              <button onClick={() => { onComplete?.(); onClose(); }} style={nextBtnStyle(false)}>完成 ✓</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BtnOption({ selected, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '6px 14px', fontSize: 13,
        border: `2px solid ${selected ? '#8B4513' : '#e5e5e5'}`,
        background: selected ? '#FFF8F0' : '#fff',
        color: selected ? '#8B4513' : '#333',
        borderRadius: 6, cursor: 'pointer', fontWeight: selected ? 500 : 400,
      }}>
      {children}
    </button>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ padding: '16px 24px', background: '#f9f9f9', borderRadius: 8 }}>
      <div style={{ fontSize: 28, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', zIndex: 9999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modalStyle = {
  width: '90%', maxWidth: 620, maxHeight: '90vh',
  background: '#fff', borderRadius: 12,
  display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
};
const headerStyle = { padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const footerStyle = { padding: '14px 24px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 };
const closeBtnStyle = { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999' };
const h3Style = { margin: '0 0 10px 0', fontSize: 15, color: '#8B4513' };
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 };
const backBtnStyle = (disabled) => ({ padding: '9px 18px', background: disabled ? '#f5f5f5' : '#fff', border: '1px solid #e5e5e5', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer' });
const nextBtnStyle = (disabled) => ({ padding: '9px 22px', background: disabled ? '#ccc' : '#8B4513', color: '#fff', border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500 });
