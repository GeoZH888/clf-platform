import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const BulkPDFProcessorPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  
  // State
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [results, setResults] = useState([]);
  const [config, setConfig] = useState(null);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedKB, setSelectedKB] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('textbook');
  const [selectedHSKLevels, setSelectedHSKLevels] = useState([]);
  const [autoDetectHSK, setAutoDetectHSK] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const fileInputRef = useRef(null);

  const txt = {
    zh: {
      title: '📚 批量PDF处理',
      subtitle: '一键上传多个PDF文件，自动提取文本并训练到知识库',
      selectFiles: '选择PDF文件',
      dragDrop: '或拖拽文件到此处',
      supportedFormats: '支持 PDF 格式，可同时选择多个文件',
      selectedFiles: '已选择的文件',
      fileName: '文件名',
      fileSize: '大小',
      status: '状态',
      remove: '移除',
      clearAll: '清空全部',
      
      // Config
      targetKB: '目标知识库',
      category: '分类',
      hskLevels: 'HSK等级',
      autoDetect: '自动检测HSK等级',
      autoDetectTip: '系统会根据文件名和内容自动判断HSK等级',
      
      // Categories
      textbook: '教材',
      vocabulary: '词汇',
      grammar: '语法',
      culture: '文化',
      exam: '考试',
      
      // Processing
      startProcessing: '开始处理',
      stopProcessing: '停止处理',
      processing: '处理中...',
      extractingText: '正在提取文本...',
      creatingChunks: '正在分块...',
      creatingEmbeddings: '正在生成向量...',
      saving: '正在保存...',
      
      // Status
      pending: '待处理',
      inProgress: '处理中',
      completed: '已完成',
      failed: '失败',
      
      // Results
      results: '处理结果',
      totalFiles: '总文件数',
      successCount: '成功',
      failedCount: '失败',
      totalChunks: '总分块数',
      totalTime: '总耗时',
      
      // Messages
      noFiles: '请先选择PDF文件',
      noKB: '请选择目标知识库',
      noAPIKey: '请先在RAG配置中设置Embedding API密钥',
      success: '处理完成！',
      error: '处理出错',
      
      // Tips
      tips: '使用提示',
      tip1: '文件名包含HSK1-6会自动识别等级',
      tip2: '建议每个PDF不超过50页',
      tip3: '处理时间取决于文件大小和数量',
      tip4: '处理完成后可在RAG管理页面查看'
    },
    en: {
      title: '📚 Bulk PDF Processor',
      subtitle: 'Upload multiple PDFs at once, auto-extract text and train to knowledge base',
      selectFiles: 'Select PDF Files',
      dragDrop: 'or drag & drop files here',
      supportedFormats: 'Supports PDF format, multiple files allowed',
      selectedFiles: 'Selected Files',
      fileName: 'File Name',
      fileSize: 'Size',
      status: 'Status',
      remove: 'Remove',
      clearAll: 'Clear All',
      
      targetKB: 'Target Knowledge Base',
      category: 'Category',
      hskLevels: 'HSK Levels',
      autoDetect: 'Auto-detect HSK level',
      autoDetectTip: 'System will detect HSK level from filename and content',
      
      textbook: 'Textbook',
      vocabulary: 'Vocabulary',
      grammar: 'Grammar',
      culture: 'Culture',
      exam: 'Exam',
      
      startProcessing: 'Start Processing',
      stopProcessing: 'Stop',
      processing: 'Processing...',
      extractingText: 'Extracting text...',
      creatingChunks: 'Creating chunks...',
      creatingEmbeddings: 'Creating embeddings...',
      saving: 'Saving...',
      
      pending: 'Pending',
      inProgress: 'In Progress',
      completed: 'Completed',
      failed: 'Failed',
      
      results: 'Results',
      totalFiles: 'Total Files',
      successCount: 'Success',
      failedCount: 'Failed',
      totalChunks: 'Total Chunks',
      totalTime: 'Total Time',
      
      noFiles: 'Please select PDF files first',
      noKB: 'Please select a knowledge base',
      noAPIKey: 'Please set Embedding API key in RAG config first',
      success: 'Processing complete!',
      error: 'Processing error',
      
      tips: 'Tips',
      tip1: 'Filenames containing HSK1-6 will auto-detect level',
      tip2: 'Recommend max 50 pages per PDF',
      tip3: 'Processing time depends on file size and count',
      tip4: 'View results in RAG Management page after processing'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    if (!supabase) return;
    
    // Load RAG config
    const { data: configData } = await supabase
      .from('dwxz_rag_config')
      .select('*')
      .limit(1)
      .single();
    setConfig(configData);

    // Load knowledge bases
    const { data: kbData } = await supabase
      .from('dwxz_rag_knowledge_bases')
      .select('*')
      .eq('is_active', true);
    setKnowledgeBases(kbData || []);
    if (kbData?.length > 0) setSelectedKB(kbData[0].id);
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    addFiles(selectedFiles);
  };

  // Handle drag & drop
  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    addFiles(droppedFiles);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Add files to list
  const addFiles = (newFiles) => {
    const fileObjects = newFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
      chunks: 0,
      error: null,
      hskLevel: detectHSKLevel(file.name)
    }));
    setFiles(prev => [...prev, ...fileObjects]);
  };

  // Auto-detect HSK level from filename
  const detectHSKLevel = (filename) => {
    const match = filename.match(/HSK\s*(\d)/i);
    if (match) return parseInt(match[1]);
    
    // Check for Chinese level indicators
    if (/初级|beginner|elementary/i.test(filename)) return 1;
    if (/中级|intermediate/i.test(filename)) return 3;
    if (/高级|advanced/i.test(filename)) return 5;
    
    return null;
  };

  // Remove file from list
  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Clear all files
  const clearAll = () => {
    setFiles([]);
    setResults([]);
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Extract text from PDF
  const extractPDFText = async (file, onProgress) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const totalPages = pdf.numPages;
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += `\n\n--- 第${pageNum}页 / Page ${pageNum} ---\n\n${pageText}`;
      
      if (onProgress) {
        onProgress(Math.round((pageNum / totalPages) * 30)); // 0-30% for extraction
      }
    }
    
    return fullText.trim();
  };

  // Chunk text
  const chunkText = (text, chunkSize = 500, overlap = 50) => {
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;
      if (start >= text.length) break;
    }
    
    return chunks;
  };

  // Create embedding
  const createEmbedding = async (text) => {
    if (!config?.embedding_api_key) return null;
    
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.embedding_api_key}`
        },
        body: JSON.stringify({
          model: config.embedding_model || 'text-embedding-3-small',
          input: text.substring(0, 8000) // Limit input length
        })
      });
      
      const data = await response.json();
      return data.data?.[0]?.embedding || null;
    } catch (err) {
      console.error('Embedding error:', err);
      return null;
    }
  };

  // Process single file
  const processFile = async (fileObj, index) => {
    const updateFileStatus = (updates) => {
      setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, ...updates } : f));
    };

    try {
      updateFileStatus({ status: 'processing', progress: 0 });
      setCurrentFile(fileObj.name);

      // 1. Extract text (0-30%)
      updateFileStatus({ progress: 5 });
      const text = await extractPDFText(fileObj.file, (p) => {
        updateFileStatus({ progress: p });
      });

      if (!text || text.length < 100) {
        throw new Error('Failed to extract text or text too short');
      }

      // 2. Detect HSK level from content if auto-detect is on
      let hskLevels = selectedHSKLevels;
      if (autoDetectHSK && fileObj.hskLevel) {
        hskLevels = [fileObj.hskLevel];
      }

      // 3. Create document record (30-35%)
      updateFileStatus({ progress: 35 });
      const { data: doc, error: insertError } = await supabase
        .from('dwxz_rag_documents')
        .insert([{
          knowledge_base_id: selectedKB,
          title: fileObj.name.replace('.pdf', ''),
          title_zh: fileObj.name.replace('.pdf', ''),
          file_name: fileObj.name,
          file_type: 'pdf',
          file_size: fileObj.size,
          raw_content: text,
          category: selectedCategory,
          hsk_levels: hskLevels,
          status: 'processing',
          uploaded_by: user?.id
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // 4. Create chunks (35-50%)
      updateFileStatus({ progress: 40 });
      const chunks = chunkText(text, config?.chunk_size || 500, config?.chunk_overlap || 50);
      updateFileStatus({ progress: 50 });

      // 5. Create embeddings and save chunks (50-90%)
      let savedChunks = 0;
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await createEmbedding(chunks[i]);
        
        await supabase.from('dwxz_rag_chunks').insert([{
          document_id: doc.id,
          knowledge_base_id: selectedKB,
          content: chunks[i],
          chunk_index: i,
          embedding: embedding,
          metadata: { 
            index: i, 
            total: chunks.length,
            hsk_levels: hskLevels,
            source: fileObj.name
          }
        }]);
        
        savedChunks++;
        const chunkProgress = 50 + Math.round((i / chunks.length) * 40);
        updateFileStatus({ progress: chunkProgress, chunks: savedChunks });
      }

      // 6. Update document status (90-100%)
      updateFileStatus({ progress: 95 });
      await supabase.from('dwxz_rag_documents').update({
        status: 'completed',
        chunk_count: chunks.length,
        processed_at: new Date().toISOString()
      }).eq('id', doc.id);

      // 7. Update knowledge base stats
      await updateKBStats();

      updateFileStatus({ status: 'completed', progress: 100, chunks: chunks.length });
      
      return { success: true, chunks: chunks.length };

    } catch (err) {
      console.error(`Error processing ${fileObj.name}:`, err);
      updateFileStatus({ status: 'failed', error: err.message });
      return { success: false, error: err.message };
    }
  };

  // Update knowledge base statistics
  const updateKBStats = async () => {
    const { count: docCount } = await supabase
      .from('dwxz_rag_documents')
      .select('*', { count: 'exact', head: true })
      .eq('knowledge_base_id', selectedKB)
      .eq('status', 'completed');

    const { count: chunkCount } = await supabase
      .from('dwxz_rag_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('knowledge_base_id', selectedKB);

    await supabase.from('dwxz_rag_knowledge_bases').update({
      document_count: docCount || 0,
      total_chunks: chunkCount || 0,
      last_updated: new Date().toISOString()
    }).eq('id', selectedKB);
  };

  // Start processing all files
  const startProcessing = async () => {
    // Validation
    if (files.length === 0) {
      setMessage({ type: 'error', text: t.noFiles });
      return;
    }
    if (!selectedKB) {
      setMessage({ type: 'error', text: t.noKB });
      return;
    }
    if (!config?.embedding_api_key) {
      setMessage({ type: 'error', text: t.noAPIKey });
      return;
    }

    setProcessing(true);
    setMessage({ type: '', text: '' });
    
    const startTime = Date.now();
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'failed');
    
    setProgress({ current: 0, total: pendingFiles.length, percent: 0 });

    let successCount = 0;
    let failedCount = 0;
    let totalChunks = 0;

    for (let i = 0; i < pendingFiles.length; i++) {
      const result = await processFile(pendingFiles[i], i);
      
      if (result.success) {
        successCount++;
        totalChunks += result.chunks;
      } else {
        failedCount++;
      }

      setProgress({
        current: i + 1,
        total: pendingFiles.length,
        percent: Math.round(((i + 1) / pendingFiles.length) * 100)
      });
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    setResults([{
      totalFiles: pendingFiles.length,
      successCount,
      failedCount,
      totalChunks,
      totalTime
    }]);

    setProcessing(false);
    setCurrentFile(null);
    setMessage({ 
      type: failedCount === 0 ? 'success' : 'warning', 
      text: `${t.success} ${successCount}/${pendingFiles.length}` 
    });
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'var(--text-muted)', text: t.pending },
      processing: { bg: 'var(--info)', text: t.inProgress },
      completed: { bg: 'var(--success)', text: t.completed },
      failed: { bg: 'var(--error)', text: t.failed }
    };
    const s = styles[status] || styles.pending;
    return <span className="badge" style={{ background: s.bg, color: 'white' }}>{s.text}</span>;
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>🔒 Access Denied</h2>
        <p>Super Admin only</p>
      </div>
    );
  }

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
      </div>
      
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t.subtitle}</p>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      {/* Configuration */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>⚙️ {language === 'zh' ? '处理配置' : 'Configuration'}</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">{t.targetKB}</label>
            <select 
              className="form-select" 
              value={selectedKB} 
              onChange={e => setSelectedKB(e.target.value)}
            >
              {knowledgeBases.map(kb => (
                <option key={kb.id} value={kb.id}>{kb.name_zh || kb.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t.category}</label>
            <select 
              className="form-select" 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="textbook">{t.textbook}</option>
              <option value="vocabulary">{t.vocabulary}</option>
              <option value="grammar">{t.grammar}</option>
              <option value="culture">{t.culture}</option>
              <option value="exam">{t.exam}</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t.hskLevels}</label>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6].map(level => (
                <button
                  key={level}
                  type="button"
                  className={`btn btn-sm ${selectedHSKLevels.includes(level) ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => {
                    setSelectedHSKLevels(prev => 
                      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
                    );
                  }}
                >
                  HSK{level}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={autoDetectHSK} 
            onChange={e => setAutoDetectHSK(e.target.checked)}
          />
          <span>{t.autoDetect}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({t.autoDetectTip})</span>
        </label>
      </div>

      {/* File Upload Area */}
      <div 
        className="card"
        style={{ 
          border: '2px dashed var(--border)',
          textAlign: 'center',
          padding: '2rem',
          marginBottom: '1.5rem',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
        <div style={{ fontSize: '1.2rem', fontWeight: '500', marginBottom: '0.5rem' }}>
          {t.selectFiles}
        </div>
        <div style={{ color: 'var(--text-muted)' }}>{t.dragDrop}</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          {t.supportedFormats}
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>{t.selectedFiles} ({files.length})</h3>
            <button className="btn btn-outline btn-sm" onClick={clearAll}>
              🗑️ {t.clearAll}
            </button>
          </div>

          <div className="table-container">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t.fileName}</th>
                  <th>HSK</th>
                  <th>{t.fileSize}</th>
                  <th>{t.status}</th>
                  <th style={{ width: '150px' }}>Progress</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📄 {f.name}
                      </div>
                      {f.error && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{f.error}</div>
                      )}
                    </td>
                    <td>
                      {f.hskLevel ? (
                        <span className="badge badge-info">HSK{f.hskLevel}</span>
                      ) : '-'}
                    </td>
                    <td>{formatSize(f.size)}</td>
                    <td>{getStatusBadge(f.status)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ 
                          flex: 1, 
                          height: '8px', 
                          background: 'var(--background)', 
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            width: `${f.progress}%`, 
                            height: '100%', 
                            background: f.status === 'completed' ? 'var(--success)' : 
                                       f.status === 'failed' ? 'var(--error)' : 'var(--primary)',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', width: '35px' }}>{f.progress}%</span>
                      </div>
                      {f.chunks > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {f.chunks} chunks
                        </div>
                      )}
                    </td>
                    <td>
                      {f.status === 'pending' && (
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => removeFile(f.id)}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Processing button */}
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              className="btn btn-primary btn-lg"
              onClick={startProcessing}
              disabled={processing || files.filter(f => f.status === 'pending').length === 0}
              style={{ minWidth: '200px' }}
            >
              {processing ? (
                <>⏳ {t.processing} ({progress.current}/{progress.total})</>
              ) : (
                <>🚀 {t.startProcessing}</>
              )}
            </button>

            {processing && currentFile && (
              <div style={{ color: 'var(--text-muted)' }}>
                📄 {currentFile}
              </div>
            )}
          </div>

          {/* Overall progress */}
          {processing && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ 
                height: '12px', 
                background: 'var(--background)', 
                borderRadius: '6px',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${progress.percent}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, var(--primary), var(--success))',
                  transition: 'width 0.3s'
                }} />
              </div>
              <div style={{ textAlign: 'center', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                {progress.percent}% - {progress.current} / {progress.total} files
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>📊 {t.results}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2rem', color: 'var(--primary)' }}>{results[0].totalFiles}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.totalFiles}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2rem', color: 'var(--success)' }}>{results[0].successCount}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.successCount}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2rem', color: 'var(--error)' }}>{results[0].failedCount}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.failedCount}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2rem', color: 'var(--info)' }}>{results[0].totalChunks}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.totalChunks}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '2rem', color: 'var(--warning)' }}>{results[0].totalTime}s</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.totalTime}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>💡 {t.tips}</h3>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
          <li>{t.tip1}</li>
          <li>{t.tip2}</li>
          <li>{t.tip3}</li>
          <li>{t.tip4}</li>
        </ul>
      </div>
    </div>
  );
};

export default BulkPDFProcessorPage;
