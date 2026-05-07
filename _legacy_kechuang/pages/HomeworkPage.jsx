import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { homeworkAPI, classesAPI } from '../services/api';

const HomeworkPage = () => {
  const { user, isTeacher, isStudent, isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const [homework, setHomework] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', class_id: '', due_date: '', instructions: '' });
  const [submitData, setSubmitData] = useState({ content: '', file: null, voice: null });
  const [reviewData, setReviewData] = useState({ score: '', feedback: '' });
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [homeworkRes, classesRes] = await Promise.all([
        homeworkAPI.getAll(),
        classesAPI.getAll()
      ]);
      setHomework(homeworkRes.data.homework || []);
      setClasses(classesRes.data.classes || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHomework = async (e) => {
    e.preventDefault();
    try {
      await homeworkAPI.create(formData);
      setShowModal(false);
      setFormData({ title: '', description: '', class_id: '', due_date: '', instructions: '' });
      loadData();
    } catch (error) {
      alert('Failed to create homework');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setSubmitData({ ...submitData, voice: audioBlob });
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmitHomework = async (e) => {
    e.preventDefault();
    try {
      const formDataObj = new FormData();
      formDataObj.append('content', submitData.content);
      if (submitData.file) formDataObj.append('file', submitData.file);
      if (submitData.voice) formDataObj.append('voice', submitData.voice, 'recording.wav');
      
      await homeworkAPI.submit(showSubmitModal, formDataObj);
      setShowSubmitModal(null);
      setSubmitData({ content: '', file: null, voice: null });
      loadData();
    } catch (error) {
      alert('Failed to submit homework');
    }
  };

  const handleReview = async (submissionId) => {
    try {
      await homeworkAPI.review(submissionId, reviewData);
      setShowReviewModal(null);
      setReviewData({ score: '', feedback: '' });
      loadData();
    } catch (error) {
      alert('Failed to review submission');
    }
  };

  const getStatusBadge = (hw) => {
    if (hw.score !== null && hw.score !== undefined) return <span className="badge badge-success">{t('homework.graded')}: {hw.score}</span>;
    if (hw.submission_status === 'submitted' || hw.submission_status === 'resubmitted') return <span className="badge badge-warning">{t('homework.submitted')}</span>;
    return <span className="badge badge-error">{t('homework.pending')}</span>;
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header">
        <h1>{t('homework.title')}</h1>
        {(isTeacher || isAdmin) && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + {t('homework.create_homework')}
          </button>
        )}
      </div>

      {homework.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span style={{ fontSize: '4rem' }}>📝</span>
            <p>{language === 'zh' ? '暂无作业' : language === 'it' ? 'Nessun compito' : 'No homework'}</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{language === 'zh' ? '标题' : language === 'it' ? 'Titolo' : 'Title'}</th>
                  <th>{language === 'zh' ? '班级' : language === 'it' ? 'Classe' : 'Class'}</th>
                  <th>{t('homework.due_date')}</th>
                  <th>{language === 'zh' ? '状态' : language === 'it' ? 'Stato' : 'Status'}</th>
                  <th>{language === 'zh' ? '操作' : language === 'it' ? 'Azioni' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {homework.map(hw => (
                  <tr key={hw.id}>
                    <td>
                      <strong>{hw.title}</strong>
                      {hw.description && <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{hw.description.substring(0, 50)}...</p>}
                    </td>
                    <td>{hw.class_name}</td>
                    <td>{hw.due_date ? new Date(hw.due_date).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      {isStudent ? getStatusBadge(hw) : (
                        <span className="badge badge-info">
                          {hw.pending_count || 0} {language === 'zh' ? '待批' : language === 'it' ? 'da correggere' : 'pending'}
                        </span>
                      )}
                    </td>
                    <td>
                      {isStudent && !hw.submission_id && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowSubmitModal(hw.id)}>
                          {t('homework.submit')}
                        </button>
                      )}
                      {(isTeacher || isAdmin) && hw.pending_count > 0 && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowReviewModal(hw)}>
                          {language === 'zh' ? '批改' : language === 'it' ? 'Correggi' : 'Review'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Homework Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('homework.create_homework')}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleCreateHomework}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '标题' : language === 'it' ? 'Titolo' : 'Title'} *</label>
                  <input type="text" className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '班级' : language === 'it' ? 'Classe' : 'Class'} *</label>
                  <select className="form-select" value={formData.class_id} onChange={e => setFormData({...formData, class_id: e.target.value})} required>
                    <option value="">{language === 'zh' ? '选择班级' : language === 'it' ? 'Seleziona Classe' : 'Select Class'}</option>
                    {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('homework.due_date')}</label>
                  <input type="datetime-local" className="form-input" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '说明' : language === 'it' ? 'Istruzioni' : 'Instructions'}</label>
                  <textarea className="form-textarea" value={formData.instructions} onChange={e => setFormData({...formData, instructions: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Homework Modal */}
      {showSubmitModal && (
        <div className="modal-overlay" onClick={() => setShowSubmitModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('homework.submit')}</h3>
              <button onClick={() => setShowSubmitModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleSubmitHomework}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '答案' : language === 'it' ? 'Risposta' : 'Answer'}</label>
                  <textarea className="form-textarea" value={submitData.content} onChange={e => setSubmitData({...submitData, content: e.target.value})} rows={5} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">{t('homework.voice_input')} 🎤</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!isRecording ? (
                      <button type="button" className="btn btn-outline" onClick={startRecording}>
                        🎤 {language === 'zh' ? '开始录音' : language === 'it' ? 'Inizia Registrazione' : 'Start Recording'}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-primary" onClick={stopRecording}>
                        ⏹️ {language === 'zh' ? '停止录音' : language === 'it' ? 'Ferma Registrazione' : 'Stop Recording'}
                      </button>
                    )}
                    {submitData.voice && <span className="badge badge-success">✓ {language === 'zh' ? '已录制' : 'Recorded'}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{t('homework.upload_file')} 📎</label>
                  <input type="file" className="form-input" onChange={e => setSubmitData({...submitData, file: e.target.files[0]})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowSubmitModal(null)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('submit')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{language === 'zh' ? '批改作业' : language === 'it' ? 'Correggi Compito' : 'Review Homework'}</h3>
              <button onClick={() => setShowReviewModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('homework.score')} (0-{showReviewModal.max_score || 100})</label>
                <input type="number" className="form-input" min="0" max={showReviewModal.max_score || 100} value={reviewData.score} onChange={e => setReviewData({...reviewData, score: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('homework.feedback')}</label>
                <textarea className="form-textarea" value={reviewData.feedback} onChange={e => setReviewData({...reviewData, feedback: e.target.value})} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setShowReviewModal(null)}>{t('cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={() => handleReview(showReviewModal.id)}>{t('submit')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeworkPage;
