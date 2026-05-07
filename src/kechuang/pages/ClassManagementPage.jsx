// src/pages/ClassManagementPage.jsx
// 班级管理 — 创建班级 + 招募学生
// ✅ 优美的创建班级流程
// ✅ 多种登录方式：用户名/手机/学号/邮箱
// ✅ 真实姓名与登录名分离
// ✅ 提交后台审核 → 管理员分配密码
// ✅ 学生/教师可自行改密码

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function ClassManagementPage() {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const lbl = (zh, en) => language === 'zh' ? zh : en;

  const [classes,     setClasses]     = useState([]);
  const [students,    setStudents]    = useState([]);
  const [selClass,    setSelClass]    = useState(null);
  const [tab,         setTab]         = useState('classes'); // classes | students | pending
  const [showCreate,  setShowCreate]  = useState(false);
  const [showEnroll,  setShowEnroll]  = useState(false);
  const [pendingUsers,setPendingUsers]= useState([]);
  const [loading,     setLoading]     = useState(false);
  const [msg,         setMsg]         = useState({ type:'', text:'' });

  useEffect(() => { loadClasses(); }, [supabase]);
  useEffect(() => { if (selClass) loadStudents(selClass.id); }, [selClass]);
  useEffect(() => { loadPending(); }, [supabase]);

  async function loadClasses() {
    if (!supabase) return;
    const { data } = await supabase.from('dwxz_classes')
      .select('*').eq('is_active', true).order('created_at', { ascending: false });
    setClasses(data || []);
    if (data?.[0] && !selClass) setSelClass(data[0]);
  }

  async function loadStudents(classId) {
    if (!supabase) return;
    const { data } = await supabase
      .from('dwxz_class_enrollments')
      .select('*, users(id,name,username,email,phone,role,is_active,created_at)')
      .eq('class_id', classId).eq('status','active');
    setStudents((data||[]).map(e=>e.users).filter(Boolean));
  }

  async function loadPending() {
    if (!supabase) return;
    const { data } = await supabase
      .from('dwxz_users_view')
      .select('*')
      .eq('role','student')
      .eq('is_active', false)
      .order('created_at', { ascending: false });
    setPendingUsers(data || []);
  }

  async function approveUser(userId) {
    if (!supabase) return;
    // Generate temp password
    const tempPw = 'David' + Math.random().toString(36).slice(2,7).toUpperCase();
    await supabase.from('dwxz_users_view').update({
      is_active: true,
      temp_password: tempPw,
      must_change_password: true,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
    setMsg({ type:'success', text: lbl(`已审核通过，临时密码：${tempPw}`,`Approved. Temp password: ${tempPw}`) });
    await loadPending();
  }

  async function rejectUser(userId) {
    if (!supabase) return;
    await supabase.from('dwxz_users_view').delete().eq('id', userId);
    setPendingUsers(u => u.filter(x=>x.id!==userId));
    setMsg({ type:'info', text: lbl('已拒绝并删除申请','Application rejected') });
  }

  const S = {
    card: { background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem', marginBottom:'1rem' },
    inp:  { width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:13, background:'var(--background)', boxSizing:'border-box' },
    lbl:  { fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4, marginTop:12 },
    tabBtn:(a)=>({ padding:'7px 18px', border:'none', background:'none', cursor:'pointer',
      fontSize:13, fontWeight:600, color:a?'var(--primary)':'var(--text-muted)',
      borderBottom:a?'2px solid var(--primary)':'none' }),
  };

  return (
    <div>
      <div className="content-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h1>🏫 {lbl('班级管理','Class Management')}</h1>
        </div>
        <button onClick={()=>setShowCreate(true)}
          style={{ padding:'9px 20px', borderRadius:10, border:'none', cursor:'pointer',
            background:'var(--primary)', color:'#fff', fontSize:14, fontWeight:700 }}>
          + {lbl('创建班级','Create Class')}
        </button>
      </div>

      {msg.text && (
        <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:'1rem', fontSize:13,
          background:msg.type==='success'?'#d1fae5':msg.type==='error'?'#fee2e2':'#dbeafe',
          color:msg.type==='success'?'#065f46':msg.type==='error'?'#991b1b':'#1d4ed8' }}>
          {msg.text}
          <button onClick={()=>setMsg({type:'',text:''})}
            style={{ float:'right', background:'none', border:'none', cursor:'pointer' }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:'1.25rem' }}>
        <button style={S.tabBtn(tab==='classes')}  onClick={()=>setTab('classes')}>
          🏫 {lbl('班级列表','Classes')} ({classes.length})
        </button>
        <button style={S.tabBtn(tab==='students')} onClick={()=>setTab('students')}>
          👥 {lbl('学生管理','Students')}
          {selClass && ` — ${selClass.name_zh||selClass.name}`}
        </button>
        <button style={S.tabBtn(tab==='pending')}  onClick={()=>setTab('pending')}>
          ⏳ {lbl('待审核','Pending')}
          {pendingUsers.length>0 && (
            <span style={{ marginLeft:4, background:'var(--primary)', color:'#fff',
              fontSize:10, borderRadius:10, padding:'1px 5px' }}>{pendingUsers.length}</span>
          )}
        </button>
      </div>

      {/* ── Classes Tab ── */}
      {tab==='classes' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem' }}>
          {classes.map(cls=>(
            <div key={cls.id} style={{ ...S.card, marginBottom:0, cursor:'pointer',
              border:`1px solid ${selClass?.id===cls.id?'var(--primary)':'var(--border)'}`,
              background:selClass?.id===cls.id?'rgba(196,30,58,0.04)':'var(--card)',
              transition:'all .15s' }}
              onClick={()=>{ setSelClass(cls); setTab('students'); }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <h3 style={{ margin:0, fontSize:16 }}>{cls.name_zh||cls.name}</h3>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10,
                  background:'#dbeafe', color:'#1d4ed8', fontWeight:600 }}>
                  HSK {cls.hsk_level||'—'}
                </span>
              </div>
              {cls.description && <p style={{ margin:'0 0 8px', fontSize:12, color:'var(--text-muted)' }}>{cls.description}</p>}
              <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', gap:12 }}>
                <span>📅 {cls.created_at?.slice(0,10)}</span>
                {cls.max_students && <span>👥 最多 {cls.max_students} 人</span>}
              </div>
              <button
                onClick={e=>{ e.stopPropagation(); setSelClass(cls); setShowEnroll(true); }}
                style={{ marginTop:12, width:'100%', padding:'7px', borderRadius:8,
                  border:'1px solid var(--primary)', background:'none', cursor:'pointer',
                  color:'var(--primary)', fontSize:12, fontWeight:600 }}>
                + {lbl('添加学生','Add Students')}
              </button>
            </div>
          ))}
          {classes.length===0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🏫</div>
              <div>{lbl('还没有班级，点击右上角创建第一个班级','No classes yet, click Create Class')}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Students Tab ── */}
      {tab==='students' && (
        <div>
          {!selClass ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>
              {lbl('请先在班级列表选择一个班级','Select a class first')}
            </div>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
                <div style={{ fontSize:14 }}>
                  <strong>{selClass.name_zh||selClass.name}</strong>
                  <span style={{ color:'var(--text-muted)', marginLeft:8 }}>
                    {students.length} {lbl('名学生','students')}
                  </span>
                </div>
                <button onClick={()=>setShowEnroll(true)}
                  style={{ padding:'7px 16px', borderRadius:8, border:'none',
                    background:'var(--primary)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                  + {lbl('添加学生','Add Students')}
                </button>
              </div>

              {students.length===0 ? (
                <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>
                  {lbl('班级暂无学生，点击"添加学生"开始招募','No students yet')}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {students.map(s=>(
                    <div key={s.id} style={{ ...S.card, marginBottom:0, padding:'10px 14px',
                      display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:'50%',
                          background:'var(--primary)', color:'#fff',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontWeight:700, fontSize:14 }}>
                          {(s.name||s.username||'?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600 }}>{s.name||s.username}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                            {s.username&&s.name&&s.username!==s.name && `@${s.username} · `}
                            {s.email||s.phone||''}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10,
                        background:s.is_active?'#d1fae5':'#fef3c7',
                        color:s.is_active?'#065f46':'#92400e', fontWeight:600 }}>
                        {s.is_active?lbl('已激活','Active'):lbl('待激活','Pending')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Pending Tab ── */}
      {tab==='pending' && (
        <div>
          <p style={{ color:'var(--text-muted)', fontSize:13, marginBottom:'1rem' }}>
            {lbl('以下学生申请待审核。审核通过后系统生成临时密码，学生首次登录需修改密码。',
                 'Students below are pending approval. A temp password is generated on approval.')}
          </p>
          {pendingUsers.length===0 ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>
              ✅ {lbl('暂无待审核申请','No pending applications')}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {pendingUsers.map(u=>(
                <div key={u.id} style={{ ...S.card, marginBottom:0, padding:'12px 16px',
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  borderLeft:'4px solid #d97706' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{u.name} <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(@{u.username})</span></div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                      {u.email&&`📧 ${u.email}`}
                      {u.phone&&` 📱 ${u.phone}`}
                      {u.student_id&&` 🎓 ${u.student_id}`}
                      {` · 申请时间：${u.created_at?.slice(0,10)}`}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>approveUser(u.id)}
                      style={{ padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                        background:'#16a34a', color:'#fff', fontSize:12, fontWeight:600 }}>
                      ✅ {lbl('审核通过','Approve')}
                    </button>
                    <button onClick={()=>rejectUser(u.id)}
                      style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #dc2626',
                        background:'none', cursor:'pointer', color:'#dc2626', fontSize:12 }}>
                      ✕ {lbl('拒绝','Reject')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Class Modal ── */}
      {showCreate && (
        <CreateClassModal
          supabase={supabase} user={user} lbl={lbl} S={S}
          onClose={()=>setShowCreate(false)}
          onCreated={(cls)=>{ setClasses(p=>[cls,...p]); setShowCreate(false); setSelClass(cls); }}/>
      )}

      {/* ── Enroll Students Modal ── */}
      {showEnroll && selClass && (
        <EnrollStudentsModal
          supabase={supabase} user={user} lbl={lbl} S={S}
          classInfo={selClass}
          onClose={()=>setShowEnroll(false)}
          onEnrolled={()=>{ setShowEnroll(false); loadStudents(selClass.id); loadPending();
            setTab('pending');
            setMsg({type:'success', text:lbl('学生申请已提交，请在"待审核"页面审批','Student applications submitted — review in Pending tab')}); }}/>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Create Class Modal
   ══════════════════════════════════════════════════════ */
function CreateClassModal({ supabase, user, lbl, S, onClose, onCreated }) {
  const [f, setF] = useState({
    name: '', name_zh: '', hsk_level: 3, description: '',
    max_students: 30, schedule: '', start_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function create() {
    if (!f.name.trim()) { setError(lbl('请填写班级名称','Please enter class name')); return; }
    setSaving(true);
    try {
      const { data, error: e } = await supabase.from('dwxz_classes').insert([{
        name:        f.name.trim(),
        name_zh:     f.name_zh.trim() || f.name.trim(),
        hsk_level:   f.hsk_level,
        description: f.description.trim(),
        max_students:f.max_students,
        schedule:    f.schedule.trim(),
        start_date:  f.start_date || null,
        is_active:   true,
        teacher_id:  user?.id,
        created_at:  new Date().toISOString(),
      }]).select().single();
      if (e) throw new Error(e.message);
      onCreated(data);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={lbl('🏫 创建新班级','🏫 Create New Class')} onClose={onClose}>
      {error && <div style={{ padding:'8px 12px', borderRadius:8, background:'#fee2e2', color:'#991b1b', fontSize:13, marginBottom:'1rem' }}>{error}</div>}

      <label style={S.lbl}>{lbl('班级名称 *','Class Name *')}</label>
      <input style={S.inp} value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))}
        placeholder={lbl('如：华裔班A班 (英文名)','e.g. Chinese Class A')}/>

      <label style={S.lbl}>{lbl('中文名称','Chinese Name')}</label>
      <input style={S.inp} value={f.name_zh} onChange={e=>setF(p=>({...p,name_zh:e.target.value}))}
        placeholder={lbl('如：华裔班','e.g. 华裔班')}/>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <label style={S.lbl}>HSK {lbl('等级','Level')}</label>
          <select style={S.inp} value={f.hsk_level} onChange={e=>setF(p=>({...p,hsk_level:parseInt(e.target.value)}))}>
            <option value={0}>{lbl('不限','Any')}</option>
            {[1,2,3,4,5,6].map(l=><option key={l} value={l}>HSK {l}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>{lbl('最多学生数','Max Students')}</label>
          <input type="number" style={S.inp} value={f.max_students}
            onChange={e=>setF(p=>({...p,max_students:parseInt(e.target.value)||30}))}/>
        </div>
      </div>

      <label style={S.lbl}>{lbl('上课时间','Schedule')}</label>
      <input style={S.inp} value={f.schedule} onChange={e=>setF(p=>({...p,schedule:e.target.value}))}
        placeholder={lbl('如：每周六 10:00-12:00','e.g. Every Saturday 10:00-12:00')}/>

      <label style={S.lbl}>{lbl('开始日期','Start Date')}</label>
      <input type="date" style={S.inp} value={f.start_date}
        onChange={e=>setF(p=>({...p,start_date:e.target.value}))}/>

      <label style={S.lbl}>{lbl('班级简介','Description')}</label>
      <textarea style={{ ...S.inp, height:70, resize:'vertical' }}
        value={f.description} onChange={e=>setF(p=>({...p,description:e.target.value}))}
        placeholder={lbl('课程目标、教学方式、适合学生等...','Course goals, teaching style, suitable for...')}/>

      <div style={{ display:'flex', gap:8, marginTop:'1.25rem' }}>
        <button onClick={create} disabled={saving}
          style={{ flex:1, padding:'11px', borderRadius:10, border:'none', cursor:'pointer',
            background:'var(--primary)', color:'#fff', fontWeight:700, fontSize:14 }}>
          {saving?lbl('创建中...','Creating...'):`🏫 ${lbl('创建班级','Create Class')}`}
        </button>
        <button onClick={onClose}
          style={{ flex:1, padding:'11px', borderRadius:10, border:'1px solid var(--border)',
            background:'none', cursor:'pointer', fontSize:14 }}>
          {lbl('取消','Cancel')}
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════
   Enroll Students Modal
   ══════════════════════════════════════════════════════ */
function EnrollStudentsModal({ supabase, user, lbl, S, classInfo, onClose, onEnrolled }) {
  const [students, setStudents] = useState([newStudent()]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [step,     setStep]     = useState(1); // 1=fill, 2=review, 3=done

  function newStudent() {
    return { id:Math.random().toString(36).slice(2), name:'', username:'', loginType:'username',
      phone:'', email:'', student_id:'', note:'' };
  }

  const loginTypes = [
    { id:'username', icon:'👤', label:lbl('用户名','Username') },
    { id:'phone',    icon:'📱', label:lbl('手机号','Phone')    },
    { id:'student_id',icon:'🎓',label:lbl('学号','Student ID') },
    { id:'email',    icon:'📧', label:lbl('邮箱','Email')      },
  ];

  function updateStudent(id, key, val) {
    setStudents(p=>p.map(s=>s.id===id?{...s,[key]:val}:s));
  }

  function validate() {
    for (const s of students) {
      if (!s.name.trim()) return lbl('请填写真实姓名','Please fill real name');
      if (s.loginType==='username' && !s.username.trim()) return lbl('请填写用户名','Please fill username');
      if (s.loginType==='phone'    && !s.phone.trim())    return lbl('请填写手机号','Please fill phone');
      if (s.loginType==='student_id'&&!s.student_id.trim())return lbl('请填写学号','Please fill student ID');
      if (s.loginType==='email'    && !s.email.trim())    return lbl('请填写邮箱','Please fill email');
    }
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      for (const s of students) {
        // Determine username based on login type
        const loginName = s.loginType==='username' ? s.username :
                          s.loginType==='phone'     ? s.phone    :
                          s.loginType==='student_id'? s.student_id :
                          s.email;

        const { data: newUser, error: uErr } = await supabase.from('dwxz_users_view').insert([{
          name:        s.name.trim(),
          username:    loginName.trim(),
          email:       s.email.trim()||null,
          phone:       s.phone.trim()||null,
          student_id:  s.student_id.trim()||null,
          role:        'student',
          is_active:   false,  // pending approval
          must_change_password: true,
          temp_password: null, // set by teacher/admin on approval
          login_type:  s.loginType,
          notes:       s.note.trim()||null,
          created_by:  user?.id,
          created_at:  new Date().toISOString(),
        }]).select().single();

        if (uErr && !uErr.message.includes('duplicate')) throw new Error(uErr.message);

        // Enroll in class (pending)
        if (newUser) {
          await supabase.from('dwxz_class_enrollments').insert([{
            class_id:   classInfo.id,
            student_id: newUser.id,
            status:     'active',
            enrolled_by:user?.id,
            created_at: new Date().toISOString(),
          }]).catch(()=>{});
        }
      }
      setStep(3);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (step===3) return (
    <Modal title={lbl('✅ 提交成功','✅ Submitted')} onClose={onEnrolled}>
      <div style={{ textAlign:'center', padding:'1.5rem' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🎉</div>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>
          {lbl(`${students.length} 名学生申请已提交！`,`${students.length} student application(s) submitted!`)}
        </div>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:'1.5rem' }}>
          {lbl('请前往"待审核"页面审批。通过后系统将生成临时密码，学生首次登录须修改密码。',
               'Go to Pending tab to approve. Temp passwords will be generated on approval.')}
        </div>
        <button onClick={onEnrolled}
          style={{ padding:'10px 28px', borderRadius:10, border:'none', cursor:'pointer',
            background:'var(--primary)', color:'#fff', fontWeight:700 }}>
          {lbl('查看待审核','View Pending')}
        </button>
      </div>
    </Modal>
  );

  return (
    <Modal title={`👥 ${lbl('添加学生','Add Students')} — ${classInfo.name_zh||classInfo.name}`} onClose={onClose} wide>
      {error && <div style={{ padding:'8px 12px', borderRadius:8, background:'#fee2e2', color:'#991b1b', fontSize:12, marginBottom:'1rem' }}>{error}</div>}

      <div style={{ background:'#eff6ff', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#1d4ed8', marginBottom:'1rem' }}>
        ℹ️ {lbl('真实姓名与登录名可以不同。登录名可使用：用户名、手机号、学号或邮箱。提交后需教师审核批准，审批后系统生成临时密码。',
                 'Real name and login name can differ. Login can be username, phone, student ID or email. Requires approval before activation.')}
      </div>

      {students.map((s, idx) => (
        <div key={s.id} style={{ border:'1px solid var(--border)', borderRadius:12, padding:'14px', marginBottom:'0.75rem', position:'relative' }}>
          <div style={{ fontWeight:600, fontSize:13, marginBottom:10, color:'var(--primary)' }}>
            {lbl('学生','Student')} {idx+1}
          </div>
          {students.length>1 && (
            <button onClick={()=>setStudents(p=>p.filter(x=>x.id!==s.id))}
              style={{ position:'absolute', top:10, right:10, background:'none', border:'none',
                cursor:'pointer', color:'var(--text-muted)', fontSize:16 }}>✕</button>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={S.lbl}>{lbl('真实姓名 *','Real Name *')}</label>
              <input style={S.inp} value={s.name}
                onChange={e=>updateStudent(s.id,'name',e.target.value)}
                placeholder={lbl('如：王小明','e.g. Wang Xiaoming')}/>
            </div>
            <div>
              <label style={S.lbl}>{lbl('登录方式','Login Method')}</label>
              <div style={{ display:'flex', gap:4, marginTop:4 }}>
                {loginTypes.map(lt=>(
                  <button key={lt.id} onClick={()=>updateStudent(s.id,'loginType',lt.id)}
                    style={{ flex:1, padding:'5px 2px', borderRadius:7, border:`1px solid ${s.loginType===lt.id?'var(--primary)':'var(--border)'}`,
                      background:s.loginType===lt.id?'rgba(196,30,58,0.08)':'none',
                      cursor:'pointer', fontSize:10, fontWeight:600,
                      color:s.loginType===lt.id?'var(--primary)':'var(--text-muted)' }}>
                    {lt.icon}<br/>{lt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Login field based on type */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {s.loginType==='username' && (
              <div>
                <label style={S.lbl}>{lbl('用户名 *','Username *')}</label>
                <input style={S.inp} value={s.username}
                  onChange={e=>updateStudent(s.id,'username',e.target.value)}
                  placeholder={lbl('登录用的用户名','Login username')}/>
              </div>
            )}
            {s.loginType==='phone' && (
              <div>
                <label style={S.lbl}>{lbl('手机号 *','Phone *')}</label>
                <input style={S.inp} value={s.phone} type="tel"
                  onChange={e=>updateStudent(s.id,'phone',e.target.value)}
                  placeholder="+39 / +86 ..."/>
              </div>
            )}
            {s.loginType==='student_id' && (
              <div>
                <label style={S.lbl}>{lbl('学号 *','Student ID *')}</label>
                <input style={S.inp} value={s.student_id}
                  onChange={e=>updateStudent(s.id,'student_id',e.target.value)}
                  placeholder={lbl('学号','Student ID')}/>
              </div>
            )}
            {s.loginType==='email' && (
              <div>
                <label style={S.lbl}>{lbl('邮箱 *','Email *')}</label>
                <input style={S.inp} value={s.email} type="email"
                  onChange={e=>updateStudent(s.id,'email',e.target.value)}
                  placeholder="student@example.com"/>
              </div>
            )}
            <div>
              <label style={S.lbl}>{lbl('备注','Notes')}</label>
              <input style={S.inp} value={s.note}
                onChange={e=>updateStudent(s.id,'note',e.target.value)}
                placeholder={lbl('可选备注','Optional notes')}/>
            </div>
          </div>
        </div>
      ))}

      <button onClick={()=>setStudents(p=>[...p,newStudent()])}
        style={{ width:'100%', padding:'8px', borderRadius:9, border:'2px dashed var(--border)',
          background:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, marginBottom:'1rem' }}>
        + {lbl('再添加一名学生','Add Another Student')}
      </button>

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={submit} disabled={saving}
          style={{ flex:1, padding:'12px', borderRadius:10, border:'none', cursor:'pointer',
            background:'var(--primary)', color:'#fff', fontWeight:700, fontSize:14 }}>
          {saving?lbl('提交中...','Submitting...'):`📤 ${lbl('提交审核','Submit for Approval')}`}
        </button>
        <button onClick={onClose}
          style={{ flex:1, padding:'12px', borderRadius:10, border:'1px solid var(--border)',
            background:'none', cursor:'pointer', fontSize:14 }}>
          {lbl('取消','Cancel')}
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════
   Modal wrapper
   ══════════════════════════════════════════════════════ */
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
      <div style={{
        background:'var(--card)', borderRadius:16, padding:'1.5rem',
        width: wide ? 680 : 500, maxWidth:'95vw',
        maxHeight:'90vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <h3 style={{ margin:0, fontSize:16 }}>{title}</h3>
          <button onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'var(--text-muted)' }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
