import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TeachingAssistantPage = () => {
  const { user, token } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [briefing, setBriefing] = useState(null);
  const [studentMemory, setStudentMemory] = useState(null);
  const [teacherMemory, setTeacherMemory] = useState(null);
  const messagesEndRef = useRef(null);

  const isTeacher = ['teacher', 'admin', 'super_admin'].includes(user?.role);

  const t = {
    zh: { title: '🤖 智能教学助手', chat: '💬 对话', skills: '🎯 技能', memory: '🧠 记忆', briefing: '📊 简报', send: '发送', placeholder: '输入消息...', vocabDrill: '📝 词汇练习', dialogue: '🎭 对话练习', grammar: '📖 语法讲解', progress: '📈 进度报告', homework: '📚 生成作业', daily: '☀️ 每日简报', weekly: '📅 周报', loading: '加载中...' },
    en: { title: '🤖 Smart Teaching Assistant', chat: '💬 Chat', skills: '🎯 Skills', memory: '🧠 Memory', briefing: '📊 Briefing', send: 'Send', placeholder: 'Type a message...', vocabDrill: '📝 Vocabulary Drill', dialogue: '🎭 Dialogue Practice', grammar: '📖 Grammar Explanation', progress: '📈 Progress Report', homework: '📚 Generate Homework', daily: '☀️ Daily Briefing', weekly: '📅 Weekly Digest', loading: 'Loading...' },
    it: { title: '🤖 Assistente Didattico Intelligente', chat: '💬 Chat', skills: '🎯 Abilità', memory: '🧠 Memoria', briefing: '📊 Briefing', send: 'Invia', placeholder: 'Scrivi un messaggio...', vocabDrill: '📝 Esercizio Vocabolario', dialogue: '🎭 Pratica Dialogo', grammar: '📖 Spiegazione Grammatica', progress: '📈 Report Progressi', homework: '📚 Genera Compiti', daily: '☀️ Briefing Giornaliero', weekly: '📅 Riepilogo Settimanale', loading: 'Caricamento...' }
  }[language] || {};

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    setMessages([{ type: 'assistant', content: { zh: '欢迎！我可以帮助您练习中文、生成作业、查看进度。', en: 'Welcome! I can help you practice Chinese, generate homework, view progress.', it: 'Benvenuto! Posso aiutarti a praticare il cinese, generare compiti, vedere i progressi.' }, timestamp: new Date().toISOString() }]);
    if (isTeacher) { loadBriefing(); loadTeacherMemory(); } else { loadStudentMemory(user?.id); }
  }, []);

  const apiCall = async (endpoint, method = 'GET', body = null) => {
    const opts = { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_URL}${endpoint}`, opts);
    return res.json();
  };

  const loadBriefing = async () => { try { setBriefing(await apiCall(`/teaching-assistant/heartbeat/daily-briefing/${user.id}`)); } catch (e) { console.error(e); } };
  const loadTeacherMemory = async () => { try { setTeacherMemory(await apiCall(`/teaching-assistant/memory/teacher/${user.id}`)); } catch (e) { console.error(e); } };
  const loadStudentMemory = async (id) => { try { setStudentMemory(await apiCall(`/teaching-assistant/memory/student/${id}`)); } catch (e) { console.error(e); } };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    setMessages(prev => [...prev, { type: 'user', content: inputMessage, timestamp: new Date().toISOString() }]);
    const msg = inputMessage; setInputMessage(''); setIsLoading(true);
    try {
      const data = await apiCall('/teaching-assistant/chat', 'POST', { message: msg, context: { hsk_level: user?.hsk_level } });
      setMessages(prev => [...prev, { type: 'assistant', content: data.response.message || data.response, suggestions: data.response.suggestions, timestamp: new Date().toISOString() }]);
    } catch (e) { setMessages(prev => [...prev, { type: 'assistant', content: { en: 'Error occurred', zh: '发生错误' }, timestamp: new Date().toISOString() }]); }
    setIsLoading(false);
  };

  const executeSkill = async (endpoint, params = {}) => {
    setIsLoading(true);
    try {
      const data = await apiCall(endpoint, 'POST', params);
      setMessages(prev => [...prev, { type: 'skill', content: data, timestamp: new Date().toISOString() }]);
    } catch (e) { console.error(e); }
    setIsLoading(false);
  };

  const renderMessage = (msg) => {
    const content = typeof msg.content === 'string' ? msg.content : (msg.content?.[language] || msg.content?.en || JSON.stringify(msg.content));
    return <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>;
  };

  const renderSkillResult = (data) => {
    if (data.skill === 'vocabulary_drill') return (<div className="skill-card"><h4>📝 Vocabulary Drill</h4><p>Level HSK {data.drill?.level} | {data.drill?.question_count} questions</p>{data.drill?.questions?.slice(0,3).map((q,i)=>(<div key={i} className="q-item">{q.question_zh || q.question}</div>))}</div>);
    if (data.skill === 'progress_report') return (<div className="skill-card"><h4>📈 Progress Report</h4><p><strong>{data.report?.student?.name}</strong></p><p>Accuracy: {data.report?.statistics?.accuracy}% | Improvement: {data.report?.improvement?.percentage?.toFixed(1)}%</p></div>);
    if (data.skill === 'dialogue_roleplay') return (<div className="skill-card"><h4>🎭 {data.dialogue?.title?.[language] || data.dialogue?.title?.en}</h4><div className="vocab-box">{data.dialogue?.vocabulary?.map((v,i)=>(<span key={i} className="vocab">{v.word} ({v.pinyin})</span>))}</div>{data.dialogue?.sample_dialogue?.map((l,i)=>(<div key={i} className="dialogue-line"><b>{l.speaker}:</b> {l.text}<br/><small>{l.pinyin}</small></div>))}</div>);
    if (data.briefing_type) return (<div className="skill-card"><h4>☀️ {data.greeting?.[language] || data.greeting?.en}</h4>{data.alerts?.inactive_students?.count > 0 && <p className="alert">⚠️ {data.alerts.inactive_students.count} inactive students</p>}{data.alerts?.struggling_students?.count > 0 && <p className="alert danger">🔴 {data.alerts.struggling_students.count} struggling students</p>}</div>);
    return <pre>{JSON.stringify(data, null, 2)}</pre>;
  };

  return (
    <div className="ta-page">
      <style>{`
        .ta-page { max-width: 1100px; margin: 0 auto; padding: 20px; }
        .ta-page h1 { text-align: center; margin-bottom: 20px; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .tab-btn { padding: 10px 20px; border: none; background: #f5f5f5; border-radius: 8px 8px 0 0; cursor: pointer; }
        .tab-btn.active { background: #e74c3c; color: white; }
        .chat-box { border: 1px solid #ddd; border-radius: 12px; height: 500px; display: flex; flex-direction: column; }
        .messages { flex: 1; overflow-y: auto; padding: 15px; background: #f9f9f9; }
        .message { margin-bottom: 12px; }
        .message.user { text-align: right; }
        .message .bubble { display: inline-block; max-width: 75%; padding: 10px 15px; border-radius: 12px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .message.user .bubble { background: #e74c3c; color: white; }
        .message.skill .bubble { background: #fff8e1; border: 1px solid #ffd54f; max-width: 90%; }
        .input-row { display: flex; padding: 10px; border-top: 1px solid #ddd; }
        .input-row input { flex: 1; padding: 10px 15px; border: 1px solid #ddd; border-radius: 20px; outline: none; }
        .input-row button { margin-left: 10px; padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 20px; cursor: pointer; }
        .suggestions { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
        .sug-btn { padding: 5px 12px; background: #e8f5e9; border: 1px solid #81c784; border-radius: 15px; cursor: pointer; font-size: 0.85rem; }
        .skills-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
        .skill-box { background: white; border: 1px solid #ddd; border-radius: 10px; padding: 15px; }
        .skill-box.teacher { border-color: #3498db; background: #f0f8ff; }
        .skill-box h4 { margin: 0 0 10px; }
        .skill-box select { width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 5px; }
        .skill-box button { width: 100%; padding: 10px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer; }
        .skill-card { padding: 10px; }
        .skill-card h4 { margin: 0 0 10px; }
        .q-item { padding: 5px 10px; background: #f5f5f5; margin-bottom: 5px; border-radius: 5px; }
        .vocab-box { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
        .vocab { background: #e3f2fd; padding: 3px 8px; border-radius: 4px; font-size: 0.85rem; }
        .dialogue-line { padding: 8px; margin-bottom: 5px; background: #f9f9f9; border-radius: 5px; }
        .alert { padding: 8px; background: #fff8e1; border-left: 3px solid #ffc107; margin: 5px 0; }
        .alert.danger { background: #ffebee; border-color: #f44336; }
        .memory-box { background: white; border: 1px solid #ddd; border-radius: 10px; padding: 20px; }
        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 15px 0; }
        .stat-item { text-align: center; padding: 15px; background: #f5f5f5; border-radius: 8px; }
        .stat-item .val { font-size: 1.5rem; font-weight: bold; }
        .stat-item .lbl { font-size: 0.8rem; color: #666; }
        .typing { display: flex; gap: 4px; padding: 10px; }
        .typing span { width: 8px; height: 8px; background: #999; border-radius: 50%; animation: blink 1s infinite; }
        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes blink { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `}</style>

      <h1>{t.title}</h1>
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>{t.chat}</button>
        <button className={`tab-btn ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>{t.skills}</button>
        <button className={`tab-btn ${activeTab === 'memory' ? 'active' : ''}`} onClick={() => setActiveTab('memory')}>{t.memory}</button>
        {isTeacher && <button className={`tab-btn ${activeTab === 'briefing' ? 'active' : ''}`} onClick={() => setActiveTab('briefing')}>{t.briefing}</button>}
      </div>

      {activeTab === 'chat' && (
        <div className="chat-box">
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`message ${m.type}`}>
                <div className="bubble">
                  {m.type === 'skill' ? renderSkillResult(m.content) : renderMessage(m)}
                  {m.suggestions && <div className="suggestions">{m.suggestions.map((s, j) => (<button key={j} className="sug-btn" onClick={() => setInputMessage(s[language] || s.en)}>{s[language] || s.en}</button>))}</div>}
                </div>
              </div>
            ))}
            {isLoading && <div className="message assistant"><div className="bubble"><div className="typing"><span></span><span></span><span></span></div></div></div>}
            <div ref={messagesEndRef} />
          </div>
          <div className="input-row">
            <input value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder={t.placeholder} />
            <button onClick={sendMessage} disabled={isLoading}>{t.send}</button>
          </div>
        </div>
      )}

      {activeTab === 'skills' && (
        <div className="skills-grid">
          <div className="skill-box">
            <h4>{t.vocabDrill}</h4>
            <select id="drill-lv" defaultValue={user?.hsk_level || 1}>{[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}</select>
            <button onClick={() => executeSkill('/teaching-assistant/skills/vocabulary-drill', { level: parseInt(document.getElementById('drill-lv').value), count: 10 })}>Start</button>
          </div>
          <div className="skill-box">
            <h4>{t.dialogue}</h4>
            <select id="dlg-sc" defaultValue="appointment"><option value="appointment">预约挂号</option><option value="symptoms">描述症状</option><option value="pharmacy">在药房</option></select>
            <button onClick={() => executeSkill('/teaching-assistant/skills/dialogue-roleplay', { scenario: document.getElementById('dlg-sc').value })}>Start</button>
          </div>
          <div className="skill-box">
            <h4>{t.grammar}</h4>
            <select id="gr-tp" defaultValue="是"><option value="是">是 (to be)</option><option value="了">了 (completion)</option><option value="把">把 (disposal)</option></select>
            <button onClick={() => executeSkill('/teaching-assistant/skills/grammar-explain', { topic: document.getElementById('gr-tp').value })}>Explain</button>
          </div>
          <div className="skill-box">
            <h4>{t.progress}</h4>
            <button onClick={() => executeSkill('/teaching-assistant/skills/progress-report', { student_id: user.id })}>View</button>
          </div>
          {isTeacher && <>
            <div className="skill-box teacher">
              <h4>{t.homework}</h4>
              <select id="hw-lv" defaultValue="2">{[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}</select>
              <button onClick={() => executeSkill('/teaching-assistant/skills/generate-homework', { hsk_level: parseInt(document.getElementById('hw-lv').value) })}>Generate</button>
            </div>
            <div className="skill-box teacher">
              <h4>{t.daily}</h4>
              <button onClick={() => executeSkill(`/teaching-assistant/heartbeat/daily-briefing/${user.id}`)}>Get Briefing</button>
            </div>
          </>}
        </div>
      )}

      {activeTab === 'memory' && (
        <div className="memory-box">
          {isTeacher ? (
            teacherMemory ? <>
              <h3>Classes Overview</h3>
              {teacherMemory.classes?.map((c, i) => <div key={i} style={{padding:'10px',background:'#f5f5f5',marginBottom:'10px',borderRadius:'8px'}}><strong>{c.name_zh || c.name}</strong> - {c.student_count} students, Avg: {c.avg_class_score}%</div>)}
              {teacherMemory.alerts?.inactive_students?.length > 0 && <div className="alert">⚠️ {teacherMemory.alerts.inactive_students.length} students haven't practiced recently</div>}
            </> : <p>{t.loading}</p>
          ) : (
            studentMemory ? <>
              <h3>{studentMemory.student?.name_zh || studentMemory.student?.name} <span style={{background:'#e74c3c',color:'white',padding:'2px 10px',borderRadius:'10px',fontSize:'0.8rem'}}>HSK {studentMemory.student?.hsk_level}</span></h3>
              <div className="stats-row">
                <div className="stat-item"><span className="val">{studentMemory.memory?.learning_pace?.practice_days || 0}</span><span className="lbl">Days/Week</span></div>
                <div className="stat-item"><span className="val">{studentMemory.memory?.learning_pace?.total_questions || 0}</span><span className="lbl">Questions</span></div>
                <div className="stat-item"><span className="val">{studentMemory.memory?.homework?.average_score?.toFixed(0) || 0}%</span><span className="lbl">Avg Score</span></div>
                <div className="stat-item"><span className="val">{studentMemory.memory?.attendance?.rate || 0}%</span><span className="lbl">Attendance</span></div>
              </div>
              {studentMemory.memory?.common_errors?.length > 0 && <><h4>Areas to Improve</h4>{studentMemory.memory.common_errors.slice(0,5).map((e,i) => <div key={i} className="alert">{e.question_zh || e.question} ({e.error_count}x)</div>)}</>}
            </> : <p>{t.loading}</p>
          )}
        </div>
      )}

      {activeTab === 'briefing' && isTeacher && (
        <div className="memory-box">
          {briefing ? <>
            <h3 style={{background:'linear-gradient(135deg,#667eea,#764ba2)',color:'white',padding:'15px',borderRadius:'10px',marginBottom:'20px'}}>{briefing.greeting?.[language] || briefing.greeting?.en}</h3>
            {briefing.alerts?.inactive_students?.count > 0 && <div className="alert">⚠️ {briefing.alerts.inactive_students.count} students haven't practiced this week<ul>{briefing.alerts.inactive_students.students?.slice(0,5).map((s,i) => <li key={i}>{s.name} ({s.class_name})</li>)}</ul></div>}
            {briefing.alerts?.struggling_students?.count > 0 && <div className="alert danger">🔴 {briefing.alerts.struggling_students.count} students struggling<ul>{briefing.alerts.struggling_students.students?.slice(0,5).map((s,i) => <li key={i}>{s.name}: {s.weak_area} ({s.accuracy}%)</li>)}</ul></div>}
            {briefing.today_schedule?.length > 0 && <><h4>Today's Classes</h4>{briefing.today_schedule.map((c,i) => <div key={i} style={{padding:'8px',background:'#f5f5f5',marginBottom:'5px',borderRadius:'5px'}}>{c.name_zh || c.name} - {c.schedule}</div>)}</>}
          </> : <p>{t.loading}</p>}
        </div>
      )}
    </div>
  );
};

export default TeachingAssistantPage;
