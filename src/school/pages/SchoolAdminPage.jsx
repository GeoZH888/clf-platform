import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const SchoolAdminPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [school, setSchool] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  const txt = {
    zh: {
      title: '🏫 学校管理',
      overview: '概览',
      teachers: '教师管理',
      students: '学生管理',
      classes: '班级管理',
      enrollments: '报名审核',
      schoolInfo: '学校信息',
      schoolName: '学校名称',
      schoolCode: '学校代码',
      maxTeachers: '教师上限',
      maxStudents: '学生上限',
      currentTeachers: '当前教师',
      currentStudents: '当前学生',
      totalClasses: '班级总数',
      pendingEnrollments: '待审核报名',
      name: '姓名',
      username: '用户名',
      email: '邮箱',
      phone: '电话',
      status: '状态',
      actions: '操作',
      active: '活跃',
      inactive: '禁用',
      approve: '通过',
      reject: '拒绝',
      view: '查看',
      noData: '暂无数据',
      success: '操作成功！',
      failed: '操作失败'
    },
    en: {
      title: '🏫 School Management',
      overview: 'Overview',
      teachers: 'Teachers',
      students: 'Students',
      classes: 'Classes',
      enrollments: 'Enrollments',
      schoolInfo: 'School Info',
      schoolName: 'School Name',
      schoolCode: 'School Code',
      maxTeachers: 'Max Teachers',
      maxStudents: 'Max Students',
      currentTeachers: 'Current Teachers',
      currentStudents: 'Current Students',
      totalClasses: 'Total Classes',
      pendingEnrollments: 'Pending Enrollments',
      name: 'Name',
      username: 'Username',
      email: 'Email',
      phone: 'Phone',
      status: 'Status',
      actions: 'Actions',
      active: 'Active',
      inactive: 'Inactive',
      approve: 'Approve',
      reject: 'Reject',
      view: 'View',
      noData: 'No data',
      success: 'Success!',
      failed: 'Operation failed'
    },
    it: {
      title: '🏫 Gestione Scuola',
      overview: 'Panoramica',
      teachers: 'Insegnanti',
      students: 'Studenti',
      classes: 'Classi',
      enrollments: 'Iscrizioni',
      schoolInfo: 'Info Scuola',
      schoolName: 'Nome Scuola',
      schoolCode: 'Codice Scuola',
      maxTeachers: 'Max Insegnanti',
      maxStudents: 'Max Studenti',
      currentTeachers: 'Insegnanti Attuali',
      currentStudents: 'Studenti Attuali',
      totalClasses: 'Classi Totali',
      pendingEnrollments: 'Iscrizioni in Attesa',
      name: 'Nome',
      username: 'Username',
      email: 'Email',
      phone: 'Telefono',
      status: 'Stato',
      actions: 'Azioni',
      active: 'Attivo',
      inactive: 'Inattivo',
      approve: 'Approva',
      reject: 'Rifiuta',
      view: 'Vedi',
      noData: 'Nessun dato',
      success: 'Successo!',
      failed: 'Operazione fallita'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 获取学校管理员所属的学校
      const { data: adminData } = await supabase
        .from('school_admins')
        .select('school_id')
        .eq('user_id', user?.id)
        .single();

      if (adminData?.school_id) {
        // 获取学校信息
        const { data: schoolData } = await supabase
          .from('schools')
          .select('*')
          .eq('id', adminData.school_id)
          .single();
        setSchool(schoolData);

        // 获取教师
        const { data: teacherData } = await supabase
          .from('teacher_schools')
          .select('*, teacher:users(*)')
          .eq('school_id', adminData.school_id)
          .eq('status', 'approved');
        setTeachers(teacherData || []);

        // 获取班级
        const { data: classData } = await supabase
          .from('classes')
          .select('*')
          .eq('school_id', adminData.school_id);
        setClasses(classData || []);

        // 获取待审核报名
        const { data: enrollmentData } = await supabase
          .from('enrollments')
          .select('*')
          .eq('school_id', adminData.school_id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        setEnrollments(enrollmentData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentAction = async (id, status) => {
    try {
      await supabase.from('enrollments').update({ 
        status, 
        reviewed_by: user?.id, 
        reviewed_at: new Date().toISOString() 
      }).eq('id', id);
      setMessage({ type: 'success', text: t.success });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: t.failed });
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
        {school && <p style={{ color: 'var(--text-muted)' }}>{school.name_zh || school.name}</p>}
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>
          {message.text}
        </div>
      )}

      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📊 {t.overview}
        </button>
        <button className={`tab ${activeTab === 'teachers' ? 'active' : ''}`} onClick={() => setActiveTab('teachers')}>
          👨‍🏫 {t.teachers}
        </button>
        <button className={`tab ${activeTab === 'classes' ? 'active' : ''}`} onClick={() => setActiveTab('classes')}>
          📚 {t.classes}
        </button>
        <button className={`tab ${activeTab === 'enrollments' ? 'active' : ''}`} onClick={() => setActiveTab('enrollments')}>
          📝 {t.enrollments} {enrollments.length > 0 && <span className="badge badge-error" style={{ marginLeft: '0.25rem' }}>{enrollments.length}</span>}
        </button>
      </div>

      {/* 概览 */}
      {activeTab === 'overview' && school && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>{t.schoolInfo}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.schoolName}</p>
                <p style={{ fontWeight: '600' }}>{school.name_zh || school.name}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.schoolCode}</p>
                <p style={{ fontWeight: '600' }}>{school.code}</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>{teachers.length}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.currentTeachers}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>/ {school.max_teachers}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--success)' }}>{school.current_students || 0}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.currentStudents}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>/ {school.max_students}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--info)' }}>{classes.length}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.totalClasses}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--warning)' }}>{enrollments.length}</div>
              <div style={{ color: 'var(--text-muted)' }}>{t.pendingEnrollments}</div>
            </div>
          </div>
        </div>
      )}

      {/* 教师 */}
      {activeTab === 'teachers' && (
        <div className="card">
          {teachers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t.name}</th>
                    <th>{t.email}</th>
                    <th>{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map(item => (
                    <tr key={item.id}>
                      <td>{item.teacher?.name || item.teacher?.username}</td>
                      <td>{item.teacher?.email || '-'}</td>
                      <td><span className="badge badge-success">{t.active}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 班级 */}
      {activeTab === 'classes' && (
        <div className="card">
          {classes.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {classes.map(cls => (
                <div key={cls.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                  <h4>{cls.name}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{cls.description}</p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <span className="badge badge-info">HSK {cls.hsk_level}</span>
                    <span style={{ fontSize: '0.875rem' }}>👥 {cls.current_students || 0}/{cls.max_students}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 报名审核 */}
      {activeTab === 'enrollments' && (
        <div className="card">
          {enrollments.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noData}</p>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t.name}</th>
                    <th>{t.phone}</th>
                    <th>{language === 'zh' ? '申请日期' : 'Date'}</th>
                    <th>{t.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(e => (
                    <tr key={e.id}>
                      <td>{e.student_name_zh || e.student_name}</td>
                      <td>{e.parent_phone || '-'}</td>
                      <td>{new Date(e.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => handleEnrollmentAction(e.id, 'approved')}>
                            ✓ {t.approve}
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleEnrollmentAction(e.id, 'rejected')}>
                            ✗
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchoolAdminPage;
