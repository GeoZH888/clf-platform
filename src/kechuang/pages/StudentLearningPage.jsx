import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { homeworkAPI, reportsAPI } from '../services/api';
import api from '../services/api';

const StudentLearningPage = () => {
  const { user, updateProfile } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('helper');
  const [tabOrder, setTabOrder] = useState(['helper','homework','materials','reports']);
  const dragTabIdx  = React.useRef(null);
  const dragOverIdx = React.useRef(null);

  const TAB_LABELS = {
    helper:    { icon:'🎓', zh:'学习小助手', en:'Assistant'  },
    homework:  { icon:'📝', zh:'我的作业',   en:'Homework'   },
    materials: { icon:'📚', zh:'学习资料',   en:'Materials'  },
    reports:   { icon:'📊', zh:'学习报告',   en:'Reports'    },
  };
  const [homework, setHomework] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHomeworkModal, setShowHomeworkModal] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    preferred_language: user?.preferred_language || 'zh'
  });

  const [homeworkSubmission, setHomeworkSubmission] = useState({
    content: '',
    file: null,
    voice: null
  });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const loadData = async () => {
    try {
      const [homeworkRes, materialsRes, reportsRes] = await Promise.all([
        homeworkAPI.getAll(),
        api.get('/materials/student'),
        reportsAPI.getAll({ student_id: user.id })
      ]);
      setHomework(homeworkRes.data.homework || []);
      setMaterials(materialsRes.data.materials || []);
      setReports(reportsRes.data.reports || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Learning Helper Chat
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await api.post('/ai/chat', { 
        message: chatInput,
        context: 'learning_helper',
        student_level: user.hsk_level || 1
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '抱歉，出现了问题。/ Sorry, something went wrong.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Profile Update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(profileForm);
      setShowProfileModal(false);
      alert(language === 'zh' ? '个人信息已更新！' : 'Profile updated!');
    } catch (error) {
      alert('Failed to update profile');
    }
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setHomeworkSubmission(prev => ({ ...prev, voice: audioBlob }));
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      alert(language === 'zh' ? '无法访问麦克风' : 'Cannot access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Submit Homework
  const handleSubmitHomework = async (homeworkId) => {
    try {
      const formData = new FormData();
      formData.append('content', homeworkSubmission.content);
      if (homeworkSubmission.file) formData.append('file', homeworkSubmission.file);
      if (homeworkSubmission.voice) formData.append('voice', homeworkSubmission.voice, 'recording.wav');

      await homeworkAPI.submit(homeworkId, formData);
      setShowHomeworkModal(null);
      setHomeworkSubmission({ content: '', file: null, voice: null });
      loadData();
      alert(language === 'zh' ? '作业已提交！' : 'Homework submitted!');
    } catch (error) {
      alert('Failed to submit homework');
    }
  };

  // Generate Learning Report
  const generateReport = async () => {
    try {
      setLoading(true);
      await reportsAPI.getStudentReport(user.id);
      loadData();
      alert(language === 'zh' ? '报告已生成！' : 'Report generated!');
    } catch (error) {
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const texts = {
    zh: {
      title: '我的学习中心',
      learning_helper: '学习小助手',
      my_homework: '我的作业',
      my_materials: '学习资料',
      my_reports: '学习报告',
      my_profile: '个人信息',
      ask_helper: '问问学习小助手...',
      helper_greeting: '你好！我是你的学习小助手 🎓\n\n我可以帮助你：\n• 解答中文学习问题\n• 解释语法和词汇\n• 练习对话\n• 提供学习建议\n\n有什么我可以帮助你的吗？',
      pending: '待完成',
      submitted: '已提交',
      graded: '已批改',
      submit_homework: '提交作业',
      text_answer: '文字答案',
      voice_answer: '语音答案',
      file_upload: '上传文件',
      start_recording: '开始录音',
      stop_recording: '停止录音',
      recorded: '已录制',
      download: '下载',
      no_homework: '暂无作业',
      no_materials: '暂无资料',
      no_reports: '暂无报告',
      generate_report: '生成学习报告',
      update_profile: '更新个人信息',
      name: '姓名',
      email: '电子邮件',
      phone: '电话号码',
      language: '界面语言',
      contact_info: '联系方式（供老师联系使用）'
    },
    en: {
      title: 'My Learning Center',
      learning_helper: 'Learning Helper',
      my_homework: 'My Homework',
      my_materials: 'Learning Materials',
      my_reports: 'Learning Reports',
      my_profile: 'My Profile',
      ask_helper: 'Ask the Learning Helper...',
      helper_greeting: 'Hello! I\'m your Learning Helper 🎓\n\nI can help you with:\n• Chinese learning questions\n• Grammar and vocabulary explanations\n• Conversation practice\n• Study tips\n\nHow can I help you today?',
      pending: 'Pending',
      submitted: 'Submitted',
      graded: 'Graded',
      submit_homework: 'Submit Homework',
      text_answer: 'Text Answer',
      voice_answer: 'Voice Answer',
      file_upload: 'Upload File',
      start_recording: 'Start Recording',
      stop_recording: 'Stop Recording',
      recorded: 'Recorded',
      download: 'Download',
      no_homework: 'No homework yet',
      no_materials: 'No materials yet',
      no_reports: 'No reports yet',
      generate_report: 'Generate Learning Report',
      update_profile: 'Update Profile',
      name: 'Name',
      email: 'Email',
      phone: 'Phone Number',
      language: 'Interface Language',
      contact_info: 'Contact Info (for teacher communication)'
    },
    it: {
      title: 'Il Mio Centro di Apprendimento',
      learning_helper: 'Assistente allo Studio',
      my_homework: 'I Miei Compiti',
      my_materials: 'Materiali di Studio',
      my_reports: 'Report di Apprendimento',
      my_profile: 'Il Mio Profilo',
      ask_helper: 'Chiedi all\'Assistente...',
      helper_greeting: 'Ciao! Sono il tuo Assistente allo Studio 🎓\n\nPosso aiutarti con:\n• Domande sull\'apprendimento del cinese\n• Spiegazioni di grammatica e vocabolario\n• Pratica di conversazione\n• Consigli di studio\n\nCome posso aiutarti oggi?',
      pending: 'In Sospeso',
      submitted: 'Consegnato',
      graded: 'Valutato',
      submit_homework: 'Consegna Compito',
      text_answer: 'Risposta Testuale',
      voice_answer: 'Risposta Vocale',
      file_upload: 'Carica File',
      start_recording: 'Inizia Registrazione',
      stop_recording: 'Ferma Registrazione',
      recorded: 'Registrato',
      download: 'Scarica',
      no_homework: 'Nessun compito',
      no_materials: 'Nessun materiale',
      no_reports: 'Nessun report',
      generate_report: 'Genera Report',
      update_profile: 'Aggiorna Profilo',
      name: 'Nome',
      email: 'Email',
      phone: 'Numero di Telefono',
      language: 'Lingua Interfaccia',
      contact_info: 'Info Contatto (per comunicazione con insegnante)'
    }
  };

  const txt = texts[language] || texts.en;

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header">
        <h1>📚 {txt.title}</h1>
        <button className="btn btn-outline" onClick={() => setShowProfileModal(true)}>
          👤 {txt.my_profile}
        </button>
      </div>

      {/* Draggable tabs — drag to reorder */}
      <div style={{ display:'flex', alignItems:'center', borderBottom:'2px solid var(--border)',
        marginBottom:'1.5rem', overflowX:'auto', gap:2 }}>
        <button onClick={()=>{
          const el=document.getElementById('student-tabs');
          if(el)el.scrollBy({left:-120,behavior:'smooth'});
        }} style={{ flexShrink:0, border:'none', background:'none', cursor:'pointer', fontSize:18, padding:'0 8px', color:'var(--text-muted)' }}>‹</button>
        <div id="student-tabs" style={{ display:'flex', gap:2, overflowX:'auto', scrollbarWidth:'none', flex:1 }}
          onWheel={e=>e.currentTarget.scrollLeft+=e.deltaY}>
          <style>{`#student-tabs::-webkit-scrollbar{display:none}`}</style>
          {tabOrder.map((tid, i) => {
            const tl = TAB_LABELS[tid];
            return (
              <div key={tid} draggable
                onDragStart={e=>{dragTabIdx.current=i;e.dataTransfer.effectAllowed='move';e.currentTarget.style.opacity='0.4';}}
                onDragEnter={()=>dragOverIdx.current=i}
                onDragOver={e=>e.preventDefault()}
                onDragEnd={e=>{
                  e.currentTarget.style.opacity='1';
                  const f=dragTabIdx.current, t=dragOverIdx.current;
                  if(f===null||t===null||f===t){dragTabIdx.current=null;dragOverIdx.current=null;return;}
                  setTabOrder(arr=>{const a=[...arr];a.splice(t,0,a.splice(f,1)[0]);return a;});
                  dragTabIdx.current=null;dragOverIdx.current=null;
                }}
                style={{ flexShrink:0, cursor:'grab' }}>
                <button
                  className={`tab ${activeTab===tid?'active':''}`}
                  style={{ cursor:'inherit', userSelect:'none', whiteSpace:'nowrap' }}
                  onClick={()=>setActiveTab(tid)}>
                  {tl.icon} {language==='zh'?tl.zh:tl.en}
                </button>
              </div>
            );
          })}
        </div>
        <button onClick={()=>{
          const el=document.getElementById('student-tabs');
          if(el)el.scrollBy({left:120,behavior:'smooth'});
        }} style={{ flexShrink:0, border:'none', background:'none', cursor:'pointer', fontSize:18, padding:'0 8px', color:'var(--text-muted)' }}>›</button>
      </div>

      {/* Learning Helper (AI Chat) */}
      {activeTab === 'helper' && (
        <div className="card">
          <div className="chat-container" style={{ height: '450px' }}>
            <div className="chat-messages" style={{ height: '380px', overflowY: 'auto', padding: '1rem', background: 'var(--background)', borderRadius: '0.5rem' }}>
              {chatMessages.length === 0 && (
                <div className="chat-message assistant">
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{txt.helper_greeting}</pre>
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
            <div className="chat-input-area" style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <input
                type="text"
                className="form-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && sendChatMessage()}
                placeholder={txt.ask_helper}
              />
              <button className="btn btn-primary" onClick={sendChatMessage} disabled={chatLoading}>
                {language === 'zh' ? '发送' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My Homework */}
      {activeTab === 'homework' && (
        <div className="card">
          {homework.length > 0 ? (
            <div>
              {homework.map(hw => (
                <div key={hw.id} className="list-item">
                  <div style={{ flex: 1 }}>
                    <strong>{language === 'zh' && hw.title_zh ? hw.title_zh : hw.title}</strong>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {hw.class_name} · Due: {hw.due_date ? new Date(hw.due_date).toLocaleDateString() : 'N/A'}
                    </p>
                    {hw.instructions && <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>{hw.instructions}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {hw.score !== null ? (
                      <span className="badge badge-success">{txt.graded}: {hw.score}</span>
                    ) : hw.submission_id ? (
                      <span className="badge badge-warning">{txt.submitted}</span>
                    ) : (
                      <>
                        <span className="badge badge-info">{txt.pending}</span>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowHomeworkModal(hw)}>
                          📤 {txt.submit_homework}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span style={{ fontSize: '4rem' }}>📝</span>
              <p>{txt.no_homework}</p>
            </div>
          )}
        </div>
      )}

      {/* Learning Materials */}
      {activeTab === 'materials' && (
        <div>
          {materials.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {materials.map(material => (
                <div key={material.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <span style={{ fontSize: '2rem' }}>
                      {material.type === 'video' ? '🎬' : material.type === 'audio' ? '🎵' : material.type === 'ppt' ? '📊' : '📄'}
                    </span>
                    <span className="badge badge-primary">HSK {material.hsk_level}</span>
                  </div>
                  <h3 style={{ marginTop: '0.5rem' }}>
                    {language === 'zh' && material.title_zh ? material.title_zh : material.title}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    {material.teacher_name}
                  </p>
                  {material.file_path && (
                    <a href={`/uploads/${material.file_path}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                      ⬇️ {txt.download}
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <span style={{ fontSize: '4rem' }}>📖</span>
                <p>{txt.no_materials}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Learning Reports */}
      {activeTab === 'reports' && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={generateReport}>
              📊 {txt.generate_report}
            </button>
          </div>
          
          {reports.length > 0 ? (
            <div>
              {reports.map((report, idx) => (
                <div key={idx} className="card">
                  <div className="card-header">
                    <h3>{report.type === 'student_progress' ? (language === 'zh' ? '学习进度报告' : 'Learning Progress Report') : report.type}</h3>
                    <span style={{ color: 'var(--text-muted)' }}>{new Date(report.generated_at).toLocaleDateString()}</span>
                  </div>
                  {report.ai_summary && (
                    <div style={{ padding: '1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '0.5rem', color: 'white', marginBottom: '1rem' }}>
                      <h4>🤖 智能 {language === 'zh' ? '分析' : 'Analysis'}</h4>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '0.5rem' }}>{report.ai_summary}</pre>
                    </div>
                  )}
                  {report.content && (
                    <div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', background: 'var(--background)', padding: '1rem', borderRadius: '0.5rem' }}>
                        {typeof report.content === 'string' ? report.content : JSON.stringify(report.content, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <span style={{ fontSize: '4rem' }}>📊</span>
                <p>{txt.no_reports}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👤 {txt.update_profile}</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleProfileUpdate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{txt.name}</label>
                  <input type="text" className="form-input" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                </div>
                
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  ℹ️ {txt.contact_info}
                </p>
                
                <div className="form-group">
                  <label className="form-label">📧 {txt.email}</label>
                  <input type="email" className="form-input" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">📱 {txt.phone}</label>
                  <input type="tel" className="form-input" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} placeholder="+39 XXX XXX XXXX" />
                </div>
                
                <div className="form-group">
                  <label className="form-label">🌐 {txt.language}</label>
                  <select className="form-select" value={profileForm.preferred_language} onChange={e => setProfileForm({...profileForm, preferred_language: e.target.value})}>
                    <option value="zh">🇨🇳 中文</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="it">🇮🇹 Italiano</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowProfileModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Homework Submit Modal */}
      {showHomeworkModal && (
        <div className="modal-overlay" onClick={() => setShowHomeworkModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📤 {txt.submit_homework}</h3>
              <button onClick={() => setShowHomeworkModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body">
              <h4 style={{ marginBottom: '1rem' }}>{showHomeworkModal.title}</h4>
              
              {/* Text Answer */}
              <div className="form-group">
                <label className="form-label">✍️ {txt.text_answer}</label>
                <textarea className="form-textarea" value={homeworkSubmission.content} onChange={e => setHomeworkSubmission({...homeworkSubmission, content: e.target.value})} rows={5} placeholder={language === 'zh' ? '在这里输入你的答案...' : 'Type your answer here...'} />
              </div>

              {/* Voice Recording */}
              {showHomeworkModal.allow_voice && (
                <div className="form-group">
                  <label className="form-label">🎤 {txt.voice_answer}</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!isRecording ? (
                      <button type="button" className="btn btn-outline" onClick={startRecording}>
                        🎤 {txt.start_recording}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={stopRecording} style={{ animation: 'pulse 1s infinite' }}>
                        ⏹️ {txt.stop_recording}
                      </button>
                    )}
                    {homeworkSubmission.voice && <span className="badge badge-success">✓ {txt.recorded}</span>}
                  </div>
                </div>
              )}

              {/* File Upload */}
              {showHomeworkModal.allow_file_upload && (
                <div className="form-group">
                  <label className="form-label">📎 {txt.file_upload}</label>
                  <input type="file" className="form-input" onChange={e => setHomeworkSubmission({...homeworkSubmission, file: e.target.files[0]})} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setShowHomeworkModal(null)}>{t('cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={() => handleSubmitHomework(showHomeworkModal.id)}>
                📤 {txt.submit_homework}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentLearningPage;
