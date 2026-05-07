// src/components/PandaStudio.jsx
// 🐼 Panda Studio — 大卫学中文 · 吉祥物资产 + API Key 管理
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

/* ── Design tokens ──────────────────────────────────────── */
const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  verm:'#8B4513', green:'#2E7D32',
};

/* ── Prompt constants ───────────────────────────────────── */
const NO_BG = `transparent background, no background, isolated panda figure only, PNG with alpha channel, no shadow, no ground, floating character`;
const BASE   = `cute chibi panda mascot, flat vector illustration style, white and black panda, round face, big eyes, chubby body, Chinese language learning app mascot 大卫学中文 David Learns Chinese, simple bold outlines, kawaii style`;

/* ── Inline Panda SVG logo ──────────────────────────────── */
export const PandaLogo = ({ size = 36, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={style}>
    <circle cx="22" cy="24" r="14" fill="#1a1a1a"/>
    <circle cx="78" cy="24" r="14" fill="#1a1a1a"/>
    <circle cx="22" cy="24" r="7" fill="#333"/>
    <circle cx="78" cy="24" r="7" fill="#333"/>
    <circle cx="50" cy="50" r="32" fill="white"/>
    <ellipse cx="37" cy="44" rx="10" ry="9" fill="#1a1a1a" transform="rotate(-10 37 44)"/>
    <ellipse cx="63" cy="44" rx="10" ry="9" fill="#1a1a1a" transform="rotate(10 63 44)"/>
    <circle cx="37" cy="44" r="4.5" fill="white"/>
    <circle cx="63" cy="44" r="4.5" fill="white"/>
    <circle cx="38" cy="45" r="2.5" fill="#1a1a1a"/>
    <circle cx="64" cy="45" r="2.5" fill="#1a1a1a"/>
    <circle cx="39" cy="44" r="1" fill="white"/>
    <circle cx="65" cy="44" r="1" fill="white"/>
    <ellipse cx="50" cy="57" rx="5" ry="3.5" fill="#e8a0a0"/>
    <path d="M44 62 Q50 68 56 62" stroke="#c47070" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <ellipse cx="30" cy="60" rx="7" ry="4" fill="#ffb3b3" opacity="0.4"/>
    <ellipse cx="70" cy="60" rx="7" ry="4" fill="#ffb3b3" opacity="0.4"/>
  </svg>
);

/* ── Default emotions ───────────────────────────────────── */
const DEFAULT_EMOTIONS = [
  { id:'writing',         label:'练字',       color:'#8B4513', prompt:`${BASE}, holding Chinese calligraphy brush, focused happy expression, ${NO_BG}` },
  { id:'pinyin',          label:'拼音',        color:'#1565C0', prompt:`${BASE}, mouth open teaching pronunciation, musical notes floating, ${NO_BG}` },
  { id:'words',           label:'词组',        color:'#2E7D32', prompt:`${BASE}, holding open book with Chinese character, happy reading, ${NO_BG}` },
  { id:'normal',          label:'正常',        color:'#4CAF50', prompt:`${BASE}, neutral happy expression, slight smile, welcoming gesture, ${NO_BG}` },
  { id:'excited',         label:'兴奋',        color:'#FF9800', prompt:`${BASE}, very excited, wide eyes, big smile, arms raised, ${NO_BG}` },
  { id:'sad',             label:'难过',        color:'#2196F3', prompt:`${BASE}, sad droopy eyes, small frown, tear drop, ${NO_BG}` },
  { id:'thinking',        label:'思考',        color:'#9C27B0', prompt:`${BASE}, thinking, paw on chin, thought bubble with dots, ${NO_BG}` },
  { id:'sleeping',        label:'睡觉',        color:'#607D8B', prompt:`${BASE}, sleeping, eyes closed, Z Z Z floating, curled up, ${NO_BG}` },
  { id:'cheering',        label:'加油',        color:'#E91E63', prompt:`${BASE}, cheering, arms raised, fists pumped, huge grin, ${NO_BG}` },
  { id:'surprised',       label:'惊讶',        color:'#FF5722', prompt:`${BASE}, very surprised, wide eyes, mouth open O, paws on cheeks, ${NO_BG}` },
  { id:'mouth_open',      label:'开口 a',      color:'#1565C0', prompt:`${BASE}, mouth wide open showing flat tongue, teaching "a" vowel sound, ${NO_BG}` },
  { id:'mouth_round',     label:'圆唇 o/u',   color:'#7B1FA2', prompt:`${BASE}, lips rounded into a circle like a kiss, teaching "o" or "u" vowel, ${NO_BG}` },
  { id:'mouth_smile',     label:'展唇 i',      color:'#2E7D32', prompt:`${BASE}, lips spread wide in a big smile showing teeth, teaching "i" vowel sound, ${NO_BG}` },
  { id:'mouth_bilabial',  label:'双唇 b/p/m', color:'#8B4513', prompt:`${BASE}, lips pressed together tightly, teaching bilabial consonants b p m, ${NO_BG}` },
  { id:'mouth_alveolar',  label:'舌尖 d/t/n', color:'#E65100', prompt:`${BASE}, tongue tip touching upper gum ridge, teaching d t n l, ${NO_BG}` },
  { id:'mouth_retroflex', label:'翘舌 zh/ch', color:'#B71C1C', prompt:`${BASE}, tongue curled backward, retroflex position, teaching zh ch sh r, ${NO_BG}` },
  { id:'mouth_palatal',   label:'舌面 j/q/x', color:'#00695C', prompt:`${BASE}, tongue middle raised near hard palate, teaching j q x, ${NO_BG}` },
  { id:'mouth_airflow',   label:'气流图',      color:'#1565C0', prompt:`${BASE}, panda professor with cute airflow arrows showing breath direction, ${NO_BG}` },
];

/* ── Built-in image providers (can be extended by user) ── */
const BUILTIN_PROVIDERS = [
  { id:'openai',    label:'DALL-E 3 (OpenAI)',  placeholder:'sk-...',          urlHint:'https://api.openai.com' },
  { id:'stability', label:'Stability AI',        placeholder:'sk-...',          urlHint:'https://api.stability.ai' },
  { id:'ideogram',  label:'Ideogram',            placeholder:'ideogram-key...', urlHint:'https://api.ideogram.ai' },
];

/* ── localStorage helpers ───────────────────────────────── */
const LS_KEYS_KEY = 'panda_studio_api_keys';   // array of {id, label, key, baseUrl}
const LS_ACTIVE   = 'panda_studio_active_provider';

function loadSavedProviders() {
  try { return JSON.parse(localStorage.getItem(LS_KEYS_KEY) || '[]'); } catch { return []; }
}
function saveProviders(arr) { localStorage.setItem(LS_KEYS_KEY, JSON.stringify(arr)); }
function getActiveProvider() { return localStorage.getItem(LS_ACTIVE) || 'openai'; }
function setActiveProvider(id) { localStorage.setItem(LS_ACTIVE, id); }
function getKey(id, saved) {
  const found = saved.find(p => p.id === id);
  return found?.key || '';
}

/* ── Upload helper ──────────────────────────────────────── */
async function uploadToSupabase(supabase, blob, emotionId) {
  const path = `panda/dwxz_panda_${emotionId}_${Date.now()}.png`;
  const { error } = await supabase.storage.from('dwxz_illustrations')
    .upload(path, blob, { contentType:'image/png', upsert:true });
  if (error) throw error;
  const { data:{ publicUrl } } = supabase.storage.from('dwxz_illustrations').getPublicUrl(path);
  return publicUrl;
}

/* ── Background removal ─────────────────────────────────── */
async function removeBgCanvas(imgUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const w = canvas.width, h = canvas.height;
      const visited = new Uint8Array(w * h);
      const getPixel = (x,y) => { const i=(y*w+x)*4; return [data[i],data[i+1],data[i+2],data[i+3]]; };
      const colorDiff = (a,b) => Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]);
      const corners = [getPixel(0,0),getPixel(w-1,0),getPixel(0,h-1),getPixel(w-1,h-1),getPixel(Math.floor(w/2),0)];
      const bgColor = corners.reduce((a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2],a[3]+b[3]]).map(v=>v/corners.length);
      const queue = [[0,0],[w-1,0],[0,h-1],[w-1,h-1]];
      queue.forEach(([x,y])=>{ visited[y*w+x]=1; });
      while (queue.length > 0) {
        const [x,y] = queue.pop();
        if (colorDiff(getPixel(x,y), bgColor) > 40) continue;
        const i=(y*w+x)*4; data[i+3]=0;
        for (const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
          if (nx>=0&&nx<w&&ny>=0&&ny<h) { const ni=ny*w+nx; if (!visited[ni]) { visited[ni]=1; queue.push([nx,ny]); } }
        }
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Failed')), 'image/png');
    };
    img.onerror = reject; img.src = imgUrl;
  });
}

/* ── API Keys Manager Tab ───────────────────────────────── */
function APIKeysTab({ savedProviders, onSaved }) {
  const [providers, setProviders] = useState(savedProviders);
  const [newId,       setNewId]       = useState('');
  const [newLabel,    setNewLabel]    = useState('');
  const [newKey,      setNewKey]      = useState('');
  const [newBaseUrl,  setNewBaseUrl]  = useState('');
  const [showKeys,    setShowKeys]    = useState({});
  const [saved,       setSaved]       = useState(false);

  const inp = {
    padding:'7px 10px', borderRadius:8, border:`1px solid ${V.border}`,
    fontSize:12, background:V.bg, boxSizing:'border-box',
  };

  function addProvider() {
    if (!newId.trim() || !newLabel.trim()) return;
    const id = newId.trim().toLowerCase().replace(/\s+/g,'_');
    const existing = providers.findIndex(p => p.id === id);
    let updated;
    if (existing >= 0) {
      updated = providers.map((p,i) => i===existing
        ? { ...p, label:newLabel, key:newKey, baseUrl:newBaseUrl } : p);
    } else {
      updated = [...providers, { id, label:newLabel, key:newKey, baseUrl:newBaseUrl }];
    }
    setProviders(updated);
    setNewId(''); setNewLabel(''); setNewKey(''); setNewBaseUrl('');
  }

  function removeProvider(id) {
    setProviders(p => p.filter(x => x.id !== id));
  }

  function updateKey(id, val) {
    setProviders(prev => {
      const exists = prev.find(x => x.id === id);
      if (exists) return prev.map(x => x.id === id ? { ...x, key: val } : x);
      const builtin = BUILTIN_PROVIDERS.find(bp => bp.id === id);
      const base = builtin || { id, label: id, placeholder: '', urlHint: '' };
      return [...prev, { ...base, key: val, baseUrl: '' }];
    });
  }

  function updateUrl(id, val) {
    setProviders(prev => {
      const exists = prev.find(x => x.id === id);
      if (exists) return prev.map(x => x.id === id ? { ...x, baseUrl: val } : x);
      const builtin = BUILTIN_PROVIDERS.find(bp => bp.id === id);
      const base = builtin || { id, label: id, placeholder: '', urlHint: '' };
      return [...prev, { ...base, key: '', baseUrl: val }];
    });
  }

  function handleSave() {
    saveProviders(providers);
    onSaved(providers);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Merge builtins display (show placeholder if not in saved)
  const allDisplay = [
    ...BUILTIN_PROVIDERS.map(bp => {
      const saved = providers.find(p => p.id === bp.id);
      return saved || { ...bp, key:'', baseUrl:'' };
    }),
    ...providers.filter(p => !BUILTIN_PROVIDERS.find(bp => bp.id === p.id)),
  ];

  return (
    <div style={{ maxWidth:700 }}>
      <div style={{ fontSize:13, color:V.text3, marginBottom:16 }}>
        所有 API Key 仅存储在本地浏览器（localStorage），不上传到服务器。
        Keys are stored locally in your browser only.
      </div>

      {/* Existing providers */}
      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
        {allDisplay.map(p => (
          <div key={p.id} style={{ background:V.card, border:`1px solid ${V.border}`,
            borderRadius:12, padding:'12px 14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div>
                <span style={{ fontWeight:600, fontSize:13, color:V.text }}>{p.label}</span>
                <span style={{ fontSize:10, color:V.text3, marginLeft:8 }}>ID: {p.id}</span>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span style={{
                  padding:'2px 8px', borderRadius:12, fontSize:11,
                  background: p.key ? '#E8F5E9' : '#FFF3E0',
                  color: p.key ? '#2E7D32' : '#E65100',
                }}>
                  {p.key ? '✅ 已配置' : '⚠️ 未配置'}
                </span>
                {!BUILTIN_PROVIDERS.find(bp => bp.id===p.id) && (
                  <button onClick={()=>removeProvider(p.id)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#c0392b', fontSize:14 }}>
                    ✕
                  </button>
                )}
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:6, alignItems:'center' }}>
              <input
                type={showKeys[p.id] ? 'text' : 'password'}
                value={p.key}
                onChange={e => updateKey(p.id, e.target.value)}
                onPaste={e => {
                  e.stopPropagation();
                  const pasted = e.clipboardData.getData('text');
                  if (pasted) updateKey(p.id, pasted);
                  e.preventDefault();
                }}
                autoComplete="off"
                spellCheck={false}
                placeholder={p.placeholder || 'API Key...'}
                style={{ ...inp, width:'100%', fontFamily:'monospace' }}
              />
              <button onClick={()=>setShowKeys(s=>({...s,[p.id]:!s[p.id]}))}
                style={{ background:'none', border:`1px solid ${V.border}`, borderRadius:8,
                  padding:'6px 10px', cursor:'pointer', fontSize:12, color:V.text3 }}>
                {showKeys[p.id] ? '🙈' : '👁️'}
              </button>
            </div>
            <input
              value={p.baseUrl || ''}
              onChange={e => updateUrl(p.id, e.target.value)}
              placeholder={`Base URL (可选) ${p.urlHint||''}`}
              style={{ ...inp, width:'100%', marginTop:6, color:V.text3 }}
            />
          </div>
        ))}
      </div>

      {/* Add custom provider */}
      <div style={{ background:V.card, border:`2px dashed ${V.border}`,
        borderRadius:12, padding:'14px' }}>
        <div style={{ fontSize:13, fontWeight:500, color:V.text, marginBottom:10 }}>
          ＋ 添加自定义 AI 服务商 / Add Custom Provider
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
          <div>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>ID (英文小写)</label>
            <input value={newId} onChange={e=>setNewId(e.target.value)}
              placeholder="midjourney" style={{ ...inp, width:'100%' }}/>
          </div>
          <div>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>显示名称</label>
            <input value={newLabel} onChange={e=>setNewLabel(e.target.value)}
              placeholder="Midjourney" style={{ ...inp, width:'100%' }}/>
          </div>
        </div>
        <div style={{ marginBottom:8 }}>
          <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>API Key</label>
          <input value={newKey} onChange={e=>setNewKey(e.target.value)}
            type="password" placeholder="sk-..." style={{ ...inp, width:'100%', fontFamily:'monospace' }}/>
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>Base URL (可选)</label>
          <input value={newBaseUrl} onChange={e=>setNewBaseUrl(e.target.value)}
            placeholder="https://api.example.com" style={{ ...inp, width:'100%' }}/>
        </div>
        <button onClick={addProvider}
          disabled={!newId.trim()||!newLabel.trim()}
          style={{ padding:'8px 18px', borderRadius:8, border:'none', cursor:'pointer',
            background:(!newId.trim()||!newLabel.trim())?'#ddd':V.verm,
            color:'#fdf6e3', fontSize:13, fontWeight:500 }}>
          ＋ 添加
        </button>
      </div>

      {/* Save */}
      <button onClick={handleSave}
        style={{ marginTop:16, width:'100%', padding:'11px', borderRadius:10,
          border:'none', cursor:'pointer', fontSize:14, fontWeight:600,
          background: saved ? V.green : V.verm, color:'#fff',
          transition:'background .2s' }}>
        {saved ? '✅ 已保存到本地！' : '💾 保存所有 API Keys'}
      </button>
    </div>
  );
}

/* ── Single emotion card ────────────────────────────────── */
function EmotionCard({ emotion, activeProviderId, savedProviders, onDeleted }) {
  const { supabase } = useAuth();
  const [genUrl,    setGenUrl]    = useState(null);
  const [savedUrl,  setSavedUrl]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [status,    setStatus]    = useState('');
  const [editLabel, setEditLabel] = useState(emotion.label);
  const [editPrompt,setEditPrompt]= useState(emotion.prompt);
  const [editColor, setEditColor] = useState(emotion.color);
  const [expanded,  setExpanded]  = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.from('dwxz_panda_assets').select('image_url')
      .eq('emotion', emotion.id).maybeSingle()
      .then(({ data }) => { if (data?.image_url) setSavedUrl(data.image_url); });
  }, [emotion.id, supabase]);

  async function generate() {
    const key = getKey(activeProviderId, savedProviders);
    if (!key) { setStatus('❌ 请先在 API Keys 标签里配置密钥'); return; }
    setLoading(true); setStatus('⏳ 生成中…');
    try {
      const provider = savedProviders.find(p=>p.id===activeProviderId) || { id:activeProviderId };
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'generate_word_image',
          word_zh: editLabel, meaning_en: editPrompt,
          provider: activeProviderId, client_key: key,
          base_url: provider.baseUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      let url = data.url;
      if (data.base64 && supabase) {
        const blob = await fetch(`data:image/png;base64,${data.base64}`).then(r=>r.blob());
        url = await uploadToSupabase(supabase, blob, emotion.id);
      }
      setGenUrl(url); setStatus('✅ 生成完成，点击 🪄 去背景');
    } catch(e) { setStatus('❌ ' + e.message); }
    setLoading(false);
  }

  async function removeBg() {
    const url = genUrl || savedUrl; if (!url) return;
    setLoading(true); setStatus('⏳ 去背景中…');
    try {
      const blob = await removeBgCanvas(url);
      const publicUrl = await uploadToSupabase(supabase, blob, emotion.id+'_nobg');
      setGenUrl(publicUrl); setStatus('✅ 去背景完成');
    } catch(e) { setStatus('❌ ' + e.message); }
    setLoading(false);
  }

  async function saveOfficial() {
    const url = genUrl || savedUrl; if (!url) return;
    setLoading(true); setStatus('⏳ 保存中…');
    try {
      if (!supabase) throw new Error('Supabase not configured');
      await supabase.from('dwxz_panda_assets').upsert({
        emotion: emotion.id, label: editLabel, color: editColor,
        prompt: editPrompt, image_url: url, updated_at: new Date().toISOString(),
      }, { onConflict: 'emotion' });
      setSavedUrl(url); setStatus('💾 已保存为正式资产');
    } catch(e) { setStatus('❌ ' + e.message); }
    setLoading(false);
  }

  const preview = genUrl || savedUrl;

  return (
    <div style={{ background:V.card, border:`1px solid ${V.border}`, borderRadius:14,
      padding:12, display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:8, height:8, borderRadius:'50%',
            background:savedUrl?'#4CAF50':'#ccc', display:'inline-block' }}/>
          <span style={{ fontSize:13, fontWeight:600, color:editColor,
            fontFamily:"'STKaiti','KaiTi',serif" }}>{editLabel}</span>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={()=>setExpanded(x=>!x)}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:V.text3, padding:'2px 6px' }}>
            {expanded?'▲':'✏️'}
          </button>
          <button onClick={()=>onDeleted(emotion.id)}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#c0392b', padding:'2px 6px' }}>
            ✕
          </button>
        </div>
      </div>

      <div style={{ height:110, background:V.bg, borderRadius:10, display:'flex',
        alignItems:'center', justifyContent:'center', border:`1px dashed ${V.border}`, overflow:'hidden' }}>
        {preview
          ? <img src={preview} alt={editLabel} style={{ maxHeight:100, maxWidth:'100%', objectFit:'contain' }}/>
          : <PandaLogo size={50} style={{ opacity:0.15 }}/>}
      </div>

      {expanded && (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ display:'flex', gap:5 }}>
            <input value={editLabel} onChange={e=>setEditLabel(e.target.value)}
              style={{ flex:1, padding:'4px 7px', borderRadius:7, border:`1px solid ${V.border}`,
                fontSize:12, fontFamily:"'STKaiti','KaiTi',serif" }}/>
            <input type="color" value={editColor} onChange={e=>setEditColor(e.target.value)}
              style={{ width:32, height:28, border:`1px solid ${V.border}`, borderRadius:6, padding:2, cursor:'pointer' }}/>
          </div>
          <textarea value={editPrompt} onChange={e=>setEditPrompt(e.target.value)}
            rows={2} style={{ fontSize:10, padding:'5px 7px', borderRadius:7,
              border:`1px solid ${V.border}`, resize:'vertical', fontFamily:'monospace' }}/>
        </div>
      )}

      {status && (
        <div style={{ fontSize:10, lineHeight:1.3,
          color: status.startsWith('✅')||status.startsWith('💾')?V.green
               : status.startsWith('❌')?'#c0392b':V.text3 }}>
          {status}
        </div>
      )}

      <div style={{ display:'flex', gap:5 }}>
        <button onClick={generate} disabled={loading}
          style={{ flex:2, padding:'6px', borderRadius:8, cursor:'pointer', border:'none',
            fontSize:11, fontWeight:500, background:loading?'#ddd':editColor, color:'#fff' }}>
          🎨 生成
        </button>
        {(genUrl||savedUrl) && (
          <button onClick={removeBg} disabled={loading}
            style={{ flex:1, minWidth:54, padding:'6px', borderRadius:8, cursor:'pointer',
              border:'none', fontSize:11, fontWeight:500, background:loading?'#ddd':'#FF6F00', color:'#fff' }}>
            🪄 去背景
          </button>
        )}
        {(genUrl||preview) && (
          <button onClick={saveOfficial} disabled={loading}
            style={{ flex:1, minWidth:54, padding:'6px', borderRadius:8, cursor:'pointer',
              border:'none', fontSize:11, fontWeight:500, background:loading?'#ddd':V.green, color:'#fff' }}>
            💾 正式
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main PandaStudio ───────────────────────────────────── */
export default function PandaStudio() {
  const { supabase } = useAuth();
  const [studioTab,    setStudioTab]    = useState('studio');   // 'studio' | 'apikeys'
  const [emotions,     setEmotions]     = useState(DEFAULT_EMOTIONS);
  const [savedProviders, setSavedProviders] = useState(loadSavedProviders);
  const [activeProvider, setActiveProvider] = useState(getActiveProvider);
  const [batchRun,     setBatchRun]     = useState(false);
  const [batchStatus,  setBatchStatus]  = useState('');
  const batchStop = { current: false };
  const [newId,     setNewId]     = useState('');
  const [newLabel,  setNewLabel]  = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newColor,  setNewColor]  = useState('#888888');

  // All providers for selector = builtins (with key from saved) + extra custom
  const allProviders = [
    ...BUILTIN_PROVIDERS.map(bp => {
      const s = savedProviders.find(p => p.id === bp.id);
      return { ...bp, key: s?.key || '' };
    }),
    ...savedProviders.filter(p => !BUILTIN_PROVIDERS.find(bp => bp.id === p.id)),
  ];

  function handleProviderChange(id) {
    setActiveProvider(id);
    setActiveProvider(id);
    setActiveProvider(id);
    localStorage.setItem('panda_studio_active_provider', id);
  }

  function addEmotion() {
    if (!newId.trim() || !newLabel.trim()) return;
    const id = newId.trim().toLowerCase().replace(/\s+/g,'_');
    if (emotions.find(e=>e.id===id)) { alert('ID已存在'); return; }
    setEmotions(em=>[...em, { id, label:newLabel, color:newColor,
      prompt: newPrompt || `${BASE}, ${newLabel}, ${NO_BG}` }]);
    setNewId(''); setNewLabel(''); setNewPrompt(''); setNewColor('#888888');
  }

  function deleteEmotion(id) {
    if (!confirm(`删除 "${id}" 这个熊猫情绪？`)) return;
    setEmotions(em=>em.filter(e=>e.id!==id));
    if (supabase) supabase.from('dwxz_panda_assets').delete().eq('emotion', id);
  }

  async function batchGenerate() {
    const key = getKey(activeProvider, savedProviders);
    if (!key) { alert('请先在 API Keys 标签里配置密钥'); return; }
    setBatchRun(true); batchStop.current = false;
    for (let i=0; i<emotions.length; i++) {
      if (batchStop.current) break;
      setBatchStatus(`⏳ ${i+1}/${emotions.length} — ${emotions[i].label}`);
      sessionStorage.setItem('panda_batch_trigger', emotions[i].id);
      await new Promise(r=>setTimeout(r,3000));
    }
    setBatchRun(false); setBatchStatus('✅ 批量完成！请逐个点击 💾 正式 保存');
  }

  const activeKey = getKey(activeProvider, savedProviders);

  return (
    <div style={{ maxWidth:920 }}>
      {/* Studio header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <PandaLogo size={30}/>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:V.text }}>Panda Studio</div>
            <div style={{ fontSize:11, color:V.text3 }}>大卫学中文 · 吉祥物资产中心</div>
          </div>
        </div>
        {/* Tab switcher */}
        <div style={{ display:'flex', gap:4, background:'#f0e8d8', borderRadius:10, padding:3 }}>
          {[
            { id:'studio',  label:'🎨 生成工作台' },
            { id:'apikeys', label:'🔑 API Keys' },
          ].map(tab => (
            <button key={tab.id} onClick={()=>setStudioTab(tab.id)}
              style={{
                padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer',
                fontSize:12, fontWeight:600,
                background: studioTab===tab.id ? V.verm : 'transparent',
                color: studioTab===tab.id ? '#fff' : V.text3,
                transition:'all .15s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── API Keys tab ── */}
      {studioTab === 'apikeys' && (
        <APIKeysTab
          savedProviders={savedProviders}
          onSaved={(updated) => {
            setSavedProviders(updated);
            saveProviders(updated);
          }}
        />
      )}

      {/* ── Studio tab ── */}
      {studioTab === 'studio' && (
        <>
          {/* Controls bar */}
          <div style={{ background:V.card, border:`1px solid ${V.border}`, borderRadius:12,
            padding:'12px 14px', marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>

            {/* Provider selector */}
            <div>
              <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>图片引擎</label>
              <select value={activeProvider} onChange={e=>handleProviderChange(e.target.value)}
                style={{ padding:'6px 10px', borderRadius:8, border:`1px solid ${V.border}`,
                  fontSize:12, background:V.bg }}>
                {allProviders.map(p=>(
                  <option key={p.id} value={p.id}>
                    {p.label}{p.key?' ✅':' ⚠️ 无Key'}
                  </option>
                ))}
              </select>
            </div>

            {/* Key status */}
            <div style={{ fontSize:11, padding:'4px 10px', borderRadius:8,
              background: activeKey ? '#E8F5E9' : '#FFF3E0',
              color: activeKey ? '#2E7D32' : '#E65100', fontWeight:500 }}>
              {activeKey ? '✅ API Key 已配置' : '⚠️ 未配置 Key — 请前往 API Keys 标签'}
            </div>

            {/* Batch */}
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ fontSize:10, color:V.text3 }}>批量操作</span>
              <button onClick={batchRun?()=>{batchStop.current=true;setBatchRun(false);}:batchGenerate}
                style={{ padding:'7px 16px', borderRadius:8, cursor:'pointer', border:'none',
                  background:batchRun?'#c0392b':'#7B1FA2', color:'#fff', fontSize:12, fontWeight:500 }}>
                {batchRun?'⏹ 停止':`🐼 批量生成全部 (${emotions.length}个)`}
              </button>
            </div>
            {batchStatus && (
              <span style={{ fontSize:12,
                color:batchStatus.startsWith('✅')?V.green:batchStatus.startsWith('❌')?'#c0392b':V.text3 }}>
                {batchStatus}
              </span>
            )}
          </div>

          {/* Emotion grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(210px, 1fr))',
            gap:12, marginBottom:16 }}>
            {emotions.map(e=>(
              <EmotionCard key={e.id} emotion={e}
                activeProviderId={activeProvider}
                savedProviders={savedProviders}
                onDeleted={deleteEmotion}/>
            ))}
          </div>

          {/* Add new emotion */}
          <div style={{ background:V.card, border:`2px dashed ${V.border}`, borderRadius:14, padding:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <PandaLogo size={18}/>
              <span style={{ fontSize:13, fontWeight:500, color:V.text }}>添加自定义情绪</span>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
              <div>
                <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>ID (英文)</label>
                <input value={newId} onChange={e=>setNewId(e.target.value)} placeholder="dancing"
                  style={{ padding:'7px 10px', borderRadius:8, border:`1px solid ${V.border}`, fontSize:13, width:110 }}/>
              </div>
              <div>
                <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>名称</label>
                <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} placeholder="跳舞"
                  style={{ padding:'7px 10px', borderRadius:8, border:`1px solid ${V.border}`,
                    fontSize:13, width:80, fontFamily:"'STKaiti','KaiTi',serif" }}/>
              </div>
              <div>
                <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>颜色</label>
                <input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)}
                  style={{ width:44, height:32, border:`1px solid ${V.border}`, borderRadius:8, padding:2, cursor:'pointer' }}/>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>动作描述 (留空则自动生成)</label>
              <textarea value={newPrompt} onChange={e=>setNewPrompt(e.target.value)}
                placeholder={`${BASE}, dancing happily, ${NO_BG}`}
                rows={2} style={{ width:'100%', padding:'7px 10px', fontSize:11,
                  borderRadius:8, border:`1px solid ${V.border}`, boxSizing:'border-box',
                  resize:'vertical', fontFamily:'monospace' }}/>
            </div>
            <button onClick={addEmotion} disabled={!newId.trim()||!newLabel.trim()}
              style={{ padding:'8px 20px', borderRadius:8, cursor:'pointer', border:'none',
                background:(!newId.trim()||!newLabel.trim())?'#ddd':V.verm,
                color:'#fdf6e3', fontSize:13, fontWeight:500 }}>
              ＋ 添加到列表
            </button>
          </div>
        </>
      )}
    </div>
  );
}
