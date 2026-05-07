import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';

const AILearningAgent = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('chat');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [experiences, setExperiences] = useState([]);
  const [tips, setTips] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareForm, setShareForm] = useState({ title: '', content: '', category: 'teaching', tags: '' });
  const messagesEndRef = useRef(null);

  // Conversation modes (模型由超级管理员统一配置)
  const conversationModes = [
    { id: 'general', name: { zh: '通用助手', en: 'General Assistant', it: 'Assistente Generale' }, icon: '💬' },
    { id: 'teaching', name: { zh: '教学指导', en: 'Teaching Guide', it: 'Guida Didattica' }, icon: '👨‍🏫' },
    { id: 'learning', name: { zh: '学习辅导', en: 'Learning Tutor', it: 'Tutor di Studio' }, icon: '📚' },
    { id: 'pronunciation', name: { zh: '发音纠正', en: 'Pronunciation Coach', it: 'Coach Pronuncia' }, icon: '🎤' },
    { id: 'writing', name: { zh: '写作帮助', en: 'Writing Help', it: 'Aiuto Scrittura' }, icon: '✍️' },
    { id: 'culture', name: { zh: '文化知识', en: 'Cultural Knowledge', it: 'Conoscenza Culturale' }, icon: '📖' }
  ];

  const [conversationMode, setConversationMode] = useState('general');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const loadData = async () => {
    try {
      const [experiencesRes, tipsRes] = await Promise.all([
        api.get('/ai-agent/experiences'),
        api.get('/ai-agent/tips')
      ]);
      setExperiences(experiencesRes.data.experiences || []);
      setTips(tipsRes.data.tips || []);
    } catch (error) {
      // Set default data
      setExperiences([
        { id: 1, author: '王老师', role: 'teacher', title: '如何让学生记住声调', content: '我发现用颜色标记声调很有效...', category: 'teaching', likes: 24, created_at: new Date() },
        { id: 2, author: 'Marco', role: 'student', title: 'My HSK 4 Journey', content: 'I passed HSK 4 after 2 years of study...', category: 'learning', likes: 18, created_at: new Date() }
      ]);
      setTips([
        { id: 1, tip: '每天学习15分钟比一周学习2小时更有效', tip_en: '15 minutes daily is better than 2 hours weekly', category: 'learning' },
        { id: 2, tip: '用手机把生词设为壁纸，随时复习', tip_en: 'Set new words as phone wallpaper for constant review', category: 'learning' }
      ]);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await api.post('/ai-agent/chat', {
        message: chatInput,
        model: selectedModel,
        mode: conversationMode,
        user_role: user?.role,
        history: chatMessages.slice(-10)
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.data.response, model: selectedModel }]);
    } catch (error) {
      // Simulate response for demo
      const modeResponses = {
        general: language === 'zh' ? `我是你的智能学习助手，使用${selectedModel}模型。有什么我可以帮助你的吗？` : `I'm your AI learning assistant using ${selectedModel}. How can I help?`,
        teaching: language === 'zh' ? '作为教学指导，我建议您在课堂上多使用互动活动...' : 'As a teaching guide, I suggest using more interactive activities...',
        learning: language === 'zh' ? '学习中文需要持续练习。让我帮你制定一个学习计划...' : 'Learning Chinese requires consistent practice. Let me help you create a study plan...',
        pronunciation: language === 'zh' ? '发音练习很重要！让我们从声调开始...' : 'Pronunciation practice is crucial! Let\'s start with tones...',
        writing: language === 'zh' ? '写作需要多练习。我可以帮你修改文章或提供写作建议...' : 'Writing needs practice. I can help revise your text or provide suggestions...',
        culture: language === 'zh' ? '中国文化博大精深！你想了解哪方面的知识？' : 'Chinese culture is vast! What aspect would you like to learn about?'
      };
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: modeResponses[conversationMode] || modeResponses.general,
        model: selectedModel 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleShareExperience = async (e) => {
    e.preventDefault();
    try {
      await api.post('/ai-agent/experiences', {
        ...shareForm,
        author_id: user.id,
        author_name: user.name,
        author_role: user.role
      });
      setShowShareModal(false);
      setShareForm({ title: '', content: '', category: 'teaching', tags: '' });
      loadData();
    } catch (error) {
      // Demo: add locally
      setExperiences(prev => [{
        id: Date.now(),
        author: user.name,
        role: user.role,
        title: shareForm.title,
        content: shareForm.content,
        category: shareForm.category,
        likes: 0,
        created_at: new Date()
      }, ...prev]);
      setShowShareModal(false);
      setShareForm({ title: '', content: '', category: 'teaching', tags: '' });
    }
  };

  const likeExperience = async (id) => {
    setExperiences(prev => prev.map(exp => 
      exp.id === id ? { ...exp, likes: (exp.likes || 0) + 1 } : exp
    ));
  };

  const texts = {
    zh: {
      title: '智能学习助手',
      subtitle: '提升教学与学习技能，分享经验',
      chat: '智能对话',
      experiences: '经验分享',
      tips: '学习技巧',
      model_settings: '模型设置',
      select_model: '选择模型',
      conversation_mode: '对话模式',
      share_experience: '分享经验',
      experience_title: '标题',
      experience_content: '内容',
      category: '分类',
      teaching: '教学经验',
      learning: '学习心得',
      culture: '文化分享',
      tips_category: '技巧分享',
      tags: '标签',
      submit: '发布',
      likes: '点赞',
      no_experiences: '暂无经验分享',
      type_message: '输入你的问题...',
      ai_greeting: '你好！我是智能学习助手 🤖\n\n我可以帮助你：\n• 改进教学方法\n• 提供学习建议\n• 纠正发音\n• 帮助写作\n• 分享文化知识\n\n请选择对话模式和模型，然后开始对话！',
      model_info: '不同模型有不同特点，可根据需求选择',
      daily_tip: '每日学习技巧'
    },
    en: {
      title: 'Smart Learning Agent',
      subtitle: 'Improve teaching & learning skills, share experiences',
      chat: 'Smart Chat',
      experiences: 'Shared Experiences',
      tips: 'Learning Tips',
      model_settings: 'Model Settings',
      select_model: 'Select Model',
      conversation_mode: 'Conversation Mode',
      share_experience: 'Share Experience',
      experience_title: 'Title',
      experience_content: 'Content',
      category: 'Category',
      teaching: 'Teaching Experience',
      learning: 'Learning Insights',
      culture: 'Cultural Sharing',
      tips_category: 'Tips & Tricks',
      tags: 'Tags',
      submit: 'Submit',
      likes: 'likes',
      no_experiences: 'No experiences shared yet',
      type_message: 'Type your message...',
      ai_greeting: 'Hello! I\'m the Smart Learning Agent 🤖\n\nI can help you:\n• Improve teaching methods\n• Provide learning advice\n• Correct pronunciation\n• Help with writing\n• Share cultural knowledge\n\nSelect a conversation mode and model to get started!',
      model_info: 'Different models have different strengths',
      daily_tip: 'Daily Learning Tip'
    },
    it: {
      title: 'Agente Intelligente di Apprendimento',
      subtitle: 'Migliora le competenze didattiche e di apprendimento',
      chat: 'Chat Intelligente',
      experiences: 'Esperienze Condivise',
      tips: 'Consigli di Studio',
      model_settings: 'Impostazioni Modello',
      select_model: 'Seleziona Modello',
      conversation_mode: 'Modalità Conversazione',
      share_experience: 'Condividi Esperienza',
      experience_title: 'Titolo',
      experience_content: 'Contenuto',
      category: 'Categoria',
      teaching: 'Esperienza Didattica',
      learning: 'Riflessioni di Studio',
      culture: 'Condivisione Culturale',
      tips_category: 'Trucchi e Consigli',
      tags: 'Tag',
      submit: 'Pubblica',
      likes: 'mi piace',
      no_experiences: 'Nessuna esperienza condivisa',
      type_message: 'Scrivi il tuo messaggio...',
      ai_greeting: 'Ciao! Sono l\'Agente AI di Apprendimento 🤖\n\nPosso aiutarti a:\n• Migliorare i metodi didattici\n• Fornire consigli di studio\n• Correggere la pronuncia\n• Aiutare con la scrittura\n• Condividere conoscenze culturali\n\nSeleziona una modalità e un modello AI per iniziare!',
      model_info: 'Modelli diversi hanno punti di forza diversi',
      daily_tip: 'Consiglio del Giorno'
    }
  };

  const txt = texts[language] || texts.en;

  return (
    <div>
      <div className="content-header">
        <h1>🤖 {txt.title}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{txt.subtitle}</p>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          💬 {txt.chat}
        </button>
        <button className={`tab ${activeTab === 'experiences' ? 'active' : ''}`} onClick={() => setActiveTab('experiences')}>
          📖 {txt.experiences}
        </button>
        <button className={`tab ${activeTab === 'tips' ? 'active' : ''}`} onClick={() => setActiveTab('tips')}>
          💡 {txt.tips}
        </button>
        <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ {txt.model_settings}
        </button>
      </div>

      {/* AI Chat */}
      {activeTab === 'chat' && (
        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '1rem' }}>
          {/* Sidebar - Mode Selection */}
          <div className="card" style={{ height: 'fit-content' }}>
            <h4 style={{ marginBottom: '1rem' }}>{txt.conversation_mode}</h4>
            {conversationModes.map(mode => (
              <button
                key={mode.id}
                onClick={() => setConversationMode(mode.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  border: conversationMode === mode.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  background: conversationMode === mode.id ? 'rgba(196,30,58,0.1)' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{mode.icon}</span>
                <span>{mode.name[language] || mode.name.en}</span>
              </button>
            ))}

            <hr style={{ margin: '1rem 0' }} />

            <h4 style={{ marginBottom: '0.5rem' }}>{txt.select_model}</h4>
            <select 
              className="form-select" 
              value={selectedModel} 
              onChange={e => setSelectedModel(e.target.value)}
            >
              {aiModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.icon} {model.name}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {aiModels.find(m => m.id === selectedModel)?.description[language] || aiModels.find(m => m.id === selectedModel)?.description.en}
            </p>
          </div>

          {/* Chat Area */}
          <div className="card">
            <div className="chat-messages" style={{ height: '400px', overflowY: 'auto', padding: '1rem', background: 'var(--background)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              {chatMessages.length === 0 && (
                <div className="chat-message assistant">
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{txt.ai_greeting}</pre>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}`}>
                  {msg.role === 'assistant' && msg.model && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                      {aiModels.find(m => m.id === msg.model)?.icon} {msg.model}
                    </span>
                  )}
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{msg.content}</pre>
                </div>
              ))}
              {chatLoading && (
                <div className="chat-message assistant">
                  <span className="loading-spinner" style={{ width: '20px', height: '20px' }}></span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendMessage()}
                placeholder={txt.type_message}
              />
              <button className="btn btn-primary" onClick={sendMessage} disabled={chatLoading}>
                {language === 'zh' ? '发送' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Experiences */}
      {activeTab === 'experiences' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setShowShareModal(true)}>
              + {txt.share_experience}
            </button>
          </div>

          {experiences.length > 0 ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {experiences.map(exp => (
                <div key={exp.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h3>{exp.title}</h3>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span className="badge badge-info">{txt[exp.category] || exp.category}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                          👤 {exp.author} ({t(`roles.${exp.role}`)})
                        </span>
                      </div>
                    </div>
                    <button 
                      className="btn btn-outline btn-sm" 
                      onClick={() => likeExperience(exp.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      ❤️ {exp.likes || 0}
                    </button>
                  </div>
                  <p style={{ marginTop: '1rem', lineHeight: '1.6' }}>{exp.content}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {new Date(exp.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <span style={{ fontSize: '4rem' }}>📖</span>
                <p>{txt.no_experiences}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Learning Tips */}
      {activeTab === 'tips' && (
        <div>
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary), #8B0000)', color: 'white', marginBottom: '1rem' }}>
            <h3>💡 {txt.daily_tip}</h3>
            <p style={{ fontSize: '1.25rem', marginTop: '0.5rem' }}>
              {tips[0]?.tip || '每天学习一点点，进步看得见！'}
            </p>
            {tips[0]?.tip_en && language !== 'zh' && (
              <p style={{ fontSize: '1rem', opacity: 0.9, marginTop: '0.25rem' }}>{tips[0].tip_en}</p>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {tips.slice(1).map((tip, idx) => (
              <div key={idx} className="card">
                <span style={{ fontSize: '2rem' }}>💡</span>
                <p style={{ marginTop: '0.5rem', fontWeight: '500' }}>{tip.tip}</p>
                {tip.tip_en && language !== 'zh' && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{tip.tip_en}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Settings */}
      {activeTab === 'settings' && (
        <div>
          <div className="card">
            <h3>{txt.select_model}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>{txt.model_info}</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {aiModels.map(model => (
                <div 
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  style={{
                    padding: '1.5rem',
                    border: selectedModel === model.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                    borderRadius: '0.75rem',
                    cursor: 'pointer',
                    background: selectedModel === model.id ? 'rgba(196,30,58,0.05)' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '2rem' }}>{model.icon}</span>
                    <div>
                      <h4>{model.name}</h4>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {model.description[language] || model.description.en}
                      </p>
                    </div>
                  </div>
                  {selectedModel === model.id && (
                    <span className="badge badge-success" style={{ marginTop: '0.75rem' }}>
                      ✓ {language === 'zh' ? '已选择' : 'Selected'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share Experience Modal */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{txt.share_experience}</h3>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleShareExperience}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{txt.experience_title}</label>
                  <input type="text" className="form-input" value={shareForm.title} onChange={e => setShareForm({...shareForm, title: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{txt.category}</label>
                  <select className="form-select" value={shareForm.category} onChange={e => setShareForm({...shareForm, category: e.target.value})}>
                    <option value="teaching">{txt.teaching}</option>
                    <option value="learning">{txt.learning}</option>
                    <option value="culture">{txt.culture}</option>
                    <option value="tips">{txt.tips_category}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{txt.experience_content}</label>
                  <textarea className="form-textarea" value={shareForm.content} onChange={e => setShareForm({...shareForm, content: e.target.value})} rows={5} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{txt.tags}</label>
                  <input type="text" className="form-input" value={shareForm.tags} onChange={e => setShareForm({...shareForm, tags: e.target.value})} placeholder="HSK, 发音, 语法..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowShareModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{txt.submit}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AILearningAgent;
