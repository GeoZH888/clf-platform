import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import VoiceRecorder from '../components/VoiceRecorder';

const TeacherGradingPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [grading, setGrading] = useState({ score: '', feedback: '', corrections: '', correctionBlob: null });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filter, setFilter] = useState('pending'); // pending, graded, all

  const txt = {
    zh: {
      title: '📋 作业批改',
      pending: '待批改',
      graded: '已批改',
      all: '全部',
      student: '学生',
      homework: '作业',
      submittedAt: '提交时间',
      grade: '批改',
      viewDetails: '查看详情',
      score: '分数',
      feedback: '评语',
      voiceCorrection: '语音纠正',
      voiceCorrectionTip: '录制语音纠正示范',
      demoReading: '示范朗读',
      studentRecording: '学生录音',
      studentAnswer: '学生答案',
      readingText: '朗读文本',
      submit: '提交评分',
      cancel: '取消',
      noSubmissions: '暂无待批改作业',
      success: '批改成功！',
      failed: '批改失败',
      playStudent: '播放学生录音',
      recordCorrection: '录制纠正',
      excellent: '优秀',
      good: '良好',
      average: '一般',
      needsWork: '需要加强',
      quickFeedback: '快速评语',
      pronunciationGood: '发音准确',
      pronunciationNeedsWork: '发音需要练习',
      toneGood: '声调正确',
      toneNeedsWork: '声调需要注意',
      fluencyGood: '流利度好',
      fluencyNeedsWork: '需要更流利'
    },
    en: {
      title: '📋 Grade Homework',
      pending: 'Pending',
      graded: 'Graded',
      all: 'All',
      student: 'Student',
      homework: 'Homework',
      submittedAt: 'Submitted',
      grade: 'Grade',
      viewDetails: 'Details',
      score: 'Score',
      feedback: 'Feedback',
      voiceCorrection: 'Voice Correction',
      voiceCorrectionTip: 'Record voice correction demo',
      demoReading: 'Demo Reading',
      studentRecording: 'Student Recording',
      studentAnswer: 'Student Answer',
      readingText: 'Reading Text',
      submit: 'Submit Grade',
      cancel: 'Cancel',
      noSubmissions: 'No submissions to grade',
      success: 'Graded successfully!',
      failed: 'Grading failed',
      playStudent: 'Play Student Recording',
      recordCorrection: 'Record Correction',
      excellent: 'Excellent',
      good: 'Good',
      average: 'Average',
      needsWork: 'Needs Work',
      quickFeedback: 'Quick Feedback',
      pronunciationGood: 'Good pronunciation',
      pronunciationNeedsWork: 'Pronunciation needs practice',
      toneGood: 'Correct tones',
      toneNeedsWork: 'Tones need attention',
      fluencyGood: 'Good fluency',
      fluencyNeedsWork: 'Needs more fluency'
    },
    it: {
      title: '📋 Valuta Compiti',
      pending: 'In Sospeso',
      graded: 'Valutati',
      all: 'Tutti',
      student: 'Studente',
      homework: 'Compito',
      submittedAt: 'Inviato',
      grade: 'Valuta',
      viewDetails: 'Dettagli',
      score: 'Punteggio',
      feedback: 'Feedback',
      voiceCorrection: 'Correzione Vocale',
      voiceCorrectionTip: 'Registra demo di correzione',
      demoReading: 'Demo Lettura',
      studentRecording: 'Registrazione Studente',
      studentAnswer: 'Risposta Studente',
      readingText: 'Testo da Leggere',
      submit: 'Invia Valutazione',
      cancel: 'Annulla',
      noSubmissions: 'Nessun compito da valutare',
      success: 'Valutato con successo!',
      failed: 'Valutazione fallita',
      playStudent: 'Riproduci Studente',
      recordCorrection: 'Registra Correzione',
      excellent: 'Eccellente',
      good: 'Buono',
      average: 'Sufficiente',
      needsWork: 'Da Migliorare',
      quickFeedback: 'Feedback Rapido',
      pronunciationGood: 'Buona pronuncia',
      pronunciationNeedsWork: 'Pronuncia da migliorare',
      toneGood: 'Toni corretti',
      toneNeedsWork: 'Toni da rivedere',
      fluencyGood: 'Buona fluidità',
      fluencyNeedsWork: 'Più fluidità necessaria'
    }
  };
  const t = txt[language] || txt.en;

  // Quick feedback templates
  const quickFeedbacks = {
    pronunciation: [
      { score: 90, text: t.pronunciationGood },
      { score: 60, text: t.pronunciationNeedsWork }
    ],
    tone: [
      { score: 85, text: t.toneGood },
      { score: 55, text: t.toneNeedsWork }
    ],
    fluency: [
      { score: 80, text: t.fluencyGood },
      { score: 50, text: t.fluencyNeedsWork }
    ]
  };

  useEffect(() => {
    loadSubmissions();
  }, [filter]);

  const loadSubmissions = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Get teacher's classes
      const { data: classes } = await supabase
        .from('dwxz_classes')
        .select('id')
        .eq('teacher_id', user?.id);

      const classIds = classes?.map(c => c.id) || [];

      if (classIds.length === 0) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      // Get homework for those classes
      const { data: homeworkData } = await supabase
        .from('dwxz_homework')
        .select('id')
        .in('class_id', classIds);

      const homeworkIds = homeworkData?.map(h => h.id) || [];

      if (homeworkIds.length === 0) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      // Get submissions
      let query = supabase
        .from('dwxz_homework_submissions')
        .select(`
          *,
          homework(*),
          users!homework_submissions_student_id_fkey(name, name_zh, username)
        `)
        .in('homework_id', homeworkIds)
        .order('submitted_at', { ascending: false });

      if (filter === 'pending') {
        query = query.is('score', null);
      } else if (filter === 'graded') {
        query = query.not('score', 'is', null);
      }

      const { data } = await query;
      setSubmissions(data || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGrade = async () => {
    if (!selectedSubmission || !grading.score) return;

    try {
      // Convert voice blob to base64 if exists
      let correctionData = null;
      if (grading.correctionBlob) {
        correctionData = await blobToBase64(grading.correctionBlob);
      }

      await supabase
        .from('dwxz_homework_submissions')
        .update({
          score: parseInt(grading.score),
          feedback: grading.feedback,
          corrections: grading.corrections || null,
          teacher_correction_audio: correctionData,
          graded_at: new Date().toISOString(),
          graded_by: user?.id
        })
        .eq('id', selectedSubmission.id);

      setMessage({ type: 'success', text: t.success });
      setSelectedSubmission(null);
      setGrading({ score: '', feedback: '', correctionBlob: null });
      loadSubmissions();
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

  const addQuickFeedback = (text) => {
    setGrading({
      ...grading,
      feedback: grading.feedback ? `${grading.feedback}\n${text}` : text
    });
  };

  const setQuickScore = (score) => {
    setGrading({ ...grading, score: score.toString() });
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

      {/* Filter tabs */}
      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button 
          className={`tab ${filter === 'pending' ? 'active' : ''}`} 
          onClick={() => setFilter('pending')}
        >
          ⏳ {t.pending} ({submissions.filter(s => s.score == null).length})
        </button>
        <button 
          className={`tab ${filter === 'graded' ? 'active' : ''}`} 
          onClick={() => setFilter('graded')}
        >
          ✅ {t.graded}
        </button>
        <button 
          className={`tab ${filter === 'all' ? 'active' : ''}`} 
          onClick={() => setFilter('all')}
        >
          📋 {t.all}
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <p style={{ color: 'var(--text-muted)' }}>{t.noSubmissions}</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t.student}</th>
                  <th>{t.homework}</th>
                  <th>{t.submittedAt}</th>
                  <th>{t.score}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <tr key={sub.id}>
                    <td>
                      <strong>{sub.users?.name_zh || sub.users?.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        @{sub.users?.username}
                      </div>
                    </td>
                    <td>{sub.homework?.title_zh || sub.homework?.title}</td>
                    <td>{new Date(sub.submitted_at).toLocaleString()}</td>
                    <td>
                      {sub.score != null ? (
                        <span className="badge badge-success">{sub.score}/100</span>
                      ) : (
                        <span className="badge badge-warning">{t.pending}</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setGrading({ 
                            score: sub.score?.toString() || '', 
                            feedback: sub.feedback || '',
                            corrections: sub.corrections || '',
                            correctionBlob: null 
                          });
                        }}
                      >
                        {sub.score != null ? t.viewDetails : t.grade}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grading Modal */}
      {selectedSubmission && (
        <div className="modal-overlay" onClick={() => setSelectedSubmission(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>
              📋 {selectedSubmission.homework?.title_zh || selectedSubmission.homework?.title}
            </h3>
            
            <div style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
              {t.student}: <strong>{selectedSubmission.users?.name_zh || selectedSubmission.users?.name}</strong>
            </div>

            {/* Reading text (if applicable) */}
            {selectedSubmission.homework?.reading_text && (
              <div style={{ 
                padding: '1rem', 
                background: 'var(--background)', 
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                borderLeft: '3px solid var(--primary)'
              }}>
                <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>📖 {t.readingText}:</div>
                <div style={{ fontSize: '1.1rem', lineHeight: '1.8' }}>
                  {selectedSubmission.homework.reading_text}
                </div>
              </div>
            )}

            {/* Student's text answer */}
            {selectedSubmission.content && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>📝 {t.studentAnswer}:</div>
                <div style={{ 
                  padding: '0.75rem', 
                  background: 'var(--background)', 
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedSubmission.content}
                </div>
              </div>
            )}

            {/* Student's voice recording */}
            {selectedSubmission.voice_recording && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>🎤 {t.studentRecording}:</div>
                <audio controls src={selectedSubmission.voice_recording} style={{ width: '100%' }} />
              </div>
            )}

            {/* Teacher voice feedback — always available */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                🎤 {language==='zh'?'语音批改反馈':'Voice Feedback'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {language==='zh'?'录制语音给学生反馈（学生可在作业详情里播放）':'Record voice feedback for the student to hear'}
              </div>
              {/* Existing correction if any */}
              {selectedSubmission.teacher_correction_audio && (
                <div style={{ marginBottom:'0.5rem' }}>
                  <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:4 }}>
                    {language==='zh'?'已有录音：':'Existing recording:'}
                  </div>
                  <audio controls src={selectedSubmission.teacher_correction_audio} style={{ width:'100%' }}/>
                </div>
              )}
              <VoiceRecorder
                textToRead={selectedSubmission.homework?.reading_text || ''}
                showDemo={!!selectedSubmission.homework?.reading_text}
                showCorrection={true}
                existingAudioUrl={selectedSubmission.teacher_correction_audio}
                onRecordingComplete={(blob) => setGrading({...grading, correctionBlob: blob})}
                language={language}
              />
              {grading.correctionBlob && (
                <div style={{ fontSize:'0.8rem', color:'#16a34a', marginTop:4 }}>
                  ✅ {language==='zh'?'新录音已准备，提交批改后保存':'New recording ready — will save on submit'}
                </div>
              )}
            </div>

            {/* Corrections / annotations text field */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                ✏️ {language==='zh'?'批注与纠正（可选）':'Corrections & Annotations'}
              </div>
              <textarea
                className="form-input"
                rows={3}
                value={grading.corrections || ''}
                onChange={e => setGrading({...grading, corrections: e.target.value})}
                placeholder={language==='zh'?'在此写具体纠正内容，如：第2题"是"应改为"有"，注意第三声变调...':'Write specific corrections here, e.g. Q2 answer should be...'}
                style={{ width:'100%', resize:'vertical', fontFamily:'inherit' }}
              />
            </div>

            {/* Quick score buttons */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>{t.score}:</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <button className={`btn btn-sm ${grading.score === '100' ? 'btn-success' : 'btn-outline'}`} onClick={() => setQuickScore(100)}>
                  🌟 100 ({t.excellent})
                </button>
                <button className={`btn btn-sm ${grading.score === '85' ? 'btn-success' : 'btn-outline'}`} onClick={() => setQuickScore(85)}>
                  👍 85 ({t.good})
                </button>
                <button className={`btn btn-sm ${grading.score === '70' ? 'btn-warning' : 'btn-outline'}`} onClick={() => setQuickScore(70)}>
                  👌 70 ({t.average})
                </button>
                <button className={`btn btn-sm ${grading.score === '50' ? 'btn-error' : 'btn-outline'}`} onClick={() => setQuickScore(50)}>
                  📈 50 ({t.needsWork})
                </button>
              </div>
              <input 
                type="number" 
                className="form-input" 
                value={grading.score}
                onChange={e => setGrading({...grading, score: e.target.value})}
                placeholder="0-100"
                min="0"
                max="100"
                style={{ width: '120px' }}
              />
            </div>

            {/* Quick feedback buttons */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>{t.quickFeedback}:</div>
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {Object.values(quickFeedbacks).flat().map((fb, i) => (
                  <button 
                    key={i} 
                    className="btn btn-outline btn-sm"
                    onClick={() => addQuickFeedback(fb.text)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    + {fb.text}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback textarea */}
            <div className="form-group">
              <label className="form-label">{t.feedback}:</label>
              <textarea 
                className="form-textarea" 
                rows={4} 
                value={grading.feedback}
                onChange={e => setGrading({...grading, feedback: e.target.value})}
                placeholder={language === 'zh' ? '输入评语...' : 'Enter feedback...'}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setSelectedSubmission(null)}>
                {t.cancel}
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }} 
                onClick={handleGrade}
                disabled={!grading.score}
              >
                {t.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherGradingPage;
