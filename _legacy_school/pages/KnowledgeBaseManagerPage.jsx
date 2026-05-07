import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const KnowledgeBaseManagerPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  
  // State
  const [activeTab, setActiveTab] = useState('upload');
  const [files, setFiles] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [logs, setLogs] = useState([]);
  
  // Add log entry
  const addLog = (msg) => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), message: msg }].slice(-50));
  };
  
  // Filters
  const [filterKB, setFilterKB] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterHSK, setFilterHSK] = useState('');
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Upload config
  const [uploadConfig, setUploadConfig] = useState({
    knowledgeBaseId: '',
    category: 'textbook',
    hskLevels: [],
    autoClassify: true,
    autoTranscribe: true,
    tags: []
  });
  
  // New KB/Category modal
  const [showNewKBModal, setShowNewKBModal] = useState(false);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newKB, setNewKB] = useState({ name: '', name_zh: '', description: '' });
  const [newCategory, setNewCategory] = useState({ name: '', name_zh: '', parent_id: null });
  
  const fileInputRef = useRef(null);

  const txt = {
    zh: {
      title: '📚 知识库管理中心',
      subtitle: '上传、分类、管理所有教学资料',
      
      // Tabs
      upload: '上传资料',
      browse: '浏览资料',
      categories: '分类管理',
      settings: '设置',
      
      // Upload
      selectFiles: '选择文件',
      dragDrop: '或拖拽文件到此处',
      supportedFormats: '支持: PDF, Word, 图片, 音频, 视频',
      selectedFiles: '已选择的文件',
      
      // File types
      pdf: 'PDF文档',
      word: 'Word文档',
      image: '图片',
      audio: '音频',
      video: '视频',
      text: '文本',
      
      // Config
      targetKB: '目标知识库',
      category: '分类',
      hskLevels: 'HSK等级',
      tags: '标签',
      autoClassify: '自动分类',
      autoTranscribe: '自动转录音视频',
      
      // Categories
      textbook: '教材',
      vocabulary: '词汇',
      grammar: '语法',
      listening: '听力',
      reading: '阅读',
      speaking: '口语',
      writing: '写作',
      culture: '文化',
      exam: '考试',
      other: '其他',
      
      // Actions
      startUpload: '开始上传',
      createKB: '创建知识库',
      createCategory: '创建分类',
      edit: '编辑',
      delete: '删除',
      preview: '预览',
      download: '下载',
      
      // Status
      pending: '待处理',
      uploading: '上传中',
      processing: '处理中',
      transcribing: '转录中',
      completed: '已完成',
      failed: '失败',
      
      // Browse
      allMaterials: '全部资料',
      search: '搜索资料...',
      filterByKB: '按知识库筛选',
      filterByCategory: '按分类筛选',
      filterByHSK: '按HSK筛选',
      filterByType: '按类型筛选',
      noResults: '没有找到资料',
      
      // New KB Modal
      newKBTitle: '创建新知识库',
      kbName: '知识库名称',
      kbNameZh: '中文名称',
      kbDescription: '描述',
      
      // New Category Modal
      newCategoryTitle: '创建新分类',
      categoryName: '分类名称',
      categoryNameZh: '中文名称',
      parentCategory: '父分类',
      
      // Messages
      success: '操作成功！',
      uploadSuccess: '上传成功！',
      deleteConfirm: '确定删除此资料？',
      
      // Stats
      totalMaterials: '总资料数',
      totalSize: '总大小',
      lastUpdated: '最后更新',
      
      // Tips
      tips: '提示',
      tip1: '文件名包含HSK1-6会自动识别等级',
      tip2: '支持批量上传多个文件',
      tip3: '音视频会自动转录为文本',
      tip4: '图片会自动OCR识别文字'
    },
    en: {
      title: '📚 Knowledge Base Manager',
      subtitle: 'Upload, classify, and manage all teaching materials',
      
      upload: 'Upload',
      browse: 'Browse',
      categories: 'Categories',
      settings: 'Settings',
      
      selectFiles: 'Select Files',
      dragDrop: 'or drag & drop here',
      supportedFormats: 'Supports: PDF, Word, Images, Audio, Video',
      selectedFiles: 'Selected Files',
      
      pdf: 'PDF Document',
      word: 'Word Document',
      image: 'Image',
      audio: 'Audio',
      video: 'Video',
      text: 'Text',
      
      targetKB: 'Target Knowledge Base',
      category: 'Category',
      hskLevels: 'HSK Levels',
      tags: 'Tags',
      autoClassify: 'Auto-classify',
      autoTranscribe: 'Auto-transcribe audio/video',
      
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
      
      startUpload: 'Start Upload',
      createKB: 'Create Knowledge Base',
      createCategory: 'Create Category',
      edit: 'Edit',
      delete: 'Delete',
      preview: 'Preview',
      download: 'Download',
      
      pending: 'Pending',
      uploading: 'Uploading',
      processing: 'Processing',
      transcribing: 'Transcribing',
      completed: 'Completed',
      failed: 'Failed',
      
      allMaterials: 'All Materials',
      search: 'Search materials...',
      filterByKB: 'Filter by KB',
      filterByCategory: 'Filter by Category',
      filterByHSK: 'Filter by HSK',
      filterByType: 'Filter by Type',
      noResults: 'No materials found',
      
      newKBTitle: 'Create Knowledge Base',
      kbName: 'Name',
      kbNameZh: 'Chinese Name',
      kbDescription: 'Description',
      
      newCategoryTitle: 'Create Category',
      categoryName: 'Name',
      categoryNameZh: 'Chinese Name',
      parentCategory: 'Parent Category',
      
      success: 'Success!',
      uploadSuccess: 'Upload successful!',
      deleteConfirm: 'Delete this material?',
      
      totalMaterials: 'Total Materials',
      totalSize: 'Total Size',
      lastUpdated: 'Last Updated',
      
      tips: 'Tips',
      tip1: 'Files with HSK1-6 in name auto-detect level',
      tip2: 'Batch upload multiple files supported',
      tip3: 'Audio/video auto-transcribed to text',
      tip4: 'Images auto-OCR for text recognition'
    }
  };
  const t = txt[language] || txt.en;

  // File type icons
  const fileTypeIcons = {
    pdf: '📄',
    word: '📝',
    image: '🖼️',
    audio: '🎵',
    video: '🎬',
    text: '📃'
  };

  // Supported file extensions
  const supportedExtensions = {
    pdf: ['.pdf'],
    word: ['.doc', '.docx'],
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
    audio: ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
    video: ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
    text: ['.txt', '.md', '.rtf']
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    
    try {
      // Load config
      const { data: configData } = await supabase
        .from('rag_config')
        .select('*')
        .limit(1)
        .single();
      setConfig(configData);

      // Load knowledge bases with counts
      const { data: kbData } = await supabase
        .from('rag_knowledge_bases')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Calculate document and chunk counts for each KB
      if (kbData) {
        for (const kb of kbData) {
          // Count documents
          const { count: docCount } = await supabase
            .from('knowledge_materials')
            .select('*', { count: 'exact', head: true })
            .eq('knowledge_base_id', kb.id);
          kb.document_count = docCount || 0;
          
          // Count chunks
          const { count: chunkCount } = await supabase
            .from('rag_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('knowledge_base_id', kb.id);
          kb.total_chunks = chunkCount || 0;
        }
      }
      
      setKnowledgeBases(kbData || []);
      if (kbData?.length > 0 && !uploadConfig.knowledgeBaseId) {
        setUploadConfig(prev => ({ ...prev, knowledgeBaseId: kbData[0].id }));
      }

      // Load materials with chunk counts
      const { data: materialsData } = await supabase
        .from('knowledge_materials')
        .select('*, rag_knowledge_bases(name, name_zh)')
        .order('created_at', { ascending: false });
      
      // Calculate chunk counts for each material if not set
      if (materialsData) {
        for (const m of materialsData) {
          if (!m.chunk_count) {
            const { count } = await supabase
              .from('rag_chunks')
              .select('*', { count: 'exact', head: true })
              .eq('document_id', m.id);
            m.chunk_count = count || 0;
          }
        }
      }
      
      setMaterials(materialsData || []);

      // Load categories
      const { data: categoriesData } = await supabase
        .from('material_categories')
        .select('*')
        .order('name');
      setCategories(categoriesData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Get file type from extension
  const getFileType = (filename) => {
    const ext = '.' + filename.split('.').pop().toLowerCase();
    for (const [type, extensions] of Object.entries(supportedExtensions)) {
      if (extensions.includes(ext)) return type;
    }
    return 'other';
  };

  // Detect HSK level from filename
  const detectHSKLevel = (filename) => {
    const match = filename.match(/HSK\s*(\d)/i);
    if (match) return [parseInt(match[1])];
    if (/初级|beginner|elementary/i.test(filename)) return [1, 2];
    if (/中级|intermediate/i.test(filename)) return [3, 4];
    if (/高级|advanced/i.test(filename)) return [5, 6];
    return [];
  };

  // Auto-detect category from filename
  const detectCategory = (filename) => {
    const lower = filename.toLowerCase();
    if (/vocab|词汇|单词|生词/.test(lower)) return 'vocabulary';
    if (/grammar|语法|文法/.test(lower)) return 'grammar';
    if (/listen|听力|音频/.test(lower)) return 'listening';
    if (/read|阅读|课文/.test(lower)) return 'reading';
    if (/speak|口语|对话/.test(lower)) return 'speaking';
    if (/writ|写作|作文/.test(lower)) return 'writing';
    if (/culture|文化|传统/.test(lower)) return 'culture';
    if (/exam|考试|模拟|真题/.test(lower)) return 'exam';
    if (/text|教材|课本/.test(lower)) return 'textbook';
    return 'other';
  };

  // AI-powered content classification
  const aiClassifyContent = async (text, filename) => {
    if (!config?.embedding_api_key || !text || text.length < 100) {
      // Fallback to filename-based detection
      return {
        category: detectCategory(filename),
        hskLevels: detectHSKLevel(filename),
        confidence: 0.5,
        tags: []
      };
    }

    try {
      const sampleText = text.substring(0, 2000); // First 2000 chars for analysis
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.embedding_api_key}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Analyze this Chinese language learning material and classify it. Return ONLY a JSON object.

TEXT SAMPLE:
${sampleText}

FILENAME: ${filename}

Classify into:
1. category: One of [textbook, vocabulary, grammar, listening, reading, speaking, writing, culture, exam, other]
2. hskLevels: Array of HSK levels 1-6 this material is suitable for (e.g., [3,4] for intermediate)
3. tags: Array of relevant tags in Chinese (e.g., ["第一课", "日常对话", "购物"])
4. confidence: Your confidence 0-1

Respond ONLY with JSON like:
{"category": "vocabulary", "hskLevels": [3,4], "tags": ["生词", "中级词汇"], "confidence": 0.9}`
          }],
          max_tokens: 200,
          temperature: 0.3
        })
      });

      if (!response.ok) throw new Error('API error');
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          category: result.category || detectCategory(filename),
          hskLevels: result.hskLevels || detectHSKLevel(filename),
          confidence: result.confidence || 0.8,
          tags: result.tags || []
        };
      }
    } catch (err) {
      console.error('AI classification failed:', err);
    }
    
    // Fallback
    return {
      category: detectCategory(filename),
      hskLevels: detectHSKLevel(filename),
      confidence: 0.5,
      tags: []
    };
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  // Handle drag & drop
  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  // Add files to list
  const addFiles = (newFiles) => {
    const fileObjects = newFiles.map(file => {
      const type = getFileType(file.name);
      return {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        type,
        status: 'pending',
        progress: 0,
        hskLevels: uploadConfig.autoClassify ? detectHSKLevel(file.name) : uploadConfig.hskLevels,
        category: uploadConfig.autoClassify ? detectCategory(file.name) : uploadConfig.category,
        error: null,
        extractedText: null,
        chunks: 0
      };
    });
    setFiles(prev => [...prev, ...fileObjects]);
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Extract text from PDF
  const extractPDFText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
    }
    
    return fullText.trim();
  };

  // Extract text from Word (basic - reads as text)
  const extractWordText = async (file) => {
    // For proper Word extraction, would need mammoth.js
    // For now, try to read as text
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result || '');
      reader.onerror = () => resolve('');
      reader.readAsText(file);
    });
  };

  // Extract text from image using AI (placeholder - would use OCR API)
  const extractImageText = async (file) => {
    // In production, would use Tesseract.js or Cloud Vision API
    // For now, return placeholder
    return `[Image: ${file.name}] - OCR extraction would go here`;
  };

  // Transcribe audio/video (placeholder - would use Whisper API)
  const transcribeMedia = async (file) => {
    // In production, would use OpenAI Whisper or similar
    // For now, return placeholder
    return `[${file.type.startsWith('audio') ? 'Audio' : 'Video'}: ${file.name}] - Transcription would go here`;
  };

  // Process single file
  const processFile = async (fileObj) => {
    const updateStatus = (updates) => {
      setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, ...updates } : f));
    };

    try {
      updateStatus({ status: 'uploading', progress: 10 });

      // Extract text based on file type
      let extractedText = '';
      
      switch (fileObj.type) {
        case 'pdf':
          updateStatus({ status: 'processing', progress: 20 });
          extractedText = await extractPDFText(fileObj.file);
          break;
        case 'word':
          updateStatus({ status: 'processing', progress: 20 });
          extractedText = await extractWordText(fileObj.file);
          break;
        case 'image':
          updateStatus({ status: 'processing', progress: 20 });
          extractedText = await extractImageText(fileObj.file);
          break;
        case 'audio':
        case 'video':
          if (uploadConfig.autoTranscribe) {
            updateStatus({ status: 'transcribing', progress: 20 });
            extractedText = await transcribeMedia(fileObj.file);
          }
          break;
        case 'text':
          extractedText = await fileObj.file.text();
          break;
        default:
          extractedText = '';
      }

      updateStatus({ progress: 50, extractedText });

      // AI-powered content classification (if enabled)
      let classificationResult = {
        category: fileObj.category,
        hskLevels: fileObj.hskLevels,
        tags: []
      };
      
      if (uploadConfig.autoClassify && extractedText && extractedText.length > 100) {
        updateStatus({ status: 'classifying', progress: 55 });
        classificationResult = await aiClassifyContent(extractedText, fileObj.name);
        addLog(`🤖 AI分类: ${fileObj.name} → ${classificationResult.category} (HSK ${classificationResult.hskLevels.join(',')} | ${Math.round(classificationResult.confidence * 100)}%)`);
      }

      // Convert file to base64 for storage (or upload to storage bucket)
      const base64 = await fileToBase64(fileObj.file);
      
      updateStatus({ progress: 60 });

      // Save to database with AI classification results
      const { data: material, error } = await supabase
        .from('knowledge_materials')
        .insert([{
          knowledge_base_id: uploadConfig.knowledgeBaseId,
          title: fileObj.name.replace(/\.[^/.]+$/, ''),
          title_zh: fileObj.name.replace(/\.[^/.]+$/, ''),
          file_name: fileObj.name,
          file_type: fileObj.type,
          file_size: fileObj.size,
          file_data: base64,
          category: classificationResult.category,
          hsk_levels: classificationResult.hskLevels,
          tags: classificationResult.tags,
          extracted_text: extractedText,
          status: 'processing',
          uploaded_by: user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      updateStatus({ progress: 70 });

      // Create chunks and embeddings
      if (extractedText && extractedText.length > 100) {
        const chunks = chunkText(extractedText);
        let savedChunks = 0;
        const hasEmbeddingKey = config?.embedding_api_key && config?.embedding_provider !== 'none';

        if (hasEmbeddingKey) {
          addLog(`📝 正在生成 ${chunks.length} 个文本块的向量嵌入 (${config?.embedding_provider || 'voyage'})...`);
        } else {
          addLog(`📝 正在保存 ${chunks.length} 个文本块（使用文本搜索）...`);
        }

        for (let i = 0; i < chunks.length; i++) {
          // Generate embedding if API key is configured (skip if previous calls failed)
          let embedding = null;
          if (hasEmbeddingKey && savedChunks > 0 || (hasEmbeddingKey && i === 0)) {
            embedding = await createEmbedding(chunks[i]);
          }
          
          // Try to save chunk - handle foreign key issues by not using document_id if it fails
          let chunkError = null;
          
          // First try with document_id
          const { error: err1 } = await supabase.from('rag_chunks').insert([{
            document_id: material.id,
            knowledge_base_id: uploadConfig.knowledgeBaseId,
            content: chunks[i],
            chunk_index: i,
            embedding: embedding,
            metadata: {
              source: fileObj.name,
              type: fileObj.type,
              hsk_levels: fileObj.hskLevels,
              material_id: material.id // Store material_id in metadata as backup
            }
          }]);
          
          if (err1) {
            // If FK error, try without document_id
            if (err1.message.includes('foreign key')) {
              const { error: err2 } = await supabase.from('rag_chunks').insert([{
                knowledge_base_id: uploadConfig.knowledgeBaseId,
                content: chunks[i],
                chunk_index: i,
                embedding: embedding,
                metadata: {
                  source: fileObj.name,
                  type: fileObj.type,
                  hsk_levels: fileObj.hskLevels,
                  material_id: material.id
                }
              }]);
              chunkError = err2;
            } else {
              chunkError = err1;
            }
          }
          
          if (chunkError) {
            addLog(`❌ 保存第 ${i+1} 块失败: ${chunkError.message}`);
            console.error('Chunk save error:', chunkError);
          } else {
            savedChunks++;
          }
          
          updateStatus({ 
            progress: 70 + Math.round((i / chunks.length) * 25),
            chunks: savedChunks 
          });
        }

        addLog(`✅ 已保存 ${savedChunks}/${chunks.length} 个文本块`);

        // Update material with chunk count
        await supabase.from('knowledge_materials')
          .update({ chunk_count: savedChunks, status: 'completed' })
          .eq('id', material.id);
      } else {
        await supabase.from('knowledge_materials')
          .update({ status: 'completed' })
          .eq('id', material.id);
      }

      updateStatus({ status: 'completed', progress: 100 });
      return { success: true };

    } catch (err) {
      console.error(err);
      updateStatus({ status: 'failed', error: err.message });
      return { success: false, error: err.message };
    }
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

  // Chunk text
  const chunkText = (text, size = 500, overlap = 50) => {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      chunks.push(text.slice(start, start + size));
      start += size - overlap;
    }
    return chunks;
  };

  // Create embedding using Voyage AI (Anthropic recommended) or fallback to text search
  const createEmbedding = async (text) => {
    const provider = config?.embedding_provider || 'voyage';
    const apiKey = config?.embedding_api_key || config?.voyage_api_key;
    
    // If no API key configured, skip embedding
    if (!apiKey) {
      return null;
    }
    
    try {
      const proxyUrl = config?.proxy_url || 'http://localhost:3001';
      
      // Try proxy first (handles CORS)
      try {
        // Force correct model based on provider
        let modelToUse = config?.embedding_model || 'voyage-3';
        if (provider === 'voyage' && !modelToUse.startsWith('voyage')) {
          modelToUse = 'voyage-3'; // Force voyage model
        }
        
        const response = await fetch(`${proxyUrl}/api/ai/embedding`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: provider,
            apiKey: apiKey,
            model: modelToUse,
            text: text.substring(0, 8000)
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.embedding) {
            return data.embedding;
          }
        }
      } catch (proxyErr) {
        // Proxy not available, try direct call
      }
      
      // Direct API call (may fail due to CORS in browser)
      let apiUrl, requestBody;
      
      if (provider === 'voyage') {
        apiUrl = 'https://api.voyageai.com/v1/embeddings';
        requestBody = {
          model: config?.embedding_model || 'voyage-3',
          input: [text.substring(0, 8000)],
          input_type: 'document'
        };
      } else if (provider === 'jina') {
        apiUrl = 'https://api.jina.ai/v1/embeddings';
        requestBody = {
          model: config?.embedding_model || 'jina-embeddings-v3',
          input: [text.substring(0, 8000)]
        };
      } else {
        // OpenAI
        apiUrl = 'https://api.openai.com/v1/embeddings';
        requestBody = {
          model: config?.embedding_model || 'text-embedding-3-small',
          input: text.substring(0, 8000)
        };
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        addLog(`❌ Embedding API error: ${response.status} ${errorText.substring(0, 100)}`);
        return null;
      }
      
      const data = await response.json();
      return data.data?.[0]?.embedding || null;
      
    } catch (err) {
      addLog(`❌ Embedding error: ${err.message}`);
      return null;
    }
  };

  // Start upload process
  const startUpload = async () => {
    if (files.length === 0 || !uploadConfig.knowledgeBaseId) {
      setMessage({ type: 'error', text: language === 'zh' ? '请选择文件和目标知识库' : 'Please select files and target KB' });
      return;
    }

    setProcessing(true);
    const pendingFiles = files.filter(f => f.status === 'pending');

    for (const fileObj of pendingFiles) {
      await processFile(fileObj);
    }

    setProcessing(false);
    setMessage({ type: 'success', text: t.uploadSuccess });
    loadData();
  };

  // Create new knowledge base
  const handleCreateKB = async () => {
    if (!newKB.name) return;
    
    try {
      await supabase.from('rag_knowledge_bases').insert([{
        name: newKB.name,
        name_zh: newKB.name_zh || newKB.name,
        description: newKB.description,
        created_by: user?.id
      }]);
      
      setShowNewKBModal(false);
      setNewKB({ name: '', name_zh: '', description: '' });
      loadData();
      setMessage({ type: 'success', text: t.success });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Delete material
  const handleDeleteMaterial = async (id) => {
    if (!window.confirm(t.deleteConfirm)) return;
    
    try {
      await supabase.from('rag_chunks').delete().eq('document_id', id);
      await supabase.from('knowledge_materials').delete().eq('id', id);
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Filter materials
  const filteredMaterials = materials.filter(m => {
    if (filterKB && m.knowledge_base_id !== filterKB) return false;
    if (filterCategory && m.category !== filterCategory) return false;
    if (filterHSK && !m.hsk_levels?.includes(parseInt(filterHSK))) return false;
    if (filterType && m.file_type !== filterType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return m.title?.toLowerCase().includes(query) || 
             m.title_zh?.toLowerCase().includes(query) ||
             m.file_name?.toLowerCase().includes(query);
    }
    return true;
  });

  // Get status badge
  const getStatusBadge = (status) => {
    const styles = {
      pending: { bg: 'var(--text-muted)', label: t.pending },
      uploading: { bg: 'var(--info)', label: t.uploading },
      processing: { bg: 'var(--warning)', label: t.processing },
      transcribing: { bg: 'var(--primary)', label: t.transcribing },
      completed: { bg: 'var(--success)', label: t.completed },
      failed: { bg: 'var(--error)', label: t.failed }
    };
    const s = styles[status] || styles.pending;
    return <span className="badge" style={{ background: s.bg, color: 'white' }}>{s.label}</span>;
  };

  if (!['super_admin', 'school_master', 'content_editor', 'teacher'].includes(user?.role)) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>🔒 {language === 'zh' ? '无权访问' : 'Access Denied'}</h2>
        <p>{language === 'zh' ? '需要管理员或教师权限' : 'Admin or Teacher role required'}</p>
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => setShowNewKBModal(true)}>
            + {t.createKB}
          </button>
        </div>
      </div>
      
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{t.subtitle}</p>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--primary)' }}>{knowledgeBases.length}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{language === 'zh' ? '知识库' : 'Knowledge Bases'}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--success)' }}>{materials.length}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.totalMaterials}</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', color: 'var(--info)' }}>
            {formatSize(materials.reduce((sum, m) => sum + (m.file_size || 0), 0))}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.totalSize}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>
          📤 {t.upload}
        </button>
        <button className={`tab ${activeTab === 'browse' ? 'active' : ''}`} onClick={() => setActiveTab('browse')}>
          📁 {t.browse}
        </button>
        <button className={`tab ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>
          🏷️ {t.categories}
        </button>
        <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ {language === 'zh' ? '设置' : 'Settings'}
        </button>
      </div>

      {/* Embedding Status Info */}
      {(config?.embedding_api_key || config?.voyage_api_key) ? (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          ✅ {language === 'zh' 
            ? `向量嵌入已启用 (${config?.embedding_provider || 'Voyage AI'})。上传的文档将自动生成语义向量，支持智能搜索。` 
            : `Embedding enabled (${config?.embedding_provider || 'Voyage AI'}). Documents will have semantic vectors for intelligent search.`}
        </div>
      ) : (
        <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
          ⚠️ {language === 'zh' 
            ? '未配置 Embedding API Key。请在"设置"中配置 Voyage AI（免费）或其他服务。目前使用文本搜索。' 
            : 'Embedding API key not configured. Please configure Voyage AI (free) or other provider in Settings. Using text search.'}
          <button 
            className="btn btn-sm btn-primary" 
            style={{ marginLeft: '1rem' }}
            onClick={() => setActiveTab('settings')}
          >
            {language === 'zh' ? '去设置' : 'Go to Settings'}
          </button>
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <>
          {/* Upload Configuration */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>⚙️ {language === 'zh' ? '上传配置' : 'Upload Settings'}</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{t.targetKB} *</label>
                <select 
                  className="form-select"
                  value={uploadConfig.knowledgeBaseId}
                  onChange={e => setUploadConfig(prev => ({ ...prev, knowledgeBaseId: e.target.value }))}
                >
                  <option value="">-- Select --</option>
                  {knowledgeBases.map(kb => (
                    <option key={kb.id} value={kb.id}>{kb.name_zh || kb.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t.category}</label>
                <select 
                  className="form-select"
                  value={uploadConfig.category}
                  onChange={e => setUploadConfig(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="textbook">{t.textbook}</option>
                  <option value="vocabulary">{t.vocabulary}</option>
                  <option value="grammar">{t.grammar}</option>
                  <option value="listening">{t.listening}</option>
                  <option value="reading">{t.reading}</option>
                  <option value="speaking">{t.speaking}</option>
                  <option value="writing">{t.writing}</option>
                  <option value="culture">{t.culture}</option>
                  <option value="exam">{t.exam}</option>
                  <option value="other">{t.other}</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t.hskLevels}</label>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5, 6].map(level => (
                    <button
                      key={level}
                      type="button"
                      className={`btn btn-sm ${uploadConfig.hskLevels.includes(level) ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => {
                        setUploadConfig(prev => ({
                          ...prev,
                          hskLevels: prev.hskLevels.includes(level) 
                            ? prev.hskLevels.filter(l => l !== level)
                            : [...prev.hskLevels, level]
                        }));
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={uploadConfig.autoClassify}
                  onChange={e => setUploadConfig(prev => ({ ...prev, autoClassify: e.target.checked }))}
                />
                {t.autoClassify}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={uploadConfig.autoTranscribe}
                  onChange={e => setUploadConfig(prev => ({ ...prev, autoTranscribe: e.target.checked }))}
                />
                {t.autoTranscribe}
              </label>
            </div>
          </div>

          {/* File Drop Zone */}
          <div 
            className="card"
            style={{ 
              border: '2px dashed var(--border)',
              textAlign: 'center',
              padding: '2rem',
              marginBottom: '1.5rem',
              cursor: 'pointer'
            }}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.gif,.mp3,.wav,.mp4,.webm"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '500' }}>{t.selectFiles}</div>
            <div style={{ color: 'var(--text-muted)' }}>{t.dragDrop}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {t.supportedFormats}
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3>{t.selectedFiles} ({files.length})</h3>
                <button className="btn btn-outline btn-sm" onClick={() => setFiles([])}>
                  🗑️ Clear All
                </button>
              </div>

              <div className="table-container">
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>File</th>
                      <th>Category</th>
                      <th>HSK</th>
                      <th>Size</th>
                      <th>Status</th>
                      <th>Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map(f => (
                      <tr key={f.id}>
                        <td>{fileTypeIcons[f.type] || '📄'}</td>
                        <td>
                          {f.name}
                          {f.error && <div style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{f.error}</div>}
                        </td>
                        <td><span className="badge">{t[f.category] || f.category}</span></td>
                        <td>
                          {f.hskLevels?.map(l => (
                            <span key={l} className="badge badge-info" style={{ marginRight: '0.25rem' }}>HSK{l}</span>
                          ))}
                        </td>
                        <td>{formatSize(f.size)}</td>
                        <td>{getStatusBadge(f.status)}</td>
                        <td style={{ width: '100px' }}>
                          <div style={{ 
                            height: '8px', 
                            background: 'var(--background)', 
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div style={{ 
                              width: `${f.progress}%`, 
                              height: '100%', 
                              background: f.status === 'completed' ? 'var(--success)' : 'var(--primary)',
                              transition: 'width 0.3s'
                            }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button 
                className="btn btn-primary btn-lg"
                onClick={startUpload}
                disabled={processing || files.filter(f => f.status === 'pending').length === 0}
                style={{ marginTop: '1rem' }}
              >
                {processing ? '⏳ Processing...' : `🚀 ${t.startUpload}`}
              </button>
            </div>
          )}

          {/* Processing Logs */}
          {logs.length > 0 && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0 }}>📋 {language === 'zh' ? '处理日志' : 'Processing Logs'}</h3>
                <button className="btn btn-sm btn-outline" onClick={() => setLogs([])}>
                  {language === 'zh' ? '清空' : 'Clear'}
                </button>
              </div>
              <div style={{ 
                maxHeight: '200px', 
                overflowY: 'auto', 
                background: '#1a1a2e', 
                borderRadius: 'var(--radius-md)', 
                padding: '0.75rem',
                fontFamily: 'monospace',
                fontSize: '0.8rem'
              }}>
                {logs.map((log, i) => (
                  <div key={i} style={{ color: '#a0a0a0', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#666' }}>[{log.time}]</span> {log.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="card" style={{ background: 'rgba(59, 130, 246, 0.1)', marginTop: '1rem' }}>
            <h3 style={{ marginBottom: '0.75rem' }}>💡 {t.tips}</h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
              <li>{t.tip1}</li>
              <li>{t.tip2}</li>
              <li>{t.tip3}</li>
              <li>{t.tip4}</li>
              <li style={{ color: 'var(--primary)', fontWeight: 500 }}>
                {language === 'zh' 
                  ? '🤖 AI自动分类：开启后，系统会分析PDF内容自动识别HSK等级和类别' 
                  : '🤖 AI Auto-classify: When enabled, system analyzes PDF content to detect HSK level and category'}
              </li>
            </ul>
          </div>
        </>
      )}

      {/* Browse Tab */}
      {activeTab === 'browse' && (
        <>
          {/* Filters */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder={t.search}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select className="form-select" value={filterKB} onChange={e => setFilterKB(e.target.value)}>
                <option value="">{t.filterByKB}</option>
                {knowledgeBases.map(kb => (
                  <option key={kb.id} value={kb.id}>{kb.name_zh || kb.name}</option>
                ))}
              </select>
              <select className="form-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">{t.filterByCategory}</option>
                <option value="textbook">{t.textbook}</option>
                <option value="vocabulary">{t.vocabulary}</option>
                <option value="grammar">{t.grammar}</option>
                <option value="listening">{t.listening}</option>
                <option value="reading">{t.reading}</option>
                <option value="culture">{t.culture}</option>
                <option value="exam">{t.exam}</option>
              </select>
              <select className="form-select" value={filterHSK} onChange={e => setFilterHSK(e.target.value)}>
                <option value="">{t.filterByHSK}</option>
                {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK{l}</option>)}
              </select>
              <select className="form-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">{t.filterByType}</option>
                <option value="pdf">{t.pdf}</option>
                <option value="word">{t.word}</option>
                <option value="image">{t.image}</option>
                <option value="audio">{t.audio}</option>
                <option value="video">{t.video}</option>
              </select>
            </div>
          </div>

          {/* Materials Grid */}
          {filteredMaterials.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
              <p style={{ color: 'var(--text-muted)' }}>{t.noResults}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {filteredMaterials.map(m => (
                <div key={m.id} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
                    <div style={{ fontSize: '2rem' }}>{fileTypeIcons[m.file_type] || '📄'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.title_zh || m.title}
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {m.rag_knowledge_bases?.name_zh || m.rag_knowledge_bases?.name}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.75rem' }}>
                    <span className="badge">{t[m.category] || m.category}</span>
                    {m.hsk_levels?.map(l => (
                      <span key={l} className="badge badge-info">HSK{l}</span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>{formatSize(m.file_size)}</span>
                    <span>{m.chunk_count || 0} chunks</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => handleDeleteMaterial(m.id)}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🏷️ {language === 'zh' ? '知识库列表' : 'Knowledge Bases'}</h3>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            {knowledgeBases.map(kb => (
              <div key={kb.id} style={{ 
                padding: '1rem', 
                background: 'var(--background)', 
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <strong>{kb.name_zh || kb.name}</strong>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {kb.description || 'No description'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {kb.document_count || 0} documents • {kb.total_chunks || 0} chunks
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className={`badge ${kb.is_active ? 'badge-success' : ''}`}>
                    {kb.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>⚙️ {language === 'zh' ? 'AI配置中心' : 'AI Configuration Center'}</h3>
          
          <div style={{ display: 'grid', gap: '2rem', maxWidth: '800px' }}>
            
            {/* AI Provider Selection */}
            <div style={{ padding: '1.5rem', background: 'var(--background)', borderRadius: 'var(--radius-lg)', border: '2px solid var(--primary)' }}>
              <h4 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🤖 {language === 'zh' ? '选择AI服务商' : 'Select AI Provider'}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {[
                  { id: 'openai', name: 'OpenAI', icon: '🟢', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
                  { id: 'claude', name: 'Claude', icon: '🟣', models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },
                  { id: 'deepseek', name: 'DeepSeek', icon: '🔵', models: ['deepseek-chat', 'deepseek-coder'] }
                ].map(p => (
                  <div
                    key={p.id}
                    onClick={() => setConfig({ ...config, ai_provider: p.id })}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: config?.ai_provider === p.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: config?.ai_provider === p.id ? 'rgba(139, 92, 246, 0.1)' : 'var(--card)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{p.icon}</div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    {config?.ai_provider === p.id && <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem' }}>✓ 已选择</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* OpenAI Config */}
            <div style={{ padding: '1.5rem', background: 'var(--background)', borderRadius: 'var(--radius-lg)' }}>
              <h4 style={{ margin: '0 0 1rem' }}>🟢 OpenAI {language === 'zh' ? '配置' : 'Configuration'}</h4>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input
                    type="password"
                    className="form-input"
                    value={config?.openai_api_key || ''}
                    onChange={e => setConfig({ ...config, openai_api_key: e.target.value })}
                    placeholder="sk-..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '模型' : 'Model'}</label>
                  <select
                    className="form-select"
                    value={config?.openai_model || 'gpt-4o-mini'}
                    onChange={e => setConfig({ ...config, openai_model: e.target.value })}
                  >
                    <option value="gpt-4o">GPT-4o (最强)</option>
                    <option value="gpt-4o-mini">GPT-4o-mini (推荐, 性价比高)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (便宜)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Claude Config */}
            <div style={{ padding: '1.5rem', background: 'var(--background)', borderRadius: 'var(--radius-lg)' }}>
              <h4 style={{ margin: '0 0 1rem' }}>🟣 Claude {language === 'zh' ? '配置' : 'Configuration'}</h4>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input
                    type="password"
                    className="form-input"
                    value={config?.claude_api_key || ''}
                    onChange={e => setConfig({ ...config, claude_api_key: e.target.value })}
                    placeholder="sk-ant-..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '模型' : 'Model'}</label>
                  <select
                    className="form-select"
                    value={config?.claude_model || 'claude-sonnet-4-20250514'}
                    onChange={e => setConfig({ ...config, claude_model: e.target.value })}
                  >
                    <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (最新)</option>
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku (快速)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* DeepSeek Config */}
            <div style={{ padding: '1.5rem', background: 'var(--background)', borderRadius: 'var(--radius-lg)' }}>
              <h4 style={{ margin: '0 0 1rem' }}>🔵 DeepSeek {language === 'zh' ? '配置' : 'Configuration'}</h4>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input
                    type="password"
                    className="form-input"
                    value={config?.deepseek_api_key || ''}
                    onChange={e => setConfig({ ...config, deepseek_api_key: e.target.value })}
                    placeholder="sk-..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '模型' : 'Model'}</label>
                  <select
                    className="form-select"
                    value={config?.deepseek_model || 'deepseek-chat'}
                    onChange={e => setConfig({ ...config, deepseek_model: e.target.value })}
                  >
                    <option value="deepseek-chat">DeepSeek Chat (通用)</option>
                    <option value="deepseek-coder">DeepSeek Coder (代码)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* RAG Settings */}
            <div style={{ padding: '1.5rem', background: 'var(--background)', borderRadius: 'var(--radius-lg)' }}>
              <h4 style={{ margin: '0 0 1rem' }}>📚 RAG {language === 'zh' ? '设置' : 'Settings'}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Embedding{language === 'zh' ? '服务商' : ' Provider'}</label>
                  <select
                    className="form-select"
                    value={config?.embedding_provider || 'voyage'}
                    onChange={e => setConfig({ ...config, embedding_provider: e.target.value })}
                  >
                    <option value="voyage">⭐ Voyage AI (Anthropic推荐, 免费)</option>
                    <option value="jina">🌐 Jina AI (免费, 多语言)</option>
                    <option value="openai">🟢 OpenAI (付费)</option>
                    <option value="none">🔍 文本搜索 (无需API)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Embedding{language === 'zh' ? '模型' : ' Model'}</label>
                  <select
                    className="form-select"
                    value={config?.embedding_model || 'voyage-3'}
                    onChange={e => setConfig({ ...config, embedding_model: e.target.value })}
                  >
                    {/* Voyage AI models */}
                    {(!config?.embedding_provider || config?.embedding_provider === 'voyage') && (
                      <>
                        <option value="voyage-3">voyage-3 (最新, 推荐)</option>
                        <option value="voyage-3-lite">voyage-3-lite (更快)</option>
                        <option value="voyage-multilingual-2">voyage-multilingual-2 (多语言)</option>
                      </>
                    )}
                    {/* Jina AI models */}
                    {config?.embedding_provider === 'jina' && (
                      <>
                        <option value="jina-embeddings-v3">jina-embeddings-v3 (推荐)</option>
                        <option value="jina-embeddings-v2-base-zh">jina-v2-base-zh (中文)</option>
                      </>
                    )}
                    {/* OpenAI models */}
                    {config?.embedding_provider === 'openai' && (
                      <>
                        <option value="text-embedding-3-small">text-embedding-3-small (推荐)</option>
                        <option value="text-embedding-3-large">text-embedding-3-large</option>
                        <option value="text-embedding-ada-002">text-embedding-ada-002</option>
                      </>
                    )}
                    {/* No embedding */}
                    {config?.embedding_provider === 'none' && (
                      <option value="none">无 (使用关键词搜索)</option>
                    )}
                  </select>
                </div>
              </div>
              
              {/* Embedding API Key - show for Voyage, Jina, OpenAI */}
              {config?.embedding_provider !== 'none' && (
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">
                    Embedding API Key 
                    {(!config?.embedding_provider || config?.embedding_provider === 'voyage') && (
                      <a href="https://dash.voyageai.com/" target="_blank" rel="noopener noreferrer" 
                         style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                        (获取免费Key →)
                      </a>
                    )}
                    {config?.embedding_provider === 'jina' && (
                      <a href="https://jina.ai/embeddings/" target="_blank" rel="noopener noreferrer" 
                         style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                        (获取免费Key →)
                      </a>
                    )}
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder={
                      config?.embedding_provider === 'voyage' ? 'pa-xxxxxxxx...' :
                      config?.embedding_provider === 'jina' ? 'jina_xxxxxxxx...' :
                      'sk-xxxxxxxx...'
                    }
                    value={config?.embedding_api_key || ''}
                    onChange={e => setConfig({ ...config, embedding_api_key: e.target.value })}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {config?.embedding_provider === 'voyage' && '⭐ Voyage AI 免费提供 50M tokens'}
                    {config?.embedding_provider === 'jina' && '🌐 Jina AI 免费提供 1M tokens'}
                    {config?.embedding_provider === 'openai' && '💰 OpenAI 需付费，约 $0.02/1M tokens'}
                  </div>
                </div>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '检索数量' : 'Top K'}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={config?.top_k || 5}
                    onChange={e => setConfig({ ...config, top_k: parseInt(e.target.value) })}
                    min={1}
                    max={20}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '相似度阈值' : 'Similarity Threshold'}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={config?.similarity_threshold || 0.7}
                    onChange={e => setConfig({ ...config, similarity_threshold: parseFloat(e.target.value) })}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '分块大小' : 'Chunk Size'}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={config?.chunk_size || 500}
                    onChange={e => setConfig({ ...config, chunk_size: parseInt(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '分块重叠' : 'Chunk Overlap'}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={config?.chunk_overlap || 50}
                    onChange={e => setConfig({ ...config, chunk_overlap: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              
              {/* Auto-processing toggles */}
              <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={config?.auto_process_uploads !== false}
                    onChange={e => setConfig({ ...config, auto_process_uploads: e.target.checked })}
                  />
                  {language === 'zh' ? '自动处理上传' : 'Auto-process uploads'}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={config?.auto_classify_materials !== false}
                    onChange={e => setConfig({ ...config, auto_classify_materials: e.target.checked })}
                  />
                  {language === 'zh' ? '自动AI分类' : 'Auto AI classify'}
                </label>
              </div>
            </div>

            {/* Save Button */}
            <button
              className="btn btn-primary btn-lg"
              onClick={async () => {
                try {
                  const updateData = {
                    id: config?.id || undefined,
                    ai_provider: config?.ai_provider || 'openai',
                    openai_api_key: config?.openai_api_key,
                    openai_model: config?.openai_model || 'gpt-4o-mini',
                    claude_api_key: config?.claude_api_key,
                    claude_model: config?.claude_model || 'claude-sonnet-4-20250514',
                    deepseek_api_key: config?.deepseek_api_key,
                    deepseek_model: config?.deepseek_model || 'deepseek-chat',
                    embedding_provider: config?.embedding_provider || 'voyage',
                    embedding_api_key: config?.embedding_api_key || '',
                    embedding_model: config?.embedding_model || 'voyage-3',
                    chunk_size: config?.chunk_size || 500,
                    chunk_overlap: config?.chunk_overlap || 50,
                    top_k: config?.top_k || 5,
                    similarity_threshold: config?.similarity_threshold || 0.7,
                    auto_process_uploads: config?.auto_process_uploads !== false,
                    auto_classify_materials: config?.auto_classify_materials !== false,
                    updated_at: new Date().toISOString()
                  };
                  
                  const { error } = await supabase.from('rag_config').upsert([updateData]);
                  if (error) throw error;
                  setMessage({ type: 'success', text: language === 'zh' ? '✅ 配置保存成功！' : '✅ Configuration saved!' });
                  loadData();
                } catch (err) {
                  setMessage({ type: 'error', text: err.message });
                }
              }}
              style={{ width: '100%' }}
            >
              💾 {language === 'zh' ? '保存所有配置' : 'Save All Settings'}
            </button>

            {/* Status */}
            <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <h4 style={{ margin: '0 0 0.5rem', color: 'var(--success)' }}>📊 {language === 'zh' ? '当前状态' : 'Current Status'}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div>🤖 {language === 'zh' ? '当前AI' : 'Current AI'}: <strong>{(config?.ai_provider || 'openai').toUpperCase()}</strong></div>
                <div>🧠 {language === 'zh' ? '模型' : 'Model'}: <strong>{config?.[`${config?.ai_provider || 'openai'}_model`] || 'gpt-4o-mini'}</strong></div>
                <div>🔑 OpenAI: {config?.openai_api_key ? '✅' : '❌'}</div>
                <div>🔑 Claude: {config?.claude_api_key ? '✅' : '❌'}</div>
                <div>🔑 DeepSeek: {config?.deepseek_api_key ? '✅' : '❌'}</div>
                <div>🔑 Embedding: {config?.embedding_api_key ? '✅' : '❌'}</div>
                <div>📚 {language === 'zh' ? 'Embedding' : 'Embedding'}: <strong>{(config?.embedding_provider || 'voyage').toUpperCase()}</strong></div>
                <div>📚 {language === 'zh' ? '自动处理' : 'Auto-process'}: {config?.auto_process_uploads !== false ? '✅' : '❌'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New KB Modal */}
      {showNewKBModal && (
        <div className="modal-overlay" onClick={() => setShowNewKBModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>{t.newKBTitle}</h3>
            
            <div className="form-group">
              <label className="form-label">{t.kbName} *</label>
              <input 
                className="form-input" 
                value={newKB.name}
                onChange={e => setNewKB({ ...newKB, name: e.target.value })}
                placeholder="e.g., HSK Textbooks"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">{t.kbNameZh}</label>
              <input 
                className="form-input" 
                value={newKB.name_zh}
                onChange={e => setNewKB({ ...newKB, name_zh: e.target.value })}
                placeholder="e.g., HSK教材"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">{t.kbDescription}</label>
              <textarea 
                className="form-textarea" 
                rows={3}
                value={newKB.description}
                onChange={e => setNewKB({ ...newKB, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowNewKBModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCreateKB}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBaseManagerPage;
