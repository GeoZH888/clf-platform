// src/admin/WordsAdminTab.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { THEMES, STARTER_WORDS } from '../data/wordsData';
import { composeWordImage, dataURLtoBlob } from '../utils/imageComposer';

// ── TTS helper: Azure first, browser speechSynthesis fallback ──────────────
async function speakChinese(text) {
  if (!text) return;
  try {
    const res = await fetch('/.netlify/functions/azure-tts-speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang:'zh-CN', voice:'zh-CN-XiaoxiaoNeural' }),
    });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 100 && blob.type.startsWith('audio')) {
        const audio = new Audio(URL.createObjectURL(blob));
        await audio.play(); return;
      }
    }
  } catch { /* fall through */ }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const zh = voices.find(v => v.lang.startsWith('zh') && /Chinese|Mandarin|中文/.test(v.name))
            || voices.find(v => v.lang.startsWith('zh'));
    if (zh) u.voice = zh;
    window.speechSynthesis.speak(u);
  }
}

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  verm:'#8B4513', green:'#2E7D32',
};

const HSK_LEVELS = [
  { id:1, label:'HSK 1', desc:'150词 · 基础',      color:'#2E7D32', bg:'#E8F5E9' },
  { id:2, label:'HSK 2', desc:'300词 · 初级',      color:'#1565C0', bg:'#E3F2FD' },
  { id:3, label:'HSK 3', desc:'600词 · 初中级',    color:'#6A1B9A', bg:'#F3E5F5' },
  { id:4, label:'HSK 4', desc:'1200词 · 中级',     color:'#E65100', bg:'#FFF8E1' },
  { id:5, label:'HSK 5', desc:'2500词 · 中高级',   color:'#B71C1C', bg:'#FFEBEE' },
  { id:6, label:'HSK 6', desc:'5000词 · 高级',     color:'#37474F', bg:'#ECEFF1' },
];

const IMAGE_PROVIDERS = [
  { id:'openai',    label:'DALL-E 3',     icon:'⚡', keyId:'openai' },
  { id:'stability', label:'Stability AI', icon:'🎨', keyId:'stability' },
  { id:'ideogram',  label:'Ideogram',     icon:'🖼️', keyId:'ideogram' },
];

function getAdminKey(providerId) {
  return localStorage.getItem(`admin_key_${providerId}`) || '';
}

async function uploadImageToSupabase(blob, wordZh) {
  // Use timestamp only — no Chinese characters in filename
  const filename = `words/word_${Date.now()}_${Math.random().toString(36).slice(2,6)}.png`;
  const { error } = await supabase.storage
    .from('illustrations')
    .upload(filename, blob, { contentType:'image/png', upsert:true });
  if (error) throw error;
  const { data:{ publicUrl } } = supabase.storage
    .from('illustrations').getPublicUrl(filename);
  return publicUrl;
}

// ── Inline edit row ──────────────────────────────────────────────
function WordRow({ w, imgProvider, onSaved, onDeleted }) {
  const [editing,    setEditing]    = useState(false);
  const [form,       setForm]       = useState({ ...w });
  const [imgLoading, setImgLoading] = useState(false);
  const [urlInput,   setUrlInput]   = useState('');
  const fileRef = useRef();

  async function save() {
    await supabase.from('jgw_words').update({
      word_zh:    form.word_zh,
      pinyin:     form.pinyin,
      meaning_en: form.meaning_en,
      meaning_it: form.meaning_it,
      meaning_zh: form.meaning_zh,
      theme:      form.theme,
      hsk_level:  form.hsk_level,
      example_zh: form.example_zh,
      example_en: form.example_en,
      example_it: form.example_it,
    }).eq('id', w.id);
    setEditing(false);
    onSaved();
  }

  async function composeImage() {
    if (!w.image_url) { alert('Generate or upload an image first.'); return; }
    setImgLoading(true);
    try {
      const composed = await composeWordImage({
        imageUrl:  w.image_url,
        wordZh:    w.word_zh,
        pinyin:    w.pinyin,
        meaning:   w.meaning_en,
        meaningIt: w.meaning_it,
      });
      const blob = dataURLtoBlob(composed);
      const url  = await uploadImageToSupabase(blob, w.word_zh);
      await supabase.from('jgw_words').update({ image_url: url }).eq('id', w.id);
      onSaved();
    } catch(e) { alert('Compose failed: ' + e.message); }
    setImgLoading(false);
  }

  async function generateImage() {
    const key = getAdminKey(imgProvider);
    if (!key) { alert(`Add your ${imgProvider} API key in API Keys tab first.`); return; }
    setImgLoading(true);
    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'generate_word_image', word_zh:w.word_zh,
          meaning_en:w.meaning_en, provider:imgProvider, client_key:key,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      let imageUrl = data.url;
      if (data.base64) {
        const blob = await fetch(`data:image/png;base64,${data.base64}`).then(r=>r.blob());
        imageUrl = await uploadImageToSupabase(blob, w.word_zh);
      }
      await supabase.from('jgw_words').update({ image_url:imageUrl }).eq('id', w.id);
      onSaved();
    } catch(e) { alert('Image generation failed: '+e.message); }
    setImgLoading(false);
  }

  async function saveUrl() {
    const url = urlInput.trim();
    if (!url) return;
    await supabase.from('jgw_words').update({ image_url:url }).eq('id', w.id);
    setUrlInput('');
    onSaved();
  }

  async function handleFile(file) {
    if (!file) return;
    setImgLoading(true);
    try {
      const url = await uploadImageToSupabase(file, w.word_zh);
      await supabase.from('jgw_words').update({ image_url:url }).eq('id', w.id);
      onSaved();
    } catch(e) { alert('Upload failed: '+e.message); }
    setImgLoading(false);
  }

  const hsk = HSK_LEVELS.find(h => h.id === (w.hsk_level||1));

  if (editing) {
    return (
      <tr style={{ background:'#f5f5f5' }}>
        <td colSpan={8} style={{ padding:'10px 12px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            {[
              ['word_zh','汉字'], ['pinyin','拼音'],
              ['meaning_en','English'], ['meaning_it','Italiano'],
              ['meaning_zh','中文释义'], ['example_zh','例句(中)'],
              ['example_en','例句(EN)'], ['example_it','例句(IT)'],
            ].map(([k, label]) => (
              <div key={k}>
                <label style={{ fontSize:10, color:V.text3 }}>{label}</label>
                <input value={form[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                  style={{ width:'100%', padding:'5px 8px', fontSize:12, borderRadius:6,
                    border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
            {/* Theme selector */}
            <div>
              <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>主题</label>
              <select value={form.theme||'general'} onChange={e=>setForm(f=>({...f,theme:e.target.value}))}
                style={{ padding:'5px 8px', borderRadius:6, border:`1px solid ${V.border}`, fontSize:12 }}>
                {THEMES.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.zh}</option>)}
              </select>
            </div>
            {/* HSK level */}
            <div>
              <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>HSK级别</label>
              <select value={form.hsk_level||1} onChange={e=>setForm(f=>({...f,hsk_level:Number(e.target.value)}))}
                style={{ padding:'5px 8px', borderRadius:6, border:`1px solid ${V.border}`, fontSize:12 }}>
                {HSK_LEVELS.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={save}
              style={{ padding:'6px 16px', borderRadius:8, border:'none',
                background:V.green, color:'#fff', fontSize:12, cursor:'pointer' }}>
              💾 保存
            </button>
            <button onClick={()=>setEditing(false)}
              style={{ padding:'6px 14px', borderRadius:8,
                border:`1px solid ${V.border}`, background:V.bg,
                color:V.text2, fontSize:12, cursor:'pointer' }}>
              取消
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr style={{ borderBottom:`1px solid ${V.border}` }}>
        {/* Image thumbnail */}
        <td style={{ padding:'8px 10px', width:52 }}>
          <div style={{ width:44, height:44, borderRadius:8, overflow:'hidden',
            background:'#f0f0f0', border:`1px solid ${V.border}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer' }} onClick={()=>fileRef.current?.click()}>
            {w.image_url
              ? <img src={w.image_url} alt={w.word_zh}
                  style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <span style={{ fontSize:18, color:V.text3 }}>?</span>}
          </div>
          <input type="file" accept="image/*" ref={fileRef} style={{ display:'none' }}
            onChange={e=>handleFile(e.target.files[0])}/>
        </td>

        {/* Word */}
        <td style={{ padding:'8px 6px', fontFamily:"'STKaiti','KaiTi',serif",
          fontSize:18, color:V.text, minWidth:60 }}>{w.word_zh}</td>

        {/* Pinyin */}
        <td style={{ padding:'8px 6px', color:'#1565C0', fontSize:12, minWidth:80 }}>
          {w.pinyin}
        </td>

        {/* Chinese meaning */}
        <td style={{ padding:'8px 6px', fontSize:12, color:V.text2, maxWidth:140,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
          title={w.meaning_zh}>
          {w.meaning_zh || '—'}
        </td>

        {/* Meanings */}
        <td style={{ padding:'8px 6px', fontSize:12, color:V.text2 }}>
          {w.meaning_en}
        </td>
        <td style={{ padding:'8px 6px', fontSize:12, color:V.text3 }}>
          {w.meaning_it}
        </td>

        {/* HSK badge */}
        <td style={{ padding:'8px 6px' }}>
          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10,
            background:hsk?.bg, color:hsk?.color, fontWeight:500, whiteSpace:'nowrap' }}>
            {hsk?.label}
          </span>
        </td>

        {/* Actions */}
        <td style={{ padding:'8px 6px', whiteSpace:'nowrap' }}>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <button onClick={()=>speakChinese(w.word_zh)}
              title="朗读"
              style={{ padding:'3px 8px', fontSize:11, cursor:'pointer',
                borderRadius:6, border:`1px solid ${V.border}`,
                background:'#E1F5FE', color:'#0277BD' }}>🔈</button>
            <button onClick={()=>setEditing(true)}
              style={{ padding:'3px 8px', fontSize:11, cursor:'pointer',
                borderRadius:6, border:`1px solid ${V.border}`,
                background:V.bg, color:V.text2 }}>✏️</button>
            <button onClick={generateImage} disabled={imgLoading}
              style={{ padding:'3px 8px', fontSize:11, cursor:'pointer',
                borderRadius:6, border:'none',
                background:imgLoading?'#ddd':'#7B1FA2', color:'#fff' }}>
              {imgLoading?'⏳':'🎨'}
            </button>
            <button onClick={composeImage} disabled={imgLoading || !w.image_url}
              title="Overlay Chinese text on image"
              style={{ padding:'3px 8px', fontSize:11, cursor:'pointer',
                borderRadius:6, border:'none',
                background:(!w.image_url||imgLoading)?'#ddd':'#E65100',
                color:'#fff' }}>
              {imgLoading?'⏳':'文'}
            </button>
            <button onClick={()=>onDeleted(w.id)}
              style={{ padding:'3px 8px', fontSize:11, cursor:'pointer',
                borderRadius:6, border:'1px solid #ffcccc',
                background:'#fff', color:'#c0392b' }}>✕</button>
          </div>
        </td>
      </tr>

      {/* URL paste row — shown inline */}
      <tr style={{ borderBottom:`1px solid ${V.border}`, background:'#fafafa' }}>
        <td colSpan={8} style={{ padding:'0 10px 6px' }}>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input value={urlInput} onChange={e=>setUrlInput(e.target.value)}
              placeholder="粘贴图片URL · Paste image URL"
              style={{ flex:1, padding:'4px 8px', fontSize:11, borderRadius:6,
                border:`1px solid ${V.border}`, background:'#fff' }}/>
            <button onClick={saveUrl} disabled={!urlInput.trim()}
              style={{ padding:'4px 10px', borderRadius:6, border:'none',
                background:urlInput.trim()?V.green:'#ddd', color:'#fff',
                fontSize:11, cursor:'pointer' }}>保存URL</button>
            {w.image_url && (
              <button onClick={async()=>{
                await supabase.from('jgw_words').update({image_url:null}).eq('id',w.id);
                onSaved();
              }} style={{ padding:'4px 8px', borderRadius:6, border:`1px solid ${V.border}`,
                background:'#fff', color:'#c0392b', fontSize:11, cursor:'pointer' }}>
                🗑 删除图
              </button>
            )}
          </div>
        </td>
      </tr>
    </>
  );
}

// ── Main component ───────────────────────────────────────────────
export default function WordsAdminTab() {
  const [words,      setWords]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [theme,      setTheme]      = useState('greetings');
  const [hskLevel,   setHskLevel]   = useState(1);
  const [count,      setCount]      = useState(10);
  const [aiProvider, setAiProvider] = useState('claude');
  const [imgProvider,setImgProvider]= useState('openai');
  const [status,     setStatus]     = useState('');
  const [preview,    setPreview]    = useState(null);
  const [filterTheme,setFilterTheme]= useState('all');
  const [filterHsk,  setFilterHsk]  = useState(0); // 0 = all
  const [filterImg,  setFilterImg]  = useState(false); // show only without image

  // ── Batch generate images ─────────────────────────────────────
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchStatus,  setBatchStatus]  = useState('');
  const [batchStop,    setBatchStop]    = useState(false);
  const batchStopRef = useRef(false);

  async function batchGenerateImages() {
    const key = getAdminKey(imgProvider);
    if (!key) { alert(`Add your ${imgProvider} API key in API Keys tab first.`); return; }

    const noImage = words.filter(w => !w.image_url);
    if (!noImage.length) { alert('All words already have images!'); return; }
    if (!confirm(`Generate images for ${noImage.length} words? This may take a while.`)) return;

    setBatchRunning(true);
    batchStopRef.current = false;
    setBatchStop(false);

    let done = 0, failed = 0;

    for (const w of noImage) {
      if (batchStopRef.current) break;

      setBatchStatus(`⏳ ${done}/${noImage.length} — 生成 "${w.word_zh}"…`);

      try {
        const res = await fetch('/.netlify/functions/ai-gateway', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            action:'generate_word_image',
            word_zh: w.word_zh,
            meaning_en: w.meaning_en,
            provider: imgProvider,
            client_key: key,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        let imageUrl = data.url;
        if (data.base64) {
          const blob = await fetch(`data:image/png;base64,${data.base64}`).then(r=>r.blob());
          imageUrl = await uploadImageToSupabase(blob, w.word_zh);
        }
        await supabase.from('jgw_words').update({ image_url: imageUrl }).eq('id', w.id);
        done++;

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 1500));
      } catch(e) {
        failed++;
        setBatchStatus(`⚠️ Failed "${w.word_zh}": ${e.message} — continuing…`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    setBatchRunning(false);
    setBatchStatus(`✅ Done! ${done} generated, ${failed} failed.`);
    loadWords();
  }

  async function loadWords() {
    const { data } = await supabase.from('jgw_words').select('*').order('theme,hsk_level');
    setWords(data || []);
    setLoading(false);
  }

  useEffect(() => { loadWords(); }, []);

  async function seedStarterWords() {
    setStatus('⏳ Adding starter words…');
    const existing = words.map(w => w.word_zh);
    const toAdd = STARTER_WORDS.filter(w => !existing.includes(w.word_zh));
    if (!toAdd.length) { setStatus('✅ All starter words already exist.'); return; }
    const { error } = await supabase.from('jgw_words').insert(toAdd);
    if (error) setStatus('❌ '+error.message);
    else { setStatus(`✅ Added ${toAdd.length} starter words.`); loadWords(); }
  }

  async function generateWords() {
    setGenLoading(true); setStatus('⏳ Generating…'); setPreview(null);
    const existing = words.map(w => w.word_zh);
    const themeName = THEMES.find(t=>t.id===theme)?.en || theme;
    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'generate_words', theme:themeName, count,
          exclude:existing, hsk_level:hskLevel, provider:aiProvider,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPreview((data.words||[]).map(w => ({ ...w, theme, hsk_level:hskLevel })));
      setStatus(`✅ Generated ${data.words?.length||0} words. Review and save.`);
    } catch(e) { setStatus('❌ '+e.message); }
    setGenLoading(false);
  }

  async function savePreview() {
    if (!preview?.length) return;
    setStatus('⏳ Saving…');
    const { error } = await supabase.from('jgw_words')
      .insert(preview.map(w => ({ ...w, theme, hsk_level:hskLevel })));
    if (error) setStatus('❌ '+error.message);
    else { setStatus(`✅ Saved ${preview.length} words.`); setPreview(null); loadWords(); }
  }

  async function deleteWord(id) {
    if (!confirm('Delete this word?')) return;
    await supabase.from('jgw_words').delete().eq('id', id);
    loadWords();
  }

  // Filter words
  const filtered = words.filter(w => {
    if (filterTheme !== 'all' && w.theme !== filterTheme) return false;
    if (filterHsk > 0 && w.hsk_level !== filterHsk) return false;
    if (filterImg && w.image_url) return false;
    return true;
  });

  // Group by theme
  const byTheme = {};
  filtered.forEach(w => { if (!byTheme[w.theme]) byTheme[w.theme] = []; byTheme[w.theme].push(w); });

  const withImages = words.filter(w=>w.image_url).length;

  return (
    <div style={{ maxWidth:800 }}>
      <div style={{ fontSize:15, fontWeight:600, color:V.text, marginBottom:16 }}>
        📝 词组管理 · Words Manager
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
        {[
          { label:'总词数',   value:words.length,  color:'#1565C0' },
          { label:'有图片',   value:withImages,     color:V.green },
          { label:'无图片',   value:words.length-withImages, color:'#E65100' },
          { label:'主题数',   value:Object.keys(byTheme).length, color:'#7B1FA2' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:V.card, borderRadius:10,
            padding:'10px', border:`1px solid ${V.border}`, textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:600, color }}>{value}</div>
            <div style={{ fontSize:10, color:V.text3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Add words panel ── */}
      <div style={{ background:V.card, border:`1px solid ${V.border}`,
        borderRadius:12, padding:'14px', marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:500, color:V.text, marginBottom:10 }}>
          添加词组
        </div>

        <button onClick={seedStarterWords}
          style={{ padding:'7px 14px', borderRadius:8, cursor:'pointer',
            border:`1px solid ${V.border}`, background:V.bg,
            color:V.text2, fontSize:12, marginBottom:12 }}>
          📚 添加入门词汇 (20个常用词)
        </button>

        <div style={{ height:1, background:V.border, margin:'10px 0' }}/>
        <div style={{ fontSize:12, color:V.text3, marginBottom:8 }}>🤖 AI生成词组</div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
          {/* Theme */}
          <div>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>主题</label>
            <select value={theme} onChange={e=>setTheme(e.target.value)}
              style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${V.border}`,
                fontSize:12, background:V.bg }}>
              {THEMES.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.zh} · {t.en}</option>)}
            </select>
          </div>
          {/* HSK level */}
          <div>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>HSK级别</label>
            <select value={hskLevel} onChange={e=>setHskLevel(Number(e.target.value))}
              style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${V.border}`,
                fontSize:12, background:V.bg }}>
              {HSK_LEVELS.map(h=><option key={h.id} value={h.id}>{h.label} — {h.desc}</option>)}
            </select>
          </div>
          {/* Count */}
          <div>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>数量</label>
            <input type="number" value={count} min={5} max={30}
              onChange={e=>setCount(Number(e.target.value))}
              style={{ width:64, padding:'6px 8px', borderRadius:8,
                border:`1px solid ${V.border}`, fontSize:12 }}/>
          </div>
          {/* AI text provider */}
          <div>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>
              AI引擎 (文字)
            </label>
            <select value={aiProvider} onChange={e=>setAiProvider(e.target.value)}
              style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${V.border}`,
                fontSize:12, background:V.bg }}>
              <option value="claude">🤖 Claude</option>
              <option value="deepseek">🔍 DeepSeek</option>
              <option value="openai">⚡ GPT-4</option>
              <option value="gemini">✨ Gemini</option>
            </select>
          </div>
        </div>

        <button onClick={generateWords} disabled={genLoading}
          style={{ padding:'8px 20px', borderRadius:8, cursor:'pointer',
            border:'none', background:genLoading?'#ddd':V.verm,
            color:'#fdf6e3', fontSize:13, fontWeight:500 }}>
          {genLoading?'⏳ 生成中…':'🤖 AI生成'}
        </button>

        {status && (
          <div style={{ marginTop:8, fontSize:12,
            color:status.startsWith('✅')?V.green:status.startsWith('❌')?'#c0392b':V.text3 }}>
            {status}
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ background:V.card, border:`2px solid ${V.green}`,
          borderRadius:12, padding:'14px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:500, color:V.green }}>
              预览 — {preview.length} 词 · {THEMES.find(t=>t.id===theme)?.emoji}
              {THEMES.find(t=>t.id===theme)?.zh} · HSK {hskLevel}
            </div>
            <button onClick={savePreview}
              style={{ padding:'7px 16px', borderRadius:8, border:'none',
                background:V.green, color:'#fff', fontSize:12, cursor:'pointer' }}>
              💾 保存全部
            </button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {preview.map((w,i) => (
              <div key={i} style={{ padding:'4px 10px', borderRadius:20,
                background:'#f0f0f0', fontSize:12, color:V.text }}>
                <span style={{ fontFamily:"'STKaiti','KaiTi',serif" }}>{w.word_zh}</span>
                <span style={{ color:'#1565C0', marginLeft:6, fontSize:11 }}>{w.pinyin}</span>
                <span style={{ color:V.text3, marginLeft:6 }}>{w.meaning_en}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div style={{ background:V.card, border:`1px solid ${V.border}`,
        borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
        <div style={{ fontSize:11, color:V.text3, marginBottom:8 }}>🔍 筛选 · Filter</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <select value={filterTheme} onChange={e=>setFilterTheme(e.target.value)}
            style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${V.border}`,
              fontSize:12, background:V.bg }}>
            <option value="all">全部主题</option>
            {THEMES.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.zh}</option>)}
          </select>
          <select value={filterHsk} onChange={e=>setFilterHsk(Number(e.target.value))}
            style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${V.border}`,
              fontSize:12, background:V.bg }}>
            <option value={0}>全部级别</option>
            {HSK_LEVELS.map(h=><option key={h.id} value={h.id}>{h.label}</option>)}
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:6,
            fontSize:12, color:V.text2, cursor:'pointer' }}>
            <input type="checkbox" checked={filterImg}
              onChange={e=>setFilterImg(e.target.checked)}/>
            只显示无图片
          </label>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:11, color:V.text3 }}>图片引擎:</span>
            <select value={imgProvider} onChange={e=>setImgProvider(e.target.value)}
              style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${V.border}`,
                fontSize:12, background:V.bg }}>
              {IMAGE_PROVIDERS.map(p=>(
                <option key={p.id} value={p.id}>
                  {p.icon} {p.label}{getAdminKey(p.keyId)?'':' (no key)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Batch generate */}
        <div style={{ marginTop:10, paddingTop:10,
          borderTop:`1px solid ${V.border}`,
          display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <button
            onClick={batchRunning ? () => { batchStopRef.current=true; setBatchStop(true); } : batchGenerateImages}
            style={{ padding:'8px 16px', borderRadius:8, cursor:'pointer',
              border:'none', fontSize:12, fontWeight:500,
              background: batchRunning ? '#c0392b' : '#7B1FA2',
              color:'#fff' }}>
            {batchRunning ? '⏹ 停止' : `🎨 批量生成图片 (${words.filter(w=>!w.image_url).length}张缺失)`}
          </button>
          {batchStatus && (
            <div style={{ fontSize:12, color:
              batchStatus.startsWith('✅')?V.green:
              batchStatus.startsWith('⚠️')?'#E65100':V.text3 }}>
              {batchStatus}
            </div>
          )}
        </div>

        <div style={{ fontSize:11, color:V.text3, marginTop:6 }}>
          显示 {filtered.length} / {words.length} 词
        </div>
      </div>

      {/* ── Word list by theme ── */}
      {!loading && Object.entries(byTheme).map(([themeId, themeWords]) => {
        const th = THEMES.find(t=>t.id===themeId);
        return (
          <div key={themeId} style={{ background:V.card, border:`1px solid ${V.border}`,
            borderRadius:12, overflow:'hidden', marginBottom:12 }}>
            <div style={{ background:'#f5ede0', padding:'8px 12px',
              display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:18 }}>{th?.emoji||'📚'}</span>
              <span style={{ fontSize:13, fontWeight:500, color:V.text }}>
                {th?.zh||themeId} · {th?.en}
              </span>
              {/* HSK level distribution */}
              <div style={{ display:'flex', gap:4, marginLeft:8 }}>
                {HSK_LEVELS.map(h => {
                  const n = themeWords.filter(w=>w.hsk_level===h.id).length;
                  if (!n) return null;
                  return (
                    <span key={h.id} style={{ fontSize:10, padding:'1px 6px',
                      borderRadius:10, background:h.bg, color:h.color }}>
                      {h.label}:{n}
                    </span>
                  );
                })}
              </div>
              <span style={{ fontSize:11, color:V.text3, marginLeft:'auto' }}>
                {themeWords.length} 词 · {themeWords.filter(w=>w.image_url).length} 🖼
              </span>
            </div>

            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#fafafa' }}>
                  {['图', '汉字', '拼音', '中文', 'English', 'Italiano', 'HSK', '操作'].map(h=>(
                    <th key={h} style={{ padding:'6px 8px', textAlign:'left',
                      fontSize:10, color:V.text3, fontWeight:500,
                      borderBottom:`1px solid ${V.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {themeWords.map(w => (
                  <WordRow key={w.id} w={w} imgProvider={imgProvider}
                    onSaved={loadWords} onDeleted={deleteWord}/>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
