import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getAIService } from '../services/aiService';
import { getRAGService } from '../services/ragService';

const TeacherAIAgentPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('chat');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [classAnalysis, setClassAnalysis] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [myMaterials, setMyMaterials] = useState([]);
  
  // 聊天状态
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef(null);

  const txt = {
    zh: {
      title: '🤖 智能教学助手',
      chat: '智能备课',
      classAnalysis: '班级分析',
      materials: '资料库',
      lessonPlan: '课程规划',
      greeting: '你好！我是你的智能教学助手。我可以帮你分析学生学习情况、准备课程、推荐教学材料。你想从哪里开始？',
      inputPlaceholder: '描述你的教学需求...',
      send: '发送',
      selectClass: '选择班级',
      studentCount: '学生数',
      avgLevel: '平均水平',
      avgScore: '平均成绩',
      commonDifficulties: '共同难点',
      topPerformers: '优秀学生',
      needsAttention: '需要关注',
      classOverview: '班级概况',
      skillDistribution: '技能分布',
      recentPerformance: '近期表现',
      attendanceRate: '出勤率',
      homeworkCompletion: '作业完成率',
      internalMaterials: '内部资料',
      externalMaterials: '外部资源',
      myUploads: '我的上传',
      uploadMaterial: '上传资料',
      searchMaterials: '搜索资料...',
      filterByHSK: '按HSK筛选',
      filterByType: '按类型筛选',
      all: '全部',
      video: '视频',
      audio: '音频',
      document: '文档',
      exercise: '练习',
      useMaterial: '使用',
      generateLesson: '生成课程计划',
      aiSuggestions: 'AI教学建议',
      basedOnAnalysis: '基于班级分析',
      recommendedTopics: '推荐教学主题',
      suggestedActivities: '建议活动',
      estimatedDuration: '预估时长',
      minutes: '分钟',
      askAbout: '你可以问我：',
      suggestions: [
        '帮我准备明天HSK3的课程',
        '分析一下我班级的薄弱点',
        '推荐适合复习声调的活动',
        '如何解释"把"字句？',
        '生成一个关于购物的对话练习'
      ]
    },
    en: {
      title: '🤖 Intelligent Teaching Assistant',
      chat: 'Smart Planning',
      classAnalysis: 'Class Analysis',
      materials: 'Materials',
      lessonPlan: 'Lesson Plan',
      greeting: "Hi! I'm your AI teaching assistant. I can help you analyze student performance, prepare lessons, and recommend materials. Where would you like to start?",
      inputPlaceholder: 'Describe your teaching needs...',
      send: 'Send',
      selectClass: 'Select Class',
      studentCount: 'Students',
      avgLevel: 'Avg Level',
      avgScore: 'Avg Score',
      commonDifficulties: 'Common Difficulties',
      topPerformers: 'Top Performers',
      needsAttention: 'Needs Attention',
      classOverview: 'Class Overview',
      skillDistribution: 'Skill Distribution',
      recentPerformance: 'Recent Performance',
      attendanceRate: 'Attendance',
      homeworkCompletion: 'Homework Rate',
      internalMaterials: 'Internal',
      externalMaterials: 'External',
      myUploads: 'My Uploads',
      uploadMaterial: 'Upload',
      searchMaterials: 'Search materials...',
      filterByHSK: 'Filter by HSK',
      filterByType: 'Filter by Type',
      all: 'All',
      video: 'Video',
      audio: 'Audio',
      document: 'Document',
      exercise: 'Exercise',
      useMaterial: 'Use',
      generateLesson: 'Generate Lesson Plan',
      aiSuggestions: 'Intelligent Teaching Tips',
      basedOnAnalysis: 'Based on Class Analysis',
      recommendedTopics: 'Recommended Topics',
      suggestedActivities: 'Suggested Activities',
      estimatedDuration: 'Est. Duration',
      minutes: 'min',
      askAbout: 'You can ask me:',
      suggestions: [
        "Help me prepare tomorrow's HSK3 class",
        'Analyze my class weaknesses',
        'Recommend activities for tone practice',
        'How to explain "把" sentence?',
        'Generate a shopping dialogue exercise'
      ]
    },
    it: {
      title: '🤖 Assistente Didattico AI',
      chat: 'Pianificazione',
      classAnalysis: 'Analisi Classe',
      materials: 'Materiali',
      lessonPlan: 'Piano Lezione',
      greeting: "Ciao! Sono il tuo assistente didattico AI. Posso aiutarti ad analizzare le prestazioni degli studenti e preparare le lezioni. Da dove vuoi iniziare?",
      inputPlaceholder: 'Descrivi le tue esigenze...',
      send: 'Invia',
      selectClass: 'Seleziona Classe',
      studentCount: 'Studenti',
      avgLevel: 'Livello Medio',
      avgScore: 'Punteggio Medio',
      commonDifficulties: 'Difficoltà Comuni',
      topPerformers: 'Migliori',
      needsAttention: 'Da Seguire',
      classOverview: 'Panoramica Classe',
      skillDistribution: 'Distribuzione Competenze',
      recentPerformance: 'Prestazioni Recenti',
      attendanceRate: 'Presenze',
      homeworkCompletion: 'Completamento Compiti',
      internalMaterials: 'Interni',
      externalMaterials: 'Esterni',
      myUploads: 'I Miei Upload',
      uploadMaterial: 'Carica',
      searchMaterials: 'Cerca materiali...',
      filterByHSK: 'Filtra per HSK',
      filterByType: 'Filtra per Tipo',
      all: 'Tutti',
      video: 'Video',
      audio: 'Audio',
      document: 'Documento',
      exercise: 'Esercizio',
      useMaterial: 'Usa',
      generateLesson: 'Genera Piano Lezione',
      aiSuggestions: 'Consigli Intelligenti',
      basedOnAnalysis: 'Basato su Analisi',
      recommendedTopics: 'Argomenti Consigliati',
      suggestedActivities: 'Attività Suggerite',
      estimatedDuration: 'Durata Stimata',
      minutes: 'min',
      askAbout: 'Puoi chiedermi:',
      suggestions: [
        'Aiutami a preparare la lezione HSK3',
        'Analizza i punti deboli della classe',
        'Raccomanda attività per i toni',
        'Come spiegare la frase "把"?',
        'Genera un dialogo sullo shopping'
      ]
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => {
    loadData();
    setMessages([{ role: 'assistant', content: t.greeting }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedClass) loadClassAnalysis(selectedClass);
  }, [selectedClass]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 加载教师画像
      let { data: profileData } = await supabase
        .from('dwxz_teacher_teaching_profiles')
        .select('*')
        .eq('teacher_id', user?.id)
        .single();

      if (!profileData) {
        const { data: newProfile } = await supabase
          .from('dwxz_teacher_teaching_profiles')
          .insert([{ teacher_id: user?.id }])
          .select()
          .single();
        profileData = newProfile;
      }
      setProfile(profileData);

      // 加载班级
      const { data: classesData } = await supabase
        .from('dwxz_classes')
        .select('*')
        .eq('teacher_id', user?.id);
      setClasses(classesData || []);
      if (classesData?.length > 0) setSelectedClass(classesData[0].id);

      // 加载教学材料
      const { data: materialsData } = await supabase
        .from('dwxz_teaching_materials')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);
      setMaterials(materialsData || []);

      // 加载我上传的材料
      const { data: myMaterialsData } = await supabase
        .from('dwxz_teaching_materials')
        .select('*')
        .eq('uploaded_by', user?.id);
      setMyMaterials(myMaterialsData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadClassAnalysis = async (classId) => {
    // 模拟班级分析数据（实际应从数据库聚合）
    setClassAnalysis({
      studentCount: Math.floor(Math.random() * 15) + 10,
      avgLevel: 'HSK' + (Math.floor(Math.random() * 3) + 2),
      avgScore: Math.floor(Math.random() * 20) + 70,
      attendanceRate: Math.floor(Math.random() * 15) + 85,
      homeworkCompletion: Math.floor(Math.random() * 20) + 75,
      commonDifficulties: ['声调辨别', '量词使用', '语序问题'],
      topPerformers: ['张明', '李华', '王小红'],
      needsAttention: ['刘强', '陈晓'],
      skillDistribution: {
        listening: Math.floor(Math.random() * 20) + 65,
        speaking: Math.floor(Math.random() * 20) + 60,
        reading: Math.floor(Math.random() * 20) + 70,
        writing: Math.floor(Math.random() * 20) + 55,
        grammar: Math.floor(Math.random() * 20) + 60
      }
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setSending(true);

    try {
      const aiService = getAIService();
      await aiService.loadSettings();

      // 初始化RAG服务
      const ragService = getRAGService(supabase);
      await ragService.loadConfig();

      // 检查RAG是否可用
      const ragStatus = await ragService.isConfigured();
      
      let ragContext = '';
      let ragChunks = [];
      
      // 如果RAG已配置且有文档，则检索相关内容
      if (ragStatus.isReady) {
        const cls = classes.find(c => c.id === selectedClass);
        const ragResult = await ragService.query(userMessage, {
          topK: 5,
          hskLevels: cls?.hsk_level ? [cls.hsk_level] : null
        });
        ragChunks = ragResult.chunks;
        if (ragChunks.length > 0) {
          ragContext = `\n\n## 知识库参考资料\n${ragService.buildContext(ragChunks)}`;
        }
      }

      const context = buildTeacherContext();
      
      const systemPrompt = `你是"大卫学中文"平台的智能教学助手。你正在帮助一位中文教师准备课程和教学。

## 教师信息
${context}
${ragContext}

## 你的职责
1. 帮助教师分析班级学生的学习情况和共同难点
2. 根据学生水平和需求，建议教学内容和方法
3. 如果有知识库参考资料，优先使用这些资料提供建议
4. 推荐适合的教学材料（内部上传的和外部资源）
5. 生成课程计划、教案、练习题
6. 提供教学技巧和建议
7. 帮助准备HSK考试相关教学

## 回复要求
- 使用${language === 'zh' ? '中文' : language === 'it' ? '意大利语' : '英语'}回复
- 回复要专业、实用
- 如果涉及课程设计，提供具体可操作的建议
- 如果使用了知识库资料，可以简要提及来源
- 考虑学生的实际水平和常见问题
- 如果生成教学内容，格式要清晰易用

## 可用资源
- RAG知识库（教材、语法、词汇等）
- 内部教学材料库
- 外部学习资源
- 学生学习数据和错误模式`;

      const response = await aiService.chat([
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
      ]);

      const assistantMessage = response?.content || response;
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);

      // 保存对话历史
      await supabase.from('dwxz_ai_agent_conversations').insert([
        { user_id: user?.id, agent_type: 'teacher_agent', session_id: sessionId, role: 'user', content: userMessage },
        { user_id: user?.id, agent_type: 'teacher_agent', session_id: sessionId, role: 'assistant', content: assistantMessage }
      ]);

    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: language === 'zh' ? '抱歉，我遇到了一些问题。请稍后再试。' : 'Sorry, I encountered an issue.'
      }]);
    } finally {
      setSending(false);
    }
  };

  const buildTeacherContext = () => {
    const cls = classes.find(c => c.id === selectedClass);
    return `
- 教师姓名: ${user?.name || user?.name_zh}
- 当前班级: ${cls?.name || '未选择'} (HSK${cls?.hsk_level || '?'})
- 班级学生数: ${classAnalysis?.studentCount || '?'}
- 班级平均成绩: ${classAnalysis?.avgScore || '?'}%
- 常见难点: ${classAnalysis?.commonDifficulties?.join(', ') || '待分析'}
- 技能分布: 听力${classAnalysis?.skillDistribution?.listening}%, 口语${classAnalysis?.skillDistribution?.speaking}%, 阅读${classAnalysis?.skillDistribution?.reading}%, 写作${classAnalysis?.skillDistribution?.writing}%
- 我上传的材料数: ${myMaterials.length}`;
  };

  const getSkillBar = (value, label) => (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div style={{ height: '6px', background: 'var(--background)', borderRadius: '3px' }}>
        <div style={{ 
          width: `${value}%`, 
          height: '100%', 
          background: value >= 70 ? 'var(--success)' : value >= 50 ? 'var(--warning)' : 'var(--error)',
          borderRadius: '3px'
        }} />
      </div>
    </div>
  );

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
        {classes.length > 0 && (
          <select 
            className="form-select" 
            style={{ width: 'auto' }}
            value={selectedClass || ''}
            onChange={e => setSelectedClass(e.target.value)}
          >
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name} (HSK{cls.hsk_level})</option>
            ))}
          </select>
        )}
      </div>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          💬 {t.chat}
        </button>
        <button className={`tab ${activeTab === 'classAnalysis' ? 'active' : ''}`} onClick={() => setActiveTab('classAnalysis')}>
          📊 {t.classAnalysis}
        </button>
        <button className={`tab ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
          📚 {t.materials}
        </button>
        <button className={`tab ${activeTab === 'lessonPlan' ? 'active' : ''}`} onClick={() => setActiveTab('lessonPlan')}>
          📋 {t.lessonPlan}
        </button>
      </div>

      {/* 聊天界面 */}
      {activeTab === 'chat' && (
        <div className="card" style={{ height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-lg)',
                  background: msg.role === 'user' ? 'var(--primary)' : 'var(--background)',
                  color: msg.role === 'user' ? 'white' : 'inherit',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.role === 'assistant' && <span style={{ marginRight: '0.5rem' }}>🤖</span>}
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '0.75rem 1rem', background: 'var(--background)', borderRadius: 'var(--radius-lg)' }}>
                  🤖 思考中...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {messages.length <= 2 && (
            <div style={{ padding: '0 1rem 0.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t.askAbout}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {t.suggestions.slice(0, 3).map((s, idx) => (
                  <button key={idx} className="btn btn-outline btn-sm" onClick={() => setInput(s)} style={{ fontSize: '0.75rem' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              className="form-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder={t.inputPlaceholder}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={sendMessage} disabled={sending || !input.trim()}>
              {t.send}
            </button>
          </div>
        </div>
      )}

      {/* 班级分析 */}
      {activeTab === 'classAnalysis' && classAnalysis && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--primary)' }}>{classAnalysis.studentCount}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.studentCount}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--info)' }}>{classAnalysis.avgLevel}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.avgLevel}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--success)' }}>{classAnalysis.avgScore}%</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.avgScore}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--warning)' }}>{classAnalysis.attendanceRate}%</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.attendanceRate}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* 技能分布 */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>{t.skillDistribution}</h3>
              {Object.entries(classAnalysis.skillDistribution).map(([skill, value]) => (
                getSkillBar(value, skill.charAt(0).toUpperCase() + skill.slice(1))
              ))}
            </div>

            {/* 共同难点 */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>⚠️ {t.commonDifficulties}</h3>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {classAnalysis.commonDifficulties.map((d, i) => (
                  <li key={i} style={{ marginBottom: '0.5rem', color: 'var(--warning)' }}>{d}</li>
                ))}
              </ul>
            </div>

            {/* 优秀学生 */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>⭐ {t.topPerformers}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {classAnalysis.topPerformers.map((s, i) => (
                  <span key={i} className="badge badge-success">{s}</span>
                ))}
              </div>
            </div>

            {/* 需要关注 */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>👀 {t.needsAttention}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {classAnalysis.needsAttention.map((s, i) => (
                  <span key={i} className="badge badge-warning">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 资料库 */}
      {activeTab === 'materials' && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input type="text" className="form-input" placeholder={t.searchMaterials} style={{ flex: 1, minWidth: '200px' }} />
            <select className="form-select" style={{ width: 'auto' }}>
              <option>{t.filterByHSK}</option>
              {[1,2,3,4,5,6].map(l => <option key={l}>HSK{l}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto' }}>
              <option>{t.filterByType}</option>
              <option>{t.video}</option>
              <option>{t.audio}</option>
              <option>{t.document}</option>
              <option>{t.exercise}</option>
            </select>
            <button className="btn btn-primary">+ {t.uploadMaterial}</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {materials.map(m => (
              <div key={m.id} className="card">
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>
                    {m.material_type === 'video' ? '🎬' : m.material_type === 'audio' ? '🎧' : m.material_type === 'exercise' ? '📝' : '📄'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4>{m.title_zh || m.title}</h4>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {m.hsk_levels?.map(l => <span key={l} className="badge badge-info" style={{ fontSize: '0.7rem' }}>HSK{l}</span>)}
                      <span className="badge" style={{ fontSize: '0.7rem' }}>{m.source_type}</span>
                    </div>
                  </div>
                </div>
                {m.description && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>
                    {m.description.substring(0, 80)}...
                  </p>
                )}
                <button className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }}>{t.useMaterial}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 课程规划 */}
      {activeTab === 'lessonPlan' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>📋 {t.lessonPlan}</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            {language === 'zh' ? '基于班级分析，AI可以帮你生成个性化的课程计划。' : 'Based on class analysis, AI can generate personalized lesson plans.'}
          </p>
          
          <div className="form-group">
            <label className="form-label">{language === 'zh' ? '课程主题' : 'Lesson Topic'}</label>
            <input type="text" className="form-input" placeholder={language === 'zh' ? '例如：购物对话、时间表达...' : 'e.g., Shopping dialogue, Time expressions...'} />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">{language === 'zh' ? '课程时长' : 'Duration'}</label>
              <select className="form-select">
                <option>45 {t.minutes}</option>
                <option>60 {t.minutes}</option>
                <option>90 {t.minutes}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{language === 'zh' ? '重点技能' : 'Focus Skill'}</label>
              <select className="form-select">
                <option>{language === 'zh' ? '综合' : 'Comprehensive'}</option>
                <option>{language === 'zh' ? '口语' : 'Speaking'}</option>
                <option>{language === 'zh' ? '听力' : 'Listening'}</option>
                <option>{language === 'zh' ? '阅读' : 'Reading'}</option>
                <option>{language === 'zh' ? '写作' : 'Writing'}</option>
              </select>
            </div>
          </div>

          <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '1rem' }}>
            ✨ {t.generateLesson}
          </button>
        </div>
      )}
    </div>
  );
};

export default TeacherAIAgentPage;
