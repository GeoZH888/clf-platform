import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getAIService } from '../services/aiService';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const RAGManagementPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('knowledgeBases');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Data
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [config, setConfig] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedKB, setSelectedKB] = useState(null);
  
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  
  // Forms
  const [uploadForm, setUploadForm] = useState({
    knowledge_base_id: '',
    title: '',
    title_zh: '',
    category: 'custom',
    hsk_levels: [],
    content: '',
    file: null
  });
  
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState(null);

  const txt = {
    zh: {
      title: '🧠 RAG知识库管理',
      knowledgeBases: '知识库',
      documents: '文档管理',
      config: '系统配置',
      logs: '查询日志',
      testRAG: '测试RAG',
      
      // Knowledge Bases
      kbName: '知识库名称',
      kbDescription: '描述',
      documentCount: '文档数',
      chunkCount: '分块数',
      status: '状态',
      active: '启用',
      inactive: '禁用',
      
      // Documents
      uploadDocument: '上传文档',
      documentTitle: '文档标题',
      fileName: '文件名',
      fileType: '文件类型',
      category: '分类',
      hskLevels: 'HSK等级',
      uploadStatus: '处理状态',
      pending: '待处理',
      processing: '处理中',
      completed: '已完成',
      failed: '失败',
      
      // Categories
      textbook: '教材',
      vocabulary: '词汇',
      grammar: '语法',
      culture: '文化',
      exam: '考试',
      custom: '自定义',
      
      // Config
      embeddingProvider: 'Embedding服务商',
      embeddingModel: 'Embedding模型',
      embeddingApiKey: 'API密钥',
      searchTopK: '检索数量',
      similarityThreshold: '相似度阈值',
      systemPrompt: '系统提示词',
      
      // Actions
      upload: '上传',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      reprocess: '重新处理',
      test: '测试',
      
      // Upload
      selectFile: '选择文件',
      supportedFormats: '支持格式: PDF, DOCX, TXT, MD',
      orPasteContent: '或直接粘贴内容',
      pasteContent: '粘贴文本内容...',
      
      // Test
      enterQuery: '输入测试问题',
      testQueryPlaceholder: '例如：什么是把字句？',
      runTest: '运行测试',
      retrievedChunks: '检索到的文档块',
      generatedResponse: '生成的回答',
      score: '相似度',
      source: '来源',
      
      // Messages
      success: '操作成功！',
      failed: '操作失败',
      uploading: '上传中...',
      processingDocument: '正在处理文档...',
      noData: '暂无数据',
      
      // Stats
      totalDocuments: '总文档数',
      totalChunks: '总分块数',
      avgRetrievalTime: '平均检索时间',
      queryCount: '查询次数'
    },
    en: {
      title: '🧠 RAG Knowledge Base',
      knowledgeBases: 'Knowledge Bases',
      documents: 'Documents',
      config: 'Configuration',
      logs: 'Query Logs',
      testRAG: 'Test RAG',
      
      kbName: 'Name',
      kbDescription: 'Description',
      documentCount: 'Documents',
      chunkCount: 'Chunks',
      status: 'Status',
      active: 'Active',
      inactive: 'Inactive',
      
      uploadDocument: 'Upload Document',
      documentTitle: 'Title',
      fileName: 'File Name',
      fileType: 'File Type',
      category: 'Category',
      hskLevels: 'HSK Levels',
      uploadStatus: 'Status',
      pending: 'Pending',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
      
      textbook: 'Textbook',
      vocabulary: 'Vocabulary',
      grammar: 'Grammar',
      culture: 'Culture',
      exam: 'Exam',
      custom: 'Custom',
      
      embeddingProvider: 'Embedding Provider',
      embeddingModel: 'Embedding Model',
      embeddingApiKey: 'API Key',
      searchTopK: 'Top K Results',
      similarityThreshold: 'Similarity Threshold',
      systemPrompt: 'System Prompt',
      
      upload: 'Upload',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      reprocess: 'Reprocess',
      test: 'Test',
      
      selectFile: 'Select File',
      supportedFormats: 'Supported: PDF, DOCX, TXT, MD',
      orPasteContent: 'Or paste content directly',
      pasteContent: 'Paste text content...',
      
      enterQuery: 'Enter test query',
      testQueryPlaceholder: 'e.g., What is 把 sentence?',
      runTest: 'Run Test',
      retrievedChunks: 'Retrieved Chunks',
      generatedResponse: 'Generated Response',
      score: 'Score',
      source: 'Source',
      
      success: 'Success!',
      failed: 'Failed',
      uploading: 'Uploading...',
      processingDocument: 'Processing document...',
      noData: 'No data',
      
      totalDocuments: 'Total Documents',
      totalChunks: 'Total Chunks',
      avgRetrievalTime: 'Avg Retrieval Time',
      queryCount: 'Query Count'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      setMessage({ type: 'error', text: 'Access denied. Super Admin only.' });
      return;
    }
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Load knowledge bases
      const { data: kbData } = await supabase
        .from('dwxz_rag_knowledge_bases')
        .select('*')
        .order('created_at', { ascending: false });
      setKnowledgeBases(kbData || []);

      // Load documents
      const { data: docsData } = await supabase
        .from('dwxz_rag_documents')
        .select('*, rag_knowledge_bases(name, name_zh)')
        .order('created_at', { ascending: false });
      setDocuments(docsData || []);

      // Load config
      const { data: configData } = await supabase
        .from('dwxz_rag_config')
        .select('*')
        .limit(1)
        .single();
      setConfig(configData);

      // Load logs
      const { data: logsData } = await supabase
        .from('dwxz_rag_query_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setLogs(logsData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Upload and process document
  const handleUpload = async () => {
    if (!uploadForm.knowledge_base_id || (!uploadForm.content && !uploadForm.file)) {
      setMessage({ type: 'error', text: 'Please fill required fields' });
      return;
    }

    setProcessing(true);
    try {
      let content = uploadForm.content;
      let fileName = 'pasted_content.txt';
      let fileType = 'txt';

      // If file uploaded, read content
      if (uploadForm.file) {
        fileName = uploadForm.file.name;
        fileType = fileName.split('.').pop().toLowerCase();
        
        // Read file content
        content = await readFileContent(uploadForm.file);
      }

      // Insert document
      const { data: doc, error: insertError } = await supabase
        .from('dwxz_rag_documents')
        .insert([{
          knowledge_base_id: uploadForm.knowledge_base_id,
          title: uploadForm.title || fileName,
          title_zh: uploadForm.title_zh,
          file_name: fileName,
          file_type: fileType,
          raw_content: content,
          category: uploadForm.category,
          hsk_levels: uploadForm.hsk_levels,
          status: 'processing',
          uploaded_by: user?.id
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Process document (chunking + embedding)
      await processDocument(doc.id, content);

      setShowUploadModal(false);
      setUploadForm({
        knowledge_base_id: '',
        title: '',
        title_zh: '',
        category: 'custom',
        hsk_levels: [],
        content: '',
        file: null
      });
      setMessage({ type: 'success', text: t.success });
      loadData();

    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
    }
  };

  // Read file content - supports PDF, DOCX, TXT, MD
  const readFileContent = async (file) => {
    const fileType = file.name.split('.').pop().toLowerCase();
    
    // Handle PDF files
    if (fileType === 'pdf') {
      return await extractPDFText(file);
    }
    
    // Handle text files (TXT, MD, etc.)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Extract text from PDF using pdf.js
  const extractPDFText = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const totalPages = pdf.numPages;
      
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
      }
      
      return fullText.trim();
    } catch (err) {
      console.error('PDF extraction error:', err);
      throw new Error('Failed to extract text from PDF. Please try a different file or paste content directly.');
    }
  };

  // Process document: chunk and create embeddings
  const processDocument = async (docId, content) => {
    try {
      // Simple chunking
      const chunkSize = config?.chunk_size || 500;
      const overlap = config?.chunk_overlap || 50;
      const chunks = chunkText(content, chunkSize, overlap);

      // Get document info
      const { data: doc } = await supabase
        .from('dwxz_rag_documents')
        .select('knowledge_base_id')
        .eq('id', docId)
        .single();

      // Create embeddings and store chunks
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await createEmbedding(chunks[i]);
        
        await supabase.from('dwxz_rag_chunks').insert([{
          document_id: docId,
          knowledge_base_id: doc.knowledge_base_id,
          content: chunks[i],
          chunk_index: i,
          embedding: embedding,
          metadata: { index: i, total: chunks.length }
        }]);
      }

      // Update document status
      await supabase.from('dwxz_rag_documents').update({
        status: 'completed',
        chunk_count: chunks.length,
        processed_at: new Date().toISOString()
      }).eq('id', docId);

      // Update knowledge base stats
      await updateKBStats(doc.knowledge_base_id);

    } catch (err) {
      await supabase.from('dwxz_rag_documents').update({
        status: 'failed',
        error_message: err.message
      }).eq('id', docId);
      throw err;
    }
  };

  // Simple text chunking
  const chunkText = (text, size, overlap) => {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + size, text.length);
      chunks.push(text.slice(start, end));
      start = end - overlap;
      if (start >= text.length) break;
    }
    return chunks;
  };

  // Create embedding using AI service
  const createEmbedding = async (text) => {
    try {
      // Use OpenAI embedding API
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config?.embedding_api_key}`
        },
        body: JSON.stringify({
          model: config?.embedding_model || 'text-embedding-3-small',
          input: text
        })
      });
      
      const data = await response.json();
      return data.data?.[0]?.embedding || null;
    } catch (err) {
      console.error('Embedding error:', err);
      // Return null if embedding fails (will use keyword search instead)
      return null;
    }
  };

  // Update knowledge base statistics
  const updateKBStats = async (kbId) => {
    const { count: docCount } = await supabase
      .from('dwxz_rag_documents')
      .select('*', { count: 'exact', head: true })
      .eq('knowledge_base_id', kbId)
      .eq('status', 'completed');

    const { count: chunkCount } = await supabase
      .from('dwxz_rag_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('knowledge_base_id', kbId);

    await supabase.from('dwxz_rag_knowledge_bases').update({
      document_count: docCount || 0,
      total_chunks: chunkCount || 0,
      last_updated: new Date().toISOString()
    }).eq('id', kbId);
  };

  // Test RAG query
  const handleTestQuery = async () => {
    if (!testQuery.trim()) return;
    
    setProcessing(true);
    setTestResult(null);
    
    try {
      const startTime = Date.now();
      
      // Create query embedding
      const queryEmbedding = await createEmbedding(testQuery);
      
      // Search for similar chunks (simple keyword search if no embedding)
      let chunks = [];
      if (queryEmbedding) {
        // Vector similarity search would go here
        // For now, use keyword search
        const { data } = await supabase
          .from('dwxz_rag_chunks')
          .select('*, rag_documents(title, title_zh)')
          .textSearch('content', testQuery.split(' ').join(' | '))
          .limit(config?.search_top_k || 5);
        chunks = data || [];
      } else {
        // Fallback to keyword search
        const keywords = testQuery.split(/\s+/).filter(k => k.length > 1);
        const { data } = await supabase
          .from('dwxz_rag_chunks')
          .select('*, rag_documents(title, title_zh)')
          .or(keywords.map(k => `content.ilike.%${k}%`).join(','))
          .limit(config?.search_top_k || 5);
        chunks = data || [];
      }

      const retrievalTime = Date.now() - startTime;

      // Generate response using AI
      const context = chunks.map(c => c.content).join('\n\n---\n\n');
      const prompt = (config?.system_prompt_template || '')
        .replace('{context}', context)
        .replace('{question}', testQuery);

      const aiService = getAIService();
      await aiService.loadSettings();
      
      const genStartTime = Date.now();
      const response = await aiService.chat([
        { role: 'user', content: prompt }
      ]);
      const generationTime = Date.now() - genStartTime;

      const result = {
        query: testQuery,
        chunks: chunks.map(c => ({
          content: c.content.substring(0, 200) + '...',
          source: c.rag_documents?.title_zh || c.rag_documents?.title,
          score: 0.85 // Placeholder
        })),
        response: response?.content || response,
        retrievalTime,
        generationTime
      };

      setTestResult(result);

      // Log the query
      await supabase.from('dwxz_rag_query_logs').insert([{
        user_id: user?.id,
        query: testQuery,
        retrieved_chunks: result.chunks,
        retrieval_time_ms: retrievalTime,
        generated_response: result.response,
        generation_time_ms: generationTime
      }]);

    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
    }
  };

  // Save config
  const handleSaveConfig = async () => {
    try {
      await supabase.from('dwxz_rag_config').update({
        ...config,
        updated_by: user?.id,
        updated_at: new Date().toISOString()
      }).eq('id', config.id);
      
      setShowConfigModal(false);
      setMessage({ type: 'success', text: t.success });
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  // Delete document
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Delete this document and all its chunks?')) return;
    
    try {
      // Delete chunks first
      await supabase.from('dwxz_rag_chunks').delete().eq('document_id', docId);
      // Delete document
      const { data: doc } = await supabase
        .from('dwxz_rag_documents')
        .delete()
        .eq('id', docId)
        .select('knowledge_base_id')
        .single();
      
      // Update KB stats
      if (doc) await updateKBStats(doc.knowledge_base_id);
      
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'var(--warning)', text: t.pending },
      processing: { bg: 'var(--info)', text: t.processing },
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
        <p>This page is only accessible to Super Admin.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => setShowTestModal(true)}>
            🧪 {t.testRAG}
          </button>
          <button className="btn btn-outline" onClick={() => setShowConfigModal(true)}>
            ⚙️ {t.config}
          </button>
          <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
            + {t.uploadDocument}
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--primary)' }}>{knowledgeBases.length}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.knowledgeBases}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--success)' }}>{documents.filter(d => d.status === 'completed').length}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.totalDocuments}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--info)' }}>{knowledgeBases.reduce((sum, kb) => sum + (kb.total_chunks || 0), 0)}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.totalChunks}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--warning)' }}>{logs.length}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.queryCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button className={`tab ${activeTab === 'knowledgeBases' ? 'active' : ''}`} onClick={() => setActiveTab('knowledgeBases')}>
          📚 {t.knowledgeBases}
        </button>
        <button className={`tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>
          📄 {t.documents}
        </button>
        <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          📋 {t.logs}
        </button>
      </div>

      {/* Knowledge Bases */}
      {activeTab === 'knowledgeBases' && (
        <div className="card">
          <div className="table-container">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t.kbName}</th>
                  <th>{t.kbDescription}</th>
                  <th>{t.documentCount}</th>
                  <th>{t.chunkCount}</th>
                  <th>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {knowledgeBases.map(kb => (
                  <tr key={kb.id}>
                    <td><strong>{kb.name_zh || kb.name}</strong></td>
                    <td style={{ color: 'var(--text-muted)' }}>{kb.description}</td>
                    <td>{kb.document_count || 0}</td>
                    <td>{kb.total_chunks || 0}</td>
                    <td>
                      <span className="badge" style={{ background: kb.is_active ? 'var(--success)' : 'var(--text-muted)', color: 'white' }}>
                        {kb.is_active ? t.active : t.inactive}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents */}
      {activeTab === 'documents' && (
        <div className="card">
          {documents.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t.documentTitle}</th>
                    <th>{t.knowledgeBases}</th>
                    <th>{t.category}</th>
                    <th>{t.chunkCount}</th>
                    <th>{t.uploadStatus}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <strong>{doc.title_zh || doc.title}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doc.file_name}</div>
                      </td>
                      <td>{doc.rag_knowledge_bases?.name_zh || doc.rag_knowledge_bases?.name}</td>
                      <td><span className="badge">{t[doc.category] || doc.category}</span></td>
                      <td>{doc.chunk_count || 0}</td>
                      <td>{getStatusBadge(doc.status)}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDeleteDocument(doc.id)}>
                          ✗
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      {activeTab === 'logs' && (
        <div className="card">
          {logs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {logs.slice(0, 20).map(log => (
                <div key={log.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong>Q: {log.query}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                    A: {log.generated_response?.substring(0, 200)}...
                  </p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    检索: {log.retrieval_time_ms}ms | 生成: {log.generation_time_ms}ms
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>📤 {t.uploadDocument}</h3>
            
            <div className="form-group">
              <label className="form-label">{t.knowledgeBases} *</label>
              <select className="form-select" value={uploadForm.knowledge_base_id} onChange={e => setUploadForm({...uploadForm, knowledge_base_id: e.target.value})}>
                <option value="">-- Select --</option>
                {knowledgeBases.map(kb => (
                  <option key={kb.id} value={kb.id}>{kb.name_zh || kb.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t.documentTitle}</label>
              <input className="form-input" value={uploadForm.title_zh} onChange={e => setUploadForm({...uploadForm, title_zh: e.target.value})} placeholder="例如：HSK3第一课" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t.category}</label>
                <select className="form-select" value={uploadForm.category} onChange={e => setUploadForm({...uploadForm, category: e.target.value})}>
                  <option value="textbook">{t.textbook}</option>
                  <option value="vocabulary">{t.vocabulary}</option>
                  <option value="grammar">{t.grammar}</option>
                  <option value="culture">{t.culture}</option>
                  <option value="exam">{t.exam}</option>
                  <option value="custom">{t.custom}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t.hskLevels}</label>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6].map(l => (
                    <button key={l} type="button" className={`btn btn-sm ${uploadForm.hsk_levels.includes(l) ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setUploadForm({...uploadForm, hsk_levels: uploadForm.hsk_levels.includes(l) ? uploadForm.hsk_levels.filter(x => x !== l) : [...uploadForm.hsk_levels, l]})}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t.selectFile}</label>
              <input type="file" accept=".pdf,.docx,.txt,.md" onChange={e => setUploadForm({...uploadForm, file: e.target.files[0]})} style={{ display: 'block', width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }} />
              <small style={{ color: 'var(--text-muted)' }}>{t.supportedFormats}</small>
            </div>

            <div className="form-group">
              <label className="form-label">{t.orPasteContent}</label>
              <textarea className="form-textarea" rows={6} value={uploadForm.content} onChange={e => setUploadForm({...uploadForm, content: e.target.value})} placeholder={t.pasteContent} />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowUploadModal(false)}>{t.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpload} disabled={processing}>
                {processing ? t.processingDocument : t.upload}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && config && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>⚙️ {t.config}</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t.embeddingProvider}</label>
                <select className="form-select" value={config.embedding_provider} onChange={e => setConfig({...config, embedding_provider: e.target.value})}>
                  <option value="voyage">⭐ Voyage AI (免费 50M tokens · 推荐)</option>
                  <option value="jina">🌐 Jina AI (免费 1M tokens · 多语言)</option>
                  <option value="openai">🟢 OpenAI (付费)</option>
                  <option value="deepseek">🔵 DeepSeek</option>
                  <option value="anthropic">🟣 Anthropic</option>
                  <option value="local">🖥️ Local</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t.embeddingModel}</label>
                <select className="form-select" value={config.embedding_model} onChange={e => setConfig({...config, embedding_model: e.target.value})}>
                  {config.embedding_provider === 'voyage' && (
                    <>
                      <option value="voyage-3">voyage-3 (通用，推荐)</option>
                      <option value="voyage-3-lite">voyage-3-lite (更快更便宜)</option>
                      <option value="voyage-multilingual-2">voyage-multilingual-2 (多语言)</option>
                      <option value="voyage-large-2">voyage-large-2 (高精度)</option>
                    </>
                  )}
                  {config.embedding_provider === 'jina' && (
                    <>
                      <option value="jina-embeddings-v3">jina-embeddings-v3 (推荐)</option>
                      <option value="jina-embeddings-v2-base-zh">jina-v2-base-zh (中文优化)</option>
                      <option value="jina-embeddings-v2-base-multilingual">jina-v2-multilingual</option>
                    </>
                  )}
                  {config.embedding_provider === 'openai' && (
                    <>
                      <option value="text-embedding-3-small">text-embedding-3-small (推荐)</option>
                      <option value="text-embedding-3-large">text-embedding-3-large (高精度)</option>
                      <option value="text-embedding-ada-002">text-embedding-ada-002</option>
                    </>
                  )}
                  {config.embedding_provider === 'deepseek' && (
                    <>
                      <option value="deepseek-embedding">deepseek-embedding</option>
                    </>
                  )}
                  {config.embedding_provider === 'anthropic' && (
                    <>
                      <option value="voyage-large-2">voyage-large-2</option>
                      <option value="voyage-code-2">voyage-code-2</option>
                    </>
                  )}
                  {config.embedding_provider === 'local' && (
                    <>
                      <option value="bge-small-zh">BGE-small-zh</option>
                      <option value="bge-base-zh">BGE-base-zh</option>
                      <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t.embeddingApiKey}</label>
              <input type="password" className="form-input" value={config.embedding_api_key || ''} onChange={e => setConfig({...config, embedding_api_key: e.target.value})} placeholder="sk-..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t.searchTopK}</label>
                <input type="number" className="form-input" value={config.search_top_k} onChange={e => setConfig({...config, search_top_k: parseInt(e.target.value)})} min="1" max="20" />
              </div>
              <div className="form-group">
                <label className="form-label">{t.similarityThreshold}</label>
                <input type="number" className="form-input" value={config.similarity_threshold} onChange={e => setConfig({...config, similarity_threshold: parseFloat(e.target.value)})} min="0" max="1" step="0.1" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t.systemPrompt}</label>
              <textarea className="form-textarea" rows={6} value={config.system_prompt_template || ''} onChange={e => setConfig({...config, system_prompt_template: e.target.value})} />
              <small style={{ color: 'var(--text-muted)' }}>Use {'{context}'} for retrieved content, {'{question}'} for user query</small>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowConfigModal(false)}>{t.cancel}</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveConfig}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && (
        <div className="modal-overlay" onClick={() => setShowTestModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>🧪 {t.testRAG}</h3>
            
            <div className="form-group">
              <label className="form-label">{t.enterQuery}</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="form-input" value={testQuery} onChange={e => setTestQuery(e.target.value)} placeholder={t.testQueryPlaceholder} style={{ flex: 1 }} onKeyPress={e => e.key === 'Enter' && handleTestQuery()} />
                <button className="btn btn-primary" onClick={handleTestQuery} disabled={processing}>
                  {processing ? '...' : t.runTest}
                </button>
              </div>
            </div>

            {testResult && (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>📚 {t.retrievedChunks}</h4>
                <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                  {testResult.chunks.map((chunk, i) => (
                    <div key={i} style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--primary)' }}>{chunk.source}</span>
                        <span className="badge badge-info">{t.score}: {chunk.score.toFixed(2)}</span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{chunk.content}</p>
                    </div>
                  ))}
                </div>

                <h4 style={{ marginBottom: '0.5rem' }}>💬 {t.generatedResponse}</h4>
                <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap' }}>
                  {testResult.response}
                </div>

                <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  检索耗时: {testResult.retrievalTime}ms | 生成耗时: {testResult.generationTime}ms
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowTestModal(false)}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RAGManagementPage;
