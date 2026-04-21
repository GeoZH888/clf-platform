// src/admin/CharacterImportWizard.jsx
//
// Phase 2B — 字符导入 Wizard (三种来源并轨)
//
//   1. 📚 Corpus — RAG 从教材抽取 (原 ExtractFromCorpusWizard)
//   2. 🎯 HSK   — AI 直接生成标准字表
//   3. 📝 Manual — 粘贴/CSV/文本手动导入
//
// Steps 统一:
//   Step 1: 选来源类型 (3 选 1)
//   Step 2: 配置参数 (因来源不同而异)
//   Step 3: 候选字符审核 (共用)
//   Step 4: AI 填充详情 (共用)
//   Step 5: 入库 (共用)
//
// Usage:
//   <CharacterImportWizard 
//     open={showWizard}
//     onClose={() => setShowWizard(false)}
//     onComplete={() => { setShowWizard(false); refreshList(); }}
//   />

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const STEPS = [
  { n: 1, label: '来源', icon: '📚' },
  { n: 2, label: '配置', icon: '⚙️' },
  { n: 3, label: '审核', icon: '✓' },
  { n: 4, label: 'AI 详情', icon: '🤖' },
  { n: 5, label: '入库', icon: '💾' },
];

// 3 种来源类型
const SOURCE_TYPES = {
  corpus: { label: '从 Corpus 抽取', icon: '📚', desc: '用 RAG 从教材 PDF 抽字. 绑定教材和课文位置.' },
  hsk:    { label: 'HSK 标准字表',   icon: '🎯', desc: 'AI 直接生成 HSK 标准字表 (2021 版). 干净, 无噪音.' },
  manual: { label: '手动/CSV 导入',   icon: '📝', desc: '粘贴字符列表, 上传 CSV, 或粘贴整段文本.' },
};

export default function CharacterImportWizard({ open, onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState(null);  // 'corpus' | 'hsk' | 'manual'
  
  // Corpus state
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [corpusMode, setCorpusMode] = useState('document');
  const [corpusMethod, setCorpusMethod] = useState('shizi_biao');
  const [minFrequency, setMinFrequency] = useState(5);
  
  // HSK state
  const [hskLevels, setHskLevels] = useState(new Set([1]));
  const [hskExcludeExisting, setHskExcludeExisting] = useState(true);
  
  // Manual state
  const [manualInputType, setManualInputType] = useState('list');  // 'list' | 'csv' | 'text'
  const [manualText, setManualText] = useState('');
  const [manualSourceLabel, setManualSourceLabel] = useState('');
  
  // Candidates state (shared)
  const [jobId, setJobId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedChars, setSelectedChars] = useState(new Set());
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  
  // Enrich state (shared)
  const [enrichedChars, setEnrichedChars] = useState([]);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  
  // Import state (shared)
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setSourceType(null);
      setExtractError(null);
      setImportResult(null);
      fetchCollections();
    }
  }, [open]);

  async function fetchCollections() {
    const { data } = await supabase
      .from('corpus_collections')
      .select('id, slug, name_zh, name_en, icon')
      .order('sort_order');
    setCollections(data || []);
  }

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
  // Branch handlers
  // ────────────────────────────────────────────────

  async function startCorpusExtract() {
    setExtracting(true);
    setExtractError(null);
    setStep(3);
    
    try {
      const body = {
        source_type: corpusMode === 'document' ? 'corpus_document' : 'corpus_collection',
        source_id: corpusMode === 'document' ? selectedDoc.id : selectedCollection.id,
        extraction_method: corpusMethod,
        config: corpusMethod === 'frequency' ? { min_frequency: minFrequency } : {},
      };

      await fetch('/.netlify/functions/extract-characters-candidates-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      await pollJob();
    } catch (err) {
      setExtractError(err.message);
      setExtracting(false);
    }
  }

  async function startHSKImport() {
    setExtracting(true);
    setExtractError(null);
    setStep(3);
    
    try {
      const body = {
        levels: [...hskLevels].sort(),
        exclude_existing: hskExcludeExisting,
        hsk_version: '2021',
      };

      await fetch('/.netlify/functions/import-hsk-characters-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      await pollJob();
    } catch (err) {
      setExtractError(err.message);
      setExtracting(false);
    }
  }

  async function startManualParse() {
    setExtracting(true);
    setExtractError(null);
    setStep(3);
    
    try {
      const res = await fetch('/.netlify/functions/parse-manual-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_type: manualInputType,
          raw_text: manualText,
          source_label: manualSourceLabel || '手动导入',
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'parse failed');
      
      // 手动导入不用后台 job, 直接设候选
      setCandidates(data.characters.map(c => ({ ...c, already_in_db: false })));
      setSelectedChars(new Set(data.characters.map(c => c.char)));
      setExtracting(false);
      
      // 无 job_id — 创建 pseudo job 让 import 步骤能用
      setJobId(null);
    } catch (err) {
      setExtractError(err.message);
      setExtracting(false);
    }
  }

  async function pollJob() {
    const maxAttempts = 120;
    let attempts = 0;
    
    const pollFn = async () => {
      attempts++;
      
      const { data, error } = await supabase
        .from('character_extraction_jobs')
        .select('*')
        .order('started_at', { ascending: false, nullsLast: true })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        setExtractError('查询失败: ' + error.message);
        setExtracting(false);
        return;
      }
      
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
        const defaultSelected = new Set(
          (data.candidates || []).filter(c => !c.already_in_db).map(c => c.char)
        );
        setSelectedChars(defaultSelected);
        setExtracting(false);
      } else if (data.status === 'error') {
        setExtractError(data.error_message || 'Unknown error');
        setExtracting(false);
      } else if (attempts < maxAttempts) {
        setTimeout(pollFn, 3000);
      } else {
        setExtractError('Timeout after 6 minutes');
        setExtracting(false);
      }
    };
    
    pollFn();
  }

  async function handleEnrich() {
    setEnriching(true);
    setEnrichProgress(0);
    
    // 如果来自 HSK AI, 候选里已经带了完整字段, 跳过 enrich
    // 检查第一个候选是否有 pinyin (表示已填好)
    const firstCand = candidates.find(c => selectedChars.has(c.char));
    if (firstCand && firstCand.pinyin) {
      // 已有详情 — 直接把选中的转成 enrichedChars
      const preEnriched = candidates
        .filter(c => selectedChars.has(c.char))
        .map(c => ({
          char: c.char,
          pinyin: c.pinyin,
          pinyin_tone: c.pinyin_tone,
          strokes: c.strokes,
          stroke_count: c.stroke_count || c.strokes,
          radical: c.radical,
          hsk_level: c.hsk_level,
          meaning_en: c.meaning_en,
          meaning_zh: c.meaning_zh,
          example_word_zh: c.example_word_zh,
          example_word_en: c.example_word_en,
          ai_confidence: c.ai_confidence || 0.9,
          needs_review: (c.ai_confidence || 1) < 0.7,
        }));
      setEnrichedChars(preEnriched);
      setEnrichProgress(100);
      setEnriching(false);
      setStep(5);
      return;
    }
    
    // 需要 AI 填详情
    const chars = [...selectedChars];
    const BATCH = 10;
    const allFilled = [];
    
    try {
      for (let i = 0; i < chars.length; i += BATCH) {
        const batch = chars.slice(i, i + BATCH);
        const res = await fetch('/.netlify/functions/enrich-character-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId, characters: batch }),
        });
        
        if (!res.ok) throw new Error('Enrich failed: ' + res.status);
        const data = await res.json();
        
        // Merge with user-provided data from candidates (for manual/csv)
        const filledWithUserData = (data.filled || []).map(f => {
          const cand = candidates.find(c => c.char === f.char);
          return {
            ...f,
            // User-provided values take precedence
            pinyin: cand?.pinyin || f.pinyin,
            meaning_en: cand?.meaning_en || f.meaning_en,
            hsk_level: cand?.hsk_level || f.hsk_level,
          };
        });
        
        allFilled.push(...filledWithUserData);
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

      const body = {
        job_id: jobId,
        source_context: {
          source_type: getBackendSourceType(),
          source_id: getBackendSourceId(),
          source_label: sourceLabel,
          subject_slug: subjectSlug,
          collection_slug: collectionSlug,
          grade_level: gradeLevel,
        },
        characters: charsWithOccurrence,
      };

      const res = await fetch('/.netlify/functions/import-characters-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      
      setImportResult(data);
    } catch (err) {
      alert('入库失败: ' + err.message);
    } finally {
      setImporting(false);
    }
  }

  // ─── Source label helpers ───
  function getSourceLabel() {
    if (sourceType === 'corpus') {
      if (corpusMode === 'document' && selectedDoc) {
        return `${selectedCollection?.name_zh || ''} · ${selectedDoc.title}`.trim();
      }
      return selectedCollection?.name_zh || 'Corpus';
    }
    if (sourceType === 'hsk') {
      return `HSK ${[...hskLevels].sort().join(',')}`;
    }
    if (sourceType === 'manual') {
      return manualSourceLabel || '手动导入';
    }
    return '未知';
  }
  
  function getSubjectSlug() {
    if (sourceType === 'corpus') return selectedDoc?.subject_slug || null;
    if (sourceType === 'hsk') return 'hsk';
    return null;
  }
  
  function getCollectionSlug() {
    if (sourceType === 'corpus') return selectedCollection?.slug || null;
    if (sourceType === 'hsk') return 'hsk';
    return null;
  }
  
  function getGradeLevel() {
    if (sourceType === 'corpus') return selectedDoc?.grade_level || null;
    if (sourceType === 'hsk') return `HSK ${[...hskLevels][0]}`;
    return null;
  }
  
  function getBackendSourceType() {
    if (sourceType === 'corpus') return corpusMode === 'document' ? 'corpus_document' : 'corpus_collection';
    if (sourceType === 'hsk') return 'hsk_official';
    return 'manual';
  }
  
  function getBackendSourceId() {
    if (sourceType === 'corpus') return corpusMode === 'document' ? selectedDoc?.id : selectedCollection?.id;
    return null;
  }

  // ────────────────────────────────────────────────
  // Navigation
  // ────────────────────────────────────────────────

  function handleNext() {
    if (step === 1) {
      if (!sourceType) { alert('请选择来源类型'); return; }
      setStep(2);
    } else if (step === 2) {
      // Validate + start extraction
      if (sourceType === 'corpus') {
        if (corpusMode === 'document' && !selectedDoc) { alert('请选择文档'); return; }
        if (corpusMode === 'collection' && !selectedCollection) { alert('请选择 collection'); return; }
        startCorpusExtract();
      } else if (sourceType === 'hsk') {
        if (hskLevels.size === 0) { alert('请至少选一个 HSK 级别'); return; }
        startHSKImport();
      } else if (sourceType === 'manual') {
        if (!manualText.trim()) { alert('请输入内容'); return; }
        startManualParse();
      }
    } else if (step === 3) {
      if (selectedChars.size === 0) { alert('请至少选一个字符'); return; }
      setStep(4);
      handleEnrich();
    } else if (step === 5) {
      if (importResult) {
        onComplete?.();
      } else {
        handleImport();
      }
    }
  }

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────
  
  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: 20, color: '#8B4513' }}>
            🎯 字符导入
          </h2>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map(s => (
              <div key={s.n} style={{
                flex: 1, padding: '6px 10px', borderRadius: 6,
                background: step === s.n ? '#8B4513' : step > s.n ? '#D2691E' : '#f0f0f0',
                color: step >= s.n ? '#fff' : '#999',
                fontSize: 12, textAlign: 'center',
              }}>
                <span style={{ marginRight: 4 }}>{s.icon}</span>{s.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {step === 1 && <Step1SourceType sourceType={sourceType} setSourceType={setSourceType} />}
          {step === 2 && sourceType === 'corpus' && (
            <Step2Corpus
              collections={collections} selectedCollection={selectedCollection} setSelectedCollection={setSelectedCollection}
              documents={documents} selectedDoc={selectedDoc} setSelectedDoc={setSelectedDoc}
              corpusMode={corpusMode} setCorpusMode={setCorpusMode}
              method={corpusMethod} setMethod={setCorpusMethod}
              minFrequency={minFrequency} setMinFrequency={setMinFrequency}
            />
          )}
          {step === 2 && sourceType === 'hsk' && (
            <Step2HSK
              hskLevels={hskLevels} setHskLevels={setHskLevels}
              excludeExisting={hskExcludeExisting} setExcludeExisting={setHskExcludeExisting}
            />
          )}
          {step === 2 && sourceType === 'manual' && (
            <Step2Manual
              inputType={manualInputType} setInputType={setManualInputType}
              text={manualText} setText={setManualText}
              sourceLabel={manualSourceLabel} setSourceLabel={setManualSourceLabel}
            />
          )}
          {step === 3 && (
            <Step3Review
              candidates={candidates} selectedChars={selectedChars} setSelectedChars={setSelectedChars}
              extracting={extracting} extractError={extractError}
            />
          )}
          {step === 4 && (
            <Step4Enrich enriching={enriching} progress={enrichProgress} total={selectedChars.size} enrichedChars={enrichedChars} />
          )}
          {step === 5 && (
            <Step5Import enrichedChars={enrichedChars} importing={importing} result={importResult} />
          )}
        </div>

        <div style={footerStyle}>
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1 || extracting || enriching || importing}
            style={backBtnStyle(step === 1)}
          >
            ← 返回
          </button>
          <div style={{ fontSize: 13, color: '#999' }}>步骤 {step} / 5</div>
          <button
            onClick={handleNext}
            disabled={extracting || enriching || importing}
            style={nextBtnStyle(extracting || enriching || importing)}
          >
            {step === 1 ? '下一步 →' :
             step === 2 ? '开始 →' :
             step === 3 ? `填充详情 (${selectedChars.size} 字) →` :
             step === 4 ? (enriching ? '填充中...' : '下一步 →') :
             step === 5 ? (importing ? '入库中...' : importResult ? '完成 ✓' : '确认入库') : '→'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Step 1: 选来源类型
// ─────────────────────────────────────────────────────

function Step1SourceType({ sourceType, setSourceType }) {
  return (
    <div>
      <h3 style={h3Style}>选择导入方式</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        {Object.entries(SOURCE_TYPES).map(([key, info]) => (
          <div key={key}
            onClick={() => setSourceType(key)}
            style={{
              padding: 20,
              border: `2px solid ${sourceType === key ? '#8B4513' : '#e5e5e5'}`,
              borderRadius: 10, cursor: 'pointer',
              background: sourceType === key ? '#FFF8F0' : '#fff',
            }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{info.icon} {info.label}</div>
            <div style={{ fontSize: 13, color: '#666' }}>{info.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Step 2a: Corpus 配置
// ─────────────────────────────────────────────────────

function Step2Corpus({ collections, selectedCollection, setSelectedCollection, documents, selectedDoc, setSelectedDoc, corpusMode, setCorpusMode, method, setMethod, minFrequency, setMinFrequency }) {
  return (
    <div>
      <h3 style={h3Style}>📚 从 Corpus 抽取配置</h3>
      
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>选择 Collection:</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {collections.map(c => (
            <button key={c.id}
              onClick={() => { setSelectedCollection(c); setSelectedDoc(null); }}
              style={{
                padding: 12, border: '2px solid',
                borderColor: selectedCollection?.id === c.id ? '#8B4513' : '#e5e5e5',
                borderRadius: 8, background: selectedCollection?.id === c.id ? '#FFF8F0' : '#fff',
                cursor: 'pointer', textAlign: 'center',
              }}>
              <div style={{ fontSize: 20 }}>{c.icon || '📚'}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name_zh}</div>
            </button>
          ))}
        </div>
      </div>
      
      {selectedCollection && documents.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>选择文档 ({documents.length} 个):</label>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 6 }}>
            {documents.map(d => (
              <div key={d.id}
                onClick={() => setSelectedDoc(d)}
                style={{
                  padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                  background: selectedDoc?.id === d.id ? '#FFF8F0' : '#fff', fontSize: 13,
                }}>
                <strong>{d.title}</strong>
                <span style={{ color: '#999', marginLeft: 8 }}>· {d.chunk_count} chunks</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>抽取方式:</label>
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { v: 'shizi_biao', l: '识字表 (RAG + AI)' },
            { v: 'frequency', l: '高频字统计' },
          ].map(o => (
            <label key={o.v} style={{ flex: 1, padding: 10, border: `2px solid ${method === o.v ? '#8B4513' : '#e5e5e5'}`, borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 13, background: method === o.v ? '#FFF8F0' : '#fff' }}>
              <input type="radio" checked={method === o.v} onChange={() => setMethod(o.v)} style={{ marginRight: 6 }}/>
              {o.l}
            </label>
          ))}
        </div>
      </div>
      
      {method === 'frequency' && (
        <div>
          <label style={labelStyle}>最小频率: {minFrequency}</label>
          <input type="range" min="2" max="20" value={minFrequency} onChange={e => setMinFrequency(+e.target.value)} style={{ width: '100%' }}/>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Step 2b: HSK 配置
// ─────────────────────────────────────────────────────

function Step2HSK({ hskLevels, setHskLevels, excludeExisting, setExcludeExisting }) {
  const toggle = (lv) => {
    const next = new Set(hskLevels);
    if (next.has(lv)) next.delete(lv);
    else next.add(lv);
    setHskLevels(next);
  };
  
  const LEVEL_INFO = [
    { lv: 1, count: 300, label: '入门' },
    { lv: 2, count: 300, label: '基础' },
    { lv: 3, count: 300, label: '进阶' },
    { lv: 4, count: 300, label: '中级' },
    { lv: 5, count: 300, label: '中高级' },
    { lv: 6, count: 300, label: '高级' },
    { lv: 7, count: 1200, label: '高级进阶 (7-9)' },
  ];
  
  return (
    <div>
      <h3 style={h3Style}>🎯 HSK 标准字表 (2021 版)</h3>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        AI 直接生成, 无噪音. 每级约 300 字, 一次性全自动入库.
      </p>
      
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>选择级别 (可多选):</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {LEVEL_INFO.map(({ lv, count, label }) => (
            <div key={lv}
              onClick={() => toggle(lv)}
              style={{
                padding: 12, border: `2px solid ${hskLevels.has(lv) ? '#8B4513' : '#e5e5e5'}`,
                borderRadius: 8, background: hskLevels.has(lv) ? '#FFF8F0' : '#fff',
                cursor: 'pointer', textAlign: 'center',
              }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: hskLevels.has(lv) ? '#8B4513' : '#333' }}>
                HSK {lv}
              </div>
              <div style={{ fontSize: 11, color: '#999' }}>{label}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>~{count} 字</div>
            </div>
          ))}
        </div>
      </div>
      
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={excludeExisting} onChange={e => setExcludeExisting(e.target.checked)}/>
        排除已在库的字符 (避免重复)
      </label>
      
      <div style={{ marginTop: 16, padding: 12, background: '#fffaef', borderRadius: 8, fontSize: 12, color: '#a66' }}>
        💡 HSK 1 约 300 字, 每级生成需 2-3 分钟. 多级勾选时耐心等待.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Step 2c: Manual 配置
// ─────────────────────────────────────────────────────

function Step2Manual({ inputType, setInputType, text, setText, sourceLabel, setSourceLabel }) {
  const placeholders = {
    list: '粘贴字符列表, 如:\n人\n口\n手\n或: 人,口,手',
    csv:  'char,pinyin,meaning_en,hsk_level\n人,rén,person,1\n口,kǒu,mouth,1',
    text: '粘贴任意中文文本, 自动提取唯一汉字:\n\n例: 今天我和朋友去学校,我们一起吃饭...',
  };
  
  return (
    <div>
      <h3 style={h3Style}>📝 手动/CSV 导入</h3>
      
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>输入格式:</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { v: 'list', l: '📋 字符列表' },
            { v: 'csv',  l: '📊 CSV' },
            { v: 'text', l: '📄 整段文本' },
          ].map(o => (
            <label key={o.v} style={{ flex: 1, padding: 10, border: `2px solid ${inputType === o.v ? '#8B4513' : '#e5e5e5'}`, borderRadius: 8, cursor: 'pointer', textAlign: 'center', fontSize: 13, background: inputType === o.v ? '#FFF8F0' : '#fff' }}>
              <input type="radio" checked={inputType === o.v} onChange={() => setInputType(o.v)} style={{ marginRight: 6 }}/>
              {o.l}
            </label>
          ))}
        </div>
      </div>
      
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>内容:</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholders[inputType]}
          style={{
            width: '100%', minHeight: 180, padding: 12, fontSize: 14, fontFamily: 'inherit',
            border: '1px solid #e5e5e5', borderRadius: 6, boxSizing: 'border-box',
          }}
        />
      </div>
      
      <div>
        <label style={labelStyle}>来源标签 (可选):</label>
        <input
          type="text"
          value={sourceLabel}
          onChange={e => setSourceLabel(e.target.value)}
          placeholder="例: 家庭常用字 / 第 1 次导入 / 春节字表"
          style={{
            width: '100%', padding: 10, fontSize: 14,
            border: '1px solid #e5e5e5', borderRadius: 6, boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Step 3 — 5 (shared with original wizard, condensed)
// ─────────────────────────────────────────────────────

function Step3Review({ candidates, selectedChars, setSelectedChars, extracting, extractError }) {
  if (extracting) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>正在处理...</div>
        <div style={{ fontSize: 13, color: '#999' }}>可能需要 1-5 分钟</div>
      </div>
    );
  }

  if (extractError) {
    return (
      <div style={{ padding: 20, background: '#fee', borderRadius: 8, border: '1px solid #fcc' }}>
        <div style={{ fontWeight: 500, marginBottom: 8, color: '#c00' }}>❌ 失败</div>
        <div style={{ fontSize: 13 }}>{extractError}</div>
      </div>
    );
  }

  const toggle = (char) => {
    const next = new Set(selectedChars);
    if (next.has(char)) next.delete(char);
    else next.add(char);
    setSelectedChars(next);
  };

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ ...h3Style, margin: 0 }}>审核候选字符</h3>
        <div style={{ fontSize: 13, color: '#666' }}>已选 <strong>{selectedChars.size}</strong> / {candidates.length}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={() => setSelectedChars(new Set(candidates.map(c => c.char)))} style={smallBtnStyle}>全选</button>
        <button onClick={() => setSelectedChars(new Set())} style={smallBtnStyle}>全不选</button>
        <button onClick={() => setSelectedChars(new Set(candidates.filter(c => !c.already_in_db).map(c => c.char)))} style={smallBtnStyle}>只选新字</button>
      </div>
      <div style={{ maxHeight: 350, overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 8 }}>
        {candidates.map((c, i) => (
          <div key={`${c.char}-${i}`} onClick={() => toggle(c.char)}
            style={{ padding: '8px 14px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, background: selectedChars.has(c.char) ? '#FFF8F0' : '#fff' }}>
            <input type="checkbox" checked={selectedChars.has(c.char)} onChange={() => toggle(c.char)} onClick={e => e.stopPropagation()}/>
            <div style={{ fontSize: 24, minWidth: 36 }}>{c.char}</div>
            <div style={{ flex: 1, fontSize: 12 }}>
              {c.pinyin && <strong>{c.pinyin}</strong>}
              {c.hsk_level && <span style={{ color: '#D2691E', marginLeft: 6 }}>HSK {c.hsk_level}</span>}
              {c.meaning_en && <span style={{ color: '#666', marginLeft: 6 }}>· {c.meaning_en}</span>}
              {c.lesson_name && <div style={{ color: '#999', fontSize: 11 }}>{c.lesson_name}</div>}
              {c.already_in_db && <div style={{ fontSize: 10, color: '#0a7' }}>✓ 已在库</div>}
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
        AI 填充详情 ({enrichedChars.length} / {total})
      </div>
      <div style={{ width: '100%', height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ width: `${progress}%`, height: '100%', background: '#8B4513', transition: 'width 0.3s' }}/>
      </div>
      <div style={{ fontSize: 13, color: '#999' }}>每批 10 字. 请稍候...</div>
    </div>
  );
}

function Step5Import({ enrichedChars, importing, result }) {
  if (result) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>入库成功!</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 500, margin: '0 auto' }}>
          <StatCard label="新增" value={result.total_added} color="#0a7"/>
          <StatCard label="更新" value={result.total_updated} color="#D2691E"/>
          <StatCard label="跳过" value={result.total_skipped} color="#999"/>
        </div>
      </div>
    );
  }
  
  const lowConf = enrichedChars.filter(c => c.needs_review);
  
  return (
    <div>
      <h3 style={h3Style}>审核并确认入库</h3>
      <div style={{ padding: 10, background: '#FFF8F0', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
        共 <strong>{enrichedChars.length}</strong> 字
        {lowConf.length > 0 && <span style={{ color: '#e69' }}> · ⚠ {lowConf.length} 需审核</span>}
      </div>
      <div style={{ maxHeight: 350, overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 6 }}>
        {enrichedChars.map((c, i) => (
          <div key={`${c.char}-${i}`}
            style={{ padding: 10, borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 12, alignItems: 'center', background: c.needs_review ? '#fef9ed' : '#fff' }}>
            <div style={{ fontSize: 24, minWidth: 36 }}>{c.char}</div>
            <div style={{ flex: 1, fontSize: 12 }}>
              <div><strong>{c.pinyin}</strong>{c.strokes != null && ` · ${c.strokes} 画`}{c.radical && ` · ${c.radical}`}{c.hsk_level && ` · HSK ${c.hsk_level}`}</div>
              <div style={{ color: '#666', marginTop: 2 }}>{c.meaning_en}{c.example_word_zh && ` (${c.example_word_zh})`}</div>
            </div>
            <div style={{ fontSize: 11, color: c.ai_confidence > 0.85 ? '#0a7' : c.ai_confidence > 0.6 ? '#D2691E' : '#e69' }}>
              {Math.round((c.ai_confidence || 0) * 100)}%
            </div>
          </div>
        ))}
      </div>
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
  width: '90%', maxWidth: 860, maxHeight: '90vh',
  background: '#fff', borderRadius: 12,
  display: 'flex', flexDirection: 'column', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
};
const headerStyle = { padding: '16px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const footerStyle = { padding: '14px 24px', borderTop: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const closeBtnStyle = { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#999' };
const h3Style = { margin: '0 0 14px 0', fontSize: 16, color: '#8B4513' };
const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 };
const smallBtnStyle = { padding: '4px 10px', fontSize: 12, background: '#f5f5f5', border: '1px solid #e5e5e5', borderRadius: 6, cursor: 'pointer' };
const backBtnStyle = (disabled) => ({
  padding: '9px 18px', background: disabled ? '#f5f5f5' : '#fff',
  border: '1px solid #e5e5e5', borderRadius: 8,
  cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#ccc' : '#333',
});
const nextBtnStyle = (disabled) => ({
  padding: '9px 22px', background: disabled ? '#ccc' : '#8B4513',
  color: '#fff', border: 'none', borderRadius: 8,
  cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 500,
});
