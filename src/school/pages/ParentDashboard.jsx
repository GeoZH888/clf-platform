import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { reportsAPI, messagesAPI } from '../services/api';
import api from '../services/api';

const ParentDashboard = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [childData, setChildData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageForm, setMessageForm] = useState({ recipient_id: '', subject: '', content: '' });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (selectedChild) loadChildData(selectedChild); }, [selectedChild]);

  const loadData = async () => {
    try {
      const [childrenRes, messagesRes] = await Promise.all([
        api.get('/parent/children'),
        messagesAPI.getAll({ folder: 'inbox' })
      ]);
      const childrenList = childrenRes.data.children || [];
      setChildren(childrenList);
      setMessages(messagesRes.data.messages || []);
      
      if (childrenList.length > 0) {
        setSelectedChild(childrenList[0].id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChildData = async (childId) => {
    try {
      const [progressRes, homeworkRes, attendanceRes, classesRes] = await Promise.all([
        api.get(`/parent/child/${childId}/progress`),
        api.get(`/parent/child/${childId}/homework`),
        api.get(`/parent/child/${childId}/attendance`),
        api.get(`/parent/child/${childId}/classes`)
      ]);
      
      setChildData({
        progress: progressRes.data.progress,
        homework: homeworkRes.data.homework || [],
        attendance: attendanceRes.data.attendance || [],
        classes: classesRes.data.classes || [],
        teachers: classesRes.data.teachers || []
      });
    } catch (error) {
      console.error('Failed to load child data:', error);
      setChildData({ progress: null, homework: [], attendance: [], classes: [], teachers: [] });
    }
  };

  const sendMessageToTeacher = async (e) => {
    e.preventDefault();
    try {
      await messagesAPI.send(messageForm);
      setShowMessageModal(false);
      setMessageForm({ recipient_id: '', subject: '', content: '' });
      alert(language === 'zh' ? '消息已发送！' : 'Message sent!');
    } catch (error) {
      alert('Failed to send message');
    }
  };

  const generateChildReport = async () => {
    try {
      await reportsAPI.getStudentReport(selectedChild);
      loadChildData(selectedChild);
      alert(language === 'zh' ? '报告已生成！' : 'Report generated!');
    } catch (error) {
      alert('Failed to generate report');
    }
  };

  const texts = {
    zh: {
      title: '家长中心',
      my_children: '我的孩子',
      overview: '学习概览',
      homework: '作业情况',
      attendance: '出勤记录',
      messages: '消息',
      contact_teacher: '联系老师',
      select_child: '选择孩子',
      no_children: '未关联孩子账户',
      learning_progress: '学习进度',
      attendance_rate: '出勤率',
      homework_completion: '作业完成率',
      avg_score: '平均分数',
      recent_homework: '最近作业',
      pending: '待完成',
      submitted: '已提交',
      graded: '已批改',
      no_homework: '暂无作业',
      class_name: '班级',
      teacher: '老师',
      schedule: '时间',
      send_message: '发送消息',
      subject: '主题',
      content: '内容',
      generate_report: '生成学习报告',
      hsk_progress: 'HSK 进度',
      classes: '班级信息',
      no_messages: '暂无消息'
    },
    en: {
      title: 'Parent Center',
      my_children: 'My Children',
      overview: 'Overview',
      homework: 'Homework',
      attendance: 'Attendance',
      messages: 'Messages',
      contact_teacher: 'Contact Teacher',
      select_child: 'Select Child',
      no_children: 'No linked child account',
      learning_progress: 'Learning Progress',
      attendance_rate: 'Attendance Rate',
      homework_completion: 'Homework Completion',
      avg_score: 'Average Score',
      recent_homework: 'Recent Homework',
      pending: 'Pending',
      submitted: 'Submitted',
      graded: 'Graded',
      no_homework: 'No homework',
      class_name: 'Class',
      teacher: 'Teacher',
      schedule: 'Schedule',
      send_message: 'Send Message',
      subject: 'Subject',
      content: 'Content',
      generate_report: 'Generate Report',
      hsk_progress: 'HSK Progress',
      classes: 'Class Info',
      no_messages: 'No messages'
    },
    it: {
      title: 'Centro Genitori',
      my_children: 'I Miei Figli',
      overview: 'Panoramica',
      homework: 'Compiti',
      attendance: 'Presenze',
      messages: 'Messaggi',
      contact_teacher: 'Contatta Insegnante',
      select_child: 'Seleziona Figlio',
      no_children: 'Nessun account figlio collegato',
      learning_progress: 'Progressi di Apprendimento',
      attendance_rate: 'Tasso di Presenza',
      homework_completion: 'Completamento Compiti',
      avg_score: 'Voto Medio',
      recent_homework: 'Compiti Recenti',
      pending: 'In Sospeso',
      submitted: 'Consegnato',
      graded: 'Valutato',
      no_homework: 'Nessun compito',
      class_name: 'Classe',
      teacher: 'Insegnante',
      schedule: 'Orario',
      send_message: 'Invia Messaggio',
      subject: 'Oggetto',
      content: 'Contenuto',
      generate_report: 'Genera Report',
      hsk_progress: 'Progresso HSK',
      classes: 'Info Classe',
      no_messages: 'Nessun messaggio'
    }
  };

  const txt = texts[language] || texts.en;

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  const selectedChildInfo = children.find(c => c.id === selectedChild);

  return (
    <div>
      <div className="content-header">
        <h1>👨‍👩‍👧 {txt.title}</h1>
        {childData?.teachers?.length > 0 && (
          <button className="btn btn-primary" onClick={() => setShowMessageModal(true)}>
            ✉️ {txt.contact_teacher}
          </button>
        )}
      </div>

      {/* Child Selector */}
      {children.length > 1 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{txt.select_child}</label>
            <select className="form-select" value={selectedChild || ''} onChange={e => setSelectedChild(e.target.value)}>
              {children.map(child => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {children.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span style={{ fontSize: '4rem' }}>👶</span>
            <p>{txt.no_children}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Child Info Header */}
          {selectedChildInfo && (
            <div className="card" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.5rem', fontWeight: 'bold' }}>
                {selectedChildInfo.name?.charAt(0)}
              </div>
              <div>
                <h2>{selectedChildInfo.name}</h2>
                <p style={{ color: 'var(--text-muted)' }}>{selectedChildInfo.email}</p>
              </div>
              <button className="btn btn-outline" style={{ marginLeft: 'auto' }} onClick={generateChildReport}>
                📊 {txt.generate_report}
              </button>
            </div>
          )}

          <div className="tabs">
            <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
              📊 {txt.overview}
            </button>
            <button className={`tab ${activeTab === 'homework' ? 'active' : ''}`} onClick={() => setActiveTab('homework')}>
              📝 {txt.homework}
            </button>
            <button className={`tab ${activeTab === 'attendance' ? 'active' : ''}`} onClick={() => setActiveTab('attendance')}>
              ✅ {txt.attendance}
            </button>
            <button className={`tab ${activeTab === 'classes' ? 'active' : ''}`} onClick={() => setActiveTab('classes')}>
              📚 {txt.classes}
            </button>
            <button className={`tab ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>
              💬 {txt.messages}
            </button>
          </div>

          {/* Overview */}
          {activeTab === 'overview' && childData && (
            <div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.1)' }}>✅</div>
                  <div className="stat-content">
                    <h3>{childData.progress?.attendance_rate || 0}%</h3>
                    <p>{txt.attendance_rate}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.1)' }}>📝</div>
                  <div className="stat-content">
                    <h3>{childData.progress?.homework_completion || 0}%</h3>
                    <p>{txt.homework_completion}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.1)' }}>⭐</div>
                  <div className="stat-content">
                    <h3>{childData.progress?.avg_score || 0}</h3>
                    <p>{txt.avg_score}</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: 'rgba(196,30,58,0.1)' }}>🏆</div>
                  <div className="stat-content">
                    <h3>HSK {childData.progress?.hsk_level || 1}</h3>
                    <p>{txt.hsk_progress}</p>
                  </div>
                </div>
              </div>

              {/* Recent Homework Preview */}
              <div className="card">
                <div className="card-header">
                  <h3>{txt.recent_homework}</h3>
                </div>
                {childData.homework?.slice(0, 5).map((hw, idx) => (
                  <div key={idx} className="list-item">
                    <div>
                      <strong>{hw.title}</strong>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {hw.class_name} · Due: {hw.due_date ? new Date(hw.due_date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    {hw.score !== null ? (
                      <span className="badge badge-success">{txt.graded}: {hw.score}</span>
                    ) : hw.submitted ? (
                      <span className="badge badge-warning">{txt.submitted}</span>
                    ) : (
                      <span className="badge badge-info">{txt.pending}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Homework */}
          {activeTab === 'homework' && childData && (
            <div className="card">
              {childData.homework?.length > 0 ? (
                <div>
                  {childData.homework.map((hw, idx) => (
                    <div key={idx} className="list-item">
                      <div style={{ flex: 1 }}>
                        <strong>{hw.title}</strong>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          {hw.class_name} · Due: {hw.due_date ? new Date(hw.due_date).toLocaleDateString() : 'N/A'}
                        </p>
                        {hw.feedback && (
                          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--background)', borderRadius: '0.25rem' }}>
                            💬 {hw.feedback}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {hw.score !== null ? (
                          <span className="badge badge-success" style={{ fontSize: '1rem' }}>{hw.score}/{hw.max_score || 100}</span>
                        ) : hw.submitted ? (
                          <span className="badge badge-warning">{txt.submitted}</span>
                        ) : (
                          <span className="badge badge-info">{txt.pending}</span>
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

          {/* Attendance */}
          {activeTab === 'attendance' && childData && (
            <div className="card">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{language === 'zh' ? '日期' : 'Date'}</th>
                      <th>{txt.class_name}</th>
                      <th>{language === 'zh' ? '状态' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {childData.attendance?.slice(0, 20).map((record, idx) => (
                      <tr key={idx}>
                        <td>{new Date(record.date).toLocaleDateString()}</td>
                        <td>{record.class_name}</td>
                        <td>
                          <span className={`badge badge-${record.status === 'present' ? 'success' : record.status === 'late' ? 'warning' : 'error'}`}>
                            {record.status === 'present' ? '✓ ' : record.status === 'late' ? '⏰ ' : '✗ '}
                            {language === 'zh' ? 
                              (record.status === 'present' ? '出席' : record.status === 'late' ? '迟到' : '缺席') :
                              record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Classes */}
          {activeTab === 'classes' && childData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {childData.classes?.map((cls, idx) => (
                <div key={idx} className="card">
                  <h3>{cls.name}</h3>
                  <span className="badge badge-primary">{cls.level}</span>
                  <p style={{ margin: '0.5rem 0', color: 'var(--text-muted)' }}>{cls.description}</p>
                  <div style={{ fontSize: '0.875rem' }}>
                    <p>👨‍🏫 {txt.teacher}: <strong>{cls.teacher_name}</strong></p>
                    <p>📅 {txt.schedule}: {cls.schedule}</p>
                  </div>
                  <button className="btn btn-outline btn-sm" style={{ marginTop: '1rem' }} onClick={() => {
                    setMessageForm({ ...messageForm, recipient_id: cls.teacher_id });
                    setShowMessageModal(true);
                  }}>
                    ✉️ {txt.contact_teacher}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          {activeTab === 'messages' && (
            <div className="card">
              {messages.length > 0 ? (
                <div>
                  {messages.map((msg, idx) => (
                    <div key={idx} className="list-item" style={{ background: msg.is_read ? 'transparent' : 'rgba(196,30,58,0.05)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {!msg.is_read && <span className="badge badge-primary">NEW</span>}
                          <strong>{msg.sender_name}</strong>
                        </div>
                        <p style={{ fontWeight: msg.is_read ? 'normal' : 'bold' }}>{msg.subject || '(No subject)'}</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{msg.content?.substring(0, 100)}...</p>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(msg.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span style={{ fontSize: '4rem' }}>💬</span>
                  <p>{txt.no_messages}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Message Modal */}
      {showMessageModal && (
        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✉️ {txt.contact_teacher}</h3>
              <button onClick={() => setShowMessageModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={sendMessageToTeacher}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{txt.teacher}</label>
                  <select className="form-select" value={messageForm.recipient_id} onChange={e => setMessageForm({...messageForm, recipient_id: e.target.value})} required>
                    <option value="">{language === 'zh' ? '选择老师' : 'Select teacher'}</option>
                    {childData?.teachers?.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{txt.subject}</label>
                  <input type="text" className="form-input" value={messageForm.subject} onChange={e => setMessageForm({...messageForm, subject: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{txt.content}</label>
                  <textarea className="form-textarea" value={messageForm.content} onChange={e => setMessageForm({...messageForm, content: e.target.value})} rows={5} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowMessageModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">✉️ {txt.send_message}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;
