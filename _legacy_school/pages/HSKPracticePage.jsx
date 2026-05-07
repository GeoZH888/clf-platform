import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const HSKPracticePage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [papers, setPapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [attempt, setAttempt] = useState(null);
  const [filterLevel, setFilterLevel] = useState('');
  const [mode, setMode] = useState('select'); // select, practice, results
  const [timeSpent, setTimeSpent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  const txt = {
    zh: {
      title: 'HSK真题练习',
      subtitle: '选择试卷开始练习',
      selectPaper: '选择试卷',
      startPractice: '开始练习',
      submit: '提交答案',
      next: '下一题',
      prev: '上一题',
      finish: '完成',
      score: '得分',
      correct: '正确',
      wrong: '错误',
      unanswered: '未答',
      timeSpent: '用时',
      minutes: '分钟',
      seconds: '秒',
      tryAgain: '再做一次',
      backToList: '返回列表',
      listening: '听力',
      reading: '阅读',
      writing: '书写',
      playAudio: '播放音频',
      pauseAudio: '暂停',
      yourAnswer: '你的答案',
      correctAnswer: '正确答案',
      explanation: '解析',
      question: '第',
      of: '题 / 共',
      total: '题',
      noTests: '暂无可用试卷',
      official: '真题',
      mock: '模拟题',
      practice: '练习题'
    },
    en: {
      title: 'HSK Practice',
      subtitle: 'Select a test paper to start',
      selectPaper: 'Select Paper',
      startPractice: 'Start Practice',
      submit: 'Submit Answers',
      next: 'Next',
      prev: 'Previous',
      finish: 'Finish',
      score: 'Score',
      correct: 'Correct',
      wrong: 'Wrong',
      unanswered: 'Unanswered',
      timeSpent: 'Time Spent',
      minutes: 'min',
      seconds: 'sec',
      tryAgain: 'Try Again',
      backToList: 'Back to List',
      listening: 'Listening',
      reading: 'Reading',
      writing: 'Writing',
      playAudio: 'Play Audio',
      pauseAudio: 'Pause',
      yourAnswer: 'Your Answer',
      correctAnswer: 'Correct Answer',
      explanation: 'Explanation',
      question: 'Question',
      of: 'of',
      total: '',
      noTests: 'No tests available',
      official: 'Official',
      mock: 'Mock',
      practice: 'Practice'
    }
  };
  const t = txt[language] || txt.zh;

  // Load papers
  useEffect(() => {
    loadPapers();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [supabase]);

  const loadPapers = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('hsk_test_papers')
        .select('*')
        .eq('is_active', true)
        .order('hsk_level')
        .order('year', { ascending: false });
      setPapers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Start practice
  const startPractice = async (paper) => {
    setSelectedPaper(paper);
    setLoading(true);
    
    try {
      // Load questions
      const { data: questionsData } = await supabase
        .from('hsk_test_questions')
        .select('*')
        .eq('paper_id', paper.id)
        .order('question_number');
      
      setQuestions(questionsData || []);
      setAnswers({});
      setCurrentQuestion(0);
      setShowResults(false);
      setTimeSpent(0);
      setMode('practice');
      
      // Create attempt record
      const { data: attemptData } = await supabase
        .from('hsk_test_attempts')
        .insert([{
          student_id: user?.id,
          paper_id: paper.id,
          status: 'in_progress'
        }])
        .select()
        .single();
      
      setAttempt(attemptData);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Submit answers
  const submitAnswers = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    questions.forEach(q => {
      totalPoints += q.points || 1;
      const userAnswer = answers[q.id];
      
      if (!userAnswer) {
        unanswered++;
      } else if (userAnswer === q.correct_answer) {
        correct++;
        earnedPoints += q.points || 1;
      } else {
        wrong++;
      }
    });

    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints * 100) : 0;

    // Update attempt
    if (attempt && supabase) {
      await supabase
        .from('hsk_test_attempts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          time_spent: timeSpent,
          total_score: earnedPoints,
          max_score: totalPoints,
          percentage: percentage,
          correct_count: correct,
          wrong_count: wrong,
          unanswered_count: unanswered
        })
        .eq('id', attempt.id);

      // Save individual answers
      const answerRecords = questions.map(q => ({
        attempt_id: attempt.id,
        question_id: q.id,
        student_answer: answers[q.id] || null,
        is_correct: answers[q.id] === q.correct_answer,
        points_earned: answers[q.id] === q.correct_answer ? (q.points || 1) : 0
      }));

      await supabase.from('hsk_test_answers').insert(answerRecords);
    }

    setShowResults(true);
    setMode('results');
  };

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate score
  const calculateScore = () => {
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) correct++;
    });
    return {
      correct,
      wrong: Object.keys(answers).length - correct,
      unanswered: questions.length - Object.keys(answers).length,
      percentage: questions.length > 0 ? (correct / questions.length * 100).toFixed(1) : 0
    };
  };

  // Current question
  const question = questions[currentQuestion];
  const score = calculateScore();

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  // Select mode - show paper list
  if (mode === 'select') {
    return (
      <div>
        <div className="content-header">
          <h1>📝 {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>

        {/* Level filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button 
            className={`btn ${!filterLevel ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterLevel('')}
          >
            全部
          </button>
          {[1, 2, 3, 4, 5, 6].map(level => (
            <button
              key={level}
              className={`btn ${filterLevel === level ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilterLevel(level)}
            >
              HSK{level}
            </button>
          ))}
        </div>

        {/* Paper grid */}
        {papers.filter(p => !filterLevel || p.hsk_level === filterLevel).length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
            <p style={{ color: 'var(--text-muted)' }}>{t.noTests}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {papers
              .filter(p => !filterLevel || p.hsk_level === filterLevel)
              .map(paper => (
              <div key={paper.id} className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <span className="badge badge-info" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                      HSK{paper.hsk_level}
                    </span>
                  </div>
                  <span className="badge">{t[paper.test_type] || paper.test_type}</span>
                </div>
                
                <h3 style={{ margin: '0 0 0.5rem' }}>{paper.name_zh || paper.name}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
                  {paper.year}年 · {paper.source}
                </p>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  <div>🎧 {t.listening}: {paper.listening_questions}</div>
                  <div>📖 {t.reading}: {paper.reading_questions}</div>
                  <div>✍️ {t.writing}: {paper.writing_questions}</div>
                </div>
                
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                  onClick={() => startPractice(paper)}
                >
                  🚀 {t.startPractice}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Practice mode
  if (mode === 'practice' && question) {
    const options = (() => {
      try {
        return typeof question.options === 'string' ? JSON.parse(question.options) : (question.options || []);
      } catch {
        return [];
      }
    })();

    return (
      <div>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '1rem',
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="badge badge-info" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
              HSK{selectedPaper?.hsk_level}
            </span>
            <span style={{ fontWeight: 600 }}>{selectedPaper?.name_zh}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ fontSize: '1.25rem', fontFamily: 'monospace' }}>
              ⏱️ {formatTime(timeSpent)}
            </div>
            <div>
              {t.question} {currentQuestion + 1} {t.of} {questions.length} {t.total}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          marginBottom: '1.5rem',
          flexWrap: 'wrap'
        }}>
          {questions.map((q, idx) => (
            <div
              key={q.id}
              onClick={() => setCurrentQuestion(idx)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: answers[q.id] 
                  ? 'var(--primary)' 
                  : idx === currentQuestion 
                    ? 'var(--warning)' 
                    : 'var(--border)',
                color: answers[q.id] || idx === currentQuestion ? 'white' : 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              {idx + 1}
            </div>
          ))}
        </div>

        {/* Question */}
        <div className="card" style={{ padding: '2rem' }}>
          {/* Section badge */}
          <div style={{ marginBottom: '1rem' }}>
            <span className={`badge ${
              question.section_type === 'listening' ? '' : 
              question.section_type === 'reading' ? 'badge-info' : 'badge-success'
            }`} style={{ 
              background: question.section_type === 'listening' ? 'var(--primary)' : undefined 
            }}>
              {question.section_type === 'listening' && '🎧'} 
              {question.section_type === 'reading' && '📖'} 
              {question.section_type === 'writing' && '✍️'} 
              {t[question.section_type]}
            </span>
          </div>

          {/* Audio player for listening */}
          {question.section_type === 'listening' && question.audio_transcript && (
            <div style={{ 
              background: 'var(--background)', 
              padding: '1rem', 
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? '⏸️ ' + t.pauseAudio : '▶️ ' + t.playAudio}
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  (模拟播放 - 请阅读转录文本)
                </span>
              </div>
              {isPlaying && (
                <div style={{ 
                  padding: '1rem', 
                  background: 'var(--card)', 
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '1rem',
                  lineHeight: 1.8
                }}>
                  {question.audio_transcript}
                </div>
              )}
            </div>
          )}

          {/* Question text */}
          <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.25rem' }}>
            {question.question_number}. {question.question_text_zh || question.question_text}
          </h3>

          {/* Options */}
          {question.question_type === 'choice' && options.length > 0 && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {options.map(opt => (
                <div
                  key={opt.id}
                  onClick={() => setAnswers({ ...answers, [question.id]: opt.id })}
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: answers[question.id] === opt.id 
                      ? '2px solid var(--primary)' 
                      : '1px solid var(--border)',
                    background: answers[question.id] === opt.id 
                      ? 'rgba(139, 92, 246, 0.1)' 
                      : 'var(--card)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: answers[question.id] === opt.id ? 'var(--primary)' : 'var(--border)',
                    color: answers[question.id] === opt.id ? 'white' : 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600
                  }}>
                    {opt.id}
                  </div>
                  <span style={{ fontSize: '1.1rem' }}>{opt.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* True/False */}
          {question.question_type === 'true_false' && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              {['对', '错'].map(opt => (
                <button
                  key={opt}
                  className={`btn ${answers[question.id] === opt ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1, padding: '1rem', fontSize: '1.25rem' }}
                  onClick={() => setAnswers({ ...answers, [question.id]: opt })}
                >
                  {opt === '对' ? '✓ 对' : '✗ 错'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          <button 
            className="btn btn-outline"
            disabled={currentQuestion === 0}
            onClick={() => setCurrentQuestion(prev => prev - 1)}
          >
            ← {t.prev}
          </button>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {currentQuestion < questions.length - 1 ? (
              <button 
                className="btn btn-primary"
                onClick={() => setCurrentQuestion(prev => prev + 1)}
              >
                {t.next} →
              </button>
            ) : (
              <button 
                className="btn btn-primary"
                onClick={submitAnswers}
              >
                ✓ {t.submit}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Results mode
  if (mode === 'results') {
    return (
      <div>
        <div className="content-header" style={{ textAlign: 'center' }}>
          <h1>🎉 练习完成！</h1>
          <p style={{ color: 'var(--text-muted)' }}>{selectedPaper?.name_zh}</p>
        </div>

        {/* Score summary */}
        <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '4rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>
            {score.percentage}%
          </div>
          <div style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
            {score.correct} / {questions.length} {t.correct}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--success)' }}>{score.correct}</div>
              <div style={{ color: 'var(--text-muted)' }}>✓ {t.correct}</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--danger)' }}>{score.wrong}</div>
              <div style={{ color: 'var(--text-muted)' }}>✗ {t.wrong}</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--warning)' }}>{score.unanswered}</div>
              <div style={{ color: 'var(--text-muted)' }}>- {t.unanswered}</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 600 }}>{formatTime(timeSpent)}</div>
              <div style={{ color: 'var(--text-muted)' }}>⏱️ {t.timeSpent}</div>
            </div>
          </div>
        </div>

        {/* Question review */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>📋 答题详情</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {questions.map((q, idx) => {
              const userAnswer = answers[q.id];
              const isCorrect = userAnswer === q.correct_answer;
              const options = (() => {
                try {
                  return typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
                } catch {
                  return [];
                }
              })();

              return (
                <div 
                  key={q.id} 
                  style={{ 
                    padding: '1rem',
                    background: isCorrect ? 'rgba(34, 197, 94, 0.1)' : userAnswer ? 'rgba(239, 68, 68, 0.1)' : 'var(--background)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `4px solid ${isCorrect ? 'var(--success)' : userAnswer ? 'var(--danger)' : 'var(--warning)'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                        {idx + 1}. {q.question_text_zh || q.question_text}
                      </div>
                      
                      {q.audio_transcript && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                          🎧 {q.audio_transcript.substring(0, 80)}...
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                        <span>
                          {t.yourAnswer}: 
                          <strong style={{ color: isCorrect ? 'var(--success)' : 'var(--danger)', marginLeft: '0.25rem' }}>
                            {userAnswer || '-'}
                          </strong>
                        </span>
                        {!isCorrect && (
                          <span>
                            {t.correctAnswer}: 
                            <strong style={{ color: 'var(--success)', marginLeft: '0.25rem' }}>
                              {q.correct_answer}
                            </strong>
                          </span>
                        )}
                      </div>
                      
                      {q.answer_explanation_zh && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--card)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
                          💡 {q.answer_explanation_zh}
                        </div>
                      )}
                    </div>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%',
                      background: isCorrect ? 'var(--success)' : userAnswer ? 'var(--danger)' : 'var(--warning)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem'
                    }}>
                      {isCorrect ? '✓' : userAnswer ? '✗' : '-'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="btn btn-outline" onClick={() => setMode('select')}>
            ← {t.backToList}
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => startPractice(selectedPaper)}>
            🔄 {t.tryAgain}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default HSKPracticePage;
