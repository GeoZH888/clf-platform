// src/games/gameUi.jsx
// Shared chrome for 游戏中心 mini-games — extracted from GamesApp so new games
// (RadicalGame, …) reuse the same score badge / lives / result screen.

import { supabase } from '../lib/supabase.js';

const TOKEN_KEY = 'jgw_device_token';

export function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
export function getToken()   { return localStorage.getItem(TOKEN_KEY); }

export async function awardPoints(action, pts) {
  const token = getToken();
  if (!token) return;
  await supabase.from('jgw_points').insert({ device_token:token, module:'games', action, points:pts });
}

// ── Score Badge ────────────────────────────────────────────────────────────────
export function ScoreBadge({ score, label, color='#8B4513' }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:'8px 16px',
      border:`1.5px solid ${color}33`, textAlign:'center', minWidth:80 }}>
      <div style={{ fontSize:22, fontWeight:800, color }}>{score}</div>
      <div style={{ fontSize:10, color:'#a07850' }}>{label}</div>
    </div>
  );
}

// ── Lives display ──────────────────────────────────────────────────────────────
export function Lives({ count, max=3 }) {
  return (
    <div style={{ display:'flex', gap:4 }}>
      {Array.from({length:max}, (_,i) => (
        <span key={i} style={{ fontSize:18, opacity: i < count ? 1 : 0.2 }}>❤️</span>
      ))}
    </div>
  );
}

// ── Result Screen ──────────────────────────────────────────────────────────────
export function ResultScreen({ score, total, max, icon, title, onBack, onReplay, lang, extra }) {
  const t = (zh, en) => lang==='zh' ? zh : en;
  const pct  = Math.round((score / max) * 100);
  const star = pct >= 80 ? 3 : pct >= 50 ? 2 : 1;
  const msg  = pct >= 80 ? ['🏆', t('太棒了！','Excellent!')]
             : pct >= 50 ? ['👍', t('很好！','Good job!')]
             : ['💪', t('继续练习！','Keep practicing!')];
  return (
    <div style={{ minHeight:'100dvh', background:'#1a0a05', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', padding:24, gap:20 }}>
      <div style={{ fontSize:60 }}>{msg[0]}</div>
      <div style={{ fontSize:20, fontWeight:700, color:'#fdf6e3' }}>{msg[1]}</div>
      <div style={{ display:'flex', gap:4 }}>
        {[1,2,3].map(s => <span key={s} style={{ fontSize:32, opacity:s<=star?1:0.2 }}>⭐</span>)}
      </div>
      <div style={{ background:'#2a1a0a', borderRadius:20, padding:'20px 32px', textAlign:'center',
        border:'1px solid #5D2E0C', minWidth:200 }}>
        <div style={{ fontSize:40, fontWeight:800, color:'#F57F17' }}>{score}</div>
        <div style={{ fontSize:13, color:'#a07850' }}>{t('总分','Total Score')}</div>
        {extra && <div style={{ fontSize:11, color:'#a07850', marginTop:4 }}>{extra}</div>}
      </div>
      <div style={{ display:'flex', gap:12 }}>
        <button onClick={onReplay}
          style={{ padding:'12px 28px', borderRadius:14, border:'none',
            background:'#8B4513', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          🔄 {t('再玩一次','Play Again')}
        </button>
        <button onClick={onBack}
          style={{ padding:'12px 24px', borderRadius:14,
            border:'1px solid #5D2E0C', background:'transparent',
            color:'#fdf6e3', fontSize:14, cursor:'pointer' }}>
          {t('返回','Back')}
        </button>
      </div>
    </div>
  );
}
