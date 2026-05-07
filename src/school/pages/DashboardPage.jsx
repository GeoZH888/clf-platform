import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const DashboardPage = () => {
  const { user, isTeacher, isStudent, isParent, isAdmin, supabase } = useAuth();
  const { t, language } = useLanguage();
  const [stats, setStats] = useState({ classes: 0, homework: 0, attendance: 0, events: 0 });
  const [recentItems, setRecentItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      if (supabase) {
        // Load classes
        const { data: classes } = await supabase.from('classes').select('*').eq('is_active', true);
        
        // Load homework
        const { data: homework } = await supabase.from('homework').select('*').eq('is_active', true);
        
        // Load events
        const { data: events } = await supabase.from('events').select('*').order('start_date', { ascending: true }).limit(5);

        setStats({
          classes: classes?.length || 0,
          homework: homework?.length || 0,
          attendance: 95,
          events: events?.length || 0
        });

        setRecentItems(events || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = {
    teacher: [
      { label: language === 'zh' ? '班级管理' : language === 'it' ? 'Gestione Classi' : 'Class Management', path: '/teacher/classes', icon: '👥' },
      { label: language === 'zh' ? '布置作业' : language === 'it' ? 'Assegna Compiti' : 'Assign Homework', path: '/teacher/homework', icon: '📝' },
      { label: language === 'zh' ? '教学工具' : language === 'it' ? 'Strumenti' : 'Teaching Tools', path: '/teacher/tools', icon: '🛠️' },
      { label: language === 'zh' ? '助手精灵' : language === 'it' ? 'Assistente AI' : 'AI Helper', path: '/teacher/assistant', icon: '🧞' },
    ],
    student: [
      { label: language === 'zh' ? '我的作业' : language === 'it' ? 'I Miei Compiti' : 'My Homework', path: '/student/homework', icon: '📝' },
      { label: language === 'zh' ? 'HSK练习' : language === 'it' ? 'Pratica HSK' : 'HSK Practice', path: '/student/hsk', icon: '🏆' },
      { label: language === 'zh' ? '智能助手' : language === 'it' ? 'Assistente Intelligente' : 'AI Assistant', path: '/student/ai-agent', icon: '🤖' },
      { label: language === 'zh' ? '文化学习' : language === 'it' ? 'Cultura' : 'Culture', path: '/culture', icon: '📖' },
    ],
    parent: [
      { label: language === 'zh' ? '查看报告' : language === 'it' ? 'Vedi Rapporti' : 'View Reports', path: '/reports', icon: '📊' },
      { label: language === 'zh' ? '消息' : language === 'it' ? 'Messaggi' : 'Messages', path: '/messages', icon: '💬' },
      { label: language === 'zh' ? '活动' : language === 'it' ? 'Eventi' : 'Events', path: '/events', icon: '📅' },
    ],
    admin: [
      { label: language === 'zh' ? '用户管理' : language === 'it' ? 'Gestione Utenti' : 'User Management', path: '/admin', icon: '👥' },
      { label: language === 'zh' ? '系统统计' : language === 'it' ? 'Statistiche' : 'Statistics', path: '/admin', icon: '📈' },
      { label: language === 'zh' ? '任务分配' : language === 'it' ? 'Assegna Attività' : 'Assign Tasks', path: '/admin', icon: '📋' },
    ]
  };

  const getUserActions = () => {
    if (isAdmin) return [...quickActions.admin, ...quickActions.teacher];
    if (isTeacher) return quickActions.teacher;
    if (isParent) return quickActions.parent;
    return quickActions.student;
  };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <div>
          <h1>{t('dashboard.welcome_message')}, {user?.name || user?.username}! 👋</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t(`roles.${user?.role}`)}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon primary">📚</div>
          <div className="stat-content">
            <h3>{stats.classes}</h3>
            <p>{t('dashboard.total_classes')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">📝</div>
          <div className="stat-content">
            <h3>{stats.homework}</h3>
            <p>{t('dashboard.pending_homework')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success">✅</div>
          <div className="stat-content">
            <h3>{stats.attendance}%</h3>
            <p>{t('dashboard.attendance_rate')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon info">📅</div>
          <div className="stat-content">
            <h3>{stats.events}</h3>
            <p>{t('dashboard.upcoming_events')}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('dashboard.quick_actions')}</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
            {getUserActions().map((action, index) => (
              <Link key={index} to={action.path} className="btn btn-outline" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', height: 'auto', textAlign: 'center' }}>
                <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{action.icon}</span>
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Events */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('dashboard.upcoming_events')}</h3>
            <Link to="/events" className="btn btn-sm btn-outline">{language === 'zh' ? '查看全部' : language === 'it' ? 'Vedi Tutti' : 'View All'}</Link>
          </div>
          {recentItems.length > 0 ? (
            <div>
              {recentItems.slice(0, 5).map((event, index) => (
                <div key={index} className="list-item">
                  <div>
                    <strong>{language === 'zh' ? event.title_zh : event.title}</strong>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {event.start_date ? new Date(event.start_date).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <span className={`badge badge-${event.event_type === 'exam' ? 'warning' : 'info'}`}>
                    {event.event_type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>{language === 'zh' ? '暂无活动' : language === 'it' ? 'Nessun evento' : 'No events'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
