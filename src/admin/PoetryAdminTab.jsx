// src/admin/PoetryAdminTab.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

const V = { bg:'#fdf6e3',card:'#fff',border:'#e8d5b0',text:'#1a0a05',text2:'#6b4c2a',text3:'#a07850',verm:'#8B4513' };
const GOLD = '#C8972A';
const DYNASTIES = ['唐','宋','汉','元','明','清','先秦','魏晋','近代'];
const TYPES = ['五言绝句','七言绝句','五言律诗','七言律诗','词','古风','其他'];

function log_fn(s) { return m => s(p => [`${new Date().toLocaleTimeString()} ${m}`,...p].slice(0,20)); }

export default function PoetryAdminTab() {
  const [poems,     setPoems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [editId,    setEditId]    = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [editSaving,setEditSaving]= useState(false);
  const [genLog,    setGenLog]    = useState([]);
  const [generating,setGenerating]= useState(false);
  const [genDynasty,setGenDynasty]= useState('唐');
  const [genType,   setGenType]   = useState('七言绝句');
  const [genCount,  setGenCount]  = useState(3);
  const [showAdd,   setShowAdd]   = useState(false);
  const [addForm,   setAddForm]   = useState({
    title:'', title_en:'', author:'', dynasty:'唐', type:'七言绝句', difficulty:2,
    lines:['','','',''], translation_zh:'', translation_en:'', translation_it:'',
    notes_zh:'', notes_en:'', background_zh:'', background_en:'', active:true,
  });
  const [preview, setPreview] = useState(null);
  const [imgLoading, setImgLoading] = useState({});
  const [imgProvider,setImgProvider]= useState('stability');
  const [imgStyle,   setImgStyle]   = useState('ink');
  const [textProvider,setTextProvider]= useState('claude');
  const log = log_fn(setGenLog);

  const TEXT_PROVIDERS = [
    { id:'claude',    label:'Claude (Anthropic)', keyId:'anthropic' },
    { id:'openai',    label:'GPT-4o (OpenAI)',    keyId:'openai'    },
    { id:'gemini',    label:'Gemini (Google)',     keyId:'gemini'    },
    { id:'deepseek',  label:'DeepSeek',            keyId:'deepseek'  },
    { id:'qwen',      label:'Qwen 通义千问',        keyId:'qwen'      },
    { id:'grok',      label:'Grok (xAI)',           keyId:'grok'      },
    { id:'mistral',   label:'Mistral',              keyId:'mistral'   },
    { id:'cohere',    label:'Cohere',               keyId:'cohere'    },
  ];
  const IMG_PROVIDERS = [
    { id:'stability', label:'Stability AI',  keyId:'stability' },
    { id:'dalle3',    label:'DALL-E 3',       keyId:'openai'    },
    { id:'ideogram',  label:'Ideogram',       keyId:'ideogram'  },
  ];

  async function generateImage(p) {
    const providerKey = { stability:'stability', dalle3:'openai', ideogram:'ideogram' };
    const key = localStorage.getItem(`admin_key_${providerKey[imgProvider]||imgProvider}`);
    if (!key) { log(`⚠️ 请先保存 ${imgProvider} key`); return; }
    setImgLoading(prev=>({...prev,[p.id]:true}));
    log(`🎨 生成《${p.title}》插图…`);
    const prompt = p.image_prompt ||
      `Traditional Chinese ink painting, ${p.dynasty} dynasty style, illustrating the poem "${p.title}" by ${p.author}. Atmospheric, serene, classical Chinese art, no text.`;
    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'generate_image', provider:imgProvider==='dalle3'?'openai':imgProvider,
          prompt, style:imgStyle, client_key:key,
        }),
      });
      if (!res.ok) { const t = await res.text().catch(()=>''); throw new Error(`${res.status}: ${t.slice(0,80)}`); }
      const d = JSON.parse(await res.text());
      if (d.error) throw new Error(d.error);
      let imageUrl = d.url || (d.base64?`data:image/png;base64,${d.base64}`:'');

      // Upload to Supabase storage bucket 'poem-images'
      if (imageUrl.startsWith('http')) {
        const blob = await fetch(imageUrl).then(r=>r.blob());
        const path = `${p.id}.png`;
        const { error:upErr } = await supabase.storage.from('poem-images').upload(path, blob, { upsert:true });
        if (!upErr) {
          const { data:{ publicUrl } } = supabase.storage.from('poem-images').getPublicUrl(path);
          imageUrl = publicUrl;
        }
      }

      await supabase.from('jgw_poems').update({ image_url:imageUrl }).eq('id',p.id);
      setPoems(prev=>prev.map(x=>x.id===p.id?{...x,image_url:imageUrl}:x));
      log(`✓ 《${p.title}》插图已生成`);
    } catch(e) { log(`✗ ${e.message}`); }
    setImgLoading(prev=>({...prev,[p.id]:false}));
  }

  useEffect(() => { loadPoems(); }, []);

  async function loadPoems() {
    setLoading(true);
    const { data } = await supabase.from('jgw_poems').select('*').order('dynasty').order('sort_order');
    setPoems(data||[]);
    setLoading(false);
  }

  // ── AI batch generate ──────────────────────────────────────────────────────
  async function generate() {
    const provDef = TEXT_PROVIDERS.find(p=>p.id===textProvider);
    const key = localStorage.getItem(`admin_key_${provDef?.keyId||textProvider}`);
    if (!key) { log(`⚠️ 请先保存 ${provDef?.label||textProvider} key`); return; }
    setGenerating(true);
    log(`🤖 [${provDef?.label}] 生成 ${genDynasty}代${genType} × ${genCount} 首…`);

    for (let i = 0; i < genCount; i++) {
      try {
        const existing = poems.map(p=>p.title).join('、');
        const res = await fetch('/.netlify/functions/ai-gateway', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            action:'generate_text', provider:textProvider, client_key:key, max_tokens:1500,
            prompt:`You are a Chinese poetry expert. Generate exactly 1 famous ${genDynasty}代 Chinese ${genType} poem suitable for language learners.
${existing ? `Do NOT use any of these (already added): ${existing.slice(0,120)}` : ''}

Respond with ONLY a JSON object. No explanation, no markdown, no code fences.
Fields required:
- title: poem title in Chinese
- title_en: English title
- author: poet name
- dynasty: "${genDynasty}"
- type: "${genType}"
- difficulty: 2
- lines: array of poem lines (each line as a string)
- pinyin_map: object where key is line index (string), value is array of pinyin per character
- translation_zh: modern Chinese translation
- translation_en: English translation
- translation_it: Italian translation
- background_zh: historical context in Chinese, under 60 characters
- background_en: historical context in English, under 50 words
- background_it: historical context in Italian, under 50 words
- notes_zh: vocabulary notes in Chinese, under 30 characters
- notes_en: brief English notes
- image_prompt: a concise English description for an ink painting illustration of this poem
- sort_order: ${poems.length + i + 1}`,
          }),
        });

        // Handle gateway errors
        if (!res.ok) {
          const errText = await res.text().catch(()=>'');
          log(`✗ 网关错误 ${res.status}: ${errText.slice(0,120)}`);
          continue;
        }

        // Parse gateway response safely
        let d;
        try {
          const bodyText = await res.text();
          if (!bodyText.trim()) { log('✗ 网关返回空响应'); continue; }
          d = JSON.parse(bodyText);
        } catch(e) {
          log(`✗ 网关响应解析失败: ${e.message.slice(0,80)}`);
          continue;
        }

        if (d.error) { log(`✗ AI错误: ${String(d.error).slice(0,100)}`); continue; }

        const rawText = (d.result || d.content || d.text || '').trim();
        if (!rawText) { log('✗ AI返回空内容'); continue; }

        // Extract JSON — handle markdown code fences and leading text
        let jsonStr = rawText.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
        // Find the JSON object boundaries
        const start = jsonStr.indexOf('{');
        const end   = jsonStr.lastIndexOf('}');
        if (start === -1) { log('✗ 响应中未找到JSON'); continue; }
        jsonStr = end > start ? jsonStr.slice(start, end+1) : jsonStr.slice(start);

        // Attempt parse — if fails, try to repair truncated JSON
        let obj;
        try {
          obj = JSON.parse(jsonStr);
        } catch {
          // Repair: find last complete key:value pair
          try {
            let fixed = jsonStr;
            // Remove any trailing incomplete field
            fixed = fixed.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, '');
            fixed = fixed.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, '');
            fixed = fixed.replace(/,\s*$/, '');
            if (!fixed.endsWith('}')) fixed += '}';
            obj = JSON.parse(fixed);
          } catch(e2) {
            log(`✗ JSON解析失败: ${e2.message.slice(0,60)}`);
            continue;
          }
        }

        if (!obj?.title) { log('✗ 解析失败：缺少title字段'); continue; }

        const { data: ins, error } = await supabase.from('jgw_poems')
          .upsert({ ...obj, active:true }, { onConflict:'title,author' }).select().maybeSingle();
        if (error) { log(`✗ ${error.message}`); continue; }
        if (ins) { setPoems(prev => [...prev.filter(p=>p.id!==ins.id), ins]); }
        log(`✓ 《${obj.title}》(${obj.author}) 已保存`);
        await new Promise(r => setTimeout(r, 600));
      } catch(e) { log(`✗ ${e.message}`); }
    }

    log('✅ 生成完成');
    await loadPoems();
    setGenerating(false);
  }

  // ── Manual add ─────────────────────────────────────────────────────────────
  async function addPoem() {
    if (!addForm.title.trim()) return;
    const { data, error } = await supabase.from('jgw_poems')
      .insert({ ...addForm, lines:addForm.lines.filter(l=>l.trim()), sort_order:poems.length+1 })
      .select().maybeSingle();
    if (!error && data) { setPoems(prev=>[data,...prev]); setShowAdd(false); }
    else alert(error?.message);
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  function startEdit(p) {
    setEditId(p.id);
    setEditForm({
      title:p.title||'', title_en:p.title_en||'', author:p.author||'',
      dynasty:p.dynasty||'唐', type:p.type||'',  difficulty:p.difficulty||2,
      lines:p.lines||['','','',''],
      translation_zh:p.translation_zh||'', translation_en:p.translation_en||'',
      translation_it:p.translation_it||'',
      notes_zh:p.notes_zh||'', notes_en:p.notes_en||'',
      background_zh:p.background_zh||'', background_en:p.background_en||'',
      background_it:p.background_it||'',
      image_prompt: p.image_prompt||'',
    });
  }

  async function saveEdit(id) {
    setEditSaving(true);
    await supabase.from('jgw_poems').update(editForm).eq('id',id);
    setPoems(prev=>prev.map(p=>p.id===id?{...p,...editForm}:p));
    setEditId(null); setEditSaving(false);
  }

  async function deletePoem(id,title) {
    if (!confirm(`删除《${title}》？`)) return;
    await supabase.from('jgw_poems').delete().eq('id',id);
    setPoems(prev=>prev.filter(p=>p.id!==id));
  }

  // ── AI generate translation for existing poem ──────────────────────────────
  async function aiTranslate(p) {
    const provDef = TEXT_PROVIDERS.find(x=>x.id===textProvider);
    const key = localStorage.getItem(`admin_key_${provDef?.keyId||textProvider}`);
    if (!key) { log(`⚠️ 请先保存 ${provDef?.label} key`); return; }
    log(`🤖 [${provDef?.label}] 补全《${p.title}》翻译+拼音+背景…`);
    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          action:'generate_text', provider:textProvider, client_key:key, max_tokens:800,
          prompt:`For the Chinese poem "${p.title}" by ${p.author}:
Lines: ${(p.lines||[]).join(' / ')}
Return ONLY JSON (no markdown):
{
  "pinyin_map":{"0":["pinyin","per","char"],"1":["..."]},
  "translation_zh":"现代汉语逐句译文",
  "translation_en":"English line-by-line translation",
  "translation_it":"Traduzione italiana verso per verso",
  "background_zh":"创作背景故事（100字，生动有趣）",
  "background_en":"Historical background and story (80 words)",
  "background_it":"Contesto storico e storia (80 parole)",
  "notes_zh":"字词注释",
  "image_prompt":"A traditional Chinese ink painting illustrating this poem, atmospheric, no text"
}`,
        }),
      });
      const bodyText = await res.text();
      if (!bodyText.trim()) throw new Error('网关返回空响应');
      const d = JSON.parse(bodyText);
      if (d.error) throw new Error(d.error);
      const rawResult = (d.result||d.content||'').replace(/```json|```/g,'').trim();
      const start = rawResult.indexOf('{'), end = rawResult.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('响应中未找到JSON');
      const obj = JSON.parse(rawResult.slice(start, end+1));
      await supabase.from('jgw_poems').update(obj).eq('id',p.id);
      setPoems(prev=>prev.map(x=>x.id===p.id?{...x,...obj}:x));
      log(`✓ 《${p.title}》全部补全完成`);
    } catch(e) { log(`✗ ${e.message}`); }
  }

  // ── SQL hint ───────────────────────────────────────────────────────────────
  const SQL = `CREATE TABLE IF NOT EXISTS jgw_poems (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL, title_en text, author text,
  dynasty text, type text, difficulty int DEFAULT 2,
  lines jsonb DEFAULT '[]',
  pinyin_map jsonb DEFAULT '{}',
  translation_zh text, translation_en text, translation_it text,
  notes_zh text, notes_en text,
  background_zh text, background_en text, background_it text,
  image_url text, image_prompt text, audio_url text,
  active boolean DEFAULT true, sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(title, author)
);
ALTER TABLE jgw_poems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read poems" ON jgw_poems FOR SELECT TO anon USING (active=true);
CREATE POLICY "anon write poems" ON jgw_poems FOR ALL TO anon USING (true) WITH CHECK (true);

-- Supabase Storage bucket (run in Supabase Dashboard → Storage):
-- Create bucket: poem-images (public: true)`;


  return (
    <div style={{ maxWidth:960 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div style={{ fontSize:15, fontWeight:600, color:V.text }}>📜 诗歌管理 ({poems.length}首)</div>
        <button onClick={()=>setShowAdd(s=>!s)}
          style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${GOLD}`,
            background:`${GOLD}15`, color:GOLD, fontSize:12, fontWeight:600, cursor:'pointer' }}>
          ✏️ 手动添加
        </button>
      </div>

      {/* SQL hint */}
      <details style={{ marginBottom:14, background:'#fff', border:`1px solid ${V.border}`, borderRadius:10 }}>
        <summary style={{ padding:'8px 12px', cursor:'pointer', fontSize:12, color:V.text3, fontWeight:600 }}>
          📋 SQL — 首次使用请创建表
        </summary>
        <pre style={{ padding:'0 12px 12px', fontSize:10, color:'#4A148C', overflow:'auto', lineHeight:1.6 }}>{SQL}</pre>
      </details>

      {/* AI generation */}
      <div style={{ background:'#FFF8E1', border:`2px solid ${GOLD}44`, borderRadius:12,
        padding:'14px', marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:600, color:GOLD, marginBottom:12 }}>🤖 AI 批量生成诗歌</div>

        {/* Row 1: Poem settings */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12, alignItems:'flex-end' }}>
          <div>
            <label style={{ fontSize:10, color:'#a07850', display:'block', marginBottom:3 }}>朝代</label>
            <select value={genDynasty} onChange={e=>setGenDynasty(e.target.value)}
              style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${GOLD}44`, fontSize:12 }}>
              {DYNASTIES.map(d=><option key={d} value={d}>{d}代</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:'#a07850', display:'block', marginBottom:3 }}>类型</label>
            <select value={genType} onChange={e=>setGenType(e.target.value)}
              style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${GOLD}44`, fontSize:12 }}>
              {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:10, color:'#a07850', display:'block', marginBottom:3 }}>数量</label>
            <select value={genCount} onChange={e=>setGenCount(Number(e.target.value))}
              style={{ padding:'5px 8px', borderRadius:8, border:`1px solid ${GOLD}44`, fontSize:12 }}>
              {[1,3,5,10].map(n=><option key={n} value={n}>{n}首</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Provider selectors side by side */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          {/* Text provider */}
          <div style={{ background:'#fffaf0', borderRadius:10, padding:'10px 12px',
            border:`1.5px solid ${GOLD}33` }}>
            <div style={{ fontSize:10, fontWeight:600, color:GOLD, marginBottom:6 }}>
              📝 诗歌内容生成引擎
            </div>
            <select value={textProvider} onChange={e=>setTextProvider(e.target.value)}
              style={{ width:'100%', padding:'6px 8px', borderRadius:8,
                border:`1px solid ${GOLD}44`, fontSize:12, background:'#fff' }}>
              {TEXT_PROVIDERS.map(p=>{
                const hasKey = !!localStorage.getItem(`admin_key_${p.keyId}`);
                return <option key={p.id} value={p.id}>{hasKey?'✓ ':''}{p.label}</option>;
              })}
            </select>
            <div style={{ fontSize:10, color:'#a07850', marginTop:5 }}>
              生成诗句、译文、拼音、背景故事
            </div>
          </div>

          {/* Image provider */}
          <div style={{ background:'#fffaf0', borderRadius:10, padding:'10px 12px',
            border:`1.5px solid ${GOLD}33` }}>
            <div style={{ fontSize:10, fontWeight:600, color:GOLD, marginBottom:6 }}>
              🎨 插图生成引擎
            </div>
            <select value={imgProvider} onChange={e=>setImgProvider(e.target.value)}
              style={{ width:'100%', padding:'6px 8px', borderRadius:8,
                border:`1px solid ${GOLD}44`, fontSize:12, background:'#fff' }}>
              {IMG_PROVIDERS.map(p=>{
                const hasKey = !!localStorage.getItem(`admin_key_${p.keyId}`);
                return <option key={p.id} value={p.id}>{hasKey?'✓ ':''}{p.label}</option>;
              })}
            </select>
            <div style={{ fontSize:10, color:'#a07850', marginTop:5 }}>
              为每首诗生成水墨风格插图
            </div>
          </div>
        </div>

        <button onClick={generate} disabled={generating}
          style={{ padding:'9px 24px', borderRadius:10, border:'none', fontWeight:700,
            background:generating?'#E0E0E0':GOLD, color:generating?'#aaa':'#1a0f00',
            fontSize:13, cursor:generating?'default':'pointer' }}>
          {generating?'生成中…':'🚀 开始生成'}
        </button>

        {genLog.length > 0 && (
          <div style={{ background:'#1a0a05', borderRadius:8, padding:'8px 12px', marginTop:10, maxHeight:80, overflowY:'auto' }}>
            {genLog.map((l,i)=>(
              <div key={i} style={{ fontSize:10, color:l.includes('✓')||l.includes('✅')?'#69F0AE':l.includes('✗')?'#FF5252':'#aaa' }}>{l}</div>
            ))}
          </div>
        )}
      </div>

      {/* Manual add form */}
      {showAdd && (
        <div style={{ background:'#FFF8E1', border:`2px solid ${GOLD}44`, borderRadius:12, padding:'14px', marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:600, color:GOLD, marginBottom:10 }}>✏️ 手动添加诗歌</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {[['title','诗名 *'],['title_en','English title'],['author','作者'],['dynasty','朝代']].map(([k,label])=>(
              <div key={k}>
                <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>{label}</label>
                {k==='dynasty'
                  ? <select value={addForm[k]} onChange={e=>setAddForm(f=>({...f,[k]:e.target.value}))}
                      style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${GOLD}44`, fontSize:12, width:'100%' }}>
                      {DYNASTIES.map(d=><option key={d} value={d}>{d}代</option>)}
                    </select>
                  : <input value={addForm[k]} onChange={e=>setAddForm(f=>({...f,[k]:e.target.value}))}
                      style={{ width:'100%', padding:'7px 9px', fontSize:13, borderRadius:8,
                        border:`1px solid ${GOLD}44`, boxSizing:'border-box',
                        ...(k==='title'?{fontFamily:"'STKaiti','KaiTi',serif",fontSize:16}:{}) }}/>
                }
              </div>
            ))}
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>诗句（每行一句）</label>
            {addForm.lines.map((line,i)=>(
              <input key={i} value={line} onChange={e=>setAddForm(f=>({...f,lines:f.lines.map((l,j)=>j===i?e.target.value:l)}))}
                placeholder={`第${i+1}句`}
                style={{ width:'100%', padding:'7px 9px', fontSize:15, borderRadius:8, marginBottom:4,
                  border:`1px solid ${GOLD}44`, boxSizing:'border-box',
                  fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2 }}/>
            ))}
            <button onClick={()=>setAddForm(f=>({...f,lines:[...f.lines,'']}))}
              style={{ fontSize:11, color:GOLD, background:'none', border:`1px solid ${GOLD}44`,
                borderRadius:8, padding:'3px 10px', cursor:'pointer' }}>+ 加一句</button>
          </div>
          <button onClick={addPoem} disabled={!addForm.title.trim()}
            style={{ padding:'8px 20px', borderRadius:9, border:'none',
              background:addForm.title.trim()?GOLD:'#E0E0E0',
              color:addForm.title.trim()?'#1a0f00':'#aaa',
              fontWeight:600, fontSize:13, cursor:'pointer' }}>💾 保存</button>
        </div>
      )}

      {/* Poem list */}
      {loading ? <div style={{ textAlign:'center', color:V.text3, padding:20 }}>加载中…</div> : (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {poems.map(p => (
            <div key={p.id} style={{ background:V.card, border:`1.5px solid ${editId===p.id?GOLD:V.border}`,
              borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'10px 12px', display:'flex', gap:10, alignItems:'center' }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:16, fontWeight:700, fontFamily:"'STKaiti','KaiTi',serif",
                    color:GOLD, marginRight:8 }}>《{p.title}》</span>
                  <span style={{ fontSize:12, color:V.text3 }}>{p.dynasty} · {p.author}</span>
                  {p.type && <span style={{ fontSize:10, background:`${GOLD}15`, color:GOLD,
                    padding:'1px 6px', borderRadius:8, marginLeft:6 }}>{p.type}</span>}
                  {!p.translation_zh && <span style={{ fontSize:10, color:'#E65100', background:'#FFF3E0',
                    padding:'1px 6px', borderRadius:8, marginLeft:6 }}>⚠️ 缺译文</span>}
                  <div style={{ fontSize:12, color:V.text2, marginTop:2 }}>
                    {(p.lines||[]).slice(0,2).join(' / ')}
                  </div>
                </div>
                <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                  {!p.translation_zh && (
                    <button onClick={()=>aiTranslate(p)}
                      style={{ padding:'3px 8px', borderRadius:7, fontSize:10, cursor:'pointer',
                        border:`1px solid ${GOLD}44`, background:`${GOLD}15`, color:GOLD }}>
                      🤖 补全
                    </button>
                  )}
                  <button onClick={()=>generateImage(p)} disabled={imgLoading[p.id]}
                    title="生成插图"
                    style={{ padding:'3px 8px', borderRadius:7, fontSize:10, cursor:'pointer',
                      border:`1px solid ${GOLD}44`, background:p.image_url?`${GOLD}22`:`${GOLD}11`,
                      color:GOLD, opacity:imgLoading[p.id]?0.5:1 }}>
                    {imgLoading[p.id]?'…':p.image_url?'🖼️ 重生':'🎨 生图'}
                  </button>
                  <button onClick={()=>setPreview(preview?.id===p.id?null:p)}
                    style={{ padding:'3px 8px', borderRadius:7, fontSize:10, cursor:'pointer',
                      border:`1px solid ${V.border}`, background:V.bg, color:V.text2 }}>👁</button>
                  <button onClick={()=>editId===p.id?setEditId(null):startEdit(p)}
                    style={{ padding:'3px 8px', borderRadius:7, fontSize:10, cursor:'pointer',
                      border:`1px solid ${editId===p.id?GOLD:V.border}`,
                      background:editId===p.id?GOLD:V.bg, color:editId===p.id?'#fff':V.text2 }}>
                    {editId===p.id?'✕':'✏️'}
                  </button>
                  <button onClick={()=>deletePoem(p.id,p.title)}
                    style={{ padding:'3px 8px', borderRadius:7, fontSize:10, cursor:'pointer',
                      border:'1px solid #FFCDD2', background:'#FFEBEE', color:'#C62828' }}>✕</button>
                </div>
              </div>

              {preview?.id===p.id && (
                <div style={{ borderTop:`1px solid ${V.border}`, padding:'10px 14px',
                  background:'#1a0f00' }}>
                  {p.image_url && (
                    <img src={p.image_url} alt={p.title}
                      style={{ width:'100%', maxHeight:180, objectFit:'cover',
                        borderRadius:10, marginBottom:10, border:`1px solid ${GOLD}33` }}/>
                  )}
                  {(p.lines||[]).map((l,i)=>(
                    <div key={i} style={{ fontSize:18, color:GOLD,
                      fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:3, lineHeight:2, textAlign:'center' }}>{l}</div>
                  ))}
                  {p.translation_zh && <div style={{ fontSize:12, color:'#a07850', marginTop:10, lineHeight:1.8 }}>{p.translation_zh}</div>}
                  {p.background_zh && <div style={{ fontSize:11, color:'#a0785088', marginTop:8, lineHeight:1.7 }}>{p.background_zh}</div>}
                </div>
              )}

              {/* Edit */}
              {editId===p.id && (
                <div style={{ borderTop:`1px solid ${V.border}`, padding:'16px', background:'#fdfaf5' }}>

                  {/* ── Basic info ── */}
                  <div style={{ fontSize:11, fontWeight:700, color:GOLD, marginBottom:8 }}>📝 基本信息</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                    {[['title','诗名'],['title_en','English title'],['author','作者']].map(([k,label])=>(
                      <div key={k}>
                        <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>{label}</label>
                        <input value={editForm[k]||''} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}
                          style={{ width:'100%', padding:'7px 9px', fontSize:k==='title'?16:13, borderRadius:8,
                            border:`1px solid ${V.border}`, boxSizing:'border-box',
                            ...(k==='title'?{fontFamily:"'STKaiti','KaiTi',serif",color:GOLD,fontWeight:700}:{}) }}/>
                      </div>
                    ))}
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>朝代</label>
                      <select value={editForm.dynasty||'唐'} onChange={e=>setEditForm(f=>({...f,dynasty:e.target.value}))}
                        style={{ width:'100%', padding:'7px 9px', borderRadius:8, border:`1px solid ${V.border}`, fontSize:13 }}>
                        {DYNASTIES.map(d=><option key={d} value={d}>{d}代</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>类型</label>
                      <select value={editForm.type||''} onChange={e=>setEditForm(f=>({...f,type:e.target.value}))}
                        style={{ width:'100%', padding:'7px 9px', borderRadius:8, border:`1px solid ${V.border}`, fontSize:13 }}>
                        {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>难度</label>
                      <select value={editForm.difficulty||2} onChange={e=>setEditForm(f=>({...f,difficulty:Number(e.target.value)}))}
                        style={{ width:'100%', padding:'7px 9px', borderRadius:8, border:`1px solid ${V.border}`, fontSize:13 }}>
                        {[1,2,3].map(n=><option key={n} value={n}>{'★'.repeat(n)}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* ── Poem lines ── */}
                  <div style={{ fontSize:11, fontWeight:700, color:GOLD, marginBottom:8 }}>📜 诗句</div>
                  <div style={{ marginBottom:14 }}>
                    {(editForm.lines||[]).map((line,i)=>(
                      <div key={i} style={{ display:'flex', gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:10, color:V.text3, lineHeight:'32px', minWidth:16 }}>{i+1}</span>
                        <input value={line} onChange={e=>setEditForm(f=>({...f,lines:f.lines.map((l,j)=>j===i?e.target.value:l)}))}
                          style={{ flex:1, padding:'6px 10px', fontSize:17, borderRadius:8,
                            border:`1px solid ${V.border}`, boxSizing:'border-box',
                            fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:3, color:'#1a0a05' }}/>
                        <button onClick={()=>setEditForm(f=>({...f,lines:f.lines.filter((_,j)=>j!==i)}))}
                          style={{ padding:'4px 8px', borderRadius:8, border:'1px solid #FFCDD2',
                            background:'#FFEBEE', color:'#C62828', cursor:'pointer', fontSize:11 }}>✕</button>
                      </div>
                    ))}
                    <button onClick={()=>setEditForm(f=>({...f,lines:[...(f.lines||[]),'']}))}
                      style={{ fontSize:11, color:GOLD, background:'none', border:`1px dashed ${GOLD}`,
                        borderRadius:8, padding:'4px 12px', cursor:'pointer', marginTop:4 }}>+ 加一句</button>
                  </div>

                  {/* ── Translations ── */}
                  <div style={{ fontSize:11, fontWeight:700, color:GOLD, marginBottom:8 }}>🌐 译文 Translations</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                    {[['translation_zh','📖 中文译文'],['translation_en','📖 English'],['translation_it','📖 Italiano']].map(([k,label])=>(
                      <div key={k}>
                        <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>{label}</label>
                        <textarea value={editForm[k]||''} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}
                          rows={4} style={{ width:'100%', padding:'7px 9px', fontSize:12, borderRadius:8,
                            border:`1px solid ${V.border}`, boxSizing:'border-box', resize:'vertical',
                            lineHeight:1.7, fontFamily:k==='translation_zh'?"'STKaiti','KaiTi',serif":'inherit' }}/>
                      </div>
                    ))}
                  </div>

                  {/* ── Background stories ── */}
                  <div style={{ fontSize:11, fontWeight:700, color:GOLD, marginBottom:8 }}>🏛 背景故事 Background Stories</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                    {[['background_zh','🇨🇳 中文背景'],['background_en','🇬🇧 English'],['background_it','🇮🇹 Italiano']].map(([k,label])=>(
                      <div key={k}>
                        <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>{label}</label>
                        <textarea value={editForm[k]||''} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}
                          rows={3} style={{ width:'100%', padding:'7px 9px', fontSize:12, borderRadius:8,
                            border:`1px solid ${V.border}`, boxSizing:'border-box', resize:'vertical', lineHeight:1.7 }}/>
                      </div>
                    ))}
                  </div>

                  {/* ── Notes ── */}
                  <div style={{ fontSize:11, fontWeight:700, color:GOLD, marginBottom:8 }}>📝 注解 Notes</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                    {[['notes_zh','中文注解'],['notes_en','English notes']].map(([k,label])=>(
                      <div key={k}>
                        <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>{label}</label>
                        <textarea value={editForm[k]||''} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}
                          rows={2} style={{ width:'100%', padding:'7px 9px', fontSize:12, borderRadius:8,
                            border:`1px solid ${V.border}`, boxSizing:'border-box', resize:'vertical' }}/>
                      </div>
                    ))}
                  </div>

                  {/* ── Image generation ── */}
                  <div style={{ background:'#FFF8E1', borderRadius:12, padding:'12px 14px',
                    border:`1px solid ${GOLD}44`, marginBottom:14 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:GOLD, marginBottom:10 }}>🎨 插图生成</div>
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>
                        🖼 Image prompt（留空则自动生成）
                      </label>
                      <textarea value={editForm.image_prompt||''} onChange={e=>setEditForm(f=>({...f,image_prompt:e.target.value}))}
                        rows={2} placeholder="e.g. Moonlit river, ancient Chinese pavilion, ink wash style, no text"
                        style={{ width:'100%', padding:'7px 9px', fontSize:12, borderRadius:8,
                          border:`1px solid ${GOLD}44`, boxSizing:'border-box', resize:'vertical' }}/>
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
                      <div>
                        <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>AI引擎</label>
                        <select value={imgProvider} onChange={e=>setImgProvider(e.target.value)}
                          style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${GOLD}44`, fontSize:12 }}>
                          {IMG_PROVIDERS.map(ip=>{
                            const hasKey=!!localStorage.getItem(`admin_key_${ip.keyId}`);
                            return <option key={ip.id} value={ip.id}>{hasKey?'✓ ':''}{ip.label}</option>;
                          })}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>风格 Style</label>
                        <select value={imgStyle||'ink'} onChange={e=>setImgStyle(e.target.value)}
                          style={{ padding:'6px 8px', borderRadius:8, border:`1px solid ${GOLD}44`, fontSize:12 }}>
                          {[
                            {id:'ink',       label:'水墨 · Ink wash'},
                            {id:'watercolor',label:'水彩 · Watercolor'},
                            {id:'ukiyo',     label:'浮世绘 · Ukiyo-e'},
                            {id:'gongbi',    label:'工笔 · Gongbi'},
                            {id:'minimal',   label:'极简 · Minimal'},
                            {id:'oil',       label:'油画 · Oil painting'},
                          ].map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </div>
                      <button onClick={()=>generateImage({...p, image_prompt:editForm.image_prompt||p.image_prompt})}
                        disabled={imgLoading[p.id]}
                        style={{ padding:'7px 16px', borderRadius:9, border:'none',
                          background:imgLoading[p.id]?'#E0E0E0':GOLD,
                          color:imgLoading[p.id]?'#aaa':'#1a0f00',
                          fontWeight:700, fontSize:12, cursor:'pointer' }}>
                        {imgLoading[p.id]?'生成中…':'🎨 生成插图'}
                      </button>
                      {p.image_url && (
                        <img src={p.image_url} alt={p.title}
                          style={{ width:56, height:56, objectFit:'cover', borderRadius:8,
                            border:`1px solid ${GOLD}44`, cursor:'zoom-in' }}
                          onClick={()=>setPreview(prev=>prev?.id===p.id?null:p)}/>
                      )}
                    </div>
                  </div>

                  {/* ── Save / Cancel ── */}
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=>saveEdit(p.id)} disabled={editSaving}
                      style={{ padding:'9px 24px', borderRadius:10, border:'none',
                        background:editSaving?'#E0E0E0':GOLD, color:editSaving?'#aaa':'#1a0f00',
                        fontWeight:700, fontSize:13, cursor:'pointer' }}>
                      {editSaving?'保存中…':'💾 保存所有更改'}
                    </button>
                    <button onClick={()=>setEditId(null)}
                      style={{ padding:'9px 14px', borderRadius:10, border:`1px solid ${V.border}`,
                        background:V.bg, color:V.text2, fontSize:13, cursor:'pointer' }}>取消</button>
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
