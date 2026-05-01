import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

const ContentEditorPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    chengyu: 0,
    videos: 0,
    games: 0,
    quizzes: 0,
    knowledge: 0,
    pending: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentItems, setRecentItems] = useState([]);

  const txt = {
    zh: {
      title: '内容编辑中心',
      subtitle: '管理成语、视频、游戏、测验等教学内容',
      welcome: '欢迎回来',
      stats: '内容统计',
      chengyu: '成语',
      videos: '视频',
      games: '游戏',
      quizzes: '测验',
      knowledge: '知识',
      pending: '待审核',
      quickActions: '快捷操作',
      addChengyu: '添加成语',
      addVideo: '上传视频',
      addGame: '创建游戏',
      addQuiz: '创建测验',
      recentActivity: '最近编辑',
      noActivity: '暂无编辑记录',
      viewAll: '查看全部'
    },
    en: {
      title: 'Content Editor Center',
      subtitle: 'Manage Chengyu, Videos, Games, Quizzes and more',
      welcome: 'Welcome back',
      stats: 'Content Statistics',
      chengyu: 'Chengyu',
      videos: 'Videos',
      games: 'Games',
      quizzes: 'Quizzes',
      knowledge: 'Knowledge',
      pending: 'Pending',
      quickActions: 'Quick Actions',
      addChengyu: 'Add Chengyu',
      addVideo: 'Upload Video',
      addGame: 'Create Game',
      addQuiz: 'Create Quiz',
      recentActivity: 'Recent Edits',
      noActivity: 'No recent edits',
      viewAll: 'View All'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      // Simulate loading stats
      setStats({
        chengyu: 156,
        videos: 42,
        games: 18,
        quizzes: 35,
        knowledge: 67,
        pending: 5
      });

      setRecentItems([
        { type: 'chengyu', title: '画龙点睛', time: '10分钟前', status: 'published' },
        { type: 'video', title: '中国春节习俗', time: '1小时前', status: 'pending' },
        { type: 'game', title: 'HSK3词汇配对', time: '2小时前', status: 'published' },
        { type: 'quiz', title: '语法测验 - 比较句', time: '昨天', status: 'published' },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { key: 'chengyu', icon: '📜', color: '#ef4444', path: '/editor/chengyu' },
    { key: 'videos', icon: '🎬', color: '#3b82f6', path: '/editor/videos' },
    { key: 'games', icon: '🎮', color: '#22c55e', path: '/editor/games' },
    { key: 'quizzes', icon: '❓', color: '#f59e0b', path: '/editor/quizzes' },
    { key: 'knowledge', icon: '📚', color: '#8b5cf6', path: '/editor/knowledge' },
    { key: 'pending', icon: '⏳', color: '#6b7280', path: '/editor/pending' }
  ];

  const quickActions = [
    { icon: '📜', label: t.addChengyu, path: '/editor/chengyu', color: '#ef4444' },
    { icon: '🎬', label: t.addVideo, path: '/editor/videos', color: '#3b82f6' },
    { icon: '🎮', label: t.addGame, path: '/editor/games', color: '#22c55e' },
    { icon: '❓', label: t.addQuiz, path: '/editor/quizzes', color: '#f59e0b' }
  ];

  const typeIcons = { chengyu: '📜', video: '🎬', game: '🎮', quiz: '❓' };
  const statusColors = { published: '#22c55e', pending: '#f59e0b', draft: '#6b7280' };

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>✏️ {t.title}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
      </div>

      <p style={{ marginBottom: '1.5rem' }}>
        {t.welcome}, <strong>{user?.name_zh || user?.name || 'Editor'}</strong>!
      </p>

      {/* Stats */}
      <h3 style={{ marginBottom: '1rem' }}>📊 {t.stats}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {statCards.map(card => (
          <div
            key={card.key}
            className="card"
            onClick={() => navigate(card.path)}
            style={{ textAlign: 'center', padding: '1.25rem', cursor: 'pointer', transition: 'transform 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{card.icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: card.color }}>{stats[card.key]}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t[card.key]}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h3 style={{ marginBottom: '1rem' }}>⚡ {t.quickActions}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {quickActions.map((action, idx) => (
          <button
            key={idx}
            className="card"
            onClick={() => navigate(action.path)}
            style={{
              padding: '1.25rem',
              textAlign: 'center',
              cursor: 'pointer',
              border: 'none',
              background: 'var(--card-bg)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = action.color; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{action.icon}</div>
            <div style={{ fontWeight: '500', color: action.color }}>+ {action.label}</div>
          </button>
        ))}
      </div>

      {/* Recent Activity */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>🕐 {t.recentActivity}</h3>
        <button className="btn btn-outline btn-sm">{t.viewAll}</button>
      </div>
      <div className="card">
        {recentItems.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>{t.noActivity}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.75rem',
                  borderBottom: idx < recentItems.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{typeIcons[item.type]}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500' }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.time}</div>
                </div>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  background: statusColors[item.status] + '20',
                  color: statusColors[item.status]
                }}>
                  {item.status === 'published' ? '已发布' : item.status === 'pending' ? '待审核' : '草稿'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentEditorPage;
