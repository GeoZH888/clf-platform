import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getAIService } from '../services/aiService';
import { getRAGService } from '../services/ragService';

const StudentAIAgentPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('chat');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [mistakes, setMistakes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [materials, setMaterials] = useState([]);
  
  // 聊天状态
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef(null);
  
  // 语音状态
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const txt = {
    zh: {
      title: '🤖 智能学习助手',
      chat: '智能对话',
      profile: '学习画像',
      mistakes: '错误分析',
      materials: '推荐资料',
      practice: '专项练习',
      greeting: '你好！我是你的智能学习助手小智。我已经分析了你的学习记录，了解你的优势和需要提高的地方。有什么我可以帮你的吗？',
      inputPlaceholder: '输入你的问题...',
      send: '发送',
      currentLevel: '当前水平',
      vocabulary: '词汇量',
      studyTime: '学习时长',
      streak: '连续学习',
      days: '天',
      hours: '小时',
      words: '词',
      skills: '技能评估',
      listening: '听力',
      speaking: '口语',
      reading: '阅读',
      writing: '写作',
      grammar: '语法',
      strengths: '你的优势',
      weaknesses: '需要加强',
      aiSuggestions: '智能建议',
      mistakeType: '错误类型',
      occurrences: '出现次数',
      lastOccurred: '最近出现',
      relatedWords: '相关词汇',
      practiceNow: '立即练习',
      recommendedFor: '推荐理由',
      startLearning: '开始学习',
      noMistakes: '太棒了！暂无明显错误模式',
      generatePlan: '生成学习计划',
      askAbout: '你可以问我：',
      // Voice features
      voiceInput: '语音输入',
      voiceOutput: '语音朗读',
      startListening: '开始录音',
      stopListening: '停止录音',
      readAloud: '朗读',
      stopReading: '停止',
      voiceNotSupported: '您的浏览器不支持语音功能',
      listening: '正在听...',
      suggestions: [
        '帮我复习今天学的内容',
        '我总是搞混"的地得"怎么办？',
        '推荐适合我水平的阅读材料',
        '帮我准备HSK考试',
        '解释一下这个语法点'
      ]
    },
    en: {
      title: '🤖 Intelligent Learning Assistant',
      chat: 'Chat',
      profile: 'My Profile',
      mistakes: 'Mistake Analysis',
      materials: 'Recommended',
      practice: 'Practice',
      greeting: "Hi! I'm your AI learning assistant. I've analyzed your learning history and understand your strengths and areas for improvement. How can I help you today?",
      inputPlaceholder: 'Type your question...',
      send: 'Send',
      currentLevel: 'Current Level',
      vocabulary: 'Vocabulary',
      studyTime: 'Study Time',
      streak: 'Streak',
      days: 'days',
      hours: 'hours',
      words: 'words',
      skills: 'Skill Assessment',
      listening: 'Listening',
      speaking: 'Speaking',
      reading: 'Reading',
      writing: 'Writing',
      grammar: 'Grammar',
      strengths: 'Your Strengths',
      weaknesses: 'Areas to Improve',
      aiSuggestions: 'Intelligent Suggestions',
      mistakeType: 'Mistake Type',
      occurrences: 'Occurrences',
      lastOccurred: 'Last Occurred',
      relatedWords: 'Related Words',
      practiceNow: 'Practice Now',
      recommendedFor: 'Recommended because',
      startLearning: 'Start Learning',
      noMistakes: 'Great! No significant mistake patterns found',
      generatePlan: 'Generate Study Plan',
      askAbout: 'You can ask me:',
      // Voice features
      voiceInput: 'Voice Input',
      voiceOutput: 'Read Aloud',
      startListening: 'Start Recording',
      stopListening: 'Stop Recording',
      readAloud: 'Read',
      stopReading: 'Stop',
      voiceNotSupported: 'Voice not supported in your browser',
      listening: 'Listening...',
      suggestions: [
        'Help me review today\'s lesson',
        'How to distinguish tones?',
        'Recommend reading materials for my level',
        'Help me prepare for HSK',
        'Explain this grammar point'
      ]
    },
    it: {
      title: '🤖 Assistente Intelligente',
      chat: 'Chat',
      profile: 'Il Mio Profilo',
      mistakes: 'Analisi Errori',
      materials: 'Raccomandati',
      practice: 'Pratica',
      greeting: "Ciao! Sono il tuo assistente AI. Ho analizzato la tua storia di apprendimento. Come posso aiutarti oggi?",
      inputPlaceholder: 'Scrivi la tua domanda...',
      send: 'Invia',
      currentLevel: 'Livello Attuale',
      vocabulary: 'Vocabolario',
      studyTime: 'Tempo Studio',
      streak: 'Serie',
      days: 'giorni',
      hours: 'ore',
      words: 'parole',
      skills: 'Valutazione Competenze',
      listening: 'Ascolto',
      speaking: 'Parlato',
      reading: 'Lettura',
      writing: 'Scrittura',
      grammar: 'Grammatica',
      strengths: 'I Tuoi Punti di Forza',
      weaknesses: 'Aree da Migliorare',
      aiSuggestions: 'Suggerimenti AI',
      mistakeType: 'Tipo Errore',
      occurrences: 'Occorrenze',
      lastOccurred: 'Ultima Volta',
      relatedWords: 'Parole Correlate',
      practiceNow: 'Pratica Ora',
      recommendedFor: 'Raccomandato perché',
      startLearning: 'Inizia',
      noMistakes: 'Ottimo! Nessun pattern di errore significativo',
      generatePlan: 'Genera Piano di Studio',
      askAbout: 'Puoi chiedermi:',
      suggestions: [
        'Aiutami a ripassare la lezione di oggi',
        'Come distinguere i toni?',
        'Raccomanda materiali per il mio livello',
        'Aiutami a preparare l\'HSK',
        'Spiega questo punto grammaticale'
      ]
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => {
    loadData();
    // 初始欢迎消息
    setMessages([{ role: 'assistant', content: t.greeting }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 加载学习画像
      let { data: profileData } = await supabase
        .from('student_learning_profiles')
        .select('*')
        .eq('student_id', user?.id)
        .single();

      if (!profileData) {
        // 创建默认画像
        const { data: newProfile } = await supabase
          .from('student_learning_profiles')
          .insert([{ student_id: user?.id }])
          .select()
          .single();
        profileData = newProfile;
      }
      setProfile(profileData);

      // 加载错误模式
      const { data: mistakesData } = await supabase
        .from('student_mistake_patterns')
        .select('*')
        .eq('student_id', user?.id)
        .eq('is_resolved', false)
        .order('occurrence_count', { ascending: false })
        .limit(10);
      setMistakes(mistakesData || []);

      // 加载推荐材料
      const { data: materialsData } = await supabase
        .from('teaching_materials')
        .select('*')
        .contains('hsk_levels', [profileData?.current_hsk_level || 1])
        .eq('is_active', true)
        .limit(6);
      setMaterials(materialsData || []);

      // 加载AI推荐
      const { data: recsData } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_completed', false)
        .order('priority', { ascending: false })
        .limit(5);
      setRecommendations(recsData || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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
        const ragResult = await ragService.query(userMessage, {
          topK: 3,
          hskLevels: profile?.current_hsk_level ? [profile.current_hsk_level] : null
        });
        ragChunks = ragResult.chunks;
        if (ragChunks.length > 0) {
          ragContext = `\n\n## 知识库参考资料\n${ragService.buildContext(ragChunks)}`;
        }
      }

      // 构建上下文
      const context = buildStudentContext();
      
      const systemPrompt = `你是"大卫学中文"平台的智能学习助手"小智"。你正在帮助一位中文学习者。

## 学生信息
${context}
${ragContext}

## 你的职责
1. 根据学生的学习历史和错误模式，提供个性化的学习建议
2. 解答中文学习问题（语法、词汇、发音等）
3. 如果有知识库参考资料，优先使用这些资料回答问题
4. 推荐适合学生水平的学习材料
5. 帮助复习和巩固已学内容
6. 鼓励和激励学生继续学习

## 回复要求
- 使用${language === 'zh' ? '中文' : language === 'it' ? '意大利语' : '英语'}回复
- 回复要友好、鼓励性
- 如果涉及中文教学，用简单易懂的方式解释
- 如果使用了知识库资料，可以简要提及来源
- 如果学生有特定的薄弱点，针对性地提供帮助
- 适当使用emoji让对话更生动`;

      const response = await aiService.chat([
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage }
      ]);

      const assistantMessage = response?.content || response;
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);

      // 保存对话历史
      await supabase.from('ai_agent_conversations').insert([
        { user_id: user?.id, agent_type: 'student_agent', session_id: sessionId, role: 'user', content: userMessage },
        { user_id: user?.id, agent_type: 'student_agent', session_id: sessionId, role: 'assistant', content: assistantMessage }
      ]);

    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: language === 'zh' ? '抱歉，我遇到了一些问题。请稍后再试。' : 'Sorry, I encountered an issue. Please try again.'
      }]);
    } finally {
      setSending(false);
    }
  };

  const buildStudentContext = () => {
    if (!profile) return '暂无学生数据';
    
    return `
- HSK等级: ${profile.current_hsk_level || 1}
- 预估词汇量: ${profile.estimated_vocabulary || 0}词
- 技能评估: 听力${profile.skill_listening}%, 口语${profile.skill_speaking}%, 阅读${profile.skill_reading}%, 写作${profile.skill_writing}%, 语法${profile.skill_grammar}%
- 优势: ${profile.strengths?.join(', ') || '待评估'}
- 薄弱点: ${profile.weaknesses?.join(', ') || '待评估'}
- 常见错误: ${mistakes.slice(0, 3).map(m => m.mistake_type).join(', ') || '无'}
- 连续学习: ${profile.streak_days || 0}天
- 总学习时间: ${profile.total_study_time || 0}分钟`;
  };

  // ==================== VOICE FUNCTIONS ====================
  
  // Text-to-Speech: Read text aloud in Chinese
  const speakText = (text) => {
    if (!synthRef.current) return;
    
    // Stop any current speech
    synthRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; // Chinese Mandarin
    utterance.rate = 0.9; // Slightly slower for learning
    utterance.pitch = 1;
    
    // Try to find a Chinese voice
    const voices = synthRef.current.getVoices();
    const chineseVoice = voices.find(v => v.lang.includes('zh')) || voices[0];
    if (chineseVoice) utterance.voice = chineseVoice;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthRef.current.speak(utterance);
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  // Speech-to-Text: Start listening
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(t.voiceNotSupported);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'zh-CN'; // Chinese
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onstart = () => setIsListening(true);
    
    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInput(transcript);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => setIsListening(false);

    recognitionRef.current.start();
  };

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Toggle voice input
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // ==================== END VOICE FUNCTIONS ====================

  const getSkillBar = (value) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: '8px', background: 'var(--background)', borderRadius: '4px' }}>
        <div style={{ 
          width: `${value}%`, 
          height: '100%', 
          background: value >= 80 ? 'var(--success)' : value >= 60 ? 'var(--warning)' : 'var(--error)',
          borderRadius: '4px',
          transition: 'width 0.3s'
        }} />
      </div>
      <span style={{ width: '40px', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600' }}>{value}%</span>
    </div>
  );

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
      </div>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          💬 {t.chat}
        </button>
        <button className={`tab ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          📊 {t.profile}
        </button>
        <button className={`tab ${activeTab === 'mistakes' ? 'active' : ''}`} onClick={() => setActiveTab('mistakes')}>
          ❌ {t.mistakes}
        </button>
        <button className={`tab ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
          📚 {t.materials}
        </button>
      </div>

      {/* 聊天界面 */}
      {activeTab === 'chat' && (
        <div className="card" style={{ height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' }}>
          {/* 消息列表 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
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
                  {/* Voice read button for assistant messages */}
                  {msg.role === 'assistant' && voiceEnabled && (
                    <button
                      onClick={() => isSpeaking ? stopSpeaking() : speakText(msg.content)}
                      style={{
                        display: 'block',
                        marginTop: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-muted)'
                      }}
                      title={isSpeaking ? t.stopReading : t.readAloud}
                    >
                      {isSpeaking ? '⏹️ ' + t.stopReading : '🔊 ' + t.readAloud}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '0.75rem 1rem', background: 'var(--background)', borderRadius: 'var(--radius-lg)' }}>
                  🤖 <span className="loading-dots">思考中...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 快捷建议 */}
          {messages.length <= 2 && (
            <div style={{ padding: '0 1rem 0.5rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t.askAbout}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {t.suggestions.slice(0, 3).map((s, idx) => (
                  <button 
                    key={idx} 
                    className="btn btn-outline btn-sm"
                    onClick={() => handleSuggestionClick(s)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 输入框 */}
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Voice input button */}
            <button 
              className={`btn ${isListening ? 'btn-error' : 'btn-outline'}`}
              onClick={toggleListening}
              style={{ padding: '0.5rem 0.75rem' }}
              title={isListening ? t.stopListening : t.startListening}
            >
              {isListening ? '⏹️' : '🎤'}
            </button>
            <input
              type="text"
              className="form-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder={isListening ? t.listening : t.inputPlaceholder}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={sendMessage} disabled={sending || !input.trim()}>
              {t.send}
            </button>
          </div>
        </div>
      )}

      {/* 学习画像 */}
      {activeTab === 'profile' && profile && (
        <div>
          {/* 基本统计 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--primary)' }}>HSK {profile.current_hsk_level || 1}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.currentLevel}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--success)' }}>{profile.estimated_vocabulary || 0}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.vocabulary}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--info)' }}>{Math.round((profile.total_study_time || 0) / 60)}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.studyTime} ({t.hours})</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--warning)' }}>🔥 {profile.streak_days || 0}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.streak}</div>
            </div>
          </div>

          {/* 技能评估 */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>📊 {t.skills}</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {['listening', 'speaking', 'reading', 'writing', 'grammar'].map(skill => (
                <div key={skill}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                    <span>{t[skill]}</span>
                  </div>
                  {getSkillBar(profile[`skill_${skill}`] || 50)}
                </div>
              ))}
            </div>
          </div>

          {/* 优劣势 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card">
              <h4 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>✅ {t.strengths}</h4>
              {profile.strengths?.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {profile.strengths.map((s, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{s}</li>)}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>继续学习，AI将分析你的优势</p>
              )}
            </div>
            <div className="card">
              <h4 style={{ color: 'var(--warning)', marginBottom: '0.5rem' }}>📈 {t.weaknesses}</h4>
              {profile.weaknesses?.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {profile.weaknesses.map((w, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{w}</li>)}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>继续学习，AI将发现需要加强的地方</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 错误分析 */}
      {activeTab === 'mistakes' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>❌ {t.mistakes}</h3>
          {mistakes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              {t.noMistakes}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {mistakes.map(mistake => (
                <div key={mistake.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <div>
                      <span className="badge badge-error">{mistake.mistake_type}</span>
                      {mistake.mistake_subtype && <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>{mistake.mistake_subtype}</span>}
                    </div>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {t.occurrences}: {mistake.occurrence_count}
                    </span>
                  </div>
                  {mistake.related_words?.length > 0 && (
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <strong>{t.relatedWords}:</strong> {mistake.related_words.join(', ')}
                    </div>
                  )}
                  {mistake.ai_suggestion && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      💡 {mistake.ai_suggestion}
                    </p>
                  )}
                  <button className="btn btn-primary btn-sm">{t.practiceNow}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 推荐材料 */}
      {activeTab === 'materials' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {materials.map(material => (
              <div key={material.id} className="card">
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '2rem' }}>
                    {material.material_type === 'video' ? '🎬' : 
                     material.material_type === 'audio' ? '🎧' : 
                     material.material_type === 'document' ? '📄' : 
                     material.material_type === 'game' ? '🎮' : '📚'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ marginBottom: '0.25rem' }}>{material.title_zh || material.title}</h4>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {material.hsk_levels?.map(l => (
                        <span key={l} className="badge badge-info">HSK{l}</span>
                      ))}
                      <span className="badge">{material.material_type}</span>
                    </div>
                  </div>
                </div>
                {material.description && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {material.description.substring(0, 100)}...
                  </p>
                )}
                <button className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                  {t.startLearning}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAIAgentPage;
