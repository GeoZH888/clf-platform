import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
        const { data: classes } = await supabase.from('dwxz_classes').select('*').eq('is_active', true);
        
        // Load homework
        const { data: homework } = await supabase.from('dwxz_homework').select('*').eq('is_active', true);
        
        // Load events
        const { data: events } = await supabase.from('dwxz_events').select('*').order('start_date', { ascending: true }).limit(5);

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
      { label: language === 'zh' ? '用户与访问' : 'Users & Access', path: '/super-admin?tab=users',   icon: '👥' },
      { label: language === 'zh' ? '知识库监控' : 'KB Monitor',     path: '/super-admin?tab=kb',      icon: '🧠' },
      { label: language === 'zh' ? '系统配置'   : 'Config',         path: '/super-admin?tab=config',  icon: '⚙️' },
    ]
  };

  const getUserActions = () => {
    if (isAdmin) return quickActions.admin;
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

        {/* Adaptive Analysis for teachers — plain upcoming events for others */}
        {isAdmin ? (
          <AdminQuickLinks language={language}/>
        ) : isTeacher ? (
          <AdaptiveAnalysis supabase={supabase} language={language}/>
        ) : (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{t('dashboard.quick_actions')}</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
              {getUserActions().map((action, index) => (
                <Link key={index} to={action.path} className="btn btn-outline"
                  style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', height: 'auto', textAlign: 'center' }}>
                  <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{action.icon}</span>
                  <span>{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('dashboard.upcoming_events')}</h3>
            <Link to="/events" className="btn btn-sm btn-outline">
              {language === 'zh' ? '查看全部' : language === 'it' ? 'Vedi Tutti' : 'View All'}
            </Link>
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

/* ═══════════════════════════════════════════════════════
   Adaptive Class Analysis Component
   Reads: homework submissions, attendance, quiz scores
   Uses AI to suggest adaptive teaching strategy
   ═══════════════════════════════════════════════════════ */
function AdaptiveAnalysis({ supabase, language }) {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [classes, setClasses]   = useState([]);
  const [selClass, setSelClass] = useState('');
  const lbl = (zh, en) => language === 'zh' ? zh : en;

  useEffect(() => {
    if (!supabase) return;
    supabase.from('dwxz_classes').select('id,name,name_zh').eq('is_active', true)
      .then(({ data }) => { setClasses(data||[]); if(data?.[0]) setSelClass(data[0].id); });
  }, [supabase]);

  async function runAnalysis() {
    if (!selClass || !supabase) return;
    setLoading(true); setAnalysis(null);

    try {
      // Gather real data from Supabase
      const [hwRes, attRes, classRes] = await Promise.all([
        supabase.from('dwxz_homework').select('id,title,due_date').eq('class_id', selClass).limit(10),
        supabase.from('dwxz_class_attendance').select('status,date').eq('class_id', selClass).limit(100),
        supabase.from('dwxz_classes').select('name,name_zh,hsk_level').eq('id', selClass).single(),
      ]);

      const hw = hwRes.data || [];
      const att = attRes.data || [];
      const cls = classRes.data || {};

      // Compute metrics
      const attendanceRate = att.length > 0
        ? Math.round(att.filter(a => a.status === 'present').length / att.length * 100)
        : null;
      const hwCount = hw.length;

      // Call AI for adaptive analysis
      const res = await fetch('/.netlify/functions/teacher-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'qa',
          question: `作为教学顾问，分析以下班级数据并给出自适应教学建议：
班级：${cls.name_zh || cls.name}
HSK等级：${cls.hsk_level || '未知'}
出勤率：${attendanceRate !== null ? attendanceRate + '%' : '暂无数据'}
近期作业数量：${hwCount} 个
出勤记录数：${att.length}

请分析：
1. 班级整体学习状态（简短评估）
2. 主要问题或风险（如出勤率低、作业少）
3. 自适应教学建议（PPT风格、测验难度、课程节奏）
4. 本周推荐重点（3条具体建议）

用JSON格式回答：
{"status":"良好/需关注/警告","status_en":"good/warning/alert","summary":"2句话总结","issues":["问题1","问题2"],"recommendations":{"ppt_style":"建议PPT风格","quiz_difficulty":"建议测验难度","pace":"建议学习节奏"},"weekly_focus":["建议1","建议2","建议3"]}`,
          language,
        }),
      });
      const data = await res.json();
      let parsed = null;
      if (data.answer) {
        try {
          const m = data.answer.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
        } catch {}
      }
      setAnalysis(parsed || {
        status: '暂无数据', status_en: 'no_data',
        summary: data.answer || lbl('请先添加班级数据（作业、考勤记录）以生成分析', 'Add class data first'),
        issues: [], recommendations: {}, weekly_focus: [],
        _raw: data.answer,
      });
    } catch(e) {
      setAnalysis({ status:'错误', summary: e.message, issues:[], weekly_focus:[] });
    }
    setLoading(false);
  }

  const statusColor = { '良好':'#16a34a','需关注':'#d97706','警告':'#dc2626','good':'#16a34a','warning':'#d97706','alert':'#dc2626' };
  const color = statusColor[analysis?.status] || statusColor[analysis?.status_en] || '#6b7280';

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom:'1rem' }}>
        <h3 className="card-title">📊 {lbl('班级自适应分析','Adaptive Class Analysis')}</h3>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={selClass} onChange={e=>setSelClass(e.target.value)}
            style={{ padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)',
              fontSize:12, background:'var(--background)' }}>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name_zh||c.name}</option>)}
          </select>
          <button onClick={runAnalysis} disabled={loading||!selClass}
            style={{ padding:'4px 14px', borderRadius:8, border:'none', cursor:'pointer',
              background:'var(--primary)', color:'#fff', fontSize:12, fontWeight:600,
              opacity:loading?0.6:1 }}>
            {loading ? lbl('分析中...','Analysing...') : lbl('分析','Analyse')}
          </button>
        </div>
      </div>

      {!analysis && !loading && (
        <div style={{ color:'var(--text-muted)', fontSize:13, padding:'1rem 0', textAlign:'center' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📈</div>
          {lbl('点击"分析"按钮，AI 将根据班级出勤、作业和学习数据生成自适应教学建议',
               'Click Analyse — AI will generate adaptive teaching suggestions based on attendance, homework and performance data')}
        </div>
      )}

      {loading && (
        <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)', fontSize:13 }}>
          ⏳ {lbl('正在分析班级数据...','Analysing class data...')}
        </div>
      )}

      {analysis && !loading && (
        <div>
          {/* Status badge */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1rem' }}>
            <span style={{ padding:'4px 14px', borderRadius:20, fontWeight:700, fontSize:13,
              background:color+'20', color }}>
              {analysis.status}
            </span>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>{analysis.summary}</span>
          </div>

          {/* Issues */}
          {analysis.issues?.length > 0 && (
            <div style={{ marginBottom:'0.75rem' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#d97706', marginBottom:4 }}>
                ⚠️ {lbl('需关注','Issues')}
              </div>
              {analysis.issues.map((iss,i)=>(
                <div key={i} style={{ fontSize:12, color:'var(--text-muted)', paddingLeft:16 }}>• {iss}</div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && Object.keys(analysis.recommendations).length > 0 && (
            <div style={{ background:'#eff6ff', borderRadius:8, padding:'10px 14px', marginBottom:'0.75rem' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#1d4ed8', marginBottom:6 }}>
                🎯 {lbl('自适应建议','Adaptive Recommendations')}
              </div>
              {analysis.recommendations.ppt_style && (
                <div style={{ fontSize:12, color:'#1e40af' }}>📊 PPT: {analysis.recommendations.ppt_style}</div>
              )}
              {analysis.recommendations.quiz_difficulty && (
                <div style={{ fontSize:12, color:'#1e40af' }}>❓ {lbl('测验','Quiz')}: {analysis.recommendations.quiz_difficulty}</div>
              )}
              {analysis.recommendations.pace && (
                <div style={{ fontSize:12, color:'#1e40af' }}>⏱️ {lbl('节奏','Pace')}: {analysis.recommendations.pace}</div>
              )}
            </div>
          )}

          {/* Weekly focus */}
          {analysis.weekly_focus?.length > 0 && (
            <div style={{ marginBottom:'1rem' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--primary)', marginBottom:4 }}>
                📅 {lbl('本周重点','This Week')}
              </div>
              {analysis.weekly_focus.map((f,i)=>(
                <div key={i} style={{ fontSize:12, color:'var(--text-muted)', paddingLeft:16 }}>
                  {i+1}. {f}
                </div>
              ))}
            </div>
          )}

          {/* Action buttons — link to teaching tools with prefilled context */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:'0.75rem' }}>
            <button onClick={()=>navigate('/teacher/tools?tab=ppt')}
              style={{ padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                background:'var(--primary)', color:'#fff', fontSize:12, fontWeight:600 }}>
              📊 {lbl('生成自适应PPT','Generate Adaptive PPT')}
            </button>
            <button onClick={()=>navigate('/teacher/tools?tab=quiz')}
              style={{ padding:'6px 14px', borderRadius:8, border:'1px solid var(--border)',
                background:'none', cursor:'pointer', fontSize:12 }}>
              ❓ {lbl('生成自适应测验','Generate Adaptive Quiz')}
            </button>
          </div>

          {analysis._raw && !analysis.weekly_focus?.length && (
            <pre style={{ fontSize:11, background:'var(--background)', padding:10,
              borderRadius:8, overflow:'auto', maxHeight:200, whiteSpace:'pre-wrap', marginTop:8 }}>
              {analysis._raw}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function AdminQuickLinks({ language }) {
  const lbl = (zh, en) => language === 'zh' ? zh : en;
  const links = [
    { icon:'👥', label:lbl('用户与访问','Users & Access'), path:'/super-admin?tab=users',  color:'#2563eb' },
    { icon:'🧠', label:lbl('知识库监控','KB Monitor'),     path:'/super-admin?tab=kb',     color:'#7c3aed' },
    { icon:'⚙️', label:lbl('系统配置','Config'),           path:'/super-admin?tab=config', color:'#d97706' },
    { icon:'🐼', label:'Panda Studio',                      path:'/super-admin?tab=panda',  color:'#c41e3a' },
  ];
  return (
    <div className="card">
      <div className="card-header"><h3 className="card-title">⚡ {lbl('超管快捷入口','Admin Quick Access')}</h3></div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'0.75rem' }}>
        {links.map((l,i) => (
          <a key={i} href={l.path}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'1rem',
              borderRadius:12, border:`2px solid ${l.color}20`, background:`${l.color}08`,
              textDecoration:'none', color:'inherit', gap:6, cursor:'pointer' }}>
            <span style={{ fontSize:28 }}>{l.icon}</span>
            <span style={{ fontSize:12, fontWeight:600, color:l.color, textAlign:'center' }}>{l.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default DashboardPage;
