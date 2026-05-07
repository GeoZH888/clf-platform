import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import VoiceRecorder from '../components/VoiceRecorder';

const StudentHomeworkPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHomework, setSelectedHomework] = useState(null);
  const [submission, setSubmission] = useState({ content: '', voiceBlob: null });
  const [message, setMessage] = useState({ type: '', text: '' });

  const txt = {
    zh: {
      title: '📝 我的作业',
      pending: '待完成',
      submitted: '已提交',
      graded: '已批改',
      dueDate: '截止日期',
      teacher: '教师',
      class: '班级',
      submit: '提交作业',
      resubmit: '重新提交',
      viewFeedback: '查看反馈',
      instructions: '作业要求',
      yourAnswer: '你的答案',
      voiceReading: '语音朗读',
      voiceReadingTip: '请朗读以下内容并录音：',
      textAnswer: '文字答案',
      submitBtn: '提交',
      cancel: '取消',
      noHomework: '暂无作业',
      score: '得分',
      feedback: '教师反馈',
      teacherDemo: '教师示范',
      teacherCorrection: '教师纠正录音',
      yourRecording: '你的录音',
      success: '提交成功！',
      failed: '提交失败',
      overdue: '已逾期',
      daysLeft: '天后截止',
      today: '今天截止'
    },
    en: {
      title: '📝 My Homework',
      pending: 'Pending',
      submitted: 'Submitted',
      graded: 'Graded',
      dueDate: 'Due Date',
      teacher: 'Teacher',
      class: 'Class',
      submit: 'Submit',
      resubmit: 'Resubmit',
      viewFeedback: 'View Feedback',
      instructions: 'Instructions',
      yourAnswer: 'Your Answer',
      voiceReading: 'Voice Reading',
      voiceReadingTip: 'Please read the following and record:',
      textAnswer: 'Text Answer',
      submitBtn: 'Submit',
      cancel: 'Cancel',
      noHomework: 'No homework',
      score: 'Score',
      feedback: 'Teacher Feedback',
      teacherDemo: 'Teacher Demo',
      teacherCorrection: 'Teacher Correction',
      yourRecording: 'Your Recording',
      success: 'Submitted successfully!',
      failed: 'Submission failed',
      overdue: 'Overdue',
      daysLeft: 'days left',
      today: 'Due today'
    },
    it: {
      title: '📝 I Miei Compiti',
      pending: 'In Sospeso',
      submitted: 'Inviato',
      graded: 'Valutato',
      dueDate: 'Scadenza',
      teacher: 'Insegnante',
      class: 'Classe',
      submit: 'Invia',
      resubmit: 'Reinvia',
      viewFeedback: 'Vedi Feedback',
      instructions: 'Istruzioni',
      yourAnswer: 'La Tua Risposta',
      voiceReading: 'Lettura Vocale',
      voiceReadingTip: 'Leggi il seguente testo e registra:',
      textAnswer: 'Risposta Testuale',
      submitBtn: 'Invia',
      cancel: 'Annulla',
      noHomework: 'Nessun compito',
      score: 'Punteggio',
      feedback: 'Feedback Insegnante',
      teacherDemo: 'Demo Insegnante',
      teacherCorrection: 'Correzione Insegnante',
      yourRecording: 'La Tua Registrazione',
      success: 'Inviato con successo!',
      failed: 'Invio fallito',
      overdue: 'Scaduto',
      daysLeft: 'giorni rimanenti',
      today: 'Scade oggi'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => {
    loadHomework();
  }, []);

  const loadHomework = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Get student's class enrollments
      const { data: enrollments } = await supabase
        .from('dwxz_class_enrollments')
        .select('class_id')
        .eq('student_id', user?.id);

      const classIds = enrollments?.map(e => e.class_id) || [];

      if (classIds.length === 0) {
        setHomework([]);
        setLoading(false);
        return;
      }

      // Get homework for those classes
      const { data: homeworkData } = await supabase
        .from('dwxz_homework')
        .select(`
          *,
          classes(name, name_zh),
          users!homework_teacher_id_fkey(name, name_zh),
          homework_submissions(*)
        `)
        .in('class_id', classIds)
        .order('due_date', { ascending: true });

      // Process submissions
      const processed = (homeworkData || []).map(hw => {
        const mySubmission = hw.homework_submissions?.find(s => s.student_id === user?.id);
        return {
          ...hw,
          mySubmission,
          status: mySubmission?.score != null ? 'graded' : mySubmission ? 'submitted' : 'pending'
        };
      });

      setHomework(processed);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedHomework) return;
    
    try {
      // Convert voice blob to base64 if exists
      let voiceData = null;
      if (submission.voiceBlob) {
        voiceData = await blobToBase64(submission.voiceBlob);
      }

      // Check if resubmitting
      const existingSubmission = selectedHomework.mySubmission;

      if (existingSubmission) {
        // Update existing submission
        await supabase
          .from('dwxz_homework_submissions')
          .update({
            content: submission.content,
            voice_recording: voiceData,
            submitted_at: new Date().toISOString(),
            status: 'resubmitted'
          })
          .eq('id', existingSubmission.id);
      } else {
        // Create new submission
        await supabase
          .from('dwxz_homework_submissions')
          .insert([{
            homework_id: selectedHomework.id,
            student_id: user?.id,
            content: submission.content,
            voice_recording: voiceData,
            status: 'submitted'
          }]);
      }

      setMessage({ type: 'success', text: t.success });
      setSelectedHomework(null);
      setSubmission({ content: '', voiceBlob: null });
      loadHomework();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const getDueStatus = (dueDate) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: t.overdue, color: 'var(--error)' };
    if (diffDays === 0) return { text: t.today, color: 'var(--warning)' };
    return { text: `${diffDays} ${t.daysLeft}`, color: 'var(--success)' };
  };

  const getStatusBadge = (status, score) => {
    if (status === 'graded') return <span className="badge badge-success">{t.graded}: {score}</span>;
    if (status === 'submitted') return <span className="badge badge-warning">{t.submitted}</span>;
    return <span className="badge badge-error">{t.pending}</span>;
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      {homework.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📚</div>
          <p style={{ color: 'var(--text-muted)' }}>{t.noHomework}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {homework.map(hw => (
            <div key={hw.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.25rem' }}>{hw.title_zh || hw.title}</h3>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {hw.classes?.name_zh || hw.classes?.name} • {hw.users?.name_zh || hw.users?.name}
                  </div>
                </div>
                {getStatusBadge(hw.status, hw.mySubmission?.score)}
              </div>

              {/* Due date */}
              <div style={{ 
                display: 'inline-block',
                padding: '0.25rem 0.5rem', 
                borderRadius: 'var(--radius-sm)', 
                background: 'var(--background)',
                fontSize: '0.875rem',
                marginBottom: '0.75rem'
              }}>
                📅 {t.dueDate}: {new Date(hw.due_date).toLocaleDateString()}
                <span style={{ marginLeft: '0.5rem', color: getDueStatus(hw.due_date).color }}>
                  ({getDueStatus(hw.due_date).text})
                </span>
              </div>

              {/* Description */}
              {hw.description && (
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {hw.description_zh || hw.description}
                </p>
              )}

              {/* Reading text (if this is a reading assignment) */}
              {hw.reading_text && (
                <div style={{ 
                  padding: '1rem', 
                  background: 'var(--background)', 
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '0.75rem',
                  borderLeft: '3px solid var(--primary)'
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    📖 {t.voiceReadingTip}
                  </div>
                  <div style={{ fontSize: '1.2rem', lineHeight: '2' }}>{hw.reading_text}</div>
                </div>
              )}

              {/* Teacher feedback panel */}
              {hw.mySubmission && (hw.status === 'graded' || hw.mySubmission.feedback) && (
                <div style={{
                  padding: '1rem',
                  background: 'linear-gradient(135deg, rgba(22,163,74,0.08), rgba(34,197,94,0.05))',
                  border: '1px solid rgba(22,163,74,0.25)',
                  borderLeft: '4px solid #16a34a',
                  borderRadius: '10px',
                  marginBottom: '0.75rem'
                }}>
                  <div style={{ fontWeight: 700, color: '#15803d', marginBottom: '0.5rem', fontSize: 14 }}>
                    👩‍🏫 {language === 'zh' ? '教师批改' : 'Teacher Feedback'}
                  </div>

                  {/* Score */}
                  {hw.mySubmission.score != null && (
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: hw.mySubmission.score >= 80 ? '#16a34a' : hw.mySubmission.score >= 60 ? '#d97706' : '#dc2626' }}>
                        {hw.mySubmission.score}
                      </span>
                      <span style={{ color:'#6b7280', fontSize:13 }}>/ 100</span>
                      <span style={{ padding:'2px 10px', borderRadius:12, fontSize:12, fontWeight:600,
                        background: hw.mySubmission.score>=80?'#d1fae5':hw.mySubmission.score>=60?'#fef3c7':'#fee2e2',
                        color: hw.mySubmission.score>=80?'#065f46':hw.mySubmission.score>=60?'#92400e':'#991b1b' }}>
                        {hw.mySubmission.score>=90?(language==='zh'?'优秀':'Excellent'):hw.mySubmission.score>=80?(language==='zh'?'良好':'Good'):hw.mySubmission.score>=60?(language==='zh'?'及格':'Pass'):(language==='zh'?'需加油':'Needs Work')}
                      </span>
                    </div>
                  )}

                  {/* Written feedback */}
                  {hw.mySubmission.feedback && (
                    <div style={{ background:'#fff', borderRadius:8, padding:'10px 12px', marginBottom:8, fontSize:14, lineHeight:1.8, color:'#1f2937' }}>
                      <div style={{ fontSize:11, color:'#6b7280', marginBottom:4 }}>💬 {language==='zh'?'评语':'Comment'}</div>
                      {hw.mySubmission.feedback}
                    </div>
                  )}

                  {/* Corrections / annotations */}
                  {hw.mySubmission.corrections && (
                    <div style={{ background:'#fefce8', borderRadius:8, padding:'10px 12px', marginBottom:8, fontSize:13, color:'#713f12' }}>
                      <div style={{ fontSize:11, color:'#92400e', marginBottom:4 }}>✏️ {language==='zh'?'纠正与批注':'Corrections'}</div>
                      <pre style={{ whiteSpace:'pre-wrap', fontFamily:'inherit', margin:0 }}>{hw.mySubmission.corrections}</pre>
                    </div>
                  )}

                  {/* Teacher audio feedback */}
                  {hw.mySubmission.teacher_correction_audio && (
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:12, color:'#15803d', fontWeight:600, marginBottom:4 }}>
                        🎤 {language==='zh'?'教师语音批改':'Teacher Audio Feedback'}
                      </div>
                      <audio controls src={hw.mySubmission.teacher_correction_audio}
                        style={{ width:'100%', borderRadius:8 }}/>
                    </div>
                  )}
                </div>
              )}

              {/* Submitted but not graded yet */}
              {hw.status === 'submitted' && hw.mySubmission && !hw.mySubmission.feedback && (
                <div style={{ padding:'8px 12px', background:'#fef3c7', borderRadius:8,
                  fontSize:12, color:'#92400e', marginBottom:'0.75rem' }}>
                  ⏳ {language==='zh'?'已提交，等待教师批改...':'Submitted, waiting for teacher feedback...'}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {hw.status === 'pending' && (
                  <button className="btn btn-primary" onClick={() => setSelectedHomework(hw)}>
                    ✏️ {t.submit}
                  </button>
                )}
                {hw.status === 'submitted' && (
                  <button className="btn btn-outline" onClick={() => setSelectedHomework(hw)}>
                    🔄 {t.resubmit}
                  </button>
                )}
                {hw.status === 'graded' && (
                  <button className="btn btn-outline" onClick={() => setSelectedHomework(hw)}>
                    👀 {t.viewFeedback}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Modal */}
      {selectedHomework && (
        <div className="modal-overlay" onClick={() => setSelectedHomework(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>
              {selectedHomework.status === 'graded' ? '📋' : '✏️'} {selectedHomework.title_zh || selectedHomework.title}
            </h3>

            {/* Instructions */}
            {selectedHomework.instructions && (
              <div style={{ 
                padding: '1rem', 
                background: 'var(--background)', 
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem'
              }}>
                <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>📋 {t.instructions}:</div>
                <div>{selectedHomework.instructions_zh || selectedHomework.instructions}</div>
              </div>
            )}

            {/* Reading text with teacher demo */}
            {selectedHomework.reading_text && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>📖 {t.voiceReading}:</div>
                <VoiceRecorder 
                  textToRead={selectedHomework.reading_text}
                  showDemo={true}
                  onRecordingComplete={(blob) => setSubmission({...submission, voiceBlob: blob})}
                  language={language}
                />
              </div>
            )}

            {/* Regular voice recorder (if no specific reading text) */}
            {!selectedHomework.reading_text && selectedHomework.type === 'reading' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>🎤 {t.voiceReading}:</div>
                <VoiceRecorder 
                  onRecordingComplete={(blob) => setSubmission({...submission, voiceBlob: blob})}
                  language={language}
                />
              </div>
            )}

            {/* Text answer */}
            {selectedHomework.status !== 'graded' && (
              <div className="form-group">
                <label className="form-label">📝 {t.textAnswer}:</label>
                <textarea 
                  className="form-textarea" 
                  rows={5} 
                  value={submission.content}
                  onChange={e => setSubmission({...submission, content: e.target.value})}
                  placeholder={language === 'zh' ? '在此输入你的答案...' : 'Enter your answer here...'}
                />
              </div>
            )}

            {/* Previous submission (if viewing) */}
            {selectedHomework.mySubmission && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>📤 {t.yourAnswer}:</div>
                <div style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: 'var(--radius-sm)' }}>
                  {selectedHomework.mySubmission.content || <em style={{ color: 'var(--text-muted)' }}>No text answer</em>}
                </div>
                
                {selectedHomework.mySubmission.voice_recording && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>🎤 {t.yourRecording}:</div>
                    <audio controls src={selectedHomework.mySubmission.voice_recording} style={{ width: '100%' }} />
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setSelectedHomework(null)}>
                {t.cancel}
              </button>
              {selectedHomework.status !== 'graded' && (
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1 }} 
                  onClick={handleSubmit}
                  disabled={!submission.content && !submission.voiceBlob}
                >
                  {t.submitBtn}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentHomeworkPage;
