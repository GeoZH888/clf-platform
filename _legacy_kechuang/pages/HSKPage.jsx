import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const HSKPage = () => {
  const { user, isStudent, supabase } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState('practice');
  const [registrations, setRegistrations] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerData, setRegisterData] = useState({ level: 1, exam_date: '', exam_location: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      if (supabase && user) {
        const [regsRes, progressRes] = await Promise.all([
          supabase.from('dwxz_hsk_registrations').select('*').eq('student_id', user.id),
          supabase.from('dwxz_hsk_practice').select('*, question:hsk_questions(*)').eq('student_id', user.id)
        ]);
        setRegistrations(regsRes.data || []);
        setProgress(progressRes.data || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const startPractice = async (level) => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('dwxz_hsk_questions')
        .select('*')
        .eq('level', level)
        .eq('is_active', true)
        .limit(10);
      setQuestions(data || []);
      setSelectedLevel(level);
      setCurrentQuestion(0);
      setAnswers({});
      setShowResults(false);
      setActiveTab('test');
    } catch (error) {
      alert('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
    try {
      const question = questions.find(q => q.id === questionId);
      await supabase.from('dwxz_hsk_practice').insert([{
        student_id: user.id,
        question_id: questionId,
        user_answer: answer,
        is_correct: answer === question?.correct_answer
      }]);
    } catch (error) {
      console.error('Failed to submit answer:', error);
    }
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResults(true);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) correct++;
    });
    return Math.round((correct / questions.length) * 100);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await hskAPI.register(registerData);
      setShowRegisterModal(false);
      setRegisterData({ level: 1, exam_date: '', exam_location: '' });
      loadData();
    } catch (error) {
      alert(error.response?.data?.message || 'Registration failed');
    }
  };

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header">
        <h1>{t('hsk.title')} 🏆</h1>
        {isStudent && (
          <button className="btn btn-primary" onClick={() => setShowRegisterModal(true)}>
            + {t('hsk.register')}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${activeTab === 'practice' ? 'active' : ''}`} onClick={() => setActiveTab('practice')}>
          {t('hsk.practice')}
        </button>
        <button className={`tab ${activeTab === 'test' ? 'active' : ''}`} onClick={() => setActiveTab('test')}>
          {t('hsk.self_test')}
        </button>
        <button className={`tab ${activeTab === 'registrations' ? 'active' : ''}`} onClick={() => setActiveTab('registrations')}>
          {language === 'zh' ? '我的报名' : language === 'it' ? 'Mie Iscrizioni' : 'My Registrations'}
        </button>
        <button className={`tab ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
          {t('hsk.view_progress')}
        </button>
      </div>

      {/* Practice Tab */}
      {activeTab === 'practice' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4, 5, 6].map(level => (
            <div key={level} className="card" style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>HSK {level}</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {level <= 2 ? (language === 'zh' ? '初级' : language === 'it' ? 'Principiante' : 'Beginner') :
                 level <= 4 ? (language === 'zh' ? '中级' : language === 'it' ? 'Intermedio' : 'Intermediate') :
                 (language === 'zh' ? '高级' : language === 'it' ? 'Avanzato' : 'Advanced')}
              </p>
              <button className="btn btn-primary" onClick={() => startPractice(level)}>
                {t('hsk.start_practice')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Test Tab */}
      {activeTab === 'test' && questions.length > 0 && (
        <div className="card">
          {!showResults ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span className="badge badge-primary">HSK {selectedLevel}</span>
                <span>{language === 'zh' ? '题目' : language === 'it' ? 'Domanda' : 'Question'} {currentQuestion + 1}/{questions.length}</span>
              </div>
              
              <div className="progress-bar" style={{ marginBottom: '2rem' }}>
                <div className="progress-fill" style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}></div>
              </div>

              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ fontSize: '2.5rem', marginBottom: '2rem' }}>{questions[currentQuestion]?.question}</h2>
                
                {questions[currentQuestion]?.options && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '500px', margin: '0 auto' }}>
                    {questions[currentQuestion].options.map((option, idx) => (
                      <button
                        key={idx}
                        className={`btn ${answers[questions[currentQuestion].id] === option ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '1rem' }}
                        onClick={() => handleAnswer(questions[currentQuestion].id, option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                <button 
                  className="btn btn-primary btn-lg" 
                  style={{ marginTop: '2rem' }}
                  onClick={nextQuestion}
                  disabled={!answers[questions[currentQuestion]?.id]}
                >
                  {currentQuestion < questions.length - 1 ? 
                    (language === 'zh' ? '下一题' : language === 'it' ? 'Prossima' : 'Next') :
                    (language === 'zh' ? '完成' : language === 'it' ? 'Finisci' : 'Finish')}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <h2 style={{ fontSize: '4rem', marginBottom: '1rem' }}>{calculateScore()}%</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                {language === 'zh' ? '正确' : language === 'it' ? 'Corrette' : 'Correct'}: {Object.keys(answers).filter(id => answers[id] === questions.find(q => q.id === id)?.correct_answer).length}/{questions.length}
              </p>
              
              <div style={{ marginTop: '2rem' }}>
                {questions.map((q, idx) => (
                  <div key={idx} style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{q.question}</span>
                    <span className={`badge badge-${answers[q.id] === q.correct_answer ? 'success' : 'error'}`}>
                      {answers[q.id] === q.correct_answer ? '✓' : `✗ ${q.correct_answer}`}
                    </span>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary btn-lg" style={{ marginTop: '2rem' }} onClick={() => setActiveTab('practice')}>
                {language === 'zh' ? '返回' : language === 'it' ? 'Indietro' : 'Back'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Registrations Tab */}
      {activeTab === 'registrations' && (
        <div className="card">
          {registrations.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('hsk.level')}</th>
                    <th>{t('hsk.exam_date')}</th>
                    <th>{language === 'zh' ? '报名号' : language === 'it' ? 'Numero' : 'Registration #'}</th>
                    <th>{language === 'zh' ? '状态' : language === 'it' ? 'Stato' : 'Status'}</th>
                    <th>{language === 'zh' ? '成绩' : language === 'it' ? 'Risultato' : 'Result'}</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg, idx) => (
                    <tr key={idx}>
                      <td>HSK {reg.level}</td>
                      <td>{reg.exam_date ? new Date(reg.exam_date).toLocaleDateString() : 'TBD'}</td>
                      <td>{reg.registration_number}</td>
                      <td><span className={`badge badge-${reg.status === 'confirmed' ? 'success' : 'warning'}`}>{reg.status}</span></td>
                      <td>{reg.result_score || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <span style={{ fontSize: '4rem' }}>📋</span>
              <p>{language === 'zh' ? '暂无报名记录' : language === 'it' ? 'Nessuna iscrizione' : 'No registrations'}</p>
            </div>
          )}
        </div>
      )}

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <div className="card">
          {progress.length > 0 ? (
            <div>
              {progress.map((p, idx) => (
                <div key={idx} style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong>HSK {p.level}</strong>
                    <span>{p.accuracy}% {language === 'zh' ? '正确率' : language === 'it' ? 'precisione' : 'accuracy'}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${p.accuracy}%` }}></div>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {p.total_questions} {language === 'zh' ? '题已练习' : language === 'it' ? 'domande praticate' : 'questions practiced'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span style={{ fontSize: '4rem' }}>📊</span>
              <p>{language === 'zh' ? '开始练习以查看进度' : language === 'it' ? 'Inizia a praticare' : 'Start practicing to see progress'}</p>
            </div>
          )}
        </div>
      )}

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('hsk.register')}</h3>
              <button onClick={() => setShowRegisterModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleRegister}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">{t('hsk.level')} *</label>
                  <select className="form-select" value={registerData.level} onChange={e => setRegisterData({...registerData, level: e.target.value})}>
                    {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('hsk.exam_date')} *</label>
                  <input type="date" className="form-input" value={registerData.exam_date} onChange={e => setRegisterData({...registerData, exam_date: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{language === 'zh' ? '考试地点' : language === 'it' ? 'Luogo Esame' : 'Exam Location'}</label>
                  <input type="text" className="form-input" value={registerData.exam_location} onChange={e => setRegisterData({...registerData, exam_location: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowRegisterModal(false)}>{t('cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('hsk.register')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HSKPage;
