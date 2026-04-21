// src/admin/CorpusTab.jsx
// v2 — features:
//   【1】 UI-based collection management (add new collection like 苏教版)
//   【2】 Subjects (语文/数学/科学/...) + Grade level (一年级上册) on upload
//   【3】 AI provider dropdown with live 🟢/🔴 status dots
//   【4】 Triple filter on search: Collection × Subject × Grade

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  verm:'#8B4513', green:'#2E7D32', blue:'#1565C0', purple:'#6A1B9A',
};

const AI_PROVIDERS = [
  { id:'claude',   label:'Claude',   envKey:'ANTHROPIC_API_KEY' },
  { id:'deepseek', label:'DeepSeek', envKey:'DEEPSEEK_API_KEY' },
  { id:'openai',   label:'GPT-4o',   envKey:'OPENAI_API_KEY' },
  { id:'gemini',   label:'Gemini',   envKey:'GEMINI_API_KEY' },
  { id:'qwen',     label:'通义千问',  envKey:'QWEN_API_KEY' },
];

const COLLECTION_COLOR_PRESETS = [
  '#1565C0', '#2E7D32', '#8B4513', '#6A1B9A', '#C62828',
  '#E65100', '#00796B', '#AD1457', '#37474F', '#5D4037',
];

export default function CorpusTab() {
  const [collections, setCollections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedColl, setSelectedColl] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Upload with subject + grade metadata
  const [uploading, setUploading] = useState(false);
  const [uploadSubject, setUploadSubject] = useState('');
  const [uploadGrade, setUploadGrade] = useState('');
  const [uploadLog, setUploadLog] = useState([]);
  const [autoDetect, setAutoDetect] = useState(true);
  const [batchProgress, setBatchProgress] = useState(null); // {completed, total, failed}
  const fileInputRef = useRef();
  const zipInputRef = useRef();
  const folderInputRef = useRef();

  // Add-collection modal
  const [showAddColl, setShowAddColl] = useState(false);

  // Search: triple filter + AI provider
  const [searchQuery, setSearchQuery] = useState('');
  const [searchColl, setSearchColl] = useState('');
  const [searchSubject, setSearchSubject] = useState('');
  const [searchGrade, setSearchGrade] = useState('');
  const [searchProvider, setSearchProvider] = useState('claude');
  const [synthesize, setSynthesize] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);

  // Provider status (🟢/🔴 dots)
  const [providerStatus, setProviderStatus] = useState({});

  // Distinct grade levels (for dropdown)
  const [gradeLevels, setGradeLevels] = useState([]);

  const log = (msg) => setUploadLog(l => [`${new Date().toLocaleTimeString()} ${msg}`, ...l].slice(0, 15));

  // Load collections + subjects + provider status on mount
  useEffect(() => {
    Promise.all([
      supabase.from('corpus_collections').select('*').order('sort_order'),
      supabase.from('corpus_subjects').select('*').order('sort_order'),
      fetch('/.netlify/functions/rag-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_status: true }),
      }).then(r => r.json()).catch(() => ({ provider_status: {} })),
    ]).then(([collRes, subjRes, statusRes]) => {
      const colls = collRes.data || [];
      setCollections(colls);
      setSubjects(subjRes.data || []);
      setProviderStatus(statusRes.provider_status || {});
      if (colls[0]) setSelectedColl(colls[0].id);
      setLoading(false);
    });
  }, []);

  // Load documents + refresh grade list when collection changes
  const loadDocs = useCallback(() => {
    if (!selectedColl) return;
    supabase.from('corpus_documents')
      .select('*')
      .eq('collection_id', selectedColl)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocuments(data || []));

    supabase.rpc('list_grade_levels').then(({ data }) => {
      setGradeLevels(data || []);
    });
  }, [selectedColl]);

  useEffect(loadDocs, [loadDocs]);

  // Poll if any doc is still processing
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'pending' || d.status === 'processing');
    if (!hasProcessing) return;
    const t = setInterval(loadDocs, 3000);
    return () => clearInterval(t);
  }, [documents, loadDocs]);

  // ── File upload ─────────────────────────────────────────────────────
  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !selectedColl) return;

    // Delegate to the concurrent batch uploader
    const syntheticEvent = { target: { files } };
    await handleFolderSelect(syntheticEvent);

    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── ZIP upload: one file, processed server-side to extract + auto-tag ───
  async function handleZipSelect(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedColl) return;

    const collection = collections.find(c => c.id === selectedColl);
    if (!collection) return;

    setUploading(true);
    try {
      log(`🗜 上传 ZIP ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)…`);

      const safePath = `${collection.slug}/_zip_${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
      const { error: upErr } = await supabase.storage
        .from('corpus-files')
        .upload(safePath, file, { contentType: 'application/zip', upsert: false });
      if (upErr) throw upErr;

      log(`✓ ZIP 已上传, 开始解压 + AI 分析…`);

      fetch('/.netlify/functions/process-zip-corpus-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zip_storage_path: safePath,
          collection_id:    collection.id,
          auto_detect:      autoDetect,
        }),
      }).then(r => {
        if (r.status === 202) {
          log(`⏳ 后台解压中, 文件将逐一出现…`);
          loadDocs();
          return null;
        }
        return r.json();
      }).then(d => {
        if (!d) return;
        if (d.error) log(`✗ ZIP: ${d.error}`);
        else log(`✓ ZIP: 创建 ${d.created} 个文档, 跳过 ${d.skipped}, 失败 ${d.errors?.length || 0}`);
        loadDocs();
      }).catch(err => {
        log(`✗ ZIP: ${err.message}`);
      });
    } catch (err) {
      log(`✗ ${file.name}: ${err.message}`);
    } finally {
      setUploading(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  }

  // ── Folder upload: concurrent batch upload with progress tracking ───────
  // Strategy: upload files in parallel (CONCURRENCY=3) so a 1GB folder
  // can flow through quickly. Also handles multi-file mode.
  async function handleFolderSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !selectedColl) return;

    const collection = collections.find(c => c.id === selectedColl);
    if (!collection) return;

    const supportedExts = ['pdf','docx','doc','xlsx','xls','txt','json','csv','md'];
    const validFiles = files.filter(f => {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      return supportedExts.includes(ext);
    });
    const skipped = files.length - validFiles.length;

    if (validFiles.length === 0) {
      log(`✗ 没有支持的文件格式`);
      return;
    }

    const totalBytes = validFiles.reduce((sum, f) => sum + f.size, 0);
    const totalMB = (totalBytes / 1024 / 1024).toFixed(1);

    setUploading(true);
    setBatchProgress({ completed: 0, total: validFiles.length, failed: 0 });
    log(`📁 开始上传 ${validFiles.length} 个文件 (${totalMB}MB)${skipped ? `, 跳过 ${skipped} 个不支持` : ''}`);

    const CONCURRENCY = 3;
    let completed = 0;
    let failed = 0;
    let nextIdx = 0;

    async function uploadOne(file) {
      const relativePath = file.webkitRelativePath || file.name;
      const safeName = file.name.replace(/[^A-Za-z0-9_.\-]/g, '_');
      const storagePath = `${collection.slug}/${Date.now()}_${Math.random().toString(36).slice(2,6)}_${safeName}`;

      try {
        const detectedSubject = autoDetect ? detectSubjectClient(relativePath) : null;
        const detectedGrade   = autoDetect ? detectGradeClient(relativePath)   : null;

        const { error: upErr } = await supabase.storage
          .from('corpus-files')
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;

        const { data: doc, error: docErr } = await supabase
          .from('corpus_documents')
          .insert({
            collection_id: collection.id,
            title:         file.name.replace(/\.\w+$/, ''),
            storage_path:  storagePath,
            file_size:     file.size,
            mime_type:     file.type,
            subject_slug:  detectedSubject || uploadSubject || null,
            grade_level:   detectedGrade   || uploadGrade   || null,
            status:        'pending',
            status_message: relativePath !== file.name ? `来自文件夹: ${relativePath}` : null,
          })
          .select()
          .single();
        if (docErr) throw docErr;

        fetch('/.netlify/functions/process-document-background', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            document_id:   doc.id,
            storage_path:  storagePath,
            mime_type:     file.type,
            collection_id: collection.id,
          }),
        }).catch(() => {});

        const tags = [];
        if (detectedSubject) tags.push(`[${detectedSubject}]`);
        if (detectedGrade) tags.push(`[${detectedGrade}]`);
        log(`✓ ${relativePath}${tags.length ? ' ' + tags.join(' ') : ''}`);
        return { ok: true };
      } catch (err) {
        log(`✗ ${relativePath}: ${err.message}`);
        return { ok: false, error: err.message };
      }
    }

    async function worker() {
      while (true) {
        const i = nextIdx++;
        if (i >= validFiles.length) break;
        const result = await uploadOne(validFiles[i]);
        if (result.ok) completed++;
        else failed++;
        setBatchProgress({ completed, total: validFiles.length, failed });
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, validFiles.length) }, () => worker());
    await Promise.all(workers);

    loadDocs();
    setUploading(false);
    setBatchProgress(null);
    if (folderInputRef.current) folderInputRef.current.value = '';
    log(`✓ 批量上传完成: ${completed} 成功, ${failed} 失败`);
  }

  // ── Client-side rule-based detectors (same patterns as server) ─────────
  function detectSubjectClient(path) {
    const p = path.toLowerCase();
    if (/语文|yuwen|汉语/.test(p))                            return 'yuwen';
    if (/数学|shuxue|math/.test(p))                            return 'shuxue';
    if (/英语|yingyu|english/.test(p))                         return 'yingyu';
    if (/科学|kexue|science/.test(p))                          return 'kexue';
    if (/历史|lishi|history/.test(p))                          return 'lishi';
    if (/地理|dili|geography/.test(p))                         return 'dili';
    if (/音乐|yinyue|music/.test(p))                           return 'yinyue';
    if (/美术|meishu|art/.test(p))                             return 'meishu';
    if (/体育|tiyu/.test(p))                                    return 'tiyu';
    if (/\bhsk\b/.test(p))                                    return 'hsk';
    if (/成语|chengyu|idiom/.test(p))                          return 'chengyu';
    if (/文化|wenhua|culture/.test(p))                         return 'wenhua';
    if (/文学|wenxue|literature/.test(p))                      return 'wenxue';
    if (/诗歌|shige|poetry|古诗/.test(p))                      return 'shige';
    if (/汉字|hanzi/.test(p))                                   return 'hanzi';
    return null;
  }

  function detectGradeClient(path) {
    const grades = [
      [/一年级\s*上/, '一年级上册'], [/一年级\s*下/, '一年级下册'],
      [/二年级\s*上/, '二年级上册'], [/二年级\s*下/, '二年级下册'],
      [/三年级\s*上/, '三年级上册'], [/三年级\s*下/, '三年级下册'],
      [/四年级\s*上/, '四年级上册'], [/四年级\s*下/, '四年级下册'],
      [/五年级\s*上/, '五年级上册'], [/五年级\s*下/, '五年级下册'],
      [/六年级\s*上/, '六年级上册'], [/六年级\s*下/, '六年级下册'],
      [/七年级\s*上/, '七年级上册'], [/七年级\s*下/, '七年级下册'],
      [/八年级\s*上/, '八年级上册'], [/八年级\s*下/, '八年级下册'],
      [/九年级\s*上/, '九年级上册'], [/九年级\s*下/, '九年级下册'],
      [/高一/, '高一'], [/高二/, '高二'], [/高三/, '高三'],
    ];
    for (const [re, g] of grades) {
      if (re.test(path)) return g;
    }
    const hskMatch = path.match(/hsk\s*[- ]?\s*([1-9])/i);
    if (hskMatch) return `HSK ${hskMatch[1]}`;
    return null;
  }

  async function handleDelete(doc) {
    if (!confirm(`删除 "${doc.title}" 及其所有 chunks?`)) return;
    if (doc.storage_path) {
      await supabase.storage.from('corpus-files').remove([doc.storage_path]);
    }
    await supabase.from('corpus_documents').delete().eq('id', doc.id);
    loadDocs();
  }

  async function handleReprocess(doc) {
    await supabase.from('corpus_documents')
      .update({ status: 'pending', status_message: '重新入列…' })
      .eq('id', doc.id);
    loadDocs();
    fetch('/.netlify/functions/process-document-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id:   doc.id,
        storage_path:  doc.storage_path,
        mime_type:     doc.mime_type,
        collection_id: doc.collection_id,
      }),
    }).then(() => loadDocs()).catch(() => loadDocs());
  }

  async function handleEditDocMeta(doc) {
    const subjOptions = subjects.map(s => `  ${s.slug} — ${s.icon} ${s.name_zh}`).join('\n');
    const newSubject = prompt(
      `学科 slug (留空=清除). 可选:\n${subjOptions}\n(也可输入自定义 slug)`,
      doc.subject_slug || ''
    );
    if (newSubject === null) return;
    const newGrade = prompt('年级/等级 (例如: 三年级上册, HSK 4, 留空=清除):', doc.grade_level || '');
    if (newGrade === null) return;
    await supabase.from('corpus_documents').update({
      subject_slug: newSubject.trim() || null,
      grade_level:  newGrade.trim()   || null,
    }).eq('id', doc.id);
    loadDocs();
  }

  // ── Search ──────────────────────────────────────────────────────────
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch('/.netlify/functions/rag-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query:           searchQuery,
          collection_slug: searchColl    || null,
          subject_slug:    searchSubject || null,
          grade_level:     searchGrade   || null,
          provider:        searchProvider,
          synthesize,
          match_count:     8,
          match_threshold: 0.4,
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setSearchResult(d);
    } catch (err) {
      setSearchResult({ error: err.message });
    } finally {
      setSearching(false);
    }
  }

  async function refreshProviderStatus() {
    const res = await fetch('/.netlify/functions/rag-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list_status: true }),
    });
    const d = await res.json();
    setProviderStatus(d.provider_status || {});
  }

  function statusDot(providerId) {
    if (providerStatus[providerId] === true)  return '🟢';
    if (providerStatus[providerId] === false) return '🔴';
    return '⚪';
  }

  if (loading) return <div style={{ padding: 20 }}>加载中…</div>;
  const currentColl = collections.find(c => c.id === selectedColl);

  return (
    <div style={{ padding:'0 2px' }}>

      {/* ── Collection tabs + Add button ── */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {collections.map(c => {
          const active = c.id === selectedColl;
          return (
            <button key={c.id} onClick={() => setSelectedColl(c.id)}
              style={{ padding:'8px 16px', borderRadius:10, cursor:'pointer',
                border: active ? `2px solid ${c.color}` : `1px solid ${V.border}`,
                background: active ? `${c.color}15` : V.card,
                color: active ? c.color : V.text2,
                fontSize:13, fontWeight: active ? 600 : 400 }}>
              {c.icon} {c.name_zh}
            </button>
          );
        })}
        <button onClick={() => setShowAddColl(true)}
          style={{ padding:'8px 14px', borderRadius:10, cursor:'pointer',
            border:`1px dashed ${V.verm}`, background:'transparent', color:V.verm,
            fontSize:12, fontWeight:600 }}>
          + 新 collection
        </button>
      </div>

      {/* ── Upload area (with subject + grade metadata) ── */}
      {currentColl && (
        <div style={{ background: `${currentColl.color}10`,
          border:`2px dashed ${currentColl.color}40`,
          borderRadius:12, padding:'14px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:600, color: currentColl.color, fontSize:13, marginBottom:10 }}>
            📤 上传文档到 {currentColl.name_zh}
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div>
              <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>学科 (可选)</label>
              <select value={uploadSubject} onChange={e => setUploadSubject(e.target.value)}
                style={{ padding:'5px 8px', fontSize:12, borderRadius:6,
                  border:`1px solid ${V.border}`, background:V.card, minWidth:160 }}>
                <option value="">— 未选 —</option>
                {subjects.map(s => (
                  <option key={s.slug} value={s.slug}>{s.icon} {s.name_zh}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>年级/等级 (可选)</label>
              <input type="text" value={uploadGrade}
                onChange={e => setUploadGrade(e.target.value)}
                placeholder="例: 三年级上册 或 HSK 4"
                style={{ padding:'5px 8px', fontSize:12, borderRadius:6,
                  border:`1px solid ${V.border}`, background:V.card, width:200 }}/>
            </div>
          </div>

          <div style={{ fontSize:11, color:V.text3, marginBottom:8 }}>
            支持 PDF · Word · Excel · TXT · JSON · CSV · ZIP 打包 · 文件夹 (单文件 500MB, 多文件并行, 总大小无限)
          </div>

          {/* Three upload modes */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:6 }}>
            {/* Multi-file */}
            <button type="button" onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ padding:'7px 14px', fontSize:12, borderRadius:8, cursor:'pointer',
                border:`1px solid ${currentColl.color}`,
                background: uploading ? '#E0E0E0' : V.card,
                color: uploading ? '#aaa' : currentColl.color, fontWeight:500 }}>
              📄 多文件
            </button>
            <input type="file" ref={fileInputRef}
              multiple
              accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.json,.csv,.md"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ display:'none' }}/>

            {/* ZIP */}
            <button type="button" onClick={() => zipInputRef.current?.click()}
              disabled={uploading}
              style={{ padding:'7px 14px', fontSize:12, borderRadius:8, cursor:'pointer',
                border:`1px solid ${currentColl.color}`,
                background: uploading ? '#E0E0E0' : V.card,
                color: uploading ? '#aaa' : currentColl.color, fontWeight:500 }}>
              🗜 ZIP 压缩包
            </button>
            <input type="file" ref={zipInputRef}
              accept=".zip"
              onChange={handleZipSelect}
              disabled={uploading}
              style={{ display:'none' }}/>

            {/* Folder */}
            <button type="button" onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
              style={{ padding:'7px 14px', fontSize:12, borderRadius:8, cursor:'pointer',
                border:`1px solid ${currentColl.color}`,
                background: uploading ? '#E0E0E0' : V.card,
                color: uploading ? '#aaa' : currentColl.color, fontWeight:500 }}>
              📁 文件夹
            </button>
            <input type="file" ref={folderInputRef}
              webkitdirectory="true"
              directory="true"
              multiple
              onChange={handleFolderSelect}
              disabled={uploading}
              style={{ display:'none' }}/>

            <label style={{ display:'flex', alignItems:'center', gap:4,
              fontSize:11, color:V.text2, marginLeft:8 }}>
              <input type="checkbox" checked={autoDetect}
                onChange={e => setAutoDetect(e.target.checked)}/>
              AI 自动推测 学科/年级
            </label>
          </div>

          {uploading && <div style={{ fontSize:11, color:V.text2, marginTop:6 }}>上传中…</div>}

          {/* Batch progress bar */}
          {batchProgress && batchProgress.total > 1 && (
            <div style={{ marginTop:8, padding:'10px 12px', background:V.card,
              border:`1px solid ${V.border}`, borderRadius:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between',
                fontSize:11, color:V.text2, marginBottom:5 }}>
                <span>📊 批量上传进度</span>
                <span>{batchProgress.completed + batchProgress.failed}/{batchProgress.total}
                  {batchProgress.failed > 0 && ` (失败 ${batchProgress.failed})`}</span>
              </div>
              <div style={{ height:6, background:'#e8d5b0', borderRadius:3, overflow:'hidden' }}>
                <div style={{
                  height:'100%',
                  width:`${((batchProgress.completed + batchProgress.failed) / batchProgress.total * 100).toFixed(0)}%`,
                  background: batchProgress.failed > 0 ? '#E65100' : '#2E7D32',
                  transition:'width 0.3s',
                }}/>
              </div>
            </div>
          )}

          {uploadLog.length > 0 && (
            <div style={{ marginTop:10, background:'#1a0a05', borderRadius:8,
              padding:'8px 12px', maxHeight:100, overflowY:'auto' }}>
              {uploadLog.map((l, i) => (
                <div key={i} style={{ fontSize:10, lineHeight:1.6,
                  color: l.includes('✓') ? '#69F0AE' : l.includes('✗') ? '#FF5252' : '#aaa' }}>
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Document list ── */}
      <div style={{ fontWeight:600, color:V.verm, fontSize:13, marginBottom:8 }}>
        文档列表 ({documents.length} 个)
      </div>
      {documents.length === 0 ? (
        <div style={{ textAlign:'center', color:V.text3, padding:30,
          background:V.card, border:`1px dashed ${V.border}`, borderRadius:12 }}>
          还没有上传文档 — 选择文件开始
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          {documents.map(d => {
            const subj = subjects.find(s => s.slug === d.subject_slug);
            return (
              <div key={d.id} style={{ background:V.card,
                border:`1px solid ${V.border}`, borderRadius:10,
                padding:'10px 14px', display:'flex', gap:12, alignItems:'center' }}>

                <div style={{ fontSize:20, flexShrink:0 }}>
                  {d.status === 'ready'      ? '✅'
                 : d.status === 'processing' ? '⏳'
                 : d.status === 'pending'    ? '🕒'
                 : d.status === 'error'      ? '❌' : '📄'}
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'baseline', flexWrap:'wrap' }}>
                    <span style={{ fontSize:13, fontWeight:600, color:V.text,
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:400 }}>
                      {d.title}
                    </span>
                    {subj && (
                      <span style={{ fontSize:10, background:`${subj.color}20`,
                        color:subj.color, padding:'1px 6px', borderRadius:6 }}>
                        {subj.icon} {subj.name_zh}
                      </span>
                    )}
                    {d.grade_level && (
                      <span style={{ fontSize:10, background:'#f5ede0',
                        color:V.text2, padding:'1px 6px', borderRadius:6 }}>
                        {d.grade_level}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:V.text3, marginTop:2 }}>
                    {d.file_size && `${(d.file_size/1024/1024).toFixed(1)}MB · `}
                    {d.chunk_count > 0 && `${d.chunk_count} chunks · `}
                    {d.page_count && `${d.page_count} 页 · `}
                    {d.status === 'ready' ? '就绪' : (d.status_message || d.status)}
                  </div>
                </div>

                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => handleEditDocMeta(d)}
                    title="编辑学科/年级"
                    style={{ padding:'4px 8px', fontSize:11, cursor:'pointer',
                      borderRadius:6, border:`1px solid ${V.border}`,
                      background:V.bg, color:V.text2 }}>
                    🏷
                  </button>
                  {(d.status === 'error' || d.status === 'ready') && (
                    <button onClick={() => handleReprocess(d)}
                      title="重新处理"
                      style={{ padding:'4px 8px', fontSize:11, cursor:'pointer',
                        borderRadius:6, border:`1px solid ${V.border}`,
                        background:V.bg, color:V.text2 }}>
                      ↺
                    </button>
                  )}
                  <button onClick={() => handleDelete(d)}
                    style={{ padding:'4px 8px', fontSize:11, cursor:'pointer',
                      borderRadius:6, border:'1px solid #FFCDD2',
                      background:'#FFEBEE', color:'#C62828' }}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Search test ── */}
      <div style={{ background:'#E3F2FD', border:'1px solid #90CAF9',
        borderRadius:12, padding:'14px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom:10 }}>
          <div style={{ fontWeight:600, color:V.blue, fontSize:13 }}>
            🔍 测试搜索 · RAG Search
          </div>
          <button onClick={refreshProviderStatus}
            title="刷新 API key 状态"
            style={{ fontSize:10, padding:'2px 8px', cursor:'pointer',
              borderRadius:5, border:`1px solid ${V.blue}40`,
              background:'transparent', color:V.blue }}>
            ↻ 刷新状态
          </button>
        </div>

        {/* Filter row: collection / subject / grade / AI */}
        <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
          <select value={searchColl} onChange={e => setSearchColl(e.target.value)}
            style={{ padding:'6px 8px', fontSize:11, borderRadius:6,
              border:`1px solid ${V.border}`, background:V.card }}>
            <option value="">所有 collection</option>
            {collections.map(c => (
              <option key={c.slug} value={c.slug}>{c.icon} {c.name_zh}</option>
            ))}
          </select>
          <select value={searchSubject} onChange={e => setSearchSubject(e.target.value)}
            style={{ padding:'6px 8px', fontSize:11, borderRadius:6,
              border:`1px solid ${V.border}`, background:V.card }}>
            <option value="">所有学科</option>
            {subjects.map(s => (
              <option key={s.slug} value={s.slug}>{s.icon} {s.name_zh}</option>
            ))}
          </select>
          <select value={searchGrade} onChange={e => setSearchGrade(e.target.value)}
            style={{ padding:'6px 8px', fontSize:11, borderRadius:6,
              border:`1px solid ${V.border}`, background:V.card }}>
            <option value="">所有年级</option>
            {gradeLevels.map(g => (
              <option key={g.grade_level} value={g.grade_level}>
                {g.grade_level} ({g.doc_count})
              </option>
            ))}
          </select>
          <select value={searchProvider} onChange={e => setSearchProvider(e.target.value)}
            title="合成答案用哪个 AI"
            style={{ padding:'6px 8px', fontSize:11, borderRadius:6,
              border:`1px solid ${V.border}`, background:V.card, minWidth:140 }}>
            {AI_PROVIDERS.map(p => (
              <option key={p.id} value={p.id}>
                {statusDot(p.id)} {p.label}
              </option>
            ))}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:V.text2 }}>
            <input type="checkbox" checked={synthesize}
              onChange={e => setSynthesize(e.target.checked)}/>
            AI 合成
          </label>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input type="text" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="提问或输入关键词…"
            style={{ flex:'1 1 300px', padding:'8px 12px', fontSize:13,
              borderRadius:8, border:`1px solid ${V.border}` }}/>
          <button onClick={handleSearch} disabled={searching || !searchQuery.trim()}
            style={{ padding:'8px 18px', borderRadius:8, border:'none',
              background: searching ? '#BBDEFB' : V.blue,
              color:'#fff', fontSize:12, fontWeight:600,
              cursor: searching ? 'default' : 'pointer' }}>
            {searching ? '搜索中…' : '🔍 搜索'}
          </button>
        </div>

        {searchResult?.error && (
          <div style={{ color:'#C62828', fontSize:12, padding:8, marginTop:8 }}>
            ✗ {searchResult.error}
          </div>
        )}

        {searchResult?.answer && (
          <div style={{ background:V.card, borderRadius:10, padding:'12px 14px',
            marginTop:10, border:`1px solid ${V.border}` }}>
            <div style={{ fontSize:11, color:V.text3, marginBottom:6 }}>
              💡 {searchResult.provider
                ? AI_PROVIDERS.find(p => p.id === searchResult.provider)?.label || searchResult.provider
                : 'AI'} 合成 ({searchResult.match_count} 个来源)
            </div>
            <div style={{ fontSize:13, color:V.text, lineHeight:1.7, whiteSpace:'pre-wrap' }}>
              {searchResult.answer}
            </div>
          </div>
        )}

        {searchResult?.chunks?.length > 0 && (
          <details style={{ marginTop:10 }}>
            <summary style={{ cursor:'pointer', fontSize:11, color:V.text3, padding:'4px 0' }}>
              查看原始片段 ({searchResult.chunks.length})
            </summary>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
              {searchResult.chunks.map((c, i) => {
                const subj = subjects.find(s => s.slug === c.subject_slug);
                return (
                  <div key={i} style={{ background:V.card, borderRadius:8,
                    padding:'8px 12px', border:`1px solid ${V.border}`, fontSize:11 }}>
                    <div style={{ color:V.text3, marginBottom:4, display:'flex', gap:6, flexWrap:'wrap' }}>
                      <span>#{i + 1}</span>
                      <span style={{ color:V.blue }}>{c.document_title}</span>
                      {subj && <span style={{ color:subj.color }}>· {subj.icon} {subj.name_zh}</span>}
                      {c.grade_level && <span>· {c.grade_level}</span>}
                      {c.metadata?.chapter && <span>· {c.metadata.chapter}</span>}
                      <span style={{ marginLeft:'auto', color:V.green }}>
                        sim: {c.similarity}
                      </span>
                    </div>
                    <div style={{ color:V.text2, lineHeight:1.5, whiteSpace:'pre-wrap' }}>
                      {c.content.slice(0, 400)}
                      {c.content.length > 400 && '…'}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>

      {/* ── Add Collection Modal ── */}
      {showAddColl && (
        <AddCollectionModal
          onClose={() => setShowAddColl(false)}
          onSaved={(newColl) => {
            setCollections(c => [...c, newColl].sort((a,b) => a.sort_order - b.sort_order));
            setSelectedColl(newColl.id);
            setShowAddColl(false);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Modal: Add new collection
// ═══════════════════════════════════════════════════════════════════════
function AddCollectionModal({ onClose, onSaved }) {
  const [slug, setSlug]       = useState('');
  const [nameZh, setNameZh]   = useState('');
  const [nameEn, setNameEn]   = useState('');
  const [icon, setIcon]       = useState('📘');
  const [color, setColor]     = useState('#1565C0');
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  async function save() {
    if (!slug.trim() || !nameZh.trim()) {
      setErr('slug 和中文名必填');
      return;
    }
    setSaving(true);
    setErr('');
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const { data, error } = await supabase.from('corpus_collections')
      .insert({
        slug: cleanSlug,
        name_zh: nameZh.trim(),
        name_en: nameEn.trim() || null,
        icon: icon.trim() || '📘',
        color,
        sort_order: 100,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    onSaved(data);
  }

  const V2 = {
    bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
    text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850', verm:'#8B4513',
  };

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:V2.bg, borderRadius:16, padding:'22px 24px', width:440,
        border:`1px solid ${V2.border}`, boxShadow:'0 20px 60px rgba(0,0,0,0.35)',
      }}>
        <div style={{ fontSize:16, fontWeight:700, color:V2.verm, marginBottom:14 }}>
          ➕ 新建 Collection
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div style={{ gridColumn:'1 / 3' }}>
            <label style={{ fontSize:11, color:V2.text3, display:'block', marginBottom:3 }}>
              Slug (英文 id, 用下划线)
            </label>
            <input value={slug} onChange={e => setSlug(e.target.value)}
              placeholder="sujiao / beijing / outlier"
              style={{ width:'100%', padding:'7px 10px', fontSize:13, borderRadius:8,
                border:`1px solid ${V2.border}`, boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:V2.text3, display:'block', marginBottom:3 }}>中文名</label>
            <input value={nameZh} onChange={e => setNameZh(e.target.value)}
              placeholder="苏教版"
              style={{ width:'100%', padding:'7px 10px', fontSize:13, borderRadius:8,
                border:`1px solid ${V2.border}`, boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:V2.text3, display:'block', marginBottom:3 }}>English name</label>
            <input value={nameEn} onChange={e => setNameEn(e.target.value)}
              placeholder="Jiangsu Edition"
              style={{ width:'100%', padding:'7px 10px', fontSize:13, borderRadius:8,
                border:`1px solid ${V2.border}`, boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:V2.text3, display:'block', marginBottom:3 }}>Icon (emoji)</label>
            <input value={icon} onChange={e => setIcon(e.target.value)}
              placeholder="📚"
              style={{ width:'100%', padding:'7px 10px', fontSize:13, borderRadius:8,
                border:`1px solid ${V2.border}`, boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:V2.text3, display:'block', marginBottom:3 }}>颜色</label>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {COLLECTION_COLOR_PRESETS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  style={{ width:22, height:22, borderRadius:11,
                    border: color === c ? '3px solid #000' : '1px solid #ccc',
                    background: c, cursor:'pointer', padding:0 }}/>
              ))}
            </div>
          </div>
        </div>

        {err && (
          <div style={{ color:'#C62828', fontSize:12, marginTop:6 }}>✗ {err}</div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:16 }}>
          <button onClick={onClose}
            style={{ padding:'8px 16px', borderRadius:8, border:`1px solid ${V2.border}`,
              background:V2.card, color:V2.text2, fontSize:13, cursor:'pointer' }}>
            取消
          </button>
          <button onClick={save} disabled={saving}
            style={{ padding:'8px 20px', borderRadius:8, border:'none',
              background: saving ? '#E0E0E0' : V2.verm,
              color: saving ? '#aaa' : '#fff',
              fontSize:13, fontWeight:600, cursor: saving ? 'default' : 'pointer' }}>
            {saving ? '保存中…' : '💾 保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
