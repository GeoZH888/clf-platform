// src/pages/TeacherToolsPage.jsx
// 教师 AI 工具中心 — 真实 AI 生成，连接知识库 RAG
// 功能：PPT课件 · 测验题库 · 智能聊天 · 问答助手 · 练习册

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import TeacherUploadPanel from '../components/TeacherUploadPanel';
import { useLanguage } from '../contexts/LanguageContext';

/* ── HSK levels ─────────────────────────────────────────── */
const HSK_LEVELS = [1,2,3,4,5,6,7,8,9];

/* ── Call teacher-ai Netlify function ───────────────────── */
async function callTeacherAI(action, params, config) {
  const res = await fetch('/.netlify/functions/teacher-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      ai_provider:        config.ai_provider || 'openai',
      ai_api_key:         config[`${config.ai_provider||'openai'}_api_key`],
      ai_model:           config[`${config.ai_provider||'openai'}_model`] || 'gpt-4o-mini',
      embedding_provider: config.embedding_provider || 'voyage',
      embedding_api_key:  config.embedding_api_key,
      embedding_model:    config.embedding_model || 'voyage-3',
      ...params,
    }),
  });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const t = await res.text();
    throw new Error(res.status === 404 ? 'teacher-ai 函数不存在，请检查 netlify/functions/' : t.slice(0,150));
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

/* ═══════════════════════════════════════════════════════ */
export default function TeacherToolsPage() {
  const { user, supabase } = useAuth();
  const location = useLocation();
  const urlTab = new URLSearchParams(location.search).get('tab');
  const { language } = useLanguage();
  const [tab, setTab]       = useState(urlTab || 'ppt');
  const [config, setConfig] = useState({});
  const [kbList, setKbList] = useState([]);
  const [selKB,  setSelKB]  = useState('');
  const [loading,setLoading]= useState(false);
  const [result, setResult] = useState(null);
  const [error,  setError]  = useState('');
  const [headerConfig, setHeaderConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dwxz_header_config') || '{}'); } catch { return {}; }
  });
  const [pandaImg,      setPandaImg]      = useState(null);
  const [showHeaderEdit,setShowHeaderEdit]= useState(false);

  const lbl = (zh, en) => language === 'zh' ? zh : en;

  // Sync tab from URL
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab');
    if (t) setTab(t);
  }, [location.search]);

  // Load random panda for header
  useEffect(() => {
    if (!supabase) return;
    supabase.from('dwxz_panda_assets').select('image_url,label,emotion')
      .not('image_url','is',null).limit(20)
      .then(({ data }) => {
        if (data?.length) setPandaImg(data[Math.floor(Math.random()*data.length)]);
      });
  }, [supabase]);

  // Load AI config + KB list
  useEffect(() => {
    if (!supabase) return;
    supabase.from('dwxz_rag_config').select('*').limit(1).maybeSingle()
      .then(({ data }) => { if (data) setConfig(data); });
    supabase.from('dwxz_rag_knowledge_bases').select('id,name,name_zh').order('created_at',{ascending:false})
      .then(({ data }) => { setKbList(data||[]); if(data?.[0]) setSelKB(data[0].id); });
  }, [supabase]);

  const hasEmbKey = !!config.embedding_api_key;

  const [usedProvider, setUsedProvider] = useState('');
  const hasAIKey = true; // keys in Netlify env vars

  function saveHeaderConfig(cfg) {
    setHeaderConfig(cfg);
    localStorage.setItem('dwxz_header_config', JSON.stringify(cfg));
    setShowHeaderEdit(false);
  }

  async function generate(action, params) {
    setLoading(true); setError(''); setResult(null); setUsedProvider('');
    try {
      const res = await callTeacherAI(action, { ...params, kb_id: selKB, language }, config);
      setResult(res);
      if (res._provider_used) setUsedProvider(res._provider_used);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  /* ── Styles ── */
  const S = {
    card: { background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem', marginBottom:'1rem' },
    inp:  { width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:13, background:'var(--background)', boxSizing:'border-box' },
    lbl:  { fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:4, marginTop:12 },
    btn:  (disabled) => ({ width:'100%', padding:'12px', borderRadius:10, border:'none', cursor:disabled?'not-allowed':'pointer',
      fontSize:14, fontWeight:700, background:disabled?'#9ca3af':'var(--primary)', color:'#fff', marginTop:16 }),
    tabBtn: (active) => ({ padding:'8px 16px', border:'none', background:'none', cursor:'pointer',
      fontSize:13, fontWeight:600, borderRadius:'8px 8px 0 0',
      color:active?'var(--primary)':'var(--text-muted)',
      borderBottom:active?'2px solid var(--primary)':'none' }),
  };

  const [tabOrder, setTabOrder] = useState([
    { id:'ppt',       icon:'📊', label:lbl('PPT课件','PPT Slides') },
    { id:'quiz',      icon:'❓', label:lbl('测验题库','Quiz') },
    { id:'chat',      icon:'💬', label:lbl('助手精灵','Assistant') },
    { id:'worksheet', icon:'📝', label:lbl('练习册','Worksheet') },
    { id:'upload',    icon:'📂', label:lbl('上传资料','Upload') },
  ]);
  const TABS = tabOrder;
  const dragTab = useRef(null);
  const dragOverTab = useRef(null);
  function onTabDragStart(e,i){dragTab.current=i;e.dataTransfer.effectAllowed='move';e.currentTarget.style.opacity='0.5';}
  function onTabDragEnter(i){dragOverTab.current=i;}
  function onTabDragOver(e){e.preventDefault();}
  function onTabDragEnd(e){
    e.currentTarget.style.opacity='1';
    const f=dragTab.current,t=dragOverTab.current;
    if(f===null||t===null||f===t){dragTab.current=null;dragOverTab.current=null;return;}
    setTabOrder(arr=>{const a=[...arr];a.splice(t,0,a.splice(f,1)[0]);return a;});
    dragTab.current=null;dragOverTab.current=null;
  }

  /* ── Status bar ── */
  const StatusBar = () => kbList.length > 0 ? (
    <div style={{ display:'flex', gap:8, marginBottom:'1rem', alignItems:'center' }}>
      <label style={{ fontSize:12, color:'var(--text-muted)' }}>{lbl('知识库:','KB:')}</label>
      <select style={{ ...S.inp, width:'auto', padding:'4px 10px', fontSize:12 }}
        value={selKB} onChange={e=>setSelKB(e.target.value)}>
        <option value="">{lbl('不使用','None')}</option>
        {kbList.map(kb=><option key={kb.id} value={kb.id}>{kb.name_zh||kb.name}</option>)}
      </select>
    </div>
  ) : null;

  return (
    <div>
      <div className="content-header">
        <h1>🛠️ {lbl('教学工具','Teaching Tools')}</h1>

      </div>

      <StatusBar/>

      {/* Draggable tab bar — drag to reorder */}
      <div style={{ display:'flex', alignItems:'center', borderBottom:'2px solid var(--border)', marginBottom:'1.25rem' }}>
        <button onClick={()=>document.getElementById('tabs')?.scrollBy({left:-120,behavior:'smooth'})}
          style={{border:'none',background:'none',cursor:'pointer',fontSize:18,padding:'0 8px',color:'var(--text-muted)'}}>‹</button>
        <div id="tabs" style={{display:'flex',gap:2,overflowX:'auto',scrollbarWidth:'none',flex:1}}
          onWheel={e=>e.currentTarget.scrollLeft+=e.deltaY}>
          <style>{`#tabs::-webkit-scrollbar{display:none}`}</style>
          {TABS.map((t,i)=>(
            <div key={t.id} draggable
              onDragStart={e=>onTabDragStart(e,i)} onDragEnter={()=>onTabDragEnter(i)}
              onDragEnd={onTabDragEnd} onDragOver={onTabDragOver}
              style={{flexShrink:0,cursor:'grab'}}>
              <button style={{...S.tabBtn(tab===t.id),whiteSpace:'nowrap',cursor:'inherit',userSelect:'none'}}
                onClick={()=>{setTab(t.id);setResult(null);setError('');}}>
                {t.icon} {t.label}
              </button>
            </div>
          ))}
        </div>
        <button onClick={()=>document.getElementById('tabs')?.scrollBy({left:120,behavior:'smooth'})}
          style={{border:'none',background:'none',cursor:'pointer',fontSize:18,padding:'0 8px',color:'var(--text-muted)'}}>›</button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding:'10px 14px', borderRadius:8, marginBottom:'1rem',
          background:'#fee2e2', color:'#991b1b', fontSize:13 }}>
          ❌ {error}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: result ? '340px 1fr' : '1fr', gap:'1.25rem', alignItems:'start' }}>

        {/* ── Left: Form ── */}
        <div>
          {tab === 'ppt'  && <PPTForm       S={S} lbl={lbl} loading={loading} onGenerate={p=>generate('generate_ppt',p)}/>}
          {tab === 'quiz' && <QuizForm      S={S} lbl={lbl} loading={loading} onGenerate={p=>generate('generate_quiz',p)}/>}
          {tab === 'worksheet' && <WorksheetForm S={S} lbl={lbl} loading={loading} onGenerate={p=>generate('generate_worksheet',p)}/>}
          {tab === 'upload'    && <TeacherUploadPanel S={S} lbl={lbl} supabase={supabase} selKB={selKB} language={language}/>}
          {tab === 'qa'   && <QAForm        S={S} lbl={lbl} loading={loading} onGenerate={p=>generate('qa',p)}/>}
          {tab === 'chat' && <ChatPanel     S={S} lbl={lbl} config={config} selKB={selKB} language={language} hasAIKey={hasAIKey}/>}
        </div>

        {/* ── Right: Result ── */}
        {result && tab !== 'chat' && (
          <div>
            {result.type === 'ppt'       && <PPTResult       result={result} lbl={lbl} headerConfig={headerConfig} pandaImg={pandaImg} onEditHeader={()=>setShowHeaderEdit(true)}/>}
            {result.type === 'quiz'      && <QuizResult      result={result} lbl={lbl} headerConfig={headerConfig} pandaImg={pandaImg} onEditHeader={()=>setShowHeaderEdit(true)}/>}
            {result.type === 'worksheet' && <WorksheetResult result={result} lbl={lbl} headerConfig={headerConfig} pandaImg={pandaImg} onEditHeader={()=>setShowHeaderEdit(true)}/>}
            {result.type === 'qa'        && <QAResult        result={result} lbl={lbl}/>}
          </div>
        )}
      </div>

      {/* Header edit modal */}
      {showHeaderEdit && (
        <HeaderEditModal
          config={headerConfig} pandaImg={pandaImg}
          supabase={supabase} lbl={lbl}
          onSave={saveHeaderConfig}
          onClose={()=>setShowHeaderEdit(false)}/>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  PPT Form                                              */
/* ══════════════════════════════════════════════════════ */
function PPTForm({ S, lbl, loading, onGenerate }) {
  const [f, setF] = useState({ topic:'', hsk_level:3, slide_count:10, style:'educational', include_exercises:true });
  return (
    <div style={S.card}>
      <h3 style={{ margin:'0 0 4px' }}>📊 {lbl('智能PPT生成','AI PPT Generator')}</h3>
      <p style={{ margin:'0 0 12px', color:'var(--text-muted)', fontSize:13 }}>
        {lbl('基于知识库内容，自动生成教学PPT大纲','Auto-generate teaching PPT from knowledge base')}
      </p>
      <label style={S.lbl}>{lbl('教学主题 *','Topic *')}</label>
      <input style={S.inp} value={f.topic} onChange={e=>setF(p=>({...p,topic:e.target.value}))}
        placeholder={lbl('如：HSK3第5课、中国春节、比较句语法...','e.g. HSK3 Lesson 5, Spring Festival...')}/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <label style={S.lbl}>HSK {lbl('等级','Level')}</label>
          <select style={S.inp} value={f.hsk_level} onChange={e=>setF(p=>({...p,hsk_level:parseInt(e.target.value)}))}>
            {HSK_LEVELS.map(l=><option key={l} value={l}>HSK {l}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>{lbl('幻灯片数','Slides')}</label>
          <select style={S.inp} value={f.slide_count} onChange={e=>setF(p=>({...p,slide_count:parseInt(e.target.value)}))}>
            {[5,8,10,12,15,20].map(n=><option key={n} value={n}>{n} {lbl('张','slides')}</option>)}
          </select>
        </div>
      </div>
      <label style={S.lbl}>{lbl('风格','Style')}</label>
      <select style={S.inp} value={f.style} onChange={e=>setF(p=>({...p,style:e.target.value}))}>
        <option value="educational">{lbl('教学风格','Educational')}</option>
        <option value="interactive">{lbl('互动风格','Interactive')}</option>
        <option value="fun">{lbl('趣味风格','Fun & Engaging')}</option>
        <option value="exam">{lbl('考试备考','Exam Prep')}</option>
      </select>
      <label style={{ ...S.lbl, display:'flex', alignItems:'center', gap:6, marginTop:12 }}>
        <input type="checkbox" checked={f.include_exercises}
          onChange={e=>setF(p=>({...p,include_exercises:e.target.checked}))}/>
        {lbl('包含练习和互动','Include exercises')}
      </label>
      <button style={S.btn(!f.topic||loading)} disabled={!f.topic||loading} onClick={()=>onGenerate(f)}>
        {loading ? `⏳ ${lbl('生成中...','Generating...')}` : `📊 ${lbl('生成PPT','Generate PPT')}`}
      </button>
    </div>
  );
}

/* ── PPT Result ── */
/* ══════════════════════════════════════════════════════
   Download as real .pptx using PptxGenJS
   ══════════════════════════════════════════════════════ */

async function loadPptxGen() {
  if (window.PptxGenJS) return window.PptxGenJS;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
    s.onload  = () => resolve(window.PptxGenJS);
    s.onerror = () => reject(new Error('Failed to load pptxgenjs'));
    document.head.appendChild(s);
  });
}

async function downloadAsPPTX(result, images, headerConfig, pandaImg) {
  const PptxGenJS = await loadPptxGen();
  const pres = new PptxGenJS();

  // Presentation metadata
  pres.author  = headerConfig.teacherName || '大卫学中文';
  pres.company = headerConfig.schoolName  || '大卫学中文';
  pres.subject = result.title || 'PPT课件';
  pres.title   = result.title || 'PPT课件';

  // Layout 16:9
  pres.layout = 'LAYOUT_WIDE';

  // Brand colours
  const RED   = 'C41E3A';
  const WHITE = 'FFFFFF';
  const DARK  = '1F2937';
  const MUTED = '6B7280';

  const typeColors = {
    title:      'C41E3A', vocabulary: '1D4ED8', grammar:  '7C3AED',
    dialogue:   '065F46', culture:    '92400E', exercise: '0891B2',
    summary:    '374151',
  };

  // ── Cover slide ──────────────────────────────────────
  const cover = pres.addSlide();
  cover.background = { color: 'C41E3A' };

  // School name top-left
  cover.addText(headerConfig.schoolName || '大卫学中文', {
    x:0.4, y:0.3, w:8, h:0.5,
    fontSize:14, color:WHITE, bold:false, align:'left', transparency:30,
  });

  // Panda image top-right if available
  if (pandaImg?.image_url) {
    try {
      cover.addImage({ path: pandaImg.image_url, x:8.8, y:0.2, w:0.9, h:0.9 });
    } catch {}
  }

  // Main title
  cover.addText(result.title || 'PPT课件', {
    x:0.5, y:2.2, w:9, h:1.5,
    fontSize:36, color:WHITE, bold:true, align:'center',
  });

  // Subtitle info
  const meta = [
    headerConfig.className   && `班级：${headerConfig.className}`,
    headerConfig.teacherName && `教师：${headerConfig.teacherName}`,
    headerConfig.semester    && `学期：${headerConfig.semester}`,
    result.estimated_duration && result.estimated_duration,
  ].filter(Boolean).join('  ·  ');

  if (meta) {
    cover.addText(meta, {
      x:0.5, y:4.0, w:9, h:0.4,
      fontSize:13, color:WHITE, align:'center', transparency:20,
    });
  }

  cover.addText(new Date().toLocaleDateString('zh-CN'), {
    x:0.5, y:4.8, w:9, h:0.3,
    fontSize:11, color:WHITE, align:'center', transparency:40,
  });

  // ── Content slides ────────────────────────────────────
  for (const slide of (result.slides || [])) {
    const sl = pres.addSlide();
    const accentColor = typeColors[slide.type] || '374151';

    // Left accent bar
    sl.addShape(pres.ShapeType.rect, {
      x:0, y:0, w:0.08, h:5.63, fill: { color: accentColor },
    });

    // Type badge
    sl.addText(slide.type.toUpperCase(), {
      x:0.2, y:0.15, w:1.5, h:0.28,
      fontSize:9, color:WHITE, bold:true, align:'center',
      fill:{ color:accentColor }, roundedRect:true,
    });

    // Slide number
    sl.addText(`${slide.index}`, {
      x:9.3, y:0.1, w:0.5, h:0.35,
      fontSize:11, color:accentColor, bold:true, align:'right',
    });

    // Title
    sl.addText(slide.title || '', {
      x:0.2, y:0.5, w: images[slide.index] ? 7.5 : 9.5, h:0.8,
      fontSize:22, color:DARK, bold:true,
    });

    // Slide image (if generated)
    const imgUrl = images?.[slide.index];
    if (imgUrl && !imgUrl.startsWith('error:')) {
      try {
        const isBase64 = imgUrl.startsWith('data:');
        const imgOpts = { x:7.8, y:1.2, w:2, h:1.8, sizing:{ type:'contain', w:2, h:1.8 } };
        if (isBase64) {
          const [header, data] = imgUrl.split(',');
          const ext = header.includes('png')?'png':'jpg';
          sl.addImage({ data: imgUrl.split(',')[1], extension:ext, ...imgOpts });
        } else {
          sl.addImage({ path: imgUrl, ...imgOpts });
        }
      } catch {}
    }

    // Content text
    const contentW = imgUrl && !imgUrl.startsWith('error:') ? 7.4 : 9.5;
    sl.addText(slide.content || '', {
      x:0.2, y:1.4, w:contentW, h:2.5,
      fontSize:13, color:DARK, align:'left',
      valign:'top', wrap:true, charSpacing:0.5, lineSpacingMultiple:1.3,
    });

    // Vocabulary box
    if (slide.vocabulary?.length > 0) {
      const vocabText = slide.vocabulary.slice(0,6).join('\n');
      sl.addShape(pres.ShapeType.rect, {
        x:0.2, y:3.95, w:4.5, h: Math.min(1.4, 0.28*slide.vocabulary.length+0.3),
        fill:{ color:'EFF6FF' }, line:{ color:'BFDBFE', width:1 },
      });
      sl.addText('📝 ' + vocabText, {
        x:0.3, y:4.0, w:4.3, h:1.3,
        fontSize:10, color:'1E40AF', align:'left', valign:'top', wrap:true,
      });
    }

    // Exercises box
    if (slide.exercises?.length > 0) {
      const exText = slide.exercises.slice(0,3).map((e,i)=>`${i+1}. ${e}`).join('\n');
      sl.addShape(pres.ShapeType.rect, {
        x:4.8, y:3.95, w:5.0, h: Math.min(1.4, 0.3*slide.exercises.length+0.3),
        fill:{ color:'F0FDF4' }, line:{ color:'A7F3D0', width:1 },
      });
      sl.addText('✍️ ' + exText, {
        x:4.9, y:4.0, w:4.8, h:1.3,
        fontSize:10, color:'15803D', align:'left', valign:'top', wrap:true,
      });
    }

    // Teacher notes (footer)
    if (slide.notes) {
      sl.addText(`💡 ${slide.notes}`, {
        x:0.2, y:5.2, w:9.5, h:0.3,
        fontSize:9, color:MUTED, italic:true,
      });
    }

    // School watermark bottom-right
    sl.addText(headerConfig.schoolName || '大卫学中文', {
      x:7, y:5.25, w:2.8, h:0.25,
      fontSize:8, color:MUTED, align:'right', transparency:50,
    });
  }

  // ── Teaching tips slide ──────────────────────────────
  if (result.teaching_tips?.length > 0) {
    const tips = pres.addSlide();
    tips.addShape(pres.ShapeType.rect, { x:0, y:0, w:0.08, h:5.63, fill:{ color:'EAB308' } });
    tips.addText('💡 ' + (result.teaching_tips.length > 0 ? '教学建议' : 'Teaching Tips'), {
      x:0.2, y:0.4, w:9, h:0.7, fontSize:24, color:DARK, bold:true,
    });
    tips.addText(result.teaching_tips.map((t,i)=>`${i+1}. ${t}`).join('\n\n'), {
      x:0.3, y:1.3, w:9.2, h:3.8,
      fontSize:14, color:DARK, align:'left', valign:'top',
      wrap:true, lineSpacingMultiple:1.5,
    });
  }

  // Save
  await pres.writeFile({ fileName: `${result.title||'PPT课件'}.pptx` });
}



/* ══════════════════════════════════════════════════════ */
/*  Quiz Form + Result                                    */
/* ══════════════════════════════════════════════════════ */
function QuizForm({ S, lbl, loading, onGenerate }) {
  const [f, setF] = useState({
    topic:'', hsk_level:3, question_count:10, difficulty:'medium',
    question_types:['multiple_choice','fill_blank'],
  });
  const types = [
    { id:'multiple_choice', label:lbl('选择题','Multiple Choice') },
    { id:'fill_blank',      label:lbl('填空题','Fill in Blank') },
    { id:'true_false',      label:lbl('判断题','True/False') },
    { id:'matching',        label:lbl('连线题','Matching') },
    { id:'short_answer',    label:lbl('简答题','Short Answer') },
  ];
  function toggleType(id) {
    setF(p => ({...p, question_types: p.question_types.includes(id)
      ? p.question_types.filter(t=>t!==id) : [...p.question_types, id]}));
  }
  return (
    <div style={S.card}>
      <h3 style={{ margin:'0 0 4px' }}>❓ {lbl('智能测验生成','AI Quiz Generator')}</h3>
      <p style={{ margin:'0 0 12px', color:'var(--text-muted)', fontSize:13 }}>
        {lbl('从知识库提取内容，生成各类测验题','Generate quizzes from knowledge base')}
      </p>
      <label style={S.lbl}>{lbl('测验主题 *','Topic *')}</label>
      <input style={S.inp} value={f.topic} onChange={e=>setF(p=>({...p,topic:e.target.value}))}
        placeholder={lbl('如：HSK2词汇、量词用法、时间表达...','e.g. HSK2 vocabulary, measure words...')}/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        <div>
          <label style={S.lbl}>HSK</label>
          <select style={S.inp} value={f.hsk_level} onChange={e=>setF(p=>({...p,hsk_level:parseInt(e.target.value)}))}>
            {HSK_LEVELS.map(l=><option key={l} value={l}>HSK {l}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>{lbl('题目数','Count')}</label>
          <select style={S.inp} value={f.question_count} onChange={e=>setF(p=>({...p,question_count:parseInt(e.target.value)}))}>
            {[5,10,15,20,30].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>{lbl('难度','Difficulty')}</label>
          <select style={S.inp} value={f.difficulty} onChange={e=>setF(p=>({...p,difficulty:e.target.value}))}>
            <option value="easy">{lbl('简单','Easy')}</option>
            <option value="medium">{lbl('中等','Medium')}</option>
            <option value="hard">{lbl('困难','Hard')}</option>
          </select>
        </div>
      </div>
      <label style={S.lbl}>{lbl('题目类型','Question Types')}</label>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {types.map(t=>(
          <label key={t.id} style={{ display:'flex', alignItems:'center', gap:4,
            padding:'4px 10px', borderRadius:8, cursor:'pointer', fontSize:12,
            background: f.question_types.includes(t.id)?'var(--primary)':'var(--background)',
            color: f.question_types.includes(t.id)?'#fff':'var(--text)',
            border:'1px solid var(--border)' }}>
            <input type="checkbox" style={{ display:'none' }}
              checked={f.question_types.includes(t.id)} onChange={()=>toggleType(t.id)}/>
            {t.label}
          </label>
        ))}
      </div>
      <button style={S.btn(!f.topic||loading||!f.question_types.length)}
        disabled={!f.topic||loading||!f.question_types.length} onClick={()=>onGenerate(f)}>
        {loading?`⏳ ${lbl('生成中...','Generating...')}`:`❓ ${lbl('生成测验','Generate Quiz')}`}
      </button>
    </div>
  );
}


/* ══════════════════════════════════════════════════════ */
/*  Chat Panel                                            */
/* ══════════════════════════════════════════════════════ */
function ChatPanel({ S, lbl, config, selKB, language, hasAIKey }) {
  const [messages, setMessages] = useState([
    { role:'assistant', content: lbl(
      '你好！我是你的中文教学 AI 助手。我已连接到知识库，可以帮你：\n• 解释语法和词汇\n• 推荐教学方法\n• 生成例句和练习\n• 回答教学相关问题\n\n有什么需要帮助的吗？',
      'Hello! I\'m your Chinese teaching AI assistant, connected to your knowledge base. I can help with grammar, vocabulary, teaching methods, and more. What do you need?'
    )}
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  async function send() {
    if (!input.trim() || loading || !hasAIKey) return;
    const userMsg = { role:'user', content:input.trim() };
    setMessages(m=>[...m, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const data = await callTeacherAI('chat', {
        messages: [...messages, userMsg].filter(m=>m.role!=='system'),
        kb_id: selKB, language,
      }, config);
      setMessages(m=>[...m, { role:'assistant', content:data.answer, kb:data.context_used }]);
    } catch(e) {
      setMessages(m=>[...m, { role:'assistant', content:`❌ ${e.message}` }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ ...S.card, display:'flex', flexDirection:'column', height:560 }}>
      <h3 style={{ margin:'0 0 12px' }}>🧞 {lbl('助手精灵','Assistant')}</h3>
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, marginBottom:12 }}>
        {messages.map((m,i)=>(
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start' }}>
            <div style={{
              maxWidth:'85%', padding:'10px 14px', borderRadius:m.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',
              background:m.role==='user'?'var(--primary)':'var(--background)',
              color:m.role==='user'?'#fff':'inherit', fontSize:13, lineHeight:1.7, whiteSpace:'pre-wrap',
            }}>
              {m.content}
              {m.kb && <div style={{ fontSize:10, marginTop:4, opacity:0.7 }}>📚 {lbl('已参考知识库','KB referenced')}</div>}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex', justifyContent:'flex-start' }}>
            <div style={{ padding:'10px 14px', borderRadius:'14px 14px 14px 4px',
              background:'var(--background)', fontSize:13 }}>
              ⏳ {lbl('思考中...','Thinking...')}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <input style={{ ...S.inp, flex:1 }} value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
          placeholder={hasAIKey ? lbl('输入问题，按 Enter 发送...','Type a question, press Enter...')
            : lbl('请先配置 AI API Key','Please configure AI API Key first')}
          disabled={!hasAIKey || loading}/>
        <button onClick={send} disabled={!input.trim()||loading||!hasAIKey}
          style={{ padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer',
            background:'var(--primary)', color:'#fff', fontWeight:600, fontSize:13,
            opacity:(!input.trim()||loading||!hasAIKey)?0.5:1 }}>
          {lbl('发送','Send')}
        </button>
      </div>
      {!hasAIKey && (
        <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>
          ⚠️ {lbl('请先在知识库 → AI设置 里配置 API Key','Configure API Key in Knowledge Base → Settings')}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  Q&A Form + Result                                     */
/* ══════════════════════════════════════════════════════ */
function QAForm({ S, lbl, loading, onGenerate }) {
  const [f, setF] = useState({ question:'', hsk_level:3 });
  const suggestions = [
    lbl('比较句"比"的用法是什么？','What is the usage of 比 in comparison sentences?'),
    lbl('"了"和"过"有什么区别？','What is the difference between 了 and 过?'),
    lbl('如何教 HSK2 的量词？','How to teach HSK2 measure words?'),
    lbl('讲解声调的最佳方法是什么？','What is the best way to teach tones?'),
  ];
  return (
    <div style={S.card}>
      <h3 style={{ margin:'0 0 4px' }}>🔍 {lbl('问答助手','Q&A Assistant')}</h3>
      <p style={{ margin:'0 0 12px', color:'var(--text-muted)', fontSize:13 }}>
        {lbl('基于知识库回答教学问题','Answer teaching questions using knowledge base')}
      </p>
      <label style={S.lbl}>{lbl('你的问题 *','Your Question *')}</label>
      <textarea style={{ ...S.inp, height:100, resize:'vertical' }}
        value={f.question} onChange={e=>setF(p=>({...p,question:e.target.value}))}
        placeholder={lbl('输入教学相关问题...','Enter your teaching question...')}/>
      <label style={S.lbl}>{lbl('学生水平','Student Level')}</label>
      <select style={S.inp} value={f.hsk_level} onChange={e=>setF(p=>({...p,hsk_level:parseInt(e.target.value)}))}>
        {HSK_LEVELS.map(l=><option key={l} value={l}>HSK {l}</option>)}
      </select>
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
          {lbl('💡 常见问题','💡 Suggestions')}:
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {suggestions.map((s,i)=>(
            <button key={i} onClick={()=>setF(p=>({...p,question:s}))}
              style={{ textAlign:'left', padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)',
                background:'var(--background)', cursor:'pointer', fontSize:12, color:'var(--primary)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <button style={S.btn(!f.question||loading)} disabled={!f.question||loading}
        onClick={()=>onGenerate(f)}>
        {loading?`⏳ ${lbl('搜索中...','Searching...')}`:`🔍 ${lbl('获取答案','Get Answer')}`}
      </button>
    </div>
  );
}


/* ══════════════════════════════════════════════════════ */
/*  Worksheet Form + Result                               */
/* ══════════════════════════════════════════════════════ */
function WorksheetForm({ S, lbl, loading, onGenerate }) {
  const [f, setF] = useState({ topic:'', hsk_level:3, exercise_count:10,
    include_answers:true, worksheet_type:'vocabulary' });
  return (
    <div style={S.card}>
      <h3 style={{ margin:'0 0 4px' }}>📝 {lbl('练习册生成','Worksheet Generator')}</h3>
      <p style={{ margin:'0 0 12px', color:'var(--text-muted)', fontSize:13 }}>
        {lbl('生成词汇、语法、阅读练习题','Generate vocabulary, grammar, reading exercises')}
      </p>
      <label style={S.lbl}>{lbl('主题 *','Topic *')}</label>
      <input style={S.inp} value={f.topic} onChange={e=>setF(p=>({...p,topic:e.target.value}))}
        placeholder={lbl('如：HSK1词汇、方向词、时间表达...','e.g. HSK1 vocabulary, directional words...')}/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <label style={S.lbl}>HSK</label>
          <select style={S.inp} value={f.hsk_level} onChange={e=>setF(p=>({...p,hsk_level:parseInt(e.target.value)}))}>
            {HSK_LEVELS.map(l=><option key={l} value={l}>HSK {l}</option>)}
          </select>
        </div>
        <div>
          <label style={S.lbl}>{lbl('练习数量','Exercises')}</label>
          <select style={S.inp} value={f.exercise_count} onChange={e=>setF(p=>({...p,exercise_count:parseInt(e.target.value)}))}>
            {[5,10,15,20].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <label style={S.lbl}>{lbl('练习类型','Worksheet Type')}</label>
      <select style={S.inp} value={f.worksheet_type} onChange={e=>setF(p=>({...p,worksheet_type:e.target.value}))}>
        <option value="vocabulary">{lbl('词汇练习','Vocabulary')}</option>
        <option value="grammar">{lbl('语法练习','Grammar')}</option>
        <option value="reading">{lbl('阅读理解','Reading')}</option>
        <option value="writing">{lbl('写作练习','Writing')}</option>
        <option value="mixed">{lbl('综合练习','Mixed')}</option>
      </select>
      <label style={{ ...S.lbl, display:'flex', alignItems:'center', gap:6, marginTop:12 }}>
        <input type="checkbox" checked={f.include_answers}
          onChange={e=>setF(p=>({...p,include_answers:e.target.checked}))}/>
        {lbl('包含答案','Include Answers')}
      </label>
      <button style={S.btn(!f.topic||loading)} disabled={!f.topic||loading}
        onClick={()=>onGenerate(f)}>
        {loading?`⏳ ${lbl('生成中...','Generating...')}`:`📝 ${lbl('生成练习册','Generate Worksheet')}`}
      </button>
    </div>
  );
}

function WorksheetResult({ result, lbl }) {
  return (
    <div>
      <h3 style={{ marginBottom:'0.75rem' }}>{result.title || lbl('练习册','Worksheet')}</h3>
      {result.instructions && (
        <p style={{ color:'var(--text-muted)', fontSize:13, marginBottom:'1rem' }}>{result.instructions}</p>
      )}
      {(result.sections||[]).map((sec,i)=>(
        <div key={i} style={{ background:'var(--card)', border:'1px solid var(--border)',
          borderRadius:12, padding:'1rem', marginBottom:'0.75rem' }}>
          <h4 style={{ margin:'0 0 6px' }}>{sec.name}</h4>
          {sec.instructions && <p style={{ fontSize:12, color:'var(--text-muted)', margin:'0 0 8px' }}>{sec.instructions}</p>}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {(sec.exercises||[]).map((ex,j)=>(
              <div key={j} style={{ padding:'8px 10px', background:'var(--background)', borderRadius:8, fontSize:13 }}>
                <strong>{j+1}.</strong> {ex.question}
                {ex.hint && <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:8 }}>({ex.hint})</span>}
                {ex.answer && (
                  <div style={{ marginTop:4, fontSize:12, color:'#16a34a' }}>→ {ex.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {result.raw && (
        <pre style={{ fontSize:11, background:'var(--background)', padding:12, borderRadius:8,
          overflow:'auto', maxHeight:400, whiteSpace:'pre-wrap' }}>{result.raw}</pre>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Shared: Header builder for print/download
   ══════════════════════════════════════════════════════ */

function buildHeaderHTML(headerConfig, pandaImg) {
  const schoolName = headerConfig.schoolName || '大卫学中文';
  const className  = headerConfig.className  || '';
  const teacherName= headerConfig.teacherName|| '';
  const semester   = headerConfig.semester   || '';
  const logoUrl    = pandaImg?.image_url || '';

  return `
  <div style="display:flex;align-items:center;gap:16px;padding:16px 24px 12px;
    border-bottom:3px solid #c41e3a;margin-bottom:20px;background:#fff;">
    ${logoUrl ? `<img src="${logoUrl}" style="width:56px;height:56px;object-fit:contain;flex-shrink:0;" alt="panda"/>` : '<span style="font-size:44px">🐼</span>'}
    <div style="flex:1">
      <div style="font-size:20px;font-weight:700;color:#c41e3a;font-family:'Noto Sans SC',sans-serif">${schoolName}</div>
      <div style="display:flex;gap:16px;font-size:12px;color:#666;margin-top:3px">
        ${className   ? `<span>班级：${className}</span>`   : ''}
        ${teacherName ? `<span>教师：${teacherName}</span>` : ''}
        ${semester    ? `<span>学期：${semester}</span>`    : ''}
        <span>日期：${new Date().toLocaleDateString('zh-CN')}</span>
      </div>
    </div>
    ${headerConfig.customText ? `<div style="font-size:12px;color:#666;text-align:right;white-space:pre-line">${headerConfig.customText}</div>` : ''}
  </div>`;
}

const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Noto Sans SC',sans-serif;color:#111;background:#fff;padding:0}
  @media print{body{padding:0} .no-print{display:none!important} @page{margin:1.5cm}}
`;

/* ══════════════════════════════════════════════════════
   Header Edit Modal
   ══════════════════════════════════════════════════════ */

function HeaderEditModal({ config, pandaImg, supabase, lbl, onSave, onClose }) {
  const [f, setF] = useState({
    schoolName:  config.schoolName  || '大卫学中文',
    className:   config.className   || '',
    teacherName: config.teacherName || '',
    semester:    config.semester    || '',
    customText:  config.customText  || '',
    pandaEmotion:config.pandaEmotion|| '',
  });
  const [pandas, setPandas] = useState([]);
  const [selPanda, setSelPanda] = useState(pandaImg);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('dwxz_panda_assets').select('image_url,label,emotion')
      .not('image_url','is',null).limit(20)
      .then(({ data }) => setPandas(data||[]));
  }, [supabase]);

  const inp = { width:'100%', padding:'7px 10px', borderRadius:7,
    border:'1px solid var(--border)', fontSize:13, background:'var(--background)', marginTop:3 };
  const lbl2 = { fontSize:11, color:'var(--text-muted)', display:'block', marginTop:10 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--card)', borderRadius:16, padding:'1.5rem',
        width:480, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1rem' }}>
          <h3 style={{ margin:0 }}>🖊️ {lbl('设计表头','Design Header')}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20 }}>✕</button>
        </div>

        {/* Preview */}
        <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:'1rem' }}>
          <div dangerouslySetInnerHTML={{ __html: buildHeaderHTML(f, selPanda) }}/>
        </div>

        {/* Fields */}
        <label style={lbl2}>{lbl('学校/机构名称','School Name')}</label>
        <input style={inp} value={f.schoolName} onChange={e=>setF(p=>({...p,schoolName:e.target.value}))}/>

        <label style={lbl2}>{lbl('班级','Class')}</label>
        <input style={inp} value={f.className} onChange={e=>setF(p=>({...p,className:e.target.value}))}
          placeholder={lbl('如：华裔班A班','e.g. Class A')}/>

        <label style={lbl2}>{lbl('教师姓名','Teacher Name')}</label>
        <input style={inp} value={f.teacherName} onChange={e=>setF(p=>({...p,teacherName:e.target.value}))}/>

        <label style={lbl2}>{lbl('学期','Semester')}</label>
        <input style={inp} value={f.semester} onChange={e=>setF(p=>({...p,semester:e.target.value}))}
          placeholder={lbl('如：2025-2026 上学期','e.g. 2025-2026 Spring')}/>

        <label style={lbl2}>{lbl('自定义文字（右侧）','Custom Text (right)')}</label>
        <textarea style={{ ...inp, height:60, resize:'vertical' }}
          value={f.customText} onChange={e=>setF(p=>({...p,customText:e.target.value}))}
          placeholder={lbl('如：内部资料，请勿外传','e.g. Internal use only')}/>

        {/* Panda picker */}
        <label style={lbl2}>🐼 {lbl('选择熊猫图标','Choose Panda Icon')}</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
          {pandas.map(p=>(
            <img key={p.emotion} src={p.image_url} alt={p.emotion}
              onClick={()=>{ setSelPanda(p); setF(prev=>({...prev,pandaEmotion:p.emotion})); }}
              style={{ width:44, height:44, objectFit:'contain', cursor:'pointer',
                borderRadius:8, border:selPanda?.emotion===p.emotion?'2px solid var(--primary)':'2px solid transparent',
                background:'var(--background)' }}/>
          ))}
        </div>

        <div style={{ display:'flex', gap:8, marginTop:'1rem' }}>
          <button onClick={()=>onSave({...f})}
            style={{ flex:1, padding:'10px', borderRadius:8, border:'none', cursor:'pointer',
              background:'var(--primary)', color:'#fff', fontWeight:700 }}>
            ✅ {lbl('保存表头','Save Header')}
          </button>
          <button onClick={onClose}
            style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid var(--border)',
              background:'none', cursor:'pointer' }}>
            {lbl('取消','Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PPT Result with download
   ══════════════════════════════════════════════════════ */

function PPTResult({ result, lbl, headerConfig = {}, pandaImg, onEditHeader }) {
  const [images, setImages] = useState({});
  const [imgLoading, setImgLoading] = useState({});
  const [imgProvider, setImgProvider] = useState('stability');
  const [expanded, setExpanded] = useState({});

  const typeColors = { title:'#c41e3a', vocabulary:'#1d4ed8', grammar:'#7c3aed',
    dialogue:'#065f46', culture:'#92400e', exercise:'#0891b2', summary:'#374151' };

  async function generateSlideImage(slide, provider='stability') {
    if (!slide.image_prompt || images[slide.index] || imgLoading[slide.index]) return;
    setImgLoading(p=>({...p,[slide.index]:true}));
    try {
      const key = localStorage.getItem(`admin_key_${provider}`) || '';
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'generate_word_image', word_zh:slide.title,
          meaning_en: slide.image_prompt+', educational illustration, flat design, Chinese classroom, no text',
          provider, client_key:key,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const url = data.url||(data.base64?`data:image/png;base64,${data.base64}`:null);
      if (url) setImages(p=>({...p,[slide.index]:url}));
    } catch(e) { setImages(p=>({...p,[slide.index]:'error:'+e.message})); }
    setImgLoading(p=>({...p,[slide.index]:false}));
  }

  useEffect(() => {
    if (!result.include_illustrations) return;
    (result.slides||[]).forEach((s,i) => {
      if (s.image_prompt) setTimeout(()=>generateSlideImage(s,imgProvider), i*2500);
    });
  }, [result]);

  function downloadPPT() {
    const header = buildHeaderHTML(headerConfig, pandaImg);
    const slidesHTML = (result.slides||[]).map((slide, i) => {
      const color = typeColors[slide.type]||'#374151';
      const imgSrc = images?.[slide.index];
      const imgHtml = imgSrc&&!imgSrc.startsWith('error:')
        ? `<img src="${imgSrc}" style="float:right;width:160px;height:100px;object-fit:cover;border-radius:8px;margin:0 0 10px 12px">`
        : '';
      return `
      <div style="page-break-before:${i===0?'auto':'always'};padding:24px 32px;min-height:500px;border-left:5px solid ${color}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
          <span style="background:${color};color:#fff;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700">${slide.index}. ${slide.type.toUpperCase()}</span>
          <h2 style="margin:0;font-size:19px">${slide.title}</h2>
        </div>
        ${imgHtml}
        <div style="font-size:14px;line-height:1.9;white-space:pre-wrap">${slide.content}</div>
        ${(slide.vocabulary||[]).length>0?`<div style="background:#eff6ff;border-radius:6px;padding:8px 12px;margin-top:10px;font-size:12px"><b>📝 词汇</b><br>${slide.vocabulary.join('<br>')}</div>`:''}
        ${(slide.exercises||[]).length>0?`<div style="background:#f0fdf4;border-radius:6px;padding:8px 12px;margin-top:8px;font-size:12px"><b>✍️ 练习</b><br>${slide.exercises.map((e,j)=>`${j+1}. ${e}`).join('<br>')}</div>`:''}
        ${slide.notes?`<div style="margin-top:8px;font-size:11px;color:#6b7280;font-style:italic">💡 ${slide.notes}</div>`:''}
      </div>`;
    }).join('<hr style="border:none;border-top:1px solid #e5e7eb;margin:0">');

    const html = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8">
      <title>${result.title||'PPT课件'}</title>
      <style>${PRINT_STYLES}
        .cover{background:linear-gradient(135deg,#c41e3a,#8B1A1A);color:#fff;padding:48px 32px;text-align:center}
        .cover h1{font-size:28px;margin-bottom:8px}
        .cover .meta{font-size:13px;opacity:.8}
        .tips{background:#fefce8;padding:20px 32px;border-left:4px solid #eab308}
      </style></head><body>
      ${header}
      <div class="cover">
        <h1>${result.title||'PPT课件'}</h1>
        <div class="meta">${result.estimated_duration||''}</div>
      </div>
      ${slidesHTML}
      ${result.teaching_tips?.length>0?`<div class="tips"><b>💡 教学建议</b><ul>${result.teaching_tips.map(t=>`<li style="font-size:13px;margin-top:4px">${t}</li>`).join('')}</ul></div>`:''}
    </body></html>`;

    const blob = new Blob([html], { type:'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${result.title||'PPT课件'}.html`;
    a.click();
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        marginBottom:'0.75rem', flexWrap:'wrap', gap:6 }}>
        <h3 style={{ margin:0 }}>{result.title||lbl('PPT大纲','PPT')}</h3>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          {result.context_used&&<span style={{ fontSize:11,padding:'2px 8px',borderRadius:12,background:'#dbeafe',color:'#1d4ed8' }}>📚 {lbl('知识库','KB')}</span>}
          <span style={{ fontSize:11,padding:'2px 8px',borderRadius:12,background:'#f3f4f6',color:'#374151' }}>
            {result.estimated_duration}
          </span>
          <select value={imgProvider} onChange={e=>setImgProvider(e.target.value)}
            style={{ padding:'3px 8px',borderRadius:8,border:'1px solid var(--border)',fontSize:11,background:'var(--background)' }}>
            <option value="stability">🎨 Stability AI</option>
            <option value="openai">🟢 DALL-E 3</option>
            <option value="ideogram">💠 Ideogram</option>
          </select>
          {result.include_illustrations&&(
            <button onClick={()=>(result.slides||[]).filter(s=>s.image_prompt).forEach((s,i)=>setTimeout(()=>generateSlideImage(s,imgProvider),i*2500))}
              style={{ padding:'4px 10px',borderRadius:8,border:'none',cursor:'pointer',background:'#7c3aed',color:'#fff',fontSize:11,fontWeight:600 }}>
              🖼️ {lbl('生成配图','Images')}
            </button>
          )}
          <button onClick={onEditHeader}
            style={{ padding:'4px 10px',borderRadius:8,border:'1px solid var(--border)',background:'none',cursor:'pointer',fontSize:11 }}>
            🖊️ {lbl('表头','Header')}
          </button>
          <button onClick={downloadPPT}
            style={{ padding:'4px 10px',borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',background:'none',fontSize:11 }}>
            ⬇️ HTML
          </button>
          <button onClick={()=>downloadAsPPTX(result,images,headerConfig,pandaImg)}
            style={{ padding:'4px 12px',borderRadius:8,border:'none',cursor:'pointer',background:'var(--primary)',color:'#fff',fontSize:12,fontWeight:600 }}>
            ⬇️ .pptx
          </button>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {(result.slides||[]).map((slide,i)=>{
          const color=typeColors[slide.type]||'#9ca3af';
          return (
            <div key={i} style={{ background:'var(--card)',border:'1px solid var(--border)',
              borderLeft:`4px solid ${color}`,borderRadius:10,overflow:'hidden' }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'10px 14px',cursor:'pointer' }}
                onClick={()=>setExpanded(p=>({...p,[i]:!p[i]}))}>
                <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                  <strong style={{ fontSize:13 }}>{slide.index}. {slide.title}</strong>
                  <span style={{ fontSize:10,padding:'1px 6px',borderRadius:8,background:`${color}20`,color }}>{slide.type}</span>
                </div>
                <span style={{ fontSize:11,color:'var(--text-muted)' }}>{expanded[i]===false?'▼':'▲'}</span>
              </div>
              {slide.image_prompt&&(
                <div style={{ padding:'0 14px 8px',display:'flex',alignItems:'center',gap:10 }}>
                  {images[slide.index]&&!images[slide.index].startsWith('error:')?(
                    <img src={images[slide.index]} alt={slide.title}
                      style={{ width:110,height:75,objectFit:'cover',borderRadius:7,border:'1px solid var(--border)' }}/>
                  ):imgLoading[slide.index]?(
                    <div style={{ width:110,height:75,borderRadius:7,background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'var(--text-muted)' }}>⏳</div>
                  ):(
                    <button onClick={()=>generateSlideImage(slide,imgProvider)}
                      style={{ width:110,height:75,borderRadius:7,border:'2px dashed var(--border)',background:'var(--background)',cursor:'pointer',fontSize:11,color:'var(--text-muted)' }}>
                      🖼️ {lbl('生成配图','Gen')}
                    </button>
                  )}
                  {images[slide.index]?.startsWith('error:')&&(
                    <button onClick={()=>{setImages(p=>({...p,[slide.index]:undefined}));generateSlideImage(slide,imgProvider);}}
                      style={{ width:110,height:75,borderRadius:7,border:'1px solid #fca5a5',background:'#fee2e2',cursor:'pointer',fontSize:10,color:'#991b1b' }}>
                      ⚠️ {lbl('重试','Retry')}
                    </button>
                  )}
                </div>
              )}
              {expanded[i]!==false&&(
                <div style={{ padding:'0 14px 12px' }}>
                  <div style={{ fontSize:12,color:'var(--text-muted)',whiteSpace:'pre-wrap',lineHeight:1.7,background:'var(--background)',borderRadius:8,padding:'8px 10px',marginBottom:6 }}>{slide.content}</div>
                  {slide.vocabulary?.length>0&&<div style={{ padding:'6px 8px',background:'#eff6ff',borderRadius:6,marginBottom:4 }}><div style={{ fontSize:10,color:'#1d4ed8',fontWeight:600,marginBottom:3 }}>📝 {lbl('词汇','Vocab')}</div>{slide.vocabulary.map((v,j)=><div key={j} style={{ fontSize:11,color:'#1e40af' }}>{v}</div>)}</div>}
                  {slide.exercises?.length>0&&<div style={{ padding:'6px 8px',background:'#f0fdf4',borderRadius:6,marginBottom:4 }}><div style={{ fontSize:10,color:'#16a34a',fontWeight:600,marginBottom:3 }}>✍️ {lbl('练习','Ex')}</div>{slide.exercises.map((e,j)=><div key={j} style={{ fontSize:11,color:'#15803d' }}>{j+1}. {e}</div>)}</div>}
                  {slide.notes&&<div style={{ fontSize:11,color:'#6b7280',fontStyle:'italic' }}>💡 {slide.notes}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {result.teaching_tips?.length>0&&(
        <div style={{ marginTop:'1rem',background:'#fefce8',border:'1px solid #fef08a',borderRadius:10,padding:'12px 14px' }}>
          <strong style={{ fontSize:13 }}>💡 {lbl('教学建议','Tips')}</strong>
          {result.teaching_tips.map((t,i)=><div key={i} style={{ fontSize:12,color:'#713f12',marginTop:4 }}>• {t}</div>)}
        </div>
      )}
      {result.raw&&<pre style={{ fontSize:11,background:'var(--background)',padding:12,borderRadius:8,overflow:'auto',maxHeight:300,whiteSpace:'pre-wrap',marginTop:'1rem' }}>{result.raw}</pre>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Quiz Result with print
   ══════════════════════════════════════════════════════ */

function QuizResult({ result, lbl, headerConfig={}, pandaImg, onEditHeader }) {
  const [showAnswers, setShowAnswers] = useState(false);
  const typeLabel = { multiple_choice:lbl('选择','MC'), fill_blank:lbl('填空','Fill'),
    true_false:lbl('判断','T/F'), matching:lbl('连线','Match'), short_answer:lbl('简答','SA') };

  function printQuiz(withAnswers) {
    const header = buildHeaderHTML(headerConfig, pandaImg);
    const qs = (result.questions||[]).map((q,i) => `
      <div style="margin-bottom:18px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:8px;page-break-inside:avoid">
        <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
          <span style="background:#c41e3a;color:#fff;border-radius:5px;padding:1px 7px;font-size:11px;font-weight:700;flex-shrink:0">${i+1}</span>
          <span style="font-size:11px;padding:1px 6px;border-radius:5px;background:#f3f4f6;color:#374151;flex-shrink:0">${typeLabel[q.type]||q.type}</span>
          <strong style="font-size:14px">${q.question}</strong>
          <span style="margin-left:auto;font-size:11px;color:#9ca3af">${q.points||10}分</span>
        </div>
        ${q.options?.length>0?`<div style="margin-left:16px">${q.options.map((opt,j)=>`
          <div style="padding:4px 8px;border-radius:5px;font-size:13px;margin-bottom:3px;
            background:${withAnswers&&q.answer===opt[0]?'#d1fae5':'transparent'};
            color:${withAnswers&&q.answer===opt[0]?'#065f46':'inherit'}">${opt}</div>`).join('')}</div>`:''}
        ${withAnswers?`<div style="margin-top:8px;padding:6px 10px;background:#f0fdf4;border-radius:6px;font-size:12px">
          <b style="color:#16a34a">✅ 答案：${q.answer}</b>
          ${q.explanation?`<div style="color:#15803d;margin-top:3px">💡 ${q.explanation}</div>`:''}
        </div>`:`<div style="margin-top:10px;border-bottom:1px solid #e5e7eb;padding-bottom:6px"></div>`}
      </div>`).join('');

    const html = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8">
      <title>${result.title||'测验'}</title>
      <style>${PRINT_STYLES}</style></head><body>
      ${header}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0 24px 12px">
        <div>
          <h2 style="margin:0;font-size:18px">${result.title||lbl('测验题目','Quiz')}</h2>
          <div style="font-size:12px;color:#666;margin-top:3px">
            ${result.questions?.length||0}题 · ${result.total_points||100}分
            ${withAnswers?' · 答案版':''}
          </div>
        </div>
        <div style="font-size:12px;color:#666">
          姓名：___________  得分：___________
        </div>
      </div>
      <div style="padding:0 24px 24px">${qs}</div>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.75rem',flexWrap:'wrap',gap:6 }}>
        <h3 style={{ margin:0 }}>{result.title||lbl('测验题目','Quiz')}</h3>
        <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
          {result.context_used&&<span style={{ fontSize:11,padding:'2px 8px',borderRadius:12,background:'#dbeafe',color:'#1d4ed8' }}>📚 {lbl('知识库','KB')}</span>}
          <button onClick={()=>setShowAnswers(a=>!a)}
            style={{ padding:'4px 10px',borderRadius:8,border:'1px solid var(--border)',background:'none',cursor:'pointer',fontSize:11 }}>
            {showAnswers?lbl('隐藏答案','Hide Ans'):lbl('显示答案','Show Ans')}
          </button>
          <button onClick={onEditHeader}
            style={{ padding:'4px 10px',borderRadius:8,border:'1px solid var(--border)',background:'none',cursor:'pointer',fontSize:11 }}>
            🖊️ {lbl('表头','Header')}
          </button>
          <button onClick={()=>printQuiz(false)}
            style={{ padding:'4px 10px',borderRadius:8,border:'none',cursor:'pointer',background:'#2563eb',color:'#fff',fontSize:11,fontWeight:600 }}>
            🖨️ {lbl('打印题目','Print')}
          </button>
          <button onClick={()=>printQuiz(true)}
            style={{ padding:'4px 10px',borderRadius:8,border:'none',cursor:'pointer',background:'var(--primary)',color:'#fff',fontSize:11,fontWeight:600 }}>
            🖨️ {lbl('打印答案版','Print + Ans')}
          </button>
        </div>
      </div>

      <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
        {(result.questions||[]).map((q,i)=>(
          <div key={i} style={{ background:'var(--card)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px' }}>
            <div style={{ display:'flex',gap:8,alignItems:'flex-start',marginBottom:8 }}>
              <span style={{ background:'var(--primary)',color:'#fff',borderRadius:6,fontSize:11,padding:'2px 7px',fontWeight:700,flexShrink:0 }}>{i+1}</span>
              <span style={{ fontSize:11,padding:'2px 6px',borderRadius:6,background:'#f3f4f6',color:'#374151',flexShrink:0 }}>{typeLabel[q.type]||q.type}</span>
              <strong style={{ fontSize:13 }}>{q.question}</strong>
            </div>
            {q.options?.length>0&&(
              <div style={{ marginLeft:16,display:'flex',flexDirection:'column',gap:3 }}>
                {q.options.map((opt,j)=>(
                  <div key={j} style={{ fontSize:12,padding:'3px 6px',borderRadius:6,
                    background:showAnswers&&q.answer===opt[0]?'#d1fae5':'transparent',
                    color:showAnswers&&q.answer===opt[0]?'#065f46':'inherit' }}>{opt}</div>
                ))}
              </div>
            )}
            {showAnswers&&(
              <div style={{ marginTop:8,padding:'6px 10px',background:'#f0fdf4',borderRadius:8,fontSize:12 }}>
                <strong style={{ color:'#16a34a' }}>✅ {lbl('答案','Ans')}:</strong> {q.answer}
                {q.explanation&&<div style={{ marginTop:3,color:'#15803d' }}>💡 {q.explanation}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   QA Result
   ══════════════════════════════════════════════════════ */

function QAResult({ result, lbl }) {
  return (
    <div style={{ background:'var(--card)',border:'1px solid var(--border)',borderRadius:14,padding:'1.25rem' }}>
      <h3 style={{ margin:'0 0 12px' }}>💡 {lbl('回答','Answer')}</h3>
      <div style={{ background:'var(--background)',borderRadius:10,padding:'1rem',fontSize:13,lineHeight:1.9,whiteSpace:'pre-wrap' }}>
        {result.answer}
      </div>
    </div>
  );
}

