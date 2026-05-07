import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const PublicLearningSpace = () => {
  const { user, supabase } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('community');
  const [materials, setMaterials] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [posts, setPosts] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const [postForm, setPostForm] = useState({ title: '', content: '', category: 'discussion' });
  const [questionForm, setQuestionForm] = useState({ question: '', category: 'grammar' });
  const [reportForm, setReportForm] = useState({ reason: '', details: '' });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const loadData = async () => {
    try {
      if (supabase) {
        const [materialsRes, questionsRes, postsRes] = await Promise.all([
          supabase.from('dwxz_materials').select('*').eq('is_active', true).eq('share_type', 'public'),
          supabase.from('dwxz_qa_questions').select('*, author:users(name, name_zh)').eq('is_active', true),
          supabase.from('dwxz_public_posts').select('*, author:users(name, name_zh)').eq('is_active', true).order('created_at', { ascending: false })
        ]);
        setMaterials(materialsRes.data || []);
        setQuestions(questionsRes.data || []);
        setPosts(postsRes.data || []);
      }
      // Set default games
      setGames([
        { id: 'character_match', name: '汉字配对', name_en: 'Character Match', name_it: 'Abbina Caratteri', description: 'Match Chinese characters with meanings', hsk_levels: [1,2,3] },
        { id: 'pinyin_race', name: '拼音竞赛', name_en: 'Pinyin Race', name_it: 'Gara Pinyin', description: 'Test your pinyin knowledge', hsk_levels: [1,2,3,4] },
        { id: 'sentence_builder', name: '造句游戏', name_en: 'Sentence Builder', name_it: 'Costruisci Frasi', description: 'Build correct sentences', hsk_levels: [2,3,4,5] },
        { id: 'tone_trainer', name: '声调训练', name_en: 'Tone Trainer', name_it: 'Allenamento Toni', description: 'Practice the four tones', hsk_levels: [1,2] },
        { id: 'stroke_order', name: '笔画练习', name_en: 'Stroke Order', name_it: 'Ordine Tratti', description: 'Learn correct stroke order', hsk_levels: [1,2,3] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // AI Community Helper
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await api.post('/ai/chat', { 
        message: chatInput,
        context: 'community_helper'
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: language === 'zh' ? '我可以帮助你找到学习资料、回答问题、推荐游戏等。请问有什么需要帮助的？' : 
                 'I can help you find learning materials, answer questions, recommend games, and more. How can I help?'
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Submit Post
  const handleSubmitPost = async (e) => {
    e.preventDefault();
    try {
      await api.post('/public/posts', { ...postForm, author_id: user.id });
      setShowPostModal(false);
      setPostForm({ title: '', content: '', category: 'discussion' });
      loadData();
    } catch (error) {
      alert('Failed to submit post');
    }
  };

  // Submit Question
  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    try {
      await api.post('/public/questions', { ...questionForm, author_id: user.id });
      setShowQuestionModal(false);
      setQuestionForm({ question: '', category: 'grammar' });
      loadData();
    } catch (error) {
      alert('Failed to submit question');
    }
  };

  // Report Content
  const handleReport = async (e) => {
    e.preventDefault();
    try {
      await api.post('/reports/content', {
        content_type: showReportModal.type,
        content_id: showReportModal.id,
        reporter_id: user.id,
        reason: reportForm.reason,
        details: reportForm.details
      });
      setShowReportModal(null);
      setReportForm({ reason: '', details: '' });
      alert(language === 'zh' ? '举报已提交，感谢您的反馈！' : 'Report submitted. Thank you for your feedback!');
    } catch (error) {
      alert('Failed to submit report');
    }
  };

  const texts = {
    zh: {
      title: '公共学习空间',
      community: '学习社区',
      materials: '学习资料',
      games: '学习游戏',
      qa: '问答中心',
      ai_helper: '智能小助手',
      new_post: '发帖',
      new_question: '提问',
      download: '下载',
      play: '开始游戏',
      ask_ai: '问问智能小助手...',
      ai_greeting: '你好！我是公共学习空间的智能小助手 🤖\n\n我可以帮你：\n• 推荐学习资料\n• 回答中文学习问题\n• 推荐适合你的游戏\n• 组织和搜索社区内容\n\n有什么需要帮助的吗？',
      post_title: '帖子标题',
      post_content: '帖子内容',
      category: '分类',
      discussion: '讨论',
      study_tips: '学习技巧',
      resource_share: '资源分享',
      question_placeholder: '输入你的问题...',
      grammar: '语法',
      vocabulary: '词汇',
      pronunciation: '发音',
      culture: '文化',
      report: '举报',
      report_content: '举报内容',
      report_reason: '举报原因',
      inappropriate: '不当内容',
      spam: '垃圾信息',
      harassment: '骚扰',
      other: '其他',
      report_details: '详细说明',
      submit_report: '提交举报',
      no_posts: '暂无帖子',
      no_questions: '暂无问题',
      no_materials: '暂无资料',
      views: '浏览',
      answers: '回答',
      likes: '赞'
    },
    en: {
      title: 'Public Learning Space',
      community: 'Community',
      materials: 'Learning Materials',
      games: 'Learning Games',
      qa: 'Q&A Center',
      ai_helper: 'Smart Helper',
      new_post: 'New Post',
      new_question: 'Ask Question',
      download: 'Download',
      play: 'Play',
      ask_ai: 'Ask the Smart Helper...',
      ai_greeting: 'Hello! I\'m the Smart Helper for the Public Learning Space 🤖\n\nI can help you:\n• Recommend learning materials\n• Answer Chinese learning questions\n• Suggest games for your level\n• Organize and search community content\n\nHow can I help you?',
      post_title: 'Post Title',
      post_content: 'Post Content',
      category: 'Category',
      discussion: 'Discussion',
      study_tips: 'Study Tips',
      resource_share: 'Resource Sharing',
      question_placeholder: 'Enter your question...',
      grammar: 'Grammar',
      vocabulary: 'Vocabulary',
      pronunciation: 'Pronunciation',
      culture: 'Culture',
      report: 'Report',
      report_content: 'Report Content',
      report_reason: 'Reason',
      inappropriate: 'Inappropriate Content',
      spam: 'Spam',
      harassment: 'Harassment',
      other: 'Other',
      report_details: 'Details',
      submit_report: 'Submit Report',
      no_posts: 'No posts yet',
      no_questions: 'No questions yet',
      no_materials: 'No materials yet',
      views: 'views',
      answers: 'answers',
      likes: 'likes'
    },
    it: {
      title: 'Spazio Pubblico di Apprendimento',
      community: 'Comunità',
      materials: 'Materiali di Studio',
      games: 'Giochi Educativi',
      qa: 'Domande e Risposte',
      ai_helper: 'Assistente Intelligente',
      new_post: 'Nuovo Post',
      new_question: 'Fai Domanda',
      download: 'Scarica',
      play: 'Gioca',
      ask_ai: 'Chiedi all\'Assistente Intelligente...',
      ai_greeting: 'Ciao! Sono l\'Assistente Intelligente dello Spazio Pubblico 🤖\n\nPosso aiutarti a:\n• Consigliare materiali di studio\n• Rispondere a domande sul cinese\n• Suggerire giochi per il tuo livello\n• Organizzare e cercare contenuti della comunità\n\nCome posso aiutarti?',
      post_title: 'Titolo Post',
      post_content: 'Contenuto Post',
      category: 'Categoria',
      discussion: 'Discussione',
      study_tips: 'Consigli di Studio',
      resource_share: 'Condivisione Risorse',
      question_placeholder: 'Inserisci la tua domanda...',
      grammar: 'Grammatica',
      vocabulary: 'Vocabolario',
      pronunciation: 'Pronuncia',
      culture: 'Cultura',
      report: 'Segnala',
      report_content: 'Segnala Contenuto',
      report_reason: 'Motivo',
      inappropriate: 'Contenuto Inappropriato',
      spam: 'Spam',
      harassment: 'Molestie',
      other: 'Altro',
      report_details: 'Dettagli',
      submit_report: 'Invia Segnalazione',
      no_posts: 'Nessun post',
      no_questions: 'Nessuna domanda',
      no_materials: 'Nessun materiale',
      views: 'visualizzazioni',
      answers: 'risposte',
      likes: 'mi piace'
    }
  };

  const txt = texts[language] || texts.en;

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header">
        <h1>🌐 {txt.title}</h1>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'community' ? 'active' : ''}`} onClick={() => setActiveTab('community')}>
          👥 {txt.community}
        </button>
        <button className={`tab ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
          📚 {txt.materials}
        </button>
        <button className={`tab ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>
          🎮 {txt.games}
        </button>
        <button className={`tab ${activeTab === 'qa' ? 'active' : ''}`} onClick={() => setActiveTab('qa')}>
          ❓ {txt.qa}
        </button>
        <button className={`tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
          🤖 {txt.ai_helper}
        </button>
      </div>

      {/* Community Posts */}
      {activeTab === 'community' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setShowPostModal(true)}>
              + {txt.new_post}
            </button>
          </div>
          
          {posts.length > 0 ? (
            <div>
              {posts.map((post, idx) => (
                <div key={idx} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h3>{post.title}</h3>
                      <span className="badge badge-info">{post.category}</span>
                    </div>
                    <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={() => setShowReportModal({ type: 'post', id: post.id })}>
                      🚩 {txt.report}
                    </button>
                  </div>
                  <p style={{ margin: '1rem 0' }}>{post.content}</p>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    <span>👤 {post.author_name}</span>
                    <span>👁️ {post.views || 0} {txt.views}</span>
                    <span>❤️ {post.likes || 0} {txt.likes}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <span style={{ fontSize: '4rem' }}>👥</span>
                <p>{txt.no_posts}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Public Materials */}
      {activeTab === 'materials' && (
        <div>
          {materials.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {materials.map((material, idx) => (
                <div key={idx} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <span style={{ fontSize: '2rem' }}>
                      {material.type === 'video' ? '🎬' : material.type === 'audio' ? '🎵' : material.type === 'ppt' ? '📊' : '📄'}
                    </span>
                    <span className="badge badge-primary">HSK {material.hsk_level}</span>
                  </div>
                  <h3 style={{ marginTop: '0.5rem' }}>
                    {language === 'zh' && material.title_zh ? material.title_zh : material.title}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{material.description}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    {material.file_path && (
                      <a href={`/uploads/${material.file_path}`} className="btn btn-primary btn-sm">
                        ⬇️ {txt.download}
                      </a>
                    )}
                    <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={() => setShowReportModal({ type: 'material', id: material.id })}>
                      🚩
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <span style={{ fontSize: '4rem' }}>📚</span>
                <p>{txt.no_materials}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Learning Games */}
      {activeTab === 'games' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {games.map((game, idx) => (
            <div key={idx} className="card" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '4rem' }}>
                {game.id === 'character_match' ? '🀄' : 
                 game.id === 'pinyin_race' ? '🏃' : 
                 game.id === 'sentence_builder' ? '📝' : 
                 game.id === 'tone_trainer' ? '🎵' : '✍️'}
              </span>
              <h3 style={{ marginTop: '0.5rem' }}>
                {language === 'zh' ? game.name : language === 'it' ? game.name_it : game.name_en}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{game.description}</p>
              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', margin: '0.5rem 0' }}>
                {game.hsk_levels?.map(level => (
                  <span key={level} className="badge badge-primary">HSK {level}</span>
                ))}
              </div>
              <button className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                🎮 {txt.play}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Q&A Center */}
      {activeTab === 'qa' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setShowQuestionModal(true)}>
              + {txt.new_question}
            </button>
          </div>

          {questions.length > 0 ? (
            <div>
              {questions.map((q, idx) => (
                <div key={idx} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h3>❓ {q.question}</h3>
                      <span className="badge badge-info">{q.category}</span>
                    </div>
                    <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={() => setShowReportModal({ type: 'question', id: q.id })}>
                      🚩
                    </button>
                  </div>
                  {q.answer && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--background)', borderRadius: '0.5rem' }}>
                      <strong>💡 Answer:</strong>
                      <p>{q.answer}</p>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    <span>👤 {q.author_name}</span>
                    <span>💬 {q.answer_count || 0} {txt.answers}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <span style={{ fontSize: '4rem' }}>❓</span>
                <p>{txt.no_questions}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 智能 Helper */}
      {activeTab === 'ai' && (
        <div className="card">
          <div className="chat-container" style={{ height: '450px' }}>
            <div className="chat-messages" style={{ height: '380px', overflowY: 'auto', padding: '1rem', background: 'var(--background)', borderRadius: '0.5rem' }}>
              {chatMessages.length === 0 && (
                <div className="chat-message assistant">
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{txt.ai_greeting}</pre>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}`}>
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
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <input
                type="text"
                className="form-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                placeholder={txt.ask_ai}
              />
              <button className="btn btn-primary" onClick={sendChatMessage} disabled={chatLoading}>
                {language === 'zh' ? '发送' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Post Modal */}
      {showPostModal && (
        <div className="modal-overlay" onClick={() => setShowPostModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{txt.new_post}</h3>
              <button onClick={() => setShowPostModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmitPost}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{txt.post_title}</label>
                  <input type="text" className="form-input" value={postForm.title} onChange={e => setPostForm({...postForm, title: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{txt.category}</label>
                  <select className="form-select" value={postForm.category} onChange={e => setPostForm({...postForm, category: e.target.value})}>
                    <option value="discussion">{txt.discussion}</option>
                    <option value="study_tips">{txt.study_tips}</option>
                    <option value="resource_share">{txt.resource_share}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{txt.post_content}</label>
                  <textarea className="form-textarea" value={postForm.content} onChange={e => setPostForm({...postForm, content: e.target.value})} rows={5} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowPostModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('submit')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Question Modal */}
      {showQuestionModal && (
        <div className="modal-overlay" onClick={() => setShowQuestionModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{txt.new_question}</h3>
              <button onClick={() => setShowQuestionModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmitQuestion}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{txt.category}</label>
                  <select className="form-select" value={questionForm.category} onChange={e => setQuestionForm({...questionForm, category: e.target.value})}>
                    <option value="grammar">{txt.grammar}</option>
                    <option value="vocabulary">{txt.vocabulary}</option>
                    <option value="pronunciation">{txt.pronunciation}</option>
                    <option value="culture">{txt.culture}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">❓ {language === 'zh' ? '你的问题' : 'Your Question'}</label>
                  <textarea className="form-textarea" value={questionForm.question} onChange={e => setQuestionForm({...questionForm, question: e.target.value})} rows={4} required placeholder={txt.question_placeholder} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowQuestionModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('submit')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🚩 {txt.report_content}</h3>
              <button onClick={() => setShowReportModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleReport}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{txt.report_reason}</label>
                  <select className="form-select" value={reportForm.reason} onChange={e => setReportForm({...reportForm, reason: e.target.value})} required>
                    <option value="">{language === 'zh' ? '请选择原因' : 'Select reason'}</option>
                    <option value="inappropriate">{txt.inappropriate}</option>
                    <option value="spam">{txt.spam}</option>
                    <option value="harassment">{txt.harassment}</option>
                    <option value="other">{txt.other}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{txt.report_details}</label>
                  <textarea className="form-textarea" value={reportForm.details} onChange={e => setReportForm({...reportForm, details: e.target.value})} rows={3} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowReportModal(null)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--error)' }}>🚩 {txt.submit_report}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicLearningSpace;
