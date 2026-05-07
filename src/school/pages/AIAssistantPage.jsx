import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { aiAPI } from '../services/api';

const AIAssistantPage = () => {
  const { user, isTeacher, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState([]);
  const [showPPTModal, setShowPPTModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [pptData, setPptData] = useState({ topic: '', hsk_level: 1, slides_count: 10 });
  const [quizData, setQuizData] = useState({ topic: '', hsk_level: 1, question_count: 10 });
  const [generatedContent, setGeneratedContent] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { loadGames(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadGames = async () => {
    try {
      const response = await aiAPI.getGames();
      setGames(response.data.games || []);
    } catch (error) {
      console.error('Failed to load games:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    const userMessage = { role: 'user', content: inputMessage };
    setMessages([...messages, userMessage]);
    setInputMessage('');
    setLoading(true);
    try {
      const response = await aiAPI.chat({ message: inputMessage });
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, an error occurred' }]);
    } finally {
      setLoading(false);
    }
  };

  const generatePPT = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await aiAPI.generatePPT(pptData);
      setGeneratedContent({ type: 'ppt', data: response.data });
      setShowPPTModal(false);
    } catch (error) {
      alert('Failed to generate PPT');
    } finally {
      setLoading(false);
    }
  };

  const generateQuiz = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await aiAPI.generateQuiz(quizData);
      setGeneratedContent({ type: 'quiz', data: response.data });
      setShowQuizModal(false);
    } catch (error) {
      alert('Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="content-header">
        <h1>{t('ai.title')} 🤖</h1>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>💬 {t('ai.chat')}</button>
        {(isTeacher || isAdmin) && (
          <button className={`tab ${activeTab === 'generate' ? 'active' : ''}`} onClick={() => setActiveTab('generate')}>✨ {language === 'zh' ? '生成内容' : 'Generate'}</button>
        )}
        <button className={`tab ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>🎮 {t('ai.games')}</button>
      </div>

      {activeTab === 'chat' && (
        <div className="card">
          <div className="chat-container">
            <div className="chat-messages">
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '4rem' }}>🤖</span>
                  <p>{language === 'zh' ? '你好！我是你的中文学习助手。' : 'Hello! I\'m your Chinese learning assistant.'}</p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}`}>
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{msg.content}</pre>
                </div>
              ))}
              {loading && <div className="chat-message assistant"><span className="loading-spinner" style={{ width: '20px', height: '20px' }}></span></div>}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="chat-input-area">
              <input type="text" className="form-input" value={inputMessage} onChange={e => setInputMessage(e.target.value)} placeholder={language === 'zh' ? '输入你的问题...' : 'Type your question...'} disabled={loading} />
              <button type="submit" className="btn btn-primary" disabled={loading || !inputMessage.trim()}>{language === 'zh' ? '发送' : 'Send'}</button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'generate' && (isTeacher || isAdmin) && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '4rem' }}>📊</span>
              <h3>{t('ai.generate_ppt')}</h3>
              <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>{language === 'zh' ? '自动生成教学PPT' : 'Auto-generate teaching slides'}</p>
              <button className="btn btn-primary" onClick={() => setShowPPTModal(true)}>{language === 'zh' ? '开始生成' : 'Generate'}</button>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '4rem' }}>❓</span>
              <h3>{t('ai.generate_quiz')}</h3>
              <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>{language === 'zh' ? '自动生成测验题目' : 'Auto-generate quiz questions'}</p>
              <button className="btn btn-primary" onClick={() => setShowQuizModal(true)}>{language === 'zh' ? '开始生成' : 'Generate'}</button>
            </div>
          </div>
          {generatedContent && (
            <div className="card" style={{ marginTop: '1.5rem' }}>
              <div className="card-header">
                <h3>{generatedContent.type === 'ppt' ? '📊 Generated PPT' : '❓ Generated Quiz'}</h3>
                <button className="btn btn-sm btn-outline" onClick={() => setGeneratedContent(null)}>×</button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--background)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                {JSON.stringify(generatedContent.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {activeTab === 'games' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {games.map(game => (
            <div key={game.id} className="card">
              <h3>{game.name}</h3>
              <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0' }}>{game.description}</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {game.hsk_levels?.map(level => <span key={level} className="badge badge-primary">HSK {level}</span>)}
              </div>
              <button className="btn btn-primary">🎮 {language === 'zh' ? '开始游戏' : 'Play'}</button>
            </div>
          ))}
        </div>
      )}

      {showPPTModal && (
        <div className="modal-overlay" onClick={() => setShowPPTModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{t('ai.generate_ppt')}</h3><button onClick={() => setShowPPTModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={generatePPT}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">{language === 'zh' ? '主题' : 'Topic'} *</label><input type="text" className="form-input" value={pptData.topic} onChange={e => setPptData({...pptData, topic: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">HSK Level</label><select className="form-select" value={pptData.hsk_level} onChange={e => setPptData({...pptData, hsk_level: e.target.value})}>{[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}</select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowPPTModal(false)}>{t('cancel')}</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? t('loading') : 'Generate'}</button></div>
            </form>
          </div>
        </div>
      )}

      {showQuizModal && (
        <div className="modal-overlay" onClick={() => setShowQuizModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{t('ai.generate_quiz')}</h3><button onClick={() => setShowQuizModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button></div>
            <form onSubmit={generateQuiz}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">{language === 'zh' ? '主题' : 'Topic'} *</label><input type="text" className="form-input" value={quizData.topic} onChange={e => setQuizData({...quizData, topic: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">HSK Level</label><select className="form-select" value={quizData.hsk_level} onChange={e => setQuizData({...quizData, hsk_level: e.target.value})}>{[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}</select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowQuizModal(false)}>{t('cancel')}</button><button type="submit" className="btn btn-primary" disabled={loading}>{loading ? t('loading') : 'Generate'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistantPage;
