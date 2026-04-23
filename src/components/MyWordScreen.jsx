/**
 * src/components/MyWordScreen.jsx
 *
 * User types a word in ANY language (EN, IT, ZH, FR, DE, ES…)
 * → System translates to Chinese
 * → Shows each character with full info
 * → Tap any character → practice tracing (描红)
 *
 * Flow:
 *   "tree"   →  木  →  [practice tracing]
 *   "albero" →  木  →  [practice tracing]
 *   "月亮"   →  月 + 亮  →  [practice each]
 *   "amore"  →  爱  →  [practice tracing]
 *
 * Backend: /.netlify/functions/word-to-clf (Claude API via server-side key).
 */
import { useState, useRef, useEffect } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { SETS } from '../data/characters.js';

const ALL_CHARS = SETS.flatMap(s => s.chars.map(c => ({ ...c, set: s })));

// ── Stroke preview using HanziWriter ──────────────────────────────
function StrokePreview({ char }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !char) return;
    ref.current.innerHTML = '';
    import('hanzi-writer').then(({ default: HanziWriter }) => {
      const w = HanziWriter.create(ref.current, char, {
        width:80, height:80, padding:8,
        showOutline:true, showCharacter:true,
        strokeColor:'#8B4513', outlineColor:'#e8c8a8',
      });
      w.animateCharacter();
    }).catch(() => {});
  }, [char]);
  return <div ref={ref} style={{ width:80, height:80 }}/>;
}

// ── Single character card ─────────────────────────────────────────
function CharCard({ data, lang, inApp, onPractice }) {
  const [showMore, setMore] = useState(false);
  const meaning = lang==='zh' ? data.meaning_zh
    : lang==='it' ? data.meaning_it
    : data.meaning_en;

  return (
    <div style={{
      background:'var(--card)', borderRadius:14,
      border:`1.5px solid ${inApp ? '#8B4513' : 'var(--border)'}`,
      overflow:'hidden',
    }}>
      {/* Top row */}
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 14px 10px' }}>
        {/* Oracle bone / character preview */}
        <div style={{ flexShrink:0 }}>
          <StrokePreview char={data.character}/>
        </div>

        {/* Info */}
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <span style={{ fontSize:36, fontFamily:"'STKaiti','KaiTi',serif", lineHeight:1, color:'var(--text)' }}>
              {data.character}
            </span>
            <div>
              <div style={{ fontSize:16, color:'var(--text-2)', fontWeight:500 }}>{data.pinyin}</div>
              <div style={{ fontSize:12, color:'var(--text-3)' }}>
                {data.strokes} {lang==='zh'?'笔':lang==='it'?'tratti':'strokes'}
              </div>
            </div>
          </div>
          <div style={{ fontSize:14, color:'var(--text)', marginBottom:4 }}>{meaning}</div>
          {data.tips && (
            <div style={{ fontSize:12, color:'#8B4513', fontStyle:'italic', lineHeight:1.5 }}>
              💡 {data.tips}
            </div>
          )}
        </div>
      </div>

      {/* Etymology */}
      {data.etymology && (
        <div style={{ padding:'8px 14px', background:'var(--parchment)',
          borderTop:'0.5px solid var(--border)', fontSize:12, color:'var(--text-3)', lineHeight:1.6 }}>
          🏺 {data.etymology}
        </div>
      )}

      {/* In-app badge + practice button */}
      <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10,
        borderTop:'0.5px solid var(--border)' }}>
        {inApp ? (
          <>
            <div style={{ fontSize:11, padding:'2px 10px', borderRadius:20,
              background:'#fdf6e3', border:'1px solid #8B4513', color:'#8B4513' }}>
              {inApp.set?.emoji} {lang==='zh'?'收录字符':lang==='it'?'In app':'In app'}
            </div>
            <button onClick={() => onPractice(inApp)}
              style={{ marginLeft:'auto', padding:'8px 18px', fontSize:13, fontWeight:500,
                cursor:'pointer', borderRadius:10, border:'none',
                background:'#8B4513', color:'#fdf6e3', fontFamily:'inherit' }}>
              ✏ {lang==='zh'?'描红练习':lang==='it'?'Pratica':'Practice'}
            </button>
          </>
        ) : (
          <div style={{ fontSize:11, color:'var(--text-3)' }}>
            {lang==='zh'?'此字暂未收录，可在管理后台添加':
             lang==='it'?'Non ancora nell\'app — aggiungilo dal pannello admin':
             'Not yet in app — add it via admin panel'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main MyWordScreen ─────────────────────────────────────────────
export default function MyWordScreen({ onPractice }) {
  const { lang } = useLang();
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const convert = async () => {
    const q = input.trim();
    if (!q) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/.netlify/functions/word-to-clf', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ text:q }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Match each character to app database
      const enriched = data.characters.map(c => {
        const inApp = ALL_CHARS.find(a => a.c === c.character);
        return { ...c, inApp: inApp || null };
      });
      setResult({ ...data, characters: enriched });
    } catch(e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const EXAMPLES = [
    { en:'tree',    it:'albero',  zh:'树' },
    { en:'moon',    it:'luna',    zh:'月亮' },
    { en:'love',    it:'amore',   zh:'爱' },
    { en:'water',   it:'acqua',   zh:'水' },
    { en:'mountain',it:'montagna',zh:'山' },
  ];

  const L = {
    title:    lang==='zh'?'✏ 我的描红':lang==='it'?'✏ Il mio 描红':'✏ My 描红',
    sub:      lang==='zh'?'用你的语言写词，获得汉字描红':
              lang==='it'?'Scrivi una parola nella tua lingua, ottieni i caratteri':
              'Type a word in your language, get Chinese characters to trace',
    ph:       lang==='zh'?'输入任意语言的词…':
              lang==='it'?'Inserisci una parola in qualsiasi lingua…':
              'Type a word in any language…',
    btn:      lang==='zh'?'转换为描红':'Converti in 描红',
    eg:       lang==='zh'?'例如：':'Esempi:',
    result:   lang==='zh'?'汉字描红':lang==='it'?'Caratteri cinesi':'Chinese characters',
    traceAll: lang==='zh'?'依次练习全部':lang==='it'?'Pratica tutti':'Practice all',
    again:    lang==='zh'?'换一个词':lang==='it'?'Altra parola':'Try another word',
  };

  return (
    <div style={{ padding:'16px 0', fontFamily:'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ padding:'0 16px 14px' }}>
        <div style={{ fontSize:18, fontWeight:500, color:'var(--text)' }}>{L.title}</div>
        <div style={{ fontSize:13, color:'var(--text-3)', marginTop:2, lineHeight:1.5 }}>{L.sub}</div>
      </div>

      {/* Input */}
      <div style={{ padding:'0 16px 14px' }}>
        <div style={{ display:'flex', gap:8 }}>
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&convert()}
            placeholder={L.ph}
            style={{ flex:1, padding:'12px 14px', fontSize:16, borderRadius:12,
              border:'1.5px solid var(--border)', background:'var(--card)', color:'var(--text)',
              fontFamily:'inherit' }}/>
          <button onClick={convert} disabled={loading||!input.trim()}
            style={{ padding:'12px 18px', fontSize:14, fontWeight:500, cursor:'pointer',
              borderRadius:12, border:'none', fontFamily:'inherit',
              background:loading||!input.trim()?'var(--border)':'#8B4513', color:'#fdf6e3',
              whiteSpace:'nowrap' }}>
            {loading ? '…' : '→'}
          </button>
        </div>

        {/* Examples */}
        {!result && !loading && (
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{L.eg}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {EXAMPLES.map(ex => {
                const label = lang==='zh'?ex.zh:lang==='it'?ex.it:ex.en;
                return (
                  <button key={ex.en} onClick={()=>{ setInput(label); }}
                    style={{ padding:'5px 12px', fontSize:13, cursor:'pointer', borderRadius:20,
                      border:'1px solid var(--border)', background:'var(--card)',
                      color:'var(--text-2)', fontFamily:'inherit' }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding:'2rem', textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:12, animation:'spin 1s linear infinite' }}>🐢</div>
          <div style={{ fontSize:14, color:'var(--text-3)' }}>
            {lang==='zh'?'正在转换…':lang==='it'?'Conversione in corso…':'Converting…'}
          </div>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ margin:'0 16px', padding:'10px 14px', background:'#FFEBEE',
          borderRadius:10, fontSize:13, color:'#c0392b' }}>{error}</div>
      )}

      {/* Result */}
      {result && (
        <div style={{ padding:'0 16px' }}>
          {/* Summary banner */}
          <div style={{ background:'var(--parchment)', border:'1.5px solid #8B4513',
            borderRadius:12, padding:'12px 14px', marginBottom:14,
            display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:2 }}>
                {result.inputText} →
              </div>
              <div style={{ fontSize:28, fontFamily:"'STKaiti','KaiTi',serif", color:'#8B4513', letterSpacing:4 }}>
                {result.chineseText}
              </div>
              <div style={{ fontSize:14, color:'var(--text-2)', marginTop:2 }}>
                {result.pinyin} · {result.meaning}
              </div>
            </div>
            <div style={{ fontSize:32 }}>
              {result.characters.length === 1 ? '一字' : `${result.characters.length}字`}
            </div>
          </div>

          {/* Character cards */}
          <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:10 }}>
            {L.result} ({result.characters.length})
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {result.characters.map((c, i) => (
              <CharCard key={i} data={c} lang={lang} inApp={c.inApp}
                onPractice={onPractice}/>
            ))}
          </div>

          {/* Practice all button */}
          {result.characters.some(c => c.inApp) && (
            <button onClick={() => {
              const first = result.characters.find(c => c.inApp);
              if (first) onPractice(first.inApp);
            }}
              style={{ width:'100%', margin:'14px 0 8px', padding:'12px', fontSize:14,
                fontWeight:500, cursor:'pointer', borderRadius:12, border:'none',
                background:'#8B4513', color:'#fdf6e3', fontFamily:'inherit' }}>
              ✏ {L.traceAll}
            </button>
          )}

          <button onClick={()=>{ setResult(null); setInput(''); inputRef.current?.focus(); }}
            style={{ width:'100%', padding:'10px', fontSize:13, cursor:'pointer',
              borderRadius:10, border:'1.5px solid var(--border)',
              background:'var(--card)', color:'var(--text)', fontFamily:'inherit' }}>
            {L.again}
          </button>
        </div>
      )}
    </div>
  );
}
