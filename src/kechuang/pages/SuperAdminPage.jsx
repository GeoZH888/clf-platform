// src/pages/SuperAdminPage.jsx
// 超级管理员面板 — 精简高效版
// Tabs: 系统概览 | 用户与访问 | 知识库监控 | 系统配置 | 🐼 Panda Studio

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import PandaStudio from '../components/PandaStudio';

const C = {
  primary: '#c41e3a', success: '#16a34a', warning: '#d97706',
  error: '#dc2626', info: '#2563eb', muted: 'var(--text-muted)',
};

export default function SuperAdminPage() {
  const { user, supabase } = useAuth();
  const location = useLocation();
  const urlTab = new URLSearchParams(location.search).get('tab');
  const { language } = useLanguage();
  const [tab,       setTab]       = useState(urlTab || 'overview');
  const [stats,     setStats]     = useState({});
  const [users,     setUsers]     = useState([]);
  const [kbStats,   setKbStats]   = useState([]);
  const [pipeline,  setPipeline]  = useState(null);
  const [ragConfig, setRagConfig] = useState({});
  const [aiSettings,setAiSettings]= useState({});
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [msg,       setMsg]       = useState('');

  const lbl = (zh, en) => language === 'zh' ? zh : en;

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab');
    if (t) setTab(t);
  }, [location.search]);

  /* ── Load data per tab ── */
  useEffect(() => {
    if (!supabase) return;
    if (tab === 'overview') loadOverview();
    if (tab === 'users')    loadUsers();
    if (tab === 'kb')       loadKB();
    if (tab === 'config')   loadConfig();
  }, [tab, supabase]);

  async function loadOverview() {
    setLoading(true);
    const [u, t, s, cl, mat, chunks] = await Promise.all([
      supabase.from('dwxz_users_view').select('id', { count:'exact', head:true }),
      supabase.from('dwxz_users_view').select('id', { count:'exact', head:true }).eq('role','teacher'),
      supabase.from('dwxz_users_view').select('id', { count:'exact', head:true }).eq('role','student'),
      supabase.from('dwxz_classes').select('id', { count:'exact', head:true }).eq('is_active',true),
      supabase.from('dwxz_knowledge_materials').select('id,status', { count:'exact' }).limit(1),
      supabase.from('dwxz_rag_chunks').select('id', { count:'exact', head:true }),
    ]);
    setStats({
      users:    u.count || 0,
      teachers: t.count || 0,
      students: s.count || 0,
      classes:  cl.count || 0,
      materials: mat.count || 0,
      chunks:   chunks.count || 0,
    });
    setLoading(false);
  }

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase.from('dwxz_users_view').select('*').order('created_at',{ascending:false}).limit(100);
    setUsers(data || []);
    setLoading(false);
  }

  async function loadKB() {
    setLoading(true);
    // KB overview: materials per teacher, embedding status, recent uploads
    const { data: materials } = await supabase
      .from('dwxz_knowledge_materials')
      .select('id,title_zh,file_name,file_type,category,status,chunk_count,ai_classify_confidence,ai_classify_method,created_at,uploaded_by')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: kbs } = await supabase
      .from('dwxz_rag_knowledge_bases')
      .select('id,name,name_zh,created_at');

    // Check embedding pipeline health
    const { data: pendingMats } = await supabase
      .from('dwxz_knowledge_materials')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'processing');

    const { data: completedMats } = await supabase
      .from('dwxz_knowledge_materials')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed');

    const { data: rc } = await supabase.from('dwxz_rag_config').select('*').limit(1).maybeSingle();

    setPipeline({
      total:     (materials || []).length,
      pending:   pendingMats?.count || pendingMats?.length || 0,
      completed: completedMats?.count || completedMats?.length || 0,
      kbs:       kbs || [],
      materials: materials || [],
      embProvider: rc?.embedding_provider || 'not configured',
      embModel:    rc?.embedding_model    || 'not configured',
      aiProvider:  rc?.ai_provider        || 'not configured',
      hasEmbKey:   !!(rc?.embedding_api_key),
      hasAiKey:    !!(rc?.[`${rc.ai_provider||'openai'}_api_key`]),
    });
    setLoading(false);
  }

  async function loadConfig() {
    setLoading(true);
    const { data: rc } = await supabase.from('dwxz_rag_config').select('*').limit(1).maybeSingle();
    setRagConfig(rc || {});
    const { data: ss } = await supabase.from('dwxz_system_settings').select('*').eq('category','ai');
    const settings = {};
    (ss || []).forEach(s => { settings[s.setting_key] = s.setting_value; });
    setAiSettings(settings);
    setLoading(false);
  }

  /* ── Re-process stuck materials ── */
  async function reprocessPending() {
    if (!supabase) return;
    const { data } = await supabase.from('dwxz_knowledge_materials')
      .select('id').eq('status','processing').limit(10);
    if (!data?.length) { setMsg(lbl('没有待处理文件','No pending files')); return; }
    setMsg(lbl(`重新触发 ${data.length} 个文件...`,`Retrying ${data.length} files...`));
    // Reset to uploaded so they get re-processed
    await supabase.from('dwxz_knowledge_materials')
      .update({ status: 'uploaded' })
      .in('id', data.map(d=>d.id));
    setTimeout(() => setMsg(''), 3000);
  }

  /* ── Approve user ── */
  async function updateUserRole(userId, role) {
    await supabase.from('dwxz_users_view').update({ role, updated_at: new Date().toISOString() }).eq('id', userId);
    setUsers(u => u.map(x => x.id === userId ? { ...x, role } : x));
  }

  async function toggleUserActive(userId, active) {
    await supabase.from('dwxz_users_view').update({ is_active: active }).eq('id', userId);
    setUsers(u => u.map(x => x.id === userId ? { ...x, is_active: active } : x));
  }

  /* ── Save unified config ── */
  async function saveConfig() {
    setSaving(true);
    try {
      // Save system_settings
      for (const [key, value] of Object.entries(aiSettings)) {
        await supabase.from('dwxz_system_settings').upsert({
          setting_key: key, setting_value: String(value),
          category: 'ai', updated_at: new Date().toISOString(), updated_by: user?.id,
        }, { onConflict: 'setting_key' });
      }
      // Save rag_config
      const payload = { ...ragConfig, updated_at: new Date().toISOString() };
      delete payload.id;
      if (ragConfig.id) {
        await supabase.from('dwxz_rag_config').update(payload).eq('id', ragConfig.id);
      } else {
        const { data } = await supabase.from('dwxz_rag_config').insert([payload]).select().single();
        if (data) setRagConfig(c => ({ ...c, id: data.id }));
      }
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch(e) { setMsg('保存失败: ' + e.message); }
    finally { setSaving(false); }
  }

  const updateRag = (k, v) => setRagConfig(p => ({ ...p, [k]: v }));

  /* ── Styles ── */
  const S = {
    card: { background:'var(--card)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem', marginBottom:'1rem' },
    inp:  { width:'100%', padding:'8px 12px', borderRadius:8, border:'1px solid var(--border)', fontSize:13, background:'var(--background)', boxSizing:'border-box' },
    lbl:  { fontSize:12, color:C.muted, display:'block', marginBottom:4, marginTop:12 },
    tabBtn: (a) => ({ padding:'8px 18px', border:'none', background:'none', cursor:'pointer',
      fontSize:13, fontWeight:600, borderBottom: a?`2px solid ${C.primary}`:'none',
      color: a?C.primary:C.muted, whiteSpace:'nowrap' }),
    badge: (color, bg) => ({ padding:'2px 8px', borderRadius:12, fontSize:11, fontWeight:600, color, background:bg }),
  };

  const TABS = [
    { id:'overview', icon:'📊', label:lbl('系统概览','Overview') },
    { id:'users',    icon:'👥', label:lbl('用户与访问','Users & Access') },
    { id:'kb',       icon:'🧠', label:lbl('知识库监控','KB Monitor') },
    { id:'config',   icon:'⚙️', label:lbl('系统配置','Config') },
    { id:'panda',    icon:'🐼', label:'Panda Studio' },
  ];

  const roleColor = { super_admin:'#c41e3a', teacher:'#2563eb', student:'#16a34a', parent:'#d97706' };

  return (
    <div>
      <div className="content-header">
        <h1>👑 {lbl('超级管理员','Super Admin')}</h1>
      </div>

      {msg && <div style={{ padding:'8px 14px', borderRadius:8, marginBottom:'1rem',
        background:'#fef3c7', color:'#92400e', fontSize:13 }}>{msg}</div>}

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, borderBottom:`2px solid var(--border)`,
        marginBottom:'1.25rem', overflowX:'auto' }}>
        {TABS.map(t=>(
          <button key={t.id} style={S.tabBtn(tab===t.id)} onClick={()=>setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══ */}
      {tab === 'overview' && (
        <div>
          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'0.75rem', marginBottom:'1.25rem' }}>
            {[
              { icon:'👥', val:stats.users,     label:lbl('总用户','Users'),     color:C.primary },
              { icon:'👩‍🏫', val:stats.teachers,  label:lbl('教师','Teachers'),   color:C.info    },
              { icon:'🎓', val:stats.students,   label:lbl('学生','Students'),   color:C.success },
              { icon:'🏫', val:stats.classes,    label:lbl('班级','Classes'),    color:C.warning },
              { icon:'📄', val:stats.materials,  label:lbl('教材','Materials'),  color:'#7c3aed' },
              { icon:'🧩', val:stats.chunks,     label:lbl('知识块','Chunks'),   color:'#0891b2' },
            ].map((s,i)=>(
              <div key={i} style={{ ...S.card, textAlign:'center', padding:'0.75rem', marginBottom:0 }}>
                <div style={{ fontSize:22 }}>{s.icon}</div>
                <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val ?? '…'}</div>
                <div style={{ fontSize:11, color:C.muted }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Quick access */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
            <div style={S.card}>
              <h3 style={{ margin:'0 0 1rem', fontSize:14 }}>⚡ {lbl('快速操作','Quick Actions')}</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { label:lbl('用户与访问管理','User & Access'), tab:'users', icon:'👥' },
                  { label:lbl('知识库监控','KB Monitor'),        tab:'kb',    icon:'🧠' },
                  { label:lbl('系统配置','System Config'),       tab:'config', icon:'⚙️' },
                  { label:'Panda Studio',                         tab:'panda',  icon:'🐼' },
                ].map(a=>(
                  <button key={a.tab} onClick={()=>setTab(a.tab)}
                    style={{ padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)',
                      background:'var(--background)', cursor:'pointer', fontSize:13,
                      textAlign:'left', display:'flex', alignItems:'center', gap:8 }}>
                    <span>{a.icon}</span><span>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <h3 style={{ margin:'0 0 1rem', fontSize:14 }}>🧠 {lbl('知识库状态','KB Status')}</h3>
              {pipeline ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                    <span>{lbl('Embedding','Embedding')}</span>
                    <span style={S.badge(pipeline.hasEmbKey?C.success:C.error, pipeline.hasEmbKey?'#d1fae5':'#fee2e2')}>
                      {pipeline.hasEmbKey?'✅ '+pipeline.embProvider:'❌ 未配置'}
                    </span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                    <span>{lbl('生成服务','AI Service')}</span>
                    <span style={S.badge(pipeline.hasAiKey?C.success:C.error, pipeline.hasAiKey?'#d1fae5':'#fee2e2')}>
                      {pipeline.hasAiKey?'✅ '+pipeline.aiProvider:'❌ 未配置'}
                    </span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                    <span>{lbl('待处理','Pending')}</span>
                    <span style={S.badge(pipeline.pending>0?C.warning:'#374151', pipeline.pending>0?'#fef3c7':'#f3f4f6')}>
                      {pipeline.pending} {lbl('个','files')}
                    </span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                    <span>{lbl('已完成','Completed')}</span>
                    <span style={S.badge(C.success,'#d1fae5')}>{pipeline.completed}</span>
                  </div>
                </div>
              ) : (
                <button onClick={()=>setTab('kb')}
                  style={{ padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                    background:C.primary, color:'#fff', fontSize:12 }}>
                  {lbl('查看详情','View Details')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ USERS & ACCESS ══ */}
      {tab === 'users' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <h3 style={{ margin:0 }}>{lbl('用户与访问管理','Users & Access Management')}</h3>
            <div style={{ fontSize:12, color:C.muted }}>{users.length} {lbl('位用户','users')}</div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {users.map(u => (
              <div key={u.id} style={{ ...S.card, marginBottom:0, padding:'10px 14px',
                display:'flex', justifyContent:'space-between', alignItems:'center',
                borderLeft:`4px solid ${roleColor[u.role]||'#9ca3af'}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', display:'flex',
                    alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13,
                    background:`${roleColor[u.role]||'#9ca3af'}20`, color:roleColor[u.role]||'#9ca3af' }}>
                    {(u.name||u.username||'?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{u.name||u.username}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{u.email||u.phone}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <select value={u.role||'student'}
                    onChange={e=>updateUserRole(u.id,e.target.value)}
                    style={{ padding:'3px 8px', borderRadius:6, border:'1px solid var(--border)',
                      fontSize:11, background:'var(--background)', cursor:'pointer' }}>
                    <option value="super_admin">👑 Super Admin</option>
                    <option value="teacher">👩‍🏫 {lbl('教师','Teacher')}</option>
                    <option value="student">🎓 {lbl('学生','Student')}</option>
                    <option value="parent">👪 {lbl('家长','Parent')}</option>
                  </select>
                  <button onClick={()=>toggleUserActive(u.id,!u.is_active)}
                    style={{ padding:'3px 10px', borderRadius:6, border:'none', cursor:'pointer',
                      fontSize:11, fontWeight:600,
                      background:u.is_active===false?'#fef3c7':'#d1fae5',
                      color:u.is_active===false?'#92400e':'#065f46' }}>
                    {u.is_active===false?lbl('已禁用','Disabled'):lbl('启用','Active')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ KB MONITOR ══ */}
      {tab === 'kb' && pipeline && (
        <div>
          {/* Pipeline health bar */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.75rem', marginBottom:'1.25rem' }}>
            {[
              { label:lbl('知识库','KBs'),         val:pipeline.kbs.length,   color:C.primary, icon:'📚' },
              { label:lbl('教材总数','Materials'), val:pipeline.total,         color:C.info,    icon:'📄' },
              { label:lbl('已向量化','Indexed'),   val:pipeline.completed,     color:C.success, icon:'✅' },
              { label:lbl('待处理','Pending'),     val:pipeline.pending,       color:pipeline.pending>0?C.warning:C.success, icon:pipeline.pending>0?'⏳':'✅' },
            ].map((s,i)=>(
              <div key={i} style={{ ...S.card, textAlign:'center', padding:'0.75rem', marginBottom:0 }}>
                <div style={{ fontSize:20 }}>{s.icon}</div>
                <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:11, color:C.muted }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* AI Pipeline status */}
          <div style={{ ...S.card, marginBottom:'1rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
              <h3 style={{ margin:0, fontSize:14 }}>🔧 {lbl('处理流水线状态','Processing Pipeline Status')}</h3>
              {pipeline.pending > 0 && (
                <button onClick={reprocessPending}
                  style={{ padding:'4px 14px', borderRadius:8, border:'none', cursor:'pointer',
                    background:C.warning, color:'#fff', fontSize:12, fontWeight:600 }}>
                  🔄 {lbl('重新处理待定文件','Retry Pending')}
                </button>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
              <div style={{ padding:'10px 14px', borderRadius:10, background:'var(--background)',
                border:`1px solid ${pipeline.hasEmbKey?'#a7f3d0':'#fca5a5'}` }}>
                <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>🧮 Embedding</div>
                <div style={{ fontSize:13, fontWeight:600 }}>
                  {pipeline.hasEmbKey
                    ? <span style={{ color:C.success }}>✅ {pipeline.embProvider} / {pipeline.embModel}</span>
                    : <span style={{ color:C.error }}>❌ {lbl('未配置 — 前往系统配置添加 Key','Not configured — go to Config')}</span>}
                </div>
              </div>
              <div style={{ padding:'10px 14px', borderRadius:10, background:'var(--background)',
                border:`1px solid ${pipeline.hasAiKey?'#a7f3d0':'#fca5a5'}` }}>
                <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>🤖 {lbl('生成服务','AI Generation')}</div>
                <div style={{ fontSize:13, fontWeight:600 }}>
                  {pipeline.hasAiKey
                    ? <span style={{ color:C.success }}>✅ {pipeline.aiProvider}</span>
                    : <span style={{ color:C.error }}>❌ {lbl('未配置','Not configured')}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Recent materials */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>📄 {lbl('最新教材上传','Recent Material Uploads')}</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {pipeline.materials.slice(0,20).map(m => {
                const statusColor = { completed:C.success, processing:C.warning, uploaded:'#6b7280', error:C.error };
                return (
                  <div key={m.id} style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'center', padding:'8px 10px', background:'var(--background)',
                    borderRadius:8, border:'1px solid var(--border)' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {m.title_zh || m.file_name}
                      </div>
                      <div style={{ fontSize:11, color:C.muted }}>
                        {m.category} · {m.chunk_count||0} {lbl('块','chunks')}
                        {m.ai_classify_confidence && ` · ${Math.round(m.ai_classify_confidence*100)}%`}
                        {' · '}{m.created_at?.slice(0,10)}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                      {m.chunk_count > 0 && (
                        <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background:'#dbeafe', color:'#1d4ed8' }}>
                          🧩 {m.chunk_count}
                        </span>
                      )}
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, fontWeight:600,
                        background:`${statusColor[m.status]||'#9ca3af'}20`,
                        color:statusColor[m.status]||'#9ca3af' }}>
                        {m.status==='completed'?lbl('✅ 已索引','✅ Indexed'):
                         m.status==='processing'?lbl('⏳ 处理中','⏳ Processing'):
                         m.status==='uploaded'?lbl('📤 待处理','📤 Uploaded'):
                         m.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ CONFIG ══ */}
      {tab === 'config' && (
        <div style={{ maxWidth: 700 }}>
          <div style={{ ...S.card, background:'rgba(196,30,58,0.04)', border:'1px solid rgba(196,30,58,0.2)', marginBottom:'1rem' }}>
            <p style={{ margin:0, fontSize:13, color:C.muted }}>
              🔐 {lbl('以下配置由超级管理员统一管理，保存后即时对所有用户生效','Config is admin-only and takes effect immediately for all users')}
            </p>
          </div>

          {/* AI Generation */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 1rem', fontSize:14 }}>🤖 {lbl('生成服务（PPT · 测验 · 对话）','Generation Service')}</h3>
            <label style={S.lbl}>{lbl('默认服务商','Default Provider')}</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:'0.75rem' }}>
              {[
                { id:'openai',    icon:'🟢', name:'OpenAI'  },
                { id:'anthropic', icon:'🟣', name:'Claude'  },
                { id:'deepseek',  icon:'🔵', name:'DeepSeek'},
                { id:'qwen',      icon:'🇨🇳', name:'Qwen'  },
              ].map(p=>(
                <div key={p.id} onClick={()=>updateRag('ai_provider',p.id)}
                  style={{ padding:'8px', borderRadius:10, cursor:'pointer', textAlign:'center',
                    border:`2px solid ${ragConfig.ai_provider===p.id?C.primary:'var(--border)'}`,
                    background:ragConfig.ai_provider===p.id?'rgba(196,30,58,0.06)':'var(--background)' }}>
                  <div>{p.icon}</div>
                  <div style={{ fontSize:11, fontWeight:600, marginTop:2 }}>{p.name}</div>
                </div>
              ))}
            </div>

            {[
              { id:'openai',    label:'OpenAI API Key',   ph:'sk-...',     models:['gpt-4o-mini','gpt-4o'] },
              { id:'anthropic', label:'Anthropic API Key',ph:'sk-ant-...',  models:['claude-haiku-4-5-20251001','claude-sonnet-4-20250514'] },
              { id:'deepseek',  label:'DeepSeek API Key', ph:'sk-...',     models:['deepseek-chat','deepseek-reasoner'] },
              { id:'qwen',      label:'Qwen API Key',     ph:'sk-...',     models:['qwen-turbo','qwen-plus'] },
            ].map(p=>(
              <div key={p.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <div>
                  <label style={{ ...S.lbl, marginTop:0 }}>{p.label}</label>
                  <input type="password" style={S.inp}
                    value={ragConfig[`${p.id}_api_key`]||''}
                    onChange={e=>updateRag(`${p.id}_api_key`,e.target.value)}
                    onPaste={e=>{e.stopPropagation();const v=e.clipboardData.getData('text');if(v)updateRag(`${p.id}_api_key`,v);e.preventDefault();}}
                    placeholder={p.ph}/>
                </div>
                <div>
                  <label style={{ ...S.lbl, marginTop:0 }}>{lbl('模型','Model')}</label>
                  <select style={S.inp} value={ragConfig[`${p.id}_model`]||p.models[0]}
                    onChange={e=>updateRag(`${p.id}_model`,e.target.value)}>
                    {p.models.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'span 2', fontSize:11, color:ragConfig[`${p.id}_api_key`]?C.success:C.muted }}>
                  {ragConfig[`${p.id}_api_key`]?`✅ ${lbl('已配置','Configured')}`:lbl('未配置','Not set')}
                </div>
              </div>
            ))}
          </div>

          {/* Embedding */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>🧮 {lbl('Embedding（知识库向量化）','Embedding')}</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div>
                <label style={S.lbl}>{lbl('服务商','Provider')}</label>
                <select style={S.inp} value={ragConfig.embedding_provider||'voyage'}
                  onChange={e=>updateRag('embedding_provider',e.target.value)}>
                  <option value="voyage">⭐ Voyage AI (免费50M)</option>
                  <option value="jina">🌐 Jina AI (免费1M)</option>
                  <option value="openai">🟢 OpenAI</option>
                  <option value="deepseek">🔵 DeepSeek</option>
                </select>
              </div>
              <div>
                <label style={S.lbl}>{lbl('模型','Model')}</label>
                <select style={S.inp} value={ragConfig.embedding_model||'voyage-3'}
                  onChange={e=>updateRag('embedding_model',e.target.value)}>
                  {(ragConfig.embedding_provider==='voyage'||!ragConfig.embedding_provider) && <>
                    <option value="voyage-3">voyage-3</option>
                    <option value="voyage-3-lite">voyage-3-lite</option>
                  </>}
                  {ragConfig.embedding_provider==='jina' && <>
                    <option value="jina-embeddings-v3">jina-embeddings-v3</option>
                  </>}
                  {ragConfig.embedding_provider==='openai' && <>
                    <option value="text-embedding-3-small">text-embedding-3-small</option>
                  </>}
                  {ragConfig.embedding_provider==='deepseek' && <>
                    <option value="deepseek-embedding">deepseek-embedding</option>
                  </>}
                </select>
              </div>
            </div>
            <label style={S.lbl}>
              Embedding API Key
              {(!ragConfig.embedding_provider||ragConfig.embedding_provider==='voyage') &&
                <a href="https://dash.voyageai.com" target="_blank" rel="noreferrer"
                  style={{ marginLeft:8, fontSize:11, color:C.primary }}>{lbl('获取免费Key →','Get free key →')}</a>}
            </label>
            <input type="password" style={S.inp}
              value={ragConfig.embedding_api_key||''}
              onChange={e=>updateRag('embedding_api_key',e.target.value)}
              onPaste={e=>{e.stopPropagation();const v=e.clipboardData.getData('text');if(v)updateRag('embedding_api_key',v);e.preventDefault();}}
              placeholder={ragConfig.embedding_provider==='voyage'?'pa-...':ragConfig.embedding_provider==='jina'?'jina_...':'sk-...'}/>
            {ragConfig.embedding_api_key
              ? <div style={{ fontSize:11, color:C.success, marginTop:3 }}>✅ {lbl('已配置','Configured')}</div>
              : <div style={{ fontSize:11, color:C.warning, marginTop:3 }}>⚠️ {lbl('未配置 — 知识库语义搜索不可用','Not set — KB semantic search unavailable')}</div>}
          </div>

          {/* RAG params */}
          <div style={S.card}>
            <h3 style={{ margin:'0 0 0.75rem', fontSize:14 }}>⚙️ {lbl('RAG 参数','RAG Parameters')}</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { k:'chunk_size',          label:lbl('分块大小','Chunk Size'),       def:500  },
                { k:'chunk_overlap',       label:lbl('分块重叠','Chunk Overlap'),     def:50   },
                { k:'top_k',               label:lbl('检索数量 Top-K','Top-K'),       def:5    },
                { k:'similarity_threshold',label:lbl('相似度阈值','Similarity'),      def:0.7  },
              ].map(f=>(
                <div key={f.k}>
                  <label style={S.lbl}>{f.label}</label>
                  <input type="number" style={S.inp}
                    value={ragConfig[f.k]||f.def}
                    onChange={e=>updateRag(f.k,parseFloat(e.target.value))}/>
                </div>
              ))}
            </div>
          </div>

          <button onClick={saveConfig} disabled={saving}
            style={{ width:'100%', padding:'12px', borderRadius:10, border:'none',
              cursor:saving?'not-allowed':'pointer', fontSize:14, fontWeight:700,
              background:saved?C.success:saving?'#9ca3af':C.primary, color:'#fff',
              transition:'background .2s' }}>
            {saved?`✅ ${lbl('已保存！','Saved!')}`:saving?lbl('保存中...','Saving...'):`💾 ${lbl('保存所有配置','Save All Config')}`}
          </button>
        </div>
      )}

      {/* ══ PANDA STUDIO ══ */}
      {tab === 'panda' && (
        <PandaStudio supabase={supabase}/>
      )}
    </div>
  );
}
