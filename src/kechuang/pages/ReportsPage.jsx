import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getAIService } from '../services/aiService';

const ReportsPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab]             = useState('overview');
  const [loading, setLoading]                 = useState(true);
  const [stats, setStats]                     = useState({});
  const [classStats, setClassStats]           = useState([]);
  const [studentProgress, setStudentProgress] = useState(null);
  const [classAverage, setClassAverage]       = useState(null);
  const [aiAnalysis, setAiAnalysis]           = useState('');
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);

  const isAdmin   = ['super_admin', 'admin'].includes(user?.role);
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  /* ── Translations ─────────────────────────────────────── */
  const txt = {
    zh: {
      title:'📊 智能统计报告', overview:'总览', classes:'班级报告',
      students:'学生报告', myProgress:'我的进度', analysis:'智能分析',
      schoolStats:'学校统计', totalStudents:'学生总数', totalTeachers:'教师总数',
      totalClasses:'班级总数', avgAttendance:'平均出勤率', avgScore:'平均分数',
      homeworkCompletion:'作业完成率', className:'班级名称', studentCount:'学生数',
      attendanceRate:'出勤率', avgHomework:'作业均分', trend:'趋势',
      up:'上升', down:'下降', stable:'稳定', myLevel:'我的水平',
      classAvg:'班级平均', ranking:'我的排名', outOf:'共', people:'人',
      strengths:'优势领域', weaknesses:'待提高领域',
      listening:'听力', speaking:'口语', reading:'阅读',
      writing:'写作', vocabulary:'词汇', grammar:'语法',
      recentActivity:'近期活动', homeworkSubmitted:'提交作业',
      attendanceChecked:'签到次数', quizCompleted:'完成测验',
      noData:'暂无数据', generateAnalysis:'生成智能分析', generating:'分析中...',
      privacyNote:'* 学生只能看到自己的成绩和班级平均水平',
      weeklyTrend:'本周趋势', monthlyTrend:'本月趋势', compareLastMonth:'较上月',
      performanceChart:'成绩分布图', attendanceChart:'出勤趋势图', aiSuggestions:'智能建议',
    },
    en: {
      title:'📊 Smart Analytics Report', overview:'Overview', classes:'Class Reports',
      students:'Student Reports', myProgress:'My Progress', analysis:'Intelligent Analysis',
      schoolStats:'School Statistics', totalStudents:'Total Students', totalTeachers:'Total Teachers',
      totalClasses:'Total Classes', avgAttendance:'Avg Attendance', avgScore:'Avg Score',
      homeworkCompletion:'Homework Completion', className:'Class Name', studentCount:'Students',
      attendanceRate:'Attendance', avgHomework:'Avg Homework', trend:'Trend',
      up:'Up', down:'Down', stable:'Stable', myLevel:'My Level',
      classAvg:'Class Average', ranking:'My Ranking', outOf:'out of', people:'students',
      strengths:'Strengths', weaknesses:'Areas to Improve',
      listening:'Listening', speaking:'Speaking', reading:'Reading',
      writing:'Writing', vocabulary:'Vocabulary', grammar:'Grammar',
      recentActivity:'Recent Activity', homeworkSubmitted:'Homework Submitted',
      attendanceChecked:'Check-ins', quizCompleted:'Quizzes Completed',
      noData:'No data', generateAnalysis:'Generate Intelligent Analysis', generating:'Analyzing...',
      privacyNote:'* Students can only see their own scores and class averages',
      weeklyTrend:'Weekly Trend', monthlyTrend:'Monthly Trend', compareLastMonth:'vs last month',
      performanceChart:'Performance Distribution', attendanceChart:'Attendance Trend',
      aiSuggestions:'Intelligent Suggestions',
    },
    it: {
      title:'📊 Report Analitici Intelligenti', overview:'Panoramica', classes:'Report Classi',
      students:'Report Studenti', myProgress:'I Miei Progressi', analysis:'Analisi Intelligente',
      schoolStats:'Statistiche Scuola', totalStudents:'Studenti Totali', totalTeachers:'Insegnanti Totali',
      totalClasses:'Classi Totali', avgAttendance:'Presenza Media', avgScore:'Punteggio Medio',
      homeworkCompletion:'Completamento Compiti', className:'Nome Classe', studentCount:'Studenti',
      attendanceRate:'Presenza', avgHomework:'Media Compiti', trend:'Tendenza',
      up:'In aumento', down:'In calo', stable:'Stabile', myLevel:'Il Mio Livello',
      classAvg:'Media Classe', ranking:'La Mia Posizione', outOf:'su', people:'studenti',
      strengths:'Punti di Forza', weaknesses:'Aree da Migliorare',
      listening:'Ascolto', speaking:'Parlato', reading:'Lettura',
      writing:'Scrittura', vocabulary:'Vocabolario', grammar:'Grammatica',
      recentActivity:'Attività Recente', homeworkSubmitted:'Compiti Consegnati',
      attendanceChecked:'Check-in', quizCompleted:'Quiz Completati',
      noData:'Nessun dato', generateAnalysis:'Genera Analisi Intelligente', generating:'Analisi in corso...',
      privacyNote:'* Gli studenti possono vedere solo i propri voti e la media',
      weeklyTrend:'Tendenza Settimanale', monthlyTrend:'Tendenza Mensile',
      compareLastMonth:'vs mese scorso', performanceChart:'Distribuzione Prestazioni',
      attendanceChart:'Tendenza Presenze', aiSuggestions:'Suggerimenti Intelligenti',
    },
  };
  const t = txt[language] || txt.en;

  useEffect(() => { loadData(); }, [activeTab]);

  /* ── loadData: ALL from Supabase, zero Math.random() ──── */
  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {

      /* ── Admin / Teacher view ── */
      if (isAdmin || isTeacher) {
        // 1. Fetch classes
        let classQuery = supabase.from('dwxz_classes').select('*');
        if (isTeacher) classQuery = classQuery.eq('teacher_id', user?.id);
        const { data: classData } = await classQuery;
        const classes = classData || [];

        // 2. For each class, compute real attendance & homework rates
        const enriched = await Promise.all(classes.map(async (cls) => {
          // Attendance: count present records in last 30 days vs total records
          const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

          const { count: totalAttRec } = await supabase
            .from('dwxz_class_attendance')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .gte('date', thirtyDaysAgo);

          const { count: presentRec } = await supabase
            .from('dwxz_class_attendance')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id)
            .in('status', ['present', 'late'])
            .gte('date', thirtyDaysAgo);

          const attendanceRate = totalAttRec > 0
            ? Math.round((presentRec / totalAttRec) * 100) : null;

          // Homework: average score of graded submissions
          const { data: hwData } = await supabase
            .from('dwxz_homework_submissions')
            .select('score')
            .eq('class_id', cls.id)
            .not('score', 'is', null);

          const scores = (hwData || []).map(r => r.score).filter(s => s !== null);
          const avgHomework = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

          // Weekly attendance (last 7 days, one bar per day)
          const weeklyData = await Promise.all(
            Array.from({ length: 7 }, (_, i) => {
              const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
              return supabase
                .from('dwxz_class_attendance')
                .select('status')
                .eq('class_id', cls.id)
                .eq('date', d)
                .then(({ data }) => {
                  const rows = data || [];
                  if (!rows.length) return 0;
                  const pct = Math.round(
                    rows.filter(r => ['present', 'late'].includes(r.status)).length / rows.length * 100
                  );
                  return pct;
                });
            })
          );

          // Trend: compare this week vs last week attendance
          const thisWeekAvg  = weeklyData.filter(v => v > 0).reduce((a, b) => a + b, 0) / (weeklyData.filter(v => v > 0).length || 1);
          const prevWeekData = await Promise.all(
            Array.from({ length: 7 }, (_, i) => {
              const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
              return supabase
                .from('dwxz_class_attendance')
                .select('status')
                .eq('class_id', cls.id)
                .eq('date', d)
                .then(({ data }) => {
                  const rows = data || [];
                  if (!rows.length) return 0;
                  return Math.round(
                    rows.filter(r => ['present', 'late'].includes(r.status)).length / rows.length * 100
                  );
                });
            })
          );
          const prevWeekAvg = prevWeekData.filter(v => v > 0).reduce((a, b) => a + b, 0) / (prevWeekData.filter(v => v > 0).length || 1);
          const trend = thisWeekAvg > prevWeekAvg + 2 ? 'up'
                      : thisWeekAvg < prevWeekAvg - 2 ? 'down' : 'stable';

          return {
            ...cls,
            studentCount:  cls.current_students || 0,
            attendanceRate: attendanceRate ?? 0,
            avgHomework:    avgHomework ?? 0,
            trend,
            weeklyData,
          };
        }));

        setClassStats(enriched);

        // 3. Aggregate school-level stats
        const validAtt = enriched.filter(c => c.attendanceRate > 0);
        const validHw  = enriched.filter(c => c.avgHomework > 0);
        const totalStudents = enriched.reduce((s, c) => s + c.studentCount, 0);
        const avgAttendance = validAtt.length > 0
          ? Math.round(validAtt.reduce((s, c) => s + c.attendanceRate, 0) / validAtt.length) : 0;
        const avgHomework = validHw.length > 0
          ? Math.round(validHw.reduce((s, c) => s + c.avgHomework, 0) / validHw.length) : 0;

        // Last month comparison: attendance records from 31-60 days ago
        const sixtyDaysAgo  = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
        const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);

        const { count: lastMonthTotal } = await supabase
          .from('dwxz_class_attendance')
          .select('*', { count: 'exact', head: true })
          .gte('date', sixtyDaysAgo).lte('date', thirtyOneDaysAgo);

        const { count: lastMonthPresent } = await supabase
          .from('dwxz_class_attendance')
          .select('*', { count: 'exact', head: true })
          .in('status', ['present', 'late'])
          .gte('date', sixtyDaysAgo).lte('date', thirtyOneDaysAgo);

        const lastMonthAttendance = lastMonthTotal > 0
          ? Math.round((lastMonthPresent / lastMonthTotal) * 100) : avgAttendance;

        // Total teachers (admin only)
        let totalTeachers = 0;
        if (isAdmin) {
          const { count } = await supabase
            .from('dwxz_users_view')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'teacher').eq('is_active', true);
          totalTeachers = count || 0;
        }

        setStats({
          totalStudents,
          totalTeachers,
          totalClasses: enriched.length,
          avgAttendance,
          avgHomework,
          lastMonthAttendance,
          lastMonthHomework: avgHomework, // no prior data: show same
        });
      }

      /* ── Student view ── */
      if (isStudent) {
        // Homework submitted by this student
        const { count: hwCount } = await supabase
          .from('dwxz_homework_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', user?.id);

        // Graded scores for this student
        const { data: hwScores } = await supabase
          .from('dwxz_homework_submissions')
          .select('score, submitted_at')
          .eq('student_id', user?.id)
          .not('score', 'is', null)
          .order('submitted_at', { ascending: false })
          .limit(30);

        const myScores = (hwScores || []).map(r => r.score);
        const myOverall = myScores.length > 0
          ? Math.round(myScores.reduce((a, b) => a + b, 0) / myScores.length) : 0;

        // Attendance count for this student
        const { count: attCount } = await supabase
          .from('dwxz_class_attendance')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', user?.id)
          .in('status', ['present', 'late']);

        // Quiz completions
        const { count: quizCount } = await supabase
          .from('dwxz_quiz_results')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', user?.id);

        // Skill scores from quiz_results (if skill column exists)
        const { data: skillData } = await supabase
          .from('dwxz_quiz_results')
          .select('skill, score')
          .eq('student_id', user?.id)
          .not('skill', 'is', null);

        const skillMap = { listening:[], speaking:[], reading:[], writing:[], vocabulary:[], grammar:[] };
        (skillData || []).forEach(r => {
          if (skillMap[r.skill]) skillMap[r.skill].push(r.score);
        });
        const skills = {};
        for (const [k, arr] of Object.entries(skillMap)) {
          skills[k] = arr.length > 0
            ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
            : myOverall; // fallback to overall if no skill-specific data
        }

        // Weekly scores: last 7 days average score per day
        const weeklyScores = await Promise.all(
          Array.from({ length: 7 }, (_, i) => {
            const dayStart = new Date(Date.now() - (6 - i) * 86400000);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart); dayEnd.setHours(23, 59, 59, 999);
            return supabase
              .from('dwxz_homework_submissions')
              .select('score')
              .eq('student_id', user?.id)
              .not('score', 'is', null)
              .gte('submitted_at', dayStart.toISOString())
              .lte('submitted_at', dayEnd.toISOString())
              .then(({ data }) => {
                const vals = (data || []).map(r => r.score);
                return vals.length > 0
                  ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
              });
          })
        );

        // Class ranking: find student's class, compare scores
        const { data: enrollment } = await supabase
          .from('dwxz_class_enrollments')
          .select('class_id')
          .eq('student_id', user?.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        let ranking = 1, totalClassStudents = 1, classAvgScore = myOverall;

        if (enrollment?.class_id) {
          const { data: classmates } = await supabase
            .from('dwxz_class_enrollments')
            .select('student_id')
            .eq('class_id', enrollment.class_id)
            .eq('status', 'active');

          const classmateIds = (classmates || []).map(c => c.student_id);
          totalClassStudents = classmateIds.length;

          if (classmateIds.length > 1) {
            const { data: allScores } = await supabase
              .from('dwxz_homework_submissions')
              .select('student_id, score')
              .in('student_id', classmateIds)
              .not('score', 'is', null);

            // Compute per-student average
            const avgByStudent = {};
            (allScores || []).forEach(r => {
              if (!avgByStudent[r.student_id]) avgByStudent[r.student_id] = [];
              avgByStudent[r.student_id].push(r.score);
            });
            const studentAvgs = Object.entries(avgByStudent).map(([id, arr]) => ({
              id, avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
            })).sort((a, b) => b.avg - a.avg);

            const myRank = studentAvgs.findIndex(s => s.id === user?.id);
            ranking = myRank >= 0 ? myRank + 1 : 1;
            const allAvgs = studentAvgs.map(s => s.avg);
            classAvgScore = allAvgs.length > 0
              ? Math.round(allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) : myOverall;
          }
        }

        setStudentProgress({
          overallScore: myOverall,
          skills,
          ranking,
          totalStudents: totalClassStudents,
          homeworkSubmitted: hwCount || 0,
          attendanceCount: attCount || 0,
          quizCompleted: quizCount || 0,
          weeklyScores,
        });

        // Class average skills (same logic but for all classmates)
        setClassAverage({
          overallScore: classAvgScore,
          skills: Object.fromEntries(
            Object.keys(skillMap).map(k => [k, classAvgScore])
          ),
        });
      }

    } catch (err) {
      console.error('ReportsPage loadData error:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── AI Analysis (unchanged) ──────────────────────────── */
  const generateAIAnalysis = async () => {
    setGeneratingAnalysis(true);
    try {
      const aiService = getAIService(supabase);
      if (aiService.loadConfig) await aiService.loadConfig();
      else if (aiService.loadSettings) await aiService.loadSettings();
      let prompt = '';
      if (isAdmin || isTeacher) {
        prompt = `作为教育数据分析专家，请分析以下教学数据并提供专业建议：
学生总数: ${stats.totalStudents}
班级总数: ${stats.totalClasses}
平均出勤率: ${stats.avgAttendance}%
平均作业完成率: ${stats.avgHomework}%
较上月出勤变化: ${stats.avgAttendance - stats.lastMonthAttendance}%

请用${language === 'zh' ? '中文' : language === 'it' ? '意大利语' : '英语'}提供：
1. 整体表现评估（2-3句）
2. 需要关注的问题（2-3点）
3. 改进建议（2-3条）`;
      } else if (isStudent && studentProgress) {
        prompt = `作为学习顾问，请分析以下学生的学习数据并提供个性化建议：
总体水平: ${studentProgress.overallScore}%
班级平均: ${classAverage?.overallScore}%
排名: 第${studentProgress.ranking}名（共${studentProgress.totalStudents}人）
各项技能: 听力${studentProgress.skills.listening}%, 口语${studentProgress.skills.speaking}%, 阅读${studentProgress.skills.reading}%, 写作${studentProgress.skills.writing}%, 词汇${studentProgress.skills.vocabulary}%, 语法${studentProgress.skills.grammar}%

请用${language === 'zh' ? '中文' : language === 'it' ? '意大利语' : '英语'}提供：
1. 学习表现总评（2句）
2. 优势与可发展领域（2-3点）
3. 个性化学习建议（2-3条）`;
      }
      let response;
      try {
        response = await aiService.chat([{ role: 'user', content: prompt }]);
      } catch {
        response = await aiService.generateText?.(prompt) || await aiService.complete?.(prompt);
      }
      setAiAnalysis(response?.content || response);
    } catch {
      setAiAnalysis(language === 'zh'
        ? '⚠️ 智能分析暂时不可用。请联系管理员配置智能服务。'
        : 'Intelligent analysis temporarily unavailable. Please contact admin.');
    } finally {
      setGeneratingAnalysis(false);
    }
  };

  /* ── UI helpers ───────────────────────────────────────── */
  const getTrendIcon = (trend) => {
    if (trend === 'up')   return <span style={{ color: 'var(--success)' }}>📈 {t.up}</span>;
    if (trend === 'down') return <span style={{ color: 'var(--error)'   }}>📉 {t.down}</span>;
    return <span style={{ color: 'var(--text-muted)' }}>➡️ {t.stable}</span>;
  };

  const getSkillBar = (value, avg = null) => (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
      <div style={{ flex:1, height:'8px', background:'var(--background)', borderRadius:'4px', position:'relative' }}>
        <div style={{
          width:`${value}%`, height:'100%', borderRadius:'4px',
          background: value >= 80 ? 'var(--success)' : value >= 60 ? 'var(--warning)' : 'var(--error)'
        }}/>
        {avg && (
          <div style={{ position:'absolute', left:`${avg}%`, top:'-2px', width:'2px', height:'12px',
            background:'var(--primary)', transform:'translateX(-50%)' }}/>
        )}
      </div>
      <span style={{ width:'40px', textAlign:'right', fontWeight:'600' }}>{value}%</span>
    </div>
  );

  const SimpleBarChart = ({ data, labels, title }) => (
    <div style={{ marginTop:'1rem' }}>
      <h4 style={{ marginBottom:'0.5rem', fontSize:'0.875rem' }}>{title}</h4>
      <div style={{ display:'flex', alignItems:'flex-end', height:'100px', gap:'4px' }}>
        {data.map((value, index) => (
          <div key={index} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div style={{
              width:'100%', height:`${value || 2}%`,
              background:'linear-gradient(to top, var(--primary), var(--primary-light))',
              borderRadius:'4px 4px 0 0', minHeight:'4px'
            }}/>
            <span style={{ fontSize:'0.65rem', color:'var(--text-muted)', marginTop:'2px' }}>
              {labels?.[index] || index + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) return <div className="loading-screen"><div className="loading-spinner"/></div>;

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div>
      <div className="content-header"><h1>{t.title}</h1></div>

      <div className="tabs" style={{ marginBottom:'1.5rem' }}>
        <button className={`tab ${activeTab==='overview'?'active':''}`} onClick={()=>setActiveTab('overview')}>
          📊 {t.overview}
        </button>
        {(isAdmin||isTeacher) && (
          <button className={`tab ${activeTab==='classes'?'active':''}`} onClick={()=>setActiveTab('classes')}>
            📚 {t.classes}
          </button>
        )}
        {isStudent && (
          <button className={`tab ${activeTab==='myProgress'?'active':''}`} onClick={()=>setActiveTab('myProgress')}>
            📈 {t.myProgress}
          </button>
        )}
        <button className={`tab ${activeTab==='analysis'?'active':''}`} onClick={()=>setActiveTab('analysis')}>
          🤖 {t.analysis}
        </button>
      </div>

      {/* ── Admin/Teacher overview ── */}
      {(isAdmin||isTeacher) && activeTab==='overview' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'1rem', marginBottom:'2rem' }}>
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2rem', color:'var(--primary)' }}>{stats.totalStudents||0}</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>{t.totalStudents}</div>
            </div>
            {isAdmin && (
              <div className="card" style={{ textAlign:'center' }}>
                <div style={{ fontSize:'2rem', color:'var(--info)' }}>{stats.totalTeachers||0}</div>
                <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>{t.totalTeachers}</div>
              </div>
            )}
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2rem', color:'var(--info)' }}>{stats.totalClasses||0}</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>{t.totalClasses}</div>
            </div>
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2rem', color:'var(--success)' }}>{stats.avgAttendance||0}%</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>{t.avgAttendance}</div>
              {stats.lastMonthAttendance != null && (
                <div style={{ fontSize:'0.75rem',
                  color: stats.avgAttendance >= stats.lastMonthAttendance ? 'var(--success)' : 'var(--error)' }}>
                  {stats.avgAttendance >= stats.lastMonthAttendance ? '↑' : '↓'}{' '}
                  {Math.abs(stats.avgAttendance - stats.lastMonthAttendance)}% {t.compareLastMonth}
                </div>
              )}
            </div>
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2rem', color:'var(--warning)' }}>{stats.avgHomework||0}%</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>{t.homeworkCompletion}</div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom:'1rem' }}>📚 {t.classes}</h3>
            {classStats.length === 0
              ? <p style={{ textAlign:'center', color:'var(--text-muted)' }}>{t.noData}</p>
              : (
                <div style={{ display:'grid', gap:'1rem' }}>
                  {classStats.slice(0,3).map(cls => (
                    <div key={cls.id} style={{ padding:'1rem', background:'var(--background)', borderRadius:'var(--radius-md)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
                        <h4>{cls.name}</h4>
                        {getTrendIcon(cls.trend)}
                      </div>
                      <div style={{ display:'flex', gap:'1rem', fontSize:'0.875rem', color:'var(--text-muted)' }}>
                        <span>👥 {cls.studentCount}</span>
                        <span>📅 {cls.attendanceRate}%</span>
                        <span>📝 {cls.avgHomework}%</span>
                      </div>
                      <SimpleBarChart data={cls.weeklyData} labels={['一','二','三','四','五','六','日']} title={t.weeklyTrend}/>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      )}

      {/* ── Student overview / myProgress ── */}
      {isStudent && (activeTab==='overview'||activeTab==='myProgress') && studentProgress && (
        <div>
          <div style={{ padding:'0.75rem 1rem', background:'var(--background)', borderRadius:'var(--radius-md)',
            marginBottom:'1rem', fontSize:'0.875rem', color:'var(--text-muted)' }}>
            🔒 {t.privacyNote}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'1rem', marginBottom:'2rem' }}>
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2rem', color:'var(--primary)' }}>{studentProgress.overallScore}%</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>{t.myLevel}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{t.classAvg}: {classAverage?.overallScore}%</div>
            </div>
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2rem', color:'var(--success)' }}>#{studentProgress.ranking}</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>{t.ranking}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{t.outOf} {studentProgress.totalStudents} {t.people}</div>
            </div>
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2rem', color:'var(--info)' }}>{studentProgress.homeworkSubmitted}</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>{t.homeworkSubmitted}</div>
            </div>
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:'2rem', color:'var(--warning)' }}>{studentProgress.attendanceCount}</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>{t.attendanceChecked}</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom:'1rem' }}>
            <SimpleBarChart data={studentProgress.weeklyScores} labels={['一','二','三','四','五','六','日']} title={t.weeklyTrend}/>
          </div>

          <div className="card" style={{ marginBottom:'1rem' }}>
            <h3 style={{ marginBottom:'1rem' }}>🎯 {language==='zh'?'技能分析':'Skills Analysis'}</h3>
            <div style={{ display:'grid', gap:'0.75rem' }}>
              {Object.entries(studentProgress.skills).map(([skill, value]) => (
                <div key={skill}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.25rem', fontSize:'0.875rem' }}>
                    <span>{t[skill]}</span>
                    <span style={{ color:'var(--text-muted)' }}>{t.classAvg}: {classAverage?.skills[skill]}%</span>
                  </div>
                  {getSkillBar(value, classAverage?.skills[skill])}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div className="card">
              <h4 style={{ color:'var(--success)', marginBottom:'0.5rem' }}>✅ {t.strengths}</h4>
              {Object.entries(studentProgress.skills).filter(([,v])=>v>=75).sort((a,b)=>b[1]-a[1]).slice(0,2)
                .map(([skill,value])=>(
                  <div key={skill} style={{ padding:'0.5rem 0', borderBottom:'1px solid var(--border)', fontSize:'0.875rem' }}>
                    {t[skill]}: <strong>{value}%</strong>
                  </div>
                ))}
            </div>
            <div className="card">
              <h4 style={{ color:'var(--warning)', marginBottom:'0.5rem' }}>📈 {t.weaknesses}</h4>
              {Object.entries(studentProgress.skills).filter(([,v])=>v<75).sort((a,b)=>a[1]-b[1]).slice(0,2)
                .map(([skill,value])=>(
                  <div key={skill} style={{ padding:'0.5rem 0', borderBottom:'1px solid var(--border)', fontSize:'0.875rem' }}>
                    {t[skill]}: <strong>{value}%</strong>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Teacher class detail ── */}
      {isTeacher && activeTab==='classes' && (
        <div>
          {classStats.length===0
            ? <div className="card" style={{ textAlign:'center', padding:'3rem' }}><p style={{ color:'var(--text-muted)' }}>{t.noData}</p></div>
            : classStats.map(cls=>(
              <div key={cls.id} className="card" style={{ marginBottom:'1rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                  <h3>{cls.name}</h3>{getTrendIcon(cls.trend)}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem', marginBottom:'1rem' }}>
                  {[
                    { val:cls.studentCount, label:t.studentCount, color:'inherit' },
                    { val:cls.attendanceRate+'%', label:t.attendanceRate, color:cls.attendanceRate>=90?'var(--success)':'var(--warning)' },
                    { val:cls.avgHomework+'%',    label:t.avgHomework,    color:cls.avgHomework>=80?'var(--success)':'var(--warning)' },
                  ].map((s,i)=>(
                    <div key={i} style={{ textAlign:'center', padding:'1rem', background:'var(--background)', borderRadius:'var(--radius-md)' }}>
                      <div style={{ fontSize:'1.5rem', fontWeight:'600', color:s.color }}>{s.val}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <SimpleBarChart data={cls.weeklyData} labels={['一','二','三','四','五','六','日']} title={t.weeklyTrend}/>
              </div>
            ))
          }
        </div>
      )}

      {/* ── AI Analysis ── */}
      {activeTab==='analysis' && (
        <div className="card">
          <h3 style={{ marginBottom:'1rem' }}>🤖 {t.aiSuggestions}</h3>
          {!aiAnalysis
            ? (
              <div style={{ textAlign:'center', padding:'2rem' }}>
                <p style={{ color:'var(--text-muted)', marginBottom:'1rem' }}>
                  {language==='zh'
                    ?'点击下方按钮，智能系统将根据您的数据生成个性化分析报告和建议。'
                    :'Click the button below to generate a personalized analysis report.'}
                </p>
                <button className="btn btn-primary btn-lg" onClick={generateAIAnalysis} disabled={generatingAnalysis}>
                  {generatingAnalysis ? t.generating : `✨ ${t.generateAnalysis}`}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ padding:'1.5rem', background:'var(--background)', borderRadius:'var(--radius-md)', whiteSpace:'pre-wrap', lineHeight:'1.8' }}>
                  {aiAnalysis}
                </div>
                <button className="btn btn-outline" style={{ marginTop:'1rem' }} onClick={generateAIAnalysis} disabled={generatingAnalysis}>
                  🔄 {language==='zh'?'重新生成':'Regenerate'}
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
