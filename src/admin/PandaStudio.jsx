// src/admin/PandaStudio.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  verm:'#8B4513', green:'#2E7D32',
};

const NO_BG = `transparent background, no background, isolated panda figure only, PNG with alpha channel, no shadow, no ground, floating character`;

const BASE = `cute chibi panda mascot, flat vector illustration style, white and black panda, round face, big eyes, chubby body, Chinese learning app mascot, simple bold outlines, kawaii style`;

const DEFAULT_EMOTIONS = [
  { id:'writing',        label:'练字',      prompt:`${BASE}, holding Chinese calligraphy brush, focused happy expression, ${NO_BG}`,   color:'#8B4513' },
  { id:'pinyin',         label:'拼音',      prompt:`${BASE}, mouth open teaching pronunciation, musical notes floating, ${NO_BG}`,       color:'#1565C0' },
  { id:'words',          label:'词组',      prompt:`${BASE}, holding open book with Chinese character, happy reading, ${NO_BG}`,         color:'#2E7D32' },
  { id:'normal',         label:'正常',      prompt:`${BASE}, neutral happy expression, slight smile, welcoming gesture, ${NO_BG}`,       color:'#4CAF50' },
  { id:'excited',        label:'兴奋',      prompt:`${BASE}, very excited, wide eyes, big smile, arms raised, ${NO_BG}`,                 color:'#FF9800' },
  { id:'sad',            label:'难过',      prompt:`${BASE}, sad droopy eyes, small frown, tear drop, ${NO_BG}`,                         color:'#2196F3' },
  { id:'thinking',       label:'思考',      prompt:`${BASE}, thinking, paw on chin, thought bubble with dots, ${NO_BG}`,                 color:'#9C27B0' },
  { id:'sleeping',       label:'睡觉',      prompt:`${BASE}, sleeping, eyes closed, Z Z Z floating, curled up, ${NO_BG}`,                color:'#607D8B' },
  { id:'cheering',       label:'加油',      prompt:`${BASE}, cheering, arms raised, fists pumped, huge grin, ${NO_BG}`,                  color:'#E91E63' },
  { id:'surprised',      label:'惊讶',      prompt:`${BASE}, very surprised, wide eyes, mouth open O, paws on cheeks, ${NO_BG}`,         color:'#FF5722' },
  // ── 口型图 · Mouth position pandas ──────────────────────────
  { id:'mouth_open',     label:'开口 a',    prompt:`${BASE}, mouth wide open showing flat tongue, teaching "a" vowel sound, cute educational diagram style, ${NO_BG}`,            color:'#1565C0' },
  { id:'mouth_round',    label:'圆唇 o/u',  prompt:`${BASE}, lips rounded into a circle like a kiss, teaching "o" or "u" vowel, cute panda professor, ${NO_BG}`,                 color:'#7B1FA2' },
  { id:'mouth_smile',    label:'展唇 i',    prompt:`${BASE}, lips spread wide in a big smile showing teeth, teaching "i" vowel sound, ${NO_BG}`,                                  color:'#2E7D32' },
  { id:'mouth_bilabial', label:'双唇 b/p/m',prompt:`${BASE}, lips pressed together tightly, teaching bilabial consonants b p m, cute cross-section view, ${NO_BG}`,              color:'#8B4513' },
  { id:'mouth_alveolar', label:'舌尖 d/t/n',prompt:`${BASE}, tongue tip touching upper gum ridge inside open mouth, teaching d t n l, educational diagram, ${NO_BG}`,            color:'#E65100' },
  { id:'mouth_retroflex',label:'翘舌 zh/ch',prompt:`${BASE}, tongue curled backward not touching palate, retroflex position, teaching zh ch sh r, cute diagram, ${NO_BG}`,       color:'#B71C1C' },
  { id:'mouth_palatal',  label:'舌面 j/q/x',prompt:`${BASE}, tongue middle raised near hard palate, airflow shown with cute arrows, teaching j q x, ${NO_BG}`,                   color:'#00695C' },
  { id:'mouth_airflow',  label:'气流图',    prompt:`${BASE}, panda professor with cute airflow arrows showing breath direction from mouth, teaching pronunciation, ${NO_BG}`,     color:'#1565C0' },
];

const PROVIDERS = [
  { id:'openai',    label:'DALL-E 3' },
  { id:'stability', label:'Stability AI' },
  { id:'ideogram',  label:'Ideogram' },
];

function getKey(id) { return localStorage.getItem(`admin_key_${id}`) || ''; }

async function uploadToSupabase(blob, emotionId) {
  const path = `panda/panda_${emotionId}_${Date.now()}.png`;
  const { error } = await supabase.storage.from('illustrations')
    .upload(path, blob, { contentType:'image/png', upsert:true });
  if (error) throw error;
  const { data:{ publicUrl } } = supabase.storage.from('illustrations').getPublicUrl(path);
  return publicUrl;
}

// Smart background removal — flood fill from corners only
// This preserves the panda's white body
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

      // Sample background color from the 4 corners
      function getPixel(x, y) {
        const i = (y * w + x) * 4;
        return [data[i], data[i+1], data[i+2], data[i+3]];
      }
      function colorDiff(a, b) {
        return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]);
      }

      // Get background color from corners
      const corners = [
        getPixel(0, 0), getPixel(w-1, 0),
        getPixel(0, h-1), getPixel(w-1, h-1),
        getPixel(Math.floor(w/2), 0), // top center
      ];
      const bgColor = corners.reduce((a, b) =>
        [a[0]+b[0], a[1]+b[1], a[2]+b[2], a[3]+b[3]]
      ).map(v => v / corners.length);

      // Flood fill from corners
      const tolerance = 40;
      const queue = [];
      const seeds = [[0,0],[w-1,0],[0,h-1],[w-1,h-1]];
      seeds.forEach(([x,y]) => {
        const idx = y * w + x;
        if (!visited[idx]) { visited[idx] = 1; queue.push([x,y]); }
      });

      while (queue.length > 0) {
        const [x, y] = queue.pop();
        const px = getPixel(x, y);
        if (colorDiff(px, bgColor) > tolerance) continue;

        // Make transparent
        const i = (y * w + x) * 4;
        data[i+3] = 0;

        // Add neighbors
        for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
          if (nx>=0 && nx<w && ny>=0 && ny<h) {
            const ni = ny*w+nx;
            if (!visited[ni]) { visited[ni]=1; queue.push([nx,ny]); }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Failed')), 'image/png');
    };
    img.onerror = reject;
    img.src = imgUrl;
  });
}

// ── Single emotion card ──────────────────────────────────────────
function EmotionCard({ emotion, provider, onSaved, onDeleted }) {
  const [genUrl,   setGenUrl]   = useState(null);
  const [savedUrl, setSavedUrl] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [status,   setStatus]   = useState('');
  const [editLabel,setEditLabel]= useState(emotion.label);
  const [editPrompt,setEditPrompt]= useState(emotion.prompt);
  const [editColor,setEditColor]= useState(emotion.color);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    supabase.from('jgw_panda_assets').select('image_url')
      .eq('emotion', emotion.id).maybeSingle()
      .then(({ data }) => { if (data?.image_url) setSavedUrl(data.image_url); });
  }, [emotion.id]);

  async function generate() {
    const key = getKey(provider);
    if (!key) { setStatus('❌ 请先在 API Keys 中添加密钥'); return; }
    setLoading(true); setStatus('⏳ 生成中…');
    try {
      const finalPrompt = `${editPrompt}, ${NO_BG}`.replace(new RegExp(NO_BG, 'g'), NO_BG); // dedupe
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'generate_word_image',
          word_zh: editLabel,
          meaning_en: finalPrompt,
          provider, client_key: key,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      let url = data.url;
      if (data.base64) {
        const blob = await fetch(`data:image/png;base64,${data.base64}`).then(r=>r.blob());
        url = await uploadToSupabase(blob, emotion.id);
      }
      setGenUrl(url);
      setStatus('✅ 生成完成，点击 🪄 去背景');
    } catch(e) { setStatus('❌ ' + e.message); }
    setLoading(false);
  }

  async function removeBg() {
    const url = genUrl || savedUrl;
    if (!url) return;
    setLoading(true); setStatus('⏳ 去除背景…');
    try {
      const blob = await removeBgCanvas(url);
      const newUrl = await uploadToSupabase(blob, emotion.id + '_nobg');
      setGenUrl(newUrl);
      setStatus('✅ 背景已去除');
    } catch(e) { setStatus('❌ ' + e.message); }
    setLoading(false);
  }

  async function saveOfficial() {
    const url = genUrl || savedUrl;
    if (!url) return;
    setLoading(true);
    const { error } = await supabase.from('jgw_panda_assets')
      .upsert({ emotion: emotion.id, image_url: url }, { onConflict:'emotion' });
    if (error) { setStatus('❌ ' + error.message); }
    else { setSavedUrl(url); setGenUrl(null); setStatus('✅ 已保存为正式'); onSaved?.(); }
    setLoading(false);
  }

  const preview = genUrl || savedUrl;

  return (
    <div style={{ background:V.card, border:`2px solid ${savedUrl ? editColor : V.border}`,
      borderRadius:16, overflow:'hidden' }}>

      {/* Header */}
      <div style={{ padding:'10px 12px', background: savedUrl ? editColor+'18' : '#f9f5ed',
        display:'flex', alignItems:'center', gap:8, borderBottom:`1px solid ${V.border}` }}>
        <div style={{ width:12, height:12, borderRadius:'50%',
          background:editColor, flexShrink:0 }}/>
        <input value={editLabel} onChange={e=>setEditLabel(e.target.value)}
          style={{ flex:1, fontSize:13, fontWeight:500, color:V.text,
            border:'none', background:'transparent', outline:'none',
            fontFamily:"'STKaiti','KaiTi',serif" }}/>
        {savedUrl && <span style={{ fontSize:10, padding:'2px 6px', borderRadius:8,
          background:editColor+'22', color:editColor }}>✓ 已保存</span>}
        <button onClick={() => onDeleted(emotion.id)}
          style={{ fontSize:12, color:'#c0392b', border:'none',
            background:'none', cursor:'pointer', padding:'0 4px' }}>✕</button>
      </div>

      {/* Image preview */}
      <div style={{ height:140, background:'#f0f0f0',
        display:'flex', alignItems:'center', justifyContent:'center',
        position:'relative', overflow:'hidden',
        // Checkerboard pattern to show transparency
        backgroundImage:'linear-gradient(45deg, #ddd 25%, transparent 25%),' +
          'linear-gradient(-45deg, #ddd 25%, transparent 25%),' +
          'linear-gradient(45deg, transparent 75%, #ddd 75%),' +
          'linear-gradient(-45deg, transparent 75%, #ddd 75%)',
        backgroundSize:'12px 12px',
        backgroundPosition:'0 0, 0 6px, 6px -6px, -6px 0px' }}>
        {loading ? (
          <div style={{ textAlign:'center', color:V.text3 }}>
            <div style={{ fontSize:24 }}>🐼</div>
            <div style={{ fontSize:10, marginTop:4 }}>生成中…</div>
          </div>
        ) : preview ? (
          <img src={preview} alt={editLabel}
            style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }}/>
        ) : (
          <span style={{ fontSize:36, opacity:0.3 }}>🐼</span>
        )}
      </div>

      {/* Prompt editor */}
      <div style={{ padding:'8px 10px', borderBottom:`1px solid ${V.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom:4 }}>
          <span style={{ fontSize:10, color:V.text3 }}>动作描述 Prompt</span>
          <button onClick={() => setExpanded(e=>!e)}
            style={{ fontSize:10, color:'#1565C0', border:'none',
              background:'none', cursor:'pointer' }}>
            {expanded ? '收起' : '展开编辑'}
          </button>
        </div>
        {expanded ? (
          <textarea value={editPrompt} onChange={e=>setEditPrompt(e.target.value)}
            rows={3} style={{ width:'100%', fontSize:11, padding:'6px 8px',
              borderRadius:6, border:`1px solid ${V.border}`,
              resize:'vertical', boxSizing:'border-box', fontFamily:'monospace',
              color:V.text2 }}/>
        ) : (
          <div style={{ fontSize:10, color:V.text3, lineHeight:1.4,
            overflow:'hidden', maxHeight:28,
            textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {editPrompt}
          </div>
        )}
        {/* Color picker */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:6 }}>
          <span style={{ fontSize:10, color:V.text3 }}>颜色</span>
          <input type="color" value={editColor} onChange={e=>setEditColor(e.target.value)}
            style={{ width:28, height:22, border:'none', cursor:'pointer',
              borderRadius:4, padding:0 }}/>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div style={{ padding:'4px 10px', fontSize:11,
          color:status.startsWith('✅')?V.green:status.startsWith('❌')?'#c0392b':V.text3,
          borderBottom:`1px solid ${V.border}` }}>
          {status}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ padding:'8px 10px', display:'flex', gap:5, flexWrap:'wrap' }}>
        <button onClick={generate} disabled={loading}
          style={{ flex:1, minWidth:60, padding:'6px', borderRadius:8, cursor:'pointer',
            border:'none', fontSize:11, fontWeight:500,
            background:loading?'#ddd':editColor, color:'#fff' }}>
          {loading?'⏳':'🎨 生成'}
        </button>
        {preview && (
          <button onClick={removeBg} disabled={loading}
            style={{ flex:1, minWidth:60, padding:'6px', borderRadius:8, cursor:'pointer',
              border:'none', fontSize:11, fontWeight:500,
              background:loading?'#ddd':'#FF6F00', color:'#fff' }}>
            🪄 去背景
          </button>
        )}
        {(genUrl || preview) && (
          <button onClick={saveOfficial} disabled={loading}
            style={{ flex:1, minWidth:60, padding:'6px', borderRadius:8, cursor:'pointer',
              border:'none', fontSize:11, fontWeight:500,
              background:loading?'#ddd':V.green, color:'#fff' }}>
            💾 正式
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main PandaStudio ─────────────────────────────────────────────
export default function PandaStudio() {
  const [emotions,   setEmotions]   = useState(DEFAULT_EMOTIONS);
  const [provider,   setProvider]   = useState('openai');
  const [batchRun,   setBatchRun]   = useState(false);
  const [batchStatus,setBatchStatus]= useState('');
  const batchStop = { current: false };

  // New emotion form
  const [newId,    setNewId]    = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newPrompt,setNewPrompt]= useState('');
  const [newColor, setNewColor] = useState('#888888');

  function addEmotion() {
    if (!newId.trim() || !newLabel.trim()) return;
    const id = newId.trim().toLowerCase().replace(/\s+/g,'_');
    if (emotions.find(e=>e.id===id)) { alert('ID已存在'); return; }
    setEmotions(em => [...em, {
      id, label: newLabel, color: newColor,
      prompt: newPrompt || `${BASE}, ${newLabel}, ${NO_BG}`,
    }]);
    setNewId(''); setNewLabel(''); setNewPrompt(''); setNewColor('#888888');
  }

  function deleteEmotion(id) {
    if (!confirm(`删除 "${id}" 这个熊猫情绪？`)) return;
    setEmotions(em => em.filter(e=>e.id!==id));
    // Also remove from DB
    supabase.from('jgw_panda_assets').delete().eq('emotion', id);
  }

  async function batchGenerate() {
    const key = getKey(provider);
    if (!key) { alert('请先在 API Keys 中添加密钥'); return; }
    setBatchRun(true); batchStop.current = false;
    for (let i = 0; i < emotions.length; i++) {
      if (batchStop.current) break;
      const e = emotions[i];
      setBatchStatus(`⏳ ${i+1}/${emotions.length} — ${e.label}`);
      // Trigger individual card generate — use event bus via sessionStorage
      sessionStorage.setItem('panda_batch_trigger', e.id);
      await new Promise(r => setTimeout(r, 3000));
    }
    setBatchRun(false);
    setBatchStatus('✅ 批量完成！请逐个点击 💾 正式 保存');
  }

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ fontSize:15, fontWeight:600, color:V.text, marginBottom:4 }}>
        🐼 Panda Studio
      </div>
      <div style={{ fontSize:12, color:V.text3, marginBottom:16, lineHeight:1.6 }}>
        自定义熊猫情绪和动作 · 无固定数目 · 自动去除背景
      </div>

      {/* Controls */}
      <div style={{ background:V.card, border:`1px solid ${V.border}`,
        borderRadius:12, padding:'12px 14px', marginBottom:16,
        display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
        <div>
          <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>图片引擎</label>
          <select value={provider} onChange={e=>setProvider(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8, border:`1px solid ${V.border}`,
              fontSize:12, background:V.bg }}>
            {PROVIDERS.map(p=>(
              <option key={p.id} value={p.id}>
                {p.label}{getKey(p.id)?'':' (无密钥)'}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <span style={{ fontSize:10, color:V.text3 }}>批量操作</span>
          <button onClick={batchRun ? ()=>{batchStop.current=true;setBatchRun(false);} : batchGenerate}
            style={{ padding:'7px 16px', borderRadius:8, cursor:'pointer', border:'none',
              background:batchRun?'#c0392b':'#7B1FA2', color:'#fff',
              fontSize:12, fontWeight:500 }}>
            {batchRun ? '⏹ 停止' : `🐼 批量生成全部 (${emotions.length}个)`}
          </button>
        </div>
        {batchStatus && (
          <span style={{ fontSize:12,
            color:batchStatus.startsWith('✅')?V.green:batchStatus.startsWith('❌')?'#c0392b':V.text3 }}>
            {batchStatus}
          </span>
        )}
      </div>

      {/* Grid */}
      <div style={{ display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12,
        marginBottom:16 }}>
        {emotions.map(e => (
          <EmotionCard key={e.id} emotion={e} provider={provider}
            onSaved={() => {}} onDeleted={deleteEmotion}/>
        ))}
      </div>

      {/* Add new emotion */}
      <div style={{ background:V.card, border:`2px dashed ${V.border}`,
        borderRadius:14, padding:'16px' }}>
        <div style={{ fontSize:13, fontWeight:500, color:V.text, marginBottom:12 }}>
          ＋ 添加自定义情绪
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
          <div>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>
              ID (英文)
            </label>
            <input value={newId} onChange={e=>setNewId(e.target.value)}
              placeholder="dancing" style={{ padding:'7px 10px', borderRadius:8,
                border:`1px solid ${V.border}`, fontSize:13, width:110 }}/>
          </div>
          <div>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>
              名称
            </label>
            <input value={newLabel} onChange={e=>setNewLabel(e.target.value)}
              placeholder="跳舞" style={{ padding:'7px 10px', borderRadius:8,
                border:`1px solid ${V.border}`, fontSize:13,
                width:80, fontFamily:"'STKaiti','KaiTi',serif" }}/>
          </div>
          <div>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>颜色</label>
            <input type="color" value={newColor} onChange={e=>setNewColor(e.target.value)}
              style={{ width:44, height:32, border:`1px solid ${V.border}`,
                borderRadius:8, padding:2, cursor:'pointer' }}/>
          </div>
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>
            动作描述 (留空则自动生成)
          </label>
          <textarea value={newPrompt} onChange={e=>setNewPrompt(e.target.value)}
            placeholder={`${BASE}, dancing happily, ${NO_BG}`}
            rows={2} style={{ width:'100%', padding:'7px 10px', fontSize:12,
              borderRadius:8, border:`1px solid ${V.border}`, boxSizing:'border-box',
              resize:'vertical', fontFamily:'monospace' }}/>
        </div>
        <button onClick={addEmotion}
          disabled={!newId.trim() || !newLabel.trim()}
          style={{ padding:'8px 20px', borderRadius:8, cursor:'pointer', border:'none',
            background: (!newId.trim()||!newLabel.trim()) ? '#ddd' : V.verm,
            color:'#fdf6e3', fontSize:13, fontWeight:500 }}>
          ＋ 添加到列表
        </button>
      </div>
    </div>
  );
}
