// src/admin/ArticulationStudio.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  verm:'#8B4513', green:'#2E7D32',
};

const NO_BG = `pure white background #FFFFFF, completely clean white, no grey, no shadow, no gradient`;
const BASE  = `single clean educational anatomy cross-section diagram of human mouth and tongue, 
medical illustration style, soft pastel warm colors, clear and simple, 
one specific pronunciation position shown, white background`;

// ── 21 Initials ─────────────────────────────────────────────────
const INITIALS_DIAG = [
  { id:'art_b', label:'b',  ipa:'p',   color:'#1565C0',
    prompt:`${BASE}, lips pressed firmly together for unaspirated bilabial stop "b [p]", small air pressure behind closed lips shown with tiny arrow, labeled: 双唇/lips closed, ${NO_BG}` },
  { id:'art_p', label:'p',  ipa:'pʰ',  color:'#1565C0',
    prompt:`${BASE}, lips pressed together then releasing with strong puff of air for aspirated bilabial "p [pʰ]", large airflow arrow shown, labeled: 双唇/lips, 送气/aspirated puff, ${NO_BG}` },
  { id:'art_m', label:'m',  ipa:'m',   color:'#1565C0',
    prompt:`${BASE}, lips closed together, airflow redirected through nose for bilabial nasal "m [m]", nasal cavity highlighted, labeled: 双唇/lips closed, 鼻腔/nasal cavity, ${NO_BG}` },
  { id:'art_f', label:'f',  ipa:'f',   color:'#1565C0',
    prompt:`${BASE}, upper teeth lightly touching lower lip for labiodental fricative "f [f]", narrow friction gap with airflow arrow, labeled: 上齿/upper teeth, 下唇/lower lip, ${NO_BG}` },
  { id:'art_d', label:'d',  ipa:'t',   color:'#2E7D32',
    prompt:`${BASE}, tongue tip touching alveolar ridge (upper gum) for unaspirated alveolar stop "d [t]", tongue tip clearly shown at gum ridge, labeled: 舌尖/tongue tip, 齿龈/alveolar ridge, ${NO_BG}` },
  { id:'art_t', label:'t',  ipa:'tʰ',  color:'#2E7D32',
    prompt:`${BASE}, tongue tip touching alveolar ridge then releasing with strong puff for aspirated "t [tʰ]", large airflow arrow after release, labeled: 舌尖/tongue tip, 送气/aspirated, ${NO_BG}` },
  { id:'art_n', label:'n',  ipa:'n',   color:'#2E7D32',
    prompt:`${BASE}, tongue tip touching alveolar ridge, air through nose for alveolar nasal "n [n]", nasal cavity highlighted, labeled: 舌尖/tongue tip, 鼻腔/nasal, ${NO_BG}` },
  { id:'art_l', label:'l',  ipa:'l',   color:'#2E7D32',
    prompt:`${BASE}, tongue tip touching alveolar ridge, air flowing around sides of tongue for lateral "l [l]", side airflow arrows shown, labeled: 舌尖/tongue tip, 侧气流/lateral airflow, ${NO_BG}` },
  { id:'art_g', label:'g',  ipa:'k',   color:'#6A1B9A',
    prompt:`${BASE}, back of tongue raised to touch soft palate (velum) for unaspirated velar stop "g [k]", labeled: 舌根/back of tongue, 软腭/soft palate, ${NO_BG}` },
  { id:'art_k', label:'k',  ipa:'kʰ',  color:'#6A1B9A',
    prompt:`${BASE}, back of tongue touching soft palate then releasing with puff for aspirated velar "k [kʰ]", large airflow arrow, labeled: 舌根/back of tongue, 送气/aspirated, ${NO_BG}` },
  { id:'art_h', label:'h',  ipa:'x',   color:'#6A1B9A',
    prompt:`${BASE}, back of tongue raised near but not touching soft palate, friction gap for velar fricative "h [x]", friction airflow shown, labeled: 舌根/back of tongue, 软腭/soft palate, 摩擦/friction, ${NO_BG}` },
  { id:'art_j', label:'j',  ipa:'tɕ',  color:'#B71C1C',
    prompt:`${BASE}, middle of tongue raised touching hard palate, releasing with affricate for palatal "j [tɕ]", labeled: 舌面/tongue body, 硬腭/hard palate, ${NO_BG}` },
  { id:'art_q', label:'q',  ipa:'tɕʰ', color:'#B71C1C',
    prompt:`${BASE}, middle tongue touching hard palate then releasing with strong puff for aspirated palatal "q [tɕʰ]", large airflow burst, labeled: 舌面/tongue body, 送气/aspirated, ${NO_BG}` },
  { id:'art_x', label:'x',  ipa:'ɕ',   color:'#B71C1C',
    prompt:`${BASE}, middle of tongue raised NEAR but not touching hard palate, narrow friction gap for palatal fricative "x [ɕ]" — like English "sh" but tongue more forward, friction arrows shown, labeled: 舌面/tongue body, 摩擦/friction gap, ${NO_BG}` },
  { id:'art_zh',label:'zh', ipa:'ʈʂ',  color:'#E65100',
    prompt:`${BASE}, tongue tip CURLED BACKWARD toward hard palate (retroflex) for "zh [ʈʂ]", curved tongue shown clearly with tip pointing back and up, labeled: 舌尖后缩/tongue tip curled back, 硬腭/hard palate, ${NO_BG}` },
  { id:'art_ch',label:'ch', ipa:'ʈʂʰ', color:'#E65100',
    prompt:`${BASE}, tongue tip curled backward, releasing with strong puff for aspirated retroflex "ch [ʈʂʰ]", large airflow arrow with curl shown, labeled: 翘舌/retroflex, 送气/aspirated, ${NO_BG}` },
  { id:'art_sh',label:'sh', ipa:'ʂ',   color:'#E65100',
    prompt:`${BASE}, tongue tip curled backward, narrow friction gap for retroflex fricative "sh [ʂ]", friction airflow arrows, labeled: 翘舌/retroflex tongue, 摩擦/friction, ${NO_BG}` },
  { id:'art_r', label:'r',  ipa:'ʐ',   color:'#E65100',
    prompt:`${BASE}, tongue tip curled backward with light friction and voicing for retroflex "r [ʐ]", soft friction arrows, labeled: 翘舌/retroflex, 浊音/voiced, ${NO_BG}` },
  { id:'art_z', label:'z',  ipa:'ts',  color:'#00695C',
    prompt:`${BASE}, tongue tip flat near upper teeth, builds up then releases for alveolar affricate "z [ts]", labeled: 舌尖/tongue tip flat, 上齿/upper teeth, ${NO_BG}` },
  { id:'art_c', label:'c',  ipa:'tsʰ', color:'#00695C',
    prompt:`${BASE}, tongue tip flat near teeth, releasing with strong puff for aspirated "c [tsʰ]", large airflow burst, labeled: 舌尖/tongue tip, 送气/aspirated, ${NO_BG}` },
  { id:'art_s', label:'s',  ipa:'s',   color:'#00695C',
    prompt:`${BASE}, tongue tip flat near upper teeth, narrow groove for alveolar fricative "s [s]", friction arrow, labeled: 舌尖/tongue tip, 摩擦/friction, ${NO_BG}` },
];

// ── Key Finals ───────────────────────────────────────────────────
const FINALS_DIAG = [
  { id:'art_a',  label:'a',  ipa:'a',   color:'#1565C0',
    prompt:`${BASE}, mouth wide open, jaw dropped, tongue flat and low at bottom of mouth for vowel "a [a]", labeled: 开口/open mouth, 舌位低/tongue low, ${NO_BG}` },
  { id:'art_o',  label:'o',  ipa:'o',   color:'#1565C0',
    prompt:`${BASE}, lips rounded into a circle, tongue raised at back for back rounded vowel "o [o]", labeled: 圆唇/rounded lips, 舌根高/tongue back high, ${NO_BG}` },
  { id:'art_e',  label:'e',  ipa:'ɤ',   color:'#1565C0',
    prompt:`${BASE}, mouth half open, tongue raised at back, lips NOT rounded for back unrounded vowel "e [ɤ]" — NOT the Italian "e", labeled: 舌根高/tongue back high, 不圆唇/unrounded, ${NO_BG}` },
  { id:'art_i',  label:'i',  ipa:'i',   color:'#2E7D32',
    prompt:`${BASE}, lips spread wide in a smile, tongue raised high at front for high front vowel "i [i]", labeled: 展唇/spread lips, 舌位高前/tongue high front, ${NO_BG}` },
  { id:'art_u',  label:'u',  ipa:'u',   color:'#2E7D32',
    prompt:`${BASE}, lips rounded and protruded forward, tongue raised at back for high back rounded vowel "u [u]", labeled: 圆唇突出/protruded lips, 舌根高/tongue back high, ${NO_BG}` },
  { id:'art_v',  label:'ü',  ipa:'y',   color:'#2E7D32',
    prompt:`${BASE}, lips rounded like "u" but tongue raised at FRONT like "i" for high front rounded vowel "ü [y]" (like French "u"), labeled: 圆唇/rounded lips, 舌位高前/tongue high front, ${NO_BG}` },
  { id:'art_an', label:'an', ipa:'an',  color:'#B71C1C',
    prompt:`${BASE}, mouth open for "a" then tongue tip rises to alveolar ridge for final nasal "n", showing the transition, labeled: 开口/open, 舌尖鼻音/alveolar nasal closure, ${NO_BG}` },
  { id:'art_en', label:'en', ipa:'ən',  color:'#B71C1C',
    prompt:`${BASE}, reduced schwa position then tongue tip rises for alveolar nasal "n" in "en [ən]", labeled: 央元音/schwa, 舌尖/tongue tip to ridge, ${NO_BG}` },
  { id:'art_in', label:'in', ipa:'in',  color:'#B71C1C',
    prompt:`${BASE}, high front tongue for "i" then tongue tip rises for final nasal "n" in "in [in]", labeled: 舌位高前/tongue front high, 舌尖鼻音/nasal closure, ${NO_BG}` },
  { id:'art_un', label:'un', ipa:'uən', color:'#B71C1C',
    prompt:`${BASE}, lips rounded for "u" then opens to schwa then nasal closure for "un [uən]" — NOT "yun", three-phase movement shown: u → ə → n, labeled: 唇圆/rounded, 央/schwa, 鼻音/nasal, ${NO_BG}` },
  { id:'art_ang',label:'ang',ipa:'aŋ',  color:'#E65100',
    prompt:`${BASE}, mouth open for "a" then back of tongue rises to soft palate for velar nasal "-ng" in "ang [aŋ]", labeled: 开口/open, 舌根软腭/velar nasal closure, ${NO_BG}` },
  { id:'art_eng',label:'eng',ipa:'əŋ',  color:'#E65100',
    prompt:`${BASE}, reduced mid position then back of tongue rises to soft palate for velar nasal in "eng [əŋ]", labeled: 央元音/schwa, 舌根鼻音/velar nasal, ${NO_BG}` },
  { id:'art_ing',label:'ing',ipa:'iŋ',  color:'#E65100',
    prompt:`${BASE}, high front tongue for "i" then back of tongue rises for velar nasal "-ng" in "ing [iŋ]", labeled: 舌位高前/front high, 舌根鼻音/velar nasal, ${NO_BG}` },
  { id:'art_ong',label:'ong',ipa:'ʊŋ',  color:'#E65100',
    prompt:`${BASE}, lips slightly rounded for "o" then back of tongue rises for velar nasal in "ong [ʊŋ]", labeled: 唇圆/rounded, 舌根鼻音/velar nasal, ${NO_BG}` },
];

const ALL_DIAGRAMS = [...INITIALS_DIAG, ...FINALS_DIAG];

const PROVIDERS = [
  { id:'openai',    label:'⚡ DALL-E 3',     desc:'最佳质量' },
  { id:'stability', label:'🎨 Stability AI', desc:'专业插图' },
  { id:'ideogram',  label:'🖼️ Ideogram',     desc:'文字清晰' },
];

function getKey(id) { return localStorage.getItem(`admin_key_${id}`) || ''; }

async function uploadDiagram(blob, id) {
  const path = `articulation/art_${id}_${Date.now()}.png`;
  const { error } = await supabase.storage.from('illustrations')
    .upload(path, blob, { contentType:'image/png', upsert:true });
  if (error) throw error;
  const { data:{ publicUrl } } = supabase.storage.from('illustrations').getPublicUrl(path);
  return publicUrl;
}

async function removeBgCanvas(imgUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width, h = canvas.height;
      const visited = new Uint8Array(w * h);
      function getPixel(x, y) { const i=(y*w+x)*4; return [data[i],data[i+1],data[i+2],data[i+3]]; }
      function diff(a, b) { return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]); }
      const corners = [getPixel(0,0),getPixel(w-1,0),getPixel(0,h-1),getPixel(w-1,h-1),getPixel(Math.floor(w/2),0)];
      const bg = corners.reduce((a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2],a[3]+b[3]]).map(v=>v/corners.length);
      const queue = [[0,0],[w-1,0],[0,h-1],[w-1,h-1]];
      queue.forEach(([x,y])=>{ visited[y*w+x]=1; });
      while (queue.length>0) {
        const [x,y] = queue.pop();
        if (diff(getPixel(x,y), bg) > 35) continue;
        const i=(y*w+x)*4; data[i+3]=0;
        for (const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
          if (nx>=0&&nx<w&&ny>=0&&ny<h) { const ni=ny*w+nx; if (!visited[ni]){visited[ni]=1;queue.push([nx,ny]);} }
        }
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(b=>b?resolve(b):reject(new Error('Failed')), 'image/png');
    };
    img.onerror = reject;
    img.src = imgUrl;
  });
}

function DiagramCard({ item, provider, onDeleted }) {
  const [genUrl,    setGenUrl]    = useState(null);
  const [savedUrl,  setSavedUrl]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [status,    setStatus]    = useState('');
  const [editPrompt,setEditPrompt]= useState(item.prompt);
  const [editColor, setEditColor] = useState(item.color);
  const [expanded,  setExpanded]  = useState(false);

  useEffect(() => {
    supabase.from('jgw_articulation_diagrams').select('image_url')
      .eq('diagram_id', item.id).maybeSingle()
      .then(({ data }) => { if (data?.image_url) setSavedUrl(data.image_url); });
  }, [item.id]);

  async function generate() {
    const key = getKey(provider);
    if (!key) { setStatus('❌ 请在 API Keys 添加密钥'); return; }
    setLoading(true); setStatus('⏳ 生成中…');
    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'generate_word_image',
          word_zh:item.label, meaning_en:editPrompt, provider, client_key:key }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      let url = data.url;
      if (data.base64) {
        const blob = await fetch(`data:image/png;base64,${data.base64}`).then(r=>r.blob());
        url = await uploadDiagram(blob, item.id);
      }
      setGenUrl(url); setStatus('✅ 完成');
    } catch(e) { setStatus('❌ '+e.message); }
    setLoading(false);
  }

  async function removeBg() {
    const url = genUrl||savedUrl; if (!url) return;
    setLoading(true); setStatus('⏳ 去背景…');
    try {
      const blob = await removeBgCanvas(url);
      const newUrl = await uploadDiagram(blob, item.id+'_nobg');
      setGenUrl(newUrl); setStatus('✅ 背景已去除');
    } catch(e) { setStatus('❌ '+e.message); }
    setLoading(false);
  }

  async function save() {
    const url = genUrl||savedUrl; if (!url) return;
    setLoading(true);
    const { error } = await supabase.from('jgw_articulation_diagrams')
      .upsert({ diagram_id:item.id, image_url:url, label:item.label }, { onConflict:'diagram_id' });
    if (error) setStatus('❌ '+error.message);
    else { setSavedUrl(url); setGenUrl(null); setStatus('✅ 已保存'); }
    setLoading(false);
  }

  const preview = genUrl||savedUrl;

  return (
    <div style={{ background:V.card, border:`2px solid ${savedUrl?editColor:V.border}`,
      borderRadius:14, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'8px 12px', background:savedUrl?editColor+'20':'#f9f5ed',
        display:'flex', alignItems:'center', gap:6, borderBottom:`1px solid ${V.border}` }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:editColor, flexShrink:0 }}/>
        <div style={{ flex:1 }}>
          <span style={{ fontSize:20, fontWeight:700, color:editColor, fontFamily:'monospace' }}>
            {item.label}
          </span>
          {item.ipa && (
            <span style={{ fontSize:11, color:V.text3, marginLeft:6, fontFamily:'serif' }}>
              [{item.ipa}]
            </span>
          )}
        </div>
        {savedUrl && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8,
          background:editColor+'22', color:editColor }}>✓</span>}
        <button onClick={()=>onDeleted?.(item.id)}
          style={{ fontSize:11, color:'#c0392b', border:'none', background:'none', cursor:'pointer' }}>✕</button>
      </div>

      {/* Image — checkerboard */}
      <div style={{ height:130,
        backgroundImage:'linear-gradient(45deg,#e0e0e0 25%,transparent 25%),' +
          'linear-gradient(-45deg,#e0e0e0 25%,transparent 25%),' +
          'linear-gradient(45deg,transparent 75%,#e0e0e0 75%),' +
          'linear-gradient(-45deg,transparent 75%,#e0e0e0 75%)',
        backgroundSize:'10px 10px', backgroundPosition:'0 0,0 5px,5px -5px,-5px 0',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {loading ? (
          <div style={{ fontSize:22, opacity:0.4 }}>⏳</div>
        ) : preview ? (
          <img src={preview} alt={item.label}
            style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }}/>
        ) : (
          <div style={{ fontSize:28, opacity:0.15 }}>🦷</div>
        )}
      </div>

      {/* Prompt */}
      <div style={{ padding:'6px 10px', borderBottom:`1px solid ${V.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
          <span style={{ fontSize:9, color:V.text3 }}>Prompt</span>
          <button onClick={()=>setExpanded(e=>!e)}
            style={{ fontSize:9, color:'#1565C0', border:'none', background:'none', cursor:'pointer' }}>
            {expanded?'收起':'编辑'}
          </button>
        </div>
        {expanded ? (
          <>
            <textarea value={editPrompt} onChange={e=>setEditPrompt(e.target.value)}
              rows={3} style={{ width:'100%', fontSize:10, padding:'5px', borderRadius:6,
                border:`1px solid ${V.border}`, resize:'vertical', boxSizing:'border-box',
                fontFamily:'monospace' }}/>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
              <span style={{ fontSize:9, color:V.text3 }}>颜色</span>
              <input type="color" value={editColor} onChange={e=>setEditColor(e.target.value)}
                style={{ width:24, height:20, border:'none', cursor:'pointer', borderRadius:3, padding:0 }}/>
            </div>
          </>
        ) : (
          <div style={{ fontSize:9, color:V.text3, overflow:'hidden',
            whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
            {editPrompt.substring(0,60)}…
          </div>
        )}
      </div>

      {status && (
        <div style={{ padding:'3px 10px', fontSize:10,
          color:status.startsWith('✅')?V.green:status.startsWith('❌')?'#c0392b':V.text3 }}>
          {status}
        </div>
      )}

      {/* Actions */}
      <div style={{ padding:'6px 8px', display:'flex', gap:4 }}>
        <button onClick={generate} disabled={loading}
          style={{ flex:1, padding:'5px 4px', borderRadius:7, cursor:'pointer',
            border:'none', fontSize:10, fontWeight:500,
            background:loading?'#ddd':editColor, color:'#fff' }}>
          {loading?'⏳':'🎨'}
        </button>
        {preview && (
          <button onClick={removeBg} disabled={loading}
            style={{ flex:1, padding:'5px 4px', borderRadius:7, cursor:'pointer',
              border:'none', fontSize:10, background:loading?'#ddd':'#FF6F00', color:'#fff' }}>
            🪄
          </button>
        )}
        {(genUrl||preview) && (
          <button onClick={save} disabled={loading}
            style={{ flex:1, padding:'5px 4px', borderRadius:7, cursor:'pointer',
              border:'none', fontSize:10, background:loading?'#ddd':V.green, color:'#fff' }}>
            💾
          </button>
        )}
      </div>
    </div>
  );
}

export default function ArticulationStudio() {
  const [tab,      setTab]      = useState('initials');
  const [diagrams, setDiagrams] = useState(ALL_DIAGRAMS);
  const [provider, setProvider] = useState('openai');
  const [newId,    setNewId]    = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newIpa,   setNewIpa]   = useState('');
  const [newSounds,setNewSounds]= useState('');
  const [newColor, setNewColor] = useState('#1565C0');
  const [newPrompt,setNewPrompt]= useState('');

  const shown = tab==='initials'
    ? diagrams.filter(d => INITIALS_DIAG.some(x=>x.id===d.id) || (d._custom && d._group==='initials'))
    : tab==='finals'
    ? diagrams.filter(d => FINALS_DIAG.some(x=>x.id===d.id) || (d._custom && d._group==='finals'))
    : diagrams.filter(d => d._custom);

  function addDiagram() {
    if (!newId.trim()||!newLabel.trim()) return;
    const id = 'art_custom_'+newId.trim().toLowerCase().replace(/\s+/g,'_');
    if (diagrams.find(d=>d.id===id)) { alert('ID已存在'); return; }
    setDiagrams(ds=>[...ds,{
      id, label:newLabel, ipa:newIpa, sounds:newSounds, color:newColor,
      prompt:newPrompt||`${BASE}, pronunciation of "${newLabel} [${newIpa||newLabel}]", ${NO_BG}`,
      _custom:true, _group:tab,
    }]);
    setNewId(''); setNewLabel(''); setNewIpa(''); setNewSounds(''); setNewPrompt('');
  }

  function deleteDiagram(id) {
    if (!confirm('删除这个口型图？')) return;
    setDiagrams(ds=>ds.filter(d=>d.id!==id));
    supabase.from('jgw_articulation_diagrams').delete().eq('diagram_id',id);
  }

  const TABS = [
    { id:'initials', label:`声母 (${INITIALS_DIAG.length})` },
    { id:'finals',   label:`韵母 (${FINALS_DIAG.length})` },
    { id:'custom',   label:'自定义' },
  ];

  return (
    <div style={{ maxWidth:920 }}>
      <div style={{ fontSize:15, fontWeight:600, color:V.text, marginBottom:4 }}>
        🦷 口型图工作室 · Articulation Studio
      </div>
      <div style={{ fontSize:12, color:V.text3, marginBottom:12 }}>
        每个声母/韵母独立生成口腔解剖图 · 含 IPA 国际音标
      </div>

      {/* Provider + info */}
      <div style={{ background:V.card, border:`1px solid ${V.border}`,
        borderRadius:12, padding:'10px 14px', marginBottom:12,
        display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <label style={{ fontSize:11, color:V.text2 }}>引擎</label>
        <select value={provider} onChange={e=>setProvider(e.target.value)}
          style={{ padding:'5px 10px', borderRadius:8, border:`1px solid ${V.border}`,
            fontSize:12, background:V.bg }}>
          {PROVIDERS.map(p=>(
            <option key={p.id} value={p.id}>{p.label}{getKey(p.id)?'':' (无密钥)'}</option>
          ))}
        </select>
        <div style={{ fontSize:11, color:V.text3 }}>
          🎨 生成 → 🪄 去背景 → 💾 保存 · 推荐 DALL-E 3
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:14,
        border:`1px solid ${V.border}`, borderRadius:10, overflow:'hidden' }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:'9px 8px', cursor:'pointer', border:'none',
              borderRight:`1px solid ${V.border}`,
              background:tab===t.id?V.verm:V.bg,
              color:tab===t.id?'#fff':V.text2, fontSize:12, fontWeight:tab===t.id?500:400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:10, marginBottom:14 }}>
        {shown.map(item=>(
          <DiagramCard key={item.id} item={item} provider={provider} onDeleted={deleteDiagram}/>
        ))}
      </div>

      {/* Add custom */}
      {tab==='custom' && (
        <div style={{ background:V.card, border:`2px dashed ${V.border}`,
          borderRadius:14, padding:'14px' }}>
          <div style={{ fontSize:13, fontWeight:500, color:V.text, marginBottom:10 }}>＋ 自定义口型图</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
            {[
              ['ID', newId, setNewId, 'my_sound', 80],
              ['名称', newLabel, setNewLabel, 'er', 60],
              ['IPA', newIpa, setNewIpa, 'əɻ', 70],
              ['对应音', newSounds, setNewSounds, 'er', 70],
            ].map(([lbl,val,set,ph,w])=>(
              <div key={lbl}>
                <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:2 }}>{lbl}</label>
                <input value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                  style={{ padding:'6px 8px', borderRadius:7, border:`1px solid ${V.border}`,
                    fontSize:12, width:w }}/>
              </div>
            ))}
            <div>
              <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:2 }}>颜色</label>
              <input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)}
                style={{ width:38, height:30, border:`1px solid ${V.border}`, borderRadius:7, padding:2, cursor:'pointer' }}/>
            </div>
          </div>
          <textarea value={newPrompt} onChange={e=>setNewPrompt(e.target.value)}
            placeholder="Prompt (留空自动生成)" rows={2}
            style={{ width:'100%', padding:'6px 8px', fontSize:11, borderRadius:7,
              border:`1px solid ${V.border}`, boxSizing:'border-box', resize:'vertical', fontFamily:'monospace', marginBottom:8 }}/>
          <button onClick={addDiagram} disabled={!newId.trim()||!newLabel.trim()}
            style={{ padding:'7px 18px', borderRadius:8, cursor:'pointer', border:'none',
              background:(!newId.trim()||!newLabel.trim())?'#ddd':V.verm,
              color:'#fdf6e3', fontSize:12, fontWeight:500 }}>
            ＋ 添加
          </button>
        </div>
      )}
    </div>
  );
}
