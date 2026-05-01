import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getAIService } from '../services/aiService';

const TeacherAgentPage = () => {
  const { user, token, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('materials');
  const [materials, setMaterials] = useState([]);
  const [generatedContent, setGeneratedContent] = useState([]);
  const [knowledgeBase, setKnowledgeBase] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(null);
  const [filterVisibility, setFilterVisibility] = useState('all');
  const [generationResult, setGenerationResult] = useState(null);
  const [aiService, setAiService] = useState(null);
  const [aiReady, setAiReady] = useState(false);
  const [generateForm, setGenerateForm] = useState({ topic: '', hskLevel: 3 });
  const [generateError, setGenerateError] = useState('');

  // 初始化 AI 服务
  useEffect(() => {
    const initAI = async () => {
      if (supabase) {
        const service = getAIService(supabase);
        await service.loadSettings();
        setAiService(service);
        setAiReady(!!service.getConfig().apiKey);
      }
    };
    initAI();
  }, [supabase]);

  const t = {
    zh: {
      title: '🎓 智能教师工作台',
      subtitle: '课程准备与内容管理',
      materials: '📚 教学资料',
      generate: '🤖 生成',
      knowledge: '🧠 知识库',
      upload: '上传资料',
      addContent: '添加内容',
      visibility: '可见性',
      private: '🔒 私有',
      public: '🌐 公开',
      class: '🎓 班级',
      all: '全部',
      generatePPT: '📊 生成PPT',
      generateQuiz: '📝 生成测验',
      generateSummary: '📄 生成摘要',
      generateLessonPlan: '📋 生成教案',
      generateFlashcards: '🃏 生成闪卡',
      topic: '主题',
      hskLevel: 'HSK级别',
      category: '分类',
      tags: '标签',
      description: '描述',
      generate: '生成',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      download: '下载',
      share: '分享',
      makePublic: '设为公开',
      makePrivate: '设为私有',
      shareToClass: '分享给班级',
      noData: '暂无数据',
      loading: '加载中...',
      success: '成功',
      visibilityExplain: {
        private: '仅自己可见 - 其他人无法看到此内容',
        public: '所有人可见 - 学生和其他教师都可以看到',
        class: '班级可见 - 只有该班级的学生可以看到'
      }
    },
    en: {
      title: '🎓 Smart Teacher Workstation',
      subtitle: 'Course Preparation & Content Management',
      materials: '📚 Materials',
      generate: '🤖 Generate',
      knowledge: '🧠 Knowledge Base',
      upload: 'Upload Material',
      addContent: 'Add Content',
      visibility: 'Visibility',
      private: '🔒 Private',
      public: '🌐 Public',
      class: '🎓 Class Only',
      all: 'All',
      generatePPT: '📊 Generate PPT',
      generateQuiz: '📝 Generate Quiz',
      generateSummary: '📄 Generate Summary',
      generateLessonPlan: '📋 Generate Lesson Plan',
      generateFlashcards: '🃏 Generate Flashcards',
      topic: 'Topic',
      hskLevel: 'HSK Level',
      category: 'Category',
      tags: 'Tags',
      description: 'Description',
      generate: 'Generate',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      download: 'Download',
      share: 'Share',
      makePublic: 'Make Public',
      makePrivate: 'Make Private',
      shareToClass: 'Share to Class',
      noData: 'No data available',
      loading: 'Loading...',
      success: 'Success',
      visibilityExplain: {
        private: 'Only you can see - Others cannot access this content',
        public: 'Everyone can see - Students and other teachers can access',
        class: 'Class only - Only students in this class can access'
      }
    },
    it: {
      title: '🎓 Postazione Intelligente Insegnante',
      subtitle: 'Preparazione Corsi e Gestione Contenuti',
      materials: '📚 Materiali',
      generate: '🤖 Genera',
      knowledge: '🧠 Knowledge Base',
      upload: 'Carica Materiale',
      addContent: 'Aggiungi Contenuto',
      visibility: 'Visibilità',
      private: '🔒 Privato',
      public: '🌐 Pubblico',
      class: '🎓 Solo Classe',
      all: 'Tutti',
      generatePPT: '📊 Genera PPT',
      generateQuiz: '📝 Genera Quiz',
      generateSummary: '📄 Genera Riepilogo',
      generateLessonPlan: '📋 Genera Piano Lezione',
      generateFlashcards: '🃏 Genera Flashcard',
      topic: 'Argomento',
      hskLevel: 'Livello HSK',
      category: 'Categoria',
      tags: 'Tag',
      description: 'Descrizione',
      generate: 'Genera',
      save: 'Salva',
      cancel: 'Annulla',
      delete: 'Elimina',
      edit: 'Modifica',
      download: 'Scarica',
      share: 'Condividi',
      makePublic: 'Rendi Pubblico',
      makePrivate: 'Rendi Privato',
      shareToClass: 'Condividi con Classe',
      noData: 'Nessun dato disponibile',
      loading: 'Caricamento...',
      success: 'Successo',
      visibilityExplain: {
        private: 'Solo tu puoi vedere - Altri non possono accedere',
        public: 'Tutti possono vedere - Studenti e insegnanti possono accedere',
        class: 'Solo classe - Solo gli studenti di questa classe possono accedere'
      }
    }
  }[language] || {};

  useEffect(() => {
    loadMaterials();
    loadGeneratedContent();
    loadKnowledgeBase();
    loadClasses();
  }, [filterVisibility]);

  const apiCall = async (endpoint, method = 'GET', body = null, isFormData = false) => {
    const opts = {
      method,
      headers: { 'Authorization': `Bearer ${token}` }
    };
    if (body && !isFormData) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (body && isFormData) {
      opts.body = body;
    }
    const res = await fetch(`${API_URL}${endpoint}`, opts);
    return res.json();
  };

  const loadMaterials = async () => {
    try {
      const visibilityParam = filterVisibility !== 'all' ? `&visibility=${filterVisibility}` : '';
      const data = await apiCall(`/teacher-agent/materials?${visibilityParam}`);
      setMaterials(data.materials || []);
    } catch (e) { console.error(e); }
  };

  const loadGeneratedContent = async () => {
    try {
      const data = await apiCall('/teacher-agent/generated');
      setGeneratedContent(data.content || []);
    } catch (e) { console.error(e); }
  };

  const loadKnowledgeBase = async () => {
    try {
      const data = await apiCall('/teacher-agent/knowledge-base');
      setKnowledgeBase(data.entries || []);
    } catch (e) { console.error(e); }
  };

  const loadClasses = async () => {
    try {
      const data = await apiCall('/classes');
      setClasses(data.classes || []);
    } catch (e) { console.error(e); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.target);
    try {
      await apiCall('/teacher-agent/materials/upload', 'POST', formData, true);
      setShowUploadModal(false);
      loadMaterials();
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  const handleAddContent = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    try {
      await apiCall('/teacher-agent/materials/add-content', 'POST', data);
      setShowUploadModal(false);
      loadMaterials();
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  const handleGenerate = async (type, formData) => {
    setIsLoading(true);
    setGenerateError('');
    
    try {
      if (!aiService || !aiReady) {
        setGenerateError(language === 'zh' 
          ? '智能服务未配置，请联系管理员设置 API Key' 
          : 'Intelligent service not configured. Please contact admin to set up API Key.');
        setIsLoading(false);
        return;
      }

      // 检查用户限额
      const limit = await aiService.checkUserLimit(user?.id, user?.role);
      if (!limit.allowed) {
        setGenerateError(language === 'zh'
          ? `已达到今日使用限制 (${limit.used}/${limit.limit})`
          : `Daily limit reached (${limit.used}/${limit.limit})`);
        setIsLoading(false);
        return;
      }

      let result;
      const options = { hskLevel: formData.hskLevel || 3, language };

      switch (type) {
        case 'ppt':
          result = await aiService.generatePPTOutline(formData.topic, { ...options, slides: formData.slides || 10 });
          break;
        case 'quiz':
          result = await aiService.generateQuiz(formData.topic, { ...options, questionCount: formData.questionCount || 10 });
          break;
        case 'summary':
          result = await aiService.generateSummary(formData.content || formData.topic, options);
          break;
        case 'lesson':
          result = await aiService.generateLessonPlan(formData.topic, { ...options, duration: formData.duration || 45 });
          break;
        case 'flashcard':
          result = await aiService.generateFlashcards(formData.topic, { ...options, count: formData.count || 20 });
          break;
        default:
          throw new Error('Unknown generation type');
      }

      // 记录使用
      await aiService.logUsage(user?.id, type, { success: true, preview: JSON.stringify(result).substring(0, 200) });

      // 保存生成结果到数据库
      if (supabase && result) {
        await supabase.from('dwxz_generated_content').insert([{
          teacher_id: user?.id,
          content_type: type,
          title: formData.topic,
          content: JSON.stringify(result),
          hsk_level: formData.hskLevel || 3,
          visibility: 'private'
        }]);
      }

      setGenerationResult(result);
      setShowGenerateModal(null);
      loadGeneratedContent();

    } catch (e) {
      console.error('Generation error:', e);
      setGenerateError(e.message || 'Generation failed');
      
      if (aiService) {
        await aiService.logUsage(user?.id, type, { success: false, error: e.message });
      }
    }
    
    setIsLoading(false);
  };

  const updateVisibility = async (id, type, visibility, classId = null) => {
    try {
      const endpoint = type === 'material' ? `/teacher-agent/materials/${id}/visibility` : `/teacher-agent/generated/${id}/visibility`;
      await apiCall(endpoint, 'PUT', { visibility, class_id: classId });
      if (type === 'material') loadMaterials();
      else loadGeneratedContent();
    } catch (e) { console.error(e); }
  };

  const getVisibilityIcon = (visibility) => {
    return visibility === 'public' ? '🌐' : visibility === 'class' ? '🎓' : '🔒';
  };

  const getVisibilityColor = (visibility) => {
    return visibility === 'public' ? '#27ae60' : visibility === 'class' ? '#3498db' : '#95a5a6';
  };

  // Render Materials Tab
  const renderMaterials = () => (
    <div className="tab-content">
      <div className="toolbar">
        <div className="filter-group">
          <label>{t.visibility}:</label>
          <select value={filterVisibility} onChange={(e) => setFilterVisibility(e.target.value)}>
            <option value="all">{t.all}</option>
            <option value="private">{t.private}</option>
            <option value="public">{t.public}</option>
            <option value="class">{t.class}</option>
          </select>
        </div>
        <div className="action-buttons">
          <button className="btn primary" onClick={() => setShowUploadModal('upload')}>
            📤 {t.upload}
          </button>
          <button className="btn secondary" onClick={() => setShowUploadModal('content')}>
            ➕ {t.addContent}
          </button>
        </div>
      </div>

      <div className="visibility-legend">
        <span><span className="legend-icon" style={{color: '#95a5a6'}}>🔒</span> {t.visibilityExplain?.private}</span>
        <span><span className="legend-icon" style={{color: '#27ae60'}}>🌐</span> {t.visibilityExplain?.public}</span>
        <span><span className="legend-icon" style={{color: '#3498db'}}>🎓</span> {t.visibilityExplain?.class}</span>
      </div>

      <div className="materials-grid">
        {materials.length === 0 ? (
          <p className="no-data">{t.noData}</p>
        ) : (
          materials.map(m => (
            <div key={m.id} className="material-card">
              <div className="card-header">
                <span className="visibility-badge" style={{background: getVisibilityColor(m.visibility)}}>
                  {getVisibilityIcon(m.visibility)}
                </span>
                <span className="content-type">{m.content_type}</span>
              </div>
              <h4>{m.title_zh || m.title}</h4>
              <p className="description">{m.description || 'No description'}</p>
              <div className="card-meta">
                <span>HSK {m.hsk_level}</span>
                <span>{m.category}</span>
              </div>
              {m.tags?.length > 0 && (
                <div className="tags">
                  {m.tags.map((tag, i) => <span key={i} className="tag">{tag}</span>)}
                </div>
              )}
              <div className="card-actions">
                <select 
                  value={m.visibility} 
                  onChange={(e) => {
                    if (e.target.value === 'class') {
                      // Show class selector
                      const classId = prompt('Enter class ID:');
                      if (classId) updateVisibility(m.id, 'material', 'class', classId);
                    } else {
                      updateVisibility(m.id, 'material', e.target.value);
                    }
                  }}
                  className="visibility-select"
                >
                  <option value="private">🔒 {t.private}</option>
                  <option value="public">🌐 {t.public}</option>
                  <option value="class">🎓 {t.class}</option>
                </select>
                {m.file_url && <a href={`${API_URL}${m.file_url}`} className="btn small">📥</a>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Render Generate Tab
  const renderGenerate = () => (
    <div className="tab-content">
      <div className="generate-grid">
        <div className="generate-card" onClick={() => setShowGenerateModal('ppt')}>
          <span className="icon">📊</span>
          <h4>{t.generatePPT}</h4>
          <p>{language === 'zh' ? '根据主题生成课件大纲' : 'Generate PPT outline from topic'}</p>
        </div>
        <div className="generate-card" onClick={() => setShowGenerateModal('quiz')}>
          <span className="icon">📝</span>
          <h4>{t.generateQuiz}</h4>
          <p>{language === 'zh' ? '生成练习题和测验' : 'Generate quizzes and exercises'}</p>
        </div>
        <div className="generate-card" onClick={() => setShowGenerateModal('summary')}>
          <span className="icon">📄</span>
          <h4>{t.generateSummary}</h4>
          <p>{language === 'zh' ? '从资料生成摘要笔记' : 'Generate summary notes'}</p>
        </div>
        <div className="generate-card" onClick={() => setShowGenerateModal('lesson-plan')}>
          <span className="icon">📋</span>
          <h4>{t.generateLessonPlan}</h4>
          <p>{language === 'zh' ? '生成完整教案' : 'Generate complete lesson plan'}</p>
        </div>
        <div className="generate-card" onClick={() => setShowGenerateModal('flashcards')}>
          <span className="icon">🃏</span>
          <h4>{t.generateFlashcards}</h4>
          <p>{language === 'zh' ? '生成词汇闪卡' : 'Generate vocabulary flashcards'}</p>
        </div>
      </div>

      {generatedContent.length > 0 && (
        <>
          <h3 style={{marginTop: '30px'}}>{language === 'zh' ? '已生成内容' : 'Generated Content'}</h3>
          <div className="generated-list">
            {generatedContent.map(c => (
              <div key={c.id} className="generated-item">
                <span className="type-badge">{c.content_type}</span>
                <span className="visibility-badge" style={{background: getVisibilityColor(c.visibility)}}>
                  {getVisibilityIcon(c.visibility)}
                </span>
                <span className="title">{c.title_zh || c.title}</span>
                <span className="date">{new Date(c.created_at).toLocaleDateString()}</span>
                <select 
                  value={c.visibility}
                  onChange={(e) => updateVisibility(c.id, 'generated', e.target.value)}
                  className="visibility-select small"
                >
                  <option value="private">🔒</option>
                  <option value="public">🌐</option>
                  <option value="class">🎓</option>
                </select>
                <button className="btn small" onClick={() => setGenerationResult(c)}>👁️</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // Render Knowledge Base Tab
  const renderKnowledge = () => (
    <div className="tab-content">
      <div className="toolbar">
        <button className="btn primary" onClick={() => setShowUploadModal('knowledge')}>
          ➕ {language === 'zh' ? '添加知识条目' : 'Add Knowledge Entry'}
        </button>
      </div>

      <div className="knowledge-grid">
        {knowledgeBase.length === 0 ? (
          <p className="no-data">{t.noData}</p>
        ) : (
          knowledgeBase.map(k => (
            <div key={k.id} className="knowledge-card">
              <div className="card-header">
                <span className="entry-type">{k.entry_type}</span>
                <span className="visibility-badge" style={{background: getVisibilityColor(k.visibility)}}>
                  {getVisibilityIcon(k.visibility)}
                </span>
              </div>
              <h4>{k.title}</h4>
              {k.content_zh && <p className="chinese">{k.content_zh}</p>}
              {k.pinyin && <p className="pinyin">{k.pinyin}</p>}
              <p className="content">{k.content}</p>
              {k.tags?.length > 0 && (
                <div className="tags">
                  {k.tags.map((tag, i) => <span key={i} className="tag">{tag}</span>)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Upload Modal
  const renderUploadModal = () => {
    if (!showUploadModal) return null;

    return (
      <div className="modal-overlay" onClick={() => setShowUploadModal(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>
            {showUploadModal === 'upload' ? t.upload : 
             showUploadModal === 'content' ? t.addContent : 
             language === 'zh' ? '添加知识条目' : 'Add Knowledge Entry'}
          </h3>

          <form onSubmit={showUploadModal === 'upload' ? handleUpload : handleAddContent}>
            <div className="form-group">
              <label>{t.topic} *</label>
              <input name="title" required placeholder={language === 'zh' ? '标题' : 'Title'} />
            </div>

            <div className="form-group">
              <label>{language === 'zh' ? '中文标题' : 'Chinese Title'}</label>
              <input name="title_zh" placeholder="中文标题" />
            </div>

            {showUploadModal === 'upload' && (
              <div className="form-group">
                <label>{language === 'zh' ? '文件' : 'File'}</label>
                <input type="file" name="file" />
              </div>
            )}

            {(showUploadModal === 'content' || showUploadModal === 'knowledge') && (
              <div className="form-group">
                <label>{language === 'zh' ? '内容' : 'Content'} *</label>
                <textarea name="content" required rows="5" placeholder={language === 'zh' ? '输入内容...' : 'Enter content...'}></textarea>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>{t.hskLevel}</label>
                <select name="hsk_level" defaultValue="1">
                  {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>{t.category}</label>
                <select name="category" defaultValue="general">
                  <option value="general">{language === 'zh' ? '通用' : 'General'}</option>
                  <option value="vocabulary">{language === 'zh' ? '词汇' : 'Vocabulary'}</option>
                  <option value="grammar">{language === 'zh' ? '语法' : 'Grammar'}</option>
                  <option value="culture">{language === 'zh' ? '文化' : 'Culture'}</option>
                  <option value="listening">{language === 'zh' ? '听力' : 'Listening'}</option>
                  <option value="reading">{language === 'zh' ? '阅读' : 'Reading'}</option>
                  <option value="speaking">{language === 'zh' ? '口语' : 'Speaking'}</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>{t.visibility} *</label>
              <div className="visibility-options">
                <label className="radio-option">
                  <input type="radio" name="visibility" value="private" defaultChecked />
                  <span className="option-content">
                    <span className="icon">🔒</span>
                    <span className="label">{t.private}</span>
                    <span className="desc">{t.visibilityExplain?.private}</span>
                  </span>
                </label>
                <label className="radio-option">
                  <input type="radio" name="visibility" value="public" />
                  <span className="option-content">
                    <span className="icon">🌐</span>
                    <span className="label">{t.public}</span>
                    <span className="desc">{t.visibilityExplain?.public}</span>
                  </span>
                </label>
                <label className="radio-option">
                  <input type="radio" name="visibility" value="class" />
                  <span className="option-content">
                    <span className="icon">🎓</span>
                    <span className="label">{t.class}</span>
                    <span className="desc">{t.visibilityExplain?.class}</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>{t.tags}</label>
              <input name="tags" placeholder={language === 'zh' ? '用逗号分隔标签' : 'Comma-separated tags'} />
            </div>

            <div className="form-actions">
              <button type="button" className="btn secondary" onClick={() => setShowUploadModal(null)}>
                {t.cancel}
              </button>
              <button type="submit" className="btn primary" disabled={isLoading}>
                {isLoading ? t.loading : t.save}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Generate Modal
  const renderGenerateModal = () => {
    if (!showGenerateModal) return null;

    const configs = {
      ppt: { title: t.generatePPT, fields: ['topic', 'topic_zh', 'hsk_level', 'slide_count'] },
      quiz: { title: t.generateQuiz, fields: ['topic', 'hsk_level', 'question_count', 'question_types'] },
      summary: { title: t.generateSummary, fields: ['topic', 'content', 'summary_type'] },
      'lesson-plan': { title: t.generateLessonPlan, fields: ['topic', 'topic_zh', 'hsk_level', 'duration_minutes', 'objectives'] },
      flashcards: { title: t.generateFlashcards, fields: ['hsk_level', 'vocabulary_list', 'include_pinyin', 'include_examples'] }
    };

    const config = configs[showGenerateModal];

    const handleSubmit = (e) => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(e.target));
      handleGenerate(showGenerateModal, formData);
    };

    return (
      <div className="modal-overlay" onClick={() => setShowGenerateModal(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{config.title}</h3>

          <form onSubmit={handleSubmit}>
            {config.fields.includes('topic') && (
              <div className="form-group">
                <label>{t.topic} *</label>
                <input name="topic" required placeholder={language === 'zh' ? '例如：医院看病' : 'e.g., Visiting a Doctor'} />
              </div>
            )}

            {config.fields.includes('topic_zh') && (
              <div className="form-group">
                <label>{language === 'zh' ? '中文主题' : 'Chinese Topic'}</label>
                <input name="topic_zh" placeholder="中文主题" />
              </div>
            )}

            {config.fields.includes('content') && (
              <div className="form-group">
                <label>{language === 'zh' ? '内容（可选）' : 'Content (Optional)'}</label>
                <textarea name="content" rows="4" placeholder={language === 'zh' ? '粘贴要总结的内容...' : 'Paste content to summarize...'}></textarea>
              </div>
            )}

            {config.fields.includes('vocabulary_list') && (
              <div className="form-group">
                <label>{language === 'zh' ? '词汇列表' : 'Vocabulary List'}</label>
                <textarea name="vocabulary_list" rows="4" placeholder={language === 'zh' ? '每行一个词汇，格式：汉字,拼音,意思' : 'One word per line: Chinese,pinyin,meaning'}></textarea>
              </div>
            )}

            {config.fields.includes('hsk_level') && (
              <div className="form-group">
                <label>{t.hskLevel}</label>
                <select name="hsk_level" defaultValue="2">
                  {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                </select>
              </div>
            )}

            {config.fields.includes('slide_count') && (
              <div className="form-group">
                <label>{language === 'zh' ? '幻灯片数量' : 'Slide Count'}</label>
                <input type="number" name="slide_count" defaultValue="10" min="5" max="30" />
              </div>
            )}

            {config.fields.includes('question_count') && (
              <div className="form-group">
                <label>{language === 'zh' ? '题目数量' : 'Question Count'}</label>
                <input type="number" name="question_count" defaultValue="10" min="5" max="50" />
              </div>
            )}

            {config.fields.includes('duration_minutes') && (
              <div className="form-group">
                <label>{language === 'zh' ? '时长（分钟）' : 'Duration (minutes)'}</label>
                <input type="number" name="duration_minutes" defaultValue="90" min="30" max="180" />
              </div>
            )}

            {config.fields.includes('objectives') && (
              <div className="form-group">
                <label>{language === 'zh' ? '学习目标' : 'Learning Objectives'}</label>
                <textarea name="objectives" rows="3" placeholder={language === 'zh' ? '每行一个目标' : 'One objective per line'}></textarea>
              </div>
            )}

            <div className="form-group">
              <label>{t.visibility}</label>
              <select name="visibility" defaultValue="private">
                <option value="private">🔒 {t.private}</option>
                <option value="public">🌐 {t.public}</option>
                <option value="class">🎓 {t.class}</option>
              </select>
            </div>

            <div className="form-actions">
              <button type="button" className="btn secondary" onClick={() => setShowGenerateModal(null)}>
                {t.cancel}
              </button>
              <button type="submit" className="btn primary" disabled={isLoading}>
                {isLoading ? t.loading : t.generate}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Result Modal
  const renderResultModal = () => {
    if (!generationResult) return null;

    const content = generationResult.ppt || generationResult.quiz || generationResult.summary || 
                    generationResult.lessonPlan || generationResult.flashcards || generationResult.content;

    return (
      <div className="modal-overlay" onClick={() => setGenerationResult(null)}>
        <div className="modal large" onClick={e => e.stopPropagation()}>
          <h3>{language === 'zh' ? '生成结果' : 'Generated Result'}</h3>
          
          <div className="result-content">
            {content?.slides && (
              <div className="ppt-preview">
                <h4>PPT: {content.topic_zh || content.topic} ({content.slide_count} slides)</h4>
                {content.slides.map((slide, i) => (
                  <div key={i} className="slide-preview">
                    <span className="slide-number">{i + 1}</span>
                    <div className="slide-content">
                      <strong>{slide.title}</strong>
                      {slide.content && <ul>{slide.content.map((c, j) => <li key={j}>{c}</li>)}</ul>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {content?.questions && (
              <div className="quiz-preview">
                <h4>Quiz: {content.total_questions} questions ({content.total_points} points)</h4>
                {content.questions.map((q, i) => (
                  <div key={i} className="question-preview">
                    <span className="q-number">Q{i + 1}</span>
                    <span className="q-type">{q.type}</span>
                    <p>{q.question_zh || q.question}</p>
                    {q.options && <ul>{q.options.map((o, j) => <li key={j}>{o}</li>)}</ul>}
                  </div>
                ))}
              </div>
            )}

            {content?.cards && (
              <div className="flashcards-preview">
                <h4>Flashcards: {content.card_count} cards</h4>
                <div className="cards-grid">
                  {content.cards.slice(0, 6).map((card, i) => (
                    <div key={i} className="flashcard-preview">
                      <div className="front">
                        <span className="chinese">{card.front.chinese}</span>
                        {card.front.pinyin && <span className="pinyin">{card.front.pinyin}</span>}
                      </div>
                      <div className="back">
                        <span>{card.back.english}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {content?.lesson_structure && (
              <div className="lesson-plan-preview">
                <h4>Lesson Plan: {content.topic_zh || content.topic}</h4>
                <p><strong>Duration:</strong> {content.duration_minutes} minutes</p>
                <div className="objectives">
                  <strong>Objectives:</strong>
                  <ul>{content.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
                </div>
                <div className="structure">
                  <strong>Structure:</strong>
                  {content.lesson_structure.map((phase, i) => (
                    <div key={i} className="phase">
                      <span className="phase-name">{phase.phase}</span>
                      <span className="phase-duration">{phase.duration} min</span>
                      <ul>{phase.activities.map((a, j) => <li key={j}>{a}</li>)}</ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button className="btn secondary" onClick={() => setGenerationResult(null)}>
              {language === 'zh' ? '关闭' : 'Close'}
            </button>
            <button className="btn primary">
              {language === 'zh' ? '导出' : 'Export'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="teacher-agent-page">
      <style>{`
        .teacher-agent-page { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .page-header { text-align: center; margin-bottom: 30px; }
        .page-header h1 { font-size: 2rem; margin-bottom: 5px; }
        .page-header p { color: #666; }
        
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .tab-btn { padding: 12px 24px; border: none; background: #f5f5f5; border-radius: 8px 8px 0 0; cursor: pointer; font-size: 1rem; transition: all 0.3s; }
        .tab-btn.active { background: #e74c3c; color: white; }
        .tab-btn:hover:not(.active) { background: #ddd; }
        
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; }
        .filter-group { display: flex; align-items: center; gap: 10px; }
        .filter-group select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; }
        .action-buttons { display: flex; gap: 10px; }
        
        .btn { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 0.95rem; transition: all 0.3s; }
        .btn.primary { background: #e74c3c; color: white; }
        .btn.primary:hover { background: #c0392b; }
        .btn.secondary { background: #f5f5f5; color: #333; }
        .btn.small { padding: 5px 10px; font-size: 0.85rem; }
        
        .visibility-legend { display: flex; gap: 20px; margin-bottom: 20px; padding: 10px; background: #f9f9f9; border-radius: 8px; font-size: 0.85rem; color: #666; flex-wrap: wrap; }
        .legend-icon { font-size: 1.1rem; margin-right: 5px; }
        
        .materials-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .material-card { background: white; border: 1px solid #ddd; border-radius: 12px; padding: 20px; transition: transform 0.3s, box-shadow 0.3s; }
        .material-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .card-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .visibility-badge { display: inline-block; padding: 3px 8px; border-radius: 12px; color: white; font-size: 0.8rem; }
        .content-type { background: #f5f5f5; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; }
        .material-card h4 { margin: 0 0 10px; }
        .description { color: #666; font-size: 0.9rem; margin-bottom: 10px; }
        .card-meta { display: flex; gap: 10px; font-size: 0.85rem; color: #888; margin-bottom: 10px; }
        .tags { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
        .tag { background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; }
        .card-actions { display: flex; gap: 10px; align-items: center; }
        .visibility-select { padding: 5px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; }
        .visibility-select.small { padding: 3px 6px; }
        
        .generate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
        .generate-card { background: white; border: 2px solid #eee; border-radius: 12px; padding: 25px; text-align: center; cursor: pointer; transition: all 0.3s; }
        .generate-card:hover { border-color: #e74c3c; transform: translateY(-3px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
        .generate-card .icon { font-size: 3rem; display: block; margin-bottom: 15px; }
        .generate-card h4 { margin: 0 0 10px; }
        .generate-card p { color: #666; font-size: 0.9rem; margin: 0; }
        
        .generated-list { display: flex; flex-direction: column; gap: 10px; }
        .generated-item { display: flex; align-items: center; gap: 15px; padding: 12px 15px; background: #f9f9f9; border-radius: 8px; }
        .type-badge { background: #3498db; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; text-transform: uppercase; }
        .generated-item .title { flex: 1; }
        .generated-item .date { color: #888; font-size: 0.85rem; }
        
        .knowledge-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .knowledge-card { background: white; border: 1px solid #ddd; border-radius: 12px; padding: 20px; }
        .knowledge-card .entry-type { background: #9b59b6; color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; }
        .knowledge-card .chinese { font-size: 1.2rem; margin: 10px 0 5px; }
        .knowledge-card .pinyin { color: #e74c3c; font-size: 0.9rem; margin-bottom: 10px; }
        .knowledge-card .content { color: #555; }
        
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .modal { background: white; border-radius: 16px; padding: 30px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; }
        .modal.large { max-width: 800px; }
        .modal h3 { margin: 0 0 20px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
        .form-group textarea { resize: vertical; }
        .form-row { display: flex; gap: 15px; }
        .form-row .form-group { flex: 1; }
        
        .visibility-options { display: flex; flex-direction: column; gap: 10px; }
        .radio-option { display: flex; align-items: flex-start; cursor: pointer; }
        .radio-option input { margin-right: 10px; margin-top: 5px; }
        .option-content { display: flex; flex-direction: column; }
        .option-content .icon { font-size: 1.2rem; }
        .option-content .label { font-weight: 500; }
        .option-content .desc { font-size: 0.85rem; color: #666; }
        
        .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
        
        .result-content { max-height: 400px; overflow-y: auto; margin-bottom: 20px; }
        .ppt-preview, .quiz-preview, .lesson-plan-preview { padding: 15px; background: #f9f9f9; border-radius: 8px; }
        .slide-preview { display: flex; gap: 15px; padding: 10px; margin-bottom: 10px; background: white; border-radius: 8px; }
        .slide-number { background: #e74c3c; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .question-preview { padding: 10px; margin-bottom: 10px; background: white; border-radius: 8px; }
        .q-number { background: #3498db; color: white; padding: 2px 8px; border-radius: 10px; margin-right: 10px; }
        .q-type { background: #f5f5f5; padding: 2px 8px; border-radius: 10px; font-size: 0.85rem; }
        
        .flashcards-preview .cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .flashcard-preview { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .flashcard-preview .front { background: #fff3e0; padding: 15px; text-align: center; }
        .flashcard-preview .front .chinese { font-size: 1.5rem; display: block; }
        .flashcard-preview .front .pinyin { color: #e74c3c; font-size: 0.9rem; }
        .flashcard-preview .back { padding: 10px; text-align: center; background: #e8f5e9; }
        
        .lesson-plan-preview .phase { padding: 10px; margin: 5px 0; background: white; border-radius: 8px; }
        .phase-name { font-weight: bold; margin-right: 10px; }
        .phase-duration { background: #e0e0e0; padding: 2px 8px; border-radius: 10px; font-size: 0.85rem; }
        
        .no-data { text-align: center; color: #888; padding: 40px; }
        
        @media (max-width: 768px) {
          .tabs { flex-wrap: wrap; }
          .tab-btn { flex: 1; min-width: 100px; text-align: center; }
          .toolbar { flex-direction: column; align-items: stretch; }
          .generate-grid { grid-template-columns: repeat(2, 1fr); }
          .flashcards-preview .cards-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div className="page-header">
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
          {t.materials}
        </button>
        <button className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`} onClick={() => setActiveTab('generate')}>
          {t.generate}
        </button>
        <button className={`tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`} onClick={() => setActiveTab('knowledge')}>
          {t.knowledge}
        </button>
      </div>

      {activeTab === 'materials' && renderMaterials()}
      {activeTab === 'generate' && renderGenerate()}
      {activeTab === 'knowledge' && renderKnowledge()}

      {renderUploadModal()}
      {renderGenerateModal()}
      {renderResultModal()}
    </div>
  );
};

export default TeacherAgentPage;
