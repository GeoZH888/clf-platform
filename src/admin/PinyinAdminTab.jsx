// src/admin/PinyinAdminTab.jsx
// Admin editor for 听音识调, 四声练习, 拼音输入 exercises

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  verm:'#8B4513', green:'#2E7D32',
};

// ── Tone keyboard — inserts tone marks ───────────────────────────
const TONE_MAP = {
  a: ['ā','á','ǎ','à','a'],
  e: ['ē','é','ě','è','e'],
  i: ['ī','í','ǐ','ì','i'],
  o: ['ō','ó','ǒ','ò','o'],
  u: ['ū','ú','ǔ','ù','u'],
  ü: ['ǖ','ǘ','ǚ','ǜ','ü'],
};

function ToneKeyboard({ onInsert }) {
  const [base, setBase] = useState('a');
  return (
    <div style={{ background:'#f5ede0', borderRadius:10, padding:'10px 12px',
      border:`1px solid ${V.border}`, marginBottom:8 }}>
      <div style={{ fontSize:11, color:V.text3, marginBottom:6 }}>
        🎵 声调键盘 · Tone keyboard
      </div>
      {/* Base vowel selector */}
      <div style={{ display:'flex', gap:4, marginBottom:6, flexWrap:'wrap' }}>
        {Object.keys(TONE_MAP).map(v => (
          <button key={v} onClick={() => setBase(v)}
            style={{ padding:'4px 10px', borderRadius:16, cursor:'pointer', fontSize:13,
              border:`1.5px solid ${base===v ? V.verm : V.border}`,
              background: base===v ? V.verm : V.bg,
              color: base===v ? '#fff' : V.text2, fontWeight:500 }}>
            {v}
          </button>
        ))}
      </div>
      {/* Tone buttons */}
      <div style={{ display:'flex', gap:6 }}>
        {TONE_MAP[base].map((char, i) => (
          <button key={i} onClick={() => onInsert(char)}
            style={{ padding:'8px 14px', borderRadius:8, cursor:'pointer',
              fontSize:18, border:`1px solid ${V.border}`,
              background: i===4 ? '#f0f0f0' : ['#E3F2FD','#E8F5E9','#FFF3E0','#FFEBEE'][i],
              color:['#1565C0','#2E7D32','#E65100','#B71C1C','#888'][i],
              fontWeight:600, minWidth:44 }}>
            {char}
            <div style={{ fontSize:9, marginTop:2, opacity:0.7 }}>
              {['一声','二声','三声','四声','轻声'][i]}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Smart pinyin input field ──────────────────────────────────────
function PinyinInput({ value, onChange, placeholder, style }) {
  const [showKb, setShowKb] = useState(false);
  const [ref, setRef] = useState(null);

  function insertAt(char) {
    if (!ref) { onChange(value + char); return; }
    const start = ref.selectionStart;
    const end   = ref.selectionEnd;
    const next  = value.slice(0, start) + char + value.slice(end);
    onChange(next);
    setTimeout(() => ref.setSelectionRange(start+1, start+1), 0);
  }

  return (
    <div>
      <div style={{ display:'flex', gap:6 }}>
        <input
          ref={el => setRef(el)}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex:1, padding:'7px 10px', fontSize:13, borderRadius:8,
            border:`1px solid ${V.border}`, ...style }}/>
        <button onClick={() => setShowKb(k => !k)}
          style={{ padding:'7px 12px', borderRadius:8, cursor:'pointer',
            border:`1px solid ${V.border}`, background: showKb ? V.verm : V.bg,
            color: showKb ? '#fff' : V.text2, fontSize:13 }}>
          🎵
        </button>
      </div>
      {showKb && <ToneKeyboard onInsert={insertAt}/>}
    </div>
  );
}

// ── Listen exercises editor ───────────────────────────────────────
function ListenEditor({ items, onChange, aiProvider, aiHsk }) {
  const [genCount,  setGenCount]  = useState(5);
  const [genLoading,setGenLoading]= useState(false);
  const [genStatus, setGenStatus] = useState('');

  async function generateBatch() {
    setGenLoading(true); setGenStatus('⏳ AI生成中…');
    const existing = items.map(e=>e.char).filter(Boolean).join(',');
    const prompt = `Generate ${genCount} Chinese pinyin listening exercises for HSK ${aiHsk} level.
Return ONLY a valid JSON array, no markdown:
[{"char":"你","py":"nǐ","tone":3,"options":["nī","ní","nǐ","nì"]}]
Rules:
- tone: 1 2 3 4 0
- options: exactly 4 items, all same syllable but different tones, correct answer included
- pinyin with tone marks
- HSK ${aiHsk} common words
- exclude: ${existing||'none'}`;
    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'generate_text', provider:aiProvider||'claude', prompt, max_tokens:1500 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const items2 = JSON.parse((data.result||data.text||'').trim().replace(/```json|```/g,'').trim());
      if (!Array.isArray(items2)) throw new Error('Invalid');
      onChange([...items, ...items2]);
      setGenStatus(`✅ 添加了 ${items2.length} 个练习`);
    } catch(e) { setGenStatus('❌ '+e.message); }
    setGenLoading(false);
  }
  function update(i, key, val) {
    const next = items.map((it, j) => j===i ? { ...it, [key]: val } : it);
    onChange(next);
  }
  function add() {
    onChange([...items, { py:'', char:'', tone:1, options:['','','',''] }]);
  }
  function remove(i) {
    onChange(items.filter((_,j) => j!==i));
  }
  function updateOption(i, oi, val) {
    const next = items.map((it, j) => {
      if (j!==i) return it;
      const opts = [...(it.options||['','','',''])];
      opts[oi] = val;
      return { ...it, options: opts };
    });
    onChange(next);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {items.map((item, i) => (
        <div key={i} style={{ background:V.card, border:`1px solid ${V.border}`,
          borderRadius:12, padding:'12px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
            {/* Char */}
            <div style={{ flex:'0 0 70px' }}>
              <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>汉字</label>
              <input value={item.char} onChange={e=>update(i,'char',e.target.value)}
                placeholder="你" style={{ width:'100%', padding:'6px 8px', fontSize:16,
                  fontFamily:'serif', borderRadius:8, border:`1px solid ${V.border}`,
                  textAlign:'center', boxSizing:'border-box' }}/>
            </div>
            {/* Pinyin */}
            <div style={{ flex:1, minWidth:120 }}>
              <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>拼音（答案）</label>
              <PinyinInput value={item.py} onChange={v=>update(i,'py',v)} placeholder="nǐ"/>
            </div>
            {/* Tone */}
            <div style={{ flex:'0 0 80px' }}>
              <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>声调</label>
              <select value={item.tone} onChange={e=>update(i,'tone',Number(e.target.value))}
                style={{ width:'100%', padding:'6px 8px', borderRadius:8,
                  border:`1px solid ${V.border}`, fontSize:13 }}>
                {[1,2,3,4,0].map(t=>(
                  <option key={t} value={t}>{['','一声','二声','三声','四声','轻声'][t]||'轻声'}</option>
                ))}
              </select>
            </div>
            <button onClick={()=>remove(i)}
              style={{ alignSelf:'flex-end', padding:'6px 10px', borderRadius:8,
                border:'1px solid #ffcccc', background:'#fff',
                color:'#c0392b', cursor:'pointer', fontSize:12 }}>✕</button>
          </div>

          {/* 4 options */}
          <div>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:4 }}>
              四个选项（第{[null,'一','二','三','四','?'][item.tone||0]}声为正确答案）
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
              {(item.options||['','','','']).map((opt, oi) => (
                <PinyinInput key={oi} value={opt}
                  onChange={v=>updateOption(i,oi,v)}
                  placeholder={`选项 ${oi+1}`}
                  style={{ background: opt===item.py ? '#E8F5E9' : '#fff' }}/>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button onClick={add}
        style={{ padding:'8px', borderRadius:8, cursor:'pointer',
          border:`1.5px dashed ${V.border}`, background:'transparent',
          color:V.text3, fontSize:13 }}>
        ＋ 添加练习
      </button>
    </div>
  );
}

// ── Tone practice editor ─────────────────────────────────────────
function ToneEditor({ items, onChange, aiProvider, aiHsk }) {
  const [genCount,  setGenCount]  = useState(5);
  const [genLoading,setGenLoading]= useState(false);
  const [genStatus, setGenStatus] = useState('');

  function update(i, key, val) {
    onChange(items.map((it, j) => j===i ? { ...it, [key]: val } : it));
  }
  function add() {
    onChange([...items, { py:'', char:'', meaning:'', meaningIt:'', tone:1 }]);
  }
  function remove(i) { onChange(items.filter((_,j)=>j!==i)); }

  async function generateBatch() {
    setGenLoading(true);
    setGenStatus('⏳ AI生成中…');
    const existing = items.map(e=>e.char).filter(Boolean).join(',');
    const prompt = `Generate ${genCount} Chinese tone practice example words for HSK ${aiHsk} level.
Return ONLY a valid JSON array, no markdown, no explanation:
[{"char":"妈","py":"mā","tone":1,"meaning":"mother","meaningIt":"mamma"}]
Rules:
- tone: 1=flat 2=rising 3=dip 4=falling 0=neutral
- py must use tone marks (ā á ǎ à ē é ě è ī í ǐ ì etc.)
- Include English and Italian translations
- Mix all 4 tones evenly
- HSK ${aiHsk} common vocabulary
- Do NOT include these characters: ${existing || 'none'}`;
    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'generate_text', provider:aiProvider||'claude', prompt, max_tokens:1500 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const text  = (data.result||data.text||'').trim().replace(/```json|```/g,'').trim();
      const newItems = JSON.parse(text);
      if (!Array.isArray(newItems)) throw new Error('Invalid response');
      onChange([...items, ...newItems]);
      setGenStatus(`✅ 添加了 ${newItems.length} 个例词`);
    } catch(e) { setGenStatus('❌ ' + e.message); }
    setGenLoading(false);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ fontSize:11, color:V.text3 }}>
        四声练习例词 — 每行一个 (拼音+汉字+含义)
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ background:V.card, border:`1px solid ${V.border}`,
          borderRadius:10, padding:'10px 12px', display:'flex', gap:8, flexWrap:'wrap' }}>
          <div style={{ flex:'0 0 64px' }}>
            <label style={{ fontSize:9, color:V.text3, display:'block', marginBottom:2 }}>汉字</label>
            <input value={item.char} onChange={e=>update(i,'char',e.target.value)}
              placeholder="妈" style={{ width:'100%', padding:'5px', fontSize:18,
                fontFamily:'serif', borderRadius:6, border:`1px solid ${V.border}`,
                textAlign:'center', boxSizing:'border-box' }}/>
          </div>
          <div style={{ flex:1, minWidth:110 }}>
            <label style={{ fontSize:9, color:V.text3, display:'block', marginBottom:2 }}>拼音</label>
            <PinyinInput value={item.py} onChange={v=>update(i,'py',v)} placeholder="mā"/>
          </div>
          <div style={{ flex:'0 0 80px' }}>
            <label style={{ fontSize:9, color:V.text3, display:'block', marginBottom:2 }}>声调</label>
            <select value={item.tone} onChange={e=>update(i,'tone',Number(e.target.value))}
              style={{ width:'100%', padding:'5px 6px', borderRadius:6,
                border:`1px solid ${V.border}`, fontSize:12 }}>
              {[1,2,3,4,0].map(t=>(
                <option key={t} value={t}>{['一','二','三','四','轻'][t]||'轻'}声</option>
              ))}
            </select>
          </div>
          <div style={{ flex:1, minWidth:100 }}>
            <label style={{ fontSize:9, color:V.text3, display:'block', marginBottom:2 }}>English</label>
            <input value={item.meaning||''} onChange={e=>update(i,'meaning',e.target.value)}
              placeholder="mother" style={{ width:'100%', padding:'5px 8px', fontSize:12,
                borderRadius:6, border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
          </div>
          <div style={{ flex:1, minWidth:100 }}>
            <label style={{ fontSize:9, color:V.text3, display:'block', marginBottom:2 }}>Italiano</label>
            <input value={item.meaningIt||''} onChange={e=>update(i,'meaningIt',e.target.value)}
              placeholder="mamma" style={{ width:'100%', padding:'5px 8px', fontSize:12,
                borderRadius:6, border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
          </div>
          <button onClick={()=>remove(i)}
            style={{ alignSelf:'flex-end', padding:'5px 8px', borderRadius:6,
              border:'1px solid #ffcccc', background:'#fff',
              color:'#c0392b', cursor:'pointer', fontSize:11 }}>✕</button>
        </div>
      ))}
      <button onClick={add}
        style={{ padding:'8px', borderRadius:8, cursor:'pointer',
          border:`1.5px dashed ${V.border}`, background:'transparent',
          color:V.text3, fontSize:13 }}>
        ＋ 添加例词
      </button>
    </div>
  );
}

// ── Pinyin input exercises editor ────────────────────────────────
function TypeEditor({ items, onChange, aiProvider, aiHsk }) {
  const [genCount,  setGenCount]  = useState(5);
  const [genLoading,setGenLoading]= useState(false);
  const [genStatus, setGenStatus] = useState('');

  async function generateBatch() {
    setGenLoading(true); setGenStatus('⏳ AI生成中…');
    const existing = items.map(e=>e.char).filter(Boolean).join(',');
    const prompt = `Generate ${genCount} Chinese pinyin typing exercises for HSK ${aiHsk} level.
Return ONLY a valid JSON array, no markdown:
[{"char":"你","py":"nǐ","hint_zh":"你好","hint_en":"you","hint_it":"tu"}]
Rules:
- py: pinyin with tone marks (nǐ not ni3)
- hint_zh: short phrase using the character
- hint_en: English meaning
- hint_it: Italian meaning
- HSK ${aiHsk} vocabulary
- exclude: ${existing||'none'}`;
    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'generate_text', provider:aiProvider||'claude', prompt, max_tokens:1500 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const items2 = JSON.parse((data.result||data.text||'').trim().replace(/```json|```/g,'').trim());
      if (!Array.isArray(items2)) throw new Error('Invalid');
      onChange([...items, ...items2]);
      setGenStatus(`✅ 添加了 ${items2.length} 个练习`);
    } catch(e) { setGenStatus('❌ '+e.message); }
    setGenLoading(false);
  }
  function update(i, key, val) {
    onChange(items.map((it, j) => j===i ? { ...it, [key]: val } : it));
  }
  function add() {
    onChange([...items, { char:'', py:'', hint_zh:'', hint_en:'' }]);
  }
  function remove(i) { onChange(items.filter((_,j)=>j!==i)); }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ fontSize:11, color:V.text3 }}>
        拼音输入练习 — 看汉字输拼音（含声调）
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ background:V.card, border:`1px solid ${V.border}`,
          borderRadius:10, padding:'10px 12px' }}>
          <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
            <div style={{ flex:'0 0 70px' }}>
              <label style={{ fontSize:9, color:V.text3, display:'block', marginBottom:2 }}>汉字</label>
              <input value={item.char} onChange={e=>update(i,'char',e.target.value)}
                placeholder="你" style={{ width:'100%', padding:'5px', fontSize:20,
                  fontFamily:'serif', borderRadius:6, border:`1px solid ${V.border}`,
                  textAlign:'center', boxSizing:'border-box' }}/>
            </div>
            <div style={{ flex:1, minWidth:130 }}>
              <label style={{ fontSize:9, color:V.text3, display:'block', marginBottom:2 }}>
                正确拼音（含声调）
              </label>
              <PinyinInput value={item.py} onChange={v=>update(i,'py',v)} placeholder="nǐ"/>
            </div>
            <button onClick={()=>remove(i)}
              style={{ alignSelf:'flex-end', padding:'5px 8px', borderRadius:6,
                border:'1px solid #ffcccc', background:'#fff',
                color:'#c0392b', cursor:'pointer', fontSize:11 }}>✕</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={{ fontSize:9, color:V.text3, display:'block', marginBottom:2 }}>提示 (中文)</label>
              <input value={item.hint_zh||''} onChange={e=>update(i,'hint_zh',e.target.value)}
                placeholder="你好的你" style={{ width:'100%', padding:'5px 8px', fontSize:12,
                  borderRadius:6, border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
            </div>
            <div>
              <label style={{ fontSize:9, color:V.text3, display:'block', marginBottom:2 }}>提示 (English)</label>
              <input value={item.hint_en||''} onChange={e=>update(i,'hint_en',e.target.value)}
                placeholder="you (pronoun)" style={{ width:'100%', padding:'5px 8px', fontSize:12,
                  borderRadius:6, border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
            </div>
          </div>
        </div>
      ))}
      <button onClick={add}
        style={{ padding:'8px', borderRadius:8, cursor:'pointer',
          border:`1.5px dashed ${V.border}`, background:'transparent',
          color:V.text3, fontSize:13 }}>
        ＋ 添加练习
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
const DEFAULT_LISTEN = [
  { py:'nǐ',  char:'你',  tone:3, options:['nī','ní','nǐ','nì'] },
  { py:'māo', char:'猫',  tone:1, options:['māo','máo','mǎo','mào'] },
  { py:'dà',  char:'大',  tone:4, options:['dā','dá','dǎ','dà'] },
  { py:'lái', char:'来',  tone:2, options:['lāi','lái','lǎi','lài'] },
];
const DEFAULT_TONES = [
  { py:'mā', char:'妈', meaning:'mother',   meaningIt:'mamma',   tone:1 },
  { py:'má', char:'麻', meaning:'hemp',     meaningIt:'canapa',  tone:2 },
  { py:'mǎ', char:'马', meaning:'horse',    meaningIt:'cavallo', tone:3 },
  { py:'mà', char:'骂', meaning:'scold',    meaningIt:'sgridare',tone:4 },
];
const DEFAULT_TYPE = [
  { char:'你', py:'nǐ',  hint_zh:'你好', hint_en:'you' },
  { char:'我', py:'wǒ',  hint_zh:'我是', hint_en:'I/me' },
  { char:'好', py:'hǎo', hint_zh:'你好', hint_en:'good/well' },
  { char:'是', py:'shì', hint_zh:'我是', hint_en:'to be' },
];

export default function PinyinAdminTab() {
  const [tab,        setTab]       = useState('listen');
  const [listen,     setListen]    = useState(DEFAULT_LISTEN);
  const [tones,      setTones]     = useState(DEFAULT_TONES);
  const [typeEx,     setTypeEx]    = useState(DEFAULT_TYPE);
  const [saved,      setSaved]     = useState(false);
  const [loading,    setLoading]   = useState(true);
  const [aiProvider, setAiProvider]= useState('claude');
  const [aiCount,    setAiCount]   = useState(5);
  const [aiHsk,      setAiHsk]     = useState(1);
  const [aiLoading,  setAiLoading] = useState(false);
  const [aiStatus,   setAiStatus]  = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from('jgw_pinyin_exercises').select('*').maybeSingle();
    if (data) {
      if (data.listen_exercises) setListen(data.listen_exercises);
      if (data.tone_examples)    setTones(data.tone_examples);
      if (data.type_exercises)   setTypeEx(data.type_exercises);
    }
    setLoading(false);
  }

  async function saveAll() {
    setSaved(false);
    const payload = { listen_exercises:listen, tone_examples:tones, type_exercises:typeEx };
    const { data: existing } = await supabase.from('jgw_pinyin_exercises').select('id').maybeSingle();
    if (existing) await supabase.from('jgw_pinyin_exercises').update(payload).eq('id', existing.id);
    else          await supabase.from('jgw_pinyin_exercises').insert(payload);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // AI generation prompts per tab
  const AI_PROMPTS = {
    listen: (count, hsk, existing) => `Generate ${count} Chinese pinyin listening exercises for HSK ${hsk} level.
Return ONLY a valid JSON array, no markdown:
[{"char":"你","py":"nǐ","tone":3,"options":["nī","ní","nǐ","nì"]}]
Rules:
- tone: 1=flat 2=rising 3=dip 4=falling 0=neutral
- options: array of exactly 4 pinyin variants (1 correct + 3 wrong tones)
- correct answer must be in options
- pinyin must use tone marks (ā á ǎ à ē é ě è etc.)
- HSK ${hsk} vocabulary only
- exclude these characters: ${existing.map(e=>e.char).join(',')}`,

    tones: (count, hsk, existing) => `Generate ${count} Chinese tone practice examples for HSK ${hsk} level.
Return ONLY a valid JSON array, no markdown:
[{"char":"妈","py":"mā","tone":1,"meaning":"mother","meaningIt":"mamma"}]
Rules:
- tone: 1 2 3 4 0
- pinyin with tone marks
- include Italian translation
- HSK ${hsk} vocabulary
- exclude: ${existing.map(e=>e.char).join(',')}`,

    type: (count, hsk, existing) => `Generate ${count} Chinese pinyin typing exercises for HSK ${hsk} level.
Return ONLY a valid JSON array, no markdown:
[{"char":"你","py":"nǐ","hint_zh":"你好","hint_en":"you","hint_it":"tu"}]
Rules:
- py must use tone marks (nǐ not ni3)
- hint_zh: a short Chinese phrase using the character
- hint_en: English meaning
- hint_it: Italian meaning
- HSK ${hsk} vocabulary
- exclude: ${existing.map(e=>e.char).join(',')}`,
  };

  async function generateAI() {
    setAiLoading(true);
    setAiStatus('⏳ AI生成中…');
    try {
      const existing = tab==='listen' ? listen : tab==='tones' ? tones : typeEx;
      const prompt   = AI_PROMPTS[tab](aiCount, aiHsk, existing);

      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'generate_text', provider:aiProvider, prompt,
          max_tokens: 2000 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const text = (data.result || data.text || '').trim();
      const clean = text.replace(/```json|```/g,'').trim();
      const items = JSON.parse(clean);
      if (!Array.isArray(items)) throw new Error('Expected array');

      if (tab==='listen') setListen(l => [...l, ...items]);
      if (tab==='tones')  setTones(t  => [...t, ...items]);
      if (tab==='type')   setTypeEx(e => [...e, ...items]);

      setAiStatus(`✅ 已生成 ${items.length} 个练习，请检查后保存`);
    } catch(e) {
      setAiStatus('❌ ' + e.message);
    }
    setAiLoading(false);
  }

  const TABS = [
    { id:'listen', label:'👂 听音识调', count: listen.length },
    { id:'tones',  label:'🎵 四声练习', count: tones.length },
    { id:'type',   label:'⌨️ 拼音输入', count: typeEx.length },
  ];

  if (loading) return <div style={{ padding:20, color:V.text3 }}>加载中…</div>;

  return (
    <div style={{ maxWidth:700 }}>
      <div style={{ fontSize:15, fontWeight:600, color:V.text, marginBottom:4 }}>
        🔤 拼音练习管理
      </div>
      <div style={{ fontSize:12, color:V.text3, marginBottom:14 }}>
        编辑三个拼音模块的练习内容 · 🎵 按钮可插入声调符号
      </div>

      {/* Sub-tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:14,
        border:`1px solid ${V.border}`, borderRadius:10, overflow:'hidden' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:'10px 8px', cursor:'pointer', border:'none',
              borderRight:`1px solid ${V.border}`,
              background: tab===t.id ? V.verm : V.bg,
              color: tab===t.id ? '#fff' : V.text2,
              fontSize:12, fontWeight: tab===t.id ? 500 : 400 }}>
            {t.label}
            <span style={{ marginLeft:4, fontSize:10,
              background: tab===t.id ? 'rgba(255,255,255,0.25)' : '#e0d0b8',
              color: tab===t.id ? '#fff' : V.text3,
              padding:'1px 5px', borderRadius:8 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* AI Generation panel — directly below tabs */}
      <div style={{ background:'#F3E5F5', border:'2px solid #CE93D8',
        borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#6A1B9A', marginBottom:10 }}>
          🤖 AI批量生成 — {tab==='listen'?'听音识调':tab==='tones'?'四声练习':'拼音输入'}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div>
            <label style={{ fontSize:10, color:'#6A1B9A', display:'block', marginBottom:3 }}>AI引擎</label>
            <select value={aiProvider} onChange={e=>setAiProvider(e.target.value)}
              style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #CE93D8',
                fontSize:12, background:'#fff' }}>
              <option value="claude">🤖 Claude</option>
              <option value="deepseek">🔍 DeepSeek</option>
              <option value="openai">⚡ GPT-4</option>
              <option value="gemini">✨ Gemini</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:'#6A1B9A', display:'block', marginBottom:3 }}>HSK级别</label>
            <select value={aiHsk} onChange={e=>setAiHsk(Number(e.target.value))}
              style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #CE93D8',
                fontSize:12, background:'#fff' }}>
              {[1,2,3,4].map(h=><option key={h} value={h}>HSK {h}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:'#6A1B9A', display:'block', marginBottom:3 }}>数量</label>
            <select value={aiCount} onChange={e=>setAiCount(Number(e.target.value))}
              style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #CE93D8',
                fontSize:12, background:'#fff' }}>
              {[5,10,15,20].map(n=><option key={n} value={n}>{n}个</option>)}
            </select>
          </div>
          <button onClick={generateAI} disabled={aiLoading}
            style={{ padding:'9px 24px', borderRadius:8, cursor:'pointer', border:'none',
              background: aiLoading ? '#ddd' : '#7B1FA2',
              color:'#fff', fontSize:13, fontWeight:600 }}>
            {aiLoading ? '⏳ 生成中…' : '🤖 开始生成'}
          </button>
        </div>
        {aiStatus && (
          <div style={{ marginTop:8, fontSize:12, fontWeight:500,
            color: aiStatus.startsWith('✅')?V.green:aiStatus.startsWith('❌')?'#c0392b':'#6A1B9A' }}>
            {aiStatus}
          </div>
        )}
        <div style={{ fontSize:10, color:'#9C27B0', marginTop:6 }}>
          💡 生成完成后检查内容，再点「💾 保存全部」才会生效
        </div>
      </div>
      {/* Tone keyboard tip */}
      <div style={{ padding:'8px 12px', background:'#FFF8E1',
        borderRadius:8, border:'1px solid #FFE082',
        fontSize:11, color:'#795548', marginBottom:12 }}>
        💡 点击输入框旁边的 🎵 按钮，然后选择声母和声调，快速插入带声调的拼音
      </div>

      {/* Content */}
      {tab === 'listen' && <ListenEditor items={listen} onChange={setListen} aiProvider={aiProvider} aiHsk={aiHsk}/>}
      {tab === 'tones'  && <ToneEditor  items={tones}  onChange={setTones}  aiProvider={aiProvider} aiHsk={aiHsk}/>}
      {tab === 'type'   && <TypeEditor  items={typeEx} onChange={setTypeEx} aiProvider={aiProvider} aiHsk={aiHsk}/>}

      {/* Save */}
      <div style={{ marginTop:20, display:'flex', gap:10, alignItems:'center' }}>
        <button onClick={saveAll}
          style={{ padding:'10px 28px', borderRadius:10, cursor:'pointer',
            border:'none', background:V.verm, color:'#fdf6e3',
            fontSize:14, fontWeight:500 }}>
          💾 保存全部
        </button>
        {saved && (
          <span style={{ fontSize:13, color:V.green }}>✅ 已保存！</span>
        )}
        <span style={{ fontSize:11, color:V.text3, marginLeft:'auto' }}>
          保存后学生下次练习时生效
        </span>
      </div>
    </div>
  );
}
