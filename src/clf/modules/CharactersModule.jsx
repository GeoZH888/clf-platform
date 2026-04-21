// src/clf/modules/CharactersModule.jsx
// Module 1: 汉字 Characters
// Modes: Browse → Flashcard → Quiz → Write (stroke order)
// Uses clf_characters table

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase.js';

const TOKEN_KEY = 'clf_learner_token';
function getToken() { return localStorage.getItem(TOKEN_KEY); }

async function awardPts(action, pts) {
  const t = getToken();
  if (!t) return;
  await supabase.from('jgw_points').insert({ device_token:t, module:'clf_characters', action, points:pts });
}
async function saveProgress(itemId, correct) {
  const t = getToken();
  if (!t) return;
  await supabase.from('clf_progress').upsert({
    device_token: t, item_table:'clf_characters', item_id:itemId,
    correct, practiced_at: new Date().toISOString(),
  }).then(() => {});
}

// ── Stroke animation using hanzi-writer CDN ────────────────────
function StrokeWriter({ character, size=120 }) {
  const ref   = useRef(null);
  const writer = useRef(null);

  useEffect(() => {
    if (!ref.current || !character) return;
    ref.current.innerHTML = '';
    if (typeof HanziWriter === 'undefined') return;
    writer.current = HanziWriter.create(ref.current, character, {
      width: size, height: size,
      padding: 5,
      showOutline: true,
      strokeColor: '#8B4513',
      outlineColor: '#e8d5b0',
      drawingColor: '#C8972A',
    });
    writer.current.animateCharacter();
  }, [character]);

  return (
    <div>
      <div ref={ref} style={{ cursor:'pointer' }} onClick={() => writer.current?.animateCharacter()}/>
      <div style={{ fontSize:10, color:'#a07850', textAlign:'center', marginTop:4 }}>
        点击重播 · tap to replay
      </div>
    </div>
  );
}

// ── Audio playback ─────────────────────────────────────────────
function playTTS(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
}

// ── Single character card (browse mode) ───────────────────────
function CharCard({ char, lang, onStudy }) {
  const [flipped, setFlipped] = useState(false);
  const meaning = lang==='zh' ? char.meaning_zh
    : lang==='it' ? (char.meaning_it||char.meaning_en)
    : char.meaning_en;

  return (
    <div style={{ background:'#fff', borderRadius:20, padding:'20px',
      border:'1.5px solid #e8d5b0', marginBottom:12,
      boxShadow:'0 2px 8px rgba(139,69,19,0.08)' }}>
      <div style={{ display:'flex', gap:16, alignItems:'center' }}>
        {/* Big character */}
        <button onClick={() => { playTTS(char.character); setFlipped(f=>!f); }}
          style={{ fontSize:52, fontFamily:"'STKaiti','KaiTi',serif",
            color:'#1a0a05', background:'#fdf6e3', border:'1.5px solid #e8d5b0',
            borderRadius:16, width:80, height:80,
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer', flexShrink:0 }}>
          {char.character}
        </button>

        {/* Info */}
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
            <span style={{ fontSize:16, color:'#8B4513', fontWeight:600 }}>{char.pinyin}</span>
            {char.hsk_level && (
              <span style={{ fontSize:10, background:'#8B451322', color:'#8B4513',
                padding:'1px 6px', borderRadius:6 }}>HSK{char.hsk_level}</span>
            )}
            {char.strokes && (
              <span style={{ fontSize:10, color:'#a07850' }}>{char.strokes}笔</span>
            )}
          </div>
          <div style={{ fontSize:15, color:'#1a0a05', fontWeight:600 }}>{meaning}</div>
          {char.example_word && (
            <div style={{ fontSize:12, color:'#a07850', marginTop:4 }}>
              例：<span style={{ fontFamily:"'STKaiti','KaiTi',serif" }}>{char.example_word}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <button onClick={() => playTTS(char.character)}
            style={{ width:36, height:36, borderRadius:10, border:'1px solid #e8d5b0',
              background:'#fdf6e3', fontSize:16, cursor:'pointer' }}>🔊</button>
          <button onClick={() => onStudy(char)}
            style={{ width:36, height:36, borderRadius:10, border:'none',
              background:'#8B4513', color:'#fff', fontSize:14, cursor:'pointer',
              fontWeight:700 }}>→</button>
        </div>
      </div>

      {/* Stroke order (shown on tap) */}
      {flipped && (
        <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid #e8d5b0',
          display:'flex', justifyContent:'center' }}>
          <StrokeWriter character={char.character} size={100}/>
        </div>
      )}
    </div>
  );
}

// ── Flashcard mode ─────────────────────────────────────────────
function FlashcardMode({ chars, lang, onBack }) {
  const [idx,   setIdx]   = useState(0);
  const [flip,  setFlip]  = useState(false);
  const [score, setScore] = useState({ known:0, study:0 });
  const [done,  setDone]  = useState(false);

  const char = chars[idx];
  const meaning = lang==='zh' ? char.meaning_zh
    : lang==='it' ? (char.meaning_it||char.meaning_en) : char.meaning_en;

  function respond(known) {
    saveProgress(char.id, known);
    if (known) { setScore(s=>({...s,known:s.known+1})); awardPts('char_known', 3); }
    if (idx+1 >= chars.length) { setDone(true); return; }
    setIdx(i=>i+1); setFlip(false);
  }

  if (done) return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex',
      flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>
      <div style={{ fontSize:60 }}>🎉</div>
      <div style={{ fontSize:22, fontWeight:700, color:'#8B4513' }}>完成了！</div>
      <div style={{ fontSize:15, color:'#6b4c2a' }}>
        认识 {score.known} / {chars.length} 个字
      </div>
      <button onClick={onBack}
        style={{ padding:'13px 32px', borderRadius:14, border:'none',
          background:'#8B4513', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
        返回
      </button>
    </div>
  );

  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex', flexDirection:'column' }}>
      <div style={{ background:'#8B4513', padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ color:'#fff', fontSize:14, fontWeight:600, flex:1 }}>📖 闪卡 Flashcards</div>
        <div style={{ color:'#ffffff99', fontSize:12 }}>{idx+1}/{chars.length}</div>
      </div>
      <div style={{ height:4, background:'#8B451322' }}>
        <div style={{ height:'100%', width:`${((idx+1)/chars.length)*100}%`,
          background:'#8B4513', transition:'width 0.3s' }}/>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>

        {/* Card */}
        <div onClick={() => { setFlip(f=>!f); playTTS(char.character); }}
          style={{ background:'#fff', borderRadius:24, padding:'32px',
            border:'2px solid #e8d5b0', width:'100%', maxWidth:340,
            textAlign:'center', cursor:'pointer', minHeight:200,
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            boxShadow:'0 4px 20px rgba(139,69,19,0.12)' }}>
          {!flip ? (
            <>
              <div style={{ fontSize:80, fontFamily:"'STKaiti','KaiTi',serif",
                color:'#1a0a05', letterSpacing:4, marginBottom:8 }}>
                {char.character}
              </div>
              <div style={{ fontSize:18, color:'#8B4513' }}>{char.pinyin}</div>
              <div style={{ fontSize:11, color:'#a07850', marginTop:12 }}>
                点击翻面 · tap to flip
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize:36, fontFamily:"'STKaiti','KaiTi',serif",
                color:'#1a0a05', marginBottom:12 }}>{char.character}</div>
              <div style={{ fontSize:20, fontWeight:700, color:'#1a0a05', marginBottom:8 }}>
                {meaning}
              </div>
              {char.example_zh && (
                <div style={{ fontSize:13, color:'#6b4c2a', fontStyle:'italic',
                  lineHeight:1.7, fontFamily:"'STKaiti','KaiTi',serif" }}>
                  {char.example_zh}
                </div>
              )}
              {/* Stroke order */}
              <div style={{ marginTop:16 }}>
                <StrokeWriter character={char.character} size={80}/>
              </div>
            </>
          )}
        </div>

        {flip && (
          <div style={{ display:'flex', gap:12, width:'100%', maxWidth:340 }}>
            <button onClick={() => respond(false)}
              style={{ flex:1, padding:'14px', borderRadius:14, border:'2px solid #E53935',
                background:'#FFEBEE', color:'#C62828', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              😅 再看看
            </button>
            <button onClick={() => respond(true)}
              style={{ flex:1, padding:'14px', borderRadius:14, border:'none',
                background:'#8B4513', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              ✓ 认识了！
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Quiz mode ──────────────────────────────────────────────────
function QuizMode({ chars, lang, onBack }) {
  const TOTAL = Math.min(chars.length, 15);
  const [qs] = useState(() =>
    [...chars].sort(()=>Math.random()-0.5).slice(0,TOTAL).map(c => {
      const others = chars.filter(x=>x.id!==c.id).sort(()=>Math.random()-0.5).slice(0,3);
      const getMeaning = x => lang==='zh'?x.meaning_zh:lang==='it'?(x.meaning_it||x.meaning_en):x.meaning_en;
      return {
        char: c,
        answer: getMeaning(c),
        options: [c,...others].sort(()=>Math.random()-0.5).map(getMeaning),
      };
    })
  );
  const [idx,    setIdx]    = useState(0);
  const [chosen, setChosen] = useState(null);
  const [score,  setScore]  = useState(0);
  const [done,   setDone]   = useState(false);

  function choose(opt) {
    if (chosen) return;
    setChosen(opt);
    const ok = opt === qs[idx].answer;
    if (ok) { setScore(s=>s+10); awardPts('char_quiz_right', 10); }
    saveProgress(qs[idx].char.id, ok);
    playTTS(qs[idx].char.character);
    setTimeout(() => {
      if (idx+1 >= TOTAL) { setDone(true); return; }
      setIdx(i=>i+1); setChosen(null);
    }, 700);
  }

  if (done) return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex',
      flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:16 }}>
      <div style={{ fontSize:60 }}>{score/TOTAL/10>=0.8?'🏆':'👍'}</div>
      <div style={{ fontSize:26, fontWeight:700, color:'#8B4513' }}>⭐ {score}</div>
      <button onClick={onBack} style={{ padding:'13px 32px', borderRadius:14, border:'none',
        background:'#8B4513', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
        返回
      </button>
    </div>
  );

  const q = qs[idx];
  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex', flexDirection:'column' }}>
      <div style={{ background:'#8B4513', padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ color:'#fff', fontSize:14, fontWeight:600, flex:1 }}>✅ 测验 Quiz</div>
        <div style={{ color:'#fff', fontWeight:700 }}>⭐{score}</div>
        <div style={{ color:'#ffffff99', fontSize:12 }}>{idx+1}/{TOTAL}</div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', padding:20, gap:16 }}>
        <div style={{ background:'#fff', borderRadius:20, padding:'24px 28px',
          width:'100%', maxWidth:340, textAlign:'center', border:'2px solid #e8d5b0' }}>
          <div style={{ fontSize:11, color:'#a07850', marginBottom:8 }}>{q.char.pinyin}</div>
          <div style={{ fontSize:64, fontFamily:"'STKaiti','KaiTi',serif",
            color:'#1a0a05', letterSpacing:4 }}>{q.char.character}</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%', maxWidth:340 }}>
          {q.options.map(opt => {
            const isOk=opt===q.answer, isPick=opt===chosen;
            const bg = !chosen?'#fff':isOk?'#E8F5E9':isPick?'#FFEBEE':'#fff';
            const border = !chosen?'#e8d5b0':isOk?'#2E7D32':isPick?'#C62828':'#e8d5b0';
            return (
              <button key={opt} onClick={()=>choose(opt)}
                style={{ padding:'14px 10px', borderRadius:14, cursor:chosen?'default':'pointer',
                  border:`2px solid ${border}`, background:bg,
                  fontSize:14, color:'#1a0a05', transition:'all 0.15s',
                  fontWeight:500, lineHeight:1.3 }}>
                {opt}{chosen&&isOk?' ✓':chosen&&isPick?' ✗':''}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main CharactersModule ──────────────────────────────────────
export default function CharactersModule({ profile, onBack }) {
  const [mode,   setMode]   = useState('home'); // home|browse|flashcard|quiz
  const [chars,  setChars]  = useState([]);
  const [loading,setLoading]= useState(true);
  const [lang,   setLang]   = useState('zh');
  const [filter, setFilter] = useState({ hsk:'all', search:'' });
  const [studyChar, setStudyChar] = useState(null);

  const level = profile?.current_level || 1;

  useEffect(() => {
    let q = supabase.from('clf_characters').select('*').eq('active', true);
    if (filter.hsk !== 'all') q = q.eq('hsk_level', Number(filter.hsk));
    else q = q.lte('level', level + 2);  // show chars around learner's level
    q.order('hsk_level').order('sort_order').limit(200)
      .then(({ data }) => { setChars(data||[]); setLoading(false); });
  }, [filter.hsk, level]);

  const filtered = chars.filter(c =>
    !filter.search ||
    c.character?.includes(filter.search) ||
    c.pinyin?.toLowerCase().includes(filter.search.toLowerCase()) ||
    c.meaning_zh?.includes(filter.search) ||
    c.meaning_en?.toLowerCase().includes(filter.search.toLowerCase())
  );

  if (mode === 'flashcard') return <FlashcardMode chars={filtered.slice(0,30)} lang={lang} onBack={()=>setMode('home')}/>;
  if (mode === 'quiz')      return <QuizMode      chars={filtered.slice(0,30)} lang={lang} onBack={()=>setMode('home')}/>;

  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3' }}>
      {/* Header */}
      <div style={{ background:'#8B4513', padding:'12px 16px 16px',
        display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ flex:1 }}>
          <div style={{ color:'#fff', fontSize:16, fontWeight:700,
            fontFamily:"'STKaiti','KaiTi',serif" }}>汉字 Characters</div>
          <div style={{ color:'#ffffff88', fontSize:11 }}>
            {filtered.length} characters · Level {level}
          </div>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {['zh','en','it'].map(l => (
            <button key={l} onClick={()=>setLang(l)}
              style={{ padding:'3px 7px', borderRadius:6, border:'none', cursor:'pointer',
                background: lang===l ? '#fff' : 'rgba(255,255,255,0.2)',
                color: lang===l ? '#8B4513' : '#fff', fontSize:10, fontWeight:600 }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Practice mode buttons */}
      <div style={{ padding:'14px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {[
          { id:'flashcard', icon:'📖', label:'闪卡学习', sub:'Flashcards', color:'#1565C0' },
          { id:'quiz',      icon:'✅', label:'选词测验', sub:'Quiz',        color:'#2E7D32' },
        ].map(m => (
          <button key={m.id} onClick={() => filtered.length >= 4 && setMode(m.id)}
            disabled={filtered.length < 4}
            style={{ padding:'14px', borderRadius:16, border:'none',
              background: filtered.length >= 4 ? m.color : '#e0e0e0',
              color: filtered.length >= 4 ? '#fff' : '#aaa',
              cursor: filtered.length >= 4 ? 'pointer' : 'default',
              display:'flex', flexDirection:'column', alignItems:'center', gap:4,
              boxShadow: filtered.length >= 4 ? `0 4px 12px ${m.color}44` : 'none' }}>
            <span style={{ fontSize:24 }}>{m.icon}</span>
            <span style={{ fontSize:13, fontWeight:700 }}>{m.label}</span>
            <span style={{ fontSize:10, opacity:0.8 }}>{m.sub}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ padding:'0 16px 10px', display:'flex', gap:8, flexWrap:'wrap' }}>
        <input value={filter.search}
          onChange={e=>setFilter(f=>({...f,search:e.target.value}))}
          placeholder="搜索字/拼音/meaning…"
          style={{ flex:1, minWidth:160, padding:'8px 12px', fontSize:13, borderRadius:10,
            border:'1px solid #e8d5b0', outline:'none', background:'#fff' }}/>
        <select value={filter.hsk} onChange={e=>setFilter(f=>({...f,hsk:e.target.value}))}
          style={{ padding:'8px 10px', borderRadius:10, border:'1px solid #e8d5b0',
            fontSize:12, background:'#fff' }}>
          <option value="all">All HSK</option>
          {[1,2,3,4,5,6].map(n=><option key={n} value={n}>HSK {n}</option>)}
        </select>
      </div>

      {/* Character list */}
      <div style={{ padding:'0 16px 80px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#a07850' }}>加载中…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'#a07850' }}>
            <div style={{ fontSize:40, marginBottom:8 }}>🔍</div>
            <div>No characters found</div>
            <div style={{ fontSize:12, marginTop:4 }}>
              Add characters in Admin → 字符管理, then migrate to clf_characters
            </div>
          </div>
        ) : (
          filtered.map(c => (
            <CharCard key={c.id} char={c} lang={lang} onStudy={setStudyChar}/>
          ))
        )}
      </div>

      {/* Hanzi Writer CDN script */}
      {typeof HanziWriter === 'undefined' && (
        <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js"/>
      )}
    </div>
  );
}
