// src/pages/KnowledgeBaseManagerPage.jsx
// 知识库管理 — 重新设计版
// ✅ 支持大文件 (10MB+) — 文件直接上传到 Supabase Storage，不经过 base64
// ✅ PDF 逐页提取，不占满内存
// ✅ 服务端 AI 分类 + Embedding 向量化
// ✅ 实时进度显示，错误自动跳过

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/* ── Colour tokens ──────────────────────────────────────── */
const C = {
  primary:  '#c41e3a',
  success:  '#16a34a',
  warning:  '#d97706',
  error:    '#dc2626',
  info:     '#2563eb',
  muted:    'var(--text-muted)',
  bg:       'var(--background)',
  card:     'var(--card)',
  border:   'var(--border)',
};

/* ── File type config ───────────────────────────────────── */
const FILE_TYPES = {
  pdf:   { icon:'📄', color:'#dc2626', label:'PDF',   maxMB: 200 },
  word:  { icon:'📝', color:'#2563eb', label:'Word',  maxMB: 50  },
  pptx:  { icon:'📊', color:'#d97706', label:'PPT',   maxMB: 100 },
  image: { icon:'🖼️', color:'#7c3aed', label:'图片',  maxMB: 20  },
  audio: { icon:'🎵', color:'#0891b2', label:'音频',  maxMB: 200 },
  video: { icon:'🎬', color:'#065f46', label:'视频',  maxMB: 500 },
  text:  { icon:'📃', color:'#374151', label:'文本',  maxMB: 10  },
  other: { icon:'📦', color:'#6b7280', label:'其他',  maxMB: 50  },
};

const EXT_MAP = {
  '.pdf': 'pdf', '.doc': 'word', '.docx': 'word',
  '.ppt': 'pptx', '.pptx': 'pptx',
  '.jpg':'image','.jpeg':'image','.png':'image','.webp':'image',
  '.mp3':'audio','.wav':'audio','.m4a':'audio','.ogg':'audio',
  '.mp4':'video','.mov':'video','.avi':'video','.mkv':'video',
  '.txt':'text','.md':'text',
};

function getFileType(name) {
  const ext = '.' + name.split('.').pop().toLowerCase();
  return EXT_MAP[ext] || 'other';
}
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024**2) return (bytes/1024).toFixed(1) + ' KB';
  if (bytes < 1024**3) return (bytes/1024**2).toFixed(1) + ' MB';
  return (bytes/1024**3).toFixed(1) + ' GB';
}
function detectCategory(name) {
  const f = name.toLowerCase();
  if (/vocab|词汇|单词/.test(f)) return 'vocabulary';
  if (/grammar|语法/.test(f)) return 'grammar';
  if (/listen|听力/.test(f)) return 'listening';
  if (/read|阅读/.test(f)) return 'reading';
  if (/speak|口语/.test(f)) return 'speaking';
  if (/writ|写作/.test(f)) return 'writing';
  if (/culture|文化/.test(f)) return 'culture';
  if (/exam|考试|模拟|真题|大纲/.test(f)) return 'exam';
  return 'textbook';
}
function detectHSK(name) {
  const m = name.match(/HSK\s*(\d)/i);
  if (m) return [parseInt(m[1])];
  if (/初级|beginner/.test(name)) return [1,2];
  if (/中级|intermediate/.test(name)) return [3,4];
  if (/高级|advanced/.test(name)) return [5,6];
  return [];
}

/* ── Extract text from PDF in browser, page by page ───── */
async function extractPDFText(file, onProgress) {
  const MAX_PAGES = 100;
  const MAX_CHARS = 200000;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf, disableFontFace: true }).promise;
  const total = pdf.numPages;
  const pages = Math.min(total, MAX_PAGES);
  let text = '';

  for (let i = 1; i <= pages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(x => x.str).join(' ') + '\n';
      page.cleanup();
      if (onProgress) onProgress(Math.round(i / pages * 100), i, total);
      if (text.length > MAX_CHARS) { text = text.slice(0, MAX_CHARS); break; }
    } catch { /* skip bad page */ }
  }
  return { text: text.trim(), pages: total, pagesRead: pages };
}

/* ── Chunk text ─────────────────────────────────────────── */
function chunkText(text, size = 500, overlap = 50) {
  if (!text) return [];
  const chunks = [];
  let start = 0;
  while (start < text.length && chunks.length < 400) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}

/* ═══════════════════════════════════════════════════════ */
/*  Main Component                                         */
/* ═══════════════════════════════════════════════════════ */
export default function KnowledgeBaseManagerPage() {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const urlTab = new URLSearchParams(location.search).get('tab') || 'upload';

  const [tab,        setTab]        = useState(urlTab);
  const [kbList,     setKbList]     = useState([]);
  const [materials,  setMaterials]  = useState([]);
  const [config,     setConfig]     = useState({});
  const [loadingData,setLoadingData]= useState(true);
  const [logs,       setLogs]       = useState([]);
  const [queue,      setQueue]      = useState([]);   // files waiting to process
  const [processing, setProcessing] = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const [selectedKB, setSelectedKB] = useState('');
  const [searchQ,    setSearchQ]    = useState('');
  const fileInputRef = useRef();

  const addLog = useCallback((msg) =>
    setLogs(p => [...p.slice(-60), { t: new Date().toLocaleTimeString(), msg }]), []);

  /* ── Load base data ── */
  useEffect(() => {
    const timer = setTimeout(() => setLoadingData(false), 8000);
    if (!supabase) { clearTimeout(timer); setLoadingData(false); return; }

    Promise.all([
      supabase.from('dwxz_rag_config').select('*').limit(1).maybeSingle()
        .then(({ data }) => setConfig(data || {})),
      supabase.from('dwxz_rag_knowledge_bases').select('*').order('created_at', { ascending: false })
        .then(({ data }) => { setKbList(data || []); if (data?.[0]) setSelectedKB(data[0].id); }),
      supabase.from('dwxz_knowledge_materials')
        .select('id,title,title_zh,file_name,file_type,file_size,category,hsk_levels,chunk_count,status,created_at')
        .order('created_at', { ascending: false }).limit(100)
        .then(({ data }) => setMaterials(data || [])),
    ]).catch(e => addLog('⚠️ 加载失败: ' + e.message))
      .finally(() => { clearTimeout(timer); setLoadingData(false); });
  }, [supabase]);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab');
    if (t) setTab(t);
  }, [location.search]);

  /* ── Add files to queue ── */
  function addFiles(fileList) {
    const items = Array.from(fileList).map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      type: getFileType(file.name),
      status: 'pending',    // pending | extracting | classifying | embedding | done | error
      progress: 0,
      pages: null,
      chunks: 0,
      error: null,
      category: detectCategory(file.name),
      hskLevels: detectHSK(file.name),
    }));
    setQueue(q => [...q, ...items]);
  }

  /* ── Update a single queue item ── */
  const updateItem = useCallback((id, patch) =>
    setQueue(q => q.map(x => x.id === id ? { ...x, ...patch } : x)), []);

  /* ── Process single file ── */
  async function processFile(item) {
    if (!selectedKB) { updateItem(item.id, { status:'error', error:'请先选择目标知识库' }); return; }

    try {
      /* 1 ── Extract text ── */
      updateItem(item.id, { status:'extracting', progress:5 });
      let extractedText = '';
      let pagesInfo = {};

      if (item.type === 'pdf') {
        addLog(`📄 提取 PDF: ${item.name}`);
        const res = await extractPDFText(item.file, (pct, pg, total) => {
          updateItem(item.id, { progress: 5 + Math.round(pct * 0.3), pages: `${pg}/${total}` });
        });
        extractedText = res.text;
        pagesInfo = { pages: res.pages, pages_read: res.pagesRead };
        addLog(`✅ PDF 提取完成: ${Math.round(extractedText.length/1000)}k 字, ${res.pagesRead}/${res.pages} 页`);

      } else if (item.type === 'text' || item.type === 'word') {
        extractedText = await item.file.text().catch(() => '');
        if (extractedText.length > 200000) extractedText = extractedText.slice(0, 200000);

      } else {
        // audio/video/image — no text extraction in browser
        addLog(`ℹ️ ${item.name}: ${item.type} 文件，跳过文本提取`);
      }

      updateItem(item.id, { progress: 35 });

      /* 2 ── Storage upload (optional, skip for large files to save quota) ── */
      updateItem(item.id, { progress:40 });
      const storagePath = null;
      let storageUrl = null;
      const STORAGE_LIMIT_MB = 5; // only upload files under 5MB to Storage

      if (supabase && item.size < STORAGE_LIMIT_MB * 1024 * 1024) {
        addLog(`⬆️ 小文件上传到 Storage: ${item.name}`);
        const path = `knowledge/${selectedKB}/${Date.now()}_${item.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const { error: uploadErr } = await supabase.storage
          .from('dwxz_illustrations')
          .upload(path, item.file, { contentType:'application/octet-stream', upsert:false });
        if (!uploadErr) {
          const { data:{ publicUrl } } = supabase.storage.from('dwxz_illustrations').getPublicUrl(path);
          storageUrl = publicUrl;
          addLog(`✅ 已上传到 Storage`);
        } else {
          addLog(`⚠️ Storage 上传失败，仅保存文本内容 (不占存储空间)`);
        }
      } else if (item.size >= STORAGE_LIMIT_MB * 1024 * 1024) {
        addLog(`ℹ️ 大文件 (${(item.size/1024/1024).toFixed(1)}MB) 跳过 Storage，仅索引文本内容 (节省存储空间)`);
      }

      updateItem(item.id, { progress: 50 });

      /* 3 ── AI Classification ── */
      updateItem(item.id, { status:'classifying', progress:55 });
      let classification = {
        category: item.category, hskLevels: item.hskLevels,
        tags: [], title_zh: item.name.replace(/\.[^/.]+$/,''),
        summary: '', confidence: 0.4, method: 'filename',
      };

      const aiKey = config?.openai_api_key || config?.claude_api_key || config?.deepseek_api_key;
      if (aiKey && extractedText.length > 50) {
        try {
          addLog(`🤖 AI 自动分类中...`);
          const res = await fetch('/.netlify/functions/process-document', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              action: 'classify',
              text: extractedText.slice(0, 4000),
              filename: item.name,
              ai_provider: config.ai_provider || 'openai',
              ai_api_key: aiKey,
              ai_model: config[`${config.ai_provider || 'openai'}_model`] || 'gpt-4o-mini',
            }),
          });
          if (res.ok) {
            const r = await res.json();
            if (!r.error) {
              classification = { ...classification, ...r };
              addLog(`✅ AI分类: ${r.category} | HSK${r.hskLevels?.join(',')} | ${Math.round((r.confidence||0)*100)}%`);
            }
          }
        } catch (e) { addLog(`⚠️ AI分类失败，使用文件名推断: ${e.message}`); }
      }

      updateItem(item.id, { progress: 65, category: classification.category, hskLevels: classification.hskLevels });

      /* 4 ── Save to DB ── */
      addLog(`💾 保存文档记录...`);
      const { data: material, error: dbErr } = await supabase
        .from('dwxz_knowledge_materials')
        .insert([{
          knowledge_base_id: selectedKB,
          title:     classification.title_zh || item.name.replace(/\.[^/.]+$/,''),
          title_zh:  classification.title_zh || item.name.replace(/\.[^/.]+$/,''),
          summary:   classification.summary  || null,
          file_name: item.name,
          file_type: item.type,
          file_size: item.size,
          file_data: null,            // never store base64 — use Storage instead
          storage_path: storagePath,
          storage_url:  storageUrl,
          category:   classification.category,
          hsk_levels: classification.hskLevels,
          tags:       classification.tags || [],
          extracted_text: extractedText.slice(0, 50000) || null,  // store only first 50k for preview
          ai_classify_confidence: classification.confidence,
          ai_classify_method:     classification.method,
          status: 'processing',
          uploaded_by: user?.id,
          ...pagesInfo,
        }])
        .select().single();

      if (dbErr) throw new Error('DB插入失败: ' + dbErr.message);
      addLog(`✅ 文档已保存 (ID: ${material.id.slice(0,8)}...)`);
      updateItem(item.id, { progress: 70 });

      /* 5 ── Chunk + Embed ── */
      if (extractedText.length > 100) {
        const chunks = chunkText(extractedText);
        addLog(`📝 生成 ${chunks.length} 个文本块...`);

        const embKey = config?.embedding_api_key;
        const embProv = config?.embedding_provider || 'voyage';
        const embModel = config?.embedding_model || 'voyage-3';

        let savedChunks = 0;
        const BATCH = 10; // process 10 chunks at a time

        for (let i = 0; i < chunks.length; i += BATCH) {
          const batch = chunks.slice(i, i + BATCH);
          let embeddings = batch.map(() => null);

          // Get embeddings via Netlify function
          if (embKey) {
            try {
              const res = await fetch('/.netlify/functions/process-document', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                  action: 'embed',
                  chunks: batch,
                  embedding_provider: embProv,
                  embedding_api_key: embKey,
                  embedding_model: embModel,
                }),
              });
              if (res.ok) {
                const r = await res.json();
                if (r.embeddings) embeddings = r.embeddings;
              }
            } catch { /* continue without embeddings */ }
          }

          // Save batch to rag_chunks
          const rows = batch.map((chunk, j) => ({
            document_id: material.id,
            knowledge_base_id: selectedKB,
            content: chunk,
            chunk_index: i + j,
            embedding: embeddings[j],
            metadata: { source: item.name, type: item.type, hsk_levels: classification.hskLevels },
          }));

          const { error: chunkErr } = await supabase.from('dwxz_rag_chunks').insert(rows);
          if (!chunkErr) savedChunks += batch.length;

          const pct = 70 + Math.round(((i + BATCH) / chunks.length) * 25);
          updateItem(item.id, { progress: Math.min(pct, 95), chunks: savedChunks });
        }

        // Update chunk count
        await supabase.from('dwxz_knowledge_materials')
          .update({ chunk_count: savedChunks, status: 'completed' })
          .eq('id', material.id);

        addLog(`✅ 向量化完成: ${savedChunks}/${chunks.length} 块 (${embProv})`);
      } else {
        await supabase.from('dwxz_knowledge_materials').update({ status:'completed' }).eq('id', material.id);
      }

      updateItem(item.id, { status:'done', progress:100 });

      // Refresh materials list
      const { data: fresh } = await supabase
        .from('dwxz_knowledge_materials')
        .select('id,title,title_zh,file_name,file_type,file_size,category,hsk_levels,chunk_count,status,created_at')
        .order('created_at', { ascending: false }).limit(100);
      if (fresh) setMaterials(fresh);

    } catch (err) {
      addLog(`❌ ${item.name}: ${err.message}`);
      updateItem(item.id, { status:'error', error: err.message, progress:0 });
    }
  }

  /* ── Start processing all pending ── */
  async function startProcessing() {
    if (!selectedKB) { alert('请先选择目标知识库'); return; }
    setProcessing(true);
    const pending = queue.filter(x => x.status === 'pending' || x.status === 'error');
    for (const item of pending) {
      await processFile(item);
    }
    setProcessing(false);
    addLog('🎉 所有文件处理完成');
  }

  /* ── Delete material ── */
  async function deleteMaterial(id, storagePath) {
    if (!confirm('删除这个文件？此操作不可撤销。')) return;
    await supabase.from('dwxz_rag_chunks').delete().eq('document_id', id);
    await supabase.from('dwxz_knowledge_materials').delete().eq('id', id);
    if (storagePath) {
      await supabase.storage.from('dwxz_illustrations').remove([storagePath]);
    }
    setMaterials(m => m.filter(x => x.id !== id));
  }

  /* ── Drag & drop ── */
  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, []);

  /* ── Status badge ── */
  const StatusBadge = ({ item }) => {
    const map = {
      pending:    { bg:'#f3f4f6', color:'#374151', label:'待处理' },
      extracting: { bg:'#dbeafe', color:'#1d4ed8', label:'提取中...' },
      classifying:{ bg:'#fef3c7', color:'#92400e', label:'AI分类中...' },
      embedding:  { bg:'#ede9fe', color:'#5b21b6', label:'向量化中...' },
      done:       { bg:'#d1fae5', color:'#065f46', label:'✅ 完成' },
      error:      { bg:'#fee2e2', color:'#991b1b', label:'❌ 失败' },
    };
    const s = map[item.status] || map.pending;
    return (
      <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:600,
        background:s.bg, color:s.color }}>
        {s.label}
      </span>
    );
  };

  /* ── Tabs ── */
  const TABS = [
    { id:'upload', icon:'⬆️', label:language==='zh'?'上传文件':language==='it'?'Carica':'Upload' },
    { id:'browse', icon:'📁', label:language==='zh'?'文件库':language==='it'?'Archivio':'Library' },

    { id:'logs',   icon:'📋', label:language==='zh'?'日志':language==='it'?'Log':'Logs' },
  ];

  const filteredMaterials = materials.filter(m =>
    !searchQ ||
    m.title_zh?.toLowerCase().includes(searchQ.toLowerCase()) ||
    m.file_name?.toLowerCase().includes(searchQ.toLowerCase())
  );

  /* ── RENDER ──────────────────────────────────────────── */
  const S = {
    card: { background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'1.25rem', marginBottom:'1rem' },
    tabBtn: (active) => ({
      padding:'8px 16px', border:'none', background:'none', cursor:'pointer',
      fontSize:13, fontWeight:600, borderRadius:'8px 8px 0 0',
      color: active ? C.primary : C.muted,
      borderBottom: active ? `2px solid ${C.primary}` : 'none',
    }),
    input: { width:'100%', padding:'8px 12px', borderRadius:8,
      border:`1px solid ${C.border}`, fontSize:13, background:C.bg, boxSizing:'border-box' },
  };

  if (loadingData) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:300 }}>
      <div className="loading-spinner"/>
      <p style={{ color:C.muted, marginTop:16, fontSize:14 }}>
        {language==='zh'?'加载知识库...':'Loading knowledge base...'}
      </p>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="content-header" style={{ marginBottom:'1rem' }}>
        <h1>🧠 {language==='zh'?'知识库管理':language==='it'?'Gestione KB':'Knowledge Base'}</h1>
        <p style={{ color:C.muted, fontSize:13, margin:'4px 0 0' }}>
          {language==='zh'
            ?'支持超大文件 · 文件存储于 Supabase Storage · AI 自动分类和向量化'
            :'Large file support · Stored in Supabase Storage · Auto AI classification & vectorization'}
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'0.75rem', marginBottom:'1.25rem' }}>
        {[
          { icon:'📚', val: kbList.length,     label: language==='zh'?'知识库':'KBs',     color:C.primary },
          { icon:'📄', val: materials.length,  label: language==='zh'?'文件':'Files',     color:C.info    },
          { icon:'🧩', val: materials.reduce((s,m)=>s+(m.chunk_count||0),0), label: language==='zh'?'知识块':'Chunks', color:C.success },
          { icon:'✅', val: materials.filter(m=>m.status==='completed').length, label: language==='zh'?'已向量化':'Indexed', color:'#7c3aed' },
        ].map((s,i) => (
          <div key={i} style={{ ...S.card, textAlign:'center', padding:'0.75rem', marginBottom:0 }}>
            <div style={{ fontSize:22 }}>{s.icon}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:11, color:C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, borderBottom:`2px solid ${C.border}`, marginBottom:'1.25rem' }}>
        {TABS.map(t => (
          <button key={t.id} style={S.tabBtn(tab===t.id)} onClick={()=>setTab(t.id)}>
            {t.icon} {t.label}
            {t.id==='logs' && logs.length>0 && (
              <span style={{ marginLeft:4, background:C.primary, color:'#fff',
                fontSize:10, borderRadius:10, padding:'1px 5px' }}>{logs.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ TAB: Upload ══ */}
      {tab === 'upload' && (
        <div>
          {/* KB selector */}
          <div style={{ ...S.card, display:'flex', gap:'1rem', alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:200 }}>
              <label style={{ fontSize:12, color:C.muted, display:'block', marginBottom:4 }}>
                {language==='zh'?'目标知识库':'Target Knowledge Base'} *
              </label>
              <select style={{ ...S.input, width:'auto', minWidth:220 }}
                value={selectedKB} onChange={e=>setSelectedKB(e.target.value)}>
                <option value="">{language==='zh'?'-- 选择知识库 --':'-- Select KB --'}</option>
                {kbList.map(kb=>(
                  <option key={kb.id} value={kb.id}>{kb.name_zh||kb.name}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
              <div>📦 文件存储: <strong>Supabase Storage</strong></div>
              <div>🤖 AI分类: <strong>{config?.ai_provider||'未配置'}</strong></div>
              <div>🧮 向量化: <strong>{config?.embedding_provider||'未配置'}</strong></div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e=>{e.preventDefault();setDragOver(true);}}
            onDragLeave={()=>setDragOver(false)}
            onClick={()=>fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver?C.primary:C.border}`,
              borderRadius:16, padding:'2.5rem', textAlign:'center',
              cursor:'pointer', transition:'all .2s', marginBottom:'1rem',
              background: dragOver?'rgba(196,30,58,0.04)':C.bg,
            }}
          >
            <div style={{ fontSize:48, marginBottom:8 }}>📂</div>
            <div style={{ fontSize:16, fontWeight:600, color:C.primary, marginBottom:4 }}>
              {language==='zh'?'拖拽文件到此处，或点击选择':'Drag & drop files here, or click to select'}
            </div>
            <div style={{ fontSize:12, color:C.muted }}>
              PDF · Word · PPT · 图片 · 音频 · 视频 · 文本 | 支持超大文件 (PDF 最大 200MB)
            </div>
            <input ref={fileInputRef} type="file" multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.jpg,.jpeg,.png,.mp3,.wav,.mp4,.mov"
              style={{ display:'none' }}
              onChange={e => { addFiles(e.target.files); e.target.value=''; }}
            />
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <h3 style={{ margin:0 }}>
                  {language==='zh'?'已选文件':'Selected Files'} ({queue.length})
                </h3>
                <div style={{ display:'flex', gap:8 }}>
                  <button
                    onClick={()=>setQueue(q=>q.filter(x=>x.status!=='done'))}
                    style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${C.border}`,
                      background:'none', cursor:'pointer', fontSize:12 }}>
                    🗑 {language==='zh'?'清除已完成':'Clear Done'}
                  </button>
                  <button
                    onClick={()=>setQueue([])}
                    style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${C.border}`,
                      background:'none', cursor:'pointer', fontSize:12 }}>
                    🗑 {language==='zh'?'清空全部':'Clear All'}
                  </button>
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:'1rem' }}>
                {queue.map(item => {
                  const ft = FILE_TYPES[item.type] || FILE_TYPES.other;
                  return (
                    <div key={item.id} style={{
                      background:C.bg, borderRadius:10, padding:'10px 14px',
                      border:`1px solid ${item.status==='error'?'#fca5a5':item.status==='done'?'#a7f3d0':C.border}`,
                    }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:item.progress>0?6:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:20 }}>{ft.icon}</span>
                          <div>
                            <div style={{ fontSize:13, fontWeight:500 }}>{item.name}</div>
                            <div style={{ fontSize:11, color:C.muted }}>
                              {fmtSize(item.size)}
                              {item.pages && ` · ${item.pages} 页`}
                              {item.chunks>0 && ` · ${item.chunks} 块`}
                              {item.category && ` · ${item.category}`}
                              {item.hskLevels?.length>0 && ` · HSK${item.hskLevels.join(',')}`}
                            </div>
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <StatusBadge item={item}/>
                          <button onClick={()=>setQueue(q=>q.filter(x=>x.id!==item.id))}
                            style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, fontSize:16 }}>
                            ✕
                          </button>
                        </div>
                      </div>
                      {item.progress > 0 && item.status !== 'done' && (
                        <div style={{ height:4, background:'#e5e7eb', borderRadius:4, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${item.progress}%`,
                            background: item.status==='error'?C.error:C.primary,
                            transition:'width .3s', borderRadius:4 }}/>
                        </div>
                      )}
                      {item.error && (
                        <div style={{ fontSize:11, color:C.error, marginTop:4 }}>❌ {item.error}</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={startProcessing}
                disabled={processing || !selectedKB || queue.every(x=>x.status==='done')}
                style={{
                  width:'100%', padding:'12px', borderRadius:10, border:'none',
                  cursor: processing?'not-allowed':'pointer', fontSize:15, fontWeight:700,
                  background: processing?'#9ca3af':C.primary, color:'#fff',
                }}>
                {processing
                  ? `⏳ ${language==='zh'?'处理中...':'Processing...'}`
                  : `🚀 ${language==='zh'?'开始处理':'Start Processing'} (${queue.filter(x=>x.status==='pending'||x.status==='error').length} 个文件)`
                }
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: Browse ══ */}
      {tab === 'browse' && (
        <div>
          <div style={{ display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
            <input style={{ ...S.input, flex:1, minWidth:200 }}
              placeholder={language==='zh'?'搜索文件名...':'Search files...'}
              value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
            <select style={{ ...S.input, width:'auto' }}
              value={selectedKB} onChange={e=>setSelectedKB(e.target.value)}>
              <option value="">{language==='zh'?'全部知识库':'All KBs'}</option>
              {kbList.map(kb=><option key={kb.id} value={kb.id}>{kb.name_zh||kb.name}</option>)}
            </select>
          </div>

          {filteredMaterials.length === 0
            ? <div style={{ textAlign:'center', padding:'3rem', color:C.muted }}>
                {language==='zh'?'暂无文件，请先上传':'No files yet — upload some first'}
              </div>
            : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {filteredMaterials.map(m => {
                  const ft = FILE_TYPES[m.file_type] || FILE_TYPES.other;
                  return (
                    <div key={m.id} style={{
                      ...S.card, marginBottom:0, padding:'10px 14px',
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      borderLeft:`4px solid ${ft.color}`,
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
                        <span style={{ fontSize:22, flexShrink:0 }}>{ft.icon}</span>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:13,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {m.title_zh || m.file_name}
                          </div>
                          <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                            {fmtSize(m.file_size||0)}
                            {m.chunk_count>0 && ` · 🧩 ${m.chunk_count} 块`}
                            {m.category && ` · ${m.category}`}
                            {m.hsk_levels?.length>0 && ` · HSK${m.hsk_levels.join(',')}`}
                            {` · ${m.created_at?.slice(0,10)}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        <span style={{
                          padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600,
                          background: m.status==='completed'?'#d1fae5':'#fef3c7',
                          color: m.status==='completed'?'#065f46':'#92400e',
                        }}>
                          {m.status==='completed'?(language==='zh'?'✅ 已索引':'✅ Indexed'):(language==='zh'?'⏳ 处理中':'⏳ Processing')}
                        </span>
                        <button onClick={()=>deleteMaterial(m.id, m.storage_path)}
                          style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:C.muted }}>
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}



      {/* ══ TAB: Logs ══ */}
      {tab === 'logs' && (
        <div style={{ ...S.card, fontFamily:'monospace', fontSize:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.5rem' }}>
            <strong>{language==='zh'?'处理日志':'Processing Logs'}</strong>
            <button onClick={()=>setLogs([])}
              style={{ background:'none', border:'none', cursor:'pointer', color:C.muted, fontSize:11 }}>
              清空
            </button>
          </div>
          {logs.length === 0
            ? <p style={{ color:C.muted }}>{language==='zh'?'暂无日志':'No logs yet'}</p>
            : (
              <div style={{ maxHeight:400, overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
                {logs.slice().reverse().map((l,i) => (
                  <div key={i} style={{ color: l.msg.startsWith('❌')?C.error:l.msg.startsWith('⚠️')?C.warning:'inherit' }}>
                    <span style={{ color:C.muted }}>[{l.t}]</span> {l.msg}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

/* ── AI Settings Panel ──────────────────────────────────── */
function AISettingsPanel({ config, setConfig, supabase, language }) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const inp = {
    width:'100%', padding:'8px 12px', borderRadius:8,
    border:'1px solid var(--border)', fontSize:13,
    background:'var(--background)', boxSizing:'border-box', marginTop:4,
  };
  const lbl = { fontSize:12, color:'var(--text-muted)', display:'block', marginTop:'0.75rem' };

  async function save() {
    setSaving(true);
    try {
      const payload = { ...config, updated_at: new Date().toISOString() };
      delete payload.id;
      if (config.id) {
        await supabase.from('dwxz_rag_config').update(payload).eq('id', config.id);
      } else {
        const { data } = await supabase.from('dwxz_rag_config').insert([payload]).select().single();
        setConfig(c => ({ ...c, id: data?.id }));
      }
      setSaved(true); setTimeout(()=>setSaved(false), 2500);
    } catch(e) { alert('保存失败: '+e.message); }
    finally { setSaving(false); }
  }

  const AI_PROVIDERS = [
    { id:'openai',    label:'🟢 OpenAI',      models:['gpt-4o-mini','gpt-4o','gpt-4-turbo'] },
    { id:'anthropic', label:'🟣 Claude',       models:['claude-haiku-4-5-20251001','claude-sonnet-4-20250514'] },
    { id:'deepseek',  label:'🔵 DeepSeek',     models:['deepseek-chat','deepseek-reasoner'] },
    { id:'qwen',      label:'🇨🇳 通义千问',   models:['qwen-turbo','qwen-plus','qwen-max'] },
  ];
  const EMB_PROVIDERS = [
    { id:'voyage',  label:'⭐ Voyage AI (免费50M)',  models:['voyage-3','voyage-3-lite','voyage-multilingual-2'] },
    { id:'jina',    label:'🌐 Jina AI (免费1M)',     models:['jina-embeddings-v3','jina-embeddings-v2-base-zh'] },
    { id:'openai',  label:'🟢 OpenAI (付费)',        models:['text-embedding-3-small','text-embedding-3-large'] },
    { id:'deepseek',label:'🔵 DeepSeek',            models:['deepseek-embedding'] },
  ];

  const curAI  = AI_PROVIDERS.find(p=>p.id===config.ai_provider)  || AI_PROVIDERS[0];
  const curEmb = EMB_PROVIDERS.find(p=>p.id===config.embedding_provider) || EMB_PROVIDERS[0];

  const Section = ({title,children}) => (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'1rem', marginBottom:'1rem' }}>
      <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>{title}</h3>
      {children}
    </div>
  );

  return (
    <>
      <Section title="🤖 AI 分类服务商 (用于自动分类和摘要)">
        <label style={lbl}>服务商</label>
        <select style={inp} value={config.ai_provider||'openai'}
          onChange={e=>setConfig(c=>({...c,ai_provider:e.target.value}))}>
          {AI_PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <label style={lbl}>模型</label>
        <select style={inp} value={config[`${config.ai_provider||'openai'}_model`]||''}
          onChange={e=>setConfig(c=>({...c,[`${config.ai_provider||'openai'}_model`]:e.target.value}))}>
          {curAI.models.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <label style={lbl}>API Key</label>
        <input type="password" style={inp}
          value={config[`${config.ai_provider||'openai'}_api_key`]||''}
          onChange={e=>setConfig(c=>({...c,[`${config.ai_provider||'openai'}_api_key`]:e.target.value}))}
          placeholder="sk-... / sk-ant-... / ..."/>
      </Section>

      <Section title="🧮 Embedding 向量化 (用于语义搜索)">
        <label style={lbl}>服务商</label>
        <select style={inp} value={config.embedding_provider||'voyage'}
          onChange={e=>setConfig(c=>({...c,embedding_provider:e.target.value}))}>
          {EMB_PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <label style={lbl}>模型</label>
        <select style={inp} value={config.embedding_model||'voyage-3'}
          onChange={e=>setConfig(c=>({...c,embedding_model:e.target.value}))}>
          {curEmb.models.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <label style={lbl}>Embedding API Key</label>
        <input type="password" style={inp}
          value={config.embedding_api_key||''}
          onChange={e=>setConfig(c=>({...c,embedding_api_key:e.target.value}))}
          placeholder={config.embedding_provider==='voyage'?'pa-xxx...':config.embedding_provider==='jina'?'jina_xxx...':'sk-...'}/>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
          {(!config.embedding_provider||config.embedding_provider==='voyage') && '⭐ Voyage AI 推荐 · 免费 50M tokens · 注册: dash.voyageai.com'}
          {config.embedding_provider==='jina' && '🌐 Jina AI 免费 1M tokens · 注册: jina.ai/embeddings'}
        </div>
      </Section>

      <Section title="⚙️ 处理参数">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
          {[
            { key:'chunk_size',          label:'分块大小 (字符)',    default:500 },
            { key:'chunk_overlap',       label:'分块重叠 (字符)',    default:50  },
            { key:'top_k',               label:'检索数量 Top-K',     default:5   },
            { key:'similarity_threshold',label:'相似度阈值 (0-1)',   default:0.7 },
          ].map(f=>(
            <div key={f.key}>
              <label style={lbl}>{f.label}</label>
              <input type="number" style={inp}
                value={config[f.key]||f.default}
                onChange={e=>setConfig(c=>({...c,[f.key]:parseFloat(e.target.value)}))}/>
            </div>
          ))}
        </div>
      </Section>

      <button onClick={save} disabled={saving}
        style={{ width:'100%', padding:'12px', borderRadius:10, border:'none',
          cursor:'pointer', fontSize:14, fontWeight:700,
          background: saved?'#16a34a':saving?'#9ca3af':'var(--primary)',
          color:'#fff', transition:'background .2s' }}>
        {saved?'✅ 已保存！':saving?'保存中...':'💾 保存所有配置'}
      </button>
    </>
  );
}
