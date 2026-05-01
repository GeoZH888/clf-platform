import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { classesAPI, messagesAPI } from '../services/api';

const TeacherCommunicationPage = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [classes, setClasses] = useState([]);
  const [studentsWithParents, setStudentsWithParents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('send');
  const [showComposeModal, setShowComposeModal] = useState(false);
  
  const [composeForm, setComposeForm] = useState({
    send_type: 'class', // 'class', 'student', 'parent', 'student_and_parent'
    class_ids: [],
    student_ids: [],
    parent_ids: [],
    subject: '',
    subject_zh: '',
    subject_it: '',
    content: '',
    content_zh: '',
    content_it: '',
    send_email: false,
    is_urgent: false
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [classesRes, messagesRes] = await Promise.all([
        classesAPI.getAll(),
        messagesAPI.getAll({ folder: 'sent', limit: 50 })
      ]);
      
      setClasses(classesRes.data.classes || []);
      setMessages(messagesRes.data.messages || []);
      
      // Build student-parent relationships
      const studentsData = [];
      for (const cls of classesRes.data.classes || []) {
        if (cls.students) {
          cls.students.forEach(s => {
            if (!studentsData.find(st => st.id === s.id)) {
              studentsData.push({
                ...s,
                class_name: cls.name,
                class_id: cls.id,
                parent: s.parent || null
              });
            }
          });
        }
      }
      setStudentsWithParents(studentsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...composeForm,
        sender_id: user.id
      };

      // Determine recipients based on send_type
      let recipients = [];
      if (composeForm.send_type === 'class') {
        // Send to all students in selected classes
        recipients = studentsWithParents
          .filter(s => composeForm.class_ids.includes(s.class_id))
          .map(s => s.id);
      } else if (composeForm.send_type === 'student') {
        recipients = composeForm.student_ids;
      } else if (composeForm.send_type === 'parent') {
        recipients = composeForm.parent_ids;
      } else if (composeForm.send_type === 'student_and_parent') {
        // Send to both students and their parents
        const selectedStudents = studentsWithParents.filter(s => composeForm.student_ids.includes(s.id));
        recipients = [
          ...selectedStudents.map(s => s.id),
          ...selectedStudents.filter(s => s.parent).map(s => s.parent.id)
        ];
      }

      for (const recipientId of recipients) {
        await messagesAPI.send({
          recipient_id: recipientId,
          subject: composeForm.subject,
          subject_zh: composeForm.subject_zh,
          subject_it: composeForm.subject_it,
          content: composeForm.content,
          content_zh: composeForm.content_zh,
          content_it: composeForm.content_it,
          send_email: composeForm.send_email,
          is_urgent: composeForm.is_urgent
        });
      }

      setShowComposeModal(false);
      setComposeForm({
        send_type: 'class', class_ids: [], student_ids: [], parent_ids: [],
        subject: '', subject_zh: '', subject_it: '',
        content: '', content_zh: '', content_it: '',
        send_email: false, is_urgent: false
      });
      loadData();
      alert(language === 'zh' ? '消息已发送！' : language === 'it' ? 'Messaggio inviato!' : 'Message sent!');
    } catch (error) {
      alert('Failed to send message');
    }
  };

  const texts = {
    zh: {
      title: '师生家长沟通',
      send_message: '发送消息',
      sent_messages: '已发送',
      student_parent_list: '学生家长名单',
      compose: '撰写消息',
      send_to: '发送给',
      send_to_class: '发送给班级',
      send_to_student: '发送给学生',
      send_to_parent: '发送给家长',
      send_to_both: '发送给学生和家长',
      select_classes: '选择班级',
      select_students: '选择学生',
      select_parents: '选择家长',
      subject: '主题',
      content: '内容',
      also_email: '同时发送邮件',
      mark_urgent: '标记为紧急',
      send: '发送',
      no_messages: '暂无消息',
      parent: '家长',
      no_parent: '未关联家长',
      contact: '联系方式'
    },
    en: {
      title: 'Teacher-Student-Parent Communication',
      send_message: 'Send Message',
      sent_messages: 'Sent Messages',
      student_parent_list: 'Student-Parent Directory',
      compose: 'Compose Message',
      send_to: 'Send To',
      send_to_class: 'Send to Class',
      send_to_student: 'Send to Students',
      send_to_parent: 'Send to Parents',
      send_to_both: 'Send to Students & Parents',
      select_classes: 'Select Classes',
      select_students: 'Select Students',
      select_parents: 'Select Parents',
      subject: 'Subject',
      content: 'Content',
      also_email: 'Also send as email',
      mark_urgent: 'Mark as urgent',
      send: 'Send',
      no_messages: 'No messages yet',
      parent: 'Parent',
      no_parent: 'No parent linked',
      contact: 'Contact Info'
    },
    it: {
      title: 'Comunicazione Insegnante-Studente-Genitore',
      send_message: 'Invia Messaggio',
      sent_messages: 'Messaggi Inviati',
      student_parent_list: 'Elenco Studenti e Genitori',
      compose: 'Componi Messaggio',
      send_to: 'Invia A',
      send_to_class: 'Invia alla Classe',
      send_to_student: 'Invia agli Studenti',
      send_to_parent: 'Invia ai Genitori',
      send_to_both: 'Invia a Studenti e Genitori',
      select_classes: 'Seleziona Classi',
      select_students: 'Seleziona Studenti',
      select_parents: 'Seleziona Genitori',
      subject: 'Oggetto',
      content: 'Contenuto',
      also_email: 'Invia anche via email',
      mark_urgent: 'Segna come urgente',
      send: 'Invia',
      no_messages: 'Nessun messaggio',
      parent: 'Genitore',
      no_parent: 'Nessun genitore associato',
      contact: 'Contatti'
    }
  };

  const txt = texts[language] || texts.en;

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header">
        <h1>👨‍👩‍👧 {txt.title}</h1>
        <button className="btn btn-primary" onClick={() => setShowComposeModal(true)}>
          ✉️ {txt.send_message}
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'send' ? 'active' : ''}`} onClick={() => setActiveTab('send')}>
          ✉️ {txt.send_message}
        </button>
        <button className={`tab ${activeTab === 'sent' ? 'active' : ''}`} onClick={() => setActiveTab('sent')}>
          📤 {txt.sent_messages}
        </button>
        <button className={`tab ${activeTab === 'directory' ? 'active' : ''}`} onClick={() => setActiveTab('directory')}>
          📋 {txt.student_parent_list}
        </button>
      </div>

      {/* Quick Send Buttons */}
      {activeTab === 'send' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {classes.map(cls => (
            <div key={cls.id} className="card">
              <h3>{cls.name}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                👥 {cls.student_count || 0} students
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button className="btn btn-outline btn-sm" onClick={() => {
                  setComposeForm({...composeForm, send_type: 'class', class_ids: [cls.id]});
                  setShowComposeModal(true);
                }}>
                  📢 {language === 'zh' ? '通知班级' : 'Notify Class'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => {
                  const classStudents = studentsWithParents.filter(s => s.class_id === cls.id);
                  const parentIds = classStudents.filter(s => s.parent).map(s => s.parent.id);
                  setComposeForm({...composeForm, send_type: 'parent', parent_ids: parentIds});
                  setShowComposeModal(true);
                }}>
                  👨‍👩‍👧 {language === 'zh' ? '通知家长' : 'Notify Parents'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sent Messages */}
      {activeTab === 'sent' && (
        <div className="card">
          {messages.length > 0 ? (
            <div>
              {messages.map((msg, idx) => (
                <div key={idx} className="list-item">
                  <div style={{ flex: 1 }}>
                    <strong>{msg.subject || '(No subject)'}</strong>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      To: {msg.recipient_name} · {new Date(msg.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {msg.is_urgent && <span className="badge badge-error">Urgent</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span style={{ fontSize: '4rem' }}>📤</span>
              <p>{txt.no_messages}</p>
            </div>
          )}
        </div>
      )}

      {/* Student-Parent Directory */}
      {activeTab === 'directory' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{language === 'zh' ? '学生' : 'Student'}</th>
                  <th>{language === 'zh' ? '班级' : 'Class'}</th>
                  <th>{txt.parent}</th>
                  <th>{txt.contact}</th>
                  <th>{language === 'zh' ? '操作' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {studentsWithParents.map(student => (
                  <tr key={student.id}>
                    <td>
                      <strong>{student.name}</strong>
                      <br/><span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{student.email}</span>
                    </td>
                    <td>{student.class_name}</td>
                    <td>
                      {student.parent ? (
                        <>
                          <strong>{student.parent.name}</strong>
                          <br/><span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{student.parent.email}</span>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>{txt.no_parent}</span>
                      )}
                    </td>
                    <td>
                      {student.phone && <span>📱 {student.phone}</span>}
                    </td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => {
                        setComposeForm({...composeForm, send_type: 'student_and_parent', student_ids: [student.id]});
                        setShowComposeModal(true);
                      }}>
                        ✉️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="modal-overlay" onClick={() => setShowComposeModal(false)}>
          <div className="modal" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{txt.compose}</h3>
              <button onClick={() => setShowComposeModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSendMessage}>
              <div className="modal-body">
                {/* Send Type */}
                <div className="form-group">
                  <label className="form-label">{txt.send_to}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem', cursor: 'pointer' }}>
                      <input type="radio" checked={composeForm.send_type === 'class'} onChange={() => setComposeForm({...composeForm, send_type: 'class'})} />
                      📚 {txt.send_to_class}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem', cursor: 'pointer' }}>
                      <input type="radio" checked={composeForm.send_type === 'student'} onChange={() => setComposeForm({...composeForm, send_type: 'student'})} />
                      👨‍🎓 {txt.send_to_student}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem', cursor: 'pointer' }}>
                      <input type="radio" checked={composeForm.send_type === 'parent'} onChange={() => setComposeForm({...composeForm, send_type: 'parent'})} />
                      👨‍👩‍👧 {txt.send_to_parent}
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem', cursor: 'pointer' }}>
                      <input type="radio" checked={composeForm.send_type === 'student_and_parent'} onChange={() => setComposeForm({...composeForm, send_type: 'student_and_parent'})} />
                      👨‍👩‍👧‍👦 {txt.send_to_both}
                    </label>
                  </div>
                </div>

                {/* Recipients Selection */}
                {composeForm.send_type === 'class' && (
                  <div className="form-group">
                    <label className="form-label">{txt.select_classes}</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {classes.map(cls => (
                        <label key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
                          <input type="checkbox" checked={composeForm.class_ids.includes(cls.id)} onChange={e => {
                            if (e.target.checked) setComposeForm({...composeForm, class_ids: [...composeForm.class_ids, cls.id]});
                            else setComposeForm({...composeForm, class_ids: composeForm.class_ids.filter(id => id !== cls.id)});
                          }} />
                          {cls.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {(composeForm.send_type === 'student' || composeForm.send_type === 'student_and_parent') && (
                  <div className="form-group">
                    <label className="form-label">{txt.select_students}</label>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                      {studentsWithParents.map(student => (
                        <label key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem' }}>
                          <input type="checkbox" checked={composeForm.student_ids.includes(student.id)} onChange={e => {
                            if (e.target.checked) setComposeForm({...composeForm, student_ids: [...composeForm.student_ids, student.id]});
                            else setComposeForm({...composeForm, student_ids: composeForm.student_ids.filter(id => id !== student.id)});
                          }} />
                          {student.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>({student.class_name})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject in 3 languages */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">{txt.subject} (EN)</label>
                    <input type="text" className="form-input" value={composeForm.subject} onChange={e => setComposeForm({...composeForm, subject: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">主题 (中文)</label>
                    <input type="text" className="form-input" value={composeForm.subject_zh} onChange={e => setComposeForm({...composeForm, subject_zh: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Oggetto (IT)</label>
                    <input type="text" className="form-input" value={composeForm.subject_it} onChange={e => setComposeForm({...composeForm, subject_it: e.target.value})} />
                  </div>
                </div>

                {/* Content */}
                <div className="form-group">
                  <label className="form-label">{txt.content}</label>
                  <textarea className="form-textarea" value={composeForm.content} onChange={e => setComposeForm({...composeForm, content: e.target.value})} rows={4} required />
                </div>

                {/* Options */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={composeForm.send_email} onChange={e => setComposeForm({...composeForm, send_email: e.target.checked})} />
                    📧 {txt.also_email}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={composeForm.is_urgent} onChange={e => setComposeForm({...composeForm, is_urgent: e.target.checked})} />
                    🚨 {txt.mark_urgent}
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowComposeModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">✉️ {txt.send}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherCommunicationPage;
