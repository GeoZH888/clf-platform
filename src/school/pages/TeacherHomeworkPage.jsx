import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const TeacherHomeworkPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [homework, setHomework] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assign');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [assignForm, setAssignForm] = useState({
    title: '',
    description: '',
    instructions: '',
    due_date: '',
    max_score: 100,
    assign_type: 'class',
    class_id: '',
    student_ids: [],
    allow_voice: true,
    allow_file_upload: true
  });

  const [reviewForm, setReviewForm] = useState({
    score: '',
    feedback: ''
  });

  const txt = {
    zh: {
      title: '作业管理',
      subtitle: '布置和批改学生作业',
      assign: '布置作业',
      review: '批改作业',
      allHomework: '所有作业',
      assignHomework: '布置作业',
      assignToClass: '布置给班级',
      assignToIndividual: '布置给个人',
      selectClass: '选择班级',
      selectStudents: '选择学生',
      homeworkTitle: '作业标题',
      dueDate: '截止日期',
      maxScore: '满分',
      allowVoice: '允许语音提交',
      allowFile: '允许文件上传',
      instructions: '作业说明',
      viewSubmissions: '查看提交',
      pendingReview: '待批改',
      reviewed: '已批改',
      score: '分数',
      feedback: '反馈评语',
      submitReview: '提交评价',
      studentAnswer: '学生答案',
      voiceSubmission: '语音提交',
      fileSubmission: '文件提交',
      noHomework: '暂无作业',
      noSubmissions: '暂无提交',
      cancel: '取消',
      submit: '布置',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      success: '操作成功',
      failed: '操作失败',
      pleaseSelectClass: '请选择班级',
      pleaseEnterTitle: '请输入标题',
      pleaseSelectDueDate: '请选择截止日期',
      students: '学生',
      noStudentsInClass: '班级暂无学生',
      assignmentType: '布置方式'
    },
    en: {
      title: 'Homework Management',
      subtitle: 'Assign and grade student homework',
      assign: 'Assign',
      review: 'Review',
      allHomework: 'All Homework',
      assignHomework: 'Assign Homework',
      assignToClass: 'Assign to Class',
      assignToIndividual: 'Assign to Individual',
      selectClass: 'Select Class',
      selectStudents: 'Select Students',
      homeworkTitle: 'Homework Title',
      dueDate: 'Due Date',
      maxScore: 'Max Score',
      allowVoice: 'Allow Voice Submission',
      allowFile: 'Allow File Upload',
      instructions: 'Instructions',
      viewSubmissions: 'View Submissions',
      pendingReview: 'Pending Review',
      reviewed: 'Reviewed',
      score: 'Score',
      feedback: 'Feedback',
      submitReview: 'Submit Review',
      studentAnswer: 'Student Answer',
      voiceSubmission: 'Voice Submission',
      fileSubmission: 'File Submission',
      noHomework: 'No homework yet',
      noSubmissions: 'No submissions yet',
      cancel: 'Cancel',
      submit: 'Assign',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      success: 'Success',
      failed: 'Failed',
      pleaseSelectClass: 'Please select a class',
      pleaseEnterTitle: 'Please enter a title',
      pleaseSelectDueDate: 'Please select a due date',
      students: 'Students',
      noStudentsInClass: 'No students in class',
      assignmentType: 'Assignment Type'
    },
    it: {
      title: 'Gestione Compiti',
      subtitle: 'Assegna e valuta i compiti degli studenti',
      assign: 'Assegna',
      review: 'Valuta',
      allHomework: 'Tutti i Compiti',
      assignHomework: 'Assegna Compito',
      assignToClass: 'Assegna alla Classe',
      assignToIndividual: 'Assegna Individualmente',
      selectClass: 'Seleziona Classe',
      selectStudents: 'Seleziona Studenti',
      homeworkTitle: 'Titolo Compito',
      dueDate: 'Scadenza',
      maxScore: 'Punteggio Max',
      allowVoice: 'Consenti Audio',
      allowFile: 'Consenti File',
      instructions: 'Istruzioni',
      viewSubmissions: 'Vedi Consegne',
      pendingReview: 'Da Valutare',
      reviewed: 'Valutato',
      score: 'Punteggio',
      feedback: 'Feedback',
      submitReview: 'Invia Valutazione',
      studentAnswer: 'Risposta Studente',
      voiceSubmission: 'Audio',
      fileSubmission: 'File',
      noHomework: 'Nessun compito',
      noSubmissions: 'Nessuna consegna',
      cancel: 'Annulla',
      submit: 'Assegna',
      save: 'Salva',
      delete: 'Elimina',
      edit: 'Modifica',
      success: 'Successo',
      failed: 'Errore',
      pleaseSelectClass: 'Seleziona una classe',
      pleaseEnterTitle: 'Inserisci un titolo',
      pleaseSelectDueDate: 'Seleziona una scadenza',
      students: 'Studenti',
      noStudentsInClass: 'Nessuno studente in classe',
      assignmentType: 'Tipo di Assegnazione'
    }
  };
  const t = txt[language] || txt.zh;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      // Load teacher's classes with student count
      const { data: classData } = await supabase
        .from('classes')
        .select('*, class_enrollments(count)')
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setClasses(classData || []);

      // Load homework
      const { data: homeworkData } = await supabase
        .from('homework')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setHomework(homeworkData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClassStudents = async (classId) => {
    if (!classId || !supabase) return;
    try {
      const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select('student_id')
        .eq('class_id', classId)
        .eq('status', 'active');
      
      if (enrollments && enrollments.length > 0) {
        const studentIds = enrollments.map(e => e.student_id);
        const { data: studentData } = await supabase
          .from('users')
          .select('id, name, name_zh, username, email')
          .in('id', studentIds);
        setStudents(studentData || []);
      } else {
        setStudents([]);
      }
    } catch (error) {
      console.error('Failed to load students:', error);
      setStudents([]);
    }
  };

  const loadSubmissions = async (homeworkId) => {
    if (!supabase) return;
    try {
      // First get submissions
      const { data: subs } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('homework_id', homeworkId)
        .order('created_at', { ascending: false });
      
      if (subs && subs.length > 0) {
        // Get student details
        const studentIds = subs.map(s => s.student_id).filter(Boolean);
        const { data: studentData } = await supabase
          .from('users')
          .select('id, name, name_zh, username')
          .in('id', studentIds);
        
        // Combine
        const combined = subs.map(sub => ({
          ...sub,
          student: studentData?.find(s => s.id === sub.student_id) || null
        }));
        setSubmissions(combined);
      } else {
        setSubmissions([]);
      }
    } catch (error) {
      console.error('Failed to load submissions:', error);
      setSubmissions([]);
    }
  };

  const handleAssignHomework = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!assignForm.title.trim()) {
      showMessage('error', t.pleaseEnterTitle);
      return;
    }
    if (!assignForm.class_id) {
      showMessage('error', t.pleaseSelectClass);
      return;
    }
    if (!assignForm.due_date) {
      showMessage('error', t.pleaseSelectDueDate);
      return;
    }

    try {
      const { error } = await supabase.from('homework').insert([{
        class_id: assignForm.class_id,
        teacher_id: user.id,
        title: assignForm.title,
        title_zh: assignForm.title,
        description: assignForm.description,
        instructions: assignForm.instructions,
        due_date: assignForm.due_date,
        max_score: assignForm.max_score,
        type: assignForm.assign_type === 'class' ? 'class' : 'individual',
        is_active: true
      }]);

      if (error) throw error;

      setShowAssignModal(false);
      resetAssignForm();
      showMessage('success', t.success);
      loadData();
    } catch (error) {
      console.error('Failed to assign homework:', error);
      showMessage('error', t.failed);
    }
  };

  const handleReviewSubmission = async () => {
    if (!selectedSubmission || !supabase) return;
    try {
      const { error } = await supabase
        .from('homework_submissions')
        .update({
          score: parseInt(reviewForm.score),
          feedback: reviewForm.feedback,
          status: 'graded'
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;

      setShowReviewModal(null);
      setSelectedSubmission(null);
      setReviewForm({ score: '', feedback: '' });
      showMessage('success', t.success);
      loadSubmissions(selectedSubmission.homework_id);
    } catch (error) {
      console.error('Failed to submit review:', error);
      showMessage('error', t.failed);
    }
  };

  const handleDeleteHomework = async (homeworkId) => {
    const confirmMsg = language === 'zh' ? '确定要删除此作业吗？' : 'Delete this homework?';
    if (!window.confirm(confirmMsg)) return;
    
    try {
      await supabase.from('homework').update({ is_active: false }).eq('id', homeworkId);
      showMessage('success', t.success);
      loadData();
    } catch (error) {
      showMessage('error', t.failed);
    }
  };

  const resetAssignForm = () => {
    setAssignForm({
      title: '',
      description: '',
      instructions: '',
      due_date: '',
      max_score: 100,
      assign_type: 'class',
      class_id: '',
      student_ids: [],
      allow_voice: true,
      allow_file_upload: true
    });
    setStudents([]);
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const getClassName = (classId) => {
    const cls = classes.find(c => c.id === classId);
    return cls?.name || '-';
  };

  const getStudentCount = (cls) => cls.class_enrollments?.[0]?.count || 0;

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  return (
    <div>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>📝 {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetAssignForm(); setShowAssignModal(true); }}>
          + {t.assignHomework}
        </button>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        {['assign', 'review'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem 1rem',
              background: activeTab === tab ? 'var(--primary)' : 'transparent',
              color: activeTab === tab ? 'white' : 'var(--text)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer'
            }}
          >
            {tab === 'assign' ? `📋 ${t.allHomework}` : `✏️ ${t.review}`}
          </button>
        ))}
      </div>

      {/* Homework List */}
      {activeTab === 'assign' && (
        <div className="card">
          {homework.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
              <p>{t.noHomework}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', padding: '1rem' }}>
              {homework.map(hw => (
                <div key={hw.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0' }}>{hw.title_zh || hw.title}</h4>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                        <span>📚 {getClassName(hw.class_id)}</span>
                        <span>📅 {new Date(hw.due_date).toLocaleDateString()}</span>
                        <span>💯 {hw.max_score}分</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-outline btn-sm"
                        onClick={() => { loadSubmissions(hw.id); setShowReviewModal(hw); }}
                      >
                        {t.viewSubmissions}
                      </button>
                      <button 
                        className="btn btn-outline btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => handleDeleteHomework(hw.id)}
                      >
                        {t.delete}
                      </button>
                    </div>
                  </div>
                  {hw.description && (
                    <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{hw.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Tab - Pending Submissions */}
      {activeTab === 'review' && (
        <div className="card">
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
            <h4 style={{ margin: 0 }}>✏️ {t.pendingReview}</h4>
          </div>
          <div style={{ padding: '1rem' }}>
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
              {language === 'zh' ? '请从"所有作业"选择一个作业查看提交' : 'Select a homework from "All Homework" to view submissions'}
            </p>
          </div>
        </div>
      )}

      {/* Assign Modal - Simplified */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>📝 {t.assignHomework}</h3>
              <button onClick={() => setShowAssignModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleAssignHomework}>
              {/* Assignment Type Toggle */}
              <div className="form-group">
                <label className="form-label">{t.assignmentType}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setAssignForm({ ...assignForm, assign_type: 'class', student_ids: [] })}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '2px solid',
                      borderColor: assignForm.assign_type === 'class' ? 'var(--primary)' : 'var(--border)',
                      background: assignForm.assign_type === 'class' ? 'rgba(196, 30, 58, 0.1)' : 'white',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontWeight: assignForm.assign_type === 'class' ? '600' : '400'
                    }}
                  >
                    👥 {t.assignToClass}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignForm({ ...assignForm, assign_type: 'individual' });
                      if (assignForm.class_id) loadClassStudents(assignForm.class_id);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '2px solid',
                      borderColor: assignForm.assign_type === 'individual' ? 'var(--primary)' : 'var(--border)',
                      background: assignForm.assign_type === 'individual' ? 'rgba(196, 30, 58, 0.1)' : 'white',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontWeight: assignForm.assign_type === 'individual' ? '600' : '400'
                    }}
                  >
                    👤 {t.assignToIndividual}
                  </button>
                </div>
              </div>

              {/* Class Selector */}
              <div className="form-group">
                <label className="form-label">{t.selectClass} *</label>
                <select 
                  className="form-select"
                  value={assignForm.class_id}
                  onChange={e => {
                    setAssignForm({ ...assignForm, class_id: e.target.value, student_ids: [] });
                    if (assignForm.assign_type === 'individual' && e.target.value) {
                      loadClassStudents(e.target.value);
                    }
                  }}
                  required
                  style={{ fontSize: '1rem', padding: '0.75rem' }}
                >
                  <option value="">{language === 'zh' ? '-- 请选择班级 --' : '-- Select Class --'}</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} (👨‍🎓 {getStudentCount(cls)})
                    </option>
                  ))}
                </select>
                {classes.length === 0 && (
                  <p style={{ color: 'var(--warning)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {language === 'zh' ? '⚠️ 您还没有创建班级，请先到"班级管理"创建班级' : '⚠️ No classes yet. Please create a class first.'}
                  </p>
                )}
              </div>

              {/* Student Selector (for individual assignment) */}
              {assignForm.assign_type === 'individual' && assignForm.class_id && (
                <div className="form-group">
                  <label className="form-label">{t.selectStudents} *</label>
                  {students.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-sm)' }}>
                      {t.noStudentsInClass}
                    </p>
                  ) : (
                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                      {students.map(student => (
                        <label 
                          key={student.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem', 
                            padding: '0.75rem 1rem', 
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                            background: assignForm.student_ids.includes(student.id) ? 'rgba(196, 30, 58, 0.05)' : 'transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={assignForm.student_ids.includes(student.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setAssignForm({ ...assignForm, student_ids: [...assignForm.student_ids, student.id] });
                              } else {
                                setAssignForm({ ...assignForm, student_ids: assignForm.student_ids.filter(id => id !== student.id) });
                              }
                            }}
                            style={{ width: '18px', height: '18px' }}
                          />
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.875rem' }}>
                            {(student.name_zh || student.name || '?').charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: '500' }}>{student.name_zh || student.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{student.username}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {assignForm.student_ids.length > 0 && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--primary)', marginTop: '0.5rem' }}>
                      ✓ {language === 'zh' ? `已选择 ${assignForm.student_ids.length} 名学生` : `${assignForm.student_ids.length} student(s) selected`}
                    </p>
                  )}
                </div>
              )}

              {/* Title - Single Language */}
              <div className="form-group">
                <label className="form-label">{t.homeworkTitle} *</label>
                <input
                  type="text"
                  className="form-input"
                  value={assignForm.title}
                  onChange={e => setAssignForm({ ...assignForm, title: e.target.value })}
                  placeholder={language === 'zh' ? '例如：第三课课后练习' : 'e.g., Lesson 3 Practice'}
                  required
                />
              </div>

              {/* Instructions */}
              <div className="form-group">
                <label className="form-label">{t.instructions}</label>
                <textarea
                  className="form-textarea"
                  value={assignForm.instructions}
                  onChange={e => setAssignForm({ ...assignForm, instructions: e.target.value })}
                  rows={3}
                  placeholder={language === 'zh' ? '详细说明作业要求...' : 'Describe the homework requirements...'}
                />
              </div>

              {/* Due Date & Max Score */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.dueDate} *</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={assignForm.due_date}
                    onChange={e => setAssignForm({ ...assignForm, due_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.maxScore}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={assignForm.max_score}
                    onChange={e => setAssignForm({ ...assignForm, max_score: parseInt(e.target.value) })}
                    min={1}
                    max={1000}
                  />
                </div>
              </div>

              {/* Options */}
              <div className="form-group" style={{ display: 'flex', gap: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={assignForm.allow_voice}
                    onChange={e => setAssignForm({ ...assignForm, allow_voice: e.target.checked })}
                  />
                  🎤 {t.allowVoice}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={assignForm.allow_file_upload}
                    onChange={e => setAssignForm({ ...assignForm, allow_file_upload: e.target.checked })}
                  />
                  📎 {t.allowFile}
                </label>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAssignModal(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t.submit}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(null)}>
          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>📋 {showReviewModal.title_zh || showReviewModal.title}</h3>
              <button onClick={() => setShowReviewModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            {submissions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                <p>{t.noSubmissions}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {submissions.map(sub => (
                  <div key={sub.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {(sub.student?.name_zh || sub.student?.name || '?').charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: '500' }}>{sub.student?.name_zh || sub.student?.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{sub.student?.username}</div>
                        </div>
                      </div>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: sub.status === 'graded' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                        color: sub.status === 'graded' ? 'var(--success)' : '#ca8a04'
                      }}>
                        {sub.status === 'graded' ? `✓ ${sub.score}/${showReviewModal.max_score}` : t.pendingReview}
                      </span>
                    </div>
                    
                    {sub.content && (
                      <div style={{ padding: '0.75rem', background: 'white', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem' }}>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{sub.content}</p>
                      </div>
                    )}

                    {sub.voice_recording && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🎤 {t.voiceSubmission}</span>
                        <audio controls src={sub.voice_recording} style={{ width: '100%', marginTop: '0.25rem' }} />
                      </div>
                    )}

                    {sub.status !== 'graded' && (
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => { setSelectedSubmission(sub); setReviewForm({ score: '', feedback: '' }); }}
                      >
                        ✏️ {t.review}
                      </button>
                    )}

                    {sub.feedback && (
                      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(196, 30, 58, 0.05)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--primary)' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{t.feedback}:</div>
                        <p style={{ margin: 0 }}>{sub.feedback}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grade Submission Modal */}
      {selectedSubmission && (
        <div className="modal-overlay" onClick={() => setSelectedSubmission(null)}>
          <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>✏️ {t.review}</h3>
              <button onClick={() => setSelectedSubmission(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
              <strong>{selectedSubmission.student?.name_zh || selectedSubmission.student?.name}</strong>
              {selectedSubmission.content && <p style={{ margin: '0.5rem 0 0', whiteSpace: 'pre-wrap' }}>{selectedSubmission.content}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">{t.score} (/{showReviewModal?.max_score || 100})</label>
              <input
                type="number"
                className="form-input"
                value={reviewForm.score}
                onChange={e => setReviewForm({ ...reviewForm, score: e.target.value })}
                min={0}
                max={showReviewModal?.max_score || 100}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t.feedback}</label>
              <textarea
                className="form-textarea"
                value={reviewForm.feedback}
                onChange={e => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                rows={3}
                placeholder={language === 'zh' ? '写下你的评语...' : 'Write your feedback...'}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setSelectedSubmission(null)}>{t.cancel}</button>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleReviewSubmission}>{t.submitReview}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherHomeworkPage;
