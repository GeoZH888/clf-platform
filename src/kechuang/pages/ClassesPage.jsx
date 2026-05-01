import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const ClassesPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [searchStudent, setSearchStudent] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [classForm, setClassForm] = useState({ name: '', description: '', hsk_level: 1, schedule: '', max_students: 30 });

  const txt = {
    zh: {
      title: '班级管理',
      subtitle: '管理您的班级和学生',
      myClasses: '我的班级',
      createClass: '创建班级',
      editClass: '编辑班级',
      classInfo: '班级信息',
      className: '班级名称',
      description: '描述',
      hskLevel: 'HSK级别',
      schedule: '上课时间',
      maxStudents: '人数上限',
      currentStudents: '当前学生',
      createdAt: '创建时间',
      students: '学生',
      noClasses: '暂无班级，点击右上角创建',
      selectClass: '← 请选择一个班级',
      classStudents: '班级学生',
      addStudent: '添加学生',
      removeStudent: '移除',
      noStudents: '暂无学生',
      searchStudent: '搜索学生...',
      add: '添加',
      added: '已添加',
      create: '创建',
      cancel: '取消',
      save: '保存',
      delete: '删除班级',
      edit: '编辑',
      confirmDelete: '确定删除此班级吗？所有学生将被移出班级。',
      confirmRemove: '确定移除此学生吗？',
      success: '操作成功',
      failed: '操作失败',
      joinRequests: '加入申请',
      approve: '通过',
      reject: '拒绝',
      noRequests: '暂无申请',
      done: '完成',
      noDescription: '暂无描述',
      noSchedule: '未设置'
    },
    en: {
      title: 'Class Management',
      subtitle: 'Manage your classes and students',
      myClasses: 'My Classes',
      createClass: 'Create Class',
      editClass: 'Edit Class',
      classInfo: 'Class Info',
      className: 'Class Name',
      description: 'Description',
      hskLevel: 'HSK Level',
      schedule: 'Schedule',
      maxStudents: 'Max Students',
      currentStudents: 'Current Students',
      createdAt: 'Created',
      students: 'Students',
      noClasses: 'No classes yet, click to create',
      selectClass: '← Select a class',
      classStudents: 'Class Students',
      addStudent: 'Add Student',
      removeStudent: 'Remove',
      noStudents: 'No students',
      searchStudent: 'Search students...',
      add: 'Add',
      added: 'Added',
      create: 'Create',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete Class',
      edit: 'Edit',
      confirmDelete: 'Delete this class? All students will be removed.',
      confirmRemove: 'Remove this student?',
      success: 'Success',
      failed: 'Failed',
      joinRequests: 'Join Requests',
      approve: 'Approve',
      reject: 'Reject',
      noRequests: 'No requests',
      done: 'Done',
      noDescription: 'No description',
      noSchedule: 'Not set'
    }
  };
  const t = txt[language] || txt.en;

  // Separate function that takes classId directly - MUST BE DEFINED BEFORE loadData
  const loadClassStudentsById = async (classId) => {
    if (!classId || !supabase) {
      console.log('loadClassStudentsById: Missing classId or supabase', { classId, hasSupabase: !!supabase });
      return;
    }
    setStudentsLoading(true);
    console.log('loadClassStudentsById called with classId:', classId);
    try {
      // First get enrollments - only select columns that exist in the table
      const { data: enrollments, error: enrollError } = await supabase
        .from('dwxz_class_enrollments')
        .select('id, student_id, status, enrolled_at')
        .eq('class_id', classId);
      
      console.log('Enrollments for class', classId, ':', enrollments, 'Error:', enrollError);
      
      if (enrollError) {
        console.error('Load enrollments error:', enrollError);
        setStudents([]);
        return;
      }

      if (!enrollments || enrollments.length === 0) {
        console.log('No enrollments found for class:', classId);
        setStudents([]);
        return;
      }

      // Then get student details
      const studentIds = enrollments.map(e => e.student_id).filter(Boolean);
      console.log('Student IDs:', studentIds);
      
      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      const { data: studentData, error: studentError } = await supabase
        .from('dwxz_users_view')
        .select('id, name, name_zh, username, email')
        .in('id', studentIds);

      console.log('Student data:', studentData, 'Error:', studentError);

      if (studentError) {
        console.error('Load students error:', studentError);
        setStudents([]);
        return;
      }

      // Combine enrollments with student data
      const combined = enrollments.map(enrollment => ({
        ...enrollment,
        student: studentData?.find(s => s.id === enrollment.student_id) || null
      }));

      console.log('Combined data:', combined);
      setStudents(combined);
    } catch (err) {
      console.error('Load students error:', err);
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadClassStudents = async (classId) => {
    const targetClassId = classId || selectedClass;
    await loadClassStudentsById(targetClassId);
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { 
    if (selectedClass && supabase) {
      console.log('useEffect triggered for selectedClass:', selectedClass);
      loadClassStudentsById(selectedClass); 
    } else {
      setStudents([]);
    }
  }, [selectedClass]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (supabase && user) {
        const { data: classData } = await supabase
          .from('dwxz_classes')
          .select('*, class_enrollments(count)')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false });
        setClasses(classData || []);
        console.log('Classes loaded:', classData);

        // Auto-select first class and load its students
        if (classData?.length > 0) {
          const firstClassId = classData[0].id;
          console.log('Auto-selecting first class:', firstClassId);
          setSelectedClass(firstClassId);
          // Load students for first class
          await loadClassStudentsById(firstClassId);
        }

        const { data: studentData } = await supabase
          .from('dwxz_users_view')
          .select('id, name, name_zh, username, email')
          .eq('role', 'student')
          .eq('is_active', true);
        setAllStudents(studentData || []);

        // Load join requests - wrap in try-catch since table might not exist
        try {
          const { data: requestData } = await supabase
            .from('dwxz_class_join_requests')
            .select('*, student:users!class_join_requests_student_id_fkey(name, name_zh, username), class:classes!class_join_requests_class_id_fkey(name)')
            .eq('status', 'pending')
            .in('class_id', (classData || []).map(c => c.id));
          setJoinRequests(requestData || []);
        } catch (e) {
          console.log('class_join_requests table may not exist, skipping');
          setJoinRequests([]);
        }
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('dwxz_classes').insert([{ ...classForm, teacher_id: user.id }]);
      setShowAddClassModal(false);
      setClassForm({ name: '', description: '', hsk_level: 1, schedule: '', max_students: 30 });
      showMessage('success', t.success);
      loadData();
    } catch (err) {
      showMessage('error', t.failed);
    }
  };

  const handleEditClass = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('dwxz_classes').update(classForm).eq('id', selectedClass);
      setShowEditClassModal(false);
      showMessage('success', t.success);
      loadData();
    } catch (err) {
      showMessage('error', t.failed);
    }
  };

  const handleDeleteClass = async () => {
    const confirmMsg = language === 'zh' 
      ? '确定要删除此班级吗？此操作无法撤销！' 
      : 'Are you sure you want to delete this class? This cannot be undone!';
    if (!window.confirm(confirmMsg)) return;
    
    try {
      // First delete enrollments
      const { error: enrollError } = await supabase
        .from('dwxz_class_enrollments')
        .delete()
        .eq('class_id', selectedClass);
      
      if (enrollError) {
        console.error('Delete enrollments error:', enrollError);
      }
      
      // Then delete class
      const { error: classError } = await supabase
        .from('dwxz_classes')
        .delete()
        .eq('id', selectedClass);
      
      if (classError) {
        console.error('Delete class error:', classError);
        showMessage('error', language === 'zh' ? '删除失败：' + classError.message : 'Delete failed: ' + classError.message);
        return;
      }
      
      setShowEditClassModal(false);
      setSelectedClass(null);
      setStudents([]);
      showMessage('success', language === 'zh' ? '✓ 班级已删除' : '✓ Class deleted');
      loadData();
    } catch (err) {
      console.error('Delete class error:', err);
      showMessage('error', t.failed);
    }
  };

  const handleAddStudent = async (studentId) => {
    if (!selectedClass) return;
    try {
      // Check in database for existing enrollment (more reliable than local state)
      const { data: existing, error: checkError } = await supabase
        .from('dwxz_class_enrollments')
        .select('id')
        .eq('class_id', selectedClass)
        .eq('student_id', studentId)
        .maybeSingle();
      
      if (checkError) {
        console.error('Check existing error:', checkError);
      }
      
      if (existing) {
        showMessage('warning', language === 'zh' ? '⚠️ 该学生已在班级中！' : '⚠️ Student already in class!');
        return;
      }
      
      const { error: insertError } = await supabase
        .from('dwxz_class_enrollments')
        .insert([{ class_id: selectedClass, student_id: studentId, status: 'active' }]);
      
      if (insertError) {
        console.error('Insert error:', insertError);
        showMessage('error', t.failed);
        return;
      }
      
      showMessage('success', language === 'zh' ? '✓ 添加成功！' : '✓ Added!');
      await loadClassStudentsById(selectedClass);
      loadData();
    } catch (err) {
      console.error('handleAddStudent error:', err);
      showMessage('error', t.failed);
    }
  };

  const handleRemoveStudent = async (enrollmentId) => {
    if (!window.confirm(t.confirmRemove)) return;
    try {
      await supabase.from('dwxz_class_enrollments').delete().eq('id', enrollmentId);
      showMessage('success', t.success);
      loadClassStudents(selectedClass);
      loadData();
    } catch (err) {
      showMessage('error', t.failed);
    }
  };

  const handleJoinRequest = async (requestId, action) => {
    try {
      const request = joinRequests.find(r => r.id === requestId);
      await supabase.from('dwxz_class_join_requests').update({ status: action, reviewed_at: new Date().toISOString() }).eq('id', requestId);
      if (action === 'approved' && request) {
        await supabase.from('dwxz_class_enrollments').insert([{ class_id: request.class_id, student_id: request.student_id, status: 'active' }]);
      }
      showMessage('success', t.success);
      loadData();
      if (selectedClass) loadClassStudents(selectedClass);
    } catch (err) {
      showMessage('error', t.failed);
    }
  };

  const openEditModal = () => {
    const cls = classes.find(c => c.id === selectedClass);
    if (cls) {
      setClassForm({
        name: cls.name || '',
        description: cls.description || '',
        hsk_level: cls.hsk_level || 1,
        schedule: cls.schedule || '',
        max_students: cls.max_students || 30
      });
      setShowEditClassModal(true);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const getStudentCount = (cls) => cls.class_enrollments?.[0]?.count || 0;
  const getSelectedClassData = () => classes.find(c => c.id === selectedClass);

  const filteredStudents = allStudents.filter(s => {
    if (!searchStudent) return true;
    const search = searchStudent.toLowerCase();
    return s.name?.toLowerCase().includes(search) || s.name_zh?.includes(searchStudent) || s.username?.toLowerCase().includes(search) || s.email?.toLowerCase().includes(search);
  });

  const isEnrolled = (studentId) => students.some(s => s.student_id === studentId);

  if (loading) return <div className="loading-screen"><div className="loading-spinner"></div></div>;

  const selectedClassData = getSelectedClassData();

  return (
    <div>
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>👥 {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setClassForm({ name: '', description: '', hsk_level: 1, schedule: '', max_students: 30 }); setShowAddClassModal(true); }}>
          + {t.createClass}
        </button>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      {/* Join Requests Banner */}
      {joinRequests.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, color: '#92400e' }}>📋 {t.joinRequests} ({joinRequests.length})</h4>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {joinRequests.slice(0, 5).map(req => (
              <div key={req.id} style={{ padding: '0.5rem 0.75rem', background: 'white', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: '500' }}>{req.student?.name_zh || req.student?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>→ {req.class?.name}</div>
                </div>
                <button className="btn btn-sm" style={{ background: '#22c55e', color: 'white', padding: '0.25rem 0.5rem' }} onClick={() => handleJoinRequest(req.id, 'approved')}>✓</button>
                <button className="btn btn-sm btn-outline" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleJoinRequest(req.id, 'rejected')}>✗</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
        {/* Left: Class List */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
            <h4 style={{ margin: 0 }}>📚 {t.myClasses}</h4>
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {classes.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
                <p>{t.noClasses}</p>
              </div>
            ) : (
              classes.map(cls => (
                <div
                  key={cls.id}
                  onClick={() => {
                    setSelectedClass(cls.id);
                    loadClassStudentsById(cls.id);
                  }}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selectedClass === cls.id ? 'rgba(196, 30, 58, 0.08)' : 'transparent',
                    borderLeft: selectedClass === cls.id ? '3px solid var(--primary)' : '3px solid transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{cls.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem' }}>
                    <span>HSK {cls.hsk_level}</span>
                    <span>👨‍🎓 {getStudentCount(cls)}/{cls.max_students}</span>
                  </div>
                  {cls.schedule && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>🕐 {cls.schedule}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Class Details + Students */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {selectedClass && selectedClassData ? (
            <>
              {/* Class Info Card */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem 0' }}>{selectedClassData.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                      {selectedClassData.description || t.noDescription}
                    </p>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={openEditModal}>
                    ✏️ {t.edit}
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                  <div style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>HSK {selectedClassData.hsk_level}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.hskLevel}</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{getStudentCount(selectedClassData)}/{selectedClassData.max_students}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.currentStudents}</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{selectedClassData.schedule || t.noSchedule}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.schedule}</div>
                  </div>
                  <div style={{ padding: '0.75rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{new Date(selectedClassData.created_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.createdAt}</div>
                  </div>
                </div>
              </div>

              {/* Students Card */}
              <div className="card" style={{ padding: '0', overflow: 'hidden', flex: 1 }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--background)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>👨‍🎓 {t.classStudents} ({students.length})</h4>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddStudentModal(true)}>
                    + {t.addStudent}
                  </button>
                </div>
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {studentsLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div className="loading-spinner" style={{ width: '30px', height: '30px', margin: '0 auto 0.5rem' }}></div>
                      <p>{language === 'zh' ? '加载中...' : 'Loading...'}</p>
                    </div>
                  ) : students.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👨‍🎓</div>
                      <p>{t.noStudents}</p>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--background)' }}>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500' }}>{language === 'zh' ? '学生' : 'Student'}</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: '500' }}>{language === 'zh' ? '邮箱' : 'Email'}</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '500' }}>{language === 'zh' ? '操作' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(enrollment => (
                          <tr key={enrollment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                  {(enrollment.student?.name_zh || enrollment.student?.name || '?').charAt(0)}
                                </div>
                                <div>
                                  <div style={{ fontWeight: '500' }}>{enrollment.student?.name_zh || enrollment.student?.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{enrollment.student?.username}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                              {enrollment.student?.email || '-'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleRemoveStudent(enrollment.id)}>
                                {t.removeStudent}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👈</div>
              <p>{t.selectClass}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Class Modal */}
      {showAddClassModal && (
        <div className="modal-overlay" onClick={() => setShowAddClassModal(false)}>
          <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>📚 {t.createClass}</h3>
              <button onClick={() => setShowAddClassModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleCreateClass}>
              <div className="form-group">
                <label className="form-label">{t.className} *</label>
                <input type="text" className="form-input" value={classForm.name} onChange={e => setClassForm({...classForm, name: e.target.value})} required placeholder={language === 'zh' ? '如：HSK2早班' : 'e.g., HSK2 Morning Class'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.hskLevel}</label>
                  <select className="form-select" value={classForm.hsk_level} onChange={e => setClassForm({...classForm, hsk_level: parseInt(e.target.value)})}>
                    {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.maxStudents}</label>
                  <input type="number" className="form-input" value={classForm.max_students} onChange={e => setClassForm({...classForm, max_students: parseInt(e.target.value)})} min={1} max={100} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t.schedule}</label>
                <input type="text" className="form-input" value={classForm.schedule} onChange={e => setClassForm({...classForm, schedule: e.target.value})} placeholder={language === 'zh' ? '如：周一、周三 18:00-19:30' : 'e.g., Mon/Wed 6-7:30PM'} />
              </div>
              <div className="form-group">
                <label className="form-label">{t.description}</label>
                <textarea className="form-textarea" value={classForm.description} onChange={e => setClassForm({...classForm, description: e.target.value})} rows={2} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddClassModal(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t.create}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Class Modal */}
      {showEditClassModal && (
        <div className="modal-overlay" onClick={() => setShowEditClassModal(false)}>
          <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>✏️ {t.editClass}</h3>
              <button onClick={() => setShowEditClassModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleEditClass}>
              <div className="form-group">
                <label className="form-label">{t.className} *</label>
                <input type="text" className="form-input" value={classForm.name} onChange={e => setClassForm({...classForm, name: e.target.value})} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t.hskLevel}</label>
                  <select className="form-select" value={classForm.hsk_level} onChange={e => setClassForm({...classForm, hsk_level: parseInt(e.target.value)})}>
                    {[1,2,3,4,5,6].map(l => <option key={l} value={l}>HSK {l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t.maxStudents}</label>
                  <input type="number" className="form-input" value={classForm.max_students} onChange={e => setClassForm({...classForm, max_students: parseInt(e.target.value)})} min={1} max={100} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t.schedule}</label>
                <input type="text" className="form-input" value={classForm.schedule} onChange={e => setClassForm({...classForm, schedule: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t.description}</label>
                <textarea className="form-textarea" value={classForm.description} onChange={e => setClassForm({...classForm, description: e.target.value})} rows={2} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-outline" style={{ color: 'var(--danger)' }} onClick={handleDeleteClass}>{t.delete}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowEditClassModal(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t.save}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="modal-overlay" onClick={() => setShowAddStudentModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>👨‍🎓 {t.addStudent}</h3>
              <button onClick={() => setShowAddStudentModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
              <input type="text" className="form-input" style={{ paddingLeft: '2.5rem' }} value={searchStudent} onChange={e => setSearchStudent(e.target.value)} placeholder={t.searchStudent} autoFocus />
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              {filteredStudents.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
                  <p>{t.noStudents}</p>
                </div>
              ) : (
                filteredStudents.slice(0, 50).map(student => {
                  const enrolled = isEnrolled(student.id);
                  return (
                    <div key={student.id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: enrolled ? 'rgba(34, 197, 94, 0.05)' : 'transparent' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: enrolled ? 'var(--success)' : 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                        {enrolled ? '✓' : (student.name_zh || student.name || student.username).charAt(0)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {student.name_zh || student.name || student.username}
                          {enrolled && <span style={{ fontSize: '0.625rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', background: 'rgba(34, 197, 94, 0.2)', color: 'var(--success)' }}>{t.added}</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{student.username} {student.email && `• ${student.email}`}</div>
                      </div>
                      {!enrolled && <button className="btn btn-primary btn-sm" onClick={() => handleAddStudent(student.id)}>+ {t.add}</button>}
                    </div>
                  );
                })
              )}
            </div>

            <button className="btn btn-outline" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setShowAddStudentModal(false)}>{t.done}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassesPage;
