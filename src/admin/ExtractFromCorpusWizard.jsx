// src/admin/components/ExtractFromCorpusWizard.jsx
//
// 5-step wizard for extracting characters from corpus:
//   1. Select source (collection or document)
//   2. Choose extraction method
//   3. Preview candidates + select which to keep
//   4. Auto-enrich with AI
//   5. Review enriched data + final import
//
// Usage:
//   <ExtractFromCorpusWizard 
//     open={showWizard}
//     onClose={() => setShowWizard(false)}
//     onComplete={() => { setShowWizard(false); refreshList(); }}
//   />

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const STEPS = [
  { n: 1, label: '选择来源', icon: '📚' },
  { n: 2, label: '提取方式', icon: '⚙️' },
  { n: 3, label: '审核候选字', icon: '✓' },
  { n: 4, label: 'AI 填充详情', icon: '🤖' },
  { n: 5, label: '确认入库', icon: '💾' },
];

export default function ExtractFromCorpusWizard({ open, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  
  // Step 1 — source
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [sourceMode, setSourceMode] = useState('document'); // 'document' | 'collection'
  
  // Step 2 — method
  const [method, setMethod] = useState('shizi_biao');
  const [minFrequency, setMinFrequency] = useState(5);
  
  // Step 3 — candidates
  const [jobId, setJobId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedChars, setSelectedChars] = useState(new Set());
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  
  // Step 4 — enrich
  const [enrichedChars, setEnrichedChars] = useState([]);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  
  // Step 5 — import
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });  // NEW
  const [importResult, setImportResult] = useState(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setExtractError(null);
      setImportResult(null);
      fetchCollections();
    }
  }, [open]);

  // Fetch collections when wizard opens
  async function fetchCollections() {
    const { data } = await supabase
      .from('corpus_collections')
      .select('id, slug, name_zh, name_en, icon')
      .order('sort_order');
    setCollections(data || []);
  }

  // Fetch documents when collection changes
  useEffect(() => {
    if (!selectedCollection) { setDocuments([]); return; }
    (async () => {
      const { data } = await supabase
        .from('corpus_documents')
        .select('id, title, status, chunk_count, subject_slug, grade_level')
        .eq('collection_id', selectedCollection.id)
        .eq('status', 'ready')
        .order('title');
      setDocuments(data || []);
    })();
  }, [selectedCollection]);

  // ────────────────────────────────────────────────
  // Step actions
  // ────────────────────────────────────────────────

  async function handleExtract() {
    setExtracting(true);
    setExtractError(null);
    
    try {
      const body = {
        source_type: sourceMode === 'document' ? 'corpus_document' : 'corpus_collection',
        source_id: sourceMode === 'document' ? selectedDoc.id : selectedCollection.id,
        extraction_method: method,
        config: method === 'frequency' ? { min_frequency: minFrequency } : {},
      };

      const res = await fetch(
        '/.netlify/functions/extract-characters-candidates-background',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      
      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      // For background function, poll for job completion
      await pollJobStatus();
    } catch (err) {
      setExtractError(err.message);
      setExtracting(false);
    }
  }

  // Poll character_extraction_jobs until status = ready_for_review
  async function pollJobStatus() {
    const maxAttempts = 60;  // 60 × 3s = 3 minutes
    let attempts = 0;
    
    const pollFn = async () => {
      attempts++;
      
      // Get latest pending/extracting job
      const { data } = await supabase
        .from('character_extraction_jobs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!data) {
        if (attempts >= maxAttempts) {
          setExtractError('Timeout — job not found');
          setExtracting(false);
          return;
        }
        setTimeout(pollFn, 3000);
        return;
      }

      if (data.status === 'ready_for_review') {
        setJobId(data.id);
        setCandidates(data.candidates || []);
        // Default: select all non-already-in-db
        const defaultSelected = new Set(
          (data.candidates || [])
            .filter(c => !c.already_in_db)
            .map(c => c.char)
        );
        setSelectedChars(defaultSelected);
        setExtracting(false);
        setStep(3);
      } else if (data.status === 'error') {
        setExtractError(data.error_message || 'Unknown error');
        setExtracting(false);
      } else if (attempts < maxAttempts) {
        setTimeout(pollFn, 3000);
      } else {
        setExtractError('Timeout after 3 minutes');
        setExtracting(false);
      }
    };
    
    pollFn();
  }

  async function handleEnrich() {
    setEnriching(true);
    setEnrichProgress(0);
    
    const chars = [...selectedChars];
    const BATCH = 10;
    const allFilled = [];
    
    try {
      for (let i = 0; i < chars.length; i += BATCH) {
        const batch = chars.slice(i, i + BATCH);
        const res = await fetch(
          '/.netlify/functions/enrich-character-details',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              job_id: jobId,
              characters: batch,
            }),
          }
        );
        
        if (!res.ok) throw new Error('Enrich failed: ' + res.status);
        const data = await res.json();
        allFilled.push(...(data.filled || []));
        setEnrichProgress(Math.min(100, ((i + BATCH) / chars.length) * 100));
      }
      
      setEnrichedChars(allFilled);
      setStep(5);
    } catch (err) {
      alert('填充失败: ' + err.message);
    } finally {
      setEnriching(false);
    }
  }

  async function handleImport() {
  setImporting(true);
  setImportProgress({ done: 0, total: enrichedChars.length });

  try {
    const sourceLabel = getSourceLabel();
    const subjectSlug = getSubjectSlug();
    const collectionSlug = getCollectionSlug();
    const gradeLevel = getGradeLevel();

    const charsWithOccurrence = enrichedChars.map(c => {
      const cand = candidates.find(x => x.char === c.char);
      return {
        ...c,
        first_source_label: sourceLabel,
        occurrence: {
          lesson_name: cand?.lesson_name || null,
          page_num: cand?.page_num || null,
          chunk_id: cand?.chunk_id || null,
        },
      };
    });

    const sourceContext = {
      source_type: getBackendSourceType(),
      source_id: getBackendSourceId(),
      source_label: sourceLabel,
      subject_slug: subjectSlug,
      collection_slug: collectionSlug,
      grade_level: gradeLevel,
    };

    // ── Split into batches of 50 and call sequentially ──
    const BATCH_SIZE = 50;
    const total = charsWithOccurrence.length;
    const aggregate = {
      total_added: 0,
      total_updated: 0,
      total_skipped: 0,
      total_occurrences_added: 0,
      errors: [],
    };

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = charsWithOccurrence.slice(i, i + BATCH_SIZE);
      const isLast = (i + BATCH_SIZE) >= total;

      const body = {
        job_id: jobId,
        source_context: sourceContext,
        characters: batch,
        final: isLast,  // tells server to mark job complete on last batch
      };

      const res = await fetch('/.netlify/functions/import-characters-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // Robust error handling — never crash on non-JSON
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `服务器返回非 JSON 响应 (status ${res.status}). ` +
          `前 200 字: ${text.slice(0, 200)}`
        );
      }

      if (!res.ok) {
        throw new Error(
          `批次 ${i + 1}-${Math.min(i + BATCH_SIZE, total)} 失败: ${data.error || 'unknown'}`
        );
      }

      aggregate.total_added += data.total_added || 0;
      aggregate.total_updated += data.total_updated || 0;
      aggregate.total_skipped += data.total_skipped || 0;
      aggregate.total_occurrences_added += data.total_occurrences_added || 0;
      if (Array.isArray(data.errors)) aggregate.errors.push(...data.errors);

      setImportProgress({ done: Math.min(i + BATCH_SIZE, total), total });
    }

    setImportResult(aggregate);
  } catch (err) {
    alert('入库失败: ' + err.message);
  } finally {
    setImporting(false);
  }
}

  function getSourceLabel() {
    if (sourceMode === 'document' && selectedDoc) {
      return `${selectedCollection?.name_zh || ''} · ${selectedDoc.title}`.trim();
    }
    return selectedCollection?.name_zh || '未知来源';
  }

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────
  
  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#8B4513' }}>
            🎯 从语料库提取字符
          </h2>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {STEPS.map(s => (
              <div
                key={s.n}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: step === s.n ? '#8B4513' : step > s.n ? '#D2691E' : '#f0f0f0',
                  color: step >= s.n ? '#fff' : '#999',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                <span style={{ marginRight: 6 }}>{s.icon}</span>
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {step === 1 && (
            <Step1Source
              collections={collections}
              selectedCollection={selectedCollection}
              setSelectedCollection={setSelectedCollection}
              documents={documents}
              selectedDoc={selectedDoc}
              setSelectedDoc={setSelectedDoc}
              sourceMode={sourceMode}
              setSourceMode={setSourceMode}
            />
          )}
          {step === 2 && (
            <Step2Method
              method={method}
              setMethod={setMethod}
              minFrequency={minFrequency}
              setMinFrequency={setMinFrequency}
              sourceLabel={getSourceLabel()}
            />
          )}
          {step === 3 && (
            <Step3Review
              candidates={candidates}
              selectedChars={selectedChars}
              setSelectedChars={setSelectedChars}
              extracting={extracting}
              extractError={extractError}
            />
          )}
          {step === 4 && (
            <Step4Enrich
              enriching={enriching}
              progress={enrichProgress}
              total={selectedChars.size}
              enrichedChars={enrichedChars}
            />
          )}
          {step === 5 && (
            <Step5Import
              enrichedChars={enrichedChars}
              setEnrichedChars={setEnrichedChars}
              importing={importing}
              result={importResult}
            />
          )}
        </div>

        {/* Footer nav */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e5e5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1 || extracting || enriching || importing}
            style={backBtnStyle(step === 1)}
          >
            ← 返回
          </button>
          
          <div style={{ fontSize: 13, color: '#999' }}>
            步骤 {step} / 5
          </div>

          <button
            onClick={() => {
              if (step === 1) {
                if (sourceMode === 'document' && !selectedDoc) {
                  alert('请选择一个文档');
                  return;
                }
                if (sourceMode === 'collection' && !selectedCollection) {
                  alert('请选择一个 collection');
                  return;
                }
                setStep(2);
              } else if (step === 2) {
                handleExtract();
              } else if (step === 3) {
                if (selectedChars.size === 0) {
                  alert('请至少选择一个字符');
                  return;
                }
                setStep(4);
                handleEnrich();
              } else if (step === 5) {
                if (importResult) {
                  onComplete?.();
                } else {
                  handleImport();
                }
              }
            }}
            disabled={extracting || enriching || importing}
            style={nextBtnStyle(extracting || enriching || importing)}
          >
            {step === 1 ? '下一步 →' :
             step === 2 ? (extracting ? '抓取中...' : '开始抓取') :
             step === 3 ? `填充详情 (${selectedChars.size} 字) →` :
             step === 4 ? (enriching ? '填充中...' : '下一步 →') :
             step === 5 ? (importing ? '入库中...' : importResult ? '完成 ✓' : '确认入库') :
             '下一步 →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Step components
// ─────────────────────────────────────────────────────

function Step1Source({ collections, selectedCollection, setSelectedCollection, documents, selectedDoc, setSelectedDoc, sourceMode, setSourceMode }) {
  return (
    <div>
      <h3 style={h3Style}>选择来源</h3>
      
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
          抓取范围:
        </label>
        <div style={{ display: 'flex', gap: 16 }}>
          {['document', 'collection'].map(mode => (
            <label key={mode} style={radioLabelStyle}>
              <input
                type="radio"
                checked={sourceMode === mode}
                onChange={() => setSourceMode(mode)}
              />
              <span>{mode === 'document' ? '单个文档' : '整个 Collection'}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>选择 Collection:</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {collections.map(c => (
            <button
              key={c.id}
              onClick={() => { setSelectedCollection(c); setSelectedDoc(null); }}
              style={{
                ...collectionCardStyle,
                ...(selectedCollection?.id === c.id ? {
                  borderColor: '#8B4513',
                  background: '#FFF8F0',
                } : {}),
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon || '📚'}</div>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{c.name_zh}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{c.slug}</div>
            </button>
          ))}
        </div>
      </div>

      {sourceMode === 'document' && selectedCollection && (
        <div>
          <label style={labelStyle}>
            选择文档 ({documents.length} 个 ready):
          </label>
          {documents.length === 0 ? (
            <div style={{ padding: 20, background: '#f5f5f5', borderRadius: 8, color: '#999', fontSize: 14 }}>
              这个 collection 里还没有 ready 的文档
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 8 }}>
              {documents.map(d => (
                <div
                  key={d.id}
                  onClick={() => setSelectedDoc(d)}
                  style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    background: selectedDoc?.id === d.id ? '#FFF8F0' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                    {d.chunk_count} chunks
                    {d.grade_level && ` · ${d.grade_level}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Step2Method({ method, setMethod, minFrequency, setMinFrequency, sourceLabel }) {
  return (
    <div>
      <h3 style={h3Style}>选择提取方式</h3>
      <div style={{ marginBottom: 20, padding: 12, background: '#FFF8F0', borderRadius: 8, fontSize: 14 }}>
        📚 抓取来源: <strong>{sourceLabel}</strong>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <MethodCard
          selected={method === 'shizi_biao'}
          onClick={() => setMethod('shizi_biao')}
          title="识字表"
          icon="📖"
          description="用 RAG 搜索 '识字表' / '生字表' 章节, AI 解析字符列表. 最精准, 带课文位置."
          recommended
        />
        <MethodCard
          selected={method === 'frequency'}
          onClick={() => setMethod('frequency')}
          title="高频字统计"
          icon="📊"
          description="扫描全文, 统计每个汉字出现次数, 取高频的. 无需识字表章节."
        />
      </div>

      {method === 'frequency' && (
        <div style={{ marginTop: 20 }}>
          <label style={labelStyle}>最小出现次数: {minFrequency}</label>
          <input
            type="range"
            min="2"
            max="20"
            value={minFrequency}
            onChange={e => setMinFrequency(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}

function Step3Review({ candidates, selectedChars, setSelectedChars, extracting, extractError }) {
  if (extracting) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>正在抓取候选字符...</div>
        <div style={{ fontSize: 13, color: '#999' }}>AI 正在解析识字表, 可能需要 1-3 分钟</div>
      </div>
    );
  }

  if (extractError) {
    return (
      <div style={{ padding: 20, background: '#fee', borderRadius: 8, border: '1px solid #fcc' }}>
        <div style={{ fontWeight: 500, marginBottom: 8, color: '#c00' }}>❌ 抓取失败</div>
        <div style={{ fontSize: 13 }}>{extractError}</div>
      </div>
    );
  }

  const toggleChar = (char) => {
    const next = new Set(selectedChars);
    if (next.has(char)) next.delete(char);
    else next.add(char);
    setSelectedChars(next);
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ ...h3Style, margin: 0 }}>审核候选字符</h3>
        <div style={{ fontSize: 13, color: '#666' }}>
          已选 <strong>{selectedChars.size}</strong> / {candidates.length}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setSelectedChars(new Set(candidates.map(c => c.char)))} style={smallBtnStyle}>
          全选
        </button>
        <button onClick={() => setSelectedChars(new Set())} style={smallBtnStyle}>
          全不选
        </button>
        <button 
          onClick={() => setSelectedChars(new Set(candidates.filter(c => !c.already_in_db).map(c => c.char)))}
          style={smallBtnStyle}
        >
          只选新字
        </button>
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 8 }}>
        {candidates.map((c, i) => (
          <div
            key={`${c.char}-${i}`}
            onClick={() => toggleChar(c.char)}
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid #f0f0f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: selectedChars.has(c.char) ? '#FFF8F0' : '#fff',
            }}
          >
            <input
              type="checkbox"
              checked={selectedChars.has(c.char)}
              onChange={() => toggleChar(c.char)}
              onClick={(e) => e.stopPropagation()}
            />
            <div style={{ fontSize: 28, fontWeight: 500, minWidth: 40 }}>{c.char}</div>
            <div style={{ flex: 1, fontSize: 13 }}>
              {c.pinyin_hint && <span style={{ color: '#666' }}>{c.pinyin_hint} · </span>}
              <span style={{ color: '#999' }}>{c.lesson_name || '(无课文信息)'}</span>
              {c.frequency && <span style={{ color: '#D2691E' }}> · 出现 {c.frequency} 次</span>}
              {c.already_in_db && (
                <div style={{ fontSize: 11, color: '#0a0', marginTop: 2 }}>
                  ✓ 已存在 {c.existing_sources.length > 0 && `(${c.existing_sources.join(', ')})`}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step4Enrich({ enriching, progress, total, enrichedChars }) {
  return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
      <div style={{ fontSize: 16, marginBottom: 16 }}>
        AI 正在填充字符详情 ({enrichedChars.length} / {total})
      </div>
      <div style={{
        width: '100%',
        height: 8,
        background: '#f0f0f0',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 16,
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: '#8B4513',
          transition: 'width 0.3s',
        }} />
      </div>
      <div style={{ fontSize: 13, color: '#999' }}>
        每批 10 字, 每次 AI 调用约 5 秒. 请稍候...
      </div>
    </div>
  );
}

function Step5Import({ enrichedChars, setEnrichedChars, importing, result }) {
  if (importing && progress && progress.total > 0) {
    const pct = Math.round((progress.done / progress.total) * 100);
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>💾</div>
        <div style={{ fontSize: 16, marginBottom: 16 }}>
          入库中 ({progress.done} / {progress.total})
        </div>
        <div style={{
          width: '100%', height: 8, background: '#f0f0f0',
          borderRadius: 4, overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: '#8B4513', transition: 'width 0.3s',
          }}/>
        </div>
        <div style={{ fontSize: 13, color: '#999' }}>每批 50 字 · 请勿关闭窗口</div>
      </div>
    );
  }
 
  
  if (result) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>入库成功!</div>
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
          maxWidth: 500, margin: '0 auto'
        }}>
          <StatCard label="新增" value={result.total_added} color="#0a7" />
          <StatCard label="更新" value={result.total_updated} color="#D2691E" />
          <StatCard label="跳过" value={result.total_skipped} color="#999" />
        </div>
        <div style={{ marginTop: 24, fontSize: 14, color: '#666' }}>
          共创建 {result.total_occurrences_added} 条来源记录
        </div>
      </div>
    );
  }

  const lowConfidence = enrichedChars.filter(c => c.needs_review);

  return (
    <div>
      <h3 style={h3Style}>审核并确认入库</h3>
      <div style={{ marginBottom: 16, padding: 12, background: '#FFF8F0', borderRadius: 8, fontSize: 14 }}>
        共 <strong>{enrichedChars.length}</strong> 个字符待入库
        {lowConfidence.length > 0 && (
          <span style={{ color: '#e69' }}>
            {' '}· ⚠️ {lowConfidence.length} 个 AI 置信度低, 需审核
          </span>
        )}
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 8 }}>
        {enrichedChars.map((c, i) => (
          <div
            key={`${c.char}-${i}`}
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: c.needs_review ? '#fef9ed' : '#fff',
            }}
          >
            <div style={{ fontSize: 28, minWidth: 40 }}>{c.char}</div>
            <div style={{ flex: 1, fontSize: 13 }}>
              <div>
                <strong>{c.pinyin}</strong>
                {c.strokes != null && ` · ${c.strokes} 画`}
                {c.radical && ` · 部首: ${c.radical}`}
                {c.hsk_level && ` · HSK ${c.hsk_level}`}
              </div>
              <div style={{ color: '#666', marginTop: 2 }}>
                {c.meaning_en}
                {c.example_word_zh && <span style={{ marginLeft: 8, color: '#999' }}>({c.example_word_zh})</span>}
              </div>
            </div>
            <div style={{
              fontSize: 11,
              color: c.ai_confidence > 0.85 ? '#0a7' : c.ai_confidence > 0.6 ? '#D2691E' : '#e69',
            }}>
              {Math.round((c.ai_confidence || 0) * 100)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Small components
// ─────────────────────────────────────────────────────

function MethodCard({ selected, onClick, title, icon, description, recommended }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 16,
        border: `2px solid ${selected ? '#8B4513' : '#e5e5e5'}`,
        borderRadius: 10,
        cursor: 'pointer',
        background: selected ? '#FFF8F0' : '#fff',
        position: 'relative',
      }}
    >
      {recommended && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 10, color: '#fff', background: '#0a7',
          padding: '2px 8px', borderRadius: 10,
        }}>
          推荐
        </div>
      )}
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon} {title}</div>
      <div style={{ fontSize: 13, color: '#666' }}>{description}</div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
      <div style={{ fontSize: 32, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontSize: 13, color: '#666' }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)', zIndex: 9999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const modalStyle = {
  width: '90%', maxWidth: 800, maxHeight: '90vh',
  background: '#fff', borderRadius: 12,
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
};

const closeBtnStyle = {
  background: 'none', border: 'none', fontSize: 24,
  cursor: 'pointer', color: '#999', padding: 4,
};

const h3Style = { margin: '0 0 16px 0', fontSize: 16, color: '#8B4513' };
const labelStyle = { display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500 };
const radioLabelStyle = { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' };
const smallBtnStyle = {
  padding: '6px 12px', fontSize: 12,
  background: '#f5f5f5', border: '1px solid #e5e5e5',
  borderRadius: 6, cursor: 'pointer',
};

const collectionCardStyle = {
  padding: 12,
  border: '2px solid #e5e5e5',
  borderRadius: 10,
  background: '#fff',
  cursor: 'pointer',
  textAlign: 'center',
};

const backBtnStyle = (disabled) => ({
  padding: '10px 20px',
  background: disabled ? '#f5f5f5' : '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: 8,
  cursor: disabled ? 'not-allowed' : 'pointer',
  color: disabled ? '#ccc' : '#333',
});

const nextBtnStyle = (disabled) => ({
  padding: '10px 24px',
  background: disabled ? '#ccc' : '#8B4513',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontWeight: 500,
});
