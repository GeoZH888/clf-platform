// src/hsk/HSKApp.jsx
// HSK module — all levels, RAG-powered learning, quiz, practice

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';
import AdaptiveCard from '../components/AdaptiveCard.jsx';

const TOKEN_KEY = 'jgw_device_token';
const HSK_COLORS = {
  1:'#E53935', 2:'#E91E63', 3:'#9C27B0', 4:'#1565C0', 5:'#2E7D32', 6:'#E65100',
};

// ── Shared helpers ─────────────────────────────────────────────────────────
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
async function awardPts(action, pts, level) {
  const t = localStorage.getItem(TOKEN_KEY);
  if (!t) return;
  await supabase.from('jgw_points').insert({ device_token:t, module:'hsk', action, points:pts });
}
async function saveProgress(wordId, correct) {
  const t = localStorage.getItem(TOKEN_KEY);
  if (!t) return;
  await supabase.from('jgw_hsk_progress').upsert({
    device_token:t, word_id:wordId, correct,
    practiced_at: new Date().toISOString(),
  });
}

// ── Flashcard ──────────────────────────────────────────────────────────────
function FlashCard({ word, lang, onKnow, onStudy, color }) {
  const [flipped, setFlipped] = useState(false);
  const meaning = lang==='zh' ? word.meaning_zh
    : lang==='it' ? (word.meaning_it||word.meaning_en) : word.meaning_en;

  function flip() {
    setFlipped(f=>!f);
    // Auto-play pronunciation when flipping to front
    if (flipped && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(word.word);
      u.lang='zh-CN'; u.rate=0.85;
      window.speechSynthesis.speak(u);
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, width:'100%', maxWidth:360 }}>
      <div onClick={flip}
        style={{ width:'100%', minHeight:200, borderRadius:24, cursor:'pointer',
          background: flipped ? color+'15' : '#fff',
          border:`2px solid ${color}44`,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:24, boxShadow:`0 4px 20px ${color}22`, transition:'all 0.25s', userSelect:'none' }}>
        {!flipped ? (
          <>
            <div style={{ fontSize:48, fontWeight:700, color:'#1a0a05',
              fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:4, marginBottom:8 }}>
              {word.word}
            </div>
            <div style={{ fontSize:16, color:'#6b4c2a' }}>{word.pinyin}</div>
            <div style={{ fontSize:11, color:'#a07850', marginTop:12 }}>点击翻面 · Tap to flip</div>
          </>
        ) : (
          <>
            <div style={{ fontSize:22, fontWeight:700, color:'#1a0a05', textAlign:'center', marginBottom:8 }}>
              {meaning}
            </div>
            {word.example_zh && (
              <div style={{ fontSize:13, color:'#6b4c2a', textAlign:'center', lineHeight:1.7,
                marginTop:8, fontStyle:'italic' }}>
                📌 {word.example_zh}
              </div>
            )}
          </>
        )}
      </div>
      {flipped && (
        <div style={{ display:'flex', gap:12, width:'100%' }}>
          <button onClick={onStudy}
            style={{ flex:1, padding:'13px', borderRadius:14, border:`1.5px solid ${color}`,
              background:'#fff', color, fontSize:14, fontWeight:600, cursor:'pointer' }}>
            😅 {lang==='zh'?'再看看':'Study more'}
          </button>
          <button onClick={onKnow}
            style={{ flex:1, padding:'13px', borderRadius:14, border:'none',
              background:color, color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer' }}>
            ✓ {lang==='zh'?'认识了':'Got it!'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Learn screen ───────────────────────────────────────────────────────────
function LearnScreen({ words, level, lang, onBack }) {
  const t = (zh,en) => lang==='zh'?zh:en;
  const color = HSK_COLORS[level] || '#8B4513';
  const [queue,  setQueue]  = useState(() => shuffle(words));
  const [idx,    setIdx]    = useState(0);
  const [known,  setKnown]  = useState(0);
  const [done,   setDone]   = useState(false);

  function onKnow() {
    saveProgress(queue[idx].id, true);
    awardPts('hsk_learn_know', 2, level);
    const newKnown = known + 1;
    setKnown(newKnown);
    if (idx + 1 >= queue.length) { setDone(true); return; }
    setIdx(i => i+1);
  }
  function onStudy() {
    saveProgress(queue[idx].id, false);
    // Move to end of queue for review
    const remaining = [...queue.slice(idx+1), queue[idx]];
    setQueue([...queue.slice(0,idx), ...remaining]);
    if (idx >= remaining.length) setIdx(0);
  }

  if (done) return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, padding:24 }}>
      <div style={{ fontSize:64 }}>🎉</div>
      <div style={{ fontSize:22, fontWeight:700, color }}>
        {t(`认识了 ${known}/${words.length} 个！`,'Complete!')}
      </div>
      <button onClick={onBack} style={{ padding:'12px 32px', borderRadius:14, border:'none',
        background:color, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
        {t('返回','Back')}
      </button>
    </div>
  );

  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex', flexDirection:'column' }}>
      <div style={{ background:color, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ color:'#fff', fontSize:14, fontWeight:600, flex:1 }}>
          📖 HSK{level} {t('学习','Learn')}
        </div>
        <div style={{ color:'#ffffff99', fontSize:12 }}>{idx+1}/{queue.length}</div>
      </div>
      <div style={{ height:4, background:color+'33' }}>
        <div style={{ height:'100%', width:`${((idx+1)/queue.length)*100}%`, background:color, transition:'width 0.3s' }}/>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'20px 16px' }}>
        <FlashCard word={queue[idx]} lang={lang} color={color} onKnow={onKnow} onStudy={onStudy}/>
      </div>
    </div>
  );
}

// ── Quiz screen ────────────────────────────────────────────────────────────
function QuizScreen({ words, level, lang, onBack }) {
  const t = (zh,en) => lang==='zh'?zh:en;
  const color = HSK_COLORS[level] || '#8B4513';
  const TOTAL = Math.min(words.length, 20);
  const [qs]         = useState(() => shuffle(words).slice(0,TOTAL).map(w => {
    const meaning = lang==='zh' ? w.meaning_zh : lang==='it' ? (w.meaning_it||w.meaning_en) : w.meaning_en;
    const others  = shuffle(words.filter(x=>x.id!==w.id)).slice(0,3).map(x =>
      lang==='zh' ? x.meaning_zh : lang==='it' ? (x.meaning_it||x.meaning_en) : x.meaning_en);
    return { word:w, question:w.word, answer:meaning, options:shuffle([meaning,...others]) };
  }));
  const [idx,    setIdx]    = useState(0);
  const [chosen, setChosen] = useState(null);
  const [score,  setScore]  = useState(0);
  const [done,   setDone]   = useState(false);

  function choose(opt) {
    if (chosen) return;
    setChosen(opt);
    const ok = opt === qs[idx].answer;
    if (ok) { setScore(s=>s+10); awardPts('hsk_quiz_right',10,level); }
    saveProgress(qs[idx].word.id, ok);
    setTimeout(() => {
      if (idx+1 >= TOTAL) { setDone(true); return; }
      setIdx(i=>i+1); setChosen(null);
    }, 700);
  }

  if (done) return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:20, padding:24 }}>
      <div style={{ fontSize:60 }}>{score/TOTAL/10>=0.8?'🏆':score/TOTAL/10>=0.6?'👍':'💪'}</div>
      <div style={{ fontSize:26, fontWeight:700, color }}>{score} / {TOTAL*10}</div>
      <div style={{ fontSize:14, color:'#6b4c2a' }}>
        {score/TOTAL/10>=0.8?t('优秀！','Excellent!'):score/TOTAL/10>=0.6?t('良好！','Good!'):t('继续练习','Keep going')}
      </div>
      <button onClick={onBack} style={{ padding:'12px 32px', borderRadius:14, border:'none',
        background:color, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
        {t('返回','Back')}
      </button>
    </div>
  );

  const q = qs[idx];
  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex', flexDirection:'column' }}>
      <div style={{ background:color, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ color:'#fff', fontSize:14, fontWeight:600, flex:1 }}>✅ HSK{level} {t('测验','Quiz')}</div>
        <div style={{ color:'#fff', fontSize:13, fontWeight:700 }}>⭐{score}</div>
        <div style={{ color:'#ffffff99', fontSize:12 }}>{idx+1}/{TOTAL}</div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'20px 16px', gap:20 }}>
        <div style={{ background:'#fff', borderRadius:20, padding:'24px 28px', width:'100%',
          maxWidth:360, textAlign:'center', border:`2px solid ${color}33`,
          boxShadow:`0 4px 16px ${color}22` }}>
          <div style={{ fontSize:11, color:'#a07850', marginBottom:8 }}>{q.word.pinyin}</div>
          <div style={{ fontSize:44, fontWeight:700, fontFamily:"'STKaiti','KaiTi',serif",
            letterSpacing:3, color:'#1a0a05' }}>{q.question}</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'100%', maxWidth:360 }}>
          {q.options.map(opt => {
            const isCorrect = opt===q.answer, isChosen=opt===chosen;
            const bg = !chosen?'#fff':isChosen&&isCorrect?'#E8F5E9':isChosen?'#FFEBEE':isCorrect&&chosen?'#E8F5E9':'#fff';
            const border = !chosen?`${color}33`:isCorrect&&chosen?'#2E7D32':isChosen?'#C62828':`${color}22`;
            return (
              <button key={opt} onClick={()=>choose(opt)}
                style={{ padding:'14px 10px', borderRadius:14, cursor:chosen?'default':'pointer',
                  border:`2px solid ${border}`, background:bg, fontSize:14,
                  color:'#1a0a05', transition:'all 0.15s', fontWeight:500, lineHeight:1.3 }}>
                {opt}{chosen&&isCorrect?' ✓':chosen&&isChosen?' ✗':''}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Practice (spaced repetition) ───────────────────────────────────────────
function PracticeScreen({ words, level, lang, onBack }) {
  const t = (zh,en) => lang==='zh'?zh:en;
  const color = HSK_COLORS[level] || '#8B4513';
  const [items, setItems]   = useState([]);
  const [idx,   setIdx]     = useState(0);
  const [input, setInput]   = useState('');
  const [result,setResult]  = useState(null);
  const [score, setScore]   = useState(0);
  const [done,  setDone]    = useState(false);

  useEffect(() => {
    // Load progress to prioritize weak words
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setItems(shuffle(words).slice(0,15)); return; }
    supabase.from('jgw_hsk_progress')
      .select('word_id, correct')
      .eq('device_token', token)
      .in('word_id', words.map(w=>w.id))
      .then(({ data }) => {
        const progressMap = {};
        (data||[]).forEach(r => {
          progressMap[r.word_id] = (progressMap[r.word_id]||0) + (r.correct ? 1 : -2);
        });
        // Sort: weakest words first
        const sorted = [...words].sort((a,b) => (progressMap[a.id]||0) - (progressMap[b.id]||0));
        setItems(sorted.slice(0, 15));
      });
  }, [words]);

  function submit() {
    const w = items[idx];
    const correct = input.trim().toLowerCase() === w.pinyin.toLowerCase().replace(/[āáǎàīíǐìūúǔùǖǘǚǜ]/g, m =>
      'aāáǎà iīíǐì uūúǔù ü ǖǘǚǜ'.includes(m) ? m : m);
    const ok = input.trim() === w.word || input.trim().toLowerCase() === (w.pinyin||'').toLowerCase();
    setResult(ok ? 'correct' : 'wrong');
    if (ok) { setScore(s=>s+15); awardPts('hsk_practice_right',15,level); }
    saveProgress(w.id, ok);
    setTimeout(() => {
      if (idx+1 >= items.length) { setDone(true); return; }
      setIdx(i=>i+1); setInput(''); setResult(null);
    }, 1000);
  }

  if (!items.length) return <div style={{ padding:40, textAlign:'center', color:'#a07850' }}>Loading…</div>;

  if (done) return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:20, padding:24 }}>
      <div style={{ fontSize:60 }}>🎯</div>
      <div style={{ fontSize:26, fontWeight:700, color }}>⭐ {score}</div>
      <button onClick={onBack} style={{ padding:'12px 32px', borderRadius:14, border:'none',
        background:color, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
        {t('返回','Back')}
      </button>
    </div>
  );

  const w = items[idx];
  const meaning = lang==='zh' ? w.meaning_zh : lang==='it' ? (w.meaning_it||w.meaning_en) : w.meaning_en;

  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', display:'flex', flexDirection:'column' }}>
      <div style={{ background:color, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
        <div style={{ color:'#fff', fontSize:14, fontWeight:600, flex:1 }}>🎯 HSK{level} {t('练习','Practice')}</div>
        <div style={{ color:'#fff', fontWeight:700 }}>⭐{score}</div>
        <div style={{ color:'#ffffff99', fontSize:12 }}>{idx+1}/{items.length}</div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'20px 16px', gap:16 }}>
        <div style={{ background:'#fff', borderRadius:20, padding:'20px 28px',
          width:'100%', maxWidth:360, textAlign:'center', border:`2px solid ${color}33` }}>
          <div style={{ fontSize:11, color:'#a07850', marginBottom:6 }}>
            {t('看意思，输入汉字或拼音', 'See the meaning, type the Chinese or pinyin')}
          </div>
          <div style={{ fontSize:20, fontWeight:600, color:'#1a0a05', lineHeight:1.6 }}>{meaning}</div>
          {w.example_en && <div style={{ fontSize:11, color:'#a07850', marginTop:6, fontStyle:'italic' }}>{w.example_en}</div>}
        </div>

        <div style={{ width:'100%', maxWidth:360 }}>
          <input value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&input.trim()&&!result&&submit()}
            placeholder={t('输入汉字或拼音…','Type Chinese or pinyin…')}
            style={{ width:'100%', padding:'14px 16px', fontSize:18, borderRadius:14,
              border:`2px solid ${result==='correct'?'#2E7D32':result==='wrong'?'#C62828':color+'44'}`,
              background:result==='correct'?'#E8F5E9':result==='wrong'?'#FFEBEE':'#fff',
              textAlign:'center', boxSizing:'border-box', fontFamily:"'STKaiti','KaiTi',serif",
              outline:'none', transition:'all 0.2s' }}/>
        </div>

        {result==='wrong' && (
          <div style={{ fontSize:16, color:'#C62828', textAlign:'center' }}>
            {t('正确答案：','Answer: ')}<strong style={{ fontFamily:"'STKaiti','KaiTi',serif" }}>{w.word}</strong>
            <span style={{ fontSize:13, color:'#6b4c2a', marginLeft:8 }}>({w.pinyin})</span>
          </div>
        )}

        {!result && input.trim() && (
          <button onClick={submit}
            style={{ padding:'13px 40px', borderRadius:14, border:'none',
              background:color, color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer' }}>
            {t('确认','Confirm')} ✓
          </button>
        )}
      </div>
    </div>
  );
}

// ── AI Explain (RAG) ────────────────────────────────────────────────────────
function AIExplain({ word, lang, onClose }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = localStorage.getItem('admin_key_anthropic') || localStorage.getItem('hsk_ai_key');
    if (!key) { setText(lang==='zh'?'请先配置AI Key':'Please configure AI Key'); setLoading(false); return; }
    const meaning = lang==='zh' ? word.meaning_zh : lang==='it' ? (word.meaning_it||word.meaning_en) : word.meaning_en;
    fetch('/.netlify/functions/ai-gateway', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        action:'generate_text', provider:'claude', client_key:key, max_tokens:300,
        prompt:`Explain the Chinese word "${word.word}" (${word.pinyin}, meaning: ${meaning}) to a student.
Language: ${lang==='zh'?'Chinese':lang==='it'?'Italian':'English'}.
Include: memory tip, common usage, 1-2 example sentences. Keep it brief and friendly.`,
      }),
    }).then(r=>r.json()).then(d=>{setText(d.result||d.content||'');setLoading(false);})
    .catch(()=>{setText('Error');setLoading(false);});
  }, [word.id]);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
      display:'flex', alignItems:'flex-end', zIndex:200 }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ width:'100%', maxHeight:'70vh', background:'#fff', borderRadius:'24px 24px 0 0',
          padding:'20px 20px 40px', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <span style={{ fontSize:28, fontFamily:"'STKaiti','KaiTi',serif", fontWeight:700 }}>{word.word}</span>
            <span style={{ fontSize:14, color:'#6b4c2a', marginLeft:10 }}>{word.pinyin}</span>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:22, cursor:'pointer', color:'#a07850' }}>✕</button>
        </div>
        {loading
          ? <div style={{ color:'#a07850', textAlign:'center', padding:20 }}>🤖 AI 解释中…</div>
          : <div style={{ fontSize:14, color:'#1a0a05', lineHeight:1.8, whiteSpace:'pre-wrap' }}>{text}</div>}
      </div>
    </div>
  );
}

// ── Main HSKApp ─────────────────────────────────────────────────────────────
export default function HSKApp({ onBack }) {
  const { lang } = useLang();
  const t = (zh,en,it) => lang==='zh'?zh:lang==='it'?it||en:en;
  const [screen,    setScreen]    = useState('home');  // home|learn|quiz|practice|wordlist
  const [selLevel,  setSelLevel]  = useState(null);
  const [words,     setWords]     = useState([]);
  const [loadingW,  setLoadingW]  = useState(false);
  const [counts,    setCounts]    = useState({});
  const [playingId, setPlayingId] = useState(null);

  async function playWord(w) {
    setPlayingId(w.id);
    if (w.audio_url) {
      const a = new Audio(w.audio_url);
      a.onended = ()=>setPlayingId(null);
      a.play(); return;
    }
    try {
      const res = await fetch('/.netlify/functions/azure-tts-speak', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ text:w.word, lang:'zh-CN', voice:'zh-CN-XiaoxiaoNeural' }),
      });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        const a   = new Audio(url);
        a.onended = ()=>{ setPlayingId(null); URL.revokeObjectURL(url); };
        a.play(); return;
      }
    } catch {}
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(w.word);
      u.lang='zh-CN'; u.rate=0.85;
      u.onend=()=>setPlayingId(null);
      window.speechSynthesis.speak(u);
    } else setPlayingId(null);
  }

  // Load word counts per level
  useEffect(() => {
    supabase.from('jgw_hsk_words').select('hsk_level').eq('active',true)
      .then(({ data }) => {
        const c = {};
        (data||[]).forEach(r => { c[r.hsk_level] = (c[r.hsk_level]||0)+1; });
        setCounts(c);
      });
  }, []);

  function selectLevel(level) {
    setSelLevel(level);
    setLoadingW(true);
    supabase.from('jgw_hsk_words').select('*').eq('hsk_level',level).eq('active',true)
      .order('sort_order').limit(500)
      .then(({ data }) => { setWords(data||[]); setLoadingW(false); });
  }

  if (screen==='learn'    && words.length) return <LearnScreen    words={words} level={selLevel} lang={lang} onBack={()=>setScreen('level')}/>;
  if (screen==='quiz'     && words.length) return <QuizScreen     words={words} level={selLevel} lang={lang} onBack={()=>setScreen('level')}/>;
  if (screen==='practice' && words.length) return <PracticeScreen words={words} level={selLevel} lang={lang} onBack={()=>setScreen('level')}/>;

  const color = selLevel ? (HSK_COLORS[selLevel]||'#8B4513') : '#8B4513';

  // Level detail screen
  if (screen==='level' && selLevel) {
    const filtered = words.filter(w =>
      !search || w.word.includes(search) || (w.pinyin||'').toLowerCase().includes(search.toLowerCase()) ||
      (w.meaning_zh||'').includes(search) || (w.meaning_en||'').toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div style={{ minHeight:'100dvh', background:'#fdf6e3' }}>
        <div style={{ background:color, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>{setScreen('home');setSelLevel(null);setSearch('');}}
            style={{ border:'none', background:'none', fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
          <div style={{ color:'#fff', fontSize:16, fontWeight:700, flex:1 }}>HSK {selLevel}</div>
          <div style={{ color:'#ffffff99', fontSize:12 }}>{words.length} 词</div>
        </div>

        {loadingW ? (
          <div style={{ textAlign:'center', padding:40, color:'#a07850' }}>加载中…</div>
        ) : (
          <>
            {/* Mode buttons */}
            <div style={{ padding:'14px 16px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              {[
                { id:'learn',    icon:'📖', label:t('学习','Learn','Impara') },
                { id:'quiz',     icon:'✅', label:t('测验','Quiz','Quiz') },
                { id:'practice', icon:'🎯', label:t('练习','Practice','Pratica') },
              ].map(m => (
                <button key={m.id} onClick={()=>setScreen(m.id)}
                  style={{ padding:'14px 8px', borderRadius:16, border:'none',
                    background:color, color:'#fff', cursor:'pointer',
                    fontSize:12, fontWeight:700, display:'flex', flexDirection:'column',
                    alignItems:'center', gap:4, boxShadow:`0 4px 12px ${color}44` }}>
                  <span style={{ fontSize:24 }}>{m.icon}</span>{m.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ padding:'0 16px 10px' }}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder={t('搜索词语…','Search words…','Cerca…')}
                style={{ width:'100%', padding:'9px 12px', fontSize:13, borderRadius:10,
                  border:`1px solid ${color}33`, boxSizing:'border-box', outline:'none' }}/>
            </div>

            {/* Word list */}
            <div style={{ padding:'0 16px 80px' }}>
              {filtered.map(w => {
                const meaning = lang==='zh' ? w.meaning_zh : lang==='it' ? (w.meaning_it||w.meaning_en) : w.meaning_en;
                return (
                  <div key={w.id} style={{ background:'#fff', borderRadius:12, padding:'12px 14px',
                    marginBottom:8, border:`1px solid ${color}22`,
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <span style={{ fontSize:20, fontWeight:700, fontFamily:"'STKaiti','KaiTi',serif",
                        color:'#1a0a05', marginRight:10 }}>{w.word}</span>
                      <span style={{ fontSize:12, color:'#a07850' }}>{w.pinyin}</span>
                      {w.category && <span style={{ fontSize:10, background:`${color}15`, color,
                        padding:'1px 6px', borderRadius:8, marginLeft:6 }}>{w.category}</span>}
                      <div style={{ fontSize:12, color:'#6b4c2a', marginTop:3 }}>{meaning}</div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button onClick={()=>playWord(w)}
                        style={{ width:32, height:32, borderRadius:10, border:`1px solid ${color}33`,
                          background:playingId===w.id?color:`${color}11`,
                          color:playingId===w.id?'#fff':color, fontSize:14, cursor:'pointer' }}>
                        {playingId===w.id?'🔊':'▶'}
                      </button>
                      <button onClick={()=>setAiWord(w)}
                        style={{ padding:'4px 10px', borderRadius:8, border:`1px solid ${color}33`,
                          background:`${color}11`, color, fontSize:11, cursor:'pointer' }}>
                        🤖 AI
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {aiWord && <AIExplain word={aiWord} lang={lang} onClose={()=>setAiWord(null)}/>}
          </>
        )}
      </div>
    );
  }

  // Home — level selector
  return (
    <div style={{ minHeight:'100dvh', background:'#fdf6e3', paddingBottom:80 }}>
      <div style={{ background:'#8B4513', padding:'16px 16px 20px' }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize:22, color:'#fff', cursor:'pointer', marginBottom:8, display:'block' }}>‹</button>
        <div style={{ fontSize:22, fontWeight:700, color:'#fff' }}>📚 HSK</div>
        <div style={{ fontSize:12, color:'#ffffff99', marginTop:4 }}>
          {t('按级别学习 · AI解释 · 间隔练习','Learn by level · AI explanations · Spaced practice','Per livello · AI · Ripetizione spaziata')}
        </div>
      </div>

      <div style={{ padding:'16px' }}>
        <AdaptiveCard module="hsk" lang={lang}/>

        <div style={{ fontSize:13, fontWeight:600, color:'#8B4513', marginBottom:12 }}>
          {t('选择级别 Choose Level','Choose Level','Scegli il livello')}
        </div>

        {[1,2,3,4,5,6].map(level => {
          const c = HSK_COLORS[level];
          const count = counts[level] || 0;
          return (
            <button key={level} onClick={() => { selectLevel(level); setScreen('level'); }}
              style={{ width:'100%', marginBottom:10, padding:0, borderRadius:18,
                border:`1.5px solid ${c}44`, background:'#fff', cursor:'pointer',
                boxShadow:`0 3px 12px ${c}22`, overflow:'hidden', textAlign:'left',
                WebkitTapHighlightColor:'transparent' }}>
              <div style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px' }}>
                <div style={{ width:48, height:48, borderRadius:14,
                  background:`linear-gradient(135deg,${c},${c}cc)`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:22, fontWeight:800, color:'#fff', flexShrink:0 }}>
                  {level}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:'#1a0a05' }}>HSK {level}</div>
                  <div style={{ fontSize:11, color:'#a07850', marginTop:2 }}>
                    {count > 0 ? `${count} ${t('个词','words','parole')}` : t('暂无内容，请管理员添加','No content yet','Nessun contenuto')}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {count > 0 && ['📖','✅','🎯'].map((icon,i) => (
                    <div key={i} style={{ width:28, height:28, borderRadius:8,
                      background:`${c}15`, display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:14 }}>{icon}</div>
                  ))}
                </div>
                <div style={{ color:c, fontSize:20 }}>›</div>
              </div>
              <div style={{ height:3, background:`linear-gradient(90deg,${c},transparent)` }}/>
            </button>
          );
        })}

        <div style={{ background:'#F3E5F5', border:'1px solid #CE93D8', borderRadius:14,
          padding:'12px 14px', marginTop:8, fontSize:12, color:'#6A1B9A' }}>
          💡 {t(
            'AI 解释功能：点击单词旁的🤖按钮，获取该词的记忆技巧、用法和例句。',
            'Click 🤖 next to any word for AI-powered memory tips, usage notes, and examples.',
            'Clicca 🤖 per spiegazioni AI con suggerimenti di memoria ed esempi.'
          )}
        </div>
      </div>
    </div>
  );
}
