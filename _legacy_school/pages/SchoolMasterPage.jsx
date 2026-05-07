import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

const SchoolMasterPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    teachers: 0,
    students: 0,
    classes: 0,
    pendingApplications: 0,
    todayAttendance: 0,
    totalMaterials: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState([]);

  const txt = {
    zh: {
      title: '校长管理中心',
      welcome: '欢迎回来',
      overview: '学校概览',
      teachers: '教师总数',
      students: '学生总数',
      classes: '班级总数',
      pendingApps: '待审核申请',
      todayAttendance: '今日出勤率',
      materials: '教学资料',
      quickActions: '快捷操作',
      manageTeachers: '管理教师',
      manageStudents: '管理学生',
      manageClasses: '管理班级',
      reviewApps: '审核申请',
      viewReports: '查看报告',
      aiTraining: '智能训练',
      recentActivity: '最近动态',
      noActivity: '暂无动态'
    },
    en: {
      title: 'Principal Dashboard',
      welcome: 'Welcome back',
      overview: 'School Overview',
      teachers: 'Total Teachers',
      students: 'Total Students',
      classes: 'Total Classes',
      pendingApps: 'Pending Applications',
      todayAttendance: 'Today Attendance',
      materials: 'Teaching Materials',
      quickActions: 'Quick Actions',
      manageTeachers: 'Manage Teachers',
      manageStudents: 'Manage Students',
      manageClasses: 'Manage Classes',
      reviewApps: 'Review Applications',
      viewReports: 'View Reports',
      aiTraining: 'AI Training',
      recentActivity: 'Recent Activity',
      noActivity: 'No recent activity'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    if (!supabase) return;
    setLoading(true);

    try {
      // Count teachers
      const { count: teacherCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher')
        .eq('is_active', true);

      // Count students
      const { count: studentCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student')
        .eq('is_active', true);

      // Count classes
      const { count: classCount } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Count pending applications
      const { count: pendingCount } = await supabase
        .from('user_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Count materials
      const { count: materialCount } = await supabase
        .from('rag_documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      setStats({
        teachers: teacherCount || 0,
        students: studentCount || 0,
        classes: classCount || 0,
        pendingApplications: pendingCount || 0,
        todayAttendance: 85, // Placeholder
        totalMaterials: materialCount || 0
      });

      // Load recent activities (placeholder)
      setRecentActivities([
        { type: 'new_student', message: '新学生注册', time: '10分钟前' },
        { type: 'homework', message: '教师布置了新作业', time: '30分钟前' },
        { type: 'material', message: '新教材已上传', time: '1小时前' },
      ]);

    } catch (err) {
      console.error('Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { icon: '👨‍🏫', label: t.manageTeachers, path: '/school-master/teachers', color: '#3b82f6' },
    { icon: '👨‍🎓', label: t.manageStudents, path: '/school-master/students', color: '#22c55e' },
    { icon: '🏫', label: t.manageClasses, path: '/school-master/classes', color: '#f59e0b' },
    { icon: '📋', label: t.reviewApps, path: '/school-master/applications', color: '#ef4444', badge: stats.pendingApplications },
    { icon: '📊', label: t.viewReports, path: '/reports', color: '#8b5cf6' },
    { icon: '🧠', label: t.aiTraining, path: '/school-master/ai-training', color: '#06b6d4' },
  ];

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>🎓 {t.title}</h1>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        {t.welcome}, {user?.name_zh || user?.name || 'Principal'}!
      </p>

      {/* Stats Overview */}
      <h3 style={{ marginBottom: '1rem' }}>📊 {t.overview}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', color: '#3b82f6' }}>{stats.teachers}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.teachers}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', color: '#22c55e' }}>{stats.students}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.students}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', color: '#f59e0b' }}>{stats.classes}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.classes}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', color: '#ef4444' }}>{stats.pendingApplications}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.pendingApps}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', color: '#8b5cf6' }}>{stats.todayAttendance}%</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.todayAttendance}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
          <div style={{ fontSize: '2.5rem', color: '#06b6d4' }}>{stats.totalMaterials}</div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t.materials}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <h3 style={{ marginBottom: '1rem' }}>⚡ {t.quickActions}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {quickActions.map((action, idx) => (
          <div
            key={idx}
            className="card"
            onClick={() => navigate(action.path)}
            style={{
              cursor: 'pointer',
              padding: '1.25rem',
              textAlign: 'center',
              transition: 'all 0.2s',
              position: 'relative'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {action.badge > 0 && (
              <span style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                {action.badge}
              </span>
            )}
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{action.icon}</div>
            <div style={{ fontWeight: '500', color: action.color }}>{action.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <h3 style={{ marginBottom: '1rem' }}>🕐 {t.recentActivity}</h3>
      <div className="card">
        {recentActivities.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
            {t.noActivity}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentActivities.map((activity, idx) => (
              <div key={idx} style={{
                padding: '0.75rem',
                background: 'var(--background)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{activity.message}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{activity.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolMasterPage;
