import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../styles/main.css';

const Layout = () => {
  const { user, logout, isAdmin, isTeacher, isStudent, isParent } = useAuth();
  const { t, language, setLanguage, languages } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Helper for trilingual labels
  const label = (zh, en, it) => language === 'zh' ? zh : language === 'it' ? it : en;

  // Role-based navigation
  const roleBasedNav = {
    super_admin: [
      { path: '/admin', label: label('管理面板', 'Admin Panel', 'Pannello Admin'), icon: '👑' },
      { path: '/admin/users', label: label('用户管理', 'Users', 'Utenti'), icon: '👥' },
      { path: '/admin/schools', label: label('学校管理', 'Schools', 'Scuole'), icon: '🏫' },
      { path: '/admin/applications', label: label('申请审核', 'Applications', 'Richieste'), icon: '📋' },
      { path: '/admin/invitation-codes', label: label('邀请码', 'Invite Codes', 'Codici'), icon: '🎫' },
      { path: '/admin/points', label: label('积分管理', 'Points Admin', 'Admin Punti'), icon: '🎯' },
      // 内容管理（成语/视频/游戏/知识）
      { path: '/admin/content', label: label('内容管理', 'Content', 'Contenuti'), icon: '🎭' },
      // HSK真题管理
      { path: '/admin/hsk-tests', label: label('HSK真题', 'HSK Tests', 'Test HSK'), icon: '📝' },
      // 知识库（RAG/AI配置）
      { path: '/admin/knowledge', label: label('知识库', 'Knowledge Base', 'Base Conoscenze'), icon: '📚' },
      { path: '/admin/notifications', label: label('通知管理', 'Notifications', 'Notifiche'), icon: '📢' },
      { path: '/reports', label: label('统计报告', 'Reports', 'Rapporti'), icon: '📊' },
    ],
    school_master: [
      { path: '/school-master', label: label('校长中心', 'Principal Center', 'Centro Preside'), icon: '🎓' },
      { path: '/school-master/teachers', label: label('教师管理', 'Teachers', 'Insegnanti'), icon: '👨‍🏫' },
      { path: '/school-master/students', label: label('学生管理', 'Students', 'Studenti'), icon: '👨‍🎓' },
      { path: '/school-master/classes', label: label('班级考勤', 'Classes & Attendance', 'Classi e Presenze'), icon: '🏫' },
      { path: '/school-master/applications', label: label('申请审核', 'Applications', 'Richieste'), icon: '📋' },
      { path: '/school-master/content', label: label('内容管理', 'Content', 'Contenuti'), icon: '🎭' },
      { path: '/school-master/hsk-tests', label: label('HSK真题', 'HSK Tests', 'Test HSK'), icon: '📝' },
      { path: '/school-master/points', label: label('积分管理', 'Points', 'Punti'), icon: '🎯' },
      { path: '/reports', label: label('统计报告', 'Reports', 'Rapporti'), icon: '📊' },
    ],
    content_editor: [
      { path: '/editor', label: label('编辑中心', 'Editor Center', 'Centro Editor'), icon: '🏠' },
      { path: '/editor/chengyu', label: label('成语管理', 'Chengyu', 'Chengyu'), icon: '📜' },
      { path: '/editor/videos', label: label('视频管理', 'Videos', 'Video'), icon: '🎬' },
      { path: '/editor/games', label: label('游戏管理', 'Games', 'Giochi'), icon: '🎮' },
      { path: '/editor/quizzes', label: label('测验管理', 'Quizzes', 'Quiz'), icon: '❓' },
      { path: '/editor/hsk-tests', label: label('HSK真题', 'HSK Tests', 'Test HSK'), icon: '📝' },
      { path: '/editor/knowledge', label: label('知识库', 'Knowledge', 'Conoscenze'), icon: '📚' },
      { path: '/editor/materials', label: label('资料上传', 'Materials', 'Materiali'), icon: '📤' },
    ],
    admin: [
      { path: '/school-admin', label: label('学校管理', 'School Admin', 'Admin Scuola'), icon: '🏫' },
      { path: '/school-admin/applications', label: label('申请审核', 'Applications', 'Richieste'), icon: '📋' },
      { path: '/school-admin/invitation-codes', label: label('邀请码', 'Invite Codes', 'Codici'), icon: '🎫' },
      { path: '/admin/enrollments', label: label('报名管理', 'Enrollments', 'Iscrizioni'), icon: '📝' },
      { path: '/admin/notifications', label: label('通知', 'Notifications', 'Notifiche'), icon: '📢' },
      { path: '/reports', label: label('统计报告', 'Reports', 'Rapporti'), icon: '📊' },
    ],
    teacher: [
      { path: '/teacher', label: label('教师中心', 'Teacher Center', 'Centro Insegnante'), icon: '🏠' },
      { path: '/teacher/classes', label: label('班级管理', 'Class Management', 'Gestione Classi'), icon: '👥' },
      { path: '/teacher/homework', label: label('作业管理', 'Homework', 'Compiti'), icon: '📝' },
      { path: '/teacher/tools', label: label('教学工具', 'Teaching Tools', 'Strumenti'), icon: '🛠️' },
      { path: '/teacher/hsk-tests', label: label('HSK真题', 'HSK Tests', 'Test HSK'), icon: '📝' },
      { path: '/teacher/assistant', label: label('助手精灵', 'AI Helper', 'Assistente AI'), icon: '🧞' },
      { path: '/points', label: label('我的积分', 'My Points', 'I Miei Punti'), icon: '🎯' },
    ],
    student: [
      { path: '/student', label: label('学习中心', 'Learning Center', 'Centro Studio'), icon: '🏠' },
      { path: '/student/homework', label: label('我的作业', 'My Homework', 'I Miei Compiti'), icon: '📝' },
      { path: '/student/hsk-practice', label: label('HSK练习', 'HSK Practice', 'Pratica HSK'), icon: '📝' },
      { path: '/student/culture', label: label('文化学习', 'Culture Learning', 'Cultura'), icon: '🎭' },
      { path: '/points', label: label('积分商城', 'Points Shop', 'Negozio Punti'), icon: '🎁' },
    ],
    parent: [
      { path: '/parent', label: label('家长中心', 'Parent Center', 'Centro Genitori'), icon: '🏠' },
      { path: '/points', label: label('我的积分', 'My Points', 'I Miei Punti'), icon: '🎯' },
    ]
  };

  // Common nav - different based on role
  const getCommonNav = () => {
    const base = [
      { path: '/messages', label: label('消息通知', 'Messages', 'Messaggi'), icon: '💬' },
      { path: '/profile', label: label('个人资料', 'Profile', 'Profilo'), icon: '👤' },
    ];
    
    // Only add culture for non-admin roles (they have content management instead)
    if (!['super_admin', 'school_master', 'content_editor'].includes(user?.role)) {
      base.unshift({ path: '/culture', label: label('文化体验', 'Culture', 'Cultura'), icon: '📖' });
    }
    
    return base;
  };

  const commonNav = getCommonNav();

  const navItems = [...(roleBasedNav[user?.role] || []), ...commonNav];

  return (
    <div className="app-layout">
      {/* 移动端菜单按钮 */}
      <button className="mobile-menu-toggle" onClick={toggleSidebar}>
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* 移动端遮罩 */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} 
        onClick={closeSidebar}
      ></div>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>{t('app_name')}</h1>
          <span>{language === 'zh' ? '学中文，真有趣' : language === 'it' ? 'Imparare è divertente' : 'Learning is fun'}</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="language-selector" style={{ marginBottom: '1rem', justifyContent: 'flex-start' }}>
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`language-btn ${language === lang.code ? 'active' : ''}`}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
            >
              {lang.flag}
            </button>
          ))}
        </div>

        <div className="user-header">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <h4>{user?.name}</h4>
            <p>{t(`roles.${user?.role}`)}</p>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="btn btn-outline"
          style={{ width: '100%', marginTop: '1rem', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
        >
          {t('logout')}
        </button>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
