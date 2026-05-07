// src/components/TeacherUploadPanel.jsx
// Teacher-facing upload panel
// - Drag & drop or click to upload
// - Supports: PDF, Word, PPT, ZIP, MP3/MP4, images, text
// - Background processing via Netlify functions (teacher sees no details)
// - Shows only: "Processing..." → "✅ Stored" notification
// - Audio/video: auto-transcribed then matched with text content

import React, { useState, useCallback, useRef, useEffect } from 'react';

const ACCEPTED = '.pdf,.doc,.docx,.ppt,.pptx,.zip,.txt,.md,.mp3,.mp4,.wav,.m4a,.mov,.avi,.jpg,.jpeg,.png,.webp';

const FILE_INFO = {
  pdf:   { icon:'📄', color:'#dc2626', label:'PDF' },
  word:  { icon:'📝', color:'#2563eb', label:'Word' },
  pptx:  { icon:'📊', color:'#d97706', label:'PPT' },
  zip:   { icon:'🗜️', color:'#7c3aed', label:'ZIP' },
  audio: { icon:'🎵', color:'#0891b2', label:'Audio' },
  video: { icon:'🎬', color:'#065f46', label:'Video' },
  image: { icon:'🖼️', color:'#9333ea', label:'Image' },
  text:  { icon:'📃', color:'#374151', label:'Text' },
};

function getFileKind(name) {
  const e = name.split('.').pop().toLowerCase();
  if (['pdf'].includes(e)) return 'pdf';
  if (['doc','docx'].includes(e)) return 'word';
  if (['ppt','pptx'].includes(e)) return 'pptx';
  if (['zip'].includes(e)) return 'zip';
  if (['mp3','wav','m4a','ogg','aac'].includes(e)) return 'audio';
  if (['mp4','mov','avi','mkv','webm'].includes(e)) return 'video';
  if (['jpg','jpeg','png','webp','gif'].includes(e)) return 'image';
  return 'text';
}

function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024**2) return (b/1024).toFixed(1) + ' KB';
  return (b/1024**2).toFixed(1) + ' MB';
}

export default function TeacherUploadPanel({ S, lbl, supabase, selKB, language }) {
  const [files,    setFiles]    = useState([]);
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [kbList,   setKbList]   = useState([]);
  const [targetKB, setTargetKB] = useState(selKB || '');
  const [uploadCurriculum, setUploadCurriculum] = useState('');
  const fileRef = useRef();
  const folderRef = useRef();

  useEffect(() => {
    if (!supabase) return;
    supabase.from('dwxz_rag_knowledge_bases').select('id,name,name_zh').order('created_at',{ascending:false})
      .then(({data}) => { setKbList(data||[]); if(!targetKB && data?.[0]) setTargetKB(data[0].id); });
  }, [supabase]);

  const addFiles = useCallback((fileList) => {
    const items = Array.from(fileList).map(f => ({
      id: Math.random().toString(36).slice(2),
      file: f, name: f.name, size: f.size,
      kind: getFileKind(f.name),
      status: 'pending',
    }));
    setFiles(p => [...p, ...items]);
    setDone(false);
  }, []);

  const onDrop = useCallback(async e => {
    e.preventDefault(); setDragOver(false);
    // Support folder drop via DataTransferItemList
    const items = e.dataTransfer.items;
    if (items && items.length > 0 && items[0].webkitGetAsEntry) {
      const allFiles = [];
      const readEntry = async (entry) => {
        if (entry.isFile) {
          return new Promise(res => entry.file(f => { allFiles.push(f); res(); }));
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          return new Promise(res => {
            reader.readEntries(async entries => {
              for (const e2 of entries) await readEntry(e2);
              res();
            });
          });
        }
      };
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) await readEntry(entry);
      }
      if (allFiles.length > 0) { addFiles(allFiles); return; }
    }
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  async function submit() {
    if (!files.length) return;
    if (!targetKB) { alert(lbl('请先选择知识库','Please select a knowledge base')); return; }
    setBusy(true); setDone(false);

    for (const item of files.filter(f => f.status === 'pending')) {
      // Mark as uploading
      setFiles(p => p.map(f => f.id === item.id ? {...f, status:'uploading'} : f));

      try {
        const kind = item.kind;

        // ── Step A: Upload raw file to Supabase Storage ──
        const storePath = `teacher-uploads/${targetKB}/${Date.now()}_${item.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        let storageUrl = null;

        if (supabase && item.size < 100 * 1024 * 1024) { // up to 100MB
          const { error: upErr } = await supabase.storage
            .from('dwxz_illustrations')
            .upload(storePath, item.file, { upsert: false });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage
              .from('dwxz_illustrations').getPublicUrl(storePath);
            storageUrl = publicUrl;
          }
        }

        // ── Step B: Extract text in browser (PDF / text) ──
        let extractedText = '';
        let transcription = null;

        if (kind === 'pdf') {
          extractedText = await extractPDF(item.file);
        } else if (kind === 'text' || kind === 'word') {
          extractedText = await item.file.text().catch(() => '');
          if (extractedText.length > 150000) extractedText = extractedText.slice(0, 150000);
        } else if (kind === 'audio' || kind === 'video') {
          // For audio/video: call Netlify function for Whisper transcription
          transcription = await transcribeMedia(item.file, item.name);
          extractedText = transcription || '';
        }
        // ZIP, image, pptx — text extraction handled server-side via process-document

        // ── Step C: Call process-document for AI classification + embedding ──
        const processRes = await fetch('/.netlify/functions/process-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'classify',
            text: extractedText.slice(0, 4000),
            filename: item.name,
          }),
        });

        let classification = { category:'other', hskLevels:[], tags:[], title_zh:item.name.replace(/\.[^/.]+$/,''), summary:'', confidence:0.4, method:'filename' };
        if (processRes.ok) {
          const r = await processRes.json();
          if (!r.error) classification = { ...classification, ...r };
        }

        // ── Step D: Save material record to DB ──
        const { data: mat, error: dbErr } = await supabase
          .from('dwxz_knowledge_materials')
          .insert([{
            knowledge_base_id: targetKB,
            title:    classification.title_zh || item.name.replace(/\.[^/.]+$/,''),
            title_zh: classification.title_zh || item.name.replace(/\.[^/.]+$/,''),
            summary:  classification.summary  || null,
            file_name: item.name,
            file_type: kind,
            file_size: item.size,
            storage_path: storePath,
            storage_url:  storageUrl,
            category:   classification.category,
            hsk_levels: classification.hskLevels,
            tags:       classification.tags || [],
            extracted_text: extractedText.slice(0, 50000) || null,
            ai_classify_confidence: classification.confidence,
            ai_classify_method: classification.method,
          tags: [...(classification.tags||[]), ...(uploadCurriculum?[uploadCurriculum]:[])].filter(Boolean),
            status: extractedText.length > 0 ? 'processing' : 'uploaded',
            uploaded_by: (await supabase.auth.getUser())?.data?.user?.id,
          }])
          .select().single();

        if (dbErr) throw new Error(dbErr.message);

        // ── Step E: Chunk + embed in background (fire and forget) ──
        if (extractedText.length > 100 && mat) {
          embedInBackground(mat.id, extractedText, targetKB, supabase);
        }

        setFiles(p => p.map(f => f.id === item.id ? {
          ...f, status:'done',
          category: classification.category,
          hskLevels: classification.hskLevels,
          isAudio: kind === 'audio' || kind === 'video',
          hasTranscript: !!transcription,
        } : f));

      } catch (err) {
        console.error('Upload error:', err);
        setFiles(p => p.map(f => f.id === item.id ? {...f, status:'error', error:err.message} : f));
      }
    }

    setBusy(false);
    setDone(true);
  }

  const allDone = files.length > 0 && files.every(f => f.status === 'done' || f.status === 'error');
  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <div>
      {/* KB selector */}
      <div style={{ ...S.card, display:'flex', gap:'1rem', alignItems:'center', flexWrap:'wrap', marginBottom:'1rem' }}>
        <div style={{ flex:1 }}>
          <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4 }}>
            {lbl('存入知识库 *','Target Knowledge Base *')}
          </label>
          <select style={{ ...S.inp, width:'auto', minWidth:200 }}
            value={targetKB} onChange={e=>setTargetKB(e.target.value)}>
            <option value="">{lbl('-- 选择知识库 --','-- Select KB --')}</option>
            {kbList.map(kb=><option key={kb.id} value={kb.id}>{kb.name_zh||kb.name}</option>)}
          </select>
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.8 }}>
          <div>📄 PDF · Word · PPT</div>
          <div>🎵 音频/视频（自动转录）</div>
          <div>🗜️ ZIP（批量处理）</div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onClick={()=>fileRef.current?.click()}
        style={{
          border:`2px dashed ${dragOver?'var(--primary)':'var(--border)'}`,
          borderRadius:16, padding:'2.5rem', textAlign:'center', cursor:'pointer',
          background: dragOver?'rgba(196,30,58,0.04)':'var(--background)',
          transition:'all .2s', marginBottom:'1rem',
        }}>
        <div style={{ fontSize:40, marginBottom:8 }}>📂</div>
        <div style={{ fontWeight:600, color:'var(--primary)', marginBottom:4 }}>
          {lbl('拖拽文件/文件夹至此，或点击下方按钮','Drag files or folders here, or use buttons below')}
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)' }}>
          PDF · Word · PPT · ZIP · MP3 · MP4 · 图片 · 文本
        </div>
        {/* Regular file input */}
        <input ref={fileRef} type="file" multiple accept={ACCEPTED}
          style={{ display:'none' }}
          onChange={e=>{addFiles(e.target.files);e.target.value='';}}/>
        {/* Folder input */}
        <input ref={folderRef} type="file" multiple
          webkitdirectory="true" directory="true" mozdirectory="true"
          style={{ display:'none' }}
          onChange={e=>{addFiles(e.target.files);e.target.value='';}}/>
      </div>

      {/* Upload buttons */}
      <div style={{ display:'flex', gap:8, marginBottom:'1rem' }}>
        <button onClick={()=>fileRef.current?.click()}
          style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--border)',
            background:'var(--background)', cursor:'pointer', fontSize:13 }}>
          📄 {lbl('选择文件','Select Files')}
        </button>
        <button onClick={()=>folderRef.current?.click()}
          style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid var(--primary)',
            background:'rgba(196,30,58,0.05)', cursor:'pointer', fontSize:13, color:'var(--primary)', fontWeight:600 }}>
          📁 {lbl('选择文件夹','Select Folder')}
        </button>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ ...S.card, marginBottom:'1rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.75rem' }}>
            <strong>{lbl('已选文件','Selected Files')} ({files.length})</strong>
            {!busy && <button onClick={()=>setFiles([])}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'var(--text-muted)' }}>
              🗑 {lbl('清空','Clear')}
            </button>}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {files.map(f => {
              const fi = FILE_INFO[f.kind] || FILE_INFO.text;
              return (
                <div key={f.id} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                  background:'var(--background)', borderRadius:8,
                  border:`1px solid ${f.status==='error'?'#fca5a5':f.status==='done'?'#a7f3d0':'var(--border)'}`,
                }}>
                  <span style={{ fontSize:20 }}>{fi.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500,
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {f.file?.webkitRelativePath
                        ? <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                            📁 {f.file.webkitRelativePath.split('/').slice(0,-1).join('/')} /&nbsp;
                          </span>
                        : null}
                      {f.name}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {fmtSize(f.size)}
                      {f.category && ` · ${f.category}`}
                      {f.hskLevels?.length > 0 && ` · HSK${f.hskLevels.join(',')}`}
                      {f.hasTranscript && ` · 🎙️ ${lbl('已转录','transcribed')}`}
                    </div>
                    {f.error && <div style={{ fontSize:11, color:'#dc2626' }}>{f.error}</div>}
                  </div>
                  <span style={{
                    fontSize:11, padding:'2px 8px', borderRadius:12, fontWeight:600,
                    background: f.status==='done'?'#d1fae5':f.status==='error'?'#fee2e2':f.status==='uploading'?'#dbeafe':'#f3f4f6',
                    color: f.status==='done'?'#065f46':f.status==='error'?'#991b1b':f.status==='uploading'?'#1d4ed8':'#374151',
                  }}>
                    {f.status==='done'?lbl('✅ 完成','✅ Done'):
                     f.status==='error'?lbl('❌ 失败','❌ Failed'):
                     f.status==='uploading'?lbl('处理中','Processing'):
                     lbl('待上传','Pending')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Submit button */}
      {files.length > 0 && !allDone && (
        <button
          onClick={submit} disabled={busy || !targetKB || pendingCount === 0}
          style={{ width:'100%', padding:'12px', borderRadius:10, border:'none',
            cursor: busy||!targetKB?'not-allowed':'pointer', fontSize:14, fontWeight:700,
            background: busy||!targetKB?'#9ca3af':'var(--primary)', color:'#fff' }}>
          {busy
            ? `⏳ ${lbl('处理中，请稍候...','Processing, please wait...')}`
            : `📤 ${lbl(`上传 ${pendingCount} 个文件`,`Upload ${pendingCount} files`)}`}
        </button>
      )}

      {/* Success notification */}
      {done && allDone && (
        <div style={{ padding:'16px 20px', borderRadius:12, background:'#d1fae5',
          border:'1px solid #6ee7b7', textAlign:'center' }}>
          <div style={{ fontSize:28, marginBottom:6 }}>✅</div>
          <div style={{ fontWeight:700, color:'#065f46', fontSize:16 }}>
            {lbl('资料已存储完成！', 'Materials stored successfully!')}
          </div>
          <div style={{ fontSize:13, color:'#047857', marginTop:4 }}>
            {lbl(
              `${files.filter(f=>f.status==='done').length} 个文件已分类并加入知识库，可立即用于教学工具`,
              `${files.filter(f=>f.status==='done').length} files classified and added to knowledge base`
            )}
          </div>
          {files.some(f=>f.isAudio) && (
            <div style={{ fontSize:12, color:'#059669', marginTop:6 }}>
              🎙️ {lbl('音频/视频已自动转录为文字，与教学内容关联','Audio/video auto-transcribed and linked to text content')}
            </div>
          )}
          <button onClick={()=>{setFiles([]);setDone(false);}}
            style={{ marginTop:12, padding:'6px 20px', borderRadius:8,
              border:'1px solid #059669', background:'none', cursor:'pointer',
              color:'#059669', fontSize:13 }}>
            {lbl('继续上传','Upload More')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Extract PDF text ──────────────────────────────────── */
async function extractPDF(file) {
  try {
    const pdfjsLib = window.pdfjsLib || (await import('pdfjs-dist'));
    if (!window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf, disableFontFace: true }).promise;
    const pages = Math.min(pdf.numPages, 80);
    let text = '';
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(x => x.str).join(' ') + '\n';
      page.cleanup();
      if (text.length > 150000) break;
    }
    return text.trim();
  } catch { return ''; }
}

/* ── Transcribe audio/video via Netlify function ────────── */
async function transcribeMedia(file, filename) {
  try {
    // Convert to base64 for small files (<25MB), skip for large
    if (file.size > 25 * 1024 * 1024) {
      return `[Audio file: ${filename} — too large for browser transcription. Upload via admin panel for server-side processing.]`;
    }
    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const response = await fetch('/.netlify/functions/teacher-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'transcribe',
        audio_base64: base64,
        audio_type: file.type || 'audio/mpeg',
        filename,
      }),
    });
    if (!response.ok) return '';
    const data = await response.json();
    return data.transcript || data.text || '';
  } catch { return ''; }
}

/* ── Background embedding (fire and forget) ─────────────── */
async function embedInBackground(materialId, text, kbId, supabase) {
  try {
    const chunks = chunkText(text);
    const res = await fetch('/.netlify/functions/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'embed',
        chunks: chunks.slice(0, 200),
        // keys come from Netlify env vars
      }),
    });
    if (!res.ok) return;
    const { embeddings } = await res.json();
    if (!embeddings?.length) return;

    const rows = chunks.slice(0, 200).map((chunk, i) => ({
      document_id: materialId,
      knowledge_base_id: kbId,
      content: chunk,
      chunk_index: i,
      embedding: embeddings[i] || null,
      metadata: {},
    }));

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      await supabase.from('dwxz_rag_chunks').insert(rows.slice(i, i + 50));
    }
    await supabase.from('dwxz_knowledge_materials')
      .update({ chunk_count: rows.length, status: 'completed' })
      .eq('id', materialId);
  } catch {}
}

function chunkText(text, size = 500, overlap = 50) {
  const chunks = [];
  let start = 0;
  while (start < text.length && chunks.length < 400) {
    chunks.push(text.slice(start, start + size));
    start += size - overlap;
  }
  return chunks;
}
