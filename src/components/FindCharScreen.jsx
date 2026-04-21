/**
 * src/components/FindCharScreen.jsx
 * 
 * Type OR speak in your mother language → see the Chinese character → practice it
 * 
 * Input modes:
 *   ⌨️  Type  — fill in any word in any language
 *   🎤  Voice — say it out loud
 * 
 * Output:
 *   Large character display → meaning in 3 languages → Practice button
 */
import { useState, useRef } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { SETS } from '../data/characters.js';

const ALL_CHARS = SETS.flatMap(s => s.chars.map(c => ({ ...c, set: s })));

// ── Big character card shown after match ──────────────────────────
function CharCard({ match, onPractice, lang }) {
  const dbChar = ALL_CHARS.find(c => c.c === match.character);
  const set = dbChar?.set;

  const meaning = lang==='zh' ? (match.meaning_zh || match.meaning_en)
                : lang==='it' ? (match.meaning_it || match.meaning_en)
                : match.meaning_en;

  return (
    <div style={{
      background:'var(--parchment)',
      border:`2px solid ${set?.borderColor || '#8B4513'}`,
      borderRadius:20, padding:'24px 20px', textAlign:'center',
      boxShadow:'0 4px 20px rgba(139,69,19,0.12)',
    }}>
      {/* Set badge */}
      {set && (
        <div style={{ marginBottom:12, display:'flex', justifyContent:'center' }}>
          <span style={{ fontSize:11, padding:'3px 12px', borderRadius:20,
            background:set.color, border:`1px solid ${set.borderColor}44`,
            color:set.borderColor, fontWeight:500 }}>
            {set.emoji} {lang==='zh'?set.name:lang==='it'?set.nameIt:set.nameEn}
          </span>
        </div>
      )}

      {/* The character — BIG */}
      <div style={{
        fontSize:120, fontFamily:"'STKaiti','KaiTi',serif",
        lineHeight:1, color:'#1a0a05', margin:'8px 0 12px',
        textShadow:'2px 3px 8px rgba(139,69,19,0.15)',
      }}>
        {match.character}
      </div>

      {/* Pinyin */}
      <div style={{ fontSize:22, color:'#8B4513', fontWeight:500, marginBottom:6 }}>
        {match.pinyin}
      </div>

      {/* Meaning in all 3 languages */}
      <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:16 }}>
        <div style={{ fontSize:15, color:'var(--text)' }}>{match.meaning_en}</div>
        <div style={{ fontSize:14, color:'var(--text-2)' }}>{match.meaning_zh}</div>
        <div style={{ fontSize:14, color:'var(--text-2)', fontStyle:'italic' }}>{match.meaning_it}</div>
      </div>

      {/* Confidence */}
      <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>
        {match.confidence === 'high'   ? '★★★ ' : 
         match.confidence === 'medium' ? '★★☆ ' : '★☆☆ '}
        {match.reason}
      </div>

      {/* Practice button */}
      {dbChar ? (
        <button onClick={() => onPractice(dbChar)}
          style={{
            width:'100%', padding:'14px', fontSize:16, fontWeight:600,
            cursor:'pointer', borderRadius:12, border:'none',
            background:'#8B4513', color:'#fdf6e3', fontFamily:'inherit',
            boxShadow:'0 3px 10px rgba(139,69,19,0.3)',
          }}>
          ✏️ {lang==='zh'?'开始练习':lang==='it'?'Inizia a praticare':'Start practising'} {match.character}
        </button>
      ) : (
        <div style={{ fontSize:13, color:'var(--text-3)', padding:'8px',
          background:'var(--card)', borderRadius:8 }}>
          {lang==='zh'?'此字符暂未收录，敬请期待':
           lang==='it'?'Carattere non ancora incluso':
           'Character not yet in the app'}
        </div>
      )}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────
export default function FindCharScreen({ onPractice }) {
  const { lang } = useLang();
  const [inputMode, setInputMode] = useState('type'); // type | voice
  const [text,     setText]    = useState('');
  const [state,    setState]   = useState('idle'); // idle | listening | thinking | result | error
  const [matches,  setMatches] = useState([]);
  const [interpreted, setInterp] = useState('');
  const [error,    setError]   = useState('');
  const recognRef = useRef(null);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const L = {
    title:       lang==='zh'?'用母语找汉字':lang==='it'?'Trova il carattere':'Find a character',
    sub:         lang==='zh'?'用任何语言输入或说出含义，找到对应汉字':
                 lang==='it'?'Scrivi o di\' il significato in qualsiasi lingua':
                 'Type or say the meaning in any language',
    typeTab:     lang==='zh'?'⌨️ 输入':lang==='it'?'⌨️ Scrivi':'⌨️ Type',
    voiceTab:    lang==='zh'?'🎤 说话':lang==='it'?'🎤 Parla':'🎤 Speak',
    placeholder: lang==='zh'?'例如：太阳、火、月亮、cavallo、fire…':
                 lang==='it'?'Es: sole, fuoco, montagna, fire, 水…':
                 'e.g. sun, fire, water, 月亮, montagna…',
    find:        lang==='zh'?'找汉字':lang==='it'?'Trova':'Find character',
    tap:         lang==='zh'?'点击麦克风说话':lang==='it'?'Tocca il microfono':'Tap to speak',
    listening:   lang==='zh'?'正在听… 点击停止':lang==='it'?'Ascolto… tocca per fermare':'Listening… tap to stop',
    thinking:    lang==='zh'?'🔍 正在匹配汉字…':lang==='it'?'🔍 Cerco il carattere…':'🔍 Finding match…',
    heard:       lang==='zh'?'听到：':lang==='it'?'Ho sentito:':'Heard:',
    tryAgain:    lang==='zh'?'重新搜索':lang==='it'?'Riprova':'Try again',
    other:       lang==='zh'?'其他匹配':lang==='it'?'Altre corrispondenze':'Other matches',
  };

  const callAPI = async (inputText) => {
    if (!inputText?.trim()) return;
    setState('thinking');
    setMatches([]); setError(''); setInterp('');
    try {
      const res = await fetch('/.netlify/functions/voice-to-char', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ text: inputText.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMatches(data.matches || []);
      setInterp(data.interpreted || '');
      setState('result');
    } catch(e) {
      setError(e.message);
      setState('error');
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    callAPI(text);
  };

  const startVoice = () => {
    if (!SpeechRecognition) {
      setError(lang==='zh'?'请使用Chrome或Edge浏览器':lang==='it'?'Usa Chrome o Edge':'Use Chrome or Edge');
      return;
    }
    setError(''); setState('listening');
    const recog = new SpeechRecognition();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = lang==='zh'?'zh-CN':lang==='it'?'it-IT':'en-US';
    recognRef.current = recog;
    recog.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setText(t);
      callAPI(t);
    };
    recog.onerror = (e) => {
      setState('error');
      setError(e.error === 'no-speech'
        ? (lang==='zh'?'没听到声音，请再试':lang==='it'?'Nessun audio':'No speech detected')
        : e.error);
    };
    recog.start();
  };

  const stopVoice = () => {
    recognRef.current?.stop();
    if (state==='listening') setState('idle');
  };

  const reset = () => {
    setState('idle'); setMatches([]); setText(''); setInterp(''); setError('');
  };

  const isListening = state === 'listening';
  const isThinking  = state === 'thinking';
  const isResult    = state === 'result';
  const isError     = state === 'error';

  return (
    <div style={{ padding:'16px', fontFamily:'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:18, fontWeight:600, color:'var(--text)', marginBottom:4 }}>
          {L.title}
        </div>
        <div style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.5 }}>
          {L.sub}
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display:'flex', border:'0.5px solid var(--border)',
        borderRadius:10, overflow:'hidden', marginBottom:16 }}>
        {[['type', L.typeTab], ['voice', L.voiceTab]].map(([m, label]) => (
          <button key={m} onClick={() => { setInputMode(m); reset(); }}
            style={{ flex:1, padding:'10px', fontSize:14, cursor:'pointer', border:'none',
              fontFamily:'inherit', fontWeight: inputMode===m ? 600 : 400,
              background: inputMode===m ? '#8B4513' : 'var(--card)',
              color: inputMode===m ? '#fdf6e3' : 'var(--text-2)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TYPE MODE ──────────────────────────────────────────── */}
      {inputMode==='type' && !isResult && (
        <form onSubmit={handleSubmit}>
          <div style={{ position:'relative', marginBottom:10 }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={L.placeholder}
              autoFocus
              style={{ width:'100%', padding:'13px 46px 13px 14px', fontSize:16,
                borderRadius:12, border:`1.5px solid ${text?'#8B4513':'var(--border)'}`,
                background:'var(--card)', color:'var(--text)', fontFamily:'inherit',
                boxSizing:'border-box', outline:'none', transition:'border 0.2s' }}/>
            {text && (
              <button type="button" onClick={() => setText('')}
                style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                  border:'none', background:'none', cursor:'pointer', fontSize:20, color:'var(--text-3)' }}>
                ×
              </button>
            )}
          </div>

          {/* Language hint pills */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {['sun','sole','太阳','fire','fuoco','火','water','acqua','水','mountain'].map(ex => (
              <button key={ex} type="button" onClick={() => { setText(ex); callAPI(ex); }}
                style={{ padding:'4px 10px', fontSize:12, cursor:'pointer', borderRadius:20,
                  border:'0.5px solid var(--border)', background:'var(--parchment)',
                  color:'var(--text-2)', fontFamily:'inherit' }}>
                {ex}
              </button>
            ))}
          </div>

          <button type="submit" disabled={!text.trim() || isThinking}
            style={{ width:'100%', padding:'13px', fontSize:15, fontWeight:600,
              cursor:'pointer', borderRadius:12, border:'none', fontFamily:'inherit',
              background: text.trim() && !isThinking ? '#8B4513' : 'var(--border)',
              color: text.trim() && !isThinking ? '#fdf6e3' : 'var(--text-3)',
              transition:'all 0.2s' }}>
            {isThinking ? L.thinking : L.find}
          </button>
        </form>
      )}

      {/* ── VOICE MODE ─────────────────────────────────────────── */}
      {inputMode==='voice' && !isResult && (
        <div style={{ textAlign:'center', padding:'1rem 0' }}>
          <button
            onClick={isListening ? stopVoice : startVoice}
            disabled={isThinking}
            style={{
              width:100, height:100, borderRadius:'50%', border:'none', cursor:'pointer',
              background: isListening ? '#c0392b' : isThinking ? '#a0704a' : '#8B4513',
              color:'#fdf6e3', fontSize:40, margin:'0 auto 16px',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow: isListening
                ? '0 0 0 14px rgba(192,57,43,0.12), 0 0 0 28px rgba(192,57,43,0.06)'
                : '0 4px 20px rgba(139,69,19,0.25)',
              transition:'all 0.3s',
            }}>
            {isThinking ? '⏳' : isListening ? '⏹' : '🎤'}
          </button>

          <div style={{ fontSize:14, color: isListening?'#c0392b':'var(--text-3)',
            fontWeight: isListening?500:400, marginBottom:12 }}>
            {isThinking ? L.thinking : isListening ? L.listening : L.tap}
          </div>

          {/* Heard */}
          {text && (
            <div style={{ background:'var(--parchment)', borderRadius:10, padding:'8px 16px',
              fontSize:14, color:'var(--text)', display:'inline-block' }}>
              {L.heard} <strong>"{text}"</strong>
            </div>
          )}

          {/* Lang selector for voice */}
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:16 }}>
            {[['zh-CN','🇨🇳'],['en-US','🇬🇧'],['it-IT','🇮🇹'],['es-ES','🇪🇸'],['fr-FR','🇫🇷'],['de-DE','🇩🇪']].map(([code, flag]) => {
              const isSelected = (code === 'zh-CN' && lang==='zh') ||
                                 (code === 'en-US' && lang==='en') ||
                                 (code === 'it-IT' && lang==='it');
              return (
                <div key={code} style={{ fontSize:20, opacity: isSelected?1:0.4 }}
                  title={code}>{flag}</div>
              );
            })}
          </div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginTop:6 }}>
            {lang==='zh'?'语音识别语言由应用语言决定':
             lang==='it'?'Lingua riconoscimento = lingua app':
             'Voice language follows app language'}
          </div>
        </div>
      )}

      {/* ── ERROR ──────────────────────────────────────────────── */}
      {isError && (
        <div style={{ marginTop:10 }}>
          <div style={{ padding:'10px 14px', background:'#FFEBEE', borderRadius:10,
            fontSize:13, color:'#c0392b', marginBottom:10 }}>{error}</div>
          <button onClick={reset} style={{ width:'100%', padding:'10px', fontSize:13,
            cursor:'pointer', borderRadius:10, border:'1.5px solid var(--border)',
            background:'var(--card)', color:'var(--text)', fontFamily:'inherit' }}>
            ↺ {L.tryAgain}
          </button>
        </div>
      )}

      {/* ── RESULTS ────────────────────────────────────────────── */}
      {isResult && matches.length > 0 && (
        <div>
          {/* Interpreted */}
          {interpreted && (
            <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center',
              marginBottom:14, fontStyle:'italic' }}>
              "{text}" → {interpreted}
            </div>
          )}

          {/* Best match — big card */}
          <CharCard match={matches[0]} onPractice={onPractice} lang={lang}/>

          {/* Other matches */}
          {matches.length > 1 && (
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:8 }}>{L.other}</div>
              <div style={{ display:'flex', gap:8 }}>
                {matches.slice(1).map((m, i) => {
                  const db = ALL_CHARS.find(c => c.c === m.character);
                  return (
                    <button key={i} onClick={() => db && onPractice(db)}
                      style={{ flex:1, padding:'10px 8px', cursor:'pointer', borderRadius:10,
                        border:'0.5px solid var(--border)', background:'var(--card)',
                        textAlign:'center', fontFamily:'inherit' }}>
                      <div style={{ fontSize:32, fontFamily:"'STKaiti','KaiTi',serif" }}>{m.character}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>{m.pinyin}</div>
                      <div style={{ fontSize:11, color:'var(--text-2)' }}>
                        {lang==='zh'?m.meaning_zh:lang==='it'?m.meaning_it:m.meaning_en}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Try again */}
          <button onClick={reset} style={{ width:'100%', marginTop:14, padding:'10px',
            fontSize:13, cursor:'pointer', borderRadius:10,
            border:'1.5px solid var(--border)', background:'var(--card)',
            color:'var(--text)', fontFamily:'inherit' }}>
            ↺ {L.tryAgain}
          </button>
        </div>
      )}

      {/* No result */}
      {isResult && matches.length === 0 && (
        <div style={{ textAlign:'center', padding:'2rem 0' }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🤷</div>
          <div style={{ fontSize:14, color:'var(--text-2)', marginBottom:4 }}>
            {lang==='zh'?'没找到匹配的汉字':lang==='it'?'Nessun carattere trovato':'No matching character'}
          </div>
          <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>
            {lang==='zh'?'试试其他词语':lang==='it'?'Prova un\'altra parola':'Try a different word'}
          </div>
          <button onClick={reset} style={{ padding:'10px 24px', fontSize:13,
            cursor:'pointer', borderRadius:10, border:'1.5px solid var(--border)',
            background:'var(--card)', color:'var(--text)', fontFamily:'inherit' }}>
            ↺ {L.tryAgain}
          </button>
        </div>
      )}
    </div>
  );
}
