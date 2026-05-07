// src/pages/SchoolMasterPage.jsx
// 校长中心 — 全校数据一览 + AI智能分析 + 多渠道通知
// Tabs: 学校总览 | 出勤 | 作业 | 教学 | 活动 | 通知发送

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

const C = {
  primary:'#c41e3a', success:'#16a34a', warning:'#d97706',
  error:'#dc2626', info:'#2563eb', purple:'#7c3aed',
};

export default function SchoolMasterPage() {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const lbl = (zh, en) => language === 'zh' ? zh : en;

  const [tab, setTab] = useState(()=>new URLSearchParams(window.location.search).get('tab')||'overview');
  const [stats,      setStats]      = useState({});
  const [classes,    setClasses]    = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [homework,   setHomework]   = useState([]);
  const [aiInsight,  setAiInsight]  = useState('');
  const [genInsight, setGenInsight] = useState(false);
  const [loading,    setLoading]    = useState(true);

  // Notification state
  const [notif, setNotif] = useState({
    title: '', content: '', audience: 'all',
    channels: { inApp: true, email: false, sms: false },
    scheduleType: 'now', scheduleDate: '', scheduleTime: '',
  });
  const [sending,   setSending]   = useState(false);
  const [notifSent, setNotifSent] = useState('');
  const [notifLog,  setNotifLog]  = useState([]);

  useEffect(() => { if (supabase) loadAll(); }, [supabase]);
  useEffect(() => { const t=new URLSearchParams(location.search).get('tab'); if(t) setTab(t); }, [location.search]);

  async function loadAll() {
    setLoading(true);
    try {
      const [usersR, classR, hwR, attR, notifR] = await Promise.all([
        supabase.from('dwxz_users_view').select('id,role,name,is_active,created_at'),
        supabase.from('dwxz_classes').select('id,name,name_zh,hsk_level,is_active,created_at'),
        supabase.from('dwxz_homework').select('id,title,due_date,class_id,is_active,created_at').eq('is_active',true).limit(100),
        supabase.from('dwxz_class_attendance').select('date,status,class_id').order('date',{ascending:false}).limit(200),
        supabase.from('dwxz_notifications').select('*').order('created_at',{ascending:false}).limit(20),
      ]);

      const users = usersR.data || [];
      setStats({
        total:    users.length,
        teachers: users.filter(u=>u.role==='teacher').length,
        students: users.filter(u=>u.role==='student').length,
        parents:  users.filter(u=>u.role==='parent').length,
        classes:  (classR.data||[]).filter(c=>c.is_active).length,
        homework: (hwR.data||[]).length,
      });
      setClasses(classR.data||[]);
      setTeachers(users.filter(u=>u.role==='teacher'));
      setHomework(hwR.data||[]);
      setAttendance(attR.data||[]);
      setNotifLog(notifR.data||[]);
    } catch(e) { console.warn(e); }
    setLoading(false);
  }

  // Attendance analysis
  const todayDate = new Date().toISOString().slice(0,10);
  const todayAtt  = attendance.filter(a => a.date === todayDate);
  const weekAtt   = attendance.filter(a => {
    const d = new Date(a.date);
    const now = new Date();
    return (now - d) < 7*24*60*60*1000;
  });
  const weekRate = weekAtt.length
    ? Math.round(weekAtt.filter(a=>a.status==='present').length/weekAtt.length*100) : null;

  // Homework analysis
  const pendingHW = homework.filter(h => new Date(h.due_date) > new Date());
  const overdueHW = homework.filter(h => new Date(h.due_date) < new Date());

  async function generateInsight() {
    setGenInsight(true); setAiInsight('');
    try {
      const res = await fetch('/.netlify/functions/teacher-ai', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'qa',
          question:`你是学校教育顾问，请根据以下学校数据生成一份管理建议报告：

学校数据：
- 教师数：${stats.teachers}，学生数：${stats.students}，家长数：${stats.parents}
- 班级数：${stats.classes}，本周作业数：${homework.length}
- 本周出勤率：${weekRate!=null?weekRate+'%':'暂无数据'}
- 今日出勤记录数：${todayAtt.length}
- 待截止作业：${pendingHW.length}，已逾期：${overdueHW.length}

请生成：
## 📊 本周学校运营状态
（2-3句总体评估）

## ✅ 运营亮点
（2-3个正面指标）

## ⚠️ 需要关注的问题
（2-3个需要校长注意的事项，附建议）

## 🎯 本周建议行动
（3-4条具体可操作的管理建议）

## 📢 建议发送的通知
（1-2条建议向家长或学生发送的通知内容）

用简洁专业的语言，适合校长阅读。`,
          language,
        }),
      });
      const d = await res.json();
      setAiInsight(d.answer||'');
    } catch(e) { setAiInsight('生成失败: '+e.message); }
    setGenInsight(false);
  }

  async function sendNotification() {
    if (!notif.title || !notif.content) return;
    setSending(true); setNotifSent('');
    const results = [];

    try {
      // 1. In-app notification (always works via Supabase)
      if (notif.channels.inApp) {
        const { error } = await supabase.from('dwxz_notifications').insert([{
          title:     notif.title,
          content:   notif.content,
          audience:  notif.audience,
          channels:  JSON.stringify(notif.channels),
          sender_id: user?.id,
          sender_name: user?.name || user?.username,
          is_read:   false,
          created_at: new Date().toISOString(),
          scheduled_at: notif.scheduleType==='schedule'
            ? `${notif.scheduleDate}T${notif.scheduleTime}:00`
            : new Date().toISOString(),
        }]);
        results.push(error ? `❌ 系统通知: ${error.message}` : '✅ 系统通知已发送');
      }

      // 2. Email via Netlify function
      if (notif.channels.email) {
        try {
          const emailRes = await fetch('/.netlify/functions/send-notification', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              channel: 'email',
              title:   notif.title,
              content: notif.content,
              audience: notif.audience,
            }),
          });
          const emailData = await emailRes.json();
          results.push(emailData.success
            ? `✅ 邮件: 已发送至 ${emailData.count||0} 人`
            : `⚠️ 邮件: ${emailData.message||'服务未配置'}`);
        } catch { results.push('⚠️ 邮件服务暂未配置'); }
      }

      // 3. SMS via Netlify function
      if (notif.channels.sms) {
        try {
          const smsRes = await fetch('/.netlify/functions/send-notification', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              channel: 'sms',
              title:   notif.title,
              content: notif.content,
              audience: notif.audience,
            }),
          });
          const smsData = await smsRes.json();
          results.push(smsData.success
            ? `✅ 短信: 已发送至 ${smsData.count||0} 人`
            : `⚠️ 短信: ${smsData.message||'服务未配置（需配置 Twilio/Aliyun SMS）'}`);
        } catch { results.push('⚠️ 短信服务暂未配置'); }
      }

      setNotifSent(results.join('\n'));
      setNotif(n=>({...n, title:'', content:''}));
      loadAll(); // refresh log
    } catch(e) { setNotifSent('❌ 发送失败: '+e.message); }
    setSending(false);
  }

  const S = {
    card:   { background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem', marginBottom:'1rem' },
    tabBtn: (a) => ({ padding:'9px 18px', border:'none', background:'none', cursor:'pointer',
      fontSize:13, fontWeight:600, whiteSpace:'nowrap',
      borderBottom:a?`2px solid ${C.primary}`:'none', color:a?C.primary:'var(--text-muted)' }),
    inp:    { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)',
      fontSize:13, background:'var(--background)', boxSizing:'border-box', marginTop:4 },
    lbl:    { fontSize:12, color:'var(--text-muted)', display:'block', marginTop:10, marginBottom:2 },
    check:  { display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 },
  };

  const TABS = [
    { id:'overview',    icon:'📊', label:lbl('学校总览','Overview')   },
    { id:'attendance',  icon:'✅', label:lbl('出勤管理','Attendance') },
    { id:'homework',    icon:'📝', label:lbl('作业管理','Homework')   },
    { id:'teaching',    icon:'📈', label:lbl('教学情况','Teaching')   },
    { id:'ai',          icon:'🧠', label:lbl('AI分析','AI Insights')  },
    { id:'notify',      icon:'📢', label:lbl('发送通知','Notify')     },
  ];

  if (loading) return <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-muted)' }}>⏳ {lbl('加载中...','Loading...')}</div>;

  return (
    <div>
      <div className="content-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h1>🎓 {lbl('校长中心','Principal Dashboard')}</h1>
          <p style={{ color:'var(--text-muted)', fontSize:13, margin:'4px 0 0' }}>
            {lbl('全校数据一览 · AI智能分析 · 多渠道通知','School overview · AI insights · Multi-channel notifications')}
          </p>
        </div>
        <button onClick={()=>setTab('notify')}
          style={{ padding:'8px 18px', borderRadius:10, border:'none', cursor:'pointer',
            background:C.primary, color:'#fff', fontWeight:700, fontSize:13 }}>
          📢 {lbl('发送通知','Send Notice')}
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:'0.75rem', marginBottom:'1.25rem' }}>
        {[
          { icon:'👨‍🏫', val:stats.teachers, label:lbl('教师','Teachers'),  color:C.info    },
          { icon:'🎓',  val:stats.students, label:lbl('学生','Students'),  color:C.success },
          { icon:'👪',  val:stats.parents,  label:lbl('家长','Parents'),   color:C.purple  },
          { icon:'🏫',  val:stats.classes,  label:lbl('班级','Classes'),   color:C.warning },
          { icon:'📝',  val:stats.homework, label:lbl('进行中作业','Active HW'), color:C.primary },
          { icon:'✅',  val:weekRate!=null?weekRate+'%':'—', label:lbl('本周出勤率','Week Att.'), color:weekRate>=90?C.success:weekRate>=70?C.warning:C.error },
        ].map((s,i)=>(
          <div key={i} style={{ ...S.card, textAlign:'center', padding:'0.75rem', marginBottom:0 }}>
            <div style={{ fontSize:20 }}>{s.icon}</div>
            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.val??'—'}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:'1.25rem', overflowX:'auto', gap:2 }}>
        {TABS.map(t=><button key={t.id} style={S.tabBtn(tab===t.id)} onClick={()=>setTab(t.id)}>{t.icon} {t.label}</button>)}
      </div>

      {/* ══ OVERVIEW ══ */}
      {tab==='overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>

          {/* Class overview */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>🏫 {lbl('班级一览','Classes')}</h3>
            {classes.filter(c=>c.is_active).map(cls=>(
              <div key={cls.id} style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:13 }}>{cls.name_zh||cls.name}</span>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10,
                  background:'rgba(196,30,58,0.1)', color:C.primary, fontWeight:600 }}>
                  {cls.hsk_level?`等级${cls.hsk_level}`:lbl('自定义','Custom')}
                </span>
              </div>
            ))}
          </div>

          {/* Teacher overview */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>👨‍🏫 {lbl('教师状态','Teachers')}</h3>
            {teachers.slice(0,8).map(t=>(
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8,
                padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:`${C.info}20`,
                  color:C.info, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight:700, flexShrink:0 }}>
                  {(t.name||'?')[0]}
                </div>
                <span style={{ fontSize:13 }}>{t.name||t.username}</span>
                <span style={{ marginLeft:'auto', fontSize:10, padding:'1px 6px', borderRadius:8,
                  background:t.is_active!==false?'#d1fae5':'#f3f4f6',
                  color:t.is_active!==false?'#065f46':'#6b7280' }}>
                  {t.is_active!==false?lbl('活跃','Active'):lbl('停用','Inactive')}
                </span>
              </div>
            ))}
          </div>

          {/* Recent homework */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>📝 {lbl('近期作业','Recent Homework')}</h3>
            {homework.slice(0,6).map((h,i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.title}</span>
                <span style={{ flexShrink:0, marginLeft:8, color:new Date(h.due_date)<new Date()?C.error:C.muted }}>
                  {h.due_date?.slice(0,10)}
                </span>
              </div>
            ))}
          </div>

          {/* Attendance today */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>✅ {lbl('今日出勤','Today\'s Attendance')}</h3>
            {todayAtt.length===0 ? (
              <p style={{ color:'var(--text-muted)', fontSize:13 }}>{lbl('暂无今日出勤记录','No records for today yet')}</p>
            ) : (
              <div style={{ display:'flex', gap:12 }}>
                {[
                  { label:lbl('出勤','Present'), count:todayAtt.filter(a=>a.status==='present').length, color:C.success, bg:'#d1fae5' },
                  { label:lbl('缺勤','Absent'),  count:todayAtt.filter(a=>a.status==='absent').length,  color:C.error,   bg:'#fee2e2' },
                  { label:lbl('迟到','Late'),     count:todayAtt.filter(a=>a.status==='late').length,    color:C.warning, bg:'#fef3c7' },
                ].map((s,i)=>(
                  <div key={i} style={{ flex:1, textAlign:'center', padding:10, borderRadius:10, background:s.bg }}>
                    <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.count}</div>
                    <div style={{ fontSize:11, color:s.color }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ ATTENDANCE ══ */}
      {tab==='attendance' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem', marginBottom:'1rem' }}>
            {[
              { label:lbl('本周出勤率','Week Rate'),  val:weekRate!=null?weekRate+'%':'—', color:weekRate>=90?C.success:weekRate>=70?C.warning:C.error },
              { label:lbl('本周出勤','Present'),      val:weekAtt.filter(a=>a.status==='present').length, color:C.success },
              { label:lbl('本周缺勤','Absent'),       val:weekAtt.filter(a=>a.status==='absent').length,  color:C.error   },
            ].map((s,i)=>(
              <div key={i} style={{ ...S.card, textAlign:'center', padding:'1rem', marginBottom:0 }}>
                <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Per-class attendance summary */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>🏫 {lbl('各班出勤率（本周）','Attendance by Class (This Week)')}</h3>
            {classes.filter(c=>c.is_active).map(cls=>{
              const clsAtt = weekAtt.filter(a=>a.class_id===cls.id);
              const rate = clsAtt.length
                ? Math.round(clsAtt.filter(a=>a.status==='present').length/clsAtt.length*100)
                : null;
              return (
                <div key={cls.id} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3 }}>
                    <span>{cls.name_zh||cls.name}</span>
                    <span style={{ fontWeight:700, color:rate==null?'var(--text-muted)':rate>=90?C.success:rate>=70?C.warning:C.error }}>
                      {rate!=null?rate+'%':lbl('暂无记录','No data')}
                    </span>
                  </div>
                  <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${rate||0}%`,
                      background:rate==null?'#e5e7eb':rate>=90?C.success:rate>=70?C.warning:C.error,
                      borderRadius:3 }}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent attendance records */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>📅 {lbl('最近记录','Recent Records')}</h3>
            {attendance.slice(0,20).map((a,i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between',
                padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                <span>{a.date}</span>
                <span style={{ fontWeight:600,
                  color:a.status==='present'?C.success:a.status==='absent'?C.error:C.warning }}>
                  {a.status==='present'?'✅':a.status==='absent'?'❌':'⚠️'} {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ HOMEWORK ══ */}
      {tab==='homework' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem', marginBottom:'1rem' }}>
            {[
              { label:lbl('进行中','Active'),   val:pendingHW.length,  color:C.info    },
              { label:lbl('已逾期','Overdue'),  val:overdueHW.length,  color:C.error   },
              { label:lbl('本月总数','Total'),  val:homework.length,   color:C.primary },
            ].map((s,i)=>(
              <div key={i} style={{ ...S.card, textAlign:'center', padding:'1rem', marginBottom:0 }}>
                <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>📝 {lbl('作业列表','Homework List')}</h3>
            {homework.map((h,i)=>{
              const overdue = new Date(h.due_date) < new Date();
              const cls = classes.find(c=>c.id===h.class_id);
              return (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'9px 12px', borderRadius:8, marginBottom:6,
                  border:'1px solid var(--border)',
                  borderLeft:`4px solid ${overdue?C.error:C.success}` }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{h.title}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {cls?.name_zh||cls?.name||lbl('未知班级','Unknown class')} · {lbl('截止','Due')}: {h.due_date?.slice(0,10)}
                    </div>
                  </div>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600,
                    background:overdue?'#fee2e2':'#d1fae5', color:overdue?C.error:C.success }}>
                    {overdue?lbl('已逾期','Overdue'):lbl('进行中','Active')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ TEACHING ══ */}
      {tab==='teaching' && (
        <div>
          <div style={S.card}>
            <h3 style={{ margin:'0 0 1rem', fontSize:14 }}>📈 {lbl('教学活动概览','Teaching Activity')}</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
              {teachers.map(t=>(
                <div key={t.id} style={{ padding:'12px 14px', borderRadius:10,
                  background:'var(--background)', border:'1px solid var(--border)' }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{t.name||t.username}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
                    {lbl('教授班级','Teaching')}: {classes.filter(c=>c.created_by===t.id).length} {lbl('个','classes')}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                    {lbl('布置作业','HW assigned')}: {homework.filter(h=>h.created_by===t.id).length}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ AI INSIGHTS ══ */}
      {tab==='ai' && (
        <div>
          <div style={{ ...S.card, background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1px solid #bfdbfe' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <div>
                <h3 style={{ margin:0, color:C.info }}>🧠 {lbl('AI学校运营分析','AI School Insights')}</h3>
                <p style={{ margin:'4px 0 0', fontSize:13, color:'#4b5563' }}>
                  {lbl('基于出勤、作业、教学数据的智能分析报告','Smart analysis based on attendance, homework and teaching data')}
                </p>
              </div>
              <button onClick={generateInsight} disabled={genInsight}
                style={{ padding:'8px 18px', borderRadius:10, border:'none', cursor:'pointer',
                  background:C.info, color:'#fff', fontWeight:700, fontSize:13,
                  opacity:genInsight?0.6:1 }}>
                {genInsight?lbl('分析中...','Analysing...'):`✨ ${lbl('生成分析','Generate')}`}
              </button>
            </div>

            {/* Data snapshot */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8, marginBottom:'1rem' }}>
              {[
                { label:lbl('本周出勤率','Week Attendance'), val:weekRate!=null?weekRate+'%':'—', color:weekRate>=90?C.success:C.warning },
                { label:lbl('进行中作业','Active HW'),       val:pendingHW.length,                 color:C.info    },
                { label:lbl('逾期作业','Overdue HW'),        val:overdueHW.length,                 color:overdueHW.length>0?C.error:C.success },
                { label:lbl('活跃教师','Active Teachers'),   val:teachers.filter(t=>t.is_active!==false).length, color:C.info },
              ].map((s,i)=>(
                <div key={i} style={{ background:'#fff', borderRadius:10, padding:'10px', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {genInsight && (
              <div style={{ textAlign:'center', padding:'2rem', color:'#4b5563' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>🧠</div>
                {lbl('正在分析学校数据...','Analysing school data...')}
              </div>
            )}
            {aiInsight && (
              <div style={{ background:'#fff', borderRadius:12, padding:'1.25rem',
                fontSize:14, lineHeight:1.9, whiteSpace:'pre-wrap', color:'#1f2937',
                borderLeft:`4px solid ${C.info}` }}>
                {aiInsight}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ NOTIFICATIONS ══ */}
      {tab==='notify' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', alignItems:'start' }}>
          {/* Compose */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 1rem', fontSize:14 }}>📢 {lbl('发送通知','Send Notification')}</h3>

            {notifSent && (
              <div style={{ padding:'10px 12px', borderRadius:8, marginBottom:'0.75rem',
                background:'#f0fdf4', border:'1px solid #a7f3d0',
                fontSize:13, color:'#065f46', whiteSpace:'pre-line' }}>
                {notifSent}
              </div>
            )}

            <label style={S.lbl}>{lbl('通知标题 *','Title *')}</label>
            <input style={S.inp} value={notif.title}
              onChange={e=>setNotif(n=>({...n,title:e.target.value}))}
              placeholder={lbl('如：本周学习提醒、活动通知...','e.g. Weekly reminder, Event notice...')}/>

            <label style={S.lbl}>{lbl('通知内容 *','Content *')}</label>
            <textarea style={{ ...S.inp, height:100, resize:'vertical' }}
              value={notif.content}
              onChange={e=>setNotif(n=>({...n,content:e.target.value}))}
              placeholder={lbl('通知正文...','Notification body...')}/>

            <label style={S.lbl}>{lbl('发送对象','Audience')}</label>
            <select style={S.inp} value={notif.audience}
              onChange={e=>setNotif(n=>({...n,audience:e.target.value}))}>
              <option value="all">{lbl('全部用户','All Users')}</option>
              <option value="parents">{lbl('全部家长','All Parents')}</option>
              <option value="students">{lbl('全部学生','All Students')}</option>
              <option value="teachers">{lbl('全部教师','All Teachers')}</option>
            </select>

            {/* Channels */}
            <label style={S.lbl}>{lbl('发送渠道','Channels')}</label>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:6 }}>
              {[
                { key:'inApp', icon:'🔔', label:lbl('站内通知（始终可用）','In-App (always available)'), always:true },
                { key:'email', icon:'📧', label:lbl('电子邮件（需配置邮件服务）','Email (requires mail service)') },
                { key:'sms',   icon:'📱', label:lbl('短信（需配置 Twilio/阿里云）','SMS (requires Twilio/Aliyun)') },
              ].map(ch=>(
                <label key={ch.key} style={S.check}>
                  <input type="checkbox" checked={notif.channels[ch.key]}
                    disabled={ch.always}
                    onChange={e=>setNotif(n=>({...n,channels:{...n.channels,[ch.key]:e.target.checked}}))}/>
                  <span>{ch.icon} {ch.label}</span>
                  {ch.always && <span style={{ fontSize:10, color:C.success }}>✅</span>}
                </label>
              ))}
            </div>

            {/* Schedule */}
            <label style={S.lbl}>{lbl('发送时间','Schedule')}</label>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              {[
                { val:'now',      label:lbl('立即发送','Send Now') },
                { val:'schedule', label:lbl('定时发送','Schedule') },
              ].map(opt=>(
                <label key={opt.val} style={{ ...S.check }}>
                  <input type="radio" name="scheduleType" value={opt.val}
                    checked={notif.scheduleType===opt.val}
                    onChange={()=>setNotif(n=>({...n,scheduleType:opt.val}))}/>
                  {opt.label}
                </label>
              ))}
            </div>
            {notif.scheduleType==='schedule' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
                <input type="date" style={S.inp}
                  value={notif.scheduleDate}
                  onChange={e=>setNotif(n=>({...n,scheduleDate:e.target.value}))}/>
                <input type="time" style={S.inp}
                  value={notif.scheduleTime}
                  onChange={e=>setNotif(n=>({...n,scheduleTime:e.target.value}))}/>
              </div>
            )}

            <button onClick={sendNotification}
              disabled={sending||!notif.title||!notif.content}
              style={{ width:'100%', marginTop:16, padding:'12px', borderRadius:10,
                border:'none', fontWeight:700, fontSize:14, cursor:'pointer',
                background:sending||!notif.title||!notif.content?'#9ca3af':C.primary,
                color:'#fff' }}>
              {sending?lbl('发送中...','Sending...'):`📢 ${lbl('发送通知','Send Notification')}`}
            </button>

            <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8,
              background:'#fef3c7', fontSize:12, color:'#92400e' }}>
              💡 {lbl('短信和邮件服务需要在 Netlify 环境变量中配置对应的 API Keys（Twilio / SendGrid / 阿里云）',
                      'SMS & Email require API Keys in Netlify env vars (Twilio / SendGrid / Aliyun)')}
            </div>
          </div>

          {/* Notification log */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>
              📋 {lbl('发送记录','Notification Log')}
            </h3>
            {notifLog.length===0 ? (
              <p style={{ color:'var(--text-muted)', fontSize:13, textAlign:'center', padding:'1.5rem' }}>
                {lbl('暂无通知记录','No notifications sent yet')}
              </p>
            ) : notifLog.map((n,i)=>(
              <div key={i} style={{ padding:'10px 12px', borderRadius:8, marginBottom:6,
                background:'var(--background)', border:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <strong style={{ fontSize:13 }}>{n.title}</strong>
                  <span style={{ fontSize:11, color:'var(--text-muted)' }}>{n.created_at?.slice(0,10)}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>{n.content?.slice(0,60)}...</div>
                <div style={{ display:'flex', gap:6 }}>
                  <span style={{ fontSize:10, padding:'1px 7px', borderRadius:8, background:'#dbeafe', color:C.info }}>
                    👥 {n.audience||'all'}
                  </span>
                  {n.channels && (() => {
                    try {
                      const ch = JSON.parse(n.channels);
                      return <>
                        {ch.inApp && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:8, background:'#d1fae5', color:C.success }}>🔔 站内</span>}
                        {ch.email && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:8, background:'#dbeafe', color:C.info }}>📧 邮件</span>}
                        {ch.sms   && <span style={{ fontSize:10, padding:'1px 7px', borderRadius:8, background:'#fef3c7', color:C.warning }}>📱 短信</span>}
                      </>;
                    } catch { return null; }
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
