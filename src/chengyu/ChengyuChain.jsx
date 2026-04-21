// src/chengyu/ChengyuChain.jsx
// 成语接龙: last char of current idiom = first char of next idiom
import { useState, useEffect, useMemo, useRef } from 'react';
import PointsBadge from '../components/PointsBadge.jsx';
import { usePoints } from '../hooks/usePoints.js';

// ── Build adjacency index: char → [idioms starting with that char] ────────────
function buildIndex(idioms) {
  const idx = {};
  idioms.forEach(item => {
    const firstChar = item.idiom[0];
    if (!idx[firstChar]) idx[firstChar] = [];
    idx[firstChar].push(item);
  });
  return idx;
}

// ── Get candidates for next link ──────────────────────────────────────────────
function getCandidates(lastIdiom, idx, usedIdioms) {
  const lastChar = lastIdiom[lastIdiom.length - 1];
  const candidates = idx[lastChar] || [];
  return candidates.filter(c => !usedIdioms.has(c.idiom));
}

export default function ChengyuChain({ idioms = [], lang = 'zh', onBack }) {
  const { total: points, earn } = usePoints();
  const t = (zh, en, it) => lang==='zh' ? zh : lang==='it' ? it : en;

  const index = useMemo(() => buildIndex(idioms), [idioms]);

  const [chain,       setChain]       = useState([]);  // idioms in chain
  const [current,     setCurrent]     = useState(null); // current starting idiom
  const [candidates,  setCandidates]  = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [feedback,    setFeedback]    = useState('');
  const [gameOver,    setGameOver]    = useState(false);
  const [score,       setScore]       = useState(0);
  const [timeLeft,    setTimeLeft]    = useState(30);
  const [started,     setStarted]     = useState(false);
  const timerRef = useRef(null);

  // Pick a random starting idiom
  function startGame() {
    const starter = idioms[Math.floor(Math.random() * idioms.length)];
    const used = new Set([starter.idiom]);
    const cands = getCandidates(starter.idiom, index, used);
    setChain([starter]);
    setCurrent(starter);
    setCandidates(cands);
    setSelected(null);
    setFeedback('');
    setGameOver(false);
    setScore(0);
    setTimeLeft(30);
    setStarted(true);
  }

  // Timer
  useEffect(() => {
    if (!started || gameOver) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setGameOver(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [started, gameOver, current]);

  async function handlePick(candidate) {
    if (gameOver || selected) return;
    setSelected(candidate);
    clearInterval(timerRef.current);

    const used = new Set(chain.map(c => c.idiom).concat(candidate.idiom));
    const nextCands = getCandidates(candidate.idiom, index, used);
    const newChain  = [...chain, candidate];
    const pts = await earn('chengyu_chain', 'chengyu', { idiom: candidate.idiom });
    setScore(s => s + pts);
    setChain(newChain);
    setFeedback(`✓ +${pts}⭐  ${candidate.idiom}  ${candidate.pinyin}`);

    if (nextCands.length === 0) {
      // No more links — game over
      setTimeout(() => {
        setGameOver(true);
        setFeedback(t('接龙结束！没有可接的成语了','Chain ended! No more connections','Catena finita!'));
      }, 800);
    } else {
      // Continue
      setTimeout(() => {
        setCurrent(candidate);
        setCandidates(nextCands);
        setSelected(null);
        setFeedback('');
        setTimeLeft(30);
      }, 900);
    }
  }

  const lastChar = current ? current.idiom[current.idiom.length - 1] : '';
  const timerColor = timeLeft <= 10 ? '#C62828' : timeLeft <= 20 ? '#E65100' : '#2E7D32';

  if (!started) return (
    <div style={{ background: 'var(--bg,#F5F5F5)', minHeight: '100dvh', paddingBottom: 80 }}>
      <div style={{ background: '#00695C', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize: 24, color: '#fff', cursor: 'pointer' }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1 }}>
          {t('成语接龙','Idiom Chain','Catena')}
        </div>
        <PointsBadge total={points} size="small" color="#FFD700"/>
      </div>

      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🔗</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: '#5D2E0C',
          marginBottom: 12, fontFamily: "'STKaiti','KaiTi',serif" }}>
          {t('成语接龙','Idiom Chain','Catena di Proverbi')}
        </div>
        <div style={{ fontSize: 14, color: '#546E7A', lineHeight: 1.7, marginBottom: 24 }}>
          {t(
            '每个成语的最后一个字，必须是下一个成语的第一个字。\n链条越长，分数越高！每题30秒。',
            'The last character of each idiom must be the first of the next.\nLonger chain = more points! 30 seconds per step.',
            'L\'ultimo carattere di ogni proverbio deve essere il primo del prossimo.'
          )}
        </div>
        <div style={{ background: '#E0F2F1', borderRadius: 14, padding: '14px 20px',
          marginBottom: 24, fontSize: 13, color: '#00695C', lineHeight: 1.8 }}>
          <div>🎯 {t('例如：','Example:','Esempio:')}</div>
          <div style={{ fontFamily: "'STKaiti','KaiTi',serif", fontSize: 16,
            letterSpacing: 2, marginTop: 6 }}>
            一石二<span style={{ color: '#C62828', fontWeight: 700 }}>鸟</span>
            → <span style={{ color: '#C62828', fontWeight: 700 }}>鸟</span>语花香
            → 香飘万里…
          </div>
          <div style={{ marginTop: 6 }}>
            {t('红色字 = 接龙字','Red char = link','Carattere rosso = collegamento')}
          </div>
        </div>
        <button onClick={startGame} style={{
          padding: '14px 40px', borderRadius: 20, border: 'none',
          background: '#00695C', color: '#fff', fontSize: 16,
          fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,105,92,0.3)',
        }}>
          {t('开始接龙','Start','Inizia')}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ background: 'var(--bg,#F5F5F5)', minHeight: '100dvh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: '#00695C', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ border:'none', background:'none',
          fontSize: 24, color: '#fff', cursor: 'pointer' }}>‹</button>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', flex: 1 }}>
          {t('成语接龙','Idiom Chain','Catena')} · {t('长度','Length','Lunghezza')}: {chain.length}
        </div>
        <PointsBadge total={points} size="small" color="#FFD700"/>
      </div>

      {/* Timer bar */}
      <div style={{ height: 6, background: '#E0F2F1' }}>
        <div style={{
          height: '100%', background: timerColor,
          width: `${(timeLeft / 30) * 100}%`,
          transition: 'width 1s linear, background 0.3s',
        }}/>
      </div>

      <div style={{ padding: '14px 16px 0' }}>

        {/* Chain scroll */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto',
          paddingBottom: 8, marginBottom: 14 }}>
          {chain.map((item, i) => (
            <div key={i} style={{
              flexShrink: 0, background: '#fff',
              border: `1px solid ${i === chain.length - 1 ? '#00695C' : '#E0E0E0'}`,
              borderRadius: 10, padding: '4px 10px', fontSize: 13,
              color: i === chain.length - 1 ? '#00695C' : '#546E7A',
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1,
              fontWeight: i === chain.length - 1 ? 700 : 400,
            }}>
              {item.idiom}
              {i < chain.length - 1 && (
                <span style={{ color: '#E0E0E0', marginLeft: 4 }}>→</span>
              )}
            </div>
          ))}
        </div>

        {/* Current prompt */}
        {!gameOver && current && (
          <div style={{ background: '#fff', borderRadius: 18,
            border: '2px solid #B2DFDB', padding: '16px 20px',
            textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#90A4AE', marginBottom: 6 }}>
              {t('选一个以下面这个字开头的成语：',
                 'Choose an idiom starting with:',
                 'Scegli un proverbio che inizia con:')}
            </div>
            <div style={{ fontSize: 48, fontWeight: 700, color: '#C62828',
              fontFamily: "'STKaiti','KaiTi',serif" }}>
              {lastChar}
            </div>
            <div style={{ fontSize: 22, color: timerColor, fontWeight: 700,
              marginTop: 8 }}>
              {timeLeft}s
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div style={{ padding: '10px 16px', borderRadius: 12, marginBottom: 12,
            background: feedback.includes('✓') ? '#E8F5E9' : '#FFF3E0',
            fontSize: 13, color: feedback.includes('✓') ? '#2E7D32' : '#E65100',
            border: `1px solid ${feedback.includes('✓') ? '#A5D6A7' : '#FFCC80'}`,
            fontFamily: feedback.includes('✓') ? "'STKaiti','KaiTi',serif" : 'inherit',
          }}>
            {feedback}
          </div>
        )}

        {/* Candidates */}
        {!gameOver && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {candidates.slice(0, 6).map((cand, i) => (
              <button key={i} onClick={() => handlePick(cand)}
                disabled={!!selected}
                style={{
                  padding: '12px 16px', borderRadius: 14, cursor: selected ? 'default' : 'pointer',
                  background: selected?.idiom === cand.idiom ? '#E8F5E9' : '#fff',
                  border: `2px solid ${selected?.idiom === cand.idiom ? '#2E7D32' : '#E0E0E0'}`,
                  display: 'flex', alignItems: 'center', gap: 12,
                  opacity: selected && selected.idiom !== cand.idiom ? 0.5 : 1,
                  transition: 'all 0.15s', fontFamily: 'inherit',
                }}>
                <div style={{ fontSize: 20, fontFamily: "'STKaiti','KaiTi',serif",
                  letterSpacing: 2, color: '#5D2E0C', flex: 1, textAlign: 'left' }}>
                  <span style={{ color: '#C62828', fontWeight: 700 }}>{cand.idiom[0]}</span>
                  {cand.idiom.slice(1)}
                </div>
                <div style={{ fontSize: 11, color: '#90A4AE' }}>{cand.pinyin}</div>
              </button>
            ))}
          </div>
        )}

        {/* Game over */}
        {gameOver && (
          <div style={{ background: '#fff', borderRadius: 18,
            border: '2px solid #E8D5B0', padding: '24px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>
              {chain.length >= 5 ? '🏆' : chain.length >= 3 ? '🎉' : '😅'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#5D2E0C',
              marginBottom: 8, fontFamily: "'STKaiti','KaiTi',serif" }}>
              {t('接龙结束！','Game Over!','Fine del gioco!')}
            </div>
            <div style={{ fontSize: 16, color: '#546E7A', marginBottom: 16 }}>
              {t('链条长度','Chain length','Lunghezza catena')}: {chain.length} · {t('积分','Points','Punti')}: {score}⭐
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={startGame} style={{
                padding: '11px 28px', borderRadius: 14, border: 'none',
                background: '#00695C', color: '#fff', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}>
                {t('再来一局','Play Again','Ancora')}
              </button>
              <button onClick={onBack} style={{
                padding: '11px 20px', borderRadius: 14,
                border: '1px solid #E0E0E0',
                background: '#fff', color: '#546E7A',
                fontSize: 14, cursor: 'pointer',
              }}>
                {t('返回','Back','Indietro')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
