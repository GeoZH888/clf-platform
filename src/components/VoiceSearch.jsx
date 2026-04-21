/**
 * src/components/VoiceSearch.jsx
 * 
 * Speak in ANY language → get the matching Chinese character
 * "sun" / "sole" / "太阳" / "fuego" → 日 / 火 etc.
 * 
 * Uses Web Speech API (browser built-in, no server needed for recognition)
 * Then calls Claude to match the spoken text to a character
 */
import { useState, useRef } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { SETS } from '../data/characters.js';

const ALL_CHARS = SETS.flatMap(s => s.chars.map(c => ({ ...c, set: s })));

export default function VoiceSearch({ onPractice }) {
  const { lang } = useLang();
  const [state,    setState]   = useState('idle'); // idle | listening | thinking | result | error
  const [transcript, setTrans] = useState('');
  const [results,  setResults] = useState([]);
  const [interpreted, setInterp] = useState('');
  const [error,    setError]   = useState('');
  const recognRef = useRef(null);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SpeechRecognition;

  const L = {
    title:    lang==='zh'?'🎤 说出来找汉字':lang==='it'?'🎤 Dì il carattere':'🎤 Say it, find it',
    sub:      lang==='zh'?'用任何语言说出含义，找到对应汉字':
              lang==='it'?'Di\' il significato in qualsiasi lingua':
              'Say the meaning in any language',
    tap:      lang==='zh'?'点击说话':lang==='it'?'Tocca per parlare':'Tap to speak',
    listening:lang==='zh'?'正在听…':lang==='it'?'Ascolto…':'Listening…',
    thinking: lang==='zh'?'正在匹配…':lang==='it'?'Cerco…':'Finding match…',
    again:    lang==='zh'?'再说一次':lang==='it'?'Di\' ancora':'Say again',
    practice: lang==='zh'?'练习':lang==='it'?'Pratica':'Practice',
    noMatch:  lang==='zh'?'未找到匹配字符':lang==='it'?'Nessun carattere trovato':'No match found',
    noSupport:lang==='zh'?'浏览器不支持语音识别\n请使用 Chrome 或 Edge':
              lang==='it'?'Browser non supportato\nUsa Chrome o Edge':
              'Voice not supported\nUse Chrome or Edge',
    examples: lang==='zh'?['试试说：sun、fire、水、luna、montagna、rest']:
              lang==='it'?['Prova: sun、fire、水、luna、montagna、rest']:
              ['Try saying: sun, fire, 水, luna, montagna, rest'],
    heard:    lang==='zh'?'听到：':lang==='it'?'Ho sentito:':'Heard:',
    meant:    lang==='zh'?'理解为：':lang==='it'?'Inteso come:':'Understood as:',
  };

  const startListening = () => {
    if (!SpeechRecognition) return;
    setError(''); setResults([]); setTrans(''); setInterp('');
    setState('listening');

    const recog = new SpeechRecognition();
    recog.continuous = false;
    recog.interimResults = false;
    // Accept any language
    recog.lang = lang === 'zh' ? 'zh-CN' : lang === 'it' ? 'it-IT' : 'en-US';
    recognRef.current = recog;

    recog.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setTrans(text);
      findCharacter(text);
    };

    recog.onerror = (e) => {
      setState('error');
      setError(e.error === 'no-speech' 
        ? (lang==='zh'?'没有听到声音':lang==='it'?'Nessun suono':'No speech detected')
        : e.error);
    };

    recog.onend = () => {
      if (recognRef.current) recognRef.current = null;
    };

    recog.start();
  };

  const stopListening = () => {
    recognRef.current?.stop();
    recognRef.current = null;
    if (state === 'listening') setState('idle');
  };

  const findCharacter = async (text) => {
    setState('thinking');
    try {
      const res = await fetch('/.netlify/functions/voice-to-char', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Enrich results with set data
      const enriched = (data.matches || []).map(m => {
        const dbChar = ALL_CHARS.find(c => c.c === m.character);
        return { ...m, dbChar };
      });

      setResults(enriched);
      setInterp(data.interpreted || '');
      setState('result');
    } catch(e) {
      setError(e.message);
      setState('error');
    }
  };

  const reset = () => {
    setState('idle'); setResults([]); setTrans(''); setInterp(''); setError('');
  };

  // ── Render ─────────────────────────────────────────────────────
  if (!supported) {
    return (
      <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--text-3)', fontSize:13, lineHeight:1.8 }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🎤</div>
        <div style={{ whiteSpace:'pre-line' }}>{L.noSupport}</div>
      </div>
    );
  }

  return (
    <div style={{ padding:'0 16px', fontFamily:'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:500, color:'var(--text)', marginBottom:4 }}>{L.title}</div>
        <div style={{ fontSize:12, color:'var(--text-3)' }}>{L.sub}</div>
      </div>

      {/* Big mic button */}
      <div style={{ textAlign:'center', marginBottom:16 }}>
        <button
          onClick={state === 'listening' ? stopListening : startListening}
          disabled={state === 'thinking'}
          style={{
            width:88, height:88, borderRadius:'50%', border:'none', cursor:'pointer',
            background: state === 'listening' ? '#c0392b'
                      : state === 'thinking'  ? '#a0704a'
                      : '#8B4513',
            color:'#fdf6e3', fontSize:34,
            display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto',
            boxShadow: state === 'listening'
              ? '0 0 0 12px rgba(192,57,43,0.15), 0 0 0 24px rgba(192,57,43,0.07)'
              : '0 4px 16px rgba(139,69,19,0.3)',
            transition:'all 0.3s',
            animation: state === 'listening' ? 'pulse 1.5s infinite' : 'none',
          }}>
          {state === 'thinking' ? '⏳' : state === 'listening' ? '⏹' : '🎤'}
        </button>
        <div style={{ marginTop:10, fontSize:13, color:'var(--text-3)', fontWeight: state==='listening'?500:400 }}>
          {state === 'idle'      ? L.tap :
           state === 'listening' ? L.listening :
           state === 'thinking'  ? L.thinking :
           state === 'result'    ? '' :
           state === 'error'     ? '' : ''}
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 0 12px rgba(192,57,43,0.15),0 0 0 24px rgba(192,57,43,0.07)} 50%{box-shadow:0 0 0 18px rgba(192,57,43,0.2),0 0 0 36px rgba(192,57,43,0.05)} }`}</style>

      {/* Transcript */}
      {transcript && (
        <div style={{ background:'var(--parchment)', borderRadius:10, padding:'8px 14px',
          marginBottom:10, fontSize:13, color:'var(--text-2)' }}>
          <span style={{ color:'var(--text-3)' }}>{L.heard} </span>
          <strong>"{transcript}"</strong>
        </div>
      )}

      {/* Interpreted */}
      {interpreted && (
        <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:10, textAlign:'center', fontStyle:'italic' }}>
          {L.meant} {interpreted}
        </div>
      )}

      {/* Results */}
      {state === 'result' && (
        <div>
          {results.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {results.map((r, i) => (
                <div key={i} style={{
                  background:'var(--card)', borderRadius:12,
                  border:`1.5px solid ${i===0?'#8B4513':'var(--border)'}`,
                  padding:'12px 14px', display:'flex', alignItems:'center', gap:12,
                }}>
                  {/* Character */}
                  <div style={{ textAlign:'center', minWidth:56 }}>
                    <div style={{ fontSize:48, fontFamily:"'STKaiti','KaiTi',serif", lineHeight:1 }}>{r.character}</div>
                    <div style={{ fontSize:10, color:'var(--text-3)', marginTop:2 }}>
                      {r.confidence === 'high' ? '★★★' : r.confidence === 'medium' ? '★★☆' : '★☆☆'}
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:16, fontWeight:500, color:'var(--text)', marginBottom:2 }}>{r.pinyin}</div>
                    <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:3 }}>
                      {lang==='zh' ? r.meaning_zh : lang==='it' ? r.meaning_it : r.meaning_en}
                    </div>
                    {r.dbChar?.set && (
                      <div style={{ fontSize:11, display:'inline-flex', alignItems:'center', gap:4,
                        padding:'1px 8px', borderRadius:20,
                        background:r.dbChar.set.color, border:`1px solid ${r.dbChar.set.borderColor}44`,
                        color:r.dbChar.set.borderColor }}>
                        {r.dbChar.set.emoji}
                        {lang==='zh'?r.dbChar.set.name:lang==='it'?r.dbChar.set.nameIt:r.dbChar.set.nameEn}
                      </div>
                    )}
                  </div>
                  {/* Practice button */}
                  {r.dbChar && (
                    <button onClick={() => onPractice(r.dbChar)}
                      style={{ padding:'8px 14px', fontSize:13, fontWeight:500, cursor:'pointer',
                        borderRadius:10, border:'none', background:'#8B4513', color:'#fdf6e3',
                        fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      {L.practice} ›
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'1.5rem', color:'var(--text-3)' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>🤷</div>
              <div style={{ fontSize:14 }}>{L.noMatch}</div>
            </div>
          )}
          <button onClick={reset} style={{ width:'100%', marginTop:12, padding:'10px',
            fontSize:13, cursor:'pointer', borderRadius:10,
            border:'1.5px solid var(--border)', background:'var(--card)',
            color:'var(--text)', fontFamily:'inherit' }}>
            🎤 {L.again}
          </button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div>
          <div style={{ padding:'10px 14px', background:'#FFEBEE', borderRadius:10,
            fontSize:13, color:'#c0392b', marginBottom:10 }}>{error}</div>
          <button onClick={reset} style={{ width:'100%', padding:'10px', fontSize:13,
            cursor:'pointer', borderRadius:10, border:'1.5px solid var(--border)',
            background:'var(--card)', color:'var(--text)', fontFamily:'inherit' }}>
            🎤 {L.again}
          </button>
        </div>
      )}

      {/* Examples when idle */}
      {state === 'idle' && (
        <div style={{ textAlign:'center', marginTop:8 }}>
          {L.examples.map((ex, i) => (
            <div key={i} style={{ fontSize:12, color:'var(--text-3)', fontStyle:'italic' }}>{ex}</div>
          ))}
        </div>
      )}
    </div>
  );
}
