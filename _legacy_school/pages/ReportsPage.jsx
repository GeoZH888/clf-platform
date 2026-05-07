import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getAIService } from '../services/aiService';

const ReportsPage = () => {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [classStats, setClassStats] = useState([]);
  const [studentProgress, setStudentProgress] = useState(null);
  const [classAverage, setClassAverage] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [generatingAnalysis, setGeneratingAnalysis] = useState(false);

  const isAdmin = ['super_admin', 'admin'].includes(user?.role);
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';

  const txt = {
    zh: {
      title: '📊 智能统计报告',
      overview: '总览',
      classes: '班级报告',
      students: '学生报告',
      myProgress: '我的进度',
      analysis: '智能分析',
      schoolStats: '学校统计',
      totalStudents: '学生总数',
      totalTeachers: '教师总数',
      totalClasses: '班级总数',
      avgAttendance: '平均出勤率',
      avgScore: '平均分数',
      homeworkCompletion: '作业完成率',
      className: '班级名称',
      studentCount: '学生数',
      attendanceRate: '出勤率',
      avgHomework: '作业均分',
      trend: '趋势',
      up: '上升',
      down: '下降',
      stable: '稳定',
      myLevel: '我的水平',
      classAvg: '班级平均',
      ranking: '我的排名',
      outOf: '共',
      people: '人',
      strengths: '优势领域',
      weaknesses: '待提高领域',
      listening: '听力',
      speaking: '口语',
      reading: '阅读',
      writing: '写作',
      vocabulary: '词汇',
      grammar: '语法',
      recentActivity: '近期活动',
      homeworkSubmitted: '提交作业',
      attendanceChecked: '签到次数',
      quizCompleted: '完成测验',
      noData: '暂无数据',
      generateAnalysis: '生成智能分析',
      generating: '分析中...',
      privacyNote: '* 学生只能看到自己的成绩和班级平均水平',
      weeklyTrend: '本周趋势',
      monthlyTrend: '本月趋势',
      compareLastMonth: '较上月',
      performanceChart: '成绩分布图',
      attendanceChart: '出勤趋势图',
      aiSuggestions: '智能建议'
    },
    en: {
      title: '📊 Smart Analytics Report',
      overview: 'Overview',
      classes: 'Class Reports',
      students: 'Student Reports',
      myProgress: 'My Progress',
      analysis: 'Intelligent Analysis',
      schoolStats: 'School Statistics',
      totalStudents: 'Total Students',
      totalTeachers: 'Total Teachers',
      totalClasses: 'Total Classes',
      avgAttendance: 'Avg Attendance',
      avgScore: 'Avg Score',
      homeworkCompletion: 'Homework Completion',
      className: 'Class Name',
      studentCount: 'Students',
      attendanceRate: 'Attendance',
      avgHomework: 'Avg Homework',
      trend: 'Trend',
      up: 'Up',
      down: 'Down',
      stable: 'Stable',
      myLevel: 'My Level',
      classAvg: 'Class Average',
      ranking: 'My Ranking',
      outOf: 'out of',
      people: 'students',
      strengths: 'Strengths',
      weaknesses: 'Areas to Improve',
      listening: 'Listening',
      speaking: 'Speaking',
      reading: 'Reading',
      writing: 'Writing',
      vocabulary: 'Vocabulary',
      grammar: 'Grammar',
      recentActivity: 'Recent Activity',
      homeworkSubmitted: 'Homework Submitted',
      attendanceChecked: 'Check-ins',
      quizCompleted: 'Quizzes Completed',
      noData: 'No data',
      generateAnalysis: 'Generate Intelligent Analysis',
      generating: 'Analyzing...',
      privacyNote: '* Students can only see their own scores and class averages',
      weeklyTrend: 'Weekly Trend',
      monthlyTrend: 'Monthly Trend',
      compareLastMonth: 'vs last month',
      performanceChart: 'Performance Distribution',
      attendanceChart: 'Attendance Trend',
      aiSuggestions: 'Intelligent Suggestions'
    },
    it: {
      title: '📊 Report Analitici Intelligenti',
      overview: 'Panoramica',
      classes: 'Report Classi',
      students: 'Report Studenti',
      myProgress: 'I Miei Progressi',
      analysis: 'Analisi Intelligente',
      schoolStats: 'Statistiche Scuola',
      totalStudents: 'Studenti Totali',
      totalTeachers: 'Insegnanti Totali',
      totalClasses: 'Classi Totali',
      avgAttendance: 'Presenza Media',
      avgScore: 'Punteggio Medio',
      homeworkCompletion: 'Completamento Compiti',
      className: 'Nome Classe',
      studentCount: 'Studenti',
      attendanceRate: 'Presenza',
      avgHomework: 'Media Compiti',
      trend: 'Tendenza',
      up: 'In aumento',
      down: 'In calo',
      stable: 'Stabile',
      myLevel: 'Il Mio Livello',
      classAvg: 'Media Classe',
      ranking: 'La Mia Posizione',
      outOf: 'su',
      people: 'studenti',
      strengths: 'Punti di Forza',
      weaknesses: 'Aree da Migliorare',
      listening: 'Ascolto',
      speaking: 'Parlato',
      reading: 'Lettura',
      writing: 'Scrittura',
      vocabulary: 'Vocabolario',
      grammar: 'Grammatica',
      recentActivity: 'Attività Recente',
      homeworkSubmitted: 'Compiti Consegnati',
      attendanceChecked: 'Check-in',
      quizCompleted: 'Quiz Completati',
      noData: 'Nessun dato',
      generateAnalysis: 'Genera Analisi Intelligente',
      generating: 'Analisi in corso...',
      privacyNote: '* Gli studenti possono vedere solo i propri voti e la media',
      weeklyTrend: 'Tendenza Settimanale',
      monthlyTrend: 'Tendenza Mensile',
      compareLastMonth: 'vs mese scorso',
      performanceChart: 'Distribuzione Prestazioni',
      attendanceChart: 'Tendenza Presenze',
      aiSuggestions: 'Suggerimenti Intelligenti'
    }
  };
  const t = txt[language] || txt.en;

  useEffect(() => { loadData(); }, [activeTab]);

  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    
    try {
      if (isAdmin || isTeacher) {
        let query = supabase.from('classes').select('*');
        if (isTeacher) query = query.eq('teacher_id', user?.id);
        const { data: classData } = await query;
        
        const classStatsData = (classData || []).map(cls => ({
          ...cls,
          studentCount: cls.current_students || Math.floor(Math.random() * 20) + 5,
          attendanceRate: Math.floor(Math.random() * 20) + 80,
          avgHomework: Math.floor(Math.random() * 30) + 70,
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)],
          weeklyData: Array.from({length: 7}, () => Math.floor(Math.random() * 30) + 70)
        }));
        setClassStats(classStatsData);

        const totalStudents = classStatsData.reduce((sum, c) => sum + c.studentCount, 0);
        const avgAttendance = classStatsData.length > 0 
          ? Math.round(classStatsData.reduce((sum, c) => sum + c.attendanceRate, 0) / classStatsData.length)
          : 0;
        const avgHomework = classStatsData.length > 0
          ? Math.round(classStatsData.reduce((sum, c) => sum + c.avgHomework, 0) / classStatsData.length)
          : 0;

        setStats({
          totalStudents,
          totalClasses: classStatsData.length,
          avgAttendance,
          avgHomework,
          lastMonthAttendance: avgAttendance - Math.floor(Math.random() * 10) + 5,
          lastMonthHomework: avgHomework - Math.floor(Math.random() * 10) + 5
        });
      }

      if (isStudent) {
        setStudentProgress({
          overallScore: Math.floor(Math.random() * 30) + 70,
          skills: {
            listening: Math.floor(Math.random() * 30) + 70,
            speaking: Math.floor(Math.random() * 30) + 65,
            reading: Math.floor(Math.random() * 30) + 75,
            writing: Math.floor(Math.random() * 30) + 60,
            vocabulary: Math.floor(Math.random() * 30) + 70,
            grammar: Math.floor(Math.random() * 30) + 65
          },
          ranking: Math.floor(Math.random() * 10) + 1,
          totalStudents: Math.floor(Math.random() * 15) + 15,
          homeworkSubmitted: Math.floor(Math.random() * 10) + 5,
          attendanceCount: Math.floor(Math.random() * 20) + 10,
          quizCompleted: Math.floor(Math.random() * 5) + 2,
          weeklyScores: Array.from({length: 7}, () => Math.floor(Math.random() * 30) + 70)
        });

        setClassAverage({
          overallScore: Math.floor(Math.random() * 20) + 65,
          skills: {
            listening: Math.floor(Math.random() * 20) + 65,
            speaking: Math.floor(Math.random() * 20) + 60,
            reading: Math.floor(Math.random() * 20) + 70,
            writing: Math.floor(Math.random() * 20) + 55,
            vocabulary: Math.floor(Math.random() * 20) + 65,
            grammar: Math.floor(Math.random() * 20) + 60
          }
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 生成智能分析
  const generateAIAnalysis = async () => {
    setGeneratingAnalysis(true);
    try {
      const aiService = getAIService();
      await aiService.loadSettings();
      
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

      const response = await aiService.chat([{ role: 'user', content: prompt }]);
      setAiAnalysis(response?.content || response);
    } catch (err) {
      setAiAnalysis(language === 'zh' 
        ? '⚠️ 智能分析暂时不可用。请联系管理员配置智能服务。' 
        : 'Intelligent analysis temporarily unavailable. Please contact admin.');
    } finally {
      setGeneratingAnalysis(false);
    }
  };

  const getTrendIcon = (trend) => {
    if (trend === 'up') return <span style={{ color: 'var(--success)' }}>📈 {t.up}</span>;
    if (trend === 'down') return <span style={{ color: 'var(--error)' }}>📉 {t.down}</span>;
    return <span style={{ color: 'var(--text-muted)' }}>➡️ {t.stable}</span>;
  };

  const getSkillBar = (value, avg = null) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: '8px', background: 'var(--background)', borderRadius: '4px', position: 'relative' }}>
        <div style={{ 
          width: `${value}%`, 
          height: '100%', 
          background: value >= 80 ? 'var(--success)' : value >= 60 ? 'var(--warning)' : 'var(--error)',
          borderRadius: '4px'
        }} />
        {avg && (
          <div style={{
            position: 'absolute',
            left: `${avg}%`,
            top: '-2px',
            width: '2px',
            height: '12px',
            background: 'var(--primary)',
            transform: 'translateX(-50%)'
          }} />
        )}
      </div>
      <span style={{ width: '40px', textAlign: 'right', fontWeight: '600' }}>{value}%</span>
    </div>
  );

  // 简单柱状图组件
  const SimpleBarChart = ({ data, labels, title }) => (
    <div style={{ marginTop: '1rem' }}>
      <h4 style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>{title}</h4>
      <div style={{ display: 'flex', alignItems: 'flex-end', height: '100px', gap: '4px' }}>
        {data.map((value, index) => (
          <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div 
              style={{ 
                width: '100%', 
                height: `${value}%`, 
                background: `linear-gradient(to top, var(--primary), var(--primary-light))`,
                borderRadius: '4px 4px 0 0',
                minHeight: '4px'
              }} 
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {labels?.[index] || index + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return <div className="loading-screen"><div className="loading-spinner"></div></div>;
  }

  return (
    <div>
      <div className="content-header">
        <h1>{t.title}</h1>
      </div>

      {/* 标签页 */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📊 {t.overview}
        </button>
        {(isAdmin || isTeacher) && (
          <button className={`tab ${activeTab === 'classes' ? 'active' : ''}`} onClick={() => setActiveTab('classes')}>
            📚 {t.classes}
          </button>
        )}
        {isStudent && (
          <button className={`tab ${activeTab === 'myProgress' ? 'active' : ''}`} onClick={() => setActiveTab('myProgress')}>
            📈 {t.myProgress}
          </button>
        )}
        <button className={`tab ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
          🤖 {t.analysis}
        </button>
      </div>

      {/* 管理员/教师概览 */}
      {(isAdmin || isTeacher) && activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--primary)' }}>{stats.totalStudents || 0}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.totalStudents}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--info)' }}>{stats.totalClasses || 0}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.totalClasses}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--success)' }}>{stats.avgAttendance || 0}%</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.avgAttendance}</div>
              <div style={{ fontSize: '0.75rem', color: stats.avgAttendance > stats.lastMonthAttendance ? 'var(--success)' : 'var(--error)' }}>
                {stats.avgAttendance > stats.lastMonthAttendance ? '↑' : '↓'} {Math.abs(stats.avgAttendance - (stats.lastMonthAttendance || 0))}% {t.compareLastMonth}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--warning)' }}>{stats.avgHomework || 0}%</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.homeworkCompletion}</div>
              <div style={{ fontSize: '0.75rem', color: stats.avgHomework > stats.lastMonthHomework ? 'var(--success)' : 'var(--error)' }}>
                {stats.avgHomework > stats.lastMonthHomework ? '↑' : '↓'} {Math.abs(stats.avgHomework - (stats.lastMonthHomework || 0))}% {t.compareLastMonth}
              </div>
            </div>
          </div>

          {/* 班级列表带图表 */}
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>📚 {t.classes}</h3>
            {classStats.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t.noData}</p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {classStats.slice(0, 3).map(cls => (
                  <div key={cls.id} style={{ padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h4>{cls.name}</h4>
                      {getTrendIcon(cls.trend)}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      <span>👥 {cls.studentCount}</span>
                      <span>📅 {cls.attendanceRate}%</span>
                      <span>📝 {cls.avgHomework}%</span>
                    </div>
                    <SimpleBarChart 
                      data={cls.weeklyData} 
                      labels={['一','二','三','四','五','六','日']}
                      title={t.weeklyTrend}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 学生概览 */}
      {isStudent && (activeTab === 'overview' || activeTab === 'myProgress') && studentProgress && (
        <div>
          <div style={{ padding: '0.75rem 1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            🔒 {t.privacyNote}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--primary)' }}>{studentProgress.overallScore}%</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.myLevel}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.classAvg}: {classAverage?.overallScore}%</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--success)' }}>#{studentProgress.ranking}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.ranking}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.outOf} {studentProgress.totalStudents} {t.people}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--info)' }}>{studentProgress.homeworkSubmitted}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.homeworkSubmitted}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', color: 'var(--warning)' }}>{studentProgress.attendanceCount}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.attendanceChecked}</div>
            </div>
          </div>

          {/* 本周成绩趋势 */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <SimpleBarChart 
              data={studentProgress.weeklyScores} 
              labels={['一','二','三','四','五','六','日']}
              title={t.weeklyTrend}
            />
          </div>

          {/* 技能分析 */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>🎯 {language === 'zh' ? '技能分析' : 'Skills Analysis'}</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {Object.entries(studentProgress.skills).map(([skill, value]) => (
                <div key={skill}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                    <span>{t[skill]}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{t.classAvg}: {classAverage?.skills[skill]}%</span>
                  </div>
                  {getSkillBar(value, classAverage?.skills[skill])}
                </div>
              ))}
            </div>
          </div>

          {/* 优势与待提高 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card">
              <h4 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>✅ {t.strengths}</h4>
              {Object.entries(studentProgress.skills)
                .filter(([_, v]) => v >= 75)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([skill, value]) => (
                  <div key={skill} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                    {t[skill]}: <strong>{value}%</strong>
                  </div>
                ))}
            </div>
            <div className="card">
              <h4 style={{ color: 'var(--warning)', marginBottom: '0.5rem' }}>📈 {t.weaknesses}</h4>
              {Object.entries(studentProgress.skills)
                .filter(([_, v]) => v < 75)
                .sort((a, b) => a[1] - b[1])
                .slice(0, 2)
                .map(([skill, value]) => (
                  <div key={skill} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                    {t[skill]}: <strong>{value}%</strong>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 班级详情 (教师) */}
      {isTeacher && activeTab === 'classes' && (
        <div>
          {classStats.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>{t.noData}</p>
            </div>
          ) : (
            classStats.map(cls => (
              <div key={cls.id} className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3>{cls.name}</h3>
                  {getTrendIcon(cls.trend)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{cls.studentCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.studentCount}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: cls.attendanceRate >= 90 ? 'var(--success)' : 'var(--warning)' }}>
                      {cls.attendanceRate}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.attendanceRate}</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600', color: cls.avgHomework >= 80 ? 'var(--success)' : 'var(--warning)' }}>
                      {cls.avgHomework}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.avgHomework}</div>
                  </div>
                </div>
                <SimpleBarChart 
                  data={cls.weeklyData} 
                  labels={['一','二','三','四','五','六','日']}
                  title={t.weeklyTrend}
                />
              </div>
            ))
          )}
        </div>
      )}

      {/* 智能分析 */}
      {activeTab === 'analysis' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>🤖 {t.aiSuggestions}</h3>
          
          {!aiAnalysis ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {language === 'zh' 
                  ? '点击下方按钮，智能系统将根据您的数据生成个性化分析报告和建议。' 
                  : 'Click the button below to generate a personalized analysis report.'}
              </p>
              <button 
                className="btn btn-primary btn-lg"
                onClick={generateAIAnalysis}
                disabled={generatingAnalysis}
              >
                {generatingAnalysis ? t.generating : `✨ ${t.generateAnalysis}`}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ 
                padding: '1.5rem', 
                background: 'var(--background)', 
                borderRadius: 'var(--radius-md)',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.8'
              }}>
                {aiAnalysis}
              </div>
              <button 
                className="btn btn-outline" 
                style={{ marginTop: '1rem' }}
                onClick={generateAIAnalysis}
                disabled={generatingAnalysis}
              >
                🔄 {language === 'zh' ? '重新生成' : 'Regenerate'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
