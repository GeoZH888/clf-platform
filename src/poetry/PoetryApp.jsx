// src/poetry/PoetryApp.jsx
// 诗歌 Poetry module — read, recite, memorize, quiz Chinese classical poetry

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';
import { useScreenHistory } from '../hooks/useScreenHistory.js';
import AdaptiveCard from '../components/AdaptiveCard.jsx';

const TOKEN_KEY = 'jgw_device_token';
const GOLD = '#C8972A';
const POETRY_BG = '#1a0f00';

async function awardPts(action, pts) {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) await supabase.from('jgw_points').insert({ device_token:t, module:'poetry', action, points:pts });
}

// ── Poem card component ──────────────────────────────────────────────────────
function PoemCard({ poem, lang, onSelect, compact=false }) {
  const t = (zh,en,it) => lang==='zh'?zh:lang==='it'?it||en:en;
  const dynasty = poem.dynasty || '';
  const author  = poem.author  || '';
  const title   = lang==='zh'?poem.title:(poem.title_en||poem.title);
  const preview = poem.lines?.[0] || '';

  return (
    <button onClick={onSelect}
      style={{ width:'100%', textAlign:'left', cursor:'pointer', padding:0,
        background:'none', border:'none', marginBottom:compact?6:10 }}>
      <div style={{ background:'#fff',
        border:'1px solid #e8d5b0', borderRadius:16, padding:compact?'12px 14px':'16px',
        transition:'transform 0.15s, box-shadow 0.15s',
        boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:compact?15:18, fontWeight:700, color:'#8B4513',
              fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:2, marginBottom:4 }}>
              {title}
            </div>
            <div style={{ fontSize:11, color:'#a07850', marginBottom:compact?0:8 }}>
              {dynasty && `${dynasty} · `}{author}
            </div>
            {!compact && preview && (
              <div style={{ fontSize:13, color:'#5D2E0C', fontFamily:"'STKaiti','KaiTi',serif",
                letterSpacing:1, lineHeight:1.8 }}>
                {preview}
              </div>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
            {poem.dynasty_en && (
              <span style={{ fontSize:9, background:'#8B451322', color:'#8B4513',
                padding:'2px 7px', borderRadius:8 }}>{poem.dynasty_en||dynasty}</span>
            )}
            {poem.difficulty && (
              <span style={{ fontSize:9, color:'#C8972A' }}>
                {'★'.repeat(poem.difficulty)}{'☆'.repeat(3-poem.difficulty)}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Pinyin-annotated line ────────────────────────────────────────────────────
function PinyinLine({ line, pinyinLine }) {
  // pinyinLine: array of pinyin per char, e.g. ["chuáng","qián","míng","yuè","guāng"]
  const chars = [...line];
  const py = pinyinLine || [];
  return (
    <div style={{ display:'inline-flex', gap:2, justifyContent:'center', flexWrap:'wrap' }}>
      {chars.map((ch, i) => (
        <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:28 }}>
          <div style={{ fontSize:10, color:`${GOLD}99`, lineHeight:1.4, letterSpacing:0,
            fontFamily:'sans-serif', minHeight:14 }}>
            {py[i] || ''}
          </div>
          <div style={{ fontSize:24, color:'#fdf6e3', fontFamily:"'STKaiti','KaiTi',serif",
            lineHeight:1.3 }}>
            {ch}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Read screen — full poem with image, pinyin, trilingual stories ───────────
function ReadScreen({ poem, lang, onBack }) {
  const t = (zh,en,it) => lang==='zh'?zh:lang==='it'?it||en:en;
  const [showTrans,   setShowTrans]   = useState(false);
  const [showPinyin,  setShowPinyin]  = useState(false);
  const [showBg,      setShowBg]      = useState(false);
  const [imgPreview,  setImgPreview]  = useState(false);

  // ─── Audio playback state ──────────────────────────────────────────
  // poem.audio_url is the pre-generated mp3 (Azure TTS) from admin side.
  const audioRef = useRef(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);  // 0..1
  const [duration, setDuration] = useState(0);  // seconds

  // Reset audio state when poem changes
  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }, [poem?.id]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(err => {
        console.warn('audio play failed:', err);
        setPlaying(false);
      });
    } else {
      a.pause();
    }
  }

  function seekTo(fraction) {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = fraction * duration;
  }

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }
  // ────────────────────────────────────────────────────────────────────

  const title = lang==='zh'?poem.title:(poem.title_en||poem.title);

  useEffect(() => { awardPts('poetry_read', 5); }, []);

  const lines     = poem.lines     || [];
  const pinyinMap = poem.pinyin_map || {}; // {0:['chuáng','qián',...], 1:[...]}

  const trans = lang==='zh' ? poem.translation_zh
    : lang==='it' ? (poem.translation_it||poem.translation_en)
    : poem.translation_en;

  const background = lang==='zh' ? poem.background_zh
    : lang==='it' ? (poem.background_it||poem.background_en||poem.background_zh)
    : (poem.background_en||poem.background_zh);

  const notes = lang==='zh' ? poem.notes_zh
    : (poem.notes_en||poem.notes_zh);

  return (
    <div style={{ minHeight:'100dvh', background:POETRY_BG, display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12,
        background:'rgba(0,0,0,0.4)', backdropFilter:'blur(8px)' }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:GOLD, cursor:'pointer' }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:GOLD, fontFamily:"'STKaiti','KaiTi',serif" }}>{title}</div>
          <div style={{ fontSize:11, color:'#a07850' }}>{poem.dynasty} · {poem.author}</div>
        </div>
        {/* Audio play button — only if audio exists */}
        {poem.audio_url && (
          <button onClick={togglePlay}
            title={playing ? t('暂停','Pause','Pausa') : t('朗读','Listen','Ascolta')}
            style={{ border:`1px solid ${playing?GOLD:GOLD+'44'}`, borderRadius:8,
              background:playing?`${GOLD}22`:'transparent', color:GOLD,
              fontSize:14, padding:'4px 10px', cursor:'pointer', fontWeight:600,
              minWidth:38, lineHeight:1 }}>
            {playing ? '⏸' : '🔊'}
          </button>
        )}
        {/* Pinyin toggle */}
        <button onClick={()=>setShowPinyin(s=>!s)}
          style={{ border:`1px solid ${showPinyin?GOLD:GOLD+'44'}`, borderRadius:8,
            background:showPinyin?`${GOLD}22`:'transparent', color:GOLD,
            fontSize:11, padding:'4px 10px', cursor:'pointer', fontWeight:600 }}>
          {showPinyin?'拼':'拼'}音
        </button>
      </div>

      {/* Hidden HTML5 audio element. Driven by audioRef + state above. */}
      {poem.audio_url && (
        <audio
          ref={audioRef}
          src={poem.audio_url}
          preload="metadata"
          onPlay={()=>setPlaying(true)}
          onPause={()=>setPlaying(false)}
          onEnded={()=>{ setPlaying(false); setProgress(0); }}
          onLoadedMetadata={(e)=>setDuration(e.target.duration || 0)}
          onTimeUpdate={(e)=>{
            const d = e.target.duration;
            if (d > 0) setProgress(e.target.currentTime / d);
          }}
        />
      )}

      {/* Audio progress bar (shows when audio exists) */}
      {poem.audio_url && (
        <div style={{ padding:'6px 16px', background:'rgba(0,0,0,0.3)',
          display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:10, color:GOLD, fontFamily:'ui-monospace, monospace',
            minWidth:34, textAlign:'right' }}>
            {fmtTime(progress * duration)}
          </span>
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const frac = (e.clientX - rect.left) / rect.width;
              seekTo(Math.max(0, Math.min(1, frac)));
            }}
            style={{ flex:1, height:4, background:'#3a2810',
              borderRadius:2, cursor:'pointer', position:'relative', overflow:'hidden' }}>
            <div style={{
              position:'absolute', left:0, top:0, bottom:0,
              width: `${progress * 100}%`,
              background: GOLD,
              transition: 'width 0.1s linear',
            }}/>
          </div>
          <span style={{ fontSize:10, color:'#a07850', fontFamily:'ui-monospace, monospace',
            minWidth:34 }}>
            {fmtTime(duration)}
          </span>
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto', padding:'20px 16px' }}>

        {/* Poem image */}
        {poem.image_url && (
          <div style={{ marginBottom:20, textAlign:'center' }}>
            <img src={poem.image_url} alt={poem.title}
              onClick={()=>setImgPreview(true)}
              style={{ maxWidth:'100%', maxHeight:220, borderRadius:16,
                border:`1px solid ${GOLD}33`, cursor:'zoom-in',
                boxShadow:`0 4px 20px ${GOLD}22` }}/>
          </div>
        )}

        {/* Poem lines with optional pinyin */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          {lines.map((line, i) => (
            <div key={i} style={{ marginBottom:showPinyin?8:4 }}>
              {showPinyin && pinyinMap[i]
                ? <PinyinLine line={line} pinyinLine={pinyinMap[i]}/>
                : <div style={{ fontSize:24, color:'#fdf6e3',
                    fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:4, lineHeight:2 }}>
                    {line}
                  </div>
              }
              {(i+1) % 2 === 0 && i < lines.length-1 && <div style={{ height:12 }}/>}
            </div>
          ))}
        </div>

        {/* Action buttons row */}
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {trans && (
            <button onClick={()=>setShowTrans(s=>!s)}
              style={{ flex:1, padding:'9px', borderRadius:12,
                border:`1px solid ${GOLD}44`, background:showTrans?`${GOLD}15`:'transparent',
                color:GOLD, fontSize:12, cursor:'pointer', fontWeight:600 }}>
              🌐 {showTrans?t('隐藏译文','Hide','Nascondi'):t('显示译文','Translation','Traduzione')}
            </button>
          )}
          {background && (
            <button onClick={()=>setShowBg(s=>!s)}
              style={{ flex:1, padding:'9px', borderRadius:12,
                border:`1px solid ${GOLD}44`, background:showBg?`${GOLD}15`:'transparent',
                color:GOLD, fontSize:12, cursor:'pointer', fontWeight:600 }}>
              🏛 {showBg?t('隐藏','Hide','Nascondi'):t('背景故事','Story','Storia')}
            </button>
          )}
        </div>

        {/* Translation */}
        {showTrans && trans && (
          <div style={{ background:'#2a1a0044', borderRadius:12, padding:'14px 16px',
            border:`1px solid ${GOLD}22`, marginBottom:12 }}>
            <div style={{ fontSize:11, color:GOLD, fontWeight:600, marginBottom:6 }}>
              {lang==='zh'?'现代汉语译文':lang==='it'?'Traduzione italiana':'English Translation'}
            </div>
            <div style={{ fontSize:13, color:'#fdf6e3bb', lineHeight:2, whiteSpace:'pre-line',
              fontFamily:"'STKaiti','KaiTi',serif" }}>
              {trans}
            </div>
          </div>
        )}

        {/* Background story — trilingual */}
        {showBg && background && (
          <div style={{ background:'#2a1a0044', borderRadius:12, padding:'14px 16px',
            border:`1px solid ${GOLD}22`, marginBottom:12 }}>
            <div style={{ fontSize:11, color:GOLD, fontWeight:600, marginBottom:8 }}>
              🏛 {t('创作背景与故事','Background & Story','Contesto e storia')}
            </div>
            <div style={{ fontSize:13, color:'#fdf6e3bb', lineHeight:1.9, whiteSpace:'pre-wrap' }}>
              {background}
            </div>
            {/* Show all 3 languages if available */}
            {lang!=='zh' && poem.background_zh && (
              <div style={{ marginTop:12, paddingTop:10, borderTop:`1px solid ${GOLD}22` }}>
                <div style={{ fontSize:10, color:GOLD+'88', marginBottom:4 }}>中文原文</div>
                <div style={{ fontSize:12, color:'#fdf6e388', lineHeight:1.8,
                  fontFamily:"'STKaiti','KaiTi',serif" }}>{poem.background_zh}</div>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div style={{ background:'#2a1a0044', borderRadius:12, padding:'12px 16px',
            border:`1px solid ${GOLD}22` }}>
            <div style={{ fontSize:11, color:GOLD, fontWeight:600, marginBottom:6 }}>
              📝 {t('注解','Notes','Note')}
            </div>
            <div style={{ fontSize:12, color:'#fdf6e3aa', lineHeight:1.8 }}>{notes}</div>
          </div>
        )}
      </div>

      {/* Image lightbox */}
      {imgPreview && poem.image_url && (
        <div onClick={()=>setImgPreview(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)',
            display:'flex', alignItems:'center', justifyContent:'center',
            zIndex:999, cursor:'zoom-out', padding:20 }}>
          <img src={poem.image_url} alt={poem.title}
            style={{ maxWidth:'95vw', maxHeight:'90vh', borderRadius:12,
              boxShadow:`0 8px 40px ${GOLD}44` }}/>
        </div>
      )}
    </div>
  );
}

// ── Memorize screen — cloze (fill missing characters) ───────────────────────
function MemorizeScreen({ poem, lang, onBack }) {
  const t = (zh,en) => lang==='zh'?zh:en;
  const lines = poem.lines || [];
  // Pick 30% of characters to blank out
  const [blanks] = useState(() => {
    const map = {};
    lines.forEach((line, li) => {
      [...line].forEach((_, ci) => {
        if (Math.random() < 0.3) map[`${li}-${ci}`] = true;
      });
    });
    return map;
  });
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const [score,   setScore]   = useState(null);

  function check() {
    let correct = 0, total = 0;
    lines.forEach((line, li) => {
      [...line].forEach((ch, ci) => {
        const key = `${li}-${ci}`;
        if (blanks[key]) {
          total++;
          if ((answers[key]||'').trim() === ch) correct++;
        }
      });
    });
    const pct = Math.round((correct/total)*100);
    setScore({ correct, total, pct });
    setChecked(true);
    awardPts('poetry_memorize', Math.round(pct/10)*5);
  }

  return (
    <div style={{ minHeight:'100dvh', background:POETRY_BG, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12,
        background:'rgba(0,0,0,0.4)' }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:GOLD, cursor:'pointer' }}>‹</button>
        <div style={{ fontSize:14, fontWeight:600, color:GOLD, flex:1 }}>
          📝 {t('默写','Memorize')} · {lang==='zh'?poem.title:(poem.title_en||poem.title)}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 16px' }}>
        {score && (
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:40 }}>{score.pct>=80?'🏆':score.pct>=60?'👍':'💪'}</div>
            <div style={{ fontSize:24, fontWeight:700, color:GOLD }}>{score.pct}%</div>
            <div style={{ fontSize:13, color:'#a07850' }}>{score.correct}/{score.total} {t('正确','correct')}</div>
          </div>
        )}

        {lines.map((line, li) => (
          <div key={li} style={{ fontSize:20, fontFamily:"'STKaiti','KaiTi',serif",
            letterSpacing:3, lineHeight:2.5, textAlign:'center', marginBottom:8 }}>
            {[...line].map((ch, ci) => {
              const key = `${li}-${ci}`;
              if (!blanks[key]) return <span key={ci} style={{ color:'#fdf6e3' }}>{ch}</span>;
              const isRight = checked && (answers[key]||'').trim()===ch;
              const isWrong = checked && (answers[key]||'').trim()!==ch;
              return (
                <input key={ci} value={answers[key]||''} maxLength={1}
                  onChange={e=>setAnswers(a=>({...a,[key]:e.target.value}))}
                  style={{ width:28, height:34, textAlign:'center', fontSize:18,
                    fontFamily:"'STKaiti','KaiTi',serif",
                    border:`2px solid ${isRight?'#4CAF50':isWrong?'#C62828':GOLD+'66'}`,
                    background:isRight?'#1B5E2055':isWrong?'#B71C1C22':'#2a1a0066',
                    color: isRight?'#69F0AE':isWrong?'#FF5252':GOLD,
                    borderRadius:6, outline:'none', marginInline:1 }}/>
              );
            })}
          </div>
        ))}

        {!checked
          ? <button onClick={check} style={{ width:'100%', padding:'13px', borderRadius:14,
              border:'none', background:GOLD, color:'#1a0f00', fontSize:14,
              fontWeight:700, cursor:'pointer', marginTop:16 }}>
              {t('检查答案','Check answers')} ✓
            </button>
          : <button onClick={onBack} style={{ width:'100%', padding:'13px', borderRadius:14,
              border:`1px solid ${GOLD}`, background:'transparent', color:GOLD,
              fontSize:14, cursor:'pointer', marginTop:16 }}>
              {t('返回','Back')}
            </button>
        }
      </div>
    </div>
  );
}

// ── Quiz — line completion ────────────────────────────────────────────────────
function QuizScreen({ poems, lang, onBack }) {
  const t = (zh,en) => lang==='zh'?zh:en;
  const TOTAL = Math.min(10, poems.length * 2);

  const [questions] = useState(() => {
    const qs = [];
    poems.forEach(poem => {
      const lines = poem.lines || [];
      for (let i = 0; i < lines.length - 1; i++) {
        const options = [lines[i+1]];
        // Get wrong options from other poems
        poems.filter(p=>p.id!==poem.id).forEach(p => {
          if (p.lines?.[i+1]) options.push(p.lines[i+1]);
        });
        if (options.length >= 4) {
          qs.push({ prompt:lines[i], answer:lines[i+1],
            options:options.sort(()=>Math.random()-0.5).slice(0,4),
            poemTitle:lang==='zh'?poem.title:(poem.title_en||poem.title) });
        }
      }
    });
    return qs.sort(()=>Math.random()-0.5).slice(0,TOTAL);
  });

  const [idx,    setIdx]    = useState(0);
  const [chosen, setChosen] = useState(null);
  const [score,  setScore]  = useState(0);
  const [done,   setDone]   = useState(false);

  function choose(opt) {
    if (chosen) return;
    setChosen(opt);
    const ok = opt===questions[idx]?.answer;
    if (ok) { setScore(s=>s+10); awardPts('poetry_quiz_right',10); }
    setTimeout(()=>{
      if (idx+1>=questions.length){setDone(true);return;}
      setIdx(i=>i+1);setChosen(null);
    },700);
  }

  if (!questions.length) return (
    <div style={{minHeight:'100dvh',background:POETRY_BG,display:'flex',alignItems:'center',
      justifyContent:'center',color:'#a07850',flexDirection:'column',gap:16}}>
      <div style={{fontSize:40}}>📚</div>
      <div>{t('需要至少2首诗才能出题','Need at least 2 poems for quiz')}</div>
      <button onClick={onBack} style={{padding:'10px 24px',borderRadius:12,border:`1px solid ${GOLD}`,
        background:'transparent',color:GOLD,cursor:'pointer'}}>{t('返回','Back')}</button>
    </div>
  );

  if (done) return (
    <div style={{minHeight:'100dvh',background:POETRY_BG,display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',gap:20,padding:24}}>
      <div style={{fontSize:60}}>{score/TOTAL/10>=0.8?'🏆':score/TOTAL/10>=0.6?'👍':'💪'}</div>
      <div style={{fontSize:28,fontWeight:700,color:GOLD}}>{score}/{TOTAL*10}</div>
      <button onClick={onBack} style={{padding:'12px 32px',borderRadius:14,border:'none',
        background:GOLD,color:'#1a0f00',fontSize:15,fontWeight:700,cursor:'pointer'}}>
        {t('返回','Back')}
      </button>
    </div>
  );

  const q = questions[idx];
  return (
    <div style={{minHeight:'100dvh',background:POETRY_BG,display:'flex',flexDirection:'column'}}>
      <div style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,background:'rgba(0,0,0,0.4)'}}>
        <button onClick={onBack} style={{border:'none',background:'none',fontSize:22,color:GOLD,cursor:'pointer'}}>‹</button>
        <div style={{fontSize:14,fontWeight:600,color:GOLD,flex:1}}>✅ {t('诗句测验','Poetry Quiz')}</div>
        <span style={{color:GOLD,fontWeight:700}}>⭐{score}</span>
        <span style={{color:'#a07850',fontSize:12}}>{idx+1}/{questions.length}</span>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'20px 16px',gap:20}}>
        <div style={{fontSize:11,color:'#a07850'}}>{q.poemTitle} · {t('下一句是？','What comes next?')}</div>
        <div style={{background:'#2a1a0066',borderRadius:20,padding:'20px 28px',
          width:'100%',maxWidth:360,textAlign:'center',border:`1.5px solid ${GOLD}44`}}>
          <div style={{fontSize:22,color:GOLD,fontFamily:"'STKaiti','KaiTi',serif",
            letterSpacing:3,lineHeight:1.8}}>{q.prompt}</div>
          <div style={{fontSize:12,color:'#a07850',marginTop:8}}>___________</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:360}}>
          {q.options.map(opt=>{
            const isOk=opt===q.answer,isPick=opt===chosen;
            return (
              <button key={opt} onClick={()=>choose(opt)}
                style={{padding:'12px 16px',borderRadius:14,cursor:chosen?'default':'pointer',
                  border:`1.5px solid ${!chosen?GOLD+'44':isOk?'#4CAF50':isPick?'#C62828':GOLD+'22'}`,
                  background:!chosen?'#2a1a0066':isOk?'#1B5E2055':isPick?'#B71C1C22':'#1a0f00',
                  color:!chosen?'#fdf6e3':isOk?'#69F0AE':isPick?'#FF5252':'#fdf6e344',
                  fontSize:17,fontFamily:"'STKaiti','KaiTi',serif",letterSpacing:2,
                  transition:'all 0.15s'}}>
                {opt}{chosen&&isOk?' ✓':chosen&&isPick?' ✗':''}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main PoetryApp ────────────────────────────────────────────────────────────
export default function PoetryApp({ onBack }) {
  const { lang } = useLang();
  const t = (zh,en,it) => lang==='zh'?zh:lang==='it'?it||en:en;
  const [screen,  setScreen]  = useScreenHistory('home', 'poetry');
  const [poems,   setPoems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [selPoem, setSelPoem] = useState(null);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    supabase.from('clf_poems').select('*').eq('active',true)
      .order('difficulty').order('sort_order')
      .then(({ data }) => { setPoems(data||[]); setLoading(false); });
  }, []);

  if (screen==='read'     && selPoem) return <ReadScreen     poem={selPoem} lang={lang} onBack={()=>setScreen('home')}/>;
  if (screen==='memorize' && selPoem) return <MemorizeScreen poem={selPoem} lang={lang} onBack={()=>setScreen('home')}/>;
  if (screen==='quiz')               return <QuizScreen      poems={poems}  lang={lang} onBack={()=>setScreen('home')}/>;

  const dynasties = [...new Set(poems.map(p=>p.dynasty).filter(Boolean))];
  const filtered = poems.filter(p => {
    const matchFilter = filter==='all' || p.dynasty===filter;
    const matchSearch = !search || p.title?.includes(search) || p.author?.includes(search) ||
      (p.title_en||'').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div style={{ minHeight:'100dvh',
      background:'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
      paddingBottom:80 }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg, #8B4513 0%, #5D2E0C 100%)',
        padding:'16px 16px 22px', borderBottomLeftRadius:20, borderBottomRightRadius:20 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize:22, color:'#fdf6e3', cursor:'pointer', display:'block', marginBottom:8 }}>‹</button>
        <div style={{ fontSize:28, fontWeight:700, color:'#fdf6e3',
          fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:3 }}>诗 歌</div>
        <div style={{ fontSize:13, color:'rgba(253,246,227,0.8)', marginTop:4 }}>
          {t('古典诗歌 · 阅读 · 默写 · 测验', 'Classical Poetry · Read · Memorize · Quiz',
             'Poesia classica · Leggi · Memorizza · Quiz')}
        </div>
      </div>

      <div style={{ padding:'14px 16px' }}>
        <AdaptiveCard module="poetry" lang={lang}/>

        {/* Mode buttons — varied colors */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          {[
            {id:'quiz',  icon:'✅', label:t('诗句测验','Line Quiz','Quiz Versi'),
             bg:'#E8F5E9', accent:'#2E7D32'},
            {id:'browse',icon:'📖', label:t('浏览诗歌','Browse Poems','Sfoglia'),
             bg:'#E3F2FD', accent:'#1565C0'},
          ].map(m => (
            <button key={m.id} onClick={()=>m.id==='browse'?null:setScreen(m.id)}
              style={{ padding:'16px', borderRadius:16, border:`1.5px solid ${m.accent}33`,
                background:m.bg,
                color:m.accent, cursor:'pointer', fontSize:14, fontWeight:600,
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
              <span style={{fontSize:24}}>{m.icon}</span>{m.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={t('搜索诗名、作者…','Search title, author…','Cerca titolo, autore…')}
          style={{ width:'100%', padding:'10px 14px', fontSize:14, borderRadius:12,
            border:'1px solid #e8d5b0', background:'#fff', color:'#5D2E0C',
            boxSizing:'border-box', outline:'none', marginBottom:12 }}/>

        {/* Dynasty filter */}
        {dynasties.length > 1 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
            {['all',...dynasties].map(d => (
              <button key={d} onClick={()=>setFilter(d)}
                style={{ padding:'5px 14px', borderRadius:20, fontSize:13,
                  border:`1.5px solid ${filter===d?'#8B4513':'#e8d5b0'}`,
                  background:filter===d?'#8B4513':'#fff',
                  color:filter===d?'#fdf6e3':'#5D2E0C', cursor:'pointer',
                  fontWeight:filter===d?600:400 }}>
                {d==='all'?t('全部','All','Tutti'):d}
              </button>
            ))}
          </div>
        )}

        {/* Poem list */}
        {loading ? (
          <div style={{textAlign:'center',color:'#a07850',padding:40}}>加载中…</div>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:'2rem',color:'#a07850'}}>
            <div style={{fontSize:40,marginBottom:8}}>📜</div>
            <div>{t('暂无诗歌，请管理员添加','No poems yet — add from admin panel','Nessuna poesia ancora')}</div>
          </div>
        ) : (
          filtered.map(poem => (
            <div key={poem.id} style={{ marginBottom:10 }}>
              <PoemCard poem={poem} lang={lang} onSelect={()=>{setSelPoem(poem);setScreen('read');}}/>
              <div style={{ display:'flex', gap:6, marginTop:-4, paddingLeft:4 }}>
                <button onClick={()=>{setSelPoem(poem);setScreen('read');}}
                  style={{ fontSize:11, padding:'4px 12px', borderRadius:8,
                    border:`1px solid ${GOLD}33`, background:'transparent', color:GOLD, cursor:'pointer' }}>
                  📖 {t('阅读','Read','Leggi')}
                </button>
                <button onClick={()=>{setSelPoem(poem);setScreen('memorize');}}
                  style={{ fontSize:11, padding:'4px 12px', borderRadius:8,
                    border:`1px solid ${GOLD}33`, background:'transparent', color:GOLD, cursor:'pointer' }}>
                  📝 {t('默写','Memorize','Memorizza')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
