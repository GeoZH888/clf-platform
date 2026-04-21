// src/admin/GrammarAdminTab.jsx
// Admin panel for managing grammar patterns
// View / edit / AI-generate patterns stored in jgw_grammar_patterns table

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  verm:'#8B4513', purple:'#6A1B9A', purpleLight:'#F3E5F5',
};

// Built-in patterns (also stored in DB once seeded)
const BUILTIN_PATTERNS = [
  { pattern:'是…的', pattern_en:'Emphasis: 是…的', hsk_level:3, difficulty:1, theme:'structure',
    rule_zh:'强调动作发生的时间、地点或方式', rule_en:'Emphasizes when/where/how a past action occurred',
    example_zh:'我是坐飞机来的。', example_en:'I came by plane.',
    active:true },
  { pattern:'把字句', pattern_en:'Disposal: 把', hsk_level:3, difficulty:1, theme:'structure',
    rule_zh:'用"把"把宾语提前，强调对宾语的处理方式', rule_en:'Moves object before verb to emphasize handling',
    example_zh:'请把门关上。', example_en:'Please close the door.',
    active:true },
  { pattern:'被字句', pattern_en:'Passive: 被', hsk_level:4, difficulty:2, theme:'structure',
    rule_zh:'"被"表示被动，宾语成为主语', rule_en:'"被" marks passive voice',
    example_zh:'蛋糕被小狗吃了。', example_en:'The cake was eaten by the dog.',
    active:true },
  { pattern:'A比B+adj', pattern_en:'Comparison: A 比 B', hsk_level:3, difficulty:1, theme:'comparison',
    rule_zh:'用"比"比较两者差异', rule_en:'Use "比" to compare: A is more [adj] than B',
    example_zh:'今天比昨天冷。', example_en:'Today is colder than yesterday.',
    active:true },
  { pattern:'动词+过', pattern_en:'Experience: verb+过', hsk_level:3, difficulty:2, theme:'aspect',
    rule_zh:'动词后加"过"表示曾经有过某种经历', rule_en:'"过" after verb = have experienced',
    example_zh:'我吃过北京烤鸭。', example_en:'I have eaten Peking duck.',
    active:true },
  { pattern:'动词+着', pattern_en:'Duration: verb+着', hsk_level:4, difficulty:2, theme:'aspect',
    rule_zh:'"着"表示动作或状态的持续', rule_en:'"着" indicates continuing action/state',
    example_zh:'她笑着说话。', example_en:'She spoke with a smile.',
    active:true },
  { pattern:'要是…就…', pattern_en:'Conditional: 要是…就', hsk_level:4, difficulty:2, theme:'logic',
    rule_zh:'"要是"引出条件，"就"引出结果', rule_en:'"要是" + condition + "就" + result',
    example_zh:'要是明天下雨，我就不去了。', example_en:'If it rains tomorrow, I won\'t go.',
    active:true },
  { pattern:'虽然…但是…', pattern_en:'Concession: 虽然…但是', hsk_level:4, difficulty:2, theme:'logic',
    rule_zh:'"虽然"承认前提，"但是"转折', rule_en:'Although…but (concession)',
    example_zh:'虽然很难，但是很有意思。', example_en:'Although it\'s hard, it\'s very interesting.',
    active:true },
];

function log_fn(setLog) {
  return (msg) => setLog(prev => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 20));
}

export default function GrammarAdminTab() {
  const [patterns, setPatterns]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [editId,   setEditId]     = useState(null);
  const [editForm, setEditForm]   = useState({});
  const [saving,   setSaving]     = useState(false);
  const [seeding,  setSeeding]    = useState(false);
  const [genLog,   setGenLog]     = useState([]);
  const [genLoading,setGenLoading]= useState(false);
  const [genProvider,setGenProvider]= useState('claude');

  const TEXT_PROVIDERS = [
    { id:'claude',   label:'Claude (Anthropic)', keyId:'anthropic' },
    { id:'openai',   label:'GPT-4o (OpenAI)',    keyId:'openai'    },
    { id:'gemini',   label:'Gemini (Google)',     keyId:'gemini'    },
    { id:'deepseek', label:'DeepSeek',            keyId:'deepseek'  },
    { id:'qwen',     label:'Qwen 通义千问',        keyId:'qwen'      },
    { id:'grok',     label:'Grok (xAI)',           keyId:'grok'      },
    { id:'mistral',  label:'Mistral',              keyId:'mistral'   },
  ];
  const log = log_fn(setGenLog);

  // ── Load ──────────────────────────────────────────────────────────
  useEffect(() => { loadPatterns(); }, []);

  async function loadPatterns() {
    setLoading(true);
    const { data, error } = await supabase
      .from('jgw_grammar_patterns')
      .select('*')
      .order('hsk_level')
      .order('difficulty');
    if (!error) setPatterns(data || []);
    setLoading(false);
  }

  // ── Seed built-in patterns ─────────────────────────────────────────
  async function seedPatterns() {
    setSeeding(true);
    log('开始添加内置语法点…');
    const { data, error } = await supabase
      .from('jgw_grammar_patterns')
      .upsert(BUILTIN_PATTERNS, { onConflict:'pattern' })
      .select();
    if (error) { log('✗ ' + error.message); }
    else {
      log(`✓ 已添加/更新 ${data?.length} 条语法点`);
      await loadPatterns();
    }
    setSeeding(false);
  }

  // ── Edit ──────────────────────────────────────────────────────────
  function startEdit(p) {
    setEditId(p.id);
    setEditForm({
      pattern:    p.pattern    || '',
      pattern_en: p.pattern_en || '',
      hsk_level:  p.hsk_level  || 3,
      difficulty: p.difficulty || 1,
      theme:      p.theme      || 'structure',
      rule_zh:    p.rule_zh    || '',
      rule_en:    p.rule_en    || '',
      example_zh: p.example_zh || '',
      example_en: p.example_en || '',
      example_it: p.example_it || '',
      extra_examples: p.extra_examples || '',
      active:     p.active !== false,
    });
  }

  async function saveEdit(id) {
    setSaving(true);
    const { error } = await supabase.from('jgw_grammar_patterns')
      .update(editForm).eq('id', id);
    if (!error) {
      setPatterns(prev => prev.map(p => p.id === id ? { ...p, ...editForm } : p));
      setEditId(null);
      log(`✓ ${editForm.pattern} 已保存`);
    } else { log('✗ ' + error.message); }
    setSaving(false);
  }

  async function deletePattern(id, pattern) {
    if (!confirm(`删除语法点 "${pattern}"？`)) return;
    await supabase.from('jgw_grammar_patterns').delete().eq('id', id);
    setPatterns(prev => prev.filter(p => p.id !== id));
  }

  // ── AI generate more examples ─────────────────────────────────────
  async function aiGenerateExamples(p) {
    const key = localStorage.getItem(`admin_key_${TEXT_PROVIDERS.find(p=>p.id===genProvider)?.keyId||genProvider}`);
    if (!key) { log('⚠️ 请先在 API Keys 保存 Anthropic key'); return; }
    setGenLoading(true);
    log(`🤖 AI 生成 "${p.pattern}" 例句…`);
    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'generate_text', provider:genProvider, client_key:key, max_tokens:500,
          prompt:`For the Chinese grammar pattern "${p.pattern}" (${p.pattern_en}):
Rule: ${p.rule_zh}

Generate 3 more example sentences. Return ONLY JSON:
{"examples":[
  {"zh":"中文例句","en":"English translation","it":"Traduzione italiana"},
  {"zh":"...","en":"...","it":"..."},
  {"zh":"...","en":"...","it":"..."}
]}
No explanation, no markdown.`,
        }),
      });
      const d = await res.json();
      const raw = (d.result||'').replace(/```json|```/g,'').trim();
      const obj = JSON.parse(raw);
      if (obj.examples) {
        const formatted = obj.examples.map(e => `${e.zh} | ${e.en}`).join('\n');
        setEditForm(f => ({ ...f, extra_examples: formatted }));
        log(`✓ 已生成 ${obj.examples.length} 条例句`);
      }
    } catch(e) { log('✗ AI失败: ' + e.message); }
    setGenLoading(false);
  }

  // ── AI generate new pattern ───────────────────────────────────────
  async function aiGeneratePattern(hsk) {
    const key = localStorage.getItem(`admin_key_${TEXT_PROVIDERS.find(p=>p.id===genProvider)?.keyId||genProvider}`);
    if (!key) { log('⚠️ 请先在 API Keys 保存 Anthropic key'); return; }
    setGenLoading(true);
    log(`🤖 AI 生成 HSK${hsk} 语法点…`);
    try {
      const existing = patterns.map(p => p.pattern).join(', ');
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'generate_text', provider:genProvider, client_key:key, max_tokens:600,
          prompt:`Generate 1 new Chinese grammar pattern for HSK ${hsk} level learners.
Already have: ${existing}. Do NOT repeat any of these.
Return ONLY JSON (no markdown):
{"pattern":"语法结构","pattern_en":"English name","hsk_level":${hsk},"difficulty":${hsk<=3?1:2},"theme":"structure","rule_zh":"规则说明（20字以内）","rule_en":"Rule explanation","example_zh":"中文例句","example_en":"English example","active":true}`,
        }),
      });
      const d = await res.json();
      const raw = (d.result||'').replace(/```json|```/g,'').trim();
      const obj = JSON.parse(raw);
      const { data, error } = await supabase.from('jgw_grammar_patterns').insert(obj).select().maybeSingle();
      if (!error && data) {
        setPatterns(prev => [...prev, data].sort((a,b) => a.hsk_level-b.hsk_level || a.difficulty-b.difficulty));
        log(`✓ 新语法点 "${obj.pattern}" 已保存`);
      } else { log('✗ 保存失败: ' + (error?.message || '')); }
    } catch(e) { log('✗ AI失败: ' + e.message); }
    setGenLoading(false);
  }

  const themes = [...new Set(patterns.map(p => p.theme).filter(Boolean)), 'structure','aspect','comparison','logic','modal'];

  return (
    <div style={{ maxWidth:900 }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:15, fontWeight:600, color:V.text }}>📐 语法管理 Grammar Patterns</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <div>
            <select value={genProvider} onChange={e=>setGenProvider(e.target.value)}
              style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${V.purple}`,
                background:V.purpleLight, fontSize:11, color:V.purple }}>
              {TEXT_PROVIDERS.map(p=>{
                const hasKey=!!localStorage.getItem(`admin_key_${p.keyId}`);
                return <option key={p.id} value={p.id}>{hasKey?'✓ ':''}{p.label}</option>;
              })}
            </select>
          </div>
          {patterns.length === 0 && (
            <button onClick={seedPatterns} disabled={seeding}
              style={{ padding:'7px 14px', fontSize:12, cursor:'pointer', borderRadius:8,
                border:'none', background:V.purple, color:'#fff', fontWeight:600 }}>
              {seeding ? '添加中…' : '🌱 添加内置语法点'}
            </button>
          )}
          {[3,4,5].map(hsk => (
            <button key={hsk} onClick={() => aiGeneratePattern(hsk)} disabled={genLoading}
              style={{ padding:'7px 12px', fontSize:12, cursor:'pointer', borderRadius:8,
                border:`1px solid ${V.purple}`, background:V.purpleLight,
                color:V.purple, fontWeight:500 }}>
              🤖 + HSK{hsk}
            </button>
          ))}
          <button onClick={loadPatterns}
            style={{ padding:'7px 12px', fontSize:12, cursor:'pointer', borderRadius:8,
              border:`1px solid ${V.border}`, background:V.bg, color:V.text2 }}>
            ↺
          </button>
        </div>
      </div>

      {/* Stats */}
      {patterns.length > 0 && (
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          {[3,4,5,6].map(hsk => {
            const n = patterns.filter(p => p.hsk_level === hsk).length;
            if (!n) return null;
            return (
              <div key={hsk} style={{ background:V.purpleLight, border:`1px solid #CE93D8`,
                borderRadius:10, padding:'6px 14px', fontSize:12 }}>
                <span style={{ color:V.purple, fontWeight:600 }}>HSK{hsk}</span>
                <span style={{ color:V.text3, marginLeft:6 }}>{n}条</span>
              </div>
            );
          })}
          <div style={{ background:'#E8F5E9', border:'1px solid #A5D6A7',
            borderRadius:10, padding:'6px 14px', fontSize:12 }}>
            <span style={{ color:'#2E7D32', fontWeight:600 }}>总计</span>
            <span style={{ color:V.text3, marginLeft:6 }}>{patterns.length}条</span>
          </div>
        </div>
      )}

      {/* AI log */}
      {genLog.length > 0 && (
        <div style={{ background:'#1a0a05', borderRadius:10, padding:'10px 14px',
          fontFamily:'monospace', fontSize:11, color:'#69F0AE', marginBottom:14,
          maxHeight:100, overflowY:'auto' }}>
          {genLog.map((l,i) => <div key={i}>{l}</div>)}
        </div>
      )}

      {/* Empty state */}
      {!loading && patterns.length === 0 && (
        <div style={{ background:V.purpleLight, border:`2px dashed #CE93D8`, borderRadius:14,
          padding:'2rem', textAlign:'center', color:V.purple }}>
          <div style={{ fontSize:40, marginBottom:8 }}>📐</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>还没有语法点</div>
          <div style={{ fontSize:12, opacity:0.8, marginBottom:16 }}>点击"添加内置语法点"快速开始，或用AI生成新语法点</div>
        </div>
      )}

      {/* Pattern list */}
      {loading ? <div style={{ textAlign:'center', color:V.text3, padding:20 }}>加载中…</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {patterns.map(p => (
            <div key={p.id} style={{ background:V.card,
              border:`1.5px solid ${editId===p.id?V.purple:V.border}`,
              borderRadius:12, overflow:'hidden',
              boxShadow:editId===p.id?`0 0 0 2px ${V.purple}22`:'none' }}>

              {/* Summary row */}
              <div style={{ padding:'10px 14px', display:'flex', gap:12, alignItems:'center' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:15, fontWeight:700, color:V.purple,
                      fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:1 }}>{p.pattern}</span>
                    <span style={{ fontSize:11, color:V.text3 }}>{p.pattern_en}</span>
                    <span style={{ fontSize:10, background:V.purpleLight, color:V.purple,
                      padding:'1px 6px', borderRadius:8 }}>HSK{p.hsk_level} · Lv{p.difficulty}</span>
                    {p.theme && <span style={{ fontSize:10, background:'#f0e8d8', color:V.text3,
                      padding:'1px 6px', borderRadius:8 }}>{p.theme}</span>}
                    {!p.active && <span style={{ fontSize:10, background:'#FFEBEE', color:'#C62828',
                      padding:'1px 6px', borderRadius:8 }}>已禁用</span>}
                  </div>
                  <div style={{ fontSize:12, color:V.text2, marginTop:3,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {p.example_zh}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => editId===p.id ? setEditId(null) : startEdit(p)}
                    style={{ padding:'4px 10px', borderRadius:8, fontSize:11, cursor:'pointer',
                      border:`1px solid ${editId===p.id?V.purple:V.border}`,
                      background:editId===p.id?V.purple:V.bg,
                      color:editId===p.id?'#fff':V.text2 }}>
                    {editId===p.id ? '✕' : '✏️ 编辑'}
                  </button>
                  <button onClick={() => deletePattern(p.id, p.pattern)}
                    style={{ padding:'4px 8px', borderRadius:8, fontSize:11, cursor:'pointer',
                      border:'1px solid #FFCDD2', background:'#FFEBEE', color:'#C62828' }}>
                    ✕
                  </button>
                </div>
              </div>

              {/* Inline edit panel */}
              {editId === p.id && (
                <div style={{ borderTop:`1px solid ${V.border}`, padding:'14px',
                  background:'#fdfaf5' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>语法结构 Pattern</label>
                      <input value={editForm.pattern} onChange={e=>setEditForm(f=>({...f,pattern:e.target.value}))}
                        style={{ width:'100%', padding:'7px 9px', fontSize:15, borderRadius:8,
                          border:`1px solid ${V.border}`, fontFamily:"'STKaiti','KaiTi',serif",
                          letterSpacing:1, boxSizing:'border-box', color:V.purple, fontWeight:700 }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>英文名称 English name</label>
                      <input value={editForm.pattern_en} onChange={e=>setEditForm(f=>({...f,pattern_en:e.target.value}))}
                        style={{ width:'100%', padding:'7px 9px', fontSize:13, borderRadius:8,
                          border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ gridColumn:'1/-1' }}>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>中文规则说明</label>
                      <input value={editForm.rule_zh} onChange={e=>setEditForm(f=>({...f,rule_zh:e.target.value}))}
                        style={{ width:'100%', padding:'7px 9px', fontSize:13, borderRadius:8,
                          border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ gridColumn:'1/-1' }}>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>English rule</label>
                      <input value={editForm.rule_en} onChange={e=>setEditForm(f=>({...f,rule_en:e.target.value}))}
                        style={{ width:'100%', padding:'7px 9px', fontSize:13, borderRadius:8,
                          border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>例句 (中文)</label>
                      <input value={editForm.example_zh} onChange={e=>setEditForm(f=>({...f,example_zh:e.target.value}))}
                        style={{ width:'100%', padding:'7px 9px', fontSize:13, borderRadius:8,
                          border:`1px solid ${V.border}`, boxSizing:'border-box',
                          fontFamily:"'STKaiti','KaiTi',serif" }}/>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>Example (English)</label>
                      <input value={editForm.example_en} onChange={e=>setEditForm(f=>({...f,example_en:e.target.value}))}
                        style={{ width:'100%', padding:'7px 9px', fontSize:13, borderRadius:8,
                          border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
                    </div>
                  </div>

                  {/* Extra examples textarea */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <label style={{ fontSize:10, color:V.text3 }}>额外例句（每行一个，格式: 中文 | English）</label>
                      <button onClick={() => aiGenerateExamples(p)} disabled={genLoading}
                        style={{ fontSize:10, padding:'2px 10px', borderRadius:6, border:'none',
                          background:V.purple, color:'#fff', cursor:'pointer' }}>
                        🤖 AI生成
                      </button>
                    </div>
                    <textarea value={editForm.extra_examples}
                      onChange={e=>setEditForm(f=>({...f,extra_examples:e.target.value}))}
                      rows={4} placeholder="他是坐火车来的。| He came by train.&#10;她是在北京出生的。| She was born in Beijing."
                      style={{ width:'100%', padding:'8px', fontSize:12, borderRadius:8,
                        border:`1px solid ${V.border}`, boxSizing:'border-box',
                        resize:'vertical', fontFamily:'inherit' }}/>
                  </div>

                  {/* Meta */}
                  <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>HSK</label>
                      <select value={editForm.hsk_level} onChange={e=>setEditForm(f=>({...f,hsk_level:Number(e.target.value)}))}
                        style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${V.border}`, fontSize:12 }}>
                        {[3,4,5,6].map(n => <option key={n} value={n}>HSK {n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>难度</label>
                      <select value={editForm.difficulty} onChange={e=>setEditForm(f=>({...f,difficulty:Number(e.target.value)}))}
                        style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${V.border}`, fontSize:12 }}>
                        {[1,2,3].map(n => <option key={n} value={n}>Lv{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>主题</label>
                      <select value={editForm.theme} onChange={e=>setEditForm(f=>({...f,theme:e.target.value}))}
                        style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${V.border}`, fontSize:12 }}>
                        {themes.map(th => <option key={th} value={th}>{th}</option>)}
                      </select>
                    </div>
                    <div style={{ display:'flex', alignItems:'flex-end', gap:6 }}>
                      <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, cursor:'pointer' }}>
                        <input type="checkbox" checked={editForm.active}
                          onChange={e=>setEditForm(f=>({...f,active:e.target.checked}))}/>
                        启用
                      </label>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => saveEdit(p.id)} disabled={saving}
                      style={{ padding:'8px 20px', borderRadius:9, border:'none',
                        background:saving?'#E0E0E0':V.purple,
                        color:saving?'#aaa':'#fff', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                      {saving ? '保存中…' : '💾 保存'}
                    </button>
                    <button onClick={() => setEditId(null)}
                      style={{ padding:'8px 14px', borderRadius:9, border:`1px solid ${V.border}`,
                        background:V.bg, color:V.text2, fontSize:13, cursor:'pointer' }}>
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SQL hint */}
      <div style={{ marginTop:16, background:'#F3E5F5', border:'1px solid #CE93D8',
        borderRadius:10, padding:'10px 14px', fontSize:11, color:V.purple }}>
        <strong>SQL required in Supabase:</strong>
        <pre style={{ margin:'6px 0 0', fontSize:10, lineHeight:1.6, color:'#4A148C', overflow:'auto' }}>{
`CREATE TABLE IF NOT EXISTS jgw_grammar_patterns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern text UNIQUE NOT NULL,
  pattern_en text,
  hsk_level int DEFAULT 3,
  difficulty int DEFAULT 1,
  theme text DEFAULT 'structure',
  rule_zh text,
  rule_en text,
  example_zh text,
  example_en text,
  example_it text,
  extra_examples text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE jgw_grammar_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read" ON jgw_grammar_patterns FOR SELECT TO anon USING (active = true);`
        }</pre>
      </div>
    </div>
  );
}
