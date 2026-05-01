// src/pages/ParentDashboard.jsx
// 家长中心 — 完整版
// ✅ 查看孩子的作业情况和完成状态
// ✅ 出勤记录
// ✅ AI学业分析（强项/弱项/建议）
// ✅ 家校沟通（发消息给老师）
// ✅ 实时数据来自 Supabase

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function ParentDashboard() {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const lbl = (zh, en) => language === 'zh' ? zh : en;

  const [tab,         setTab]         = useState(() => new URLSearchParams(window.location.search).get('tab')||'overview');
  const [children,    setChildren]    = useState([]);
  const [selChild,    setSelChild]    = useState(null);
  const [homework,    setHomework]    = useState([]);
  const [attendance,  setAttendance]  = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [messages,    setMessages]    = useState([]);
  const [teachers,    setTeachers]    = useState([]);
  const [analysis,    setAnalysis]    = useState('');
  const [genAnalysis, setGenAnalysis] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [msgForm,     setMsgForm]     = useState({ to_id:'', subject:'', content:'' });
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);

  useEffect(() => { if (supabase) loadChildren(); }, [supabase]);
  useEffect(() => { const t=new URLSearchParams(location.search).get('tab'); if(t) setTab(t); }, [location.search]);
  useEffect(() => { if (selChild && supabase) loadChildData(); }, [selChild, supabase]);

  async function loadChildren() {
    setLoading(true);
    // Get children linked to this parent
    const { data: links } = await supabase
      .from('dwxz_parent_student_links')
      .select('student_id, users!parent_student_links_student_id_fkey(id,name,username,email)')
      .eq('parent_id', user?.id);

    if (links?.length) {
      const kids = links.map(l => l.users).filter(Boolean);
      setChildren(kids);
      setSelChild(kids[0]);
    } else {
      // Fallback: find children by parent_name/phone matching
      const { data: kids } = await supabase
        .from('dwxz_users_view').select('id,name,username,email,gender,birth_year')
        .eq('role','student')
        .or(`parent_phone.eq.${user?.phone},parent_name.eq.${user?.name}`);
      if (kids?.length) { setChildren(kids); setSelChild(kids[0]); }
    }
    setLoading(false);
  }

  async function loadChildData() {
    if (!selChild) return;
    const childId = selChild.id;

    // Load class enrollment to get class info
    const { data: enroll } = await supabase
      .from('dwxz_class_enrollments')
      .select('class_id, classes(id,name,name_zh), users!class_enrollments_class_id_fkey(id,name,role)')
      .eq('student_id', childId).eq('status','active').limit(5);

    const classIds = (enroll||[]).map(e=>e.class_id).filter(Boolean);

    // Load homework for student's classes
    const { data: hw } = await supabase
      .from('dwxz_homework')
      .select('id,title,title_zh,due_date,created_at,homework_type,description')
      .in('class_id', classIds.length?classIds:['none'])
      .eq('is_active',true)
      .order('due_date',{ascending:false}).limit(20);
    setHomework(hw||[]);

    // Load student's submissions
    const { data: subs } = await supabase
      .from('dwxz_homework_submissions')
      .select('homework_id,score,feedback,submitted_at,status,corrections')
      .eq('student_id', childId);
    setSubmissions(subs||[]);

    // Load attendance
    const { data: att } = await supabase
      .from('dwxz_class_attendance')
      .select('date,status,class_id')
      .eq('student_id', childId)
      .order('date',{ascending:false}).limit(60);
    setAttendance(att||[]);

    // Load teachers from classes
    const { data: teacherData } = await supabase
      .from('dwxz_classes')
      .select('id,name_zh,name,created_by, users!classes_created_by_fkey(id,name,username,email)')
      .in('id', classIds.length?classIds:['none']);
    const ts = (teacherData||[]).map(c=>c.users).filter(Boolean);
    setTeachers(ts);
    if (ts[0] && !msgForm.to_id) setMsgForm(f=>({...f, to_id: ts[0].id}));

    // Load messages
    const { data: msgs } = await supabase
      .from('dwxz_parent_messages')
      .select('*')
      .or(`from_id.eq.${user?.id},to_id.eq.${user?.id}`)
      .order('created_at',{ascending:false}).limit(20);
    setMessages(msgs||[]);
  }

  async function generateAnalysis() {
    setGenAnalysis(true); setAnalysis('');
    const hwCount   = homework.length;
    const subCount  = submissions.length;
    const scored    = submissions.filter(s=>s.score!=null);
    const avgScore  = scored.length ? Math.round(scored.reduce((a,b)=>a+b.score,0)/scored.length) : null;
    const attRate   = attendance.length
      ? Math.round(attendance.filter(a=>a.status==='present').length/attendance.length*100) : null;
    const pending   = homework.filter(h=>!submissions.find(s=>s.homework_id===h.id)).length;

    try {
      const res = await fetch('/.netlify/functions/teacher-ai', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'qa',
          question:`请为家长生成一份孩子的学习分析报告：
学生：${selChild?.name}
作业总数：${hwCount}，已完成：${subCount}，未完成：${pending}
平均成绩：${avgScore!=null?avgScore+'分':'暂无批改记录'}
出勤率：${attRate!=null?attRate+'%':'暂无记录'}

请分析：
1. 总体学习状态评估（1-2句）
2. 主要强项（2-3点）
3. 需要加强的弱项（2-3点）
4. 给家长的具体建议（3-4条可操作的建议）
5. 鼓励的话（1句）

请用温暖、正面的语言，适合家长阅读，不超过250字。`,
          language,
        }),
      });
      const d = await res.json();
      setAnalysis(d.answer||'');
    } catch(e) { setAnalysis('生成失败: '+e.message); }
    setGenAnalysis(false);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!msgForm.to_id||!msgForm.content) return;
    setSending(true);
    try {
      await supabase.from('dwxz_parent_messages').insert([{
        from_id:   user?.id,
        from_name: user?.name||user?.username,
        to_id:     msgForm.to_id,
        subject:   msgForm.subject || lbl('家长留言','Parent Message'),
        content:   msgForm.content,
        is_read:   false,
        created_at: new Date().toISOString(),
      }]);
      setSent(true);
      setMsgForm(f=>({...f, subject:'', content:''}));
      setTimeout(()=>setSent(false),3000);
      loadChildData();
    } catch(e) { alert('发送失败: '+e.message); }
    setSending(false);
  }

  // Computed stats
  const hwWithSub = homework.map(h=>({
    ...h,
    sub: submissions.find(s=>s.homework_id===h.id),
  }));
  const completionRate = homework.length
    ? Math.round(submissions.length/homework.length*100) : 0;
  const avgScore = submissions.filter(s=>s.score!=null).length
    ? Math.round(submissions.filter(s=>s.score!=null).reduce((a,b)=>a+b.score,0)/submissions.filter(s=>s.score!=null).length)
    : null;
  const attRate = attendance.length
    ? Math.round(attendance.filter(a=>a.status==='present').length/attendance.length*100) : null;

  const S = {
    card: { background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem', marginBottom:'1rem' },
    tabBtn: (a) => ({ padding:'8px 18px', border:'none', background:'none', cursor:'pointer',
      fontSize:13, fontWeight:600, borderBottom:a?'2px solid var(--primary)':'none',
      color:a?'var(--primary)':'var(--text-muted)', whiteSpace:'nowrap' }),
    inp: { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)',
      fontSize:13, background:'var(--background)', boxSizing:'border-box', marginTop:4 },
  };

  if (loading) return <div style={{ padding:'3rem', textAlign:'center', color:'var(--text-muted)' }}>
    ⏳ {lbl('加载中...','Loading...')}
  </div>;

  if (!children.length) return (
    <div style={{ ...S.card, textAlign:'center', padding:'3rem' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>👨‍👩‍👧</div>
      <h3>{lbl('暂未关联学生账户','No student linked yet')}</h3>
      <p style={{ color:'var(--text-muted)', fontSize:13 }}>
        {lbl('请联系老师将您的孩子账户与家长账户关联','Please ask the teacher to link your child\'s account')}
      </p>
    </div>
  );

  return (
    <div>
      <div className="content-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h1>👨‍👩‍👧 {lbl('家长中心','Parent Center')}</h1>
          <p style={{ color:'var(--text-muted)', fontSize:13, margin:'4px 0 0' }}>
            {lbl('了解孩子的学习情况，与老师保持沟通','Track your child\'s progress and communicate with teachers')}
          </p>
        </div>
        {children.length > 1 && (
          <select style={{ ...S.inp, width:'auto', marginTop:0 }}
            value={selChild?.id||''} onChange={e=>setSelChild(children.find(c=>c.id===e.target.value))}>
            {children.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Child banner */}
      {selChild && (
        <div style={{ ...S.card, background:'linear-gradient(135deg,var(--primary),#8B1A1A)',
          color:'#fff', display:'flex', alignItems:'center', gap:'1rem' }}>
          <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(255,255,255,0.2)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>
            {selChild.name?.[0]?.toUpperCase()||'?'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:18 }}>{selChild.name}</div>
            <div style={{ fontSize:12, opacity:0.8 }}>{selChild.username && `@${selChild.username}`}</div>
          </div>
          <div style={{ display:'flex', gap:'1.5rem' }}>
            {[
              { label:lbl('作业完成率','Completion'), val:`${completionRate}%` },
              { label:lbl('平均成绩','Avg Score'), val:avgScore!=null?`${avgScore}分`:'-' },
              { label:lbl('出勤率','Attendance'), val:attRate!=null?`${attRate}%`:'-' },
            ].map((s,i)=>(
              <div key={i} style={{ textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:700 }}>{s.val}</div>
                <div style={{ fontSize:11, opacity:0.7 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:'1.25rem', overflowX:'auto' }}>
        {[
          { id:'overview',   icon:'📊', label:lbl('总览','Overview')    },
          { id:'homework',   icon:'📝', label:lbl('作业情况','Homework') },
          { id:'attendance', icon:'✅', label:lbl('出勤记录','Attendance')},
          { id:'analysis',   icon:'🧠', label:lbl('学业分析','Analysis') },
          { id:'messages',   icon:'💬', label:lbl('家校沟通','Messages') },
        ].map(t=><button key={t.id} style={S.tabBtn(tab===t.id)} onClick={()=>setTab(t.id)}>
          {t.icon} {t.label}
        </button>)}
      </div>

      {/* ── OVERVIEW ── */}
      {tab==='overview' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'0.75rem', marginBottom:'1.25rem' }}>
            {[
              { icon:'📝', label:lbl('作业总数','Total HW'),      val:homework.length,    color:'#2563eb' },
              { icon:'✅', label:lbl('已完成','Completed'),       val:submissions.length, color:'#16a34a' },
              { icon:'⏳', label:lbl('未完成','Pending'),         val:Math.max(0,homework.length-submissions.length), color:'#d97706' },
              { icon:'⭐', label:lbl('平均分','Avg Score'),       val:avgScore!=null?avgScore+lbl('分','pts'):'-', color:'#c41e3a' },
            ].map((s,i)=>(
              <div key={i} style={{ ...S.card, textAlign:'center', padding:'1rem', marginBottom:0 }}>
                <div style={{ fontSize:24 }}>{s.icon}</div>
                <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recent homework */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>📝 {lbl('最近作业','Recent Homework')}</h3>
            {hwWithSub.slice(0,5).map((h,i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500 }}>{h.title_zh||h.title}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                    {lbl('截止','Due')}: {h.due_date?new Date(h.due_date).toLocaleDateString():'-'}
                  </div>
                </div>
                <div>
                  {h.sub ? (
                    <span style={{ fontSize:12, padding:'2px 8px', borderRadius:10, fontWeight:600,
                      background:h.sub.score!=null?'#d1fae5':'#dbeafe',
                      color:h.sub.score!=null?'#065f46':'#1d4ed8' }}>
                      {h.sub.score!=null?`✅ ${h.sub.score}分`:lbl('✅ 已提交','✅ Submitted')}
                    </span>
                  ) : (
                    <span style={{ fontSize:12, padding:'2px 8px', borderRadius:10,
                      background:'#fef3c7', color:'#92400e', fontWeight:600 }}>
                      ⏳ {lbl('未完成','Pending')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HOMEWORK ── */}
      {tab==='homework' && (
        <div style={S.card}>
          <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>
            📝 {lbl('作业详情','Homework Detail')}
            <span style={{ fontSize:12, fontWeight:400, marginLeft:8, color:'var(--text-muted)' }}>
              {submissions.length}/{homework.length} {lbl('已完成','completed')}
            </span>
          </h3>
          {hwWithSub.length===0 ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>
              {lbl('暂无作业','No homework yet')}
            </div>
          ) : hwWithSub.map((h,i)=>(
            <div key={i} style={{ padding:'12px 14px', borderRadius:10, marginBottom:8,
              border:'1px solid var(--border)',
              borderLeft:`4px solid ${h.sub?.score!=null?'#16a34a':h.sub?'#2563eb':'#d97706'}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14 }}>{h.title_zh||h.title}</div>
                  {h.description && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{h.description}</div>}
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                    📅 {lbl('截止','Due')}: {h.due_date?new Date(h.due_date).toLocaleDateString(language==='zh'?'zh-CN':'en-GB'):'-'}
                  </div>
                </div>
                <div style={{ flexShrink:0, marginLeft:12 }}>
                  {h.sub ? (
                    <div style={{ textAlign:'right' }}>
                      <span style={{ display:'block', fontSize:12, padding:'2px 8px', borderRadius:10,
                        background:h.sub.score!=null?'#d1fae5':'#dbeafe',
                        color:h.sub.score!=null?'#065f46':'#1d4ed8', fontWeight:600 }}>
                        {h.sub.score!=null?`✅ ${h.sub.score}/100`:lbl('📤 已提交','📤 Submitted')}
                      </span>
                      {h.sub.submitted_at && (
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:3 }}>
                          {new Date(h.sub.submitted_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize:12, padding:'2px 8px', borderRadius:10,
                      background:'#fef3c7', color:'#92400e', fontWeight:600 }}>
                      ⏳ {lbl('未完成','Pending')}
                    </span>
                  )}
                </div>
              </div>
              {/* Teacher feedback visible to parent */}
              {h.sub?.feedback && (
                <div style={{ marginTop:8, padding:'8px 10px', background:'#f0fdf4',
                  borderRadius:8, fontSize:12, color:'#15803d' }}>
                  👩‍🏫 {lbl('老师评语','Teacher comment')}: {h.sub.feedback}
                </div>
              )}
              {h.sub?.corrections && (
                <div style={{ marginTop:4, padding:'6px 10px', background:'#fefce8',
                  borderRadius:8, fontSize:12, color:'#713f12' }}>
                  ✏️ {lbl('批注','Note')}: {h.sub.corrections}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ATTENDANCE ── */}
      {tab==='attendance' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.75rem', marginBottom:'1rem' }}>
            {[
              { label:lbl('出勤','Present'),  val:attendance.filter(a=>a.status==='present').length,  color:'#16a34a', bg:'#d1fae5' },
              { label:lbl('缺勤','Absent'),   val:attendance.filter(a=>a.status==='absent').length,   color:'#dc2626', bg:'#fee2e2' },
              { label:lbl('迟到','Late'),     val:attendance.filter(a=>a.status==='late').length,     color:'#d97706', bg:'#fef3c7' },
            ].map((s,i)=>(
              <div key={i} style={{ ...S.card, textAlign:'center', padding:'1rem', marginBottom:0, background:s.bg }}>
                <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:12, color:s.color }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>📅 {lbl('出勤记录','Attendance Records')}</h3>
            {attendance.length===0 ? (
              <div style={{ textAlign:'center', padding:'1.5rem', color:'var(--text-muted)' }}>
                {lbl('暂无出勤记录','No records yet')}
              </div>
            ) : attendance.map((a,i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between',
                padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                <span>{new Date(a.date).toLocaleDateString(language==='zh'?'zh-CN':'en-GB',{weekday:'short',month:'short',day:'numeric'})}</span>
                <span style={{ fontWeight:600,
                  color:a.status==='present'?'#16a34a':a.status==='absent'?'#dc2626':'#d97706' }}>
                  {a.status==='present'?'✅ '+lbl('出勤','Present'):
                   a.status==='absent'?'❌ '+lbl('缺勤','Absent'):
                   '⚠️ '+lbl('迟到','Late')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ANALYSIS ── */}
      {tab==='analysis' && (
        <div>
          <div style={{ ...S.card, background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1px solid #bfdbfe' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
              <h3 style={{ margin:0, fontSize:15, color:'#1d4ed8' }}>
                🧠 {lbl(`${selChild?.name} 的学业分析`,`${selChild?.name}'s Academic Analysis`)}
              </h3>
              <button onClick={generateAnalysis} disabled={genAnalysis}
                style={{ padding:'6px 16px', borderRadius:8, border:'none', cursor:'pointer',
                  background:'#2563eb', color:'#fff', fontSize:13, fontWeight:600,
                  opacity:genAnalysis?0.6:1 }}>
                {genAnalysis?lbl('分析中...','Analysing...'):`✨ ${lbl('生成分析','Generate')}`}
              </button>
            </div>

            {/* Data summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8, marginBottom:'1rem' }}>
              {[
                { label:lbl('作业完成率','Completion'), val:`${completionRate}%`, icon:'📝',
                  color:completionRate>=80?'#16a34a':completionRate>=60?'#d97706':'#dc2626' },
                { label:lbl('平均分','Avg Score'), val:avgScore!=null?`${avgScore}分`:'-', icon:'⭐',
                  color:avgScore==null?'#6b7280':avgScore>=80?'#16a34a':avgScore>=60?'#d97706':'#dc2626' },
                { label:lbl('出勤率','Attendance'), val:attRate!=null?`${attRate}%`:'-', icon:'✅',
                  color:attRate==null?'#6b7280':attRate>=90?'#16a34a':attRate>=70?'#d97706':'#dc2626' },
              ].map((s,i)=>(
                <div key={i} style={{ background:'#fff', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:20 }}>{s.icon}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {analysis ? (
              <div style={{ background:'#fff', borderRadius:12, padding:'1.25rem',
                fontSize:14, lineHeight:1.9, whiteSpace:'pre-wrap', color:'#1f2937' }}>
                {analysis}
              </div>
            ) : !genAnalysis && (
              <div style={{ textAlign:'center', padding:'1.5rem', color:'#6b7280', fontSize:13 }}>
                {lbl('点击"生成分析"获取孩子的学习情况报告','Click "Generate" for a full analysis of your child\'s progress')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MESSAGES ── */}
      {tab==='messages' && (
        <div>
          {/* Send message */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>
              ✉️ {lbl('发消息给老师','Send Message to Teacher')}
            </h3>
            {sent && (
              <div style={{ padding:'8px 12px', borderRadius:8, background:'#d1fae5',
                color:'#065f46', fontSize:13, marginBottom:'0.75rem' }}>
                ✅ {lbl('消息已发送！','Message sent!')}
              </div>
            )}
            <form onSubmit={sendMessage}>
              <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:3 }}>
                {lbl('收件教师','Teacher')}
              </label>
              <select style={S.inp} value={msgForm.to_id}
                onChange={e=>setMsgForm(f=>({...f,to_id:e.target.value}))}>
                <option value="">{lbl('-- 选择老师 --','-- Select Teacher --')}</option>
                {teachers.map(t=>(
                  <option key={t.id} value={t.id}>{t.name||t.username}</option>
                ))}
              </select>
              <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:3, marginTop:10 }}>
                {lbl('主题（可选）','Subject (optional)')}
              </label>
              <input style={S.inp} value={msgForm.subject}
                onChange={e=>setMsgForm(f=>({...f,subject:e.target.value}))}
                placeholder={lbl('如：关于孩子的学习情况','e.g. About my child\'s progress')}/>
              <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:3, marginTop:10 }}>
                {lbl('消息内容 *','Message *')}
              </label>
              <textarea style={{ ...S.inp, height:100, resize:'vertical' }}
                value={msgForm.content}
                onChange={e=>setMsgForm(f=>({...f,content:e.target.value}))}
                placeholder={lbl('请输入您想告诉老师的内容...','Write your message to the teacher...')}
                required/>
              <button type="submit" disabled={sending||!msgForm.content||!msgForm.to_id}
                style={{ marginTop:10, padding:'9px 20px', borderRadius:8, border:'none',
                  cursor:sending?'not-allowed':'pointer', background:'var(--primary)', color:'#fff',
                  fontWeight:700, fontSize:13,
                  opacity:sending||!msgForm.content||!msgForm.to_id?0.5:1 }}>
                {sending?lbl('发送中...','Sending...'):`📤 ${lbl('发送','Send')}`}
              </button>
            </form>
          </div>

          {/* Message history */}
          {messages.length > 0 && (
            <div style={S.card}>
              <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>
                📬 {lbl('消息记录','Message History')}
              </h3>
              {messages.map((m,i)=>(
                <div key={i} style={{ padding:'10px 12px', borderRadius:8, marginBottom:6,
                  background: m.from_id===user?.id?'#eff6ff':'var(--background)',
                  border:'1px solid var(--border)',
                  borderLeft:`3px solid ${m.from_id===user?.id?'#2563eb':'var(--primary)'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600 }}>
                      {m.from_id===user?.id
                        ? `📤 ${lbl('我 → ','Me → ')}${lbl('老师','Teacher')}`
                        : `📥 ${lbl('老师','Teacher')} → ${lbl('我','Me')}`}
                    </span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {m.subject && <div style={{ fontSize:12, fontWeight:500, marginBottom:3 }}>{m.subject}</div>}
                  <div style={{ fontSize:13, color:'var(--text)' }}>{m.content}</div>
                  {!m.is_read && m.from_id!==user?.id && (
                    <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8,
                      background:'#fee2e2', color:'#dc2626', marginTop:4, display:'inline-block' }}>
                      {lbl('未读','Unread')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
