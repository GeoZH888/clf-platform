// src/pages/TeacherProgressPage.jsx
// 教学进度 & 知识点管理 v2
// ✅ 基于上传教材自动生成知识点（非HSK固定分类）
// ✅ 教师可人工添加分类和知识点
// ✅ 勾选已教知识点 → 生成PPT/测验（含Stability配图）
// ✅ 知识库包含文字+音频配对

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function TeacherProgressPage() {
  const { user, supabase } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const lbl = (zh, en) => language === 'zh' ? zh : en;

  const [classes,    setClasses]    = useState([]);
  const [selClass,   setSelClass]   = useState('');
  const [curriculum, setCurriculum] = useState(''); // e.g. "人教版第三册", "HSK2"
  const [showCurriculumForm, setShowCurriculumForm] = useState(false);
  const [points,     setPoints]     = useState([]);   // all knowledge points (from materials + custom)
  const [categories, setCategories] = useState([]);   // unique categories
  const [activeTab,  setActiveTab]  = useState('');
  const [progress,   setProgress]   = useState({});   // { point_key: true/false }
  const [materials,  setMaterials]  = useState([]);   // uploaded materials for this reference
  const [suggest,    setSuggest]    = useState('');
  const [lessonPlan, setLessonPlan] = useState('');
  const [genPlan,    setGenPlan]    = useState(false);
  const [semPlan,    setSemPlan]    = useState('');
  const [genSem,     setGenSem]     = useState(false);
  const [showSemPlan,setShowSemPlan]= useState(false);
  const [loadingSug, setLoadingSug] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [editLabel,  setEditLabel]  = useState('');

  // New point form
  const [newLabel,    setNewLabel]    = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newNote,     setNewNote]     = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Teaching requirements (teacher manual input)
  const [requirements, setRequirements] = useState('');
  const [showReq,      setShowReq]      = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('dwxz_classes').select('id,name,name_zh,hsk_level').eq('is_active',true)
      .then(({ data }) => {
        setClasses(data||[]);
        if (data?.[0]) setSelClass(data[0].id);
      });
  }, [supabase]);

  useEffect(() => {
    if (!selClass || !supabase) return;
    loadClassData();
  }, [selClass, supabase]);

  async function loadClassData() {
    // 1. Load teaching progress
    const { data: prog } = await supabase
      .from('dwxz_teaching_progress').select('*').eq('class_id', selClass);
    const p = {};
    (prog||[]).forEach(r => { p[r.point_key] = r.completed; });
    setProgress(p);

    // 2. Load custom knowledge points (teacher-added)
    const { data: custom } = await supabase
      .from('dwxz_custom_knowledge_points').select('*').eq('class_id', selClass)
      .order('created_at', { ascending: true });

    // 3. Load knowledge points from uploaded materials (tags + titles)
    const { data: mats } = await supabase
      .from('dwxz_knowledge_materials')
      .select('id,title_zh,title,category,tags,file_type,file_name,storage_url,status')
      .eq('status','completed')
      .limit(200);
    setMaterials(mats||[]);

    // Build knowledge points from materials
    // Strategy: tags = knowledge points, grouped by curriculum/category
    // If no tags, use file title as a single point
    const allPoints = [];
    const seenLabels = new Set();

    (mats||[]).forEach(m => {
      const tags = (m.tags||[]).filter(t => t && t.length > 1);
      const cat = m.category || lbl('教学材料','Teaching Materials');

      if (tags.length > 0) {
        // Use tags as individual knowledge points
        tags.forEach(tag => {
          const key = cat + '|' + tag;
          if (!seenLabels.has(key)) {
            seenLabels.add(key);
            allPoints.push({
              id: 'tag_' + m.id + '_' + tag.replace(/\s/g,'_'),
              label: tag,
              category: cat,
              source: 'material',
              hasAudio: ['audio','video'].includes(m.file_type),
            });
          }
        });
      } else {
        // No tags — use file title as one point
        const label = m.title_zh || m.title || m.file_name;
        const key = cat + '|' + label;
        if (!seenLabels.has(key)) {
          seenLabels.add(key);
          allPoints.push({
            id: 'mat_' + m.id,
            label,
            category: cat,
            source: 'material',
            fileType: m.file_type,
            hasAudio: ['audio','video'].includes(m.file_type),
          });
        }
      }
    });

    // From custom points
    (custom||[]).forEach(cp => {
      allPoints.push({
        id: 'custom_' + cp.id,
        label: cp.label,
        category: cp.category || lbl('自定义','Custom'),
        source: 'custom',
        note: cp.note,
        dbId: cp.id,
      });
    });

    setPoints(allPoints);

    // Build category list
    const cats = [...new Set(allPoints.map(p => p.category))].filter(Boolean);
    setCategories(cats);
    if (cats.length > 0 && !activeTab) setActiveTab(cats[0]);

    // Load teaching requirements if saved
    const { data: reqData } = await supabase
      .from('dwxz_teaching_progress')
      .select('point_key,completed')
      .eq('class_id', selClass)
      .eq('point_key', '__requirements__')
      .maybeSingle();
    if (reqData) {
      try { const r = JSON.parse(reqData.completed); if(typeof r==='string') setRequirements(r); } catch {}
    }
  }

  async function togglePoint(key) {
    const newVal = !progress[key];
    setProgress(p => ({ ...p, [key]: newVal })); // immediate UI update
    if (supabase) {
      // Background save — don't await
      supabase.from('dwxz_teaching_progress').upsert({
        class_id: selClass, point_key: key, completed: newVal,
        hsk_level: 0, teacher_id: user?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'class_id,hsk_level,point_key' }).catch(e => {
        console.warn('progress save failed:', e.message);
      });
    }
  }

  async function saveRequirements() {
    if (!supabase) return;
    await supabase.from('dwxz_teaching_progress').upsert({
      class_id: selClass, point_key: '__requirements__',
      completed: JSON.stringify(requirements),
      hsk_level: 0, teacher_id: user?.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'class_id,hsk_level,point_key' });
    setShowReq(false);
  }

  async function addCustomPoint() {
    if (!newLabel.trim()) return;
    setSaving(true);
    const ptCat = newCategory.trim() || curriculum || lbl('自定义','Custom');

    // Optimistic UI update — add immediately, save in background
    const tempId = 'custom_local_' + Date.now();
    const newPt = { id: tempId, label: newLabel.trim(), category: ptCat, source: 'custom', note: newNote.trim() };
    setPoints(p => [...p, newPt]);
    if (!categories.includes(ptCat)) setCategories(c => [...c, ptCat]);
    setActiveTab(ptCat);
    setNewLabel(''); setNewNote(''); setShowAddForm(false);
    setSaving(false);

    // Background DB save (non-blocking)
    if (supabase) {
      supabase.from('dwxz_custom_knowledge_points').insert([{
        class_id: selClass, label: newPt.label,
        category: ptCat, note: newPt.note || '', teacher_id: user?.id,
      }]).select().single().then(({ data }) => {
        if (data) setPoints(p => p.map(x => x.id === tempId
          ? { ...x, dbId: data.id, id: 'custom_' + data.id } : x));
      }).catch(e => console.warn('KB save skipped:', e.message));
    }
  }

  async function startEdit(pt) {
    setEditingId(pt.id);
    setEditLabel(pt.label);
  }

  async function saveEdit(pt) {
    if (!editLabel.trim()) return;
    setPoints(p => p.map(x => x.id === pt.id ? { ...x, label: editLabel } : x));
    setEditingId(null);
    if (pt.dbId && supabase) {
      supabase.from('dwxz_custom_knowledge_points')
        .update({ label: editLabel }).eq('id', pt.dbId).catch(() => {});
    }
  }

  async function removePoint(pt) {
    setPoints(p => p.filter(x => x.id !== pt.id));
    if (pt.dbId && supabase) {
      await supabase.from('dwxz_custom_knowledge_points').delete().eq('id', pt.dbId);
    }
  }

  async function generateLessonPlan() {
    setGenPlan(true); setLessonPlan('');
    const done   = points.filter(p => progress[p.id]).slice(-5);
    const undone = points.filter(p => !progress[p.id]).slice(0, 8);
    try {
      const res = await fetch('/.netlify/functions/teacher-ai', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'qa',
          question:`请为以下课程设计一份详细教案：
教材/级别：${curriculum || '自定义课程'}
已学知识点：${done.map(p=>p.label).join('、') || '暂无'}
本次教学目标：${undone.slice(0,3).map(p=>p.label).join('、') || '见下'}
教学要求：${requirements || '常规教学'}

请生成包含以下部分的教案：
1. 课程目标（3-5条）
2. 教学重点和难点
3. 教学过程（导入→讲解→练习→总结，每步时间分配）
4. 教学活动设计（互动、游戏、练习）
5. 课后作业建议
6. 评估方式

请用中文，格式清晰，适合打印。`,
          language,
        }),
      });
      const d = await res.json();
      setLessonPlan(d.answer || '');
    } catch(e) { setLessonPlan('生成失败: '+e.message); }
    setGenPlan(false);
  }

  async function generateSemesterPlan() {
    setGenSem(true); setSemPlan(''); setShowSemPlan(true);
    const allPts   = points.filter(p => p.source !== 'custom');
    const customPt = points.filter(p => p.source === 'custom');

    // Group by category for overview
    const catGroups = {};
    points.forEach(p => {
      if (!catGroups[p.category]) catGroups[p.category] = [];
      catGroups[p.category].push(p.label);
    });

    const overview = Object.entries(catGroups)
      .map(([cat, pts]) => `${cat}（${pts.length}个）：${pts.slice(0,5).join('、')}${pts.length>5?'..':''}`)
      .join('\n');

    try {
      const res = await fetch('/.netlify/functions/teacher-ai', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'qa',
          question:`请为以下课程生成一份完整的学期教学计划：

教材/级别：${curriculum || '中文课程'}
班级：${classes.find(c=>c.id===selClass)?.name_zh || '未知班级'}
知识点总览：
${overview}
自定义教学重点：${customPt.map(p=>p.label).join('、') || '无'}
教学要求：${requirements || '常规教学'}

请生成一份完整的【学期教学计划】，包含：

## 一、学期目标
（总体目标3-5条）

## 二、教学进度安排（按周）
（共18周，每周列出：教学内容、重点知识点、教学方法）
格式：
第1周 | 主题 | 知识点 | 方法
第2周 | ...
...以此类推到第18周

## 三、月度教学重点
一月/二月/三月/四月/五月

## 四、考核与评估安排
（期中、期末、平时考核时间和方式）

## 五、教学资源需求
（需要准备的材料、工具）

## 六、注意事项
（针对本班特点的特别说明）

请用中文，格式清晰，可直接打印使用。`,
          language,
        }),
      });
      const d = await res.json();
      setSemPlan(d.answer || '生成失败');
    } catch(e) { setSemPlan('生成失败: '+e.message); }
    setGenSem(false);
  }

  async function getSuggestion() {
    setLoadingSug(true); setSuggest('');
    const done  = points.filter(p => progress[p.id]);
    const undone= points.filter(p => !progress[p.id]);
    try {
      const res = await fetch('/.netlify/functions/teacher-ai', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'qa',
          question:`教学进度分析：
班级已完成：${done.slice(0,10).map(p=>p.label).join('、') || '暂无'}
待教内容：${undone.slice(0,10).map(p=>p.label).join('、') || '暂无'}
教材/级别：${curriculum || '未设置'}\n教学要求：${requirements || '未设置'}
请用2-3句话建议下节课的教学重点和方式。`,
          language,
        }),
      });
      const d = await res.json();
      setSuggest(d.answer || '');
    } catch(e) { setSuggest(e.message); }
    setLoadingSug(false);
  }

  const tabPoints = points.filter(p => p.category === activeTab);
  const doneCount = points.filter(p => progress[p.id]).length;
  const pct = points.length > 0 ? Math.round(doneCount / points.length * 100) : 0;
  const nextUndone = points.find(p => !progress[p.id]);

  const S = {
    card: { background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem', marginBottom:'1rem' },
    inp:  { padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:13, background:'var(--background)', width:'100%', boxSizing:'border-box' },
    tabBtn: (a) => ({ padding:'6px 14px', border:'none', background:'none', cursor:'pointer',
      fontSize:12, fontWeight:600, borderBottom:a?'2px solid var(--primary)':'none',
      color:a?'var(--primary)':'var(--text-muted)', whiteSpace:'nowrap', flexShrink:0 }),
  };

  return (
    <div>
      <div className="content-header">
        <h1>📈 {lbl('教学进度 & 知识点','Teaching Progress')}
          {curriculum && <span style={{ fontSize:14, fontWeight:400, marginLeft:10,
            padding:'2px 10px', borderRadius:10, background:'rgba(196,30,58,0.1)', color:'var(--primary)' }}>
            📚 {curriculum}
          </span>}
        </h1>
      </div>

      {/* Class selector + progress */}
      <div style={{ ...S.card, display:'flex', gap:'1rem', alignItems:'center', flexWrap:'wrap' }}>
        <div>
          <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:3 }}>
            {lbl('班级','Class')}
          </label>
          <select style={{ ...S.inp, width:'auto', minWidth:140 }}
            value={selClass} onChange={e=>setSelClass(e.target.value)}>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name_zh||c.name}</option>)}
          </select>
        </div>

        {/* Progress bar */}
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12,
            color:'var(--text-muted)', marginBottom:4 }}>
            <span>{lbl('教学进度','Progress')}</span>
            <span style={{ fontWeight:700, color:'var(--primary)' }}>
              {doneCount}/{points.length} ({pct}%)
            </span>
          </div>
          <div style={{ height:8, background:'var(--border)', borderRadius:4, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${pct}%`,
              background:'var(--primary)', borderRadius:4, transition:'width .5s' }}/>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <div>
            <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:3 }}>
              {lbl('教材/级别','Curriculum/Level')}
            </label>
            <input style={{ ...S.inp, width:'auto', minWidth:160 }}
              value={curriculum}
              onChange={e=>setCurriculum(e.target.value)}
              list="curriculum-list"
              placeholder={lbl('如：人教版第三册、HSK2...','e.g. HSK2, Textbook Vol.3')}/>
            <datalist id="curriculum-list">
              {['人教版第一册','人教版第二册','人教版第三册','人教版第四册',
                'HSK1','HSK2','HSK3','HSK4','HSK5','HSK6',
                '成人班初级','成人班中级','儿童汉语入门','暨南大学教材'].map(c=>(
                <option key={c} value={c}/>
              ))}
            </datalist>
          </div>
          <button onClick={()=>setShowReq(!showReq)}
            style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)',
              background:'none', cursor:'pointer', fontSize:12 }}>
            📋 {lbl('教学要求','Requirements')}
          </button>
          <button onClick={()=>setShowAddForm(!showAddForm)}
            style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--primary)',
              background:'rgba(196,30,58,0.06)', cursor:'pointer', fontSize:12, color:'var(--primary)' }}>
            + {lbl('添加知识点','Add Point')}
          </button>
          <button onClick={()=>navigate(`/teacher/tools?tab=ppt&topic=${encodeURIComponent(nextUndone?.label||'')}`)}
            style={{ padding:'6px 12px', borderRadius:8, border:'none',
              background:'var(--primary)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:600 }}>
            📊 {lbl('生成PPT','PPT')}
          </button>
          <button onClick={()=>navigate(`/teacher/tools?tab=quiz&topic=${encodeURIComponent(nextUndone?.label||'')}`)}
            style={{ padding:'6px 12px', borderRadius:8, border:'1px solid var(--border)',
              background:'none', cursor:'pointer', fontSize:12 }}>
            ❓ {lbl('生成测验','Quiz')}
          </button>
        </div>
      </div>

      {/* Teaching requirements panel */}
      {showReq && (
        <div style={S.card}>
          <h4 style={{ margin:'0 0 8px', fontSize:13 }}>
            📋 {lbl('教学要求 & 课程说明（教师手工输入）','Teaching Requirements (Manual Input)')}
          </h4>
          <textarea style={{ ...S.inp, height:100, resize:'vertical' }}
            value={requirements}
            onChange={e=>setRequirements(e.target.value)}
            placeholder={lbl(
              '例如：本学期重点学习日常对话，要求学生掌握基本问候、数字、颜色等词汇，能进行简单自我介绍...',
              'e.g. This term focuses on daily conversation, students should master greetings, numbers, colors...'
            )}/>
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button onClick={saveRequirements}
              style={{ padding:'6px 16px', borderRadius:8, border:'none',
                background:'var(--primary)', color:'#fff', cursor:'pointer', fontSize:13 }}>
              {lbl('保存','Save')}
            </button>
            <button onClick={()=>setShowReq(false)}
              style={{ padding:'6px 16px', borderRadius:8, border:'1px solid var(--border)',
                background:'none', cursor:'pointer', fontSize:13 }}>
              {lbl('取消','Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Add custom point form */}
      {showAddForm && (
        <div style={S.card}>
          <h4 style={{ margin:'0 0 10px', fontSize:13 }}>+ {lbl('添加知识点','Add Knowledge Point')}</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>
                {lbl('知识点名称 *','Name *')}
              </label>
              <input style={S.inp} value={newLabel}
                onChange={e=>setNewLabel(e.target.value)}
                placeholder={lbl('如：打招呼、时间表达、比较句...','e.g. Greetings, Time expressions...')}/>
            </div>
            <div>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>
                {lbl('分类（可新建）','Category')}
              </label>
              <input style={S.inp} value={newCategory}
                onChange={e=>setNewCategory(e.target.value)}
                list="cat-list"
                placeholder={lbl('如：词汇、语法、口语...','e.g. Vocabulary, Grammar...')}/>
              <datalist id="cat-list">
                {categories.map(c=><option key={c} value={c}/>)}
              </datalist>
            </div>
            <div style={{ gridColumn:'span 2' }}>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>
                {lbl('备注（可选）','Notes (optional)')}
              </label>
              <input style={S.inp} value={newNote}
                onChange={e=>setNewNote(e.target.value)}
                placeholder={lbl('教学说明或参考资料...','Teaching notes or references...')}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button onClick={addCustomPoint} disabled={!newLabel||saving}
              style={{ padding:'6px 16px', borderRadius:8, border:'none',
                background:'var(--primary)', color:'#fff', cursor:'pointer', fontSize:13 }}>
              {saving ? lbl('保存中...','Saving...') : lbl('添加','Add')}
            </button>
            <button onClick={()=>setShowAddForm(false)}
              style={{ padding:'6px 16px', borderRadius:8, border:'1px solid var(--border)',
                background:'none', cursor:'pointer', fontSize:13 }}>
              {lbl('取消','Cancel')}
            </button>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'1rem' }}>
        {/* Knowledge points grid */}
        <div style={S.card}>
          {points.length === 0 ? (
            <div style={{ textAlign:'center', padding:'2.5rem', color:'var(--text-muted)' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📂</div>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>
                {lbl('暂无知识点','No knowledge points yet')}
              </div>
              <div style={{ fontSize:13, marginBottom:16 }}>
                {lbl('请先在"教学工具 → 上传资料"上传教材，系统会自动提取知识点',
                     'Upload materials in Teaching Tools → Upload, system will auto-extract points')}
              </div>
              <button onClick={()=>navigate('/teacher/tools?tab=upload')}
                style={{ padding:'8px 20px', borderRadius:8, border:'none',
                  background:'var(--primary)', color:'#fff', cursor:'pointer', fontSize:13 }}>
                📂 {lbl('上传教材','Upload Materials')}
              </button>
            </div>
          ) : (
            <>
              {/* Scrollable tab bar */}
              <div style={{ display:'flex', borderBottom:'1px solid var(--border)',
                marginBottom:'1rem', overflowX:'auto', gap:2 }}>
                {categories.map(cat => (
                  <button key={cat} style={S.tabBtn(activeTab===cat)}
                    onClick={()=>setActiveTab(cat)}>
                    {cat}
                    <span style={{ marginLeft:4, fontSize:10, opacity:0.7 }}>
                      ({points.filter(p=>p.category===cat&&progress[p.id]).length}/{points.filter(p=>p.category===cat).length})
                    </span>
                  </button>
                ))}
              </div>

              {/* Points */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
                {tabPoints.map(pt => (
                  <div key={pt.id}
                    style={{
                      padding:'10px 12px', borderRadius:10, cursor:'pointer',
                      border:`2px solid ${progress[pt.id]?'var(--primary)':'var(--border)'}`,
                      background:progress[pt.id]?'rgba(196,30,58,0.06)':'var(--background)',
                      display:'flex', alignItems:'flex-start', gap:8, transition:'all .15s',
                      position:'relative',
                    }}>
                    <span style={{ fontSize:15, flexShrink:0 }}
                      onClick={()=>togglePoint(pt.id)}>
                      {progress[pt.id]?'✅':'⬜'}
                    </span>
                    <div style={{ flex:1, minWidth:0 }} onClick={()=>togglePoint(pt.id)}>
                      <div style={{ fontSize:12, fontWeight:progress[pt.id]?600:400,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {pt.label}
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                        {pt.hasAudio && '🎵 '}
                        {pt.source==='material'?lbl('教材','Material'):
                         pt.source==='tag'?lbl('标签','Tag'):lbl('自定义','Custom')}
                        {pt.note && ' · ' + pt.note.slice(0,20)}
                      </div>
                    </div>
                    {pt.source==='custom' && (
                      <button onClick={()=>removePoint(pt)}
                        style={{ position:'absolute', top:4, right:4,
                          background:'none', border:'none', cursor:'pointer',
                          fontSize:12, color:'var(--text-muted)', padding:2, opacity:0.5 }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          {/* Teaching suggestion */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>
              📋 {lbl('教学建议','Teaching Suggestions')}
            </h3>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:'0.75rem' }}>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={getSuggestion} disabled={loadingSug}
                  style={{ flex:1, padding:'7px', borderRadius:8, border:'none',
                    cursor:'pointer', background:'var(--primary)', color:'#fff',
                    fontSize:12, fontWeight:600, opacity:loadingSug?0.6:1 }}>
                  {loadingSug ? '...' : lbl('教学建议','Suggestions')}
                </button>
                <button onClick={generateLessonPlan} disabled={genPlan}
                  style={{ flex:1, padding:'7px', borderRadius:8, border:'none',
                    cursor:'pointer', background:'#2563eb', color:'#fff',
                    fontSize:12, fontWeight:600, opacity:genPlan?0.6:1 }}>
                  {genPlan ? '...' : lbl('📋 教案','Lesson Plan')}
                </button>
              </div>
              <button onClick={generateSemesterPlan} disabled={genSem}
                style={{ width:'100%', padding:'8px', borderRadius:8, border:'none',
                  cursor:'pointer', background:'#065f46', color:'#fff',
                  fontSize:12, fontWeight:700, opacity:genSem?0.6:1 }}>
                {genSem ? lbl('生成中...','Generating...') : lbl('📅 生成学期教学计划','Semester Plan')}
              </button>
            </div>
            {suggest ? (
              <div style={{ fontSize:13, lineHeight:1.8, color:'var(--text)',
                background:'var(--background)', borderRadius:8, padding:'10px 12px',
                whiteSpace:'pre-wrap' }}>
                {suggest}
              </div>
            ) : (
              <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', margin:0 }}>
                {lbl('点击按钮获取建议','Click button for suggestions')}
              </p>
            )}
          </div>

          {/* Progress by category */}
          {categories.length > 0 && (
            <div style={S.card}>
              <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>
                📊 {lbl('各类进度','By Category')}
              </h3>
              {categories.map(cat => {
                const catPts  = points.filter(p=>p.category===cat);
                const catDone = catPts.filter(p=>progress[p.id]).length;
                const catPct  = catPts.length>0?Math.round(catDone/catPts.length*100):0;
                return (
                  <div key={cat} style={{ marginBottom:10, cursor:'pointer' }}
                    onClick={()=>setActiveTab(cat)}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
                      <span style={{ color:activeTab===cat?'var(--primary)':'var(--text)' }}>{cat}</span>
                      <span style={{ color:'var(--primary)', fontWeight:600 }}>{catDone}/{catPts.length}</span>
                    </div>
                    <div style={{ height:5, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${catPct}%`,
                        background:'var(--primary)', borderRadius:3, transition:'width .3s' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Audio-text pairing info */}
          {materials.some(m=>['audio','video'].includes(m.file_type)) && (
            <div style={{ ...S.card, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
              <div style={{ fontSize:12, color:'#1d4ed8', fontWeight:600, marginBottom:4 }}>
                🎵 {lbl('音频内容已关联','Audio Content Linked')}
              </div>
              <div style={{ fontSize:11, color:'#1e40af' }}>
                {materials.filter(m=>['audio','video'].includes(m.file_type)).length}
                {lbl(' 个音频/视频文件已转录为文字，可通过助手精灵或测验功能使用音频内容',
                     ' audio/video files transcribed — use in Assistant or Quiz')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Semester Plan Modal ── */}
      {showSemPlan && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
          zIndex:9999, display:'flex', alignItems:'flex-start', justifyContent:'center',
          padding:'20px', overflowY:'auto' }}>
          <div style={{ background:'var(--card)', borderRadius:16, width:'100%', maxWidth:860,
            padding:'1.5rem', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <div>
                <h2 style={{ margin:0, fontSize:20 }}>
                  📅 {lbl('学期教学计划','Semester Plan')}
                  {curriculum && <span style={{ fontSize:13, fontWeight:400, marginLeft:8, color:'var(--text-muted)' }}>— {curriculum}</span>}
                </h2>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                  {classes.find(c=>c.id===selClass)?.name_zh} · {new Date().getFullYear()} {lbl('学年','Academic Year')}
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {semPlan && !genSem && (
                  <button onClick={()=>{
                    const cls = classes.find(c=>c.id===selClass);
                    const w = window.open('','_blank');
                    w.document.write(`<!DOCTYPE html><html lang="zh"><head>
                      <meta charset="UTF-8">
                      <title>学期教学计划</title>
                      <style>
                        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600;700&display=swap');
                        body{font-family:'Noto Sans SC',sans-serif;padding:2cm;line-height:1.8;color:#111;max-width:800px;margin:0 auto}
                        h1{color:#c41e3a;border-bottom:3px solid #c41e3a;padding-bottom:8px}
                        h2{color:#1d4ed8;margin-top:24px}
                        h3{color:#065f46}
                        .header{display:flex;justify-content:space-between;margin-bottom:20px;font-size:13px;color:#666}
                        table{width:100%;border-collapse:collapse;margin:12px 0}
                        th{background:#c41e3a;color:#fff;padding:8px 10px;text-align:left;font-size:13px}
                        td{padding:7px 10px;border:1px solid #e5e7eb;font-size:13px;vertical-align:top}
                        tr:nth-child(even) td{background:#f9fafb}
                        pre{white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.9}
                        @media print{@page{margin:2cm} body{padding:0}}
                      </style></head><body>
                      <h1>📅 学期教学计划</h1>
                      <div class="header">
                        <span>教材/级别：<strong>${curriculum||'自定义课程'}</strong></span>
                        <span>班级：<strong>${cls?.name_zh||''}</strong></span>
                        <span>日期：${new Date().toLocaleDateString('zh-CN')}</span>
                      </div>
                      <pre>${semPlan.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
                    </body></html>`);
                    w.document.close();
                    setTimeout(()=>w.print(), 600);
                  }} style={{ padding:'6px 16px', borderRadius:8, border:'none', cursor:'pointer',
                    background:'#065f46', color:'#fff', fontSize:13, fontWeight:600 }}>
                    🖨️ {lbl('打印','Print')}
                  </button>
                )}
                <button onClick={()=>setShowSemPlan(false)}
                  style={{ padding:'6px 16px', borderRadius:8, border:'1px solid var(--border)',
                    background:'none', cursor:'pointer', fontSize:13 }}>
                  {lbl('关闭','Close')}
                </button>
              </div>
            </div>

            {genSem ? (
              <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📅</div>
                <div style={{ fontSize:14 }}>{lbl('正在生成学期教学计划，请稍候（约30秒）...','Generating semester plan, please wait...')}</div>
                <div style={{ marginTop:10, fontSize:12, opacity:0.7 }}>
                  {lbl('系统将根据你的知识点和教材生成18周详细安排','Based on your knowledge points and curriculum')}</div>
              </div>
            ) : semPlan ? (
              <div style={{ background:'var(--background)', borderRadius:12, padding:'1.25rem',
                fontSize:14, lineHeight:1.9, whiteSpace:'pre-wrap', overflowY:'auto',
                maxHeight:'65vh', fontFamily:"'Noto Sans SC', sans-serif" }}>
                {semPlan}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
