import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../styles/main.css';

const Layout = () => {
  const { user, logout, isAdmin, isTeacher, isStudent, isParent } = useAuth();
  const { t, language, setLanguage, languages } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pandaImg, setPandaImg] = useState(null);
  const navRef = useRef(null);
  const navDragIdx  = useRef(null);
  const navDragOver = useRef(null);


  // Load random panda from Supabase
  useEffect(() => {
    if (!supabase) return;
    supabase.from('dwxz_panda_assets')
      .select('image_url, label')
      .not('image_url', 'is', null)
      .limit(20)
      .then(({ data }) => {
        if (data?.length) {
          const pick = data[Math.floor(Math.random() * data.length)];
          setPandaImg(pick);
        }
      });
  }, [supabase]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar  = () => setSidebarOpen(false);

  const label = (zh, en, it) => language === 'zh' ? zh : language === 'it' ? it : en;

  // Role-based navigation
  const roleBasedNav = {
    super_admin: [
      { path: '/super-admin',          icon: '📊', label: label('系统概览',  'Overview',      'Panoramica')  },
      { path: '/super-admin?tab=users',icon: '👥', label: label('用户与访问','Users & Access', 'Utenti')      },
      { path: '/super-admin?tab=kb',   icon: '🧠', label: label('知识库监控','KB Monitor',    'Monitor KB')  },
      { path: '/admin/content-hub',    icon: '📂', label: label('内容与知识库','Content & KB', 'Contenuto')  },
      { path: '/super-admin?tab=config',icon:'⚙️', label: label('系统配置',  'Config',        'Config')      },
      { path: '/super-admin?tab=panda',icon: '🐼', label: label('Panda Studio','Panda Studio','Panda Studio')},
    ],

    school_master: [
      { path: '/school-master',                   icon: '📊',  label: label('学校总览',  'Overview',      'Panoramica')    },
      { path: '/school-master?tab=attendance',    icon: '✅',  label: label('出勤管理',  'Attendance',    'Presenze')      },
      { path: '/school-master?tab=homework',      icon: '📝',  label: label('作业管理',  'Homework',      'Compiti')       },
      { path: '/school-master?tab=teaching',      icon: '📈',  label: label('教学情况',  'Teaching',      'Insegnamento')  },
      { path: '/school-master?tab=ai',            icon: '🧠',  label: label('AI分析',    'AI Insights',   'AI Analisi')    },
      { path: '/school-master?tab=notify',        icon: '📢',  label: label('发送通知',  'Notifications', 'Notifiche')     },
      { path: '/school-master/teachers',          icon: '👨‍🏫', label: label('教师管理',  'Teachers',      'Insegnanti')    },
      { path: '/reports',                         icon: '📊',  label: label('统计报告',  'Reports',       'Rapporti')      },
    ],

    content_editor: [
      { path: '/editor',           icon: '🏠', label: label('编辑中心',  'Editor Center', 'Centro Editor') },
      { path: '/editor/chengyu',   icon: '📜', label: label('成语管理',  'Chengyu',       'Chengyu')       },
      { path: '/editor/videos',    icon: '🎬', label: label('视频管理',  'Videos',        'Video')         },
      { path: '/editor/games',     icon: '🎮', label: label('游戏管理',  'Games',         'Giochi')        },
      { path: '/editor/quizzes',   icon: '❓', label: label('测验管理',  'Quizzes',       'Quiz')          },
      { path: '/editor/knowledge', icon: '📚', label: label('知识库',    'Knowledge',     'Conoscenze')    },
      { path: '/editor/materials', icon: '📤', label: label('资料上传',  'Materials',     'Materiali')     },
    ],

    admin: [
      { path: '/school-admin',                  icon: '🏫', label: label('学校管理',  'School Admin',  'Admin Scuola') },
      { path: '/school-admin/applications',     icon: '📋', label: label('申请审核',  'Applications',  'Richieste')    },
      { path: '/school-admin/invitation-codes', icon: '🎫', label: label('邀请码',    'Invite Codes',  'Codici')       },
      { path: '/admin/enrollments',             icon: '📝', label: label('报名管理',  'Enrollments',   'Iscrizioni')   },
      { path: '/admin/notifications',           icon: '📢', label: label('通知',      'Notifications', 'Notifiche')    },
      { path: '/reports',                       icon: '📊', label: label('统计报告',  'Reports',       'Rapporti')     },
    ],

    teacher: [
      { path: '/teacher/classes',   icon: '🏫',  label: label('班级管理',  'Class Management', 'Gestione Classi')   },
      { path: '/teacher/homework',  icon: '📝',  label: label('作业管理',  'Homework',         'Compiti')           },
      { path: '/teacher/grading',   icon: '✅',  label: label('作业批改',  'Grade Work',       'Valutazione')       },
      { path: '/teacher/tools',     icon: '🛠️', label: label('教学工具',  'Teaching Tools',   'Strumenti')         },
      { path: '/teacher/progress',    icon: '📈',  label: label('教学进度',  'Progress',         'Progresso')         },
      { path: '/points',            icon: '🎯',  label: label('我的积分',  'My Points',        'I Miei Punti')      },
    ],

    student: [
      { path: '/student',              icon: '🏠', label: label('学习中心',  'Learning Center', 'Centro Studio')  },
      { path: '/student/homework',     icon: '📝', label: label('我的作业',  'My Homework',     'I Miei Compiti') },
      { path: '/points',               icon: '🎁', label: label('积分商城',  'Points Shop',     'Negozio Punti')  },
    ],

    parent: [
      { path: '/parent?tab=homework',   icon: '📝', label: label('作业情况', 'Homework',   'Compiti')  },
      { path: '/parent?tab=attendance', icon: '✅', label: label('出勤记录', 'Attendance', 'Presenze') },
      { path: '/parent?tab=analysis',   icon: '🧠', label: label('学业分析', 'Analysis',  'Analisi')  },
      { path: '/parent?tab=messages',   icon: '💬', label: label('家校沟通', 'Messages',  'Messaggi') },
    ],
  };

  const getCommonNav = () => {
    const base = [
      { path: '/messages', icon: '💬', label: label('消息通知', 'Messages', 'Messaggi') },
      { path: '/profile',  icon: '👤', label: label('个人资料', 'Profile',  'Profilo')  },
    ];
// 文化体验 removed — dedicated module planned
    return base;
  };

  const navItems = [...(roleBasedNav[user?.role] || []), ...getCommonNav()];

  // orderedNav — restore saved drag order from localStorage
  const [orderedNav, setOrderedNav] = useState(() => navItems);
  useEffect(() => {
    if (!navItems.length) return;
    try {
      const saved = localStorage.getItem('nav_order_' + (user?.role || 'default'));
      if (saved) {
        const paths = JSON.parse(saved);
        const sorted = [...navItems].sort((a, b) => {
          const ai = paths.indexOf(a.path), bi = paths.indexOf(b.path);
          if (ai < 0) return 1; if (bi < 0) return -1;
          return ai - bi;
        });
        setOrderedNav(sorted);
        return;
      }
    } catch {}
    setOrderedNav(navItems);
  }, [user?.role]);

  return (
    <div className="app-layout">
      <button className="mobile-menu-toggle" onClick={toggleSidebar}>
        <span/><span/><span/>
      </button>

      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={closeSidebar}/>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display:'flex', alignItems:'center', gap:10, padding:'1rem' }}>
          {pandaImg?.image_url ? (
            <img src={pandaImg.image_url} alt={pandaImg.label||'panda'}
              onClick={()=>{setPandaImg(null); supabase?.from('dwxz_panda_assets').select('image_url,label,emotion').not('image_url','is',null).limit(20).then(({data})=>{if(data?.length)setPandaImg(data[Math.floor(Math.random()*data.length)]);});}}
              title="点击换一个🐼"
              style={{ cursor:'pointer' }}
              style={{ width:44, height:44, objectFit:'contain', flexShrink:0 }}/>
          ) : (
            <span style={{ fontSize:32, lineHeight:1 }}>🐼</span>
          )}
          <div>
            <h1 style={{ margin:0 }}>{t('app_name')}</h1>
            <span style={{ fontSize:12, opacity:0.8 }}>{language === 'zh' ? '学中文，真有趣' : language === 'it' ? 'Imparare è divertente' : 'Learning is fun'}</span>
          </div>
        </div>

        {/* Scrollable + draggable nav */}
        <button onClick={()=>navRef.current?.scrollBy({top:-80,behavior:'smooth'})}
          style={{ width:'100%', border:'none', background:'rgba(255,255,255,0.08)',
            color:'rgba(255,255,255,0.6)', cursor:'pointer', padding:'4px', fontSize:14 }}>▲</button>

        <nav ref={navRef} className="sidebar-nav"
          style={{ overflowY:'auto', flex:1, scrollbarWidth:'none' }}>
          <style>{`.sidebar-nav::-webkit-scrollbar{display:none}
            .nav-item.drag-over{border-top:2px solid rgba(255,255,255,0.6)}`}
          </style>
          {orderedNav.map((item, i) => (
            <div key={item.path}
              draggable
              onDragStart={e => { navDragIdx.current=i; e.dataTransfer.effectAllowed='move'; e.currentTarget.style.opacity='0.5'; }}
              onDragEnter={() => { navDragOver.current=i; }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; }}
              onDrop={e => e.preventDefault()}
              onDragEnd={e => {
                e.currentTarget.style.opacity='1';
                const f=navDragIdx.current, t=navDragOver.current;
                navDragIdx.current=null; navDragOver.current=null;
                if(f===null||t===null||f===t) return;
                setOrderedNav(arr=>{
                  const a=[...arr];
                  a.splice(t,0,a.splice(f,1)[0]);
                  try{localStorage.setItem('nav_order_'+user?.role,JSON.stringify(a.map(x=>x.path)));}catch{}
                  return a;
                });
              }}
              style={{ cursor:'grab', transition:'opacity .15s' }}>
              <NavLink
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={closeSidebar}
                style={{ cursor:'inherit', userSelect:'none' }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </div>
          ))}
        </nav>

        <button onClick={()=>navRef.current?.scrollBy({top:80,behavior:'smooth'})}
          style={{ width:'100%', border:'none', background:'rgba(255,255,255,0.08)',
            color:'rgba(255,255,255,0.6)', cursor:'pointer', padding:'4px', fontSize:14 }}>▼</button>

        {/* 国旗语言切换 */}
        <div style={{ display:'flex', gap:6, padding:'0.75rem 1rem',
          borderTop:'1px solid rgba(255,255,255,0.12)' }}>
          {['zh','en','it'].map(code => {
            const flags = { zh:'🇨🇳', en:'🇬🇧', it:'🇮🇹' };
            return (
              <button key={code} onClick={() => setLanguage(code)}
                title={code === 'zh' ? '中文' : code === 'it' ? 'Italiano' : 'English'}
                style={{
                  background: language===code ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  border: language===code ? '2px solid rgba(255,255,255,0.55)' : '2px solid transparent',
                  borderRadius:8, cursor:'pointer', fontSize:22, lineHeight:1,
                  padding:'4px 7px', transition:'all .15s',
                }}>
                {flags[code]}
              </button>
            );
          })}
        </div>

        <div className="user-header">
          <div className="user-avatar">{user?.name?.charAt(0)?.toUpperCase()}</div>
          <div className="user-info">
            <h4>{user?.name}</h4>
            <p>{t(`roles.${user?.role}`)}</p>
          </div>
        </div>

        <button onClick={handleLogout} className="btn btn-outline"
          style={{ width:'100%', marginTop:'1rem', color:'white', borderColor:'rgba(255,255,255,0.3)' }}>
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
