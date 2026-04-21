/**
 * src/components/game/MemoryMatch.jsx
 * Flip cards to match oracle bone SVG ↔ modern character
 * XP: +15 per pair, +30 bonus when all matched
 *
 * Self-adaptive Level 2:
 *   - Pool drawn from chars the user has LEARNED (localStorage progress)
 *   - Deck size scales with learned count: 4 / 6 / 8 pairs
 *   - Falls back to props `characters` if user hasn't learned enough yet
 *   - Matched cards fade out (800ms) for cleaner play
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLang } from '../../context/LanguageContext.jsx';
import { useCharacterProgress } from '../../hooks/useCharacterProgress.js';

// Deck sizing: scale difficulty with what the user has actually learned
const LEARNED_THRESHOLDS = [
  { min: 16, pairs: 8 },
  { min: 8,  pairs: 6 },
  { min: 4,  pairs: 4 },
];
const MIN_LEARNED_TO_PLAY = 4;

function pickDeckSize(learnedCount) {
  for (const t of LEARNED_THRESHOLDS) {
    if (learnedCount >= t.min) return t.pairs;
  }
  return 0;  // not enough chars
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function MemoryMatch({ characters, onBack, onXP }) {
  const { t, lang } = useLang();
  const { getLearnedChars } = useCharacterProgress();

  const [cards, setCards]     = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  // removingIds: cards whose match animation started but haven't yet been removed from the board
  const [removingIds, setRemovingIds] = useState([]);
  const [moves, setMoves]     = useState(0);
  const [done, setDone]       = useState(false);
  const [totalPairs, setTotalPairs] = useState(0);

  // Build pool: prefer learned chars, else fall back to the set passed in
  const { pool, usingLearned, learnedCount } = useMemo(() => {
    const learnedKeys = getLearnedChars();
    const byChar = {};
    (characters || []).forEach(c => {
      if (c?.glyph_modern) byChar[c.glyph_modern] = c;
    });

    const learnedChars = learnedKeys
      .map(k => byChar[k])
      .filter(Boolean);

    if (learnedChars.length >= MIN_LEARNED_TO_PLAY) {
      return { pool: learnedChars, usingLearned: true, learnedCount: learnedChars.length };
    }
    return { pool: characters || [], usingLearned: false, learnedCount: learnedChars.length };
  }, [characters, getLearnedChars]);

  const initGame = useCallback(() => {
    const desiredPairs = usingLearned
      ? pickDeckSize(pool.length)
      : Math.min(6, pool.length);  // fallback keeps old 6-pair behavior

    if (desiredPairs < 2) {
      setCards([]);
      setTotalPairs(0);
      return;
    }

    const shuffledPool = shuffleInPlace([...pool]);
    const selected = shuffledPool.slice(0, desiredPairs);

    const deck = [];
    selected.forEach((ch, i) => {
      deck.push({ id: i * 2,     type: 'oracle', char: ch });
      deck.push({ id: i * 2 + 1, type: 'modern', char: ch });
    });
    shuffleInPlace(deck);

    setCards(deck);
    setTotalPairs(desiredPairs);
    setFlipped([]);
    setMatched([]);
    setRemovingIds([]);
    setMoves(0);
    setDone(false);
  }, [pool, usingLearned]);

  useEffect(() => { initGame(); }, [initGame]);

  const handleFlip = (idx) => {
    const card = cards[idx];
    if (!card || card.matched || flipped.length >= 2 || flipped.includes(idx)) return;
    const next = [...flipped, idx];
    setFlipped(next);

    if (next.length === 2) {
      setMoves(m => m + 1);
      const [a, b] = next.map(i => cards[i]);
      const isMatch = a.char.glyph_modern === b.char.glyph_modern && a.type !== b.type;

      if (isMatch) {
        // Keep faces visible briefly so user registers the match, then fade out
        setTimeout(() => {
          setCards(cs => cs.map((c, i) =>
            next.includes(i) ? { ...c, matched: true } : c
          ));
          setRemovingIds(prev => [...prev, a.id, b.id]);
          setMatched(m => {
            const newM = [...m, a.char.glyph_modern];
            onXP?.('memory_match');
            if (newM.length === totalPairs) {
              onXP?.('memory_complete');
              setTimeout(() => setDone(true), 900);
            }
            return newM;
          });
          setFlipped([]);
        }, 450);
      } else {
        setTimeout(() => setFlipped([]), 900);
      }
    }
  };

  // ─── Not enough learned chars ──────────────────────────────
  if (usingLearned === false && learnedCount > 0 && learnedCount < MIN_LEARNED_TO_PLAY) {
    return (
      <div style={{ padding:'2rem 1rem', textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:10 }}>🌱</div>
        <div style={{ fontSize:16, fontWeight:500, color:'var(--color-text-primary)', marginBottom:6 }}>
          {lang === 'zh' ? `还差 ${MIN_LEARNED_TO_PLAY - learnedCount} 个字` : lang === 'it' ? `Servono ancora ${MIN_LEARNED_TO_PLAY - learnedCount} caratteri` : `${MIN_LEARNED_TO_PLAY - learnedCount} more characters needed`}
        </div>
        <div style={{ fontSize:13, color:'var(--color-text-secondary)', marginBottom:16, lineHeight:1.6, maxWidth:280, margin:'0 auto 16px' }}>
          {lang === 'zh'
            ? '记忆游戏会从你已经学会的字里抽取。多练几个字后再来!'
            : lang === 'it'
            ? 'Il gioco di memoria pesca dai caratteri che hai imparato. Pratica qualche carattere in più!'
            : 'The memory game pulls from characters you\'ve learned. Practice a few more first!'}
        </div>
        <button onClick={onBack} style={{ padding:'10px 20px', fontSize:14, cursor:'pointer', borderRadius:10, border:'none', background:'#8B4513', color:'#fdf6e3', fontFamily:'var(--font-sans)', fontWeight:500 }}>
          {t('back')}
        </button>
      </div>
    );
  }

  // ─── Complete ──────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ padding:'1rem', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🎉</div>
        <div style={{ fontSize:18, fontWeight:500, color:'var(--color-text-primary)', marginBottom:4 }}>
          {t('allMatched')}
        </div>
        <div style={{ fontSize:14, color:'var(--color-text-secondary)', marginBottom:16 }}>
          {moves} {t('moves')}
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={initGame} style={{ padding:'10px 20px', fontSize:14, cursor:'pointer', borderRadius:10, border:'none', background:'#8B4513', color:'#fdf6e3', fontFamily:'var(--font-sans)', fontWeight:500 }}>
            {t('restart')}
          </button>
          <button onClick={onBack} style={{ padding:'10px 20px', fontSize:14, cursor:'pointer', borderRadius:10, border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', fontFamily:'var(--font-sans)' }}>
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:'0 0.5rem' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={onBack} style={{ padding:'6px 12px', fontSize:13, cursor:'pointer', borderRadius:8, border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', fontFamily:'var(--font-sans)' }}>
          ← {t('back')}
        </button>
        <div style={{ fontSize:14, fontWeight:500, color:'var(--color-text-primary)' }}>
          {t('memoryMatch')} {usingLearned && <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>· {totalPairs}{lang==='zh'?'对':lang==='it'?' coppie':' pairs'}</span>}
        </div>
        <div style={{ fontSize:13, color:'var(--color-text-secondary)' }}>{moves} {t('moves')}</div>
      </div>

      {/* "Drawn from your learned chars" hint */}
      {usingLearned && (
        <div style={{ textAlign:'center', fontSize:11, color:'var(--color-text-tertiary)', marginBottom:8 }}>
          {lang === 'zh'
            ? `从你已学会的 ${learnedCount} 个字中抽取 ✨`
            : lang === 'it'
            ? `Estratto dai tuoi ${learnedCount} caratteri imparati ✨`
            : `Drawn from your ${learnedCount} learned characters ✨`}
        </div>
      )}

      {/* Matched indicator */}
      <div style={{ display:'flex', gap:5, justifyContent:'center', marginBottom:10, flexWrap:'wrap', minHeight:28 }}>
        {matched.length > 0 && matched.map(glyph => (
          <div key={glyph} style={{
            padding:'3px 10px', borderRadius:20, fontSize:13,
            fontFamily:"'STKaiti','KaiTi',serif",
            background:'#E8F5E9', color:'#2E7D32',
            border:'0.5px solid #2E7D32',
          }}>
            {glyph} ✓
          </div>
        ))}
      </div>

      {/* Card grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
        {cards.map((card, idx) => {
          const isFlipped = flipped.includes(idx) || card.matched;
          const isMatch   = card.matched;
          const isRemoving = removingIds.includes(card.id);

          return (
            <div
              key={card.id}
              onClick={() => handleFlip(idx)}
              style={{
                aspectRatio:'1',
                perspective:600,
                cursor: isMatch ? 'default' : 'pointer',
                transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
                opacity: isRemoving ? 0 : 1,
                transform: isRemoving ? 'scale(0.7)' : 'scale(1)',
                pointerEvents: isRemoving ? 'none' : 'auto',
              }}
            >
              <div style={{
                width:'100%', height:'100%', position:'relative',
                transformStyle:'preserve-3d', transition:'transform 0.4s',
                transform: isFlipped ? 'rotateY(180deg)' : 'none',
              }}>
                {/* Card back */}
                <div style={{
                  position:'absolute', inset:0, borderRadius:12,
                  background:'#8B4513',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
                }}>
                  <span style={{ fontSize:18, color:'#fdf6e3', opacity:0.5 }}>甲</span>
                </div>
                {/* Card front */}
                <div style={{
                  position:'absolute', inset:0, borderRadius:12,
                  background: isMatch ? '#E8F5E9' : 'var(--color-background-secondary)',
                  border:`2px solid ${isMatch ? '#2E7D32' : 'var(--color-border-secondary)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  backfaceVisibility:'hidden', WebkitBackfaceVisibility:'hidden',
                  transform:'rotateY(180deg)', overflow:'hidden',
                  transition:'border-color 0.3s',
                }}>
                  {card.type === 'oracle'
                    ? <div style={{ width:'76%', height:'76%' }} dangerouslySetInnerHTML={{
                        __html: card.char.svg_jiaguwen?.replace('<svg ', '<svg width="100%" height="100%" ')
                             || `<span style="font-size:22px;font-family:'STKaiti','KaiTi',serif;color:#8B4513">${card.char.glyph_modern}</span>`
                      }}/>
                    : <div style={{ textAlign:'center', padding:4 }}>
                        <div style={{ fontSize:22, fontFamily:"'STKaiti','KaiTi',serif", color: isMatch ? '#2E7D32' : 'var(--color-text-primary)' }}>{card.char.glyph_modern}</div>
                        <div style={{ fontSize:9, color:'var(--color-text-tertiary)', marginTop:2, lineHeight:1.2 }}>
                          {lang === 'zh' ? card.char.meaning_zh : lang === 'it' ? card.char.meaning_it : card.char.meaning_en}
                        </div>
                      </div>
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
