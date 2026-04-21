/**
 * src/components/game/GameHub.jsx
 * 进阶模式 game hub — selects between Memory Match, Glyph Quiz, Speed Trace, Daily Challenge
 */
import { useState } from 'react';
import { useLang } from '../../context/LanguageContext.jsx';
import { useCharacters } from '../../hooks/useJiaguwen.js';
import { useXP } from '../../hooks/useXP.js';
import XPBar from '../XPBar.jsx';
import LangSwitcher from '../LangSwitcher.jsx';
import MemoryMatch from './MemoryMatch.jsx';
import GlyphQuiz from './GlyphQuiz.jsx';

const GAME_MODES = [
  {
    id: 'memory',
    icon: '🃏',
    color: '#E3F2FD',
    border: '#1976D2',
    xpLabel: '+15–45 XP',
  },
  {
    id: 'quiz',
    icon: '❓',
    color: '#FFF3E0',
    border: '#E65100',
    xpLabel: '+10–100 XP',
  },
  {
    id: 'speed',
    icon: '⏱',
    color: '#F3E5F5',
    border: '#7B1FA2',
    xpLabel: '+20–60 XP',
    soon: true,
  },
  {
    id: 'daily',
    icon: '🌅',
    color: '#E8F5E9',
    border: '#2E7D32',
    xpLabel: '+50 XP',
    soon: true,
  },
];

export default function GameHub({ onBack }) {
  const { t, lang } = useLang();
  const { characters, loading } = useCharacters({ limit: 10 });
  const { xp, level, levelUp, lastGain, reward } = useXP();
  const [activeGame, setActiveGame] = useState(null);

  if (activeGame === 'memory') {
    return <MemoryMatch characters={characters} onBack={() => setActiveGame(null)} onXP={reward}/>;
  }
  if (activeGame === 'quiz') {
    return <GlyphQuiz characters={characters} onBack={() => setActiveGame(null)} onXP={reward}/>;
  }

  return (
    <div style={{ padding:'0.75rem' }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={onBack} style={{ padding:'6px 12px', fontSize:13, cursor:'pointer', borderRadius:8, border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', fontFamily:'var(--font-sans)' }}>
          ← {t('back')}
        </button>
        <div style={{ fontSize:14, fontWeight:500, color:'var(--color-text-primary)' }}>{t('games')}</div>
        <LangSwitcher/>
      </div>

      {/* XP bar */}
      <div style={{ marginBottom:14 }}>
        <XPBar xp={xp} levelUp={levelUp} lastGain={lastGain}/>
      </div>

      {/* Section label */}
      <div style={{ fontSize:11, color:'var(--color-text-tertiary)', letterSpacing:'0.06em', textAlign:'center', marginBottom:12 }}>
        {t('selectGame')}
      </div>

      {/* Game cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {GAME_MODES.map(mode => (
          <div
            key={mode.id}
            onClick={() => !mode.soon && setActiveGame(mode.id)}
            style={{
              background: mode.color,
              border: `1px solid ${mode.border}22`,
              borderRadius: 14,
              padding: 14,
              cursor: mode.soon ? 'default' : 'pointer',
              opacity: mode.soon ? 0.7 : 1,
              transition: 'transform 0.15s',
              position: 'relative',
            }}
            onMouseEnter={e => { if (!mode.soon) e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {mode.soon && (
              <div style={{ position:'absolute', top:8, right:8, fontSize:10, padding:'2px 7px', borderRadius:20, background:`${mode.border}22`, color:mode.border }}>
                {t('comingSoon')}
              </div>
            )}
            <div style={{ fontSize:28, marginBottom:8 }}>{mode.icon}</div>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--color-text-primary)', marginBottom:4 }}>{t(mode.id + 'Match' === 'memoryMatch' ? 'memoryMatch' : mode.id === 'memory' ? 'memoryMatch' : mode.id === 'quiz' ? 'glyphQuiz' : mode.id === 'speed' ? 'speedTrace' : 'dailyChallenge')}</div>
            <div style={{ fontSize:11, color:'var(--color-text-secondary)', lineHeight:1.45, marginBottom:8 }}>
              {t(mode.id === 'memory' ? 'mmDesc' : mode.id === 'quiz' ? 'gqDesc' : mode.id === 'speed' ? 'stDesc' : 'dcDesc')}
            </div>
            <div style={{ fontSize:11, fontWeight:500, color:mode.border }}>{mode.xpLabel}</div>
          </div>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign:'center', padding:'1rem', fontSize:13, color:'var(--color-text-tertiary)' }}>
          Loading characters…
        </div>
      )}
    </div>
  );
}
