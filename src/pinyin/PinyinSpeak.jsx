// src/pinyin/PinyinSpeak.jsx
// Pronunciation practice: listen → record → score + feedback
// Uses Web Speech API for recognition + Azure TTS for playback

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';

const TOKEN_KEY = 'jgw_device_token';

// ── Pinyin syllables to practice ────────────────────────────────────────────
const SYLLABLES = [
  // Tones on 'a'
  { pinyin:'māo',  char:'猫', meaning:'cat',    level:1 },
  { pinyin:'nǐ',   char:'你', meaning:'you',    level:1 },
  { pinyin:'hǎo',  char:'好', meaning:'good',   level:1 },
  { pinyin:'wǒ',   char:'我', meaning:'I / me', level:1 },
  { pinyin:'shū',  char:'书', meaning:'book',   level:1 },
  { pinyin:'chī',  char:'吃', meaning:'eat',    level:2 },
  { pinyin:'shuō', char:'说', meaning:'speak',  level:2 },
  { pinyin:'zhōng',char:'中', meaning:'middle/China', level:2 },
  { pinyin:'guó',  char:'国', meaning:'country',level:2 },
  { pinyin:'xué',  char:'学', meaning:'study',  level:2 },
  { pinyin:'lǎoshī',char:'老师',meaning:'teacher',level:3 },
  { pinyin:'xuésheng',char:'学生',meaning:'student',level:3 },
  { pinyin:'péngyǒu',char:'朋友',meaning:'friend',level:3 },
  { pinyin:'xièxiè',char:'谢谢',meaning:'thank you',level:3 },
  { pinyin:'duìbuqǐ',char:'对不起',meaning:'sorry',level:3 },
];

// Strip tone marks → plain pinyin for speech recognition matching
function stripTones(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'');
}

// Score: 0-100 based on character similarity
function scoreMatch(spoken, expected) {
  const a = spoken.toLowerCase().trim();
  const b = stripTones(expected).toLowerCase().trim();
  if (a === b) return 100;
  // Check if spoken contains the expected
  if (a.includes(b) || b.includes(a)) return 85;
  // Character overlap
  let matches = 0;
  for (const ch of b) { if (a.includes(ch)) matches++; }
  return Math.round((matches / Math.max(b.length, 1)) * 70);
}

function ScoreRing({ score }) {
  const r = 36, c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const color = score >= 80 ? '#2E7D32' : score >= 60 ? '#F57F17' : '#C62828';
  return (
    <svg width={90} height={90} viewBox="0 0 90 90">
      <circle cx={45} cy={45} r={r} fill="none" stroke="#f0e8d8" strokeWidth={8}/>
      <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform="rotate(-90 45 45)" style={{transition:'stroke-dasharray 0.8s ease'}}/>
      <text x={45} y={50} textAnchor="middle" fontSize={22} fontWeight={700} fill={color}>{score}</text>
    </svg>
  );
}

export default function PinyinSpeak({ onBack }) {
  const { lang } = useLang();
  const t = (zh, en) => lang === 'zh' ? zh : en;

  const [items]       = useState(() => [...SYLLABLES].sort(() => Math.random() - 0.5));
  const [idx,          setIdx]         = useState(0);
  const [phase,        setPhase]       = useState('listen'); // listen | record | result
  const [recording,    setRecording]   = useState(false);
  const [spokenText,   setSpokenText]  = useState('');
  const [score,        setScore]       = useState(null);
  const [sessionScores,setSessionScores]=useState([]);
  const [ttsLoading,   setTtsLoading]  = useState(false);
  const [error,        setError]       = useState('');
  const recognizerRef  = useRef(null);
  const audioRef       = useRef(null);

  const item = items[idx];

  // ── Play TTS pronunciation ─────────────────────────────────────────────────
  async function playPronunciation() {
    setTtsLoading(true);
    setError('');
    try {
      // Get Azure TTS token
      const tokenRes = await fetch('/.netlify/functions/azure-speech-token');
      if (!tokenRes.ok) throw new Error('TTS not available');
      const { token, region } = await tokenRes.json();

      const ssml = `<speak version='1.0' xml:lang='zh-CN'>
        <voice name='zh-CN-XiaoxiaoNeural'>
          <prosody rate='slow'>${item.char}</prosody>
        </voice>
      </speak>`;

      const ttsRes = await fetch(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          },
          body: ssml,
        }
      );
      if (!ttsRes.ok) throw new Error('TTS failed');
      const blob = await ttsRes.blob();
      const url  = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(url);
      audioRef.current.play();
      setPhase('record');
    } catch(e) {
      setError(t('TTS播放失败，请检查Azure配置', 'TTS failed: ' + e.message));
      setPhase('record'); // Allow recording anyway
    }
    setTtsLoading(false);
  }

  // ── Start speech recognition ─────────────────────────────────────────────
  function startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(t('浏览器不支持语音识别，请使用Chrome', 'Browser does not support speech recognition. Use Chrome.'));
      return;
    }
    setError('');
    setSpokenText('');
    setScore(null);

    const rec = new SpeechRecognition();
    rec.lang = 'zh-CN';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    recognizerRef.current = rec;

    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript).join('');
      setSpokenText(transcript);
    };

    rec.onend = () => {
      setRecording(false);
      // Calculate score
      const finalSpoken = recognizerRef.current?._lastTranscript || spokenText;
      finishRecording(finalSpoken || spokenText);
    };

    rec.onerror = (e) => {
      setRecording(false);
      if (e.error !== 'no-speech') {
        setError(t('识别出错: ' + e.error, 'Recognition error: ' + e.error));
      }
      finishRecording(spokenText);
    };

    // Store transcript for onend
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      setSpokenText(transcript);
      rec._lastTranscript = transcript;
    };

    setRecording(true);
    rec.start();
  }

  function stopRecording() {
    recognizerRef.current?.stop();
    setRecording(false);
  }

  function finishRecording(spoken) {
    const s = scoreMatch(spoken || '', item.char + ' ' + stripTones(item.pinyin));
    setScore(s);
    setSessionScores(prev => [...prev, { item, score:s, spoken }]);
    setPhase('result');
    // Award points
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && s >= 60) {
      supabase.from('jgw_points').insert({
        device_token: token, module: 'pinyin',
        action: 'pinyin_speak_' + (s >= 80 ? 'good' : 'ok'),
        points: s >= 80 ? 10 : 5,
      }).then(() => {});
    }
  }

  function nextItem() {
    setIdx(i => (i + 1) % items.length);
    setPhase('listen');
    setScore(null);
    setSpokenText('');
    setError('');
  }

  const avgScore = sessionScores.length
    ? Math.round(sessionScores.reduce((s,r) => s + r.score, 0) / sessionScores.length) : null;

  const getFeedback = (s) => {
    if (s >= 90) return { emoji:'🏆', text: t('太棒了！发音完美！', 'Perfect pronunciation!'), color:'#2E7D32' };
    if (s >= 75) return { emoji:'👍', text: t('很好！继续练习！', 'Great! Keep it up!'),    color:'#1565C0' };
    if (s >= 55) return { emoji:'🙂', text: t('不错，再练习一次', 'Good try, practice again'),color:'#F57F17' };
    return       { emoji:'💪', text: t('再来一次，听听发音', 'Try again, listen first'),      color:'#C62828' };
  };

  const fb = score !== null ? getFeedback(score) : null;

  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3',
      display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ background:'#1565C0', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#fff' }}>
            🎤 {t('发音练习', 'Pronunciation Practice')}
          </div>
          <div style={{ fontSize:11, color:'#BBDEFB' }}>
            {idx+1} / {items.length}
            {sessionScores.length > 0 && ` · ${t('平均','Avg')}: ${avgScore}分`}
          </div>
        </div>
        {/* Session progress pills */}
        <div style={{ display:'flex', gap:3 }}>
          {sessionScores.slice(-5).map((r,i) => (
            <div key={i} style={{ width:8, height:8, borderRadius:'50%',
              background: r.score>=75 ? '#69F0AE' : r.score>=55 ? '#FFD740' : '#FF5252' }}/>
          ))}
        </div>
      </div>

      {/* Main card */}
      <div style={{ flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', padding:'20px 16px', gap:20 }}>

        {/* Character display */}
        <div style={{ background:'#fff', borderRadius:24, padding:'24px 32px',
          border:'2px solid #BBDEFB', textAlign:'center', width:'100%', maxWidth:340,
          boxShadow:'0 4px 20px #1565C022' }}>
          <div style={{ fontSize:72, lineHeight:1, fontFamily:"'STKaiti','KaiTi',serif",
            color:'#1a0a05', marginBottom:8 }}>
            {item.char}
          </div>
          <div style={{ fontSize:20, color:'#1565C0', fontWeight:600, marginBottom:4 }}>
            {item.pinyin}
          </div>
          <div style={{ fontSize:13, color:'#6b4c2a' }}>{item.meaning}</div>
          <div style={{ display:'flex', justifyContent:'center', marginTop:6 }}>
            {Array.from({length:item.level}).map((_,i) => (
              <span key={i} style={{ fontSize:10, color:'#F57F17' }}>★</span>
            ))}
            {Array.from({length:3-item.level}).map((_,i) => (
              <span key={i} style={{ fontSize:10, color:'#E0E0E0' }}>★</span>
            ))}
          </div>
        </div>

        {/* Score ring (in result phase) */}
        {phase === 'result' && score !== null && (
          <div style={{ textAlign:'center' }}>
            <ScoreRing score={score}/>
            <div style={{ fontSize:28, marginTop:4 }}>{fb?.emoji}</div>
            <div style={{ fontSize:14, fontWeight:600, color:fb?.color, marginTop:4 }}>
              {fb?.text}
            </div>
            {spokenText && (
              <div style={{ marginTop:8, fontSize:12, color:'#a07850',
                background:'#f5ede0', borderRadius:10, padding:'6px 12px' }}>
                {t('你说的:', 'You said:')} <strong>{spokenText}</strong>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ fontSize:12, color:'#C62828', background:'#FFEBEE',
            borderRadius:10, padding:'8px 14px', maxWidth:340, textAlign:'center' }}>
            {error}
          </div>
        )}

        {/* Recording indicator */}
        {recording && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:40 }}>
              {[0.4,0.7,1,0.7,0.4,0.9,0.6].map((h,i) => (
                <div key={i} style={{ width:6, borderRadius:3,
                  height: `${h*100}%`, background:'#1565C0',
                  animation:`eq${i} 0.5s ease infinite alternate`,
                  animationDelay:`${i*0.1}s` }}/>
              ))}
            </div>
            <div style={{ fontSize:12, color:'#1565C0', fontWeight:600 }}>
              {t('正在录音…说出这个词', 'Recording… say the word')}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:10 }}>

        {phase === 'listen' && (
          <button onClick={playPronunciation} disabled={ttsLoading}
            style={{ padding:'16px', borderRadius:16, border:'none', fontSize:16,
              fontWeight:700, cursor:ttsLoading?'default':'pointer',
              background: ttsLoading ? '#E0E0E0' : '#1565C0', color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            {ttsLoading ? '🔊 Loading…' : '🔊 ' + t('听发音', 'Listen to pronunciation')}
          </button>
        )}

        {phase === 'record' && !recording && (
          <button onClick={startRecording}
            style={{ padding:'16px', borderRadius:16, border:'none', fontSize:16,
              fontWeight:700, cursor:'pointer',
              background:'#C62828', color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            🎤 {t('开始录音', 'Start Recording')}
          </button>
        )}

        {recording && (
          <button onClick={stopRecording}
            style={{ padding:'16px', borderRadius:16, border:'none', fontSize:16,
              fontWeight:700, cursor:'pointer',
              background:'#1a0a05', color:'#fff',
              display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            ⏹ {t('停止录音', 'Stop')}
          </button>
        )}

        {phase === 'record' && !recording && (
          <button onClick={playPronunciation}
            style={{ padding:'12px', borderRadius:14, border:'1.5px solid #1565C0',
              fontSize:13, fontWeight:600, cursor:'pointer',
              background:'#fff', color:'#1565C0' }}>
            🔊 {t('再听一次', 'Listen again')}
          </button>
        )}

        {phase === 'result' && (
          <>
            {score !== null && score < 75 && (
              <button onClick={() => { setPhase('listen'); setScore(null); setSpokenText(''); }}
                style={{ padding:'14px', borderRadius:14, border:'none', fontSize:14,
                  fontWeight:600, cursor:'pointer',
                  background:'#1565C0', color:'#fff' }}>
                🔄 {t('再练一次', 'Try again')}
              </button>
            )}
            <button onClick={nextItem}
              style={{ padding:'14px', borderRadius:14,
                border:`1.5px solid #1565C0`,
                fontSize:14, fontWeight:600, cursor:'pointer',
                background: score !== null && score >= 75 ? '#1565C0' : '#fff',
                color:      score !== null && score >= 75 ? '#fff' : '#1565C0' }}>
              {t('下一个', 'Next')} →
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes eq0{to{height:40%}} @keyframes eq1{to{height:80%}}
        @keyframes eq2{to{height:50%}} @keyframes eq3{to{height:90%}}
        @keyframes eq4{to{height:60%}} @keyframes eq5{to{height:40%}}
        @keyframes eq6{to{height:70%}}
      `}</style>
    </div>
  );
}
