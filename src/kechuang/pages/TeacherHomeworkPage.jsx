// src/pages/TeacherHomeworkPage.jsx
// 作业管理 — 智能布置作业
// 根据学生学习情况、知识点掌握程度、出勤率自动生成个性化作业

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function TeacherHomeworkPage() {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const lbl = (zh, en) => language === 'zh' ? zh : en;

  const [classes,    setClasses]    = useState([]);
  const [selClass,   setSelClass]   = useState('');
  const [students,   setStudents]   = useState([]);
  const [homework,   setHomework]   = useState([]);
  const [generating, setGenerating] = useState(false);
  const [generated,  setGenerated]  = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [tab,        setTab]        = useState('generate'); // generate | list

  // Form state
  const [form, setForm] = useState({
    topic: '', hsk_level: 3, hw_type: 'mixed',
    difficulty: 'auto', count: 5, due_days: 7,
    adaptive: true,
  });

  useEffect(() => {
    if (!supabase) return;
    supabase.from('dwxz_classes').select('id,name,name_zh,hsk_level').eq('is_active', true)
      .then(({ data }) => {
        setClasses(data || []);
        if (data?.[0]) { setSelClass(data[0].id); setForm(f=>({...f,hsk_level:data[0].hsk_level||3})); }
      });
  }, [supabase]);

  useEffect(() => {
    if (!selClass || !supabase) return;
    // Load students and recent homework
    supabase.from('dwxz_class_enrollments').select('student_id, users(id,name,username)')
      .eq('class_id', selClass).eq('status','active')
      .then(({ data }) => setStudents((data||[]).map(e=>e.users).filter(Boolean)));

    supabase.from('dwxz_homework').select('id,title,due_date,created_at,status')
      .eq('class_id', selClass).order('created_at',{ascending:false}).limit(20)
      .then(({ data }) => setHomework(data || []));
  }, [selClass, supabase]);

  async function generateAdaptiveHomework() {
    if (!form.topic) return;
    setGenerating(true); setGenerated(null);

    try {
      // Gather adaptive data
      let attRate = null, progressSummary = '', weakPoints = [];

      if (supabase && selClass) {
        // Attendance rate
        const { data: att } = await supabase.from('dwxz_class_attendance')
          .select('status').eq('class_id', selClass).limit(100);
        if (att?.length) {
          attRate = Math.round(att.filter(a=>a.status==='present').length / att.length * 100);
        }
        // Teaching progress — find incomplete points
        const { data: prog } = await supabase.from('dwxz_teaching_progress')
          .select('point_key,completed').eq('class_id', selClass);
        if (prog?.length) {
          weakPoints = prog.filter(p=>!p.completed).map(p=>p.point_key).slice(0,8);
          const doneCount = prog.filter(p=>p.completed).length;
          progressSummary = `已完成${doneCount}/${prog.length}个知识点`;
        }
        // Recent homework scores (if available)
        // Could add quiz scores here in future
      }

      const adaptiveContext = form.adaptive ? `
班级数据：
- 出勤率：${attRate !== null ? attRate+'%' : '暂无数据'}
- 教学进度：${progressSummary || '暂无进度记录'}
- 薄弱知识点：${weakPoints.length > 0 ? weakPoints.join('、') : '暂无数据'}
- 学生数量：${students.length}人

请根据以上数据调整作业难度和内容：出勤率低→适当减少作业量；薄弱知识点多→重点围绕未掌握内容。` : '';

      const res = await fetch('/.netlify/functions/teacher-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'qa',
          question: `你是中文教师，请为HSK${form.hsk_level}班级设计一份作业。
主题：${form.topic}
类型：${form.hw_type}（vocabulary=词汇练习, grammar=语法练习, reading=阅读理解, writing=写作, mixed=综合）
题目数量：${form.count}题
${adaptiveContext}

输出JSON（无markdown）：
{
  "title": "作业标题",
  "description": "作业说明（1-2句）",
  "difficulty": "easy/medium/hard",
  "adaptive_notes": "根据班级数据的调整说明",
  "sections": [
    {
      "name": "部分名称",
      "type": "fill_blank/multiple_choice/writing/matching",
      "exercises": [
        { "question": "题目", "answer": "答案", "hint": "提示（可选）", "points": 10 }
      ]
    }
  ],
  "total_points": 100,
  "estimated_time": "20分钟"
}`,
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
      setGenerated(parsed || { title: form.topic + '作业', _raw: data.answer });
    } catch(e) {
      setGenerated({ _error: e.message });
    }
    setGenerating(false);
  }

  async function saveHomework() {
    if (!generated || !selClass || !supabase) return;
    setSaving(true);
    try {
      const due = new Date();
      due.setDate(due.getDate() + form.due_days);

      await supabase.from('dwxz_homework').insert([{
        class_id:    selClass,
        title:       generated.title || form.topic,
        description: generated.description || '',
        content:     JSON.stringify(generated),
        hsk_level:   form.hsk_level,
        due_date:    due.toISOString(),
        is_active:   true,
        created_by:  user?.id,
        metadata: {
          adaptive: form.adaptive,
          difficulty: generated.difficulty,
          total_points: generated.total_points,
          estimated_time: generated.estimated_time,
          adaptive_notes: generated.adaptive_notes,
        },
      }]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Refresh list
      const { data } = await supabase.from('dwxz_homework')
        .select('id,title,due_date,created_at,status')
        .eq('class_id', selClass).order('created_at',{ascending:false}).limit(20);
      setHomework(data || []);
    } catch(e) { alert('保存失败: ' + e.message); }
    setSaving(false);
  }

  const S = {
    card: { background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem', marginBottom:'1rem' },
    inp: { width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:13, background:'var(--background)', boxSizing:'border-box' },
    tabBtn: (a) => ({ padding:'8px 18px', border:'none', background:'none', cursor:'pointer',
      fontSize:13, fontWeight:600, borderBottom:a?'2px solid var(--primary)':'none',
      color:a?'var(--primary)':'var(--text-muted)' }),
  };

  return (
    <div>
      <div className="content-header">
        <h1>📝 {lbl('作业管理','Homework')}</h1>
        <p style={{ color:'var(--text-muted)', fontSize:13, margin:'4px 0 0' }}>
          {lbl('布置作业 · 根据班级学情动态调整难度和内容','Auto · Adjusts difficulty based on class performance')}
        </p>
      </div>

      {/* Class selector */}
      <div style={{ ...S.card, display:'flex', gap:'1rem', alignItems:'center', flexWrap:'wrap' }}>
        <div>
          <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:3 }}>{lbl('班级','Class')}</label>
          <select style={{ ...S.inp, width:'auto', minWidth:160 }}
            value={selClass} onChange={e=>{
              setSelClass(e.target.value);
              const cls = classes.find(c=>c.id===e.target.value);
              if(cls?.hsk_level) setForm(f=>({...f,hsk_level:cls.hsk_level}));
            }}>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name_zh||c.name}</option>)}
          </select>
        </div>
        <div style={{ fontSize:13, color:'var(--text-muted)' }}>
          👥 {students.length} {lbl('名学生','students')} &nbsp;·&nbsp;
          📝 {homework.length} {lbl('份作业','assignments')}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:'1.25rem' }}>
        <button style={S.tabBtn(tab==='generate')} onClick={()=>setTab('generate')}>
          ✨ {lbl('生成作业','Generate Homework')}
        </button>
        <button style={S.tabBtn(tab==='list')} onClick={()=>setTab('list')}>
          📋 {lbl('作业列表','Assignment List')} ({homework.length})
        </button>
      </div>

      {/* ── Generate Tab ── */}
      {tab === 'generate' && (
        <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:'1rem', alignItems:'start' }}>
          {/* Form */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 1rem', fontSize:15 }}>⚙️ {lbl('作业设置','Settings')}</h3>

            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:3 }}>
              {lbl('作业主题 *','Topic *')}
            </label>
            <input style={S.inp} value={form.topic}
              onChange={e=>setForm(f=>({...f,topic:e.target.value}))}
              placeholder={lbl('如：打招呼、时间表达、比较句...','e.g. Greetings, Time, Comparison...')}/>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10 }}>
              <div>
                <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:3 }}>HSK</label>
                <select style={S.inp} value={form.hsk_level}
                  onChange={e=>setForm(f=>({...f,hsk_level:parseInt(e.target.value)}))}>
                  {[1,2,3,4,5,6].map(l=><option key={l} value={l}>HSK {l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:3 }}>
                  {lbl('题目数','Questions')}
                </label>
                <select style={S.inp} value={form.count}
                  onChange={e=>setForm(f=>({...f,count:parseInt(e.target.value)}))}>
                  {[3,5,8,10,15].map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginTop:10, marginBottom:3 }}>
              {lbl('作业类型','Type')}
            </label>
            <select style={S.inp} value={form.hw_type}
              onChange={e=>setForm(f=>({...f,hw_type:e.target.value}))}>
              <option value="mixed">{lbl('综合练习','Mixed')}</option>
              <option value="vocabulary">{lbl('词汇练习','Vocabulary')}</option>
              <option value="grammar">{lbl('语法练习','Grammar')}</option>
              <option value="reading">{lbl('阅读理解','Reading')}</option>
              <option value="writing">{lbl('写作练习','Writing')}</option>
            </select>

            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginTop:10, marginBottom:3 }}>
              {lbl('截止时间','Due in')}
            </label>
            <select style={S.inp} value={form.due_days}
              onChange={e=>setForm(f=>({...f,due_days:parseInt(e.target.value)}))}>
              <option value={3}>{lbl('3天后','3 days')}</option>
              <option value={7}>{lbl('1周后','1 week')}</option>
              <option value={14}>{lbl('2周后','2 weeks')}</option>
            </select>

            {/* Adaptive toggle */}
            <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:14, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={form.adaptive}
                onChange={e=>setForm(f=>({...f,adaptive:e.target.checked}))}/>
              <div>
                <div style={{ fontWeight:600 }}>✨ {lbl('教师助手模式','Assistant Mode')}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {lbl('根据出勤率、教学进度、知识点掌握情况自动调整','Adjusts based on attendance, progress, mastery')}
                </div>
              </div>
            </label>

            <button onClick={generateAdaptiveHomework}
              disabled={generating || !form.topic}
              style={{ width:'100%', marginTop:16, padding:'12px', borderRadius:10,
                border:'none', cursor: generating||!form.topic?'not-allowed':'pointer',
                background: generating||!form.topic?'#9ca3af':'var(--primary)',
                color:'#fff', fontSize:14, fontWeight:700 }}>
              {generating
                ? `⏳ ${lbl('生成中...','Generating...')}`
                : `✨ ${lbl('布置作业','Generate Adaptive Homework')}`}
            </button>
          </div>

          {/* Result */}
          <div>
            {!generated && !generating && (
              <div style={{ ...S.card, textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>✨</div>
                <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>
                  {lbl('生成作业','Generate Homework')}
                </div>
                <div style={{ fontSize:12 }}>
                  {lbl('填写参数后点击生成，AI会根据班级实际学情自动调整内容和难度',
                       'Fill in parameters and click generate — AI adjusts based on class performance')}
                </div>
              </div>
            )}

            {generated && !generated._error && (
              <div style={S.card}>
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
                  <div>
                    <h3 style={{ margin:'0 0 4px' }}>{generated.title}</h3>
                    <p style={{ margin:0, color:'var(--text-muted)', fontSize:13 }}>{generated.description}</p>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10,
                        background:'#dbeafe', color:'#1d4ed8', fontWeight:600 }}>
                        HSK {form.hsk_level}
                      </span>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10,
                        background: generated.difficulty==='hard'?'#fee2e2':generated.difficulty==='easy'?'#d1fae5':'#fef3c7',
                        color: generated.difficulty==='hard'?'#991b1b':generated.difficulty==='easy'?'#065f46':'#92400e',
                        fontWeight:600 }}>
                        {generated.difficulty==='hard'?lbl('困难','Hard'):generated.difficulty==='easy'?lbl('简单','Easy'):lbl('中等','Medium')}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {generated.total_points}{lbl('分','pts')} · {generated.estimated_time}
                    </div>
                  </div>
                </div>

                {/* Adaptive notes */}
                {generated.adaptive_notes && (
                  <div style={{ padding:'8px 12px', borderRadius:8, background:'#f0fdf4',
                    fontSize:12, color:'#166534', marginBottom:'1rem', borderLeft:'3px solid #22c55e' }}>
                    🎯 {lbl('自动调整','Auto')}: {generated.adaptive_notes}
                  </div>
                )}

                {/* Sections */}
                {(generated.sections||[]).map((sec, si) => (
                  <div key={si} style={{ marginBottom:'1rem' }}>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:8,
                      color:'var(--primary)', borderBottom:'1px solid var(--border)', paddingBottom:4 }}>
                      {sec.name}
                    </div>
                    {(sec.exercises||[]).map((ex, ei) => (
                      <div key={ei} style={{ padding:'8px 10px', background:'var(--background)',
                        borderRadius:8, marginBottom:6, fontSize:13 }}>
                        <div><strong>{ei+1}.</strong> {ex.question}
                          {ex.hint && <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:6 }}>
                            ({ex.hint})
                          </span>}
                          {ex.points && <span style={{ float:'right', fontSize:11, color:'var(--text-muted)' }}>
                            {ex.points}{lbl('分','pts')}
                          </span>}
                        </div>
                        {ex.answer && (
                          <div style={{ marginTop:4, fontSize:12, color:'#16a34a' }}>
                            → {ex.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}

                {generated._raw && !generated.sections && (
                  <pre style={{ fontSize:11, background:'var(--background)', padding:10,
                    borderRadius:8, overflow:'auto', maxHeight:300, whiteSpace:'pre-wrap' }}>
                    {generated._raw}
                  </pre>
                )}

                {/* Save button */}
                <button onClick={saveHomework} disabled={saving || saved}
                  style={{ width:'100%', padding:'12px', borderRadius:10, border:'none',
                    cursor: saving||saved?'not-allowed':'pointer', fontSize:14, fontWeight:700,
                    background: saved?'#16a34a':saving?'#9ca3af':'var(--primary)',
                    color:'#fff', transition:'background .2s' }}>
                  {saved ? `✅ ${lbl('已保存！','Saved!')}` :
                   saving ? lbl('保存中...','Saving...') :
                   `💾 ${lbl('发布作业','Publish Homework')}`}
                </button>
              </div>
            )}

            {generated?._error && (
              <div style={{ ...S.card, color:'#dc2626', fontSize:13 }}>
                ❌ {generated._error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── List Tab ── */}
      {tab === 'list' && (
        <div style={S.card}>
          {homework.length === 0 ? (
            <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>
              {lbl('暂无作业记录','No homework yet')}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {homework.map(hw => (
                <div key={hw.id} style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', padding:'10px 14px', background:'var(--background)',
                  borderRadius:8, border:'1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>{hw.title}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                      {lbl('截止','Due')}: {hw.due_date ? new Date(hw.due_date).toLocaleDateString() : lbl('未设置','Not set')}
                    </div>
                  </div>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10,
                    background: hw.status==='active'?'#d1fae5':'#f3f4f6',
                    color: hw.status==='active'?'#065f46':'#374151' }}>
                    {hw.status || lbl('已发布','Published')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
