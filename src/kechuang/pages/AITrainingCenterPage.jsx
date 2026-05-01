import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const AITrainingCenterPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  
  // State
  const [activeTab, setActiveTab] = useState('upload');
  const [files, setFiles] = useState([]);
  const [pendingMaterials, setPendingMaterials] = useState([]);
  const [approvedMaterials, setApprovedMaterials] = useState([]);
  const [processedMaterials, setProcessedMaterials] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ pending: 0, approved: 0, processed: 0, chunks: 0 });
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedItems, setSelectedItems] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  
  // Upload config
  const [uploadConfig, setUploadConfig] = useState({
    knowledgeBaseId: '',
    category: 'textbook',
    hskLevels: [],
    description: ''
  });

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const isSuperAdmin = user?.role === 'super_admin';
  const isTeacher = user?.role === 'teacher' || user?.role === 'super_admin';

  const txt = {
    zh: {
      title: '📚 教学资料库',
      subtitle: isSuperAdmin ? '管理、审核、处理教学资料，拓展教学资源' : '上传教学资料，用于教学资源拓展',
      
      // Tabs
      upload: '上传资料',
      pending: '待审核',
      approved: '已批准',
      processed: '已处理',
      training: '资源统计',
      
      // Upload
      selectFiles: '选择文件',
      selectFolder: '选择整个文件夹',
      dragDrop: '或拖拽文件/文件夹到此处',
      supportedFormats: '支持: PDF, Word, TXT, 图片, 音频, 视频',
      uploadButton: '提交审核',
      uploadDirect: '直接处理',
      
      // Config
      targetKB: '目标知识库',
      category: '分类',
      hskLevels: 'HSK等级',
      description: '资料说明',
      descriptionPlaceholder: '简要描述这批资料的内容...',
      
      // Categories
      textbook: '教材',
      vocabulary: '词汇',
      grammar: '语法',
      listening: '听力',
      reading: '阅读',
      speaking: '口语',
      writing: '写作',
      culture: '文化',
      exam: '考试真题',
      other: '其他',
      
      // Review
      reviewTitle: '审核资料',
      approve: '批准',
      reject: '拒绝',
      approveSelected: '批准选中',
      rejectSelected: '拒绝选中',
      approveAll: '全部批准',
      rejectReason: '拒绝原因',
      
      // Processing
      processSelected: '处理选中',
      processAll: '处理全部',
      processing: '处理中...',
      autoProcess: '自动处理已批准资料',
      
      // Status
      statusPending: '待审核',
      statusApproved: '已批准',
      statusRejected: '已拒绝',
      statusProcessing: '处理中',
      statusCompleted: '已完成',
      statusFailed: '失败',
      
      // Table
      fileName: '文件名',
      fileType: '类型',
      fileSize: '大小',
      uploadedBy: '上传者',
      uploadedAt: '上传时间',
      status: '状态',
      actions: '操作',
      chunks: '分块数',
      
      // Stats
      statPending: '待审核',
      statApproved: '已批准',
      statProcessed: '已处理',
      statChunks: '总分块',
      
      // Messages
      uploadSuccess: '资料已提交，等待管理员审核',
      uploadDirectSuccess: '资料已处理完成',
      approveSuccess: '资料已批准',
      rejectSuccess: '资料已拒绝',
      processSuccess: '处理完成',
      noFiles: '请先选择文件',
      noKB: '请选择目标知识库',
      noAPIKey: '请先在RAG配置中设置API密钥',
      
      // Preview
      preview: '预览',
      close: '关闭',
      content: '内容预览',
      
      // Training
      trainingTitle: '资源统计',
      totalDocs: '文档总数',
      totalChunks: '分块总数',
      kbCount: '知识库数',
      aiReady: '状态',
      ready: '就绪',
      notReady: '未就绪',
      testAI: '测试搜索',
      testPlaceholder: '输入关键词搜索资料...',
      testButton: '搜索',
      sources: '参考来源',
      
      // Logs
      logs: '处理日志',
      clearLogs: '清空'
    },
    en: {
      title: '📚 Teaching Resources',
      subtitle: isSuperAdmin ? 'Manage, review, and process teaching materials' : 'Upload teaching materials to expand resources',
      
      upload: 'Upload',
      pending: 'Pending',
      approved: 'Approved',
      processed: 'Processed',
      training: 'Statistics',
      
      selectFiles: 'Select Files',
      selectFolder: 'Select Folder',
      dragDrop: 'or drag & drop files/folders here',
      supportedFormats: 'Supports: PDF, Word, TXT, Images, Audio, Video',
      uploadButton: 'Submit for Review',
      uploadDirect: 'Process Directly',
      
      targetKB: 'Target Knowledge Base',
      category: 'Category',
      hskLevels: 'HSK Levels',
      description: 'Description',
      descriptionPlaceholder: 'Brief description of these materials...',
      
      textbook: 'Textbook',
      vocabulary: 'Vocabulary',
      grammar: 'Grammar',
      listening: 'Listening',
      reading: 'Reading',
      speaking: 'Speaking',
      writing: 'Writing',
      culture: 'Culture',
      exam: 'Exam',
      other: 'Other',
      
      reviewTitle: 'Review Materials',
      approve: 'Approve',
      reject: 'Reject',
      approveSelected: 'Approve Selected',
      rejectSelected: 'Reject Selected',
      approveAll: 'Approve All',
      rejectReason: 'Rejection Reason',
      
      processSelected: 'Process Selected',
      processAll: 'Process All',
      processing: 'Processing...',
      autoProcess: 'Auto-process approved materials',
      
      statusPending: 'Pending',
      statusApproved: 'Approved',
      statusRejected: 'Rejected',
      statusProcessing: 'Processing',
      statusCompleted: 'Completed',
      statusFailed: 'Failed',
      
      fileName: 'File Name',
      fileType: 'Type',
      fileSize: 'Size',
      uploadedBy: 'Uploaded By',
      uploadedAt: 'Uploaded At',
      status: 'Status',
      actions: 'Actions',
      chunks: 'Chunks',
      
      statPending: 'Pending',
      statApproved: 'Approved',
      statProcessed: 'Processed',
      statChunks: 'Total Chunks',
      
      uploadSuccess: 'Materials submitted for review',
      uploadDirectSuccess: 'Materials processed successfully',
      approveSuccess: 'Materials approved',
      rejectSuccess: 'Materials rejected',
      processSuccess: 'Processing complete',
      noFiles: 'Please select files first',
      noKB: 'Please select a knowledge base',
      noAPIKey: 'Please configure API key in RAG settings',
      
      preview: 'Preview',
      close: 'Close',
      content: 'Content Preview',
      
      trainingTitle: 'AI Training Status',
      totalDocs: 'Total Documents',
      totalChunks: 'Total Chunks',
      kbCount: 'Knowledge Bases',
      aiReady: 'AI Status',
      ready: 'Ready',
      notReady: 'Not Ready',
      testAI: 'Test AI',
      testPlaceholder: 'Enter a question to test AI...',
      testButton: 'Test',
      sources: 'Sources',
      
      logs: 'Processing Logs',
      clearLogs: 'Clear'
    }
  };
  const t = txt[language] || txt.en;

  // Icons
  const typeIcons = { pdf: '📄', word: '📝', text: '📃', image: '🖼️', audio: '🎵', video: '🎬', other: '📁' };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    
    try {
      // Load config
      const { data: configData } = await supabase.from('dwxz_rag_config').select('*').limit(1).single();
      setConfig(configData);

      // Load knowledge bases
      const { data: kbData } = await supabase.from('dwxz_rag_knowledge_bases').select('*').eq('is_active', true);
      setKnowledgeBases(kbData || []);
      if (kbData?.length > 0 && !uploadConfig.knowledgeBaseId) {
        setUploadConfig(prev => ({ ...prev, knowledgeBaseId: kbData[0].id }));
      }

      // Load materials by status
      let query = supabase.from('dwxz_training_materials').select('*, users:uploaded_by(name, name_zh)');
      
      // Teachers only see their own uploads
      if (!isSuperAdmin) {
        query = query.eq('uploaded_by', user?.id);
      }
      
      const { data: materials } = await query.order('created_at', { ascending: false });
      
      if (materials) {
        setPendingMaterials(materials.filter(m => m.review_status === 'pending'));
        setApprovedMaterials(materials.filter(m => m.review_status === 'approved' && m.process_status !== 'completed'));
        setProcessedMaterials(materials.filter(m => m.process_status === 'completed'));
      }

      // Load stats
      const pending = materials?.filter(m => m.review_status === 'pending').length || 0;
      const approved = materials?.filter(m => m.review_status === 'approved').length || 0;
      const processed = materials?.filter(m => m.process_status === 'completed').length || 0;
      
      const { count: chunkCount } = await supabase.from('dwxz_rag_chunks').select('*', { count: 'exact', head: true });

      setStats({ pending, approved, processed, chunks: chunkCount || 0 });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // File type detection
  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'word';
    if (['txt', 'md', 'rtf'].includes(ext)) return 'text';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp3', 'wav', 'm4a'].includes(ext)) return 'audio';
    if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
    return 'other';
  };

  // HSK detection
  const detectHSKLevel = (filename) => {
    const match = filename.match(/HSK\s*(\d)/i);
    return match ? [parseInt(match[1])] : [];
  };

  // Category detection
  const detectCategory = (filename) => {
    const lower = filename.toLowerCase();
    if (/vocab|词汇|单词/.test(lower)) return 'vocabulary';
    if (/grammar|语法/.test(lower)) return 'grammar';
    if (/listen|听力/.test(lower)) return 'listening';
    if (/read|阅读/.test(lower)) return 'reading';
    if (/speak|口语/.test(lower)) return 'speaking';
    if (/writ|写作/.test(lower)) return 'writing';
    if (/culture|文化/.test(lower)) return 'culture';
    if (/exam|考试|真题/.test(lower)) return 'exam';
    return 'textbook';
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  // Handle folder selection
  const handleFolderSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  // Handle drag & drop
  const handleDrop = async (e) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    const allFiles = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i].webkitGetAsEntry?.();
      if (item) {
        const files = await traverseFileTree(item);
        allFiles.push(...files);
      } else {
        const file = e.dataTransfer.files[i];
        if (file) allFiles.push(file);
      }
    }
    addFiles(allFiles);
  };

  // Traverse file tree
  const traverseFileTree = (item) => {
    return new Promise((resolve) => {
      if (item.isFile) {
        item.file((file) => resolve([file]));
      } else if (item.isDirectory) {
        const dirReader = item.createReader();
        dirReader.readEntries(async (entries) => {
          const files = [];
          for (const entry of entries) {
            const subFiles = await traverseFileTree(entry);
            files.push(...subFiles);
          }
          resolve(files);
        });
      } else {
        resolve([]);
      }
    });
  };

  // Add files
  const addFiles = (newFiles) => {
    const validExt = ['pdf', 'doc', 'docx', 'txt', 'md', 'jpg', 'jpeg', 'png', 'gif', 'mp3', 'wav', 'mp4', 'webm'];
    
    const fileObjects = newFiles
      .filter(file => validExt.includes(file.name.split('.').pop().toLowerCase()))
      .map(file => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        type: getFileType(file.name),
        hskLevels: detectHSKLevel(file.name),
        category: detectCategory(file.name),
        status: 'ready'
      }));

    setFiles(prev => [...prev, ...fileObjects]);
  };

  // Format size
  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Submit files for review (teachers)
  const submitForReview = async () => {
    if (files.length === 0) {
      setMessage({ type: 'error', text: t.noFiles });
      return;
    }
    if (!uploadConfig.knowledgeBaseId) {
      setMessage({ type: 'error', text: t.noKB });
      return;
    }

    setProcessing(true);
    addLog('📤 Uploading files for review...');

    try {
      for (const fileObj of files) {
        const base64 = await fileToBase64(fileObj.file);
        
        await supabase.from('dwxz_training_materials').insert([{
          knowledge_base_id: uploadConfig.knowledgeBaseId,
          file_name: fileObj.name,
          file_type: fileObj.type,
          file_size: fileObj.size,
          file_data: base64,
          category: fileObj.category || uploadConfig.category,
          hsk_levels: fileObj.hskLevels.length > 0 ? fileObj.hskLevels : uploadConfig.hskLevels,
          description: uploadConfig.description,
          uploaded_by: user?.id,
          review_status: 'pending',
          process_status: 'pending'
        }]);
        
        addLog(`✅ Uploaded: ${fileObj.name}`);
      }

      setFiles([]);
      setMessage({ type: 'success', text: t.uploadSuccess });
      loadData();
      
    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error');
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
    }
  };

  // Direct upload and process (super admin only)
  const uploadAndProcess = async () => {
    if (files.length === 0) {
      setMessage({ type: 'error', text: t.noFiles });
      return;
    }
    if (!uploadConfig.knowledgeBaseId) {
      setMessage({ type: 'error', text: t.noKB });
      return;
    }
    if (!config?.embedding_api_key) {
      setMessage({ type: 'error', text: t.noAPIKey });
      return;
    }

    setProcessing(true);
    addLog('🚀 Direct upload and processing...');

    try {
      for (const fileObj of files) {
        addLog(`📄 Processing: ${fileObj.name}`);
        
        // Upload file
        const base64 = await fileToBase64(fileObj.file);
        
        const { data: material, error } = await supabase.from('dwxz_training_materials').insert([{
          knowledge_base_id: uploadConfig.knowledgeBaseId,
          file_name: fileObj.name,
          file_type: fileObj.type,
          file_size: fileObj.size,
          file_data: base64,
          category: fileObj.category || uploadConfig.category,
          hsk_levels: fileObj.hskLevels.length > 0 ? fileObj.hskLevels : uploadConfig.hskLevels,
          description: uploadConfig.description,
          uploaded_by: user?.id,
          review_status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          process_status: 'processing'
        }]).select().single();

        if (error) throw error;

        // Process immediately
        await processMaterial(material);
      }

      setFiles([]);
      setMessage({ type: 'success', text: t.uploadDirectSuccess });
      loadData();
      
    } catch (err) {
      addLog(`❌ Error: ${err.message}`, 'error');
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProcessing(false);
    }
  };

  // Approve materials
  const approveMaterials = async (ids) => {
    try {
      await supabase.from('dwxz_training_materials').update({
        review_status: 'approved',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      }).in('id', ids);

      setMessage({ type: 'success', text: t.approveSuccess });
      setSelectedItems([]);
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Reject materials
  const rejectMaterials = async (ids, reason = '') => {
    try {
      await supabase.from('dwxz_training_materials').update({
        review_status: 'rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        reject_reason: reason
      }).in('id', ids);

      setMessage({ type: 'success', text: t.rejectSuccess });
      setSelectedItems([]);
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Process single material
  const processMaterial = async (material) => {
    try {
      addLog(`   └─ Extracting text...`);
      
      // Extract text based on type
      let text = '';
      if (material.file_type === 'pdf') {
        text = await extractPDFText(material.file_data);
      } else if (material.file_type === 'text' || material.file_type === 'word') {
        // For text files, decode base64
        const base64Content = material.file_data.split(',')[1];
        text = atob(base64Content);
      } else {
        text = `[${material.file_type}: ${material.file_name}]`;
      }

      if (!text || text.length < 50) {
        throw new Error('No text extracted');
      }

      addLog(`   └─ Creating chunks...`);
      const chunks = chunkText(text);
      addLog(`   └─ ${chunks.length} chunks created`);

      // Create document record
      const { data: doc } = await supabase.from('dwxz_rag_documents').insert([{
        knowledge_base_id: material.knowledge_base_id,
        title: material.file_name.replace(/\.[^/.]+$/, ''),
        title_zh: material.file_name.replace(/\.[^/.]+$/, ''),
        file_name: material.file_name,
        file_type: material.file_type,
        file_size: material.file_size,
        raw_content: text,
        category: material.category,
        hsk_levels: material.hsk_levels,
        status: 'processing',
        uploaded_by: material.uploaded_by
      }]).select().single();

      // Create embeddings
      addLog(`   └─ Creating embeddings...`);
      let savedChunks = 0;
      
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await createEmbedding(chunks[i]);
        
        await supabase.from('dwxz_rag_chunks').insert([{
          document_id: doc.id,
          knowledge_base_id: material.knowledge_base_id,
          content: chunks[i],
          chunk_index: i,
          embedding,
          metadata: {
            source: material.file_name,
            category: material.category,
            hsk_levels: material.hsk_levels
          }
        }]);
        
        savedChunks++;
      }

      // Update document
      await supabase.from('dwxz_rag_documents').update({
        status: 'completed',
        chunk_count: chunks.length,
        processed_at: new Date().toISOString()
      }).eq('id', doc.id);

      // Update material
      await supabase.from('dwxz_training_materials').update({
        process_status: 'completed',
        chunk_count: chunks.length,
        processed_at: new Date().toISOString()
      }).eq('id', material.id);

      // Update KB stats
      await updateKBStats(material.knowledge_base_id);

      addLog(`   ✅ Completed: ${savedChunks} chunks`, 'success');
      
    } catch (err) {
      await supabase.from('dwxz_training_materials').update({
        process_status: 'failed',
        error_message: err.message
      }).eq('id', material.id);
      
      addLog(`   ❌ Failed: ${err.message}`, 'error');
    }
  };

  // Extract PDF text
  const extractPDFText = async (base64Data) => {
    const binaryString = atob(base64Data.split(',')[1]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
    }
    
    return fullText.trim();
  };

  // Chunk text
  const chunkText = (text, size = 500, overlap = 50) => {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      chunks.push(text.slice(start, start + size));
      start += size - overlap;
    }
    return chunks.filter(c => c.trim().length > 50);
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
          input: text.substring(0, 8000)
        })
      });
      const data = await response.json();
      return data.data?.[0]?.embedding || null;
    } catch (err) {
      return null;
    }
  };

  // Update KB stats
  const updateKBStats = async (kbId) => {
    const { count: docCount } = await supabase.from('dwxz_rag_documents')
      .select('*', { count: 'exact', head: true })
      .eq('knowledge_base_id', kbId)
      .eq('status', 'completed');

    const { count: chunkCount } = await supabase.from('dwxz_rag_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('knowledge_base_id', kbId);

    await supabase.from('dwxz_rag_knowledge_bases').update({
      document_count: docCount || 0,
      total_chunks: chunkCount || 0,
      last_updated: new Date().toISOString()
    }).eq('id', kbId);
  };

  // Process approved materials
  const processApproved = async (ids) => {
    if (!config?.embedding_api_key) {
      setMessage({ type: 'error', text: t.noAPIKey });
      return;
    }

    setProcessing(true);
    addLog('🚀 Processing approved materials...');

    const materialsToProcess = approvedMaterials.filter(m => ids.includes(m.id));

    for (const material of materialsToProcess) {
      addLog(`📄 Processing: ${material.file_name}`);
      await processMaterial(material);
    }

    addLog('✅ Processing complete!', 'success');
    setMessage({ type: 'success', text: t.processSuccess });
    setSelectedItems([]);
    setProcessing(false);
    loadData();
  };

  // Add log
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Toggle selection
  const toggleSelect = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Select all
  const selectAll = (items) => {
    setSelectedItems(items.map(i => i.id));
  };

  // Status badge
  const getStatusBadge = (status, type = 'review') => {
    const styles = {
      pending: { bg: '#f59e0b', label: t.statusPending },
      approved: { bg: '#22c55e', label: t.statusApproved },
      rejected: { bg: '#ef4444', label: t.statusRejected },
      processing: { bg: '#3b82f6', label: t.statusProcessing },
      completed: { bg: '#22c55e', label: t.statusCompleted },
      failed: { bg: '#ef4444', label: t.statusFailed }
    };
    const s = styles[status] || styles.pending;
    return <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', background: s.bg, color: 'white', fontSize: '0.75rem' }}>{s.label}</span>;
  };

  if (!isTeacher) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>🔒 Access Denied</h2>
        <p>Teachers and Super Admin only</p>
      </div>
    );
  }

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
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
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.75rem', color: '#f59e0b' }}>{stats.pending}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.statPending}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.75rem', color: '#22c55e' }}>{stats.approved}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.statApproved}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.75rem', color: '#3b82f6' }}>{stats.processed}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.statProcessed}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.75rem', color: '#8b5cf6' }}>{stats.chunks}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.statChunks}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('upload')}>
          📤 {t.upload}
        </button>
        {isSuperAdmin && (
          <>
            <button className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('pending')}>
              ⏳ {t.pending} {stats.pending > 0 && <span className="badge" style={{ marginLeft: '0.5rem', background: '#f59e0b' }}>{stats.pending}</span>}
            </button>
            <button className={`btn ${activeTab === 'approved' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('approved')}>
              ✅ {t.approved} {approvedMaterials.length > 0 && <span className="badge" style={{ marginLeft: '0.5rem', background: '#22c55e' }}>{approvedMaterials.length}</span>}
            </button>
          </>
        )}
        <button className={`btn ${activeTab === 'processed' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('processed')}>
          📦 {t.processed}
        </button>
        <button className={`btn ${activeTab === 'training' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('training')}>
          🧠 {t.training}
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📤 {t.upload}</h3>
          
          {/* Upload Zone */}
          <div 
            style={{ 
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '2rem',
              textAlign: 'center',
              marginBottom: '1.5rem',
              background: 'var(--background)',
              cursor: 'pointer'
            }}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
            <input ref={folderInputRef} type="file" webkitdirectory="" onChange={handleFolderSelect} style={{ display: 'none' }} />
            
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <button className="btn btn-primary" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                📄 {t.selectFiles}
              </button>
              <button className="btn btn-outline" onClick={e => { e.stopPropagation(); folderInputRef.current?.click(); }}>
                📁 {t.selectFolder}
              </button>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.dragDrop}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>{t.supportedFormats}</div>
          </div>

          {/* Config */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{t.targetKB} *</label>
              <select className="form-select" value={uploadConfig.knowledgeBaseId} onChange={e => setUploadConfig(prev => ({ ...prev, knowledgeBaseId: e.target.value }))}>
                <option value="">-- Select --</option>
                {knowledgeBases.map(kb => <option key={kb.id} value={kb.id}>{kb.name_zh || kb.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t.category}</label>
              <select className="form-select" value={uploadConfig.category} onChange={e => setUploadConfig(prev => ({ ...prev, category: e.target.value }))}>
                {['textbook', 'vocabulary', 'grammar', 'listening', 'reading', 'speaking', 'writing', 'culture', 'exam', 'other'].map(cat => (
                  <option key={cat} value={cat}>{t[cat]}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t.hskLevels}</label>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {[1,2,3,4,5,6].map(level => (
                  <button
                    key={level}
                    className={`btn btn-sm ${uploadConfig.hskLevels.includes(level) ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setUploadConfig(prev => ({
                      ...prev,
                      hskLevels: prev.hskLevels.includes(level) ? prev.hskLevels.filter(l => l !== level) : [...prev.hskLevels, level]
                    }))}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">{t.description}</label>
            <textarea 
              className="form-textarea" 
              rows={2} 
              value={uploadConfig.description}
              onChange={e => setUploadConfig(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t.descriptionPlaceholder}
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong>{files.length} files selected</strong>
                <button className="btn btn-outline btn-sm" onClick={() => setFiles([])}>Clear</button>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                {files.map(f => (
                  <div key={f.id} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{typeIcons[f.type]}</span>
                    <span style={{ flex: 1 }}>{f.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatSize(f.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            {isSuperAdmin ? (
              <>
                <button className="btn btn-primary" onClick={uploadAndProcess} disabled={processing || files.length === 0}>
                  {processing ? '⏳ Processing...' : `🚀 ${t.uploadDirect}`}
                </button>
                <button className="btn btn-outline" onClick={submitForReview} disabled={processing || files.length === 0}>
                  📤 {t.uploadButton}
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={submitForReview} disabled={processing || files.length === 0}>
                {processing ? '⏳ Uploading...' : `📤 ${t.uploadButton}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pending Review Tab (Super Admin only) */}
      {activeTab === 'pending' && isSuperAdmin && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>⏳ {t.pending} ({pendingMaterials.length})</h3>
            {pendingMaterials.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-outline" onClick={() => selectAll(pendingMaterials)}>Select All</button>
                <button className="btn btn-sm btn-success" onClick={() => approveMaterials(selectedItems)} disabled={selectedItems.length === 0}>
                  ✅ {t.approveSelected}
                </button>
                <button className="btn btn-sm btn-error" onClick={() => rejectMaterials(selectedItems)} disabled={selectedItems.length === 0}>
                  ❌ {t.rejectSelected}
                </button>
              </div>
            )}
          </div>

          {pendingMaterials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <p>No pending materials</p>
            </div>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>{t.fileName}</th>
                    <th>{t.category}</th>
                    <th>{t.uploadedBy}</th>
                    <th>{t.uploadedAt}</th>
                    <th>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingMaterials.map(m => (
                    <tr key={m.id}>
                      <td>
                        <input type="checkbox" checked={selectedItems.includes(m.id)} onChange={() => toggleSelect(m.id)} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {typeIcons[m.file_type]} {m.file_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatSize(m.file_size)}</div>
                      </td>
                      <td><span className="badge">{t[m.category] || m.category}</span></td>
                      <td>{m.users?.name_zh || m.users?.name || 'Unknown'}</td>
                      <td>{formatDate(m.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-sm btn-success" onClick={() => approveMaterials([m.id])}>✅</button>
                          <button className="btn btn-sm btn-error" onClick={() => rejectMaterials([m.id])}>❌</button>
                          <button className="btn btn-sm btn-outline" onClick={() => setPreviewItem(m)}>👁️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Approved Tab (Super Admin only) */}
      {activeTab === 'approved' && isSuperAdmin && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>✅ {t.approved} ({approvedMaterials.length})</h3>
            {approvedMaterials.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm btn-outline" onClick={() => selectAll(approvedMaterials)}>Select All</button>
                <button className="btn btn-sm btn-primary" onClick={() => processApproved(selectedItems)} disabled={processing || selectedItems.length === 0}>
                  {processing ? '⏳ Processing...' : `🚀 ${t.processSelected}`}
                </button>
                <button className="btn btn-sm btn-success" onClick={() => processApproved(approvedMaterials.map(m => m.id))} disabled={processing}>
                  {processing ? '⏳ Processing...' : `🚀 ${t.processAll}`}
                </button>
              </div>
            )}
          </div>

          {approvedMaterials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <p>No approved materials waiting for processing</p>
            </div>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>{t.fileName}</th>
                    <th>{t.category}</th>
                    <th>{t.status}</th>
                    <th>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedMaterials.map(m => (
                    <tr key={m.id}>
                      <td><input type="checkbox" checked={selectedItems.includes(m.id)} onChange={() => toggleSelect(m.id)} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {typeIcons[m.file_type]} {m.file_name}
                        </div>
                      </td>
                      <td><span className="badge">{t[m.category] || m.category}</span></td>
                      <td>{getStatusBadge(m.process_status, 'process')}</td>
                      <td>
                        <button className="btn btn-sm btn-primary" onClick={() => processApproved([m.id])} disabled={processing}>
                          🚀 Process
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

      {/* Processed Tab */}
      {activeTab === 'processed' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📦 {t.processed} ({processedMaterials.length})</h3>

          {processedMaterials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <p>No processed materials yet</p>
            </div>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t.fileName}</th>
                    <th>{t.category}</th>
                    <th>{t.chunks}</th>
                    <th>Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {processedMaterials.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {typeIcons[m.file_type]} {m.file_name}
                        </div>
                      </td>
                      <td><span className="badge">{t[m.category] || m.category}</span></td>
                      <td><span className="badge badge-info">{m.chunk_count || 0}</span></td>
                      <td>{formatDate(m.processed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Training Tab */}
      {activeTab === 'training' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🧠 {t.trainingTitle}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--primary)' }}>{stats.processed}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.totalDocs}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--success)' }}>{stats.chunks}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.totalChunks}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--info)' }}>{knowledgeBases.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.kbCount}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: stats.chunks > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                {stats.chunks > 0 ? '✅' : '⏳'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.aiReady}</div>
            </div>
          </div>

          {/* Knowledge Bases */}
          <h4 style={{ marginBottom: '0.5rem' }}>Knowledge Bases</h4>
          <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {knowledgeBases.map(kb => (
              <div key={kb.id} style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <strong>{kb.name_zh || kb.name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{kb.description || 'No description'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>{kb.document_count || 0} docs</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{kb.total_chunks || 0} chunks</div>
                </div>
              </div>
            ))}
          </div>

          {/* Processing Logs */}
          {logs.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4>{t.logs}</h4>
                <button className="btn btn-outline btn-sm" onClick={() => setLogs([])}>{t.clearLogs}</button>
              </div>
              <div style={{ background: '#1a1a2e', color: '#10b981', padding: '1rem', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                {logs.map((log, i) => (
                  <div key={i} style={{ color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#22c55e' : '#a5b4fc' }}>
                    [{log.timestamp}] {log.message}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="modal-overlay" onClick={() => setPreviewItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3>{typeIcons[previewItem.file_type]} {previewItem.file_name}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setPreviewItem(null)}>✕</button>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <div><strong>{t.category}:</strong> {t[previewItem.category] || previewItem.category}</div>
              <div><strong>{t.fileSize}:</strong> {formatSize(previewItem.file_size)}</div>
              <div><strong>{t.uploadedBy}:</strong> {previewItem.users?.name_zh || previewItem.users?.name}</div>
              <div><strong>{t.uploadedAt}:</strong> {formatDate(previewItem.created_at)}</div>
              {previewItem.description && <div><strong>{t.description}:</strong> {previewItem.description}</div>}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => { approveMaterials([previewItem.id]); setPreviewItem(null); }}>
                ✅ {t.approve}
              </button>
              <button className="btn btn-error" style={{ flex: 1 }} onClick={() => { rejectMaterials([previewItem.id]); setPreviewItem(null); }}>
                ❌ {t.reject}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AITrainingCenterPage;
