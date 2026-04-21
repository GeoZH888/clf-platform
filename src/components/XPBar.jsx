/**
 * src/components/XPBar.jsx
 * Shows level icon · level name · XP progress bar · level-up toast
 */
import { useLang, getLevel, getXPProgress } from '../context/LanguageContext.jsx';

export default function XPBar({ xp, levelUp, lastGain, compact = false }) {
  const { lang, t } = useLang();
  const level = getLevel(xp);
  const { pct, toNext, nextLevel } = getXPProgress(xp);
  const levelName = level[lang] || level.en;

  if (compact) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 10px', background:'var(--color-background-secondary)', borderRadius:20 }}>
        <span style={{ fontSize:14 }}>{level.icon}</span>
        <span style={{ fontSize:12, fontWeight:500, color:'var(--color-text-primary)' }}>{levelName}</span>
        <div style={{ width:60, height:4, background:'var(--color-border-tertiary)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'#8B4513', borderRadius:2, transition:'width 0.5s' }}/>
        </div>
        <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>{xp} {t('xp')}</span>
      </div>
    );
  }

  return (
    <div style={{ position:'relative', width:'100%', maxWidth:320, margin:'0 auto' }}>
      {/* Level up toast */}
      {levelUp && (
        <div style={{
          position:'absolute', top:-48, left:'50%', transform:'translateX(-50%)',
          background:'#8B4513', color:'#fdf6e3', padding:'8px 16px', borderRadius:20,
          fontSize:13, fontWeight:500, whiteSpace:'nowrap', zIndex:100,
          animation:'slideDown 0.3s ease',
        }}>
          {level.icon} {t('levelUp')} {levelName}!
        </div>
      )}

      <div style={{ background:'var(--color-background-secondary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:12, padding:'10px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:20 }}>{level.icon}</span>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--color-text-primary)' }}>{levelName}</div>
              <div style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>{t('level')} {level.index + 1}</div>
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:16, fontWeight:500, color:'#8B4513' }}>{xp}</div>
            <div style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>{t('xp')}</div>
          </div>
        </div>

        <div style={{ height:6, background:'var(--color-border-tertiary)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#8B4513,#c0704a)', borderRadius:3, transition:'width 0.6s ease' }}/>
        </div>

        {nextLevel && (
          <div style={{ fontSize:10, color:'var(--color-text-tertiary)', textAlign:'right' }}>
            {toNext} {t('xp')} → {nextLevel[lang] || nextLevel.en}
          </div>
        )}

        {/* Last gain popup */}
        {lastGain && Date.now() - lastGain.ts < 2000 && (
          <div style={{ position:'absolute', right:14, top:10, fontSize:12, fontWeight:500, color:'#8B4513', animation:'fadeUp 0.4s ease' }}>
            {t('xpGained').replace('{n}', lastGain.amount)}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateX(-50%) translateY(-8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(-4px)} }
      `}</style>
    </div>
  );
}
