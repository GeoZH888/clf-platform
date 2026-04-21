// src/admin/HSKAdminTab.jsx
// Admin panel for managing HSK vocabulary
// AI batch generation per level, manual add, edit, import CSV

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850', verm:'#8B4513',
};

const HSK_COLORS = {
  1:'#E53935', 2:'#E91E63', 3:'#9C27B0', 4:'#1565C0', 5:'#2E7D32', 6:'#E65100',
};

const CATEGORIES = ['名词','动词','形容词','副词','介词','连词','量词','代词','助词','其他',
  'noun','verb','adjective','adverb','other'];

function log_fn(setLog) {
  return msg => setLog(prev => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 30));
}

export default function HSKAdminTab() {
  const [selLevel,  setSelLevel]  = useState(1);
  const [words,     setWords]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [counts,    setCounts]    = useState({});
  const [editId,    setEditId]    = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [editSaving,setEditSaving]= useState(false);
  const [audioLoading,setAudioLoading] = useState({});
  const [audioPlaying,setAudioPlaying] = useState({});
  const [genLog,    setGenLog]    = useState([]);
  const [generating,setGenerating]= useState(false);
  const [genCount,  setGenCount]  = useState(20);
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
  const [showAdd,   setShowAdd]   = useState(false);
  const [addForm,   setAddForm]   = useState({ word:'', pinyin:'', meaning_zh:'', meaning_en:'', meaning_it:'', category:'名词', example_zh:'', example_en:'', hsk_level:1 });
  const [search,    setSearch]    = useState('');
  const log = log_fn(setGenLog);

  useEffect(() => {
    loadCounts();
  }, []);

  useEffect(() => {
    loadWords(selLevel);
  }, [selLevel]);

  async function loadCounts() {
    const { data } = await supabase.from('jgw_hsk_words').select('hsk_level').eq('active', true);
    const c = {};
    (data||[]).forEach(r => { c[r.hsk_level] = (c[r.hsk_level]||0)+1; });
    setCounts(c);
  }

  async function playWord(w) {
    setAudioPlaying(p=>({...p,[w.id]:true}));
    if (w.audio_url) {
      const a = new Audio(w.audio_url);
      a.onended = ()=>setAudioPlaying(p=>({...p,[w.id]:false}));
      a.play(); return;
    }
    try {
      const res = await fetch('/.netlify/functions/azure-tts-speak', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text:w.word, lang:'zh-CN', voice:'zh-CN-XiaoxiaoNeural' }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = new Audio(url);
        a.onended = ()=>{ setAudioPlaying(p=>({...p,[w.id]:false})); URL.revokeObjectURL(url); };
        a.play(); return;
      }
    } catch {}
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(w.word);
      u.lang='zh-CN'; u.rate=0.85;
      u.onend=()=>setAudioPlaying(p=>({...p,[w.id]:false}));
      window.speechSynthesis.speak(u);
    } else setAudioPlaying(p=>({...p,[w.id]:false}));
  }

  async function generateAndSaveAudio(w) {
    const azureKey = localStorage.getItem('admin_key_azure');
    if (!azureKey) { alert('请先在 API Keys 保存 Azure Speech key'); return; }
    setAudioLoading(p=>({...p,[w.id]:true}));
    try {
      const res = await fetch('/.netlify/functions/azure-tts-speak', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text:w.word, lang:'zh-CN', voice:'zh-CN-XiaoxiaoNeural' }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      const path = `hsk/${w.hsk_level}/${w.id}.mp3`;
      const { error:upErr } = await supabase.storage.from('hsk-audio').upload(path, blob, { upsert:true });
      if (upErr) throw upErr;
      const { data:{ publicUrl } } = supabase.storage.from('hsk-audio').getPublicUrl(path);
      await supabase.from('jgw_hsk_words').update({ audio_url:publicUrl }).eq('id', w.id);
      setWords(prev=>prev.map(x=>x.id===w.id?{...x,audio_url:publicUrl}:x));
    } catch(e) { alert('Audio error: ' + e.message); }
    setAudioLoading(p=>({...p,[w.id]:false}));
  }

  async function batchGenerateAudio() {
    const azureKey = localStorage.getItem('admin_key_azure');
    if (!azureKey) { alert('请先在 API Keys 保存 Azure Speech key'); return; }
    const noAudio = words.filter(w=>!w.audio_url);
    if (!noAudio.length) { alert('所有词汇已有音频'); return; }
    log(`🔊 批量生成 ${noAudio.length} 个音频…`);
    for (const w of noAudio.slice(0, 50)) { // max 50 at a time
      await generateAndSaveAudio(w);
      await new Promise(r=>setTimeout(r,300));
    }
    log(`✅ 音频生成完成`);
  }

  async function loadWords(level) {
    setLoading(true);
    const { data } = await supabase.from('jgw_hsk_words')
      .select('*').eq('hsk_level', level).order('sort_order').order('created_at').limit(500);
    setWords(data||[]);
    setLoading(false);
  }

  // ── AI batch generate ──────────────────────────────────────────────────────
  async function generateWords() {
    const provDef = TEXT_PROVIDERS.find(p=>p.id===genProvider);
    const key = localStorage.getItem(`admin_key_${provDef?.keyId||genProvider}`);
    if (!key) { log(`⚠️ 请先保存 ${provDef?.label} key`); return; }
    setGenerating(true);
    log(`🤖 [${provDef?.label}] 生成 HSK${selLevel} 词汇 ${genCount} 个…`);

    // Get existing words to avoid duplicates
    const existing = words.map(w => w.word).join('、');
    const BATCH = 10;
    let total = 0;

    for (let offset = 0; offset < genCount; offset += BATCH) {
      const count = Math.min(BATCH, genCount - offset);
      log(`生成第 ${offset+1}–${offset+count} 个…`);
      try {
        const res = await fetch('/.netlify/functions/ai-gateway', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            action:'generate_text', provider:genProvider, client_key:key, max_tokens:2000,
            prompt:`Generate ${count} HSK Level ${selLevel} Chinese vocabulary words.
${existing ? `Already have: ${existing.slice(0,200)}. Do NOT repeat these.` : ''}
Return ONLY a JSON array, no markdown:
[{"word":"汉字","pinyin":"hàn zì","meaning_zh":"中文释义","meaning_en":"English meaning","meaning_it":"Significato italiano","category":"名词","example_zh":"包含该词的例句","example_en":"Example sentence","hsk_level":${selLevel}}]`,
          }),
        });
        const d = await res.json();
        const raw = (d.result||d.content||'').replace(/```json|```/g,'').trim();
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) { log('✗ JSON解析失败'); continue; }

        // Deduplicate
        const seen = new Set(words.map(w=>w.word));
        const unique = arr.filter(w => w.word && !seen.has(w.word));
        unique.forEach(w => seen.add(w.word));

        if (unique.length === 0) { log('⚠️ 无新词汇'); continue; }

        // Save
        const rows = unique.map((w,i) => ({
          ...w, sort_order: words.length + total + offset + i + 1, active: true,
        }));
        const { data: ins, error } = await supabase.from('jgw_hsk_words')
          .upsert(rows, { onConflict:'word,hsk_level' }).select();
        if (error) { log(`✗ 保存失败: ${error.message}`); continue; }
        total += ins?.length || unique.length;
        log(`✓ 保存 ${ins?.length || unique.length} 个`);

        await new Promise(r => setTimeout(r, 500));
      } catch(e) { log(`✗ ${e.message}`); break; }
    }

    log(`✅ 完成，共生成 ${total} 个 HSK${selLevel} 词汇`);
    await loadWords(selLevel);
    await loadCounts();
    setGenerating(false);
  }

  // ── Manual add ─────────────────────────────────────────────────────────────
  async function addWord() {
    if (!addForm.word.trim()) return;
    const { data, error } = await supabase.from('jgw_hsk_words')
      .insert({ ...addForm, hsk_level:selLevel, sort_order:words.length+1, active:true })
      .select().maybeSingle();
    if (!error && data) {
      setWords(prev => [...prev, data]);
      setAddForm({ word:'', pinyin:'', meaning_zh:'', meaning_en:'', meaning_it:'', category:'名词', example_zh:'', example_en:'', hsk_level:selLevel });
      setShowAdd(false);
      loadCounts();
    } else { alert('Error: ' + error?.message); }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  function startEdit(w) {
    setEditId(w.id);
    setEditForm({ word:w.word||'', pinyin:w.pinyin||'', meaning_zh:w.meaning_zh||'',
      meaning_en:w.meaning_en||'', meaning_it:w.meaning_it||'', category:w.category||'',
      example_zh:w.example_zh||'', example_en:w.example_en||'', example_it:w.example_it||'' });
  }

  async function saveEdit(id) {
    setEditSaving(true);
    const { error } = await supabase.from('jgw_hsk_words').update(editForm).eq('id', id);
    if (!error) {
      setWords(prev => prev.map(w => w.id===id ? {...w,...editForm} : w));
      setEditId(null);
    }
    setEditSaving(false);
  }

  async function deleteWord(id) {
    if (!confirm('删除这个词？')) return;
    await supabase.from('jgw_hsk_words').delete().eq('id', id);
    setWords(prev => prev.filter(w => w.id !== id));
    loadCounts();
  }

  // ── Import CSV ──────────────────────────────────────────────────────────────
  async function importCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split('\n').slice(1); // skip header
    const rows = lines.map(l => {
      const [word,pinyin,meaning_zh,meaning_en,meaning_it,category,example_zh,example_en] = l.split(',').map(s=>s.trim().replace(/^"|"$/g,''));
      return { word, pinyin, meaning_zh, meaning_en, meaning_it, category, example_zh, example_en,
        hsk_level:selLevel, active:true };
    }).filter(r => r.word);
    const { data, error } = await supabase.from('jgw_hsk_words')
      .upsert(rows, { onConflict:'word,hsk_level' }).select();
    if (!error) {
      log(`✓ CSV导入 ${data?.length} 个词`);
      loadWords(selLevel); loadCounts();
    } else { log('✗ ' + error.message); }
    e.target.value = '';
  }

  const filtered = words.filter(w =>
    !search || w.word?.includes(search) ||
    (w.pinyin||'').toLowerCase().includes(search.toLowerCase()) ||
    (w.meaning_zh||'').includes(search) ||
    (w.meaning_en||'').toLowerCase().includes(search.toLowerCase())
  );

  const levelColor = HSK_COLORS[selLevel] || '#8B4513';

  return (
    <div style={{ maxWidth:960 }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:15, fontWeight:600, color:V.text }}>📚 HSK 词汇管理</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <label style={{ padding:'6px 12px', fontSize:12, cursor:'pointer', borderRadius:8,
            border:`1px solid ${V.border}`, background:V.bg, color:V.text2 }}>
            ⬆ CSV导入
            <input type="file" accept=".csv" onChange={importCSV} style={{ display:'none' }}/>
          </label>
          <button onClick={batchGenerateAudio}
            style={{ padding:'6px 12px', fontSize:12, cursor:'pointer', borderRadius:8,
              border:`1px solid ${levelColor}`, background:`${levelColor}15`, color:levelColor }}>
            🔊 批量生成音频
          </button>
          <button onClick={() => setShowAdd(s=>!s)}
            style={{ padding:'6px 12px', fontSize:12, cursor:'pointer', borderRadius:8,
              border:`1px solid ${levelColor}`, background:`${levelColor}15`, color:levelColor, fontWeight:600 }}>
            ✏️ 手动添加
          </button>
        </div>
      </div>

      {/* Level tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {[1,2,3,4,5,6].map(lv => {
          const c = HSK_COLORS[lv];
          const n = counts[lv] || 0;
          return (
            <button key={lv} onClick={()=>setSelLevel(lv)}
              style={{ padding:'8px 16px', borderRadius:12, cursor:'pointer',
                border:`2px solid ${selLevel===lv?c:c+'44'}`,
                background:selLevel===lv ? c : `${c}11`,
                color:selLevel===lv?'#fff':'#1a0a05',
                fontWeight:selLevel===lv?700:400, fontSize:13 }}>
              HSK{lv}
              <span style={{ fontSize:10, marginLeft:4, opacity:0.8 }}>({n})</span>
            </button>
          );
        })}
      </div>

      {/* Manual add form */}
      {showAdd && (
        <div style={{ background:`${levelColor}11`, border:`2px solid ${levelColor}44`,
          borderRadius:12, padding:'14px', marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:600, color:levelColor, marginBottom:10 }}>
            ✏️ 手动添加 HSK{selLevel} 词汇
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {[
              ['word','汉字 *','四字成语'],['pinyin','拼音','pīn yīn'],
              ['meaning_zh','中文释义','表示…'],['meaning_en','English','means…'],
              ['meaning_it','Italiano','significa…'],['example_zh','例句','今天天气真好'],
            ].map(([k,label,ph]) => (
              <div key={k}>
                <label style={{ fontSize:10, color:levelColor, display:'block', marginBottom:3 }}>{label}</label>
                <input value={addForm[k]} onChange={e=>setAddForm(f=>({...f,[k]:e.target.value}))}
                  placeholder={ph}
                  style={{ width:'100%', padding:'7px 9px', fontSize:13, borderRadius:8,
                    border:`1px solid ${levelColor}44`, boxSizing:'border-box' }}/>
              </div>
            ))}
            <div>
              <label style={{ fontSize:10, color:levelColor, display:'block', marginBottom:3 }}>词性</label>
              <select value={addForm.category} onChange={e=>setAddForm(f=>({...f,category:e.target.value}))}
                style={{ padding:'7px 8px', borderRadius:8, border:`1px solid ${levelColor}44`, fontSize:12, width:'100%' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button onClick={addWord} disabled={!addForm.word.trim()}
            style={{ padding:'8px 20px', borderRadius:9, border:'none',
              background:addForm.word.trim()?levelColor:'#E0E0E0',
              color:addForm.word.trim()?'#fff':'#aaa',
              fontWeight:600, fontSize:13, cursor:'pointer' }}>
            💾 保存
          </button>
        </div>
      )}

      {/* AI generation */}
      <div style={{ background:'#F3E5F5', border:'2px solid #CE93D8', borderRadius:12,
        padding:'14px', marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#4A148C', marginBottom:10 }}>
          🤖 AI 批量生成 HSK{selLevel} 词汇
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
          <div>
            <label style={{ fontSize:10, color:'#7B1FA2', display:'block', marginBottom:3 }}>AI引擎</label>
            <select value={genProvider} onChange={e=>setGenProvider(e.target.value)}
              style={{ padding:'5px 8px', borderRadius:8, border:'1px solid #CE93D8', fontSize:12 }}>
              {TEXT_PROVIDERS.map(p=>{
                const hasKey = !!localStorage.getItem(`admin_key_${p.keyId}`);
                return <option key={p.id} value={p.id}>{hasKey?'✓ ':''}{p.label}</option>;
              })}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:'#7B1FA2', display:'block', marginBottom:3 }}>生成数量</label>
            <select value={genCount} onChange={e=>setGenCount(Number(e.target.value))}
              style={{ padding:'5px 8px', borderRadius:8, border:'1px solid #CE93D8', fontSize:12 }}>
              {[10,20,50,100,200].map(n=><option key={n} value={n}>{n}个</option>)}
            </select>
          </div>
          <button onClick={generateWords} disabled={generating}
            style={{ padding:'7px 18px', borderRadius:8, border:'none', fontWeight:600,
              background:generating?'#E0E0E0':'#7B1FA2', color:generating?'#aaa':'#fff',
              fontSize:12, cursor:generating?'default':'pointer' }}>
            {generating?'生成中…':'🚀 开始生成'}
          </button>
          <div style={{ fontSize:11, color:'#7B1FA2', opacity:0.7 }}>
            已有 {words.length} 个词，将自动去重
          </div>
        </div>

        {genLog.length > 0 && (
          <div style={{ background:'#1a0a05', borderRadius:8, padding:'8px 12px',
            marginTop:10, maxHeight:80, overflowY:'auto' }}>
            {genLog.map((l,i) => (
              <div key={i} style={{ fontSize:10, color:l.includes('✓')||l.includes('✅')?'#69F0AE':l.includes('✗')?'#FF5252':'#aaa' }}>{l}</div>
            ))}
          </div>
        )}
      </div>

      {/* SQL hint */}
      <details style={{ marginBottom:14, background:'#fff', border:`1px solid ${V.border}`, borderRadius:10 }}>
        <summary style={{ padding:'8px 12px', cursor:'pointer', fontSize:12, color:V.text3, fontWeight:600 }}>
          📋 SQL — 首次使用请创建表
        </summary>
        <pre style={{ padding:'0 12px 12px', fontSize:10, color:'#4A148C', overflow:'auto', lineHeight:1.6 }}>{
`CREATE TABLE IF NOT EXISTS jgw_hsk_words (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  word text NOT NULL,
  pinyin text, meaning_zh text, meaning_en text, meaning_it text,
  category text, example_zh text, example_en text, example_it text,
  hsk_level int NOT NULL DEFAULT 1,
  audio_url text, image_url text,
  active boolean DEFAULT true, sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(word, hsk_level)
);
CREATE TABLE IF NOT EXISTS jgw_hsk_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_token text, word_id uuid REFERENCES jgw_hsk_words(id) ON DELETE CASCADE,
  correct boolean, practiced_at timestamptz DEFAULT now()
);
ALTER TABLE jgw_hsk_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE jgw_hsk_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read hsk" ON jgw_hsk_words FOR SELECT TO anon USING (active=true);
CREATE POLICY "users write hsk progress" ON jgw_hsk_progress FOR ALL USING (true) WITH CHECK (true);`
        }</pre>
      </details>

      {/* Search */}
      <div style={{ marginBottom:10 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={`搜索 HSK${selLevel} 词汇…`}
          style={{ width:'100%', padding:'8px 12px', fontSize:13, borderRadius:10,
            border:`1px solid ${V.border}`, boxSizing:'border-box', outline:'none' }}/>
      </div>

      {/* Word count */}
      <div style={{ fontSize:12, color:V.text3, marginBottom:8 }}>
        HSK{selLevel} · {filtered.length}/{words.length} 个词
        {search && ` · 搜索: "${search}"`}
      </div>

      {/* Word list */}
      {loading ? (
        <div style={{ textAlign:'center', color:V.text3, padding:20 }}>加载中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', color:V.text3, padding:'2rem',
          background:V.card, borderRadius:12, border:`1px dashed ${levelColor}44` }}>
          <div style={{ fontSize:32, marginBottom:8 }}>📚</div>
          <div>暂无 HSK{selLevel} 词汇 — 点击"AI批量生成"或"手动添加"</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {filtered.map(w => (
            <div key={w.id} style={{ background:V.card, borderRadius:12, overflow:'hidden',
              border:`1.5px solid ${editId===w.id?levelColor:V.border}` }}>

              {/* Row */}
              <div style={{ padding:'10px 12px', display:'flex', gap:10, alignItems:'center' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:18, fontWeight:700, fontFamily:"'STKaiti','KaiTi',serif",
                      color:'#1a0a05' }}>{w.word}</span>
                    <span style={{ fontSize:11, color:V.text3 }}>{w.pinyin}</span>
                    {w.category && <span style={{ fontSize:10, background:`${levelColor}15`, color:levelColor,
                      padding:'1px 6px', borderRadius:8 }}>{w.category}</span>}
                  </div>
                  <div style={{ fontSize:12, color:V.text2, marginTop:2 }}>{w.meaning_zh}
                    {w.meaning_en && <span style={{ color:V.text3, marginLeft:6 }}>· {w.meaning_en}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  {/* Play audio */}
                  <button onClick={()=>playWord(w)} title="播放发音"
                    style={{ padding:'3px 8px', borderRadius:8, fontSize:13, cursor:'pointer',
                      border:`1px solid ${w.audio_url?levelColor:V.border}`,
                      background: w.audio_url?`${levelColor}15`:V.bg,
                      color: audioPlaying[w.id]?levelColor:w.audio_url?levelColor:V.text3,
                      minWidth:28, textAlign:'center' }}>
                    {audioPlaying[w.id]?'🔊':'▶'}
                  </button>
                  {/* Save audio to storage */}
                  {!w.audio_url && (
                    <button onClick={()=>generateAndSaveAudio(w)} title="生成并保存音频"
                      disabled={audioLoading[w.id]}
                      style={{ padding:'3px 6px', borderRadius:8, fontSize:10, cursor:'pointer',
                        border:`1px solid ${V.border}`, background:V.bg, color:V.text3,
                        opacity:audioLoading[w.id]?0.5:1 }}>
                      {audioLoading[w.id]?'…':'💾'}
                    </button>
                  )}
                  <button onClick={()=>editId===w.id?setEditId(null):startEdit(w)}
                    style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer',
                      border:`1px solid ${editId===w.id?levelColor:V.border}`,
                      background:editId===w.id?levelColor:V.bg,
                      color:editId===w.id?'#fff':V.text2 }}>
                    {editId===w.id?'✕':'✏️'}
                  </button>
                  <button onClick={()=>deleteWord(w.id)}
                    style={{ padding:'3px 8px', borderRadius:8, fontSize:11, cursor:'pointer',
                      border:'1px solid #FFCDD2', background:'#FFEBEE', color:'#C62828' }}>✕</button>
                </div>
              </div>

              {/* Inline edit */}
              {editId === w.id && (
                <div style={{ borderTop:`1px solid ${V.border}`, padding:'12px', background:'#fdfaf5' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                    {[
                      ['word','汉字'],['pinyin','拼音'],
                      ['meaning_zh','中文释义'],['meaning_en','English'],
                      ['meaning_it','Italiano'],['example_zh','例句'],['example_en','Example'],
                    ].map(([k,label]) => (
                      <div key={k} style={{ gridColumn: k==='example_zh'||k==='example_en' ? '1/-1' : 'auto' }}>
                        <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>{label}</label>
                        <input value={editForm[k]||''} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}
                          style={{ width:'100%', padding:'6px 8px', fontSize:12, borderRadius:8,
                            border:`1px solid ${V.border}`, boxSizing:'border-box',
                            ...(k==='word'?{fontFamily:"'STKaiti','KaiTi',serif",fontSize:16}:{}) }}/>
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>词性</label>
                      <select value={editForm.category||''} onChange={e=>setEditForm(f=>({...f,category:e.target.value}))}
                        style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${V.border}`, fontSize:12, width:'100%' }}>
                        {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>saveEdit(w.id)} disabled={editSaving}
                      style={{ padding:'7px 18px', borderRadius:9, border:'none',
                        background:editSaving?'#E0E0E0':levelColor,
                        color:editSaving?'#aaa':'#fff', fontWeight:600, fontSize:12, cursor:'pointer' }}>
                      {editSaving?'保存中…':'💾 保存'}
                    </button>
                    <button onClick={()=>setEditId(null)}
                      style={{ padding:'7px 12px', borderRadius:9, border:`1px solid ${V.border}`,
                        background:V.bg, color:V.text2, fontSize:12, cursor:'pointer' }}>
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
