// src/components/PracticeSession.jsx
// Reinforcement session for the 练习 bottom-nav tab.
//
// User picks a time limit (3/5/10 min). Session draws items from the user's
// progress stores (any item with ≥1 practice record), renders each as a
// multiple-choice question with a soft per-question timer (20s), and writes
// back to progress at 0.7× weight so reinforcement counts without dominating.
//
// Question types (v1, all multiple-choice to keep pace):
//   1. char→meaning       (char item) — "What does 你 mean?" → 4 meaning options
//   2. char→pinyin        (char item) — "How is 你 pronounced?" → 4 pinyin options
//   3. audio→char         (pinyin item) — play "nǐ" → 4 char options
//   4. char→tone          (pinyin item) — "What tone is 你?" → 1/2/3/4
//
// Item pool weights: weak (maxScore<60) 60%, medium (<80) 30%, mastered 10%.
// No-repeat window: current item + previous 4 can't reappear.

import { useState, useEffect, useRef, useMemo } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { useCharacters } from '../hooks/useCharacters.js';
import {
  readCharacterProgress,
  recordCharacterProgress,
} from '../hooks/useCharacterProgress.js';
import {
  readPinyinProgress,
  recordPinyinProgress,
} from '../hooks/usePinyinProgress.js';

const TIME_OPTIONS = [3, 5, 10];      // minutes
const QUESTION_TIMEOUT = 20;          // seconds per question
const SESSION_WEIGHT = 0.7;            // scores persisted at 70% so session
                                       // can't dominate dedicated practice
const NO_REPEAT_WINDOW = 4;            // don't show the same item within N

export default function PracticeSession({ onExit }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it||en) : en;

  const [phase,       setPhase]       = useState('intro');    // intro | session | summary
  const [durationMin, setDurationMin] = useState(null);
  const [results,     setResults]     = useState([]);         // [{itemKey, type, correct, timeTaken}]
  const [errorMsg,    setErrorMsg]    = useState(null);

  // ── Intro: pick a duration ───────────────────────────────────────
  if (phase === 'intro') {
    return (
      <IntroPane
        t={t} lang={lang}
        onPick={(mins) => { setDurationMin(mins); setResults([]); setPhase('session'); }}
        onExit={onExit}
      />
    );
  }

  // ── Session: runs for durationMin minutes ────────────────────────
  if (phase === 'session') {
    return (
      <SessionRunner
        t={t} lang={lang}
        durationMin={durationMin}
        onFinish={(finalResults, err) => {
          setResults(finalResults);
          if (err) setErrorMsg(err);
          setPhase('summary');
        }}
        onQuit={onExit}
      />
    );
  }

  // ── Summary ──────────────────────────────────────────────────────
  return (
    <SummaryPane
      t={t} lang={lang}
      results={results}
      errorMsg={errorMsg}
      onReplay={() => { setResults([]); setPhase('intro'); }}
      onExit={onExit}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Intro pane
// ═══════════════════════════════════════════════════════════════════
function IntroPane({ t, lang, onPick, onExit }) {
  return (
    <div style={{ padding:'16px', maxWidth:430, margin:'0 auto' }}>

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button onClick={onExit} style={{
          padding:'6px 14px', fontSize:13, cursor:'pointer', borderRadius:20,
          border:'1px solid #e8d5b0', background:'#fff', color:'#8B4513',
          WebkitTapHighlightColor:'transparent' }}>
          ‹ {t('返回','Back','Indietro')}
        </button>
        <h2 style={{ margin:0, fontSize:18, color:'#8B4513', fontWeight:500,
          fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
          {t('今日巩固','Daily Reinforcement','Rinforzo Quotidiano')}
        </h2>
      </div>

      {/* Hero banner */}
      <div style={{ background:'linear-gradient(135deg, #C8A050, #8B4513)',
        borderRadius:20, padding:'22px 18px', color:'#fff', marginBottom:18 }}>
        <div style={{ fontSize:26, fontFamily:"'STKaiti','KaiTi',Georgia,serif",
          fontWeight:500, marginBottom:6 }}>
          {t('巩固练习','Review Session','Sessione di Ripasso')}
        </div>
        <div style={{ fontSize:12, opacity:0.85, lineHeight:1.4 }}>
          {t(
            '从已学内容中抽题 · 混合汉字与拼音 · 自适应难度',
            'Draws from everything you\'ve learned · mixed items · adaptive',
            'Da ciò che hai imparato · misto · adattivo'
          )}
        </div>
      </div>

      {/* Duration picker */}
      <div style={{ fontSize:12, color:'#a07850', marginBottom:8 }}>
        ⏱ {t('选择时长','Choose duration','Durata')}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {TIME_OPTIONS.map(mins => (
          <button key={mins} onClick={() => onPick(mins)} style={{
            padding:'16px 18px', fontSize:15, cursor:'pointer', borderRadius:14,
            border:'1.5px solid #e8d5b0', background:'#fff', color:'#5D2E0C',
            display:'flex', alignItems:'center', justifyContent:'space-between',
            fontFamily:'inherit', WebkitTapHighlightColor:'transparent' }}>
            <span style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:24 }}>
                {mins === 3 ? '⚡' : mins === 5 ? '🎯' : '🏆'}
              </span>
              <span>
                <div style={{ fontSize:18, fontWeight:600 }}>
                  {mins} {t('分钟','min','min')}
                </div>
                <div style={{ fontSize:11, color:'#a07850', marginTop:2 }}>
                  {mins === 3  && t('快速复习 · 约8题',  'Quick review · ~8 questions', 'Veloce · ~8 domande')}
                  {mins === 5  && t('标准练习 · 约12题', 'Standard · ~12 questions',    'Standard · ~12 domande')}
                  {mins === 10 && t('深度巩固 · 约24题', 'Deep review · ~24 questions', 'Profondo · ~24 domande')}
                </div>
              </span>
            </span>
            <span style={{ fontSize:20, color:'#C8A050' }}>›</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize:10, color:'#a07850', textAlign:'center', marginTop:18,
        lineHeight:1.5 }}>
        {t(
          '每题 20 秒 · 超时自动下一题 · 成绩以 70% 权重记入进度',
          'Each question 20s · auto-advance on timeout · scored at 70% weight',
          'Ogni domanda 20s · auto-avanzamento · pesato al 70%'
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Session runner — loop through questions under a deadline
// ═══════════════════════════════════════════════════════════════════
function SessionRunner({ t, lang, durationMin, onFinish, onQuit }) {
  const { chars } = useCharacters();                    // full char catalog
  const deadlineRef = useRef(Date.now() + durationMin * 60 * 1000);
  const resultsRef  = useRef([]);
  const recentRef   = useRef([]);                       // no-repeat window

  const [sessionMs,  setSessionMs]  = useState(durationMin * 60 * 1000);
  const [question,   setQuestion]   = useState(null);   // {type, item, prompt, options, correctIndex}
  const [qIndex,     setQIndex]     = useState(0);

  // Build item pool once when catalog is ready
  const pool = useMemo(
    () => buildItemPool(chars),
    [chars?.length]
  );

  // ── Session countdown ticker ────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const remaining = Math.max(0, deadlineRef.current - Date.now());
      setSessionMs(remaining);
      if (remaining === 0) {
        clearInterval(iv);
        onFinish(resultsRef.current);
      }
    }, 250);
    return () => clearInterval(iv);
  }, []);

  // ── Pick the first question once pool is available ──────────────
  useEffect(() => {
    if (!question && pool.length > 0) {
      const q = nextQuestion(pool, chars, recentRef.current, lang);
      if (q) setQuestion(q);
      else onFinish(resultsRef.current, 'empty-pool');
    }
  }, [pool, question]);

  // Empty pool
  if (pool.length === 0 && !question) {
    return <EmptyPool t={t} onExit={onQuit}/>;
  }

  if (!question) {
    return <div style={{ padding:40, textAlign:'center', color:'#a07850' }}>…</div>;
  }

  const advance = (correct, timeTaken) => {
    resultsRef.current.push({
      itemKey: question.itemKey,
      type:    question.type,
      correct,
      timeTaken,
      prompt:  question.promptLabel,     // for summary recall
      answer:  question.answerLabel,
    });

    // Write back to progress store at weighted rate
    const score = correct ? Math.round(100 * SESSION_WEIGHT) : 0;
    persistScore(question, score);

    // Maintain no-repeat window
    recentRef.current.push(question.itemKey);
    if (recentRef.current.length > NO_REPEAT_WINDOW) recentRef.current.shift();

    // Advance (unless session timer expired during transition)
    if (Date.now() >= deadlineRef.current) {
      onFinish(resultsRef.current);
      return;
    }
    const next = nextQuestion(pool, chars, recentRef.current, lang);
    setQuestion(next);
    setQIndex(i => i + 1);
  };

  return (
    <QuestionPane
      t={t} lang={lang}
      question={question}
      qIndex={qIndex}
      sessionMs={sessionMs}
      onAnswer={advance}
      onQuit={onQuit}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Single question pane
// ═══════════════════════════════════════════════════════════════════
function QuestionPane({ t, lang, question, qIndex, sessionMs, onAnswer, onQuit }) {
  const [selected,  setSelected]  = useState(null);
  const [locked,    setLocked]    = useState(false);
  const [qSeconds,  setQSeconds]  = useState(QUESTION_TIMEOUT);
  const startedRef = useRef(Date.now());

  // Reset when question changes
  useEffect(() => {
    setSelected(null);
    setLocked(false);
    setQSeconds(QUESTION_TIMEOUT);
    startedRef.current = Date.now();
  }, [question.key]);

  // Per-question timer
  useEffect(() => {
    if (locked) return;
    const iv = setInterval(() => {
      const elapsed = (Date.now() - startedRef.current) / 1000;
      const remaining = Math.max(0, QUESTION_TIMEOUT - elapsed);
      setQSeconds(Math.ceil(remaining));
      if (remaining <= 0) {
        clearInterval(iv);
        handleTimeout();
      }
    }, 100);
    return () => clearInterval(iv);
  }, [question.key, locked]);

  // Auto-play audio for listen-type questions
  useEffect(() => {
    if (question.type === 'audio-char') playText(question.audioText);
  }, [question.key]);

  const handleSelect = (idx) => {
    if (locked) return;
    setLocked(true);
    setSelected(idx);
    const correct = idx === question.correctIndex;
    const timeTaken = (Date.now() - startedRef.current) / 1000;
    // Brief delay to show ✓/✗ before advancing
    setTimeout(() => onAnswer(correct, timeTaken), 1100);
  };

  const handleTimeout = () => {
    if (locked) return;
    setLocked(true);
    setTimeout(() => onAnswer(false, QUESTION_TIMEOUT), 800);
  };

  const sessionMin  = Math.floor(sessionMs / 60000);
  const sessionSec  = Math.floor((sessionMs % 60000) / 1000).toString().padStart(2,'0');

  return (
    <div style={{ padding:'14px 16px', maxWidth:430, margin:'0 auto' }}>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        marginBottom:16 }}>
        <button onClick={onQuit} style={{
          padding:'4px 10px', fontSize:12, cursor:'pointer', borderRadius:16,
          border:'1px solid #e8d5b0', background:'#fff', color:'#8B4513' }}>
          ✕ {t('退出','Exit','Esci')}
        </button>
        <div style={{ fontSize:12, color:'#8B4513', fontWeight:500 }}>
          {t('第','Q','D')} {qIndex + 1}
        </div>
        <div style={{ fontSize:13, color:'#8B4513', fontFamily:'monospace',
          background:'#fff8e1', padding:'4px 10px', borderRadius:12 }}>
          ⏱ {sessionMin}:{sessionSec}
        </div>
      </div>

      {/* Per-question timer bar */}
      <div style={{ height:4, background:'#f5ede0', borderRadius:2, marginBottom:24,
        overflow:'hidden' }}>
        <div style={{
          height:'100%',
          width: `${(qSeconds / QUESTION_TIMEOUT) * 100}%`,
          background: qSeconds <= 5 ? '#c0392b' : qSeconds <= 10 ? '#C8A050' : '#2E7D32',
          transition: 'width 0.2s linear',
        }}/>
      </div>

      {/* Prompt */}
      <div style={{ background:'#fff', borderRadius:16, padding:'24px 18px',
        border:'1px solid #e8d5b0', marginBottom:18, textAlign:'center',
        minHeight:120, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontSize:11, color:'#a07850', marginBottom:10, letterSpacing:1 }}>
          {question.promptHint}
        </div>

        {question.type === 'audio-char' ? (
          <button onClick={() => playText(question.audioText)} style={{
            width:80, height:80, borderRadius:'50%', border:'none',
            background:'#C8A050', color:'#fff', fontSize:32, cursor:'pointer' }}>
            🔊
          </button>
        ) : (
          <div style={{ fontSize:60,
            fontFamily:"'STKaiti','KaiTi',Georgia,serif", color:'#5D2E0C',
            lineHeight:1 }}>
            {question.promptDisplay}
          </div>
        )}

        {question.promptSub && (
          <div style={{ fontSize:13, color:'#a07850', marginTop:10 }}>
            {question.promptSub}
          </div>
        )}
      </div>

      {/* Options */}
      <div style={{ display:'grid',
        gridTemplateColumns: question.options.length === 4 ? '1fr 1fr' : '1fr',
        gap:10 }}>
        {question.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect  = i === question.correctIndex;
          const showResult = locked;

          let bg = '#fff', border = '#e8d5b0', color = '#5D2E0C';
          if (showResult && isCorrect)              { bg = '#E8F5E9'; border = '#2E7D32'; color = '#1B5E20'; }
          else if (showResult && isSelected)        { bg = '#FFEBEE'; border = '#C62828'; color = '#B71C1C'; }
          else if (isSelected)                      { bg = '#FFF8E1'; border = '#C8A050'; }

          return (
            <button key={i} onClick={() => handleSelect(i)} disabled={locked} style={{
              padding:'16px 12px', fontSize:18, cursor: locked ? 'default' : 'pointer',
              borderRadius:12, border:`2px solid ${border}`, background:bg, color,
              fontFamily:"'STKaiti','KaiTi',Georgia,serif",
              minHeight:60, position:'relative',
              WebkitTapHighlightColor:'transparent' }}>
              {opt}
              {showResult && isCorrect  && <CheckMark/>}
              {showResult && isSelected && !isCorrect && <CrossMark/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Summary pane
// ═══════════════════════════════════════════════════════════════════
function SummaryPane({ t, lang, results, errorMsg, onReplay, onExit }) {
  const total   = results.length;
  const correct = results.filter(r => r.correct).length;
  const wrong   = total - correct;
  const pct     = total ? Math.round(100 * correct / total) : 0;

  // Items answered wrong — surface for next session
  const weak = results.filter(r => !r.correct).slice(0, 6);

  return (
    <div style={{ padding:'16px', maxWidth:430, margin:'0 auto' }}>

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <button onClick={onExit} style={{
          padding:'6px 14px', fontSize:13, cursor:'pointer', borderRadius:20,
          border:'1px solid #e8d5b0', background:'#fff', color:'#8B4513' }}>
          ‹ {t('返回','Back','Indietro')}
        </button>
        <h2 style={{ margin:0, fontSize:18, color:'#8B4513', fontWeight:500,
          fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
          {t('练习结束','Session Complete','Sessione Completa')}
        </h2>
      </div>

      {errorMsg === 'empty-pool' && (
        <div style={{ background:'#FFF3CD', border:'1px solid #FFE082',
          borderRadius:12, padding:'12px 14px', fontSize:13, color:'#8B6914',
          marginBottom:16 }}>
          💡 {t(
            '还没有可复习的内容 — 先去主页学几个字或拼音',
            'Nothing to review yet — visit the home page first',
            'Niente da ripassare — vai alla home'
          )}
        </div>
      )}

      {total > 0 && (
        <>
          {/* Score hero */}
          <div style={{ background: pct >= 80 ? '#E8F5E9' : pct >= 50 ? '#FFF8E1' : '#FFEBEE',
            borderRadius:20, padding:'24px', textAlign:'center', marginBottom:16,
            border:`2px solid ${pct >= 80 ? '#2E7D32' : pct >= 50 ? '#C8A050' : '#C62828'}` }}>
            <div style={{ fontSize:48, fontWeight:600,
              color: pct >= 80 ? '#1B5E20' : pct >= 50 ? '#8B6914' : '#B71C1C' }}>
              {pct}%
            </div>
            <div style={{ fontSize:13, color:'#5D2E0C', marginTop:4 }}>
              {correct} {t('对','correct','corrette')} · {wrong} {t('错','wrong','errate')} · {total} {t('题','total','totali')}
            </div>
          </div>

          {/* Weak items — surface for targeted re-practice */}
          {weak.length > 0 && (
            <div style={{ background:'#fff', borderRadius:12, padding:'14px',
              border:'1px solid #e8d5b0', marginBottom:16 }}>
              <div style={{ fontSize:12, color:'#a07850', marginBottom:10 }}>
                🎯 {t('建议复习','Focus next time','Da rivedere')}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {weak.map((r, i) => (
                  <div key={i} style={{ background:'#FFEBEE', color:'#B71C1C',
                    padding:'6px 12px', borderRadius:14, fontSize:14,
                    border:'1px solid #FFCDD2',
                    fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
                    {r.prompt}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <button onClick={onReplay} style={{
        width:'100%', padding:'14px', fontSize:15, cursor:'pointer', borderRadius:14,
        border:'none', background:'#8B4513', color:'#fdf6e3', fontWeight:500,
        marginBottom:10 }}>
        🔄 {t('再练一次','Practice Again','Ancora')}
      </button>
      <button onClick={onExit} style={{
        width:'100%', padding:'12px', fontSize:13, cursor:'pointer', borderRadius:14,
        border:'1px solid #e8d5b0', background:'#fff', color:'#8B4513' }}>
        {t('返回主页','Back to home','Alla home')}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════

function EmptyPool({ t, onExit }) {
  return (
    <div style={{ padding:'40px 20px', maxWidth:430, margin:'0 auto', textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>📚</div>
      <div style={{ fontSize:16, color:'#5D2E0C', marginBottom:6,
        fontFamily:"'STKaiti','KaiTi',Georgia,serif" }}>
        {t('还没有练习记录','Nothing to review yet','Niente ancora')}
      </div>
      <div style={{ fontSize:12, color:'#a07850', marginBottom:20, lineHeight:1.5 }}>
        {t(
          '先去主页学几个汉字或拼音，回来再巩固',
          'Visit home to study some characters or pinyin, then come back',
          'Studia qualcosa, poi ripassa'
        )}
      </div>
      <button onClick={onExit} style={{
        padding:'10px 24px', fontSize:13, cursor:'pointer', borderRadius:20,
        border:'none', background:'#8B4513', color:'#fdf6e3' }}>
        {t('返回主页','Back to home','Alla home')}
      </button>
    </div>
  );
}

function CheckMark() {
  return (
    <span style={{ position:'absolute', top:8, right:10, color:'#2E7D32',
      fontSize:16, fontWeight:700 }}>✓</span>
  );
}
function CrossMark() {
  return (
    <span style={{ position:'absolute', top:8, right:10, color:'#C62828',
      fontSize:16, fontWeight:700 }}>✗</span>
  );
}

// Build a weighted pool from progress stores.
// Each entry: {source: 'char' | 'pinyin', key, scope?, stats, weight}
function buildItemPool(chars) {
  if (!chars || chars.length === 0) return [];
  const pool = [];

  // Character items
  const charProg = readCharacterProgress();
  const charMap  = new Map(chars.map(c => [c.c, c]));
  for (const [key, stats] of Object.entries(charProg)) {
    if (!stats?.practices) continue;
    const char = charMap.get(key);
    if (!char) continue;                // stale progress, char removed
    pool.push({
      source: 'char',
      key, char, stats,
      weight: weightFromStats(stats),
    });
  }

  // Pinyin items — "listen" scope only (has audio, simplest v1)
  // TODO v2: support type/speak scopes by generating typing & speech questions
  const pyProg = readPinyinProgress();
  for (const [fullKey, stats] of Object.entries(pyProg)) {
    if (!stats?.practices) continue;
    const [scope, itemKey] = fullKey.split(':');
    if (scope !== 'listen') continue;
    // Pinyin listen items key on char (not pinyin syllable)
    const char = charMap.get(itemKey);
    if (!char) continue;
    pool.push({
      source: 'pinyin',
      scope, key: itemKey, char, stats,
      weight: weightFromStats(stats),
    });
  }

  return pool;
}

function weightFromStats(s) {
  const max = s.maxScore || 0;
  if (max < 60) return 6;   // weak
  if (max < 80) return 3;   // medium
  return 1;                  // mastered
}

// Draw next question from pool, avoiding recent repeats
function nextQuestion(pool, chars, recent, lang) {
  const available = pool.filter(p => !recent.includes(p.char.c));
  const chooseFrom = available.length > 0 ? available : pool;

  // Weighted random pick
  const total = chooseFrom.reduce((s, p) => s + p.weight, 0);
  let roll = Math.random() * total;
  let item = chooseFrom[0];
  for (const p of chooseFrom) {
    roll -= p.weight;
    if (roll <= 0) { item = p; break; }
  }

  // Choose a question type appropriate to this item's source
  const types = item.source === 'char'
    ? ['char-meaning', 'char-pinyin']
    : ['audio-char', 'char-tone'];
  const type = types[Math.floor(Math.random() * types.length)];

  return buildQuestion(type, item, pool, chars, lang);
}

function buildQuestion(type, item, pool, chars, lang) {
  const c = item.char;
  const meaningField = lang === 'zh' ? 'mz' : lang === 'it' ? 'mi' : 'm';
  const meaning = c[meaningField] || c.m || '';

  const distractors = pickDistractors(pool, item, chars, 3);

  switch (type) {
    case 'char-meaning': {
      const correct = meaning;
      const opts = shuffle([correct, ...distractors.map(d => d.char[meaningField] || d.char.m || '')]);
      return {
        key:           `${c.c}-meaning-${Date.now()}`,
        itemKey:       c.c,
        type,
        promptHint:    lang === 'zh' ? '这个字是什么意思？' : lang === 'it' ? 'Significato?' : 'What does it mean?',
        promptDisplay: c.c,
        promptLabel:   c.c,
        options:       opts,
        correctIndex:  opts.indexOf(correct),
        answerLabel:   correct,
      };
    }
    case 'char-pinyin': {
      const correct = c.p || c.pinyin || '';
      const opts = shuffle([correct, ...distractors.map(d => d.char.p || d.char.pinyin || '').filter(p => p && p !== correct).slice(0,3)]);
      while (opts.length < 4) opts.push('—');   // defensive padding
      return {
        key:           `${c.c}-pinyin-${Date.now()}`,
        itemKey:       c.c,
        type,
        promptHint:    lang === 'zh' ? '这个字怎么读？' : lang === 'it' ? 'Come si legge?' : 'How to pronounce?',
        promptDisplay: c.c,
        promptSub:     meaning,
        promptLabel:   c.c,
        options:       opts,
        correctIndex:  opts.indexOf(correct),
        answerLabel:   correct,
      };
    }
    case 'audio-char': {
      const correct = c.c;
      const opts = shuffle([correct, ...distractors.map(d => d.char.c)]);
      return {
        key:           `${c.c}-audio-${Date.now()}`,
        itemKey:       c.c,
        type,
        promptHint:    lang === 'zh' ? '听音选字' : lang === 'it' ? 'Scegli il carattere' : 'Pick the character',
        audioText:     c.c,
        promptLabel:   c.p || c.pinyin || c.c,
        options:       opts,
        correctIndex:  opts.indexOf(correct),
        answerLabel:   correct,
      };
    }
    case 'char-tone': {
      const pinyin = c.p || c.pinyin || '';
      const correct = detectTone(pinyin);
      const opts = ['1','2','3','4'];
      return {
        key:           `${c.c}-tone-${Date.now()}`,
        itemKey:       c.c,
        type,
        promptHint:    lang === 'zh' ? '这个字是第几声？' : lang === 'it' ? 'Che tono?' : 'What tone?',
        promptDisplay: c.c,
        promptSub:     pinyin.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g, m => toneless(m)),
        promptLabel:   c.c,
        options:       opts,
        correctIndex:  Math.max(0, correct - 1),
        answerLabel:   String(correct),
      };
    }
  }
}

// Pick 3 distractors for a given item (same source type preferred)
function pickDistractors(pool, item, chars, n) {
  const others = pool.filter(p => p.char.c !== item.char.c);
  // Prefer same source (char vs pinyin), then fallback to any
  const sameSource = others.filter(p => p.source === item.source);
  const base = sameSource.length >= n ? sameSource : others;

  if (base.length >= n) {
    return shuffle(base).slice(0, n);
  }

  // Pool is too small — backfill from global character catalog
  const filler = shuffle(
    chars.filter(c => c.c !== item.char.c && !base.some(b => b.char.c === c.c))
  ).slice(0, n - base.length).map(c => ({ char: c, source: 'char' }));

  return [...base, ...filler];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Detect tone from tone-marked pinyin. 1=ˉ 2=ˊ 3=ˇ 4=ˋ (5/0 = neutral → 1 default).
function detectTone(pinyin) {
  if (/[āēīōūǖ]/.test(pinyin)) return 1;
  if (/[áéíóúǘ]/.test(pinyin)) return 2;
  if (/[ǎěǐǒǔǚ]/.test(pinyin)) return 3;
  if (/[àèìòùǜ]/.test(pinyin)) return 4;
  return 1;
}

// Strip tone mark for display (e.g. "nǐ" → "ni")
const TONELESS_MAP = {
  ā:'a',á:'a',ǎ:'a',à:'a',
  ē:'e',é:'e',ě:'e',è:'e',
  ī:'i',í:'i',ǐ:'i',ì:'i',
  ō:'o',ó:'o',ǒ:'o',ò:'o',
  ū:'u',ú:'u',ǔ:'u',ù:'u',
  ǖ:'u',ǘ:'u',ǚ:'u',ǜ:'u',ü:'u',
};
function toneless(c) { return TONELESS_MAP[c] || c; }

// Persist score back to progress store at SESSION_WEIGHT
function persistScore(question, score) {
  try {
    if (question.type === 'char-meaning' || question.type === 'char-pinyin' || question.type === 'char-tone') {
      recordCharacterProgress(question.itemKey, score);
    } else if (question.type === 'audio-char') {
      recordPinyinProgress('listen', question.itemKey, score);
    }
  } catch (e) { /* non-blocking */ }
}

// TTS using existing three-tier pattern. Azure → Web Speech fallback.
async function playText(text) {
  try {
    const res = await fetch('/.netlify/functions/azure-speech-token');
    if (!res.ok) throw new Error('no-token');
    const { token, region } = await res.json();
    const ssml = `<speak version='1.0' xml:lang='zh-CN'>
      <voice name='zh-CN-XiaoxiaoNeural'>${text}</voice>
    </speak>`;
    const tts = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      { method:'POST',
        headers:{
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        },
        body: ssml,
      }
    );
    if (!tts.ok) throw new Error('tts-failed');
    const blob = await tts.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    audio.play();
  } catch {
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; u.rate = 0.8;
      window.speechSynthesis.speak(u);
    }
  }
}
