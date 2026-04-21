// src/components/MyStatsScreen.jsx
// Personal practice statistics — each user sees their own progress

import { useState, useEffect } from 'react';
import { getMyStats } from '../hooks/usePracticeLog';

const V = {
  bg:'var(--bg)', card:'var(--card)', text:'var(--text)',
  text2:'var(--text-2)', text3:'var(--text-3)',
  border:'var(--border)', verm:'var(--vermillion)',
};

function ScoreBadge({ score }) {
  const color = score >= 90 ? '#2E7D32'
    : score >= 70 ? '#E65100'
    : score >= 50 ? '#F57F17'
    : '#c0392b';
  const label = score >= 90 ? '优秀' : score >= 70 ? '良好' : score >= 50 ? '及格' : '加油';
  return (
    <span style={{ padding:'2px 8px', borderRadius:10, fontSize:11,
      background: color + '22', color, fontWeight:500 }}>
      {score}分 {label}
    </span>
  );
}

function MiniChart({ scores }) {
  if (scores.length < 2) return null;
  const max = 100, h = 40, w = Math.min(scores.length * 20, 160);
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * (w - 8) + 4;
    const y = h - (s / max) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  const lastScore = scores[scores.length - 1];
  const trend = scores.length >= 2
    ? lastScore - scores[scores.length - 2]
    : 0;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <svg width={w} height={h} style={{ overflow:'visible' }}>
        <polyline points={pts} fill="none"
          stroke={lastScore >= 70 ? '#2E7D32' : '#E65100'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {scores.map((s, i) => {
          const x = (i / (scores.length - 1)) * (w - 8) + 4;
          const y = h - (s / max) * (h - 8) - 4;
          return <circle key={i} cx={x} cy={y} r="2.5"
            fill={i === scores.length-1 ? '#8B4513' : '#ccc'}/>;
        })}
      </svg>
      <span style={{ fontSize:11, color: trend > 0 ? '#2E7D32' : trend < 0 ? '#c0392b' : V.text3 }}>
        {trend > 0 ? `↑${trend}` : trend < 0 ? `↓${Math.abs(trend)}` : '→'}
      </span>
    </div>
  );
}

export default function MyStatsScreen({ onBack }) {
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [sortBy,   setSortBy]   = useState('recent'); // recent | score | count

  useEffect(() => {
    getMyStats().then(data => { setLogs(data); setLoading(false); });
  }, []);

  // Group by character
  const byChar = {};
  logs.forEach(row => {
    if (!byChar[row.character]) byChar[row.character] = [];
    byChar[row.character].push(row);
  });

  const chars = Object.entries(byChar).map(([char, rows]) => {
    const count   = rows.length;
    const avgScore = Math.round(rows.reduce((s, r) => s + r.score, 0) / count);
    const best    = Math.max(...rows.map(r => r.score));
    const latest  = rows[0]; // already sorted desc
    const scores  = [...rows].reverse().map(r => r.score);
    return { char, count, avgScore, best, latest, scores };
  });

  const sorted = [...chars].sort((a, b) => {
    if (sortBy === 'score') return b.avgScore - a.avgScore;
    if (sortBy === 'count') return b.count - a.count;
    return new Date(b.latest.practiced_at) - new Date(a.latest.practiced_at);
  });

  // Summary stats
  const totalSessions = logs.length;
  const uniqueChars   = chars.length;
  const overallAvg    = chars.length
    ? Math.round(chars.reduce((s, c) => s + c.avgScore, 0) / chars.length)
    : 0;
  const mastered = chars.filter(c => c.best >= 90).length;

  return (
    <div style={{ background:V.bg, minHeight:'100dvh', paddingBottom:80 }}>

      {/* Header */}
      <div style={{ background:V.card, borderBottom:`1px solid ${V.border}`,
        padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={onBack}
          style={{ border:'none', background:'none', fontSize:22, cursor:'pointer',
            color:V.text2, padding:'0 4px' }}>‹</button>
        <div>
          <div style={{ fontSize:16, fontWeight:500, color:V.text }}>我的练习统计</div>
          <div style={{ fontSize:11, color:V.text3 }}>My Practice Progress</div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding:'3rem', textAlign:'center', color:V.text3 }}>Loading…</div>
      ) : logs.length === 0 ? (
        <div style={{ padding:'3rem', textAlign:'center' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>🖊</div>
          <div style={{ fontSize:15, color:V.text2, marginBottom:4 }}>还没有练习记录</div>
          <div style={{ fontSize:12, color:V.text3 }}>
            完成一个字的全部笔画后自动记录
          </div>
        </div>
      ) : (
        <div style={{ padding:'16px' }}>

          {/* Summary cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:16 }}>
            {[
              { label:'练习次数', value:totalSessions, sub:'Total sessions', color:'#1976D2' },
              { label:'已学字数', value:uniqueChars,   sub:'Characters practiced', color:'#2E7D32' },
              { label:'平均分',   value:overallAvg+'分', sub:'Average score', color:'#8B4513' },
              { label:'优秀掌握', value:mastered+'字',  sub:'Score ≥90', color:'#7B1FA2' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} style={{ background:V.card, borderRadius:12, padding:'12px 14px',
                border:`1px solid ${V.border}` }}>
                <div style={{ fontSize:24, fontWeight:600, color }}>{value}</div>
                <div style={{ fontSize:12, color:V.text, marginTop:2 }}>{label}</div>
                <div style={{ fontSize:10, color:V.text3 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Sort tabs */}
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            {[['recent','最近'], ['count','次数'], ['score','分数']].map(([k,l]) => (
              <button key={k} onClick={() => setSortBy(k)}
                style={{ padding:'5px 14px', fontSize:12, cursor:'pointer', borderRadius:20,
                  border:`1px solid ${sortBy===k ? V.verm : V.border}`,
                  background: sortBy===k ? V.verm : V.card,
                  color: sortBy===k ? '#fdf6e3' : V.text2 }}>
                {l}
              </button>
            ))}
          </div>

          {/* Character list */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {sorted.map(({ char, count, avgScore, best, scores, latest }) => (
              <div key={char} style={{ background:V.card, borderRadius:12, padding:'12px 14px',
                border:`1px solid ${V.border}`, display:'flex', alignItems:'center', gap:12 }}>

                {/* Character */}
                <div style={{ fontSize:36, fontFamily:"'STKaiti','KaiTi',serif",
                  minWidth:44, textAlign:'center', color:V.text }}>
                  {char}
                </div>

                {/* Stats */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                    <ScoreBadge score={avgScore}/>
                    <span style={{ fontSize:11, color:V.text3 }}>
                      练习 {count} 次 · 最高 {best}分
                    </span>
                  </div>
                  <MiniChart scores={scores}/>
                  <div style={{ fontSize:10, color:V.text3, marginTop:3 }}>
                    最近: {new Date(latest.practiced_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>

                {/* Progress ring */}
                <div style={{ textAlign:'center', flexShrink:0 }}>
                  <svg width={44} height={44}>
                    <circle cx={22} cy={22} r={18} fill="none"
                      stroke={V.border} strokeWidth="3"/>
                    <circle cx={22} cy={22} r={18} fill="none"
                      stroke={best >= 90 ? '#2E7D32' : best >= 70 ? '#E65100' : '#F57F17'}
                      strokeWidth="3"
                      strokeDasharray={`${(best/100)*113} 113`}
                      strokeLinecap="round"
                      transform="rotate(-90 22 22)"/>
                    <text x={22} y={27} textAnchor="middle"
                      fontSize="11" fontWeight="500"
                      fill={V.text}>{best}</text>
                  </svg>
                  <div style={{ fontSize:9, color:V.text3, marginTop:2 }}>最高分</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
