import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const QuizManagementPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [message, setMessage] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    title_zh: '',
    title_en: '',
    description: '',
    quiz_type: 'vocabulary',
    hsk_level: 3,
    question_count: 10,
    time_limit: 30,
    questions: [],
    is_active: true
  });

  const [questionForm, setQuestionForm] = useState({
    question: '',
    type: 'multiple_choice',
    options: ['', '', '', ''],
    correct_answer: 0
  });

  const txt = {
    zh: {
      title: '测验管理',
      subtitle: '创建和管理学习测验',
      add: '创建测验',
      search: '搜索测验...',
      all: '全部',
      vocabulary: '词汇测验',
      grammar: '语法测验',
      reading: '阅读理解',
      listening: '听力测验',
      culture: '文化测验',
      chengyu: '成语测验',
      titleZh: '测验名称',
      titleEn: '名称(英文)',
      quizType: '测验类型',
      hskLevel: 'HSK等级',
      questionCount: '题目数量',
      timeLimit: '时间限制(分钟)',
      questions: '题目列表',
      addQuestion: '添加题目',
      question: '问题',
      questionType: '题型',
      multipleChoice: '选择题',
      fillBlank: '填空题',
      trueFalse: '判断题',
      options: '选项',
      correctAnswer: '正确答案',
      active: '已发布',
      inactive: '未发布',
      save: '保存',
      cancel: '取消',
      noData: '暂无测验',
      attempts: '次作答',
      avgScore: '平均分',
      preview: '预览',
      edit: '编辑'
    },
    en: {
      title: 'Quiz Management',
      subtitle: 'Create and manage learning quizzes',
      add: 'Create Quiz',
      search: 'Search quizzes...',
      all: 'All',
      vocabulary: 'Vocabulary',
      grammar: 'Grammar',
      reading: 'Reading',
      listening: 'Listening',
      culture: 'Culture',
      chengyu: 'Chengyu',
      titleZh: 'Quiz Name',
      titleEn: 'Name (English)',
      quizType: 'Quiz Type',
      hskLevel: 'HSK Level',
      questionCount: 'Questions',
      timeLimit: 'Time Limit (min)',
      questions: 'Questions',
      addQuestion: 'Add Question',
      question: 'Question',
      questionType: 'Type',
      multipleChoice: 'Multiple Choice',
      fillBlank: 'Fill in Blank',
      trueFalse: 'True/False',
      options: 'Options',
      correctAnswer: 'Correct Answer',
      active: 'Published',
      inactive: 'Unpublished',
      save: 'Save',
      cancel: 'Cancel',
      noData: 'No quizzes',
      attempts: 'attempts',
      avgScore: 'avg score',
      preview: 'Preview',
      edit: 'Edit'
    }
  };
  const t = txt[language] || txt.en;

  const quizTypes = [
    { id: 'vocabulary', icon: '📝', color: '#3b82f6' },
    { id: 'grammar', icon: '📖', color: '#8b5cf6' },
    { id: 'reading', icon: '📚', color: '#22c55e' },
    { id: 'listening', icon: '🎧', color: '#f59e0b' },
    { id: 'culture', icon: '🏮', color: '#ef4444' },
    { id: 'chengyu', icon: '📜', color: '#ec4899' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      setQuizzes([
        { id: 1, title_zh: 'HSK3词汇测验', title_en: 'HSK3 Vocabulary', quiz_type: 'vocabulary', hsk_level: 3, question_count: 20, time_limit: 30, attempts: 450, avg_score: 78, is_active: true },
        { id: 2, title_zh: '比较句语法练习', title_en: 'Comparison Grammar', quiz_type: 'grammar', hsk_level: 4, question_count: 15, time_limit: 25, attempts: 280, avg_score: 72, is_active: true },
        { id: 3, title_zh: '成语知识测验', title_en: 'Chengyu Quiz', quiz_type: 'chengyu', hsk_level: 5, question_count: 10, time_limit: 20, attempts: 190, avg_score: 65, is_active: true },
        { id: 4, title_zh: '中国文化常识', title_en: 'Chinese Culture', quiz_type: 'culture', hsk_level: 3, question_count: 25, time_limit: 40, attempts: 560, avg_score: 82, is_active: true },
        { id: 5, title_zh: '阅读理解练习', title_en: 'Reading Practice', quiz_type: 'reading', hsk_level: 4, question_count: 8, time_limit: 45, attempts: 120, avg_score: 70, is_active: false }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title_zh) {
      setMessage({ type: 'error', text: language === 'zh' ? '请填写测验名称' : 'Please enter quiz name' });
      return;
    }

    try {
      if (editItem) {
        setQuizzes(quizzes.map(q => q.id === editItem.id ? { ...q, ...form } : q));
        setMessage({ type: 'success', text: language === 'zh' ? '修改成功！' : 'Updated!' });
      } else {
        const newItem = { ...form, id: Date.now(), attempts: 0, avg_score: 0 };
        setQuizzes([newItem, ...quizzes]);
        setMessage({ type: 'success', text: language === 'zh' ? '创建成功！' : 'Created!' });
      }
      resetForm();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setForm({ ...item });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(language === 'zh' ? '确定删除此测验吗？' : 'Delete this quiz?')) return;
    setQuizzes(quizzes.filter(q => q.id !== id));
    setMessage({ type: 'success', text: language === 'zh' ? '删除成功！' : 'Deleted!' });
  };

  const resetForm = () => {
    setForm({
      title_zh: '', title_en: '', description: '', quiz_type: 'vocabulary',
      hsk_level: 3, question_count: 10, time_limit: 30, questions: [], is_active: true
    });
    setEditItem(null);
    setShowModal(false);
  };

  const filteredList = quizzes.filter(q =>
    (filterType === 'all' || q.quiz_type === filterType) &&
    (!searchTerm || q.title_zh?.includes(searchTerm) || q.title_en?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getQuizTypeInfo = (type) => quizTypes.find(q => q.id === type) || quizTypes[0];

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>❓ {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + {t.add}
        </button>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
          <button onClick={() => setMessage({ type: '', text: '' })} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          style={{ flex: 1, minWidth: '200px' }}
          placeholder={t.search}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterType('all')}
          >
            {t.all}
          </button>
          {quizTypes.map(type => (
            <button
              key={type.id}
              className={`btn btn-sm ${filterType === type.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilterType(type.id)}
            >
              {type.icon} {t[type.id]}
            </button>
          ))}
        </div>
      </div>

      {/* Quizzes Grid */}
      {filteredList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❓</div>
          <p style={{ color: 'var(--text-muted)' }}>{t.noData}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filteredList.map(quiz => {
            const typeInfo = getQuizTypeInfo(quiz.quiz_type);
            return (
              <div key={quiz.id} className="card">
                <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: `${typeInfo.color}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    flexShrink: 0
                  }}>
                    {typeInfo.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ marginBottom: '0.25rem' }}>{quiz.title_zh}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{quiz.title_en}</p>
                  </div>
                  {!quiz.is_active && (
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      background: '#f59e0b20',
                      color: '#f59e0b',
                      borderRadius: '4px',
                      fontSize: '0.75rem'
                    }}>
                      {t.inactive}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <span className="badge">{t[quiz.quiz_type]}</span>
                  <span className="badge badge-info">HSK {quiz.hsk_level}</span>
                  <span className="badge">{quiz.question_count} 题</span>
                  <span className="badge">{quiz.time_limit} 分钟</span>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  <span>📝 {quiz.attempts} {t.attempts}</span>
                  <span>📊 {quiz.avg_score}% {t.avgScore}</span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }}>{t.preview}</button>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => handleEdit(quiz)}>{t.edit}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => handleDelete(quiz.id)}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editItem ? '✏️ 编辑测验' : '❓ 创建测验'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t.quizType}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {quizTypes.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      style={{
                        padding: '0.75rem',
                        border: form.quiz_type === type.id ? `2px solid ${type.color}` : '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: form.quiz_type === type.id ? `${type.color}20` : 'var(--background)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onClick={() => setForm({ ...form, quiz_type: type.id })}
                    >
                      <span>{type.icon}</span>
                      <span style={{ fontSize: '0.875rem' }}>{t[type.id]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.titleZh} *</label>
                <input type="text" className="form-input" value={form.title_zh} onChange={e => setForm({ ...form, title_zh: e.target.value })} required />
              </div>

              <div className="form-group">
                <label className="form-label">{t.titleEn}</label>
                <input type="text" className="form-input" value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.hskLevel}</label>
                  <select className="form-select" value={form.hsk_level} onChange={e => setForm({ ...form, hsk_level: parseInt(e.target.value) })}>
                    {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.questionCount}</label>
                  <select className="form-select" value={form.question_count} onChange={e => setForm({ ...form, question_count: parseInt(e.target.value) })}>
                    {[5,10,15,20,25,30].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.timeLimit}</label>
                  <select className="form-select" value={form.time_limit} onChange={e => setForm({ ...form, time_limit: parseInt(e.target.value) })}>
                    {[10,15,20,30,45,60].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">状态</label>
                <select className="form-select" value={form.is_active ? 'active' : 'inactive'} onChange={e => setForm({ ...form, is_active: e.target.value === 'active' })}>
                  <option value="active">{t.active}</option>
                  <option value="inactive">{t.inactive}</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={resetForm}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizManagementPage;
