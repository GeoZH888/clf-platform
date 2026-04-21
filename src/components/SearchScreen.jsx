/**
 * src/components/SearchScreen.jsx
 * 
 * Three features in one screen:
 * 1. Pinyin search — type "ri" → finds 日
 * 2. Character search — type 日 directly
 * 3. Translation — CN/EN/IT
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { SETS } from '../data/characters.js';
import VoiceSearch from './VoiceSearch.jsx';

const ALL_CHARS = SETS.flatMap(s => s.chars.map(c => ({ ...c, set: s })));

const PINYIN_MAP = {};
ALL_CHARS.forEach(c => {
  const base = c.p?.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, m => {
    const map = {
      'ā':'a','á':'a','ǎ':'a','à':'a',
      'ē':'e','é':'e','ě':'e','è':'e',
      'ī':'i','í':'i','ǐ':'i','ì':'i',
      'ō':'o','ó':'o','ǒ':'o','ò':'o',
      'ū':'u','ú':'u','ǔ':'u','ù':'u',
      'ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v',
    };
    return map[m] || m;
  }).toLowerCase() || '';
  if (!PINYIN_MAP[base]) PINYIN_MAP[base] = [];
  PINYIN_MAP[base].push(c);
});

function CharResult({ char, onPractice }) {
  const set = char.set;
  return (
    <div onClick={() => onPractice(char)} style={{
      display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
      background:'var(--card)', borderRadius:12, border:'0.5px solid var(--border)',
      cursor:'pointer', transition:'all 0.15s',
    }}>
      <div style={{ fontSize:42, fontFamily:"'STKaiti','KaiTi',serif", lineHeight:1, minWidth:48, textAlign:'center' }}>
        {char.c}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <span style={{ fontSize:16, fontWeight:500, color:'var(--text)' }}>{char.p}</span>
          <span style={{ fontSize:11, padding:'1px 8px', borderRadius:20,
            background: set?.color || '#fdf6e3',
            border: `1px solid ${set?.borderColor || '#8B4513'}`,
            color: set?.borderColor || '#8B4513' }}>
            {set?.emoji} {set?.nameEn}
          </span>
        </div>
        <div style={{ fontSize:13, color:'var(--text-2)' }}>{char.m}</div>
        <div style={{ fontSize:12, color:'var(--text-3)' }}>{char.mz} · {char.mi}</div>
      </div>
      <div style={{ fontSize:20, color:'var(--text-3)' }}>›</div>
    </div>
  );
}

// ── Translation panel ─────────────────────────────────────────────
function TranslatePanel() {
  const { lang } = useLang();
  const [input, setInput]     = useState('');
  const [result, setResult]   = useState('');
  const [loading, setLoading] = useState(false);
  const [fromLang, setFrom]   = useState('zh');
  const [toLang,   setTo]     = useState('en');

  const LANGS = [
    { id:'zh', label:'中文', flag:'🇨🇳' },
    { id:'en', label:'English', flag:'🇬🇧' },
    { id:'it', label:'Italiano', flag:'🇮🇹' },
  ];

  const translate = async () => {
    if (!input.trim()) return;
    setLoading(true); setResult('');
    try {
      const res = await fetch('/.netlify/functions/translate', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ text:input.trim(), from:fromLang, to:toLang }),
      });
      const data = await res.json();
      setResult(data.translation || data.error || 'Translation failed');
    } catch(e) {
      setResult('Error: ' + e.message);
    }
    setLoading(false);
  };

  const swap = () => {
    const tmp = fromLang;
    setFrom(toLang); setTo(tmp);
    setInput(result); setResult('');
  };

  return (
    <div style={{ padding:'0 16px' }}>
      {/* Lang selectors */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:4 }}>From</div>
          <div style={{ display:'flex', gap:4 }}>
            {LANGS.map(l => (
              <button key={l.id} onClick={()=>setFrom(l.id)}
                style={{ flex:1, padding:'6px 4px', fontSize:11, cursor:'pointer', borderRadius:8,
                  border:`1.5px solid ${fromLang===l.id?'#8B4513':'var(--border)'}`,
                  background:fromLang===l.id?'#fdf6e3':'var(--card)',
                  color:fromLang===l.id?'#8B4513':'var(--text-2)', fontFamily:'inherit' }}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={swap} style={{ marginTop:16, width:32, height:32, borderRadius:'50%',
          border:'0.5px solid var(--border)', background:'var(--card)', cursor:'pointer', fontSize:16 }}>
          ⇄
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:4 }}>To</div>
          <div style={{ display:'flex', gap:4 }}>
            {LANGS.map(l => (
              <button key={l.id} onClick={()=>setTo(l.id)}
                style={{ flex:1, padding:'6px 4px', fontSize:11, cursor:'pointer', borderRadius:8,
                  border:`1.5px solid ${toLang===l.id?'#8B4513':'var(--border)'}`,
                  background:toLang===l.id?'#fdf6e3':'var(--card)',
                  color:toLang===l.id?'#8B4513':'var(--text-2)', fontFamily:'inherit' }}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <textarea value={input} onChange={e=>setInput(e.target.value)}
        placeholder={fromLang==='zh'?'输入中文…':fromLang==='it'?'Inserisci testo…':'Enter text…'}
        style={{ width:'100%', minHeight:80, padding:'10px 12px', fontSize:15,
          borderRadius:10, border:'0.5px solid var(--border)', background:'var(--card)',
          color:'var(--text)', fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }}/>

      <button onClick={translate} disabled={loading || !input.trim()}
        style={{ width:'100%', padding:'11px', margin:'8px 0', fontSize:14, fontWeight:500,
          cursor:'pointer', borderRadius:10, border:'none', fontFamily:'inherit',
          background: loading||!input.trim() ? 'var(--border)' : '#8B4513', color:'#fdf6e3' }}>
        {loading ? '翻译中… Translating…' : '翻译 Translate'}
      </button>

      {/* Result */}
      {result && (
        <div style={{ padding:'12px 14px', background:'var(--parchment)',
          borderRadius:10, border:'0.5px solid var(--border)', position:'relative' }}>
          <div style={{ fontSize:15, color:'var(--text)', lineHeight:1.7 }}>{result}</div>
          <button onClick={()=>navigator.clipboard?.writeText(result)}
            style={{ position:'absolute', top:8, right:8, fontSize:12, padding:'3px 8px',
              cursor:'pointer', borderRadius:6, border:'0.5px solid var(--border)',
              background:'var(--card)', color:'var(--text-3)', fontFamily:'inherit' }}>
            Copy
          </button>
        </div>
      )}
    </div>
  );
}


// ── Voice / Describe search ───────────────────────────────────────
function DescribeSearch({ onPractice, lang }) {
  const [text,    setText]   = useState('');
  const [loading, setLoad]   = useState(false);
  const [results, setRes]    = useState([]);
  const [error,   setErr]    = useState('');
  const [listening, setLis]  = useState(false);
  const recogRef = useRef(null);

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr(lang==='zh'?'浏览器不支持语音':lang==='it'?'Voce non supportata':'Voice not supported in this browser'); return; }
    const r = new SR();
    r.lang = lang==='zh'?'zh-CN':lang==='it'?'it-IT':'en-US';
    r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => { setText(e.results[0][0].transcript); setLis(false); };
    r.onerror  = ()  => { setLis(false); };
    r.onend    = ()  => setLis(false);
    recogRef.current = r;
    r.start(); setLis(true); setErr('');
  };

  const search = async () => {
    if (!text.trim()) return;
    setLoad(true); setRes([]); setErr('');
    try {
      const res = await fetch('/.netlify/functions/voice-to-char', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ description: text.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRes(data.matches || []);
      if (!data.matches?.length && data.suggestion) setErr(data.suggestion);
    } catch(e) { setErr(e.message); }
    setLoad(false);
  };

  const placeholder = lang==='zh'?'用任何语言描述这个字… 如"太阳""月亮""fuoco"'
    :lang==='it'?'Descrivi il carattere in qualsiasi lingua… es. "sole", "fire", "agua"'
    :'Describe the character in any language… e.g. "sun", "fuoco", "月亮"';

  const ALL = SETS.flatMap(s => s.chars.map(c=>({...c,set:s})));

  return (
    <div style={{ padding:'0 16px' }}>
      {/* Instruction */}
      <div style={{ background:'var(--parchment)', borderRadius:12, padding:'12px 14px',
        border:'0.5px solid var(--border)', marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:500, color:'var(--text)', marginBottom:6 }}>
          {lang==='zh'?'🗣 用你的语言描述':lang==='it'?'🗣 Descrivi nella tua lingua':'🗣 Describe in your language'}
        </div>
        <div style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.7 }}>
          {lang==='zh'?'说出意思、形状或联想词，系统自动找到对应汉字。例："像太阳的字" "fuoco" "montagna"'
          :lang==='it'?'Descrivi il significato o una parola associata. es. "sole", "acqua", "月亮"'
          :'Say the meaning or an associated word. e.g. "sun", "water", "fuoco", "树"'}
        </div>
      </div>

      {/* Input + mic */}
      <div style={{ position:'relative', marginBottom:10 }}>
        <input value={text} onChange={e=>setText(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&search()}
          placeholder={placeholder}
          style={{ width:'100%', padding:'11px 48px 11px 14px', fontSize:14, borderRadius:10,
            border:`1.5px solid ${listening?'#8B4513':'var(--border)'}`,
            background:'var(--card)', color:'var(--text)', fontFamily:'inherit',
            boxSizing:'border-box', transition:'border-color 0.2s' }}/>
        <button onClick={startVoice}
          style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
            width:34, height:34, borderRadius:'50%', border:'none', cursor:'pointer',
            background:listening?'#c0392b':'#8B4513', color:'#fdf6e3', fontSize:16,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:listening?'0 0 0 6px rgba(192,57,43,0.2)':'none', transition:'all 0.2s' }}>
          {listening?'⏹':'🎤'}
        </button>
      </div>

      <button onClick={search} disabled={loading||!text.trim()}
        style={{ width:'100%', padding:'11px', fontSize:14, fontWeight:500,
          cursor:'pointer', borderRadius:10, border:'none', fontFamily:'inherit',
          background:loading||!text.trim()?'var(--border)':'#8B4513', color:'#fdf6e3', marginBottom:14 }}>
        {loading?(lang==='zh'?'搜索中…':lang==='it'?'Ricerca…':'Searching…')
          :(lang==='zh'?'🔍 找到这个字':lang==='it'?'🔍 Trova carattere':'🔍 Find character')}
      </button>

      {error && <div style={{ padding:'8px 12px', background:'#FFEBEE', borderRadius:8, fontSize:13, color:'#c0392b', marginBottom:10 }}>{error}</div>}

      {/* Results */}
      {results.map((r,i) => {
        const db = ALL.find(c => c.c === r.character);
        return (
          <div key={i} onClick={()=>db&&onPractice({...db})}
            style={{ background:'var(--card)', borderRadius:12, border:'0.5px solid var(--border)',
              padding:'14px', marginBottom:8, cursor:db?'pointer':'default',
              display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontSize:52, fontFamily:"'STKaiti','KaiTi',serif", lineHeight:1, minWidth:56, textAlign:'center' }}>
              {r.character}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                <span style={{ fontSize:18, fontWeight:500, color:'var(--text)' }}>{r.pinyin}</span>
                <span style={{ fontSize:11, padding:'1px 8px', borderRadius:20,
                  background: r.confidence==='high'?'#E8F5E9':'#FFF3E0',
                  color: r.confidence==='high'?'#2E7D32':'#E65100',
                  border:`1px solid ${r.confidence==='high'?'#2E7D3244':'#E6510044'}` }}>
                  {r.confidence}
                </span>
              </div>
              <div style={{ fontSize:14, color:'var(--text-2)', marginBottom:3 }}>{r.meaning}</div>
              <div style={{ fontSize:11, color:'var(--text-3)', fontStyle:'italic' }}>{r.reason}</div>
            </div>
            {db && <div style={{ fontSize:20, color:'#8B4513' }}>›</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Main SearchScreen ─────────────────────────────────────────────
export default function SearchScreen({ onPractice }) {
  const { lang } = useLang();
  const [tab,    setTab]    = useState('search');
  const [query,  setQuery]  = useState('');
  const [results, setRes]   = useState([]);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setRes([]); return; }

    // Direct character match
    const direct = ALL_CHARS.filter(c => c.c === q || c.p?.toLowerCase().includes(q) ||
      c.m?.toLowerCase().includes(q) || c.mz?.includes(q) || c.mi?.toLowerCase().includes(q));

    // Pinyin base match
    const pinyinMatches = Object.entries(PINYIN_MAP)
      .filter(([key]) => key.startsWith(q))
      .flatMap(([, chars]) => chars)
      .filter(c => !direct.find(d => d.c === c.c));

    const all = [...direct, ...pinyinMatches];
    // Deduplicate
    const seen = new Set();
    setRes(all.filter(c => { if(seen.has(c.c)) return false; seen.add(c.c); return true; }));
  }, [query]);

  const labels = {
    search:    lang==='zh'?'搜索字符':lang==='it'?'Cerca':'Search',
    translate: lang==='zh'?'翻译':lang==='it'?'Traduci':'Translate',
    placeholder: lang==='zh'?'拼音 / 汉字 / 释义…':lang==='it'?'Pinyin / carattere / significato…':'Pinyin / character / meaning…',
    noResults: lang==='zh'?'未找到字符':lang==='it'?'Nessun risultato':'No characters found',
    tryTip:    lang==='zh'?'试试 ri、shan、水、fire…':lang==='it'?'Prova ri, shan, 水, fire…':'Try ri, shan, 水, fire…',
    allChars:  lang==='zh'?'所有字符':lang==='it'?'Tutti i caratteri':'All characters',
  };

  return (
    <div style={{ padding:'16px 0', fontFamily:'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ padding:'0 16px 14px' }}>
        <div style={{ fontSize:18, fontWeight:500, color:'var(--text)', marginBottom:4 }}>
          {lang==='zh'?'🔍 搜索 · 翻译':lang==='it'?'🔍 Cerca · Traduci':'🔍 Search · Translate'}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, margin:'0 16px 14px',
        border:'0.5px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        {[['search','🔍 ' + labels.search],['describe', lang==='zh'?'🗣 说出来':lang==='it'?'🗣 Descrivi':'🗣 Describe'],['translate','🌐 ' + labels.translate]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{ flex:1, padding:'9px 4px', fontSize:13, cursor:'pointer', border:'none',
              fontFamily:'inherit', background:tab===t?'#8B4513':'var(--card)',
              color:tab===t?'#fdf6e3':'var(--text-2)', fontWeight:tab===t?500:400 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Search tab */}
      {tab==='search' && (
        <div style={{ padding:'0 16px' }}>
          <div style={{ position:'relative', marginBottom:14 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
              fontSize:16, color:'var(--text-3)' }}>🔍</span>
            <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)}
              placeholder={labels.placeholder}
              style={{ width:'100%', padding:'11px 12px 11px 38px', fontSize:15, borderRadius:10,
                border:'0.5px solid var(--border)', background:'var(--card)', color:'var(--text)',
                fontFamily:'inherit', boxSizing:'border-box' }}/>
            {query && (
              <button onClick={()=>setQuery('')}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                  border:'none', background:'none', cursor:'pointer', fontSize:18, color:'var(--text-3)' }}>
                ×
              </button>
            )}
          </div>

          {/* Results */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {results.length > 0 ? (
              results.map(c => (
                <CharResult key={c.c} char={c} onPractice={onPractice}/>
              ))
            ) : query ? (
              <div style={{ textAlign:'center', padding:'2rem 0', color:'var(--text-3)' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
                <div style={{ fontSize:14 }}>{labels.noResults}</div>
                <div style={{ fontSize:12, marginTop:4 }}>{labels.tryTip}</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:10 }}>{labels.allChars}</div>
                {SETS.map(s => (
                  <div key={s.id} style={{ marginBottom:14 }}>
                    <div style={{ fontSize:12, fontWeight:500, color:s.borderColor,
                      marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                      <span>{s.emoji}</span>
                      <span>{lang==='zh'?s.name:lang==='it'?s.nameIt:s.nameEn}</span>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {s.chars.map(c => (
                        <button key={c.c} onClick={()=>onPractice({...c,set:s})}
                          style={{ minWidth:44, padding:'6px 10px', fontSize:22,
                            cursor:'pointer', borderRadius:8, border:`1px solid ${s.borderColor}44`,
                            background:s.color, color:'var(--text)', fontFamily:'inherit' }}>
                          {c.c}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Describe tab */}
      {tab==='describe' && <DescribeSearch onPractice={onPractice} lang={lang}/>}

      {/* Voice tab */}
      {tab==='voice' && <VoiceSearch onPractice={onPractice}/>}

      {/* Translate tab */}
      {tab==='translate' && <TranslatePanel/>}
    </div>
  );
}
