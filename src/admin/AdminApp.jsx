/**
 * src/admin/AdminApp.jsx
 * Full admin panel:
 * - Character manager (add/edit/delete)
 * - AI auto-fill (pinyin, meaning, illustration)
 * - User management
 * - Analytics
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import IllustrationStudio from './IllustrationStudio.jsx';
import AutoPopulate from './AutoPopulate.jsx';
import InviteManager from './InviteManager.jsx';
import PinyinAdminTab from './PinyinAdminTab.jsx';
import WordsAdminTab  from './WordsAdminTab.jsx';
import ChengyuAdminTab from './ChengyuAdminTab.jsx';
import GrammarAdminTab from './GrammarAdminTab.jsx';
import HSKAdminTab     from './HSKAdminTab.jsx';
import ExtractFromCorpusWizard from './ExtractFromCorpusWizard.jsx';
// Phase 2B: 新 Wizard 支持 3 种来源 (corpus / HSK / manual)
import CharacterImportWizard from './CharacterImportWizard.jsx';
// Phase 2C: 批量生图
import BatchIllustrationModal from './BatchIllustrationModal.jsx';
import PoetryAdminTab  from './PoetryAdminTab.jsx';
import ApiKeyManager  from './ApiKeyManager.jsx';
import PandaStudio    from './PandaStudio.jsx';
import AIAnalyticsTab from './AIAnalyticsTab.jsx';
import CorpusTab      from './CorpusTab.jsx';

const V = {
  bg:'#fdf6e3', card:'#fff', border:'#e8d5b0',
  text:'#1a0a05', text2:'#6b4c2a', text3:'#a07850',
  vermillion:'#8B4513',
};

// ── Illustration options (shared with Chengyu tab) ─────────────────────────
const CHAR_IMG_STYLES = [
  { id:'ink',       label:'水墨画',   en:'Ink Wash',      prompt:'traditional Chinese ink wash painting, monochrome brush strokes, minimalist, aged paper texture' },
  { id:'cartoon',   label:'卡通',     en:'Cartoon',       prompt:'flat vector cartoon illustration, bright colors, cute style, simple shapes, educational for children' },
  { id:'oil',       label:'油画',     en:'Oil Painting',  prompt:'oil painting style, rich colors, impressionist brushwork, dramatic lighting' },
  { id:'woodblock', label:'版画',     en:'Woodblock',     prompt:'traditional Chinese woodblock print, bold lines, limited colors, stamp-like texture' },
  { id:'minimal',   label:'简约',     en:'Minimalist',    prompt:'minimalist flat design, clean lines, 2-3 colors only, modern Chinese aesthetic' },
  { id:'jiaguwen',  label:'甲骨文',   en:'Oracle Bone',   prompt:'oracle bone inscription style, ancient Chinese script engraved on bone, reddish-brown tones, rough texture' },
];

const CHAR_IMG_PROVIDERS = [
  { id:'stability',  label:'Stability AI' },
  { id:'dalle3',     label:'DALL-E 3' },
];

// ── TTS helper: Azure first, browser fallback ─────────────────────────────
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

// ── Auth ──────────────────────────────────────────────────────────
function useAdminAuth() {
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) checkAdmin(s.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      if (s) checkAdmin(s.user.id);
      else { setIsAdmin(false); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId) {
    // Check jgw_admins table OR user metadata
    const { data } = await supabase.from('jgw_admins').select('id').eq('user_id', userId).maybeSingle();
    const { data: { user } } = await supabase.auth.getUser();
    const isMeta = user?.user_metadata?.role === 'superadmin';
    setIsAdmin(!!data || isMeta);
    setLoading(false);
  }

  return {
    session, isAdmin, loading,
    signIn:  (email, pw) => supabase.auth.signInWithPassword({ email, password: pw }),
    signOut: () => supabase.auth.signOut(),
  };
}

// ── Login ─────────────────────────────────────────────────────────
function LoginScreen({ onSignIn }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [pandaUrl, setPandaUrl] = useState(null);

  useEffect(() => {
    supabase.from('jgw_panda_assets').select('image_url')
      .then(({ data }) => {
        if (data?.length) {
          const r = data[Math.floor(Math.random() * data.length)];
          setPandaUrl(r.image_url);
        }
      }).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    const { error: err } = await onSignIn(email, password);
    if (err) setError(err.message);
    setBusy(false);
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:V.bg }}>
      <div style={{ width:360, background:V.card, borderRadius:16, padding:'2rem', border:`0.5px solid ${V.border}` }}>
        <div style={{ textAlign:'center', marginBottom:'1.5rem' }}>
          {pandaUrl
            ? <img src={pandaUrl} alt="panda" style={{ width:64, height:64, objectFit:'contain', marginBottom:4, borderRadius:12 }}/>
            : <div style={{ fontSize:36, marginBottom:4 }}>🐼</div>}
          <div style={{ fontSize:18, fontWeight:500, color:V.text }}>大卫学中文 · Admin</div>
          <div style={{ fontSize:11, color:V.text3, marginTop:3 }}>
            David Learns Chinese &nbsp;·&nbsp; David Studia Cinese
          </div>
        </div>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="Admin email" required
            style={{ padding:'10px 12px', fontSize:14, borderRadius:8, border:`0.5px solid ${V.border}`, background:V.card, color:V.text }}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="Password" required
            style={{ padding:'10px 12px', fontSize:14, borderRadius:8, border:`0.5px solid ${V.border}`, background:V.card, color:V.text }}/>
          {error && <div style={{ fontSize:13, color:'#c0392b', padding:'8px 12px', background:'#FFEBEE', borderRadius:8 }}>{error}</div>}
          <button type="submit" disabled={busy}
            style={{ padding:'11px', fontSize:14, fontWeight:500, cursor:'pointer', borderRadius:8, border:'none', background:V.vermillion, color:'#fdf6e3' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Add Character Modal ───────────────────────────────────────────
function AddCharModal({ onClose, onSave }) {
  const [char,   setChar]   = useState('');
  const [pinyin, setPinyin] = useState('');
  const [meaningEn, setMeaningEn] = useState('');
  const [meaningZh, setMeaningZh] = useState('');
  const [meaningIt, setMeaningIt] = useState('');
  const [setId,  setSetId]  = useState('numbers');
  const [type,       setType]       = useState('ideogram');
  const [mnemonicEn, setMnemonicEn] = useState('');
  const [strokeCount,setStrokeCount]= useState('');
  const [loading,    setLoading]    = useState(false);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [aiProvider, setAiProvider] = useState('claude');

  const AI_PROVIDERS = [
    { id: 'claude',   label: 'Claude' },
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'openai',   label: 'GPT-4o' },
    { id: 'gemini',   label: 'Gemini' },
  ];

  const SETS = [
    { id:'numbers', label:'🔢 Numbers' },
    { id:'simple_pictograms', label:'🖼 Pictograms' },
    { id:'nature', label:'🌿 Nature' },
    { id:'compounds', label:'🔀 Compounds' },
    { id:'animals', label:'🐾 Animals' },
    { id:'ritual', label:'🐢 Ritual' },
    { id:'custom', label:'✨ Custom' },
  ];

  const TYPES = ['ideogram','pictogram','compound_ideogram','phono_semantic'];

  // AI auto-fill via universal gateway
  const autoFill = async () => {
    if (!char.trim()) return;
    setAiLoading(true);
    try {
      const res  = await fetch('/.netlify/functions/ai-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fill', provider: aiProvider, character: char.trim() }),
      });
      const raw = await res.text();
      if (!raw) throw new Error('Empty response from server.');
      if (raw.trimStart().startsWith('<')) throw new Error(`Server error (${res.status}) — check Netlify function logs.`);
      const parsed = JSON.parse(raw);
      if (!res.ok || parsed.error) throw new Error(parsed.error || `HTTP ${res.status}`);
      const d = parsed.data || {};
      if (d.pinyin)      setPinyin(d.pinyin);
      if (d.meaning_en)  setMeaningEn(d.meaning_en);
      if (d.meaning_zh)  setMeaningZh(d.meaning_zh);
      if (d.meaning_it)  setMeaningIt(d.meaning_it);
      if (d.mnemonic_en) setMnemonicEn(d.mnemonic_en);
      if (d.stroke_count) setStrokeCount(String(d.stroke_count));
    } catch(e) { alert('AI Fill error: ' + e.message); }
    setAiLoading(false);
  };

  const save = async () => {
    if (!char.trim()) return;
    setLoading(true);
    // Upsert: insert new or update existing character
    const { error } = await supabase.from('jgw_characters').upsert({
      glyph_modern:    char.trim(),
      pinyin,
      meaning_en:      meaningEn,
      meaning_zh:      meaningZh,
      meaning_it:      meaningIt,
      pictograph_type: type,
      mnemonic_en:     mnemonicEn || null,
      set_id:          setId,
      stroke_count:    strokeCount ? parseInt(strokeCount) : null,
      inscription_count: 0,
    }, { onConflict: 'glyph_modern' });
    setLoading(false);
    if (!error) onSave();
    else alert('Error: ' + error.message);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
      <div style={{ background:V.card, borderRadius:16, padding:'1.5rem', width:420, maxHeight:'90vh', overflowY:'auto', border:`1px solid ${V.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:600, color:V.text }}>➕ Add Character</div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:V.text3 }}>×</button>
        </div>

        {/* Character input */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, color:V.text3, display:'block', marginBottom:4 }}>Character *</label>
          <div style={{ display:'flex', gap:8 }}>
            <input value={char} onChange={e=>setChar(e.target.value)}
              placeholder="e.g. 四"
              style={{ flex:1, padding:'10px 12px', fontSize:28, borderRadius:8, border:`1px solid ${V.border}`,
                fontFamily:"'STKaiti','KaiTi',serif", textAlign:'center' }}/>
            <button onClick={autoFill} disabled={!char.trim() || aiLoading}
              style={{ padding:'10px 14px', fontSize:12, cursor:'pointer', borderRadius:8,
                border:'none', background:aiLoading?'#ccc':V.vermillion, color:'#fdf6e3', whiteSpace:'nowrap' }}>
              {aiLoading ? '⏳ AI…' : '✨ AI Fill'}
            </button>
          </div>
          <div style={{ fontSize:11, color:V.text3, marginTop:4 }}>Type any character then click AI Fill to auto-complete</div>
        </div>

        {/* AI Provider selector */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:V.text3, display:'block', marginBottom:6 }}>AI Provider</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {AI_PROVIDERS.map(p => (
              <button key={p.id} type="button" onClick={() => setAiProvider(p.id)}
                style={{ padding:'4px 12px', fontSize:11, cursor:'pointer', borderRadius:20,
                  border:`1px solid ${aiProvider===p.id ? V.vermillion : V.border}`,
                  background: aiProvider===p.id ? V.vermillion : V.bg,
                  color: aiProvider===p.id ? '#fdf6e3' : V.text2,
                  fontWeight: aiProvider===p.id ? 600 : 400 }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {[
          ['Pinyin', pinyin, setPinyin, 'e.g. sì'],
          ['Meaning (EN)', meaningEn, setMeaningEn, 'e.g. four'],
          ['Meaning (中文)', meaningZh, setMeaningZh, 'e.g. 四，数字4'],
          ['Meaning (IT)', meaningIt, setMeaningIt, 'e.g. quattro'],
          ['Mnemonic Story (EN)', mnemonicEn, setMnemonicEn, 'Memory story…'],
          ['Stroke Count', strokeCount, setStrokeCount, 'e.g. 5'],
        ].map(([label, val, setter, ph]) => (
          <div key={label} style={{ marginBottom:10 }}>
            <label style={{ fontSize:12, color:V.text3, display:'block', marginBottom:4 }}>{label}</label>
            <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
              style={{ width:'100%', padding:'8px 12px', fontSize:14, borderRadius:8,
                border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
          </div>
        ))}

        {/* Set + Type */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <div>
            <label style={{ fontSize:12, color:V.text3, display:'block', marginBottom:4 }}>Category</label>
            <select value={setId} onChange={e=>setSetId(e.target.value)}
              style={{ width:'100%', padding:'8px', fontSize:13, borderRadius:8, border:`1px solid ${V.border}` }}>
              {SETS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:12, color:V.text3, display:'block', marginBottom:4 }}>Type</label>
            <select value={type} onChange={e=>setType(e.target.value)}
              style={{ width:'100%', padding:'8px', fontSize:13, borderRadius:8, border:`1px solid ${V.border}` }}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, padding:'10px', cursor:'pointer', borderRadius:8,
            border:`1px solid ${V.border}`, background:V.bg, color:V.text }}>Cancel</button>
          <button onClick={save} disabled={loading || !char.trim()}
            style={{ flex:2, padding:'10px', cursor:'pointer', borderRadius:8,
              border:'none', background:V.vermillion, color:'#fdf6e3', fontWeight:500 }}>
            {loading ? 'Saving…' : '✓ Save Character'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Character Row ─────────────────────────────────────────────────
function CharRow({ char, onIllustrate, onEdit, onDelete }) {
  return (
    <tr style={{ borderBottom:`1px solid ${V.border}` }}>
      <td style={{ padding:'10px 8px', fontSize:28, fontFamily:"'STKaiti','KaiTi',serif", textAlign:'center' }}>{char.glyph_modern}</td>
      <td style={{ padding:'10px 8px', fontSize:13, color:V.text2 }}>{char.pinyin}</td>
      <td style={{ padding:'10px 8px', fontSize:13, color:V.text }}>{char.meaning_en}</td>
      <td style={{ padding:'10px 8px', fontSize:11, color:V.text3 }}>{char.set_id || char.pictograph_type}</td>
      <td style={{ padding:'10px 8px' }}>
        <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10,
          background: char.svg_jiaguwen ? '#e8f5e9' : '#FFF3E0',
          color: char.svg_jiaguwen ? '#2E7D32' : '#E65100' }}>
          {char.svg_jiaguwen ? '✓ SVG' : '○ No SVG'}
        </span>
      </td>
      <td style={{ padding:'10px 8px' }}>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=>onEdit(char)}
            style={{ padding:'4px 10px', fontSize:11, cursor:'pointer', borderRadius:6,
              border:`1px solid ${V.border}`, background:'#fff', color:V.text2 }}>
            ✏️ Edit
          </button>
          <button onClick={()=>onIllustrate(char)}
            style={{ padding:'4px 10px', fontSize:11, cursor:'pointer', borderRadius:6,
              border:`1px solid ${V.vermillion}`, background:'#fff', color:V.vermillion }}>
            🖼 Illus.
          </button>
          <button onClick={()=>onDelete(char)}
            style={{ padding:'4px 10px', fontSize:11, cursor:'pointer', borderRadius:6,
              border:'1px solid #ffcccc', background:'#fff', color:'#c0392b' }}>
            🗑
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Edit Character Modal ──────────────────────────────────────────
function EditCharModal({ char, onClose, onSave }) {
  const [pinyin,     setPinyin]     = useState(char.pinyin     || '');
  const [meaningEn,  setMeaningEn]  = useState(char.meaning_en || '');
  const [meaningZh,  setMeaningZh]  = useState(char.meaning_zh || '');
  const [meaningIt,  setMeaningIt]  = useState(char.meaning_it || '');
  const [mnemonicEn, setMnemonicEn] = useState(char.mnemonic_en|| '');
  const [mnemonicZh, setMnemonicZh] = useState(char.mnemonic_zh|| '');
  const [mnemonicIt, setMnemonicIt] = useState(char.mnemonic_it|| '');
  const [strokeCount,setStrokeCount]= useState(String(char.stroke_count || ''));
  const [setId,      setSetId]      = useState(char.set_id     || 'simple_pictograms');
  const [type,       setType]       = useState(char.pictograph_type || 'pictogram');
  const [difficulty, setDifficulty] = useState(char.difficulty || 1);
  const [loading,    setLoading]    = useState(false);

  // Illustration state
  const [imageUrl,    setImageUrl]    = useState(char.image_url  || '');
  const [imgStyle,    setImgStyle]    = useState('cartoon');
  const [imgProv,     setImgProv]     = useState('stability');
  const [imgLoading,  setImgLoading]  = useState(false);
  const [imgStatus,   setImgStatus]   = useState('');
  const [visualDesc,  setVisualDesc]  = useState(char.visual_description || '');  // saved to DB
  const [customPrompt, setCustomPrompt] = useState('');  // live-editable, NOT saved
  const [promptDirty, setPromptDirty] = useState(false);  // true once user edits

  // Build the default prompt from meaning_en + visual_description + style
  function buildDefaultPrompt() {
    const styleObj = CHAR_IMG_STYLES.find(s => s.id === imgStyle);
    const meaning  = (meaningEn || '').replace(/[";]/g, '').trim();
    const visual   = (visualDesc || '').replace(/[";]/g, '').trim();

    const base = visual
      ? `A visual illustration showing: ${visual}. (Context: this represents ${meaning || 'a Chinese character'}.)`
      : meaning
        ? `A visual illustration representing: ${meaning}.`
        : 'A visual illustration of a simple concept.';
    return `${base} ${styleObj.prompt}. Focus on visually depicting the meaning, not writing or text. Clean composition, educational illustration, centered subject on simple background.`;
  }

  // Auto-refresh prompt preview whenever inputs change (but only if user hasn't manually edited)
  useEffect(() => {
    if (!promptDirty) setCustomPrompt(buildDefaultPrompt());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meaningEn, visualDesc, imgStyle]);

  function resetPrompt() {
    setCustomPrompt(buildDefaultPrompt());
    setPromptDirty(false);
  }

  async function handleGenerateIllustration() {
    const styleObj = CHAR_IMG_STYLES.find(s => s.id === imgStyle);
    setImgLoading(true);
    setImgStatus('生成中…');
    try {
      // ── Build meaning-centric prompt ──
      // Lead with the SEMANTIC meaning (what the character represents), not the character itself.
      // Stability tends to fixate on Chinese glyphs if mentioned — so we describe the CONCEPT instead.
      // Use customPrompt (which may be user-edited or auto-generated)
      const prompt = (customPrompt && customPrompt.trim()) || buildDefaultPrompt();

      if (!prompt || prompt.length < 20) {
        setImgStatus('✗ 提示词太短，请检查 Meaning/Visual description');
        setImgLoading(false);
        setTimeout(() => setImgStatus(''), 4000);
        return;
      }

      // Heavy negative prompt — block what Stability tends to hallucinate
      const negative_prompt = 'text, letters, words, writing, calligraphy, Chinese characters, glyphs, symbols, watermark, signature, logo, multiple subjects, collage, blurry, low quality, distorted, deformed';

      let storedUrl;
      if (imgProv === 'stability') {
        const res = await fetch('/.netlify/functions/stability-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, negative_prompt, width:512, height:512 }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        const blob = await fetch(`data:image/png;base64,${d.image_base64}`).then(r => r.blob());
        const path = `char_${char.id}_${imgStyle}_${Date.now()}.png`;
        const { error: upErr } = await supabase.storage
          .from('illustrations').upload(path, blob, { upsert: true, contentType:'image/png' });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('illustrations').getPublicUrl(path);
        storedUrl = publicUrl;
      } else {
        // dalle3 via ai-gateway
        const res = await fetch('/.netlify/functions/ai-gateway', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action:'generate_image', provider:'openai', prompt }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        storedUrl = d.url || d.image_url;
      }
      setImageUrl(storedUrl);
      await supabase.from('jgw_characters')
        .update({ image_url: storedUrl }).eq('id', char.id);
      setImgStatus('✓ 插图已生成');
    } catch (e) {
      setImgStatus(`✗ ${e.message}`);
    } finally {
      setImgLoading(false);
      setTimeout(() => setImgStatus(''), 4000);
    }
  }

  async function handleRemoveImage() {
    if (!confirm('确定删除插图？')) return;
    setImageUrl('');
    await supabase.from('jgw_characters').update({ image_url: null }).eq('id', char.id);
  }

  async function handleUrlPaste(e) {
    const url = e.target.value.trim();
    if (!url) return;
    setImageUrl(url);
    await supabase.from('jgw_characters').update({ image_url: url }).eq('id', char.id);
    setImgStatus('✓ URL 已保存');
    setTimeout(() => setImgStatus(''), 3000);
  }

  const SETS = [
    'numbers','simple_pictograms','nature','compounds',
    'animals','ritual','body','people','actions','objects','time','places','custom',
  ];
  const TYPES = ['ideogram','pictogram','compound_ideogram','phono_semantic'];

  const save = async () => {
    setLoading(true);
    const { error } = await supabase.from('jgw_characters').update({
      pinyin,
      meaning_en:      meaningEn,
      meaning_zh:      meaningZh,
      meaning_it:      meaningIt,
      mnemonic_en:         mnemonicEn || null,
      mnemonic_zh:         mnemonicZh || null,
      mnemonic_it:         mnemonicIt || null,
      visual_description:  visualDesc || null,
      stroke_count:    strokeCount ? parseInt(strokeCount) : null,
      set_id:          setId,
      pictograph_type: type,
      difficulty:      Number(difficulty),
      image_url:       imageUrl || null,
    }).eq('id', char.id);
    setLoading(false);
    if (!error) onSave();
    else alert('Error: ' + error.message);
  };

  const field = (label, val, setter, ph, type='text') => (
    <div style={{ marginBottom:10 }}>
      <label style={{ fontSize:12, color:V.text3, display:'block', marginBottom:4 }}>{label}</label>
      <input type={type} value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
        style={{ width:'100%', padding:'8px 12px', fontSize:14, borderRadius:8,
          border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
    </div>
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
      <div style={{ background:V.card, borderRadius:16, padding:'1.5rem', width:560,
        maxHeight:'92vh', overflowY:'auto', border:`1px solid ${V.border}` }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
            ✏️ Edit
            <span style={{ fontSize:28, fontFamily:"'STKaiti','KaiTi',serif", color:V.vermillion }}>{char.glyph_modern}</span>
            <button onClick={() => speakChinese(char.glyph_modern)}
              title="朗读 Read aloud"
              style={{ padding:'4px 10px', borderRadius:8, border:`1px solid ${V.border}`,
                background:'#E1F5FE', color:'#0277BD', fontSize:13, cursor:'pointer' }}>
              🔈
            </button>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:V.text3 }}>×</button>
        </div>

        {/* Illustration panel */}
        <div style={{ background:V.bg, border:`1px solid ${V.border}`, borderRadius:12,
          padding:'12px 14px', marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:600, color:V.vermillion, marginBottom:8 }}>
            🎨 插图 · Illustration
          </div>
          <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
            {/* Preview */}
            <div style={{ width:120, height:120, borderRadius:10, flexShrink:0,
              background: imageUrl ? 'transparent' : '#f5ede0',
              border:`1px solid ${V.border}`, overflow:'hidden',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              {imageUrl
                ? <img src={imageUrl} alt="illustration"
                    onError={e => { e.target.style.display='none'; e.target.parentElement.innerText='⚠'; }}
                    style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                : <span style={{ fontSize:32, color:V.text3 }}>📜</span>}
            </div>
            {/* Controls */}
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                <div style={{ flex:'1 1 100px' }}>
                  <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:2 }}>AI 引擎</label>
                  <select value={imgProv} onChange={e=>setImgProv(e.target.value)}
                    style={{ width:'100%', padding:'4px 6px', fontSize:11, borderRadius:6, border:`1px solid ${V.border}` }}>
                    {CHAR_IMG_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div style={{ flex:'1 1 100px' }}>
                  <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:2 }}>风格</label>
                  <select value={imgStyle} onChange={e=>setImgStyle(e.target.value)}
                    style={{ width:'100%', padding:'4px 6px', fontSize:11, borderRadius:6, border:`1px solid ${V.border}` }}>
                    {CHAR_IMG_STYLES.map(s => <option key={s.id} value={s.id}>{s.label} · {s.en}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                <button onClick={handleGenerateIllustration} disabled={imgLoading}
                  style={{ flex:1, padding:'6px', borderRadius:6, border:'none',
                    background: imgLoading ? '#E0E0E0' : V.vermillion,
                    color: imgLoading ? '#aaa' : '#fff',
                    fontSize:11, fontWeight:600, cursor: imgLoading ? 'default' : 'pointer' }}>
                  {imgLoading ? '⏳ 生成中…' : '🎨 生成'}
                </button>
                {imageUrl && (
                  <button onClick={handleRemoveImage}
                    style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #FFCDD2',
                      background:'#FFEBEE', color:'#C62828', fontSize:11, cursor:'pointer' }}>
                    🗑
                  </button>
                )}
              </div>
              <input type="text" placeholder="或粘贴图片URL · Paste image URL"
                onBlur={handleUrlPaste}
                defaultValue=""
                style={{ width:'100%', padding:'4px 6px', fontSize:10, borderRadius:6,
                  border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
              {imgStatus && (
                <div style={{ fontSize:10, marginTop:4,
                  color: imgStatus.startsWith('✓') ? '#2E7D32'
                       : imgStatus.startsWith('✗') ? '#C62828' : V.text3 }}>
                  {imgStatus}
                </div>
              )}
            </div>
          </div>

          {/* Visual description — persists to DB, feeds into prompt */}
          <div style={{ marginTop:10 }}>
            <label style={{ fontSize:10, color:V.text3, display:'block', marginBottom:3 }}>
              视觉描述 · Visual description <span style={{ color:V.text3 }}>(saved, used in prompt)</span>
            </label>
            <input type="text" value={visualDesc}
              onChange={e => { setVisualDesc(e.target.value); setPromptDirty(false); }}
              placeholder="e.g. A hand counting seven fingers — or leave blank to use meaning only"
              style={{ width:'100%', padding:'5px 8px', fontSize:11, borderRadius:6,
                border:`1px solid ${V.border}`, boxSizing:'border-box' }}/>
          </div>

          {/* Editable prompt preview */}
          <div style={{ marginTop:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
              <label style={{ fontSize:10, color:V.text3 }}>
                📝 Prompt (sent to AI — editable) {promptDirty && <span style={{ color:'#E65100' }}>· modified</span>}
              </label>
              <button onClick={resetPrompt} type="button"
                style={{ fontSize:10, padding:'2px 8px', borderRadius:6, cursor:'pointer',
                  border:`1px solid ${V.border}`, background:V.bg, color:V.text2 }}>
                ↺ 重置为默认
              </button>
            </div>
            <textarea value={customPrompt}
              onChange={e => { setCustomPrompt(e.target.value); setPromptDirty(true); }}
              rows={3}
              style={{ width:'100%', padding:'6px 8px', fontSize:10, borderRadius:6,
                border:`1px solid ${V.border}`, boxSizing:'border-box', resize:'vertical',
                fontFamily:'inherit', lineHeight:1.4 }}/>
          </div>
        </div>

        {field('Pinyin',        pinyin,     setPinyin,     'e.g. rì')}
        {field('Meaning (EN)',  meaningEn,  setMeaningEn,  'English meaning')}
        {field('Meaning (中文)', meaningZh,  setMeaningZh,  'Chinese meaning')}
        {field('Meaning (IT)',  meaningIt,  setMeaningIt,  'Italian meaning')}
        {/* Mnemonic section with auto-translate */}
        <div style={{ background:V.bg, border:`1px solid ${V.border}`, borderRadius:10,
          padding:'10px 12px', marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:600, color:V.vermillion }}>
              📝 Mnemonics · 助记
            </div>
            <button onClick={async () => {
              if (!mnemonicEn.trim()) {
                alert('请先填写 Mnemonic (EN)');
                return;
              }
              try {
                const prompt = `Translate this English memory mnemonic into Simplified Chinese and Italian. Keep it as a concise 1-sentence memory hook that preserves the SHAPE-to-MEANING connection. Return ONLY valid JSON (no markdown, no explanation): {"zh":"...","it":"..."}\n\nEnglish: ${mnemonicEn.replace(/[\"]/g, '')}`;
                const res = await fetch('/.netlify/functions/ai-gateway', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ provider: 'claude', prompt, max_tokens: 500 }),
                });
                const d = await res.json();
                const raw = (d.content || d.text || d.result || '').replace(/```json|```/g, '').trim();
                const match = raw.match(/\{[\s\S]*\}/);
                if (!match) throw new Error('No JSON in response');
                const parsed = JSON.parse(match[0]);
                if (parsed.zh) setMnemonicZh(parsed.zh);
                if (parsed.it) setMnemonicIt(parsed.it);
              } catch (e) {
                alert('翻译失败: ' + e.message);
              }
            }}
            style={{ padding:'4px 10px', fontSize:11, borderRadius:6,
              border:'none', background:V.vermillion, color:'#fff',
              cursor:'pointer' }}>
              🌐 EN → 中文 + IT
            </button>
          </div>
          {field('Mnemonic (EN)',  mnemonicEn, setMnemonicEn, 'Memory hook connecting shape to meaning…')}
          {field('Mnemonic (中文)', mnemonicZh, setMnemonicZh, '形状与含义的记忆连接…')}
          {field('Mnemonic (IT)',  mnemonicIt, setMnemonicIt, 'Aiuto mnemonico…')}
        </div>
        {field('Stroke Count',  strokeCount,setStrokeCount,'e.g. 4', 'number')}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div>
            <label style={{ fontSize:12, color:V.text3, display:'block', marginBottom:4 }}>Category (set_id)</label>
            <select value={setId} onChange={e=>setSetId(e.target.value)}
              style={{ width:'100%', padding:'8px', fontSize:13, borderRadius:8, border:`1px solid ${V.border}` }}>
              {SETS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:12, color:V.text3, display:'block', marginBottom:4 }}>Type</label>
            <select value={type} onChange={e=>setType(e.target.value)}
              style={{ width:'100%', padding:'8px', fontSize:13, borderRadius:8, border:`1px solid ${V.border}` }}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, color:V.text3, display:'block', marginBottom:6 }}>
            Difficulty: <strong>{difficulty}</strong>
          </label>
          <div style={{ display:'flex', gap:8 }}>
            {[1,2,3,4,5].map(d => (
              <button key={d} type="button" onClick={()=>setDifficulty(d)}
                style={{ flex:1, padding:'6px', borderRadius:8, cursor:'pointer', fontWeight:600,
                  border:`2px solid ${difficulty===d?V.vermillion:V.border}`,
                  background: difficulty===d ? V.vermillion : V.bg,
                  color: difficulty===d ? '#fdf6e3' : V.text2 }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:'10px', cursor:'pointer', borderRadius:8,
              border:`1px solid ${V.border}`, background:V.bg, color:V.text }}>
            Cancel
          </button>
          <button onClick={save} disabled={loading}
            style={{ flex:2, padding:'10px', cursor:'pointer', borderRadius:8,
              border:'none', background:V.vermillion, color:'#fdf6e3', fontWeight:500 }}>
            {loading ? 'Saving…' : '✓ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('jgw_progress')
      .select('user_id, practiced_chars, quiz_scores, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setUsers(data || []); setLoading(false); });
  }, []);

  return (
    <div>
      <div style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>👥 User Activity</div>
      {loading ? <div>Loading…</div> : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f5ede0' }}>
              <th style={{ padding:'8px', textAlign:'left' }}>User ID</th>
              <th style={{ padding:'8px', textAlign:'left' }}>Characters Practiced</th>
              <th style={{ padding:'8px', textAlign:'left' }}>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={3} style={{ padding:'2rem', textAlign:'center', color:V.text3 }}>No user activity yet</td></tr>
            ) : users.map((u, i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${V.border}` }}>
                <td style={{ padding:'8px', fontFamily:'monospace', fontSize:11 }}>{u.user_id?.slice(0,12)}…</td>
                <td style={{ padding:'8px' }}>{Object.keys(u.practiced_chars || {}).length} chars</td>
                <td style={{ padding:'8px', color:V.text3 }}>{new Date(u.updated_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────
function AnalyticsTab({ chars }) {
  const withSvg = chars.filter(c => c.svg_jiaguwen).length;
  const withMnemonic = chars.filter(c => c.mnemonic_en).length;
  const bySet = {};
  chars.forEach(c => {
    const s = c.set_id || 'unknown';
    bySet[s] = (bySet[s] || 0) + 1;
  });

  return (
    <div>
      <div style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>📊 Analytics</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Characters', value:chars.length, color:'#1976D2' },
          { label:'With Oracle SVG', value:withSvg, color:'#2E7D32' },
          { label:'With Mnemonic', value:withMnemonic, color:'#8B4513' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:V.card, borderRadius:12, padding:'16px', border:`1px solid ${V.border}`, textAlign:'center' }}>
            <div style={{ fontSize:32, fontWeight:700, color }}>{value}</div>
            <div style={{ fontSize:12, color:V.text3, marginTop:4 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:13, fontWeight:500, marginBottom:8 }}>By Category</div>
      {Object.entries(bySet).map(([set, count]) => (
        <div key={set} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <div style={{ width:100, fontSize:12, color:V.text2 }}>{set}</div>
          <div style={{ flex:1, background:'#f0e8d8', borderRadius:4, height:8 }}>
            <div style={{ width:`${(count/chars.length)*100}%`, background:V.vermillion, height:8, borderRadius:4 }}/>
          </div>
          <div style={{ fontSize:12, color:V.text3, width:24 }}>{count}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main AdminApp ─────────────────────────────────────────────────
export default function AdminApp() {
  const { session, isAdmin, loading, signIn, signOut } = useAdminAuth();
  const [tab,         setTab]         = useState('characters');
  const [chars,       setChars]       = useState([]);
  const [charsLoading, setCharsLoading] = useState(true);
  const [showAdd,     setShowAdd]     = useState(false);
  const [showExtractWizard, setShowExtractWizard] = useState(false);
  const [showBatchIllust, setShowBatchIllust] = useState(false);
  const [selectedCharIds, setSelectedCharIds] = useState(new Set());
  const [illustChar,  setIllustChar]  = useState(null);
  const [editChar,    setEditChar]    = useState(null);
  const [search,      setSearch]      = useState('');
  const [apiKeys,     setApiKeys]     = useState({});
  const [pandaUrl,    setPandaUrl]    = useState(null);
  const tabBarRef = useRef(null);
  const dragRef   = useRef({ active:false, startX:0, scrollLeft:0, moved:false });
  const reorderRef= useRef({ dragging:false, fromIdx:-1, toIdx:-1 });
  const [dragFromIdx, setDragFromIdx]= useState(-1);
  const [dragToIdx,   setDragToIdx]  = useState(-1);
  const [ghostStyle,  setGhostStyle] = useState(null);
  const [tabOrder, setTabOrder]      = useState(() => {
    const DEFAULT = ['characters','words','hsk','poetry','invites','pinyin','chengyu','grammar','users','analytics','apikeys','panda'];
    try {
      const saved = localStorage.getItem('admin_tab_order');
      if (saved) {
        const ids = JSON.parse(saved).filter(id => DEFAULT.includes(id));
        // Add any new tabs not in saved order
        DEFAULT.forEach(id => { if (!ids.includes(id)) ids.push(id); });
        return ids;
      }
    } catch { localStorage.removeItem('admin_tab_order'); }
    return DEFAULT;
  });

  const onTabMouseDown = (e) => {
    const el = tabBarRef.current;
    if (!el) return;
    dragRef.current = { active:true, startX:e.pageX, scrollLeft:el.scrollLeft, moved:false };
  };
  const onTabMouseMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.pageX - dragRef.current.startX;
    if (Math.abs(dx) > 5) {
      dragRef.current.moved = true;
      tabBarRef.current.scrollLeft = dragRef.current.scrollLeft - dx;
    }
  };
  const onTabMouseUp = () => { dragRef.current.active = false; };

  // Touch support
  const onTabTouchStart = (e) => {
    const el = tabBarRef.current;
    if (!el) return;
    dragRef.current = { active:true, startX:e.touches[0].pageX, scrollLeft:el.scrollLeft, moved:false };
  };
  const onTabTouchMove = (e) => {
    if (!dragRef.current.active) return;
    const dx = e.touches[0].pageX - dragRef.current.startX;
    if (Math.abs(dx) > 5) {
      dragRef.current.moved = true;
      tabBarRef.current.scrollLeft = dragRef.current.scrollLeft - dx;
    }
  };
  const onTabTouchEnd = () => { dragRef.current.active = false; };

  const loadChars = useCallback(async () => {
    setCharsLoading(true);
    const { data } = await supabase.from('jgw_characters')
      .select('*').order('created_at').limit(500);
    setChars(data || []);
    setCharsLoading(false);
  }, []);

  // Load API keys from localStorage (ApiKeyManager saves as admin_key_{provider})
  useEffect(() => {
    if (!isAdmin) return;
    const providers = ['anthropic','openai','deepseek','stability','ideogram','gemini','qwen','voyage'];
    const map = {};
    providers.forEach(p => {
      const k = localStorage.getItem(`admin_key_${p}`);
      if (k) map[p] = k;
    });
    setApiKeys(map);
  }, [isAdmin]);

  // Random panda for top bar from Panda Studio
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('jgw_panda_assets').select('image_url')
      .then(({ data }) => {
        if (data?.length) {
          const r = data[Math.floor(Math.random() * data.length)];
          setPandaUrl(r.image_url);
        }
      }).catch(() => {});
  }, [isAdmin]);

  const deleteChar = async (char) => {
    if (!confirm(`Delete ${char.glyph_modern}?`)) return;
    await supabase.from('jgw_characters').delete().eq('id', char.id);
    loadChars();
  };

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:V.bg }}>Loading…</div>;
  if (!session) return <LoginScreen onSignIn={signIn}/>;
  if (!isAdmin) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:V.bg, gap:16 }}>
      <div style={{ fontSize:14, color:'#c0392b' }}>Access denied — not an admin.</div>
      <button onClick={signOut} style={{ padding:'8px 20px', cursor:'pointer', borderRadius:8, border:`1px solid ${V.border}`, background:V.card }}>Sign out</button>
    </div>
  );

  const filtered = chars.filter(c =>
    !search || c.glyph_modern?.includes(search) ||
    c.pinyin?.toLowerCase().includes(search.toLowerCase()) ||
    c.meaning_en?.toLowerCase().includes(search.toLowerCase())
  );

  const DEFAULT_TABS = [
    { id:'characters', label:'📝 字符管理' },
    { id:'corpus',     label:'📚 语料库 RAG' },
    { id:'words',      label:'📚 词语' },
    { id:'hsk',        label:'🎓 HSK' },
    { id:'poetry',     label:'📜 诗歌' },
    { id:'invites',    label:'🔑 邀请' },
    { id:'pinyin',     label:'🔤 拼音' },
    { id:'chengyu',    label:'📜 成语' },
    { id:'grammar',    label:'📐 语法' },
    { id:'users',      label:'👥 用户' },
    { id:'analytics',  label:'📊 AI 分析' },
    { id:'apikeys',    label:'🔑 API Keys' },
    { id:'panda',      label:'🐼 Panda Studio' },
  ];
  const DEFAULT_TAB_IDS = DEFAULT_TABS.map(t => t.id);

  // Sort DEFAULT_TABS by saved order — always safe, always complete
  const TABS = [
    ...tabOrder.filter(id => DEFAULT_TAB_IDS.includes(id)).map(id => DEFAULT_TABS.find(t => t.id === id)),
    ...DEFAULT_TABS.filter(t => !tabOrder.includes(t.id)),
  ].filter(Boolean);

  function startReorder(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    reorderRef.current = { dragging:true, fromIdx:idx, toIdx:idx };
    setDragFromIdx(idx);
    setDragToIdx(idx);
    setGhostStyle({ left:e.clientX-50, top:e.clientY-18, label:TABS[idx]?.label });
    document.addEventListener('mousemove', onReorderMove);
    document.addEventListener('mouseup',   onReorderUp);
  }

  function onReorderMove(e) {
    if (!reorderRef.current.dragging) return;
    setGhostStyle(g => g ? { ...g, left:e.clientX-50, top:e.clientY-18 } : null);
    const el = tabBarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left + el.scrollLeft;
    const toIdx = Math.max(0, Math.min(TABS.length-1, Math.floor(relX/130)));
    reorderRef.current.toIdx = toIdx;
    setDragToIdx(toIdx);
  }

  function onReorderUp() {
    document.removeEventListener('mousemove', onReorderMove);
    document.removeEventListener('mouseup',   onReorderUp);
    const { dragging, fromIdx, toIdx } = reorderRef.current;
    reorderRef.current.dragging = false;
    setDragFromIdx(-1); setDragToIdx(-1); setGhostStyle(null);
    if (!dragging || fromIdx === toIdx) return;
    // Reorder tabOrder IDs
    const newIds = [...tabOrder];
    const [moved] = newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, moved);
    setTabOrder(newIds);
    localStorage.setItem('admin_tab_order', JSON.stringify(newIds));
  }

  const scrollTabs = (dir) => {
    const el = tabBarRef.current;
    if (el) el.scrollBy({ left: dir * 160, behavior:'smooth' });
  };

  return (
    <div style={{ minHeight:'100vh', background:V.bg, fontFamily:'var(--font-sans, system-ui)' }}>

      {/* Top bar */}
      <div style={{ background:V.card, borderBottom:`1px solid ${V.border}`, padding:'10px 20px',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {pandaUrl
            ? <img src={pandaUrl} alt="panda" style={{ width:32, height:32, objectFit:'contain', borderRadius:8 }}/>
            : <span style={{ fontSize:20 }}>🐼</span>}
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:V.text }}>大卫学中文 · Admin</div>
            <div style={{ fontSize:10, color:V.text3 }}>David Learns Chinese · David Studia Cinese</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:12, color:V.text3 }}>{session.user.email}</span>
          <button onClick={signOut} style={{ padding:'6px 14px', fontSize:12, cursor:'pointer',
            borderRadius:8, border:`1px solid ${V.border}`, background:V.bg, color:V.text }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs — drag to scroll + hold to reorder */}
      <div style={{ background:V.card, borderBottom:`1px solid ${V.border}`,
        display:'flex', alignItems:'center', position:'relative' }}>

        <div style={{ flex:1, maxWidth:'90vw', overflow:'hidden' }}>
          <div ref={tabBarRef}
            style={{ overflowX:'scroll', overflowY:'hidden', cursor:'grab',
              scrollbarWidth:'none', msOverflowStyle:'none', userSelect:'none' }}
            onMouseDown={onTabMouseDown}
            onMouseMove={onTabMouseMove}
            onMouseUp={onTabMouseUp}
            onMouseLeave={onTabMouseUp}
            onTouchStart={onTabTouchStart}
            onTouchMove={onTabTouchMove}
            onTouchEnd={onTabTouchEnd}>
            <div style={{ display:'flex', width:`${TABS.length * 130}px`, position:'relative' }}>
              {TABS.map((t, idx) => {
                const isDragging   = dragFromIdx === idx;
                const isDropTarget = dragToIdx === idx && dragFromIdx !== idx;
                return (
                  <div key={t.id} style={{
                    width:130, position:'relative', flexShrink:0,
                    // Drop target highlight
                    borderLeft: isDropTarget && dragFromIdx > idx
                      ? `3px solid ${V.vermillion}` : '3px solid transparent',
                    borderRight: isDropTarget && dragFromIdx < idx
                      ? `3px solid ${V.vermillion}` : '3px solid transparent',
                    boxSizing:'border-box',
                    opacity: isDragging ? 0.35 : 1,
                    transition:'opacity 0.1s',
                  }}>
                    <button
                      onClick={() => { if (!dragRef.current.moved) setTab(t.id); dragRef.current.moved=false; }}
                      onMouseDown={e => {
                        // Long-press to reorder: start a 200ms timer
                        const timer = setTimeout(() => startReorder(e, idx), 200);
                        const cancel = () => { clearTimeout(timer); window.removeEventListener('mouseup', cancel); };
                        window.addEventListener('mouseup', cancel, { once:true });
                      }}
                      title="Hold to drag and reorder"
                      style={{
                        width:'100%', padding:'12px 8px', fontSize:12,
                        cursor:'grab', border:'none', whiteSpace:'nowrap',
                        userSelect:'none', background:'none',
                        borderBottom:`2px solid ${tab===t.id ? V.vermillion : 'transparent'}`,
                        color: tab===t.id ? V.vermillion : V.text2,
                        fontWeight: tab===t.id ? 600 : 400,
                        transition:'color 0.15s, border-color 0.15s',
                      }}>
                      {t.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reset order button — appears when order is customized */}
        {JSON.stringify(tabOrder.map(t=>t.id)) !== JSON.stringify(DEFAULT_TABS.map(t=>t.id)) && (
          <button
            onClick={() => { setTabOrder(DEFAULT_TABS); localStorage.removeItem('admin_tab_order'); }}
            title="Reset to default order"
            style={{ padding:'0 8px', height:44, border:'none', background:'none',
              cursor:'pointer', color:V.text3, fontSize:12, flexShrink:0 }}>
            ↺
          </button>
        )}
      </div>

      {/* Drag ghost — follows cursor */}
      {ghostStyle && (
        <div style={{
          position:'fixed', left:ghostStyle.left, top:ghostStyle.top,
          background:V.vermillion, color:'#fff', padding:'5px 14px',
          borderRadius:10, fontSize:12, fontWeight:600, pointerEvents:'none',
          boxShadow:'0 4px 16px rgba(0,0,0,0.25)', zIndex:9999,
          transform:'rotate(-3deg)', whiteSpace:'nowrap',
        }}>
          {ghostStyle.label}
        </div>
      )}

      {/* Content */}
      <div style={{ padding:'20px', maxWidth:1000, margin:'0 auto' }}>

        {/* Characters tab */}
        {tab==='characters' && (
          <div>
            <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search characters…"
                style={{ flex:1, padding:'9px 12px', fontSize:14, borderRadius:8, border:`1px solid ${V.border}` }}/>
              <button onClick={()=>setShowAdd(true)}
                style={{ padding:'9px 18px', fontSize:14, fontWeight:500, cursor:'pointer',
                  borderRadius:8, border:'none', background:V.vermillion, color:'#fdf6e3', whiteSpace:'nowrap' }}>
                ➕ Add Character
              </button>
              <button onClick={()=>setShowExtractWizard(true)}
                style={{ padding:'9px 14px', fontSize:13, fontWeight:500, cursor:'pointer',
                  borderRadius:8, border:`1px solid ${V.vermillion}`, background:V.bg, color:V.vermillion, whiteSpace:'nowrap' }}>
                🎯 从语料库提取
              </button>
              <button onClick={loadChars}
                style={{ padding:'9px 14px', fontSize:13, cursor:'pointer',
                  borderRadius:8, border:`1px solid ${V.border}`, background:V.bg }}>
                ↺ Refresh
              </button>
            </div>

            <div style={{ fontWeight:600, color:V.vermillion, fontSize:13, marginBottom:4 }}>
              字符列表 ({filtered.length} 条)
            </div>

            <div style={{ fontSize:11, color:V.text3, marginBottom:8 }}>
              · 点击任意条目编辑 · Click a card to edit · 勾选复选框可批量操作
            </div>

            {/* 批量选择工具栏 */}
            <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
              <button
                onClick={() => setSelectedCharIds(new Set(filtered.map(c => c.id)))}
                style={{ padding:'4px 10px', fontSize:11, borderRadius:6,
                  border:`1px solid ${V.border}`, background:V.bg, cursor:'pointer' }}>
                全选
              </button>
              <button
                onClick={() => setSelectedCharIds(new Set())}
                style={{ padding:'4px 10px', fontSize:11, borderRadius:6,
                  border:`1px solid ${V.border}`, background:V.bg, cursor:'pointer' }}>
                全不选
              </button>
              <button
                onClick={() => setSelectedCharIds(new Set(filtered.filter(c => !c.image_url).map(c => c.id)))}
                style={{ padding:'4px 10px', fontSize:11, borderRadius:6,
                  border:`1px solid ${V.border}`, background:V.bg, cursor:'pointer' }}>
                选没图的
              </button>
              {[1,2,3,4,5,6].map(lv => (
                <button key={lv}
                  onClick={() => setSelectedCharIds(new Set(filtered.filter(c => c.hsk_level === lv).map(c => c.id)))}
                  style={{ padding:'4px 10px', fontSize:11, borderRadius:6,
                    border:`1px solid ${V.border}`, background:V.bg, cursor:'pointer' }}>
                  HSK {lv}
                </button>
              ))}
              <div style={{ flex:1 }}/>
              {selectedCharIds.size > 0 && (
                <>
                  <span style={{ fontSize:12, color:V.text2, fontWeight:500 }}>
                    已选 {selectedCharIds.size} 个
                  </span>
                  <button
                    onClick={() => setShowBatchIllust(true)}
                    style={{ padding:'5px 12px', fontSize:12, fontWeight:500, borderRadius:6,
                      border:'none', background:V.vermillion, color:'#fdf6e3', cursor:'pointer' }}>
                    🎨 批量生图
                  </button>
                </>
              )}
            </div>

            {charsLoading ? (
              <div style={{ textAlign:'center', color:V.text3, padding:20 }}>加载中…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign:'center', color:V.text3, padding:40,
                background:V.card, borderRadius:12, border:`1px dashed ${V.border}` }}>
                {search ? '没有找到匹配的字符' : '还没有字符 — 点击 ➕ Add Character 开始'}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {filtered.map(c => (
                  <div key={c.id}
                    onClick={() => setEditChar(c)}
                    style={{ background:'#fff',
                      border:`1px solid ${selectedCharIds.has(c.id) ? V.vermillion : V.border}`,
                      borderRadius:12, padding:'10px 12px',
                      display:'flex', gap:12, alignItems:'center',
                      cursor:'pointer', transition:'border-color 0.15s',
                      boxShadow: selectedCharIds.has(c.id) ? `0 0 0 2px ${V.vermillion}22` : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = V.vermillion}
                    onMouseLeave={e => e.currentTarget.style.borderColor = selectedCharIds.has(c.id) ? V.vermillion : V.border}>

                    {/* Checkbox for batch selection */}
                    <input type="checkbox"
                      checked={selectedCharIds.has(c.id)}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        e.stopPropagation();
                        const next = new Set(selectedCharIds);
                        if (e.target.checked) next.add(c.id);
                        else next.delete(c.id);
                        setSelectedCharIds(next);
                      }}
                      style={{ cursor:'pointer', width:16, height:16, flexShrink:0 }}/>

                    {/* Thumbnail */}
                    <div style={{ width:52, height:52, borderRadius:10, flexShrink:0,
                      background: c.image_url ? 'transparent' : '#f5ede0',
                      border:`1px solid ${V.border}`, overflow:'hidden',
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {c.image_url
                        ? <img src={c.image_url} alt={c.glyph_modern}
                            onError={e => { e.currentTarget.style.display='none'; }}
                            style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                        : <span style={{ fontSize:28, fontFamily:"'STKaiti','KaiTi',serif", color:V.text3 }}>
                            {c.glyph_modern}
                          </span>}
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', gap:6, alignItems:'baseline', flexWrap:'wrap' }}>
                        <span style={{ fontSize:22, fontWeight:700, color:V.vermillion,
                          fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:1 }}>
                          {c.glyph_modern}
                        </span>
                        <span style={{ fontSize:12, color:V.text3 }}>{c.pinyin}</span>
                        {c.set_id && (
                          <span style={{ fontSize:10, background:'#f5ede0', color:V.text2,
                            padding:'1px 6px', borderRadius:8 }}>
                            {c.set_id}
                          </span>
                        )}
                        {c.difficulty && (
                          <span style={{ fontSize:10, background:'#FFF3E0', color:'#E65100',
                            padding:'1px 6px', borderRadius:8 }}>
                            Lv{c.difficulty}
                          </span>
                        )}
                        {c.pictograph_type && (
                          <span style={{ fontSize:10, background:'#E3F2FD', color:'#1565C0',
                            padding:'1px 6px', borderRadius:8 }}>
                            {c.pictograph_type}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:V.text2, marginTop:2,
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {c.meaning_en || '—'}
                      </div>
                    </div>

                    {/* Actions (stop propagation to prevent opening modal) */}
                    <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}
                      onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => speakChinese(c.glyph_modern)}
                        title="朗读 Read aloud"
                        style={{ padding:'4px 8px', borderRadius:8, border:`1px solid ${V.border}`,
                          background:'#E1F5FE', color:'#0277BD', fontSize:11, cursor:'pointer' }}>
                        🔈
                      </button>
                      <button
                        onClick={() => setIllustChar(c)}
                        title="生成插图 Generate illustration"
                        style={{ padding:'4px 8px', borderRadius:8, border:`1px solid ${V.border}`,
                          background:V.bg, color:V.vermillion, fontSize:11, cursor:'pointer' }}>
                        🎨
                      </button>
                      <button onClick={() => deleteChar(c)}
                        title="删除 Delete"
                        style={{ padding:'4px 8px', borderRadius:8, border:'1px solid #FFCDD2',
                          background:'#FFEBEE', color:'#C62828', fontSize:11, cursor:'pointer' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-populate collapsed section */}
            <details style={{ marginTop:16, background:V.card,
              border:`1px solid ${V.border}`, borderRadius:12, overflow:'hidden' }}>
              <summary style={{ padding:'12px 16px', cursor:'pointer', fontSize:13,
                fontWeight:600, color:V.text, listStyle:'none', userSelect:'none' }}>
                🤖 AI 自动批量填充 Auto-Populate ›
              </summary>
              <div style={{ padding:'0 16px 16px' }}>
                <AutoPopulate onDone={loadChars}/>
              </div>
            </details>
          </div>
        )}

        {tab==='users'     && <UsersTab/>}
        {tab==='analytics' && <AIAnalyticsTab/>}
        {tab==='invites'   && <InviteManager/>}
        {tab==='pinyin'    && <PinyinAdminTab/>}
        {tab==='words'     && <WordsAdminTab/>}
        {tab==='chengyu'   && <ChengyuAdminTab apiKeys={apiKeys}/>}
        {tab==='corpus'    && <CorpusTab/>}
        {tab==='grammar'   && <GrammarAdminTab/>}
        {tab==='hsk'       && <HSKAdminTab/>}
        {tab==='poetry'    && <PoetryAdminTab/>}
        {tab==='apikeys'   && <ApiKeyManager/>}
        {tab==='panda'     && <PandaStudio/>}

      </div>

      {/* Modals */}
      {showAdd    && <AddCharModal onClose={()=>setShowAdd(false)} onSave={()=>{ setShowAdd(false); loadChars(); }}/>}
      {editChar   && <EditCharModal char={editChar} onClose={()=>setEditChar(null)} onSave={()=>{ setEditChar(null); loadChars(); }}/>}
      {illustChar && <IllustrationStudio characters={chars} initialChar={illustChar} onClose={()=>{ setIllustChar(null); loadChars(); }} onUpdate={loadChars}/>}
      <CharacterImportWizard
        open={showExtractWizard}
        onClose={()=>setShowExtractWizard(false)}
        onComplete={()=>{ setShowExtractWizard(false); loadChars(); }}
      />
      <BatchIllustrationModal
        open={showBatchIllust}
        onClose={()=>setShowBatchIllust(false)}
        onComplete={()=>{ setShowBatchIllust(false); setSelectedCharIds(new Set()); loadChars(); }}
        selectedCharIds={[...selectedCharIds]}
      />
    </div>
  );
}
