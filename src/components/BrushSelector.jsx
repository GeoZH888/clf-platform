/**
 * src/components/BrushSelector.jsx
 * Simplified: 软笔 / 硬笔 toggle + color picker + font selector
 */
import { useState } from 'react';
import { useLang } from '../context/LanguageContext.jsx';

// ── Brush types per mode ──────────────────────────────────────────
export const SOFT_BRUSHES = [
  { id:'maobi',  name:'毛笔', en:'Brush',    color:'rgba(15,5,2,0.92)',    baseW:16, speedF:0.055, minW:0.4,  mode:'pressure' },
  { id:'zhusha', name:'朱砂', en:'Cinnabar', color:'rgba(170,28,18,0.90)', baseW:13, speedF:0.05,  minW:0.5,  mode:'pressure' },
];

export const HARD_BRUSHES = [
  { id:'gangbi', name:'钢笔', en:'Pen',    color:'rgba(10,15,40,0.90)',  baseW:2.5, speedF:0, minW:2.5, mode:'uniform' },
  { id:'qianbi', name:'铅笔', en:'Pencil', color:'rgba(40,35,30,0.65)', baseW:3.5, speedF:0, minW:3.5, mode:'texture' },
];

export const BRUSH_TYPES = [...SOFT_BRUSHES, ...HARD_BRUSHES];

// ── Script styles (for guide watermark) ──────────────────────────
export const SCRIPT_STYLES = [
  { id:'kai',   name:'楷书', en:'Regular',  period:'魏晋 200 CE', css:"'LXGW WenKai Lite','LXGW WenKai','KaiTi','STKaiti',serif", color:'#1976D2', note:'Most structured' },
  { id:'xing',  name:'行书', en:'Running',  period:'魏晋 220 CE', css:"'Ma Shan Zheng','Liu Jian Mao Cao','STXingkai',cursive",   color:'#E65100', note:'Flowing everyday' },
  { id:'li',    name:'隶书', en:'Clerical', period:'汉 206 BCE',  css:"'LishuWZ','STLiti','LiSu',serif",                          color:'#2E7D32', note:'Wide flat strokes' },
  { id:'zhuan', name:'篆书', en:'Seal',     period:'秦 221 BCE',  css:"'ZhuantiWZ','STXinwei','STKaiti',serif",                   color:'#B71C1C', note:'Oldest systematic' },
];

// ── Color palette ─────────────────────────────────────────────────
const INK_COLORS = [
  { name:'墨黑', en:'Ink Black',  value:'rgba(15,5,2,0.92)' },
  { name:'朱砂', en:'Cinnabar',   value:'rgba(170,28,18,0.90)' },
  { name:'藏青', en:'Navy',       value:'rgba(10,15,80,0.88)' },
  { name:'墨绿', en:'Forest',     value:'rgba(15,60,30,0.88)' },
  { name:'紫墨', en:'Violet',     value:'rgba(60,10,80,0.88)' },
  { name:'金色', en:'Gold',       value:'rgba(160,120,10,0.90)' },
];

// ── Grid drawing utilities ────────────────────────────────────────
export function drawMiziGrid(canvas, S) {
  // 米字格 — for soft brush / calligraphy
  const g = canvas.getContext('2d');
  g.clearRect(0,0,S,S);
  g.fillStyle='#fdf6e3'; g.fillRect(0,0,S,S);
  // Outer border
  g.strokeStyle='#c89090'; g.lineWidth=1.5; g.setLineDash([]);
  g.strokeRect(1.5,1.5,S-3,S-3);
  // Cross lines
  g.setLineDash([5,5]); g.strokeStyle='#ddb0b0'; g.lineWidth=0.75;
  g.beginPath();g.moveTo(S/2,0);g.lineTo(S/2,S);g.stroke();
  g.beginPath();g.moveTo(0,S/2);g.lineTo(S,S/2);g.stroke();
  // Diagonal lines
  g.setLineDash([2,6]); g.strokeStyle='#e8c8c8'; g.lineWidth=0.5;
  g.beginPath();g.moveTo(0,0);g.lineTo(S,S);g.stroke();
  g.beginPath();g.moveTo(S,0);g.lineTo(0,S);g.stroke();
  g.setLineDash([]);
}

export function drawTianziGrid(canvas, S) {
  // 田字格 — for hard pen practice
  const g = canvas.getContext('2d');
  g.clearRect(0,0,S,S);
  g.fillStyle='#f0f8ff'; g.fillRect(0,0,S,S);
  // Outer border — blue/teal for 硬笔
  g.strokeStyle='#7ab8d4'; g.lineWidth=2; g.setLineDash([]);
  g.strokeRect(2,2,S-4,S-4);
  // Inner cross (田 shape)
  g.setLineDash([6,4]); g.strokeStyle='#a0cce0'; g.lineWidth=1;
  g.beginPath();g.moveTo(S/2,2);g.lineTo(S/2,S-2);g.stroke();
  g.beginPath();g.moveTo(2,S/2);g.lineTo(S-2,S/2);g.stroke();
  g.setLineDash([]);
}

// ── Stroke drawing ────────────────────────────────────────────────
export function drawBrushStroke(ctx, brush, from, to, speed, sizeScale, customColor) {
  const color = customColor || brush.color;
  if (brush.mode === 'uniform' || brush.mode === 'texture') {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = brush.baseW * sizeScale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (brush.mode === 'texture') {
      ctx.globalAlpha = 0.7 + Math.random() * 0.3;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  // Pressure-sensitive
  // Cap speed at 0.5 px/ms so mouse fast-movements don't collapse width to minW.
  // Touch/stylus moves naturally stay under this; mice often exceed 2+ px/ms.
  const dist = Math.hypot(to.x-from.x, to.y-from.y);
  const effectiveSpeed = Math.min(speed, 0.2);
  const w = Math.max(brush.minW, (brush.baseW - effectiveSpeed * brush.speedF * 60) * sizeScale);
  const dx = to.x-from.x, dy = to.y-from.y;
  const len = Math.max(dist,0.1);
  const nx = -dy/len*w/2, ny = dx/len*w/2;
  ctx.beginPath();
  ctx.moveTo(from.x+nx, from.y+ny);
  ctx.lineTo(to.x+nx, to.y+ny);
  ctx.lineTo(to.x-nx, to.y-ny);
  ctx.lineTo(from.x-nx, from.y-ny);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ── Device detection ──────────────────────────────────────────────
export function useDeviceType() {
  const isTouch = 'ontouchstart' in window;
  return { isTouch, forceUniform: !isTouch };
}

// ── Main BrushSelector component ─────────────────────────────────
export default function BrushSelector({
  penMode, onPenMode,       // 'soft' | 'hard'
  selBrush, onBrush,
  inkColor, onInkColor,
  selScript, onScript,
  sizeScale, onSize,
}) {
  const { lang } = useLang();
  const [showColors, setShowColors] = useState(false);

  const L = {
    soft:   lang==='zh'?'软笔':lang==='it'?'Pennello':'Soft',
    hard:   lang==='zh'?'硬笔':lang==='it'?'Penna dura':'Hard',
    color:  lang==='zh'?'墨色':lang==='it'?'Colore':'Color',
    font:   lang==='zh'?'字体':lang==='it'?'Font':'Font',
    size:   lang==='zh'?'笔粗':lang==='it'?'Spessore':'Size',
  };

  const currentBrushes = penMode === 'soft' ? SOFT_BRUSHES : HARD_BRUSHES;
  const currentColor = inkColor || selBrush?.color;

  return (
    <div style={{ width:'100%', maxWidth:320, margin:'0 auto', display:'flex', flexDirection:'column', gap:10 }}>

      {/* ── 软笔 / 硬笔 toggle ───────────────────────────────── */}
      <div style={{ display:'flex', border:'1.5px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        {[['soft', L.soft, '🖌'], ['hard', L.hard, '✒️']].map(([mode, label, icon]) => (
          <button key={mode} onClick={() => {
            onPenMode(mode);
            onBrush(mode === 'soft' ? SOFT_BRUSHES[0] : HARD_BRUSHES[0]);
          }}
            style={{ flex:1, padding:'10px 8px', fontSize:14, fontWeight:600, cursor:'pointer',
              border:'none', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              background: penMode===mode ? '#8B4513' : 'var(--card)',
              color: penMode===mode ? '#fdf6e3' : 'var(--text-2)',
              transition:'all 0.2s' }}>
            <span style={{ fontSize:16 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Brush sub-type ───────────────────────────────────── */}
      <div style={{ display:'flex', gap:6 }}>
        {currentBrushes.map(b => {
          const sel = selBrush?.id === b.id;
          return (
            <button key={b.id} onClick={() => onBrush(b)}
              style={{ flex:1, padding:'8px 6px', cursor:'pointer', borderRadius:10, textAlign:'center',
                border:`1.5px solid ${sel?'#8B4513':'var(--border)'}`,
                background: sel?'#8B4513':'var(--card)',
                color: sel?'#fdf6e3':'var(--text-2)', fontFamily:'inherit', transition:'all 0.15s' }}>
              <div style={{ fontSize:11, fontWeight:sel?600:400 }}>{b.name}</div>
              <div style={{ fontSize:10, opacity:0.7 }}>{b.en}</div>
            </button>
          );
        })}
      </div>

      {/* ── Ink color ────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>
          {L.color}
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {INK_COLORS.map(c => {
            const sel = currentColor === c.value;
            return (
              <button key={c.value} onClick={() => onInkColor(c.value)}
                title={lang==='zh'?c.name:c.en}
                style={{ width:32, height:32, borderRadius:'50%', cursor:'pointer', padding:0,
                  border:`2.5px solid ${sel?'#8B4513':'transparent'}`,
                  background: c.value.replace('rgba','rgb').replace(/,[\d.]+\)$/,')'),
                  boxShadow: sel?'0 0 0 2px #fdf6e3 inset':'none',
                  transition:'all 0.15s' }}/>
            );
          })}
          {/* Custom color picker */}
          <label title="Custom color" style={{ width:32, height:32, borderRadius:'50%', cursor:'pointer',
            border:'1.5px dashed var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, color:'var(--text-3)', position:'relative' }}>
            🎨
            <input type="color" onChange={e=>{
              const hex = e.target.value;
              const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
              onInkColor(`rgba(${r},${g},${b},0.9)`);
            }}
              style={{ position:'absolute', opacity:0, width:'100%', height:'100%', cursor:'pointer' }}/>
          </label>
        </div>
      </div>

      {/* ── Font selector ────────────────────────────────────── */}
      <div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:6 }}>{L.font}</div>
        <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
          {SCRIPT_STYLES.map(f => {
            const sel = selScript?.id === f.id;
            return (
              <button key={f.id} onClick={() => onScript(f)}
                style={{ flexShrink:0, padding:'6px 10px', cursor:'pointer', borderRadius:10, textAlign:'center',
                  border:`1.5px solid ${sel?f.color:'var(--border)'}`,
                  background: sel?f.color+'18':'var(--card)',
                  color: sel?f.color:'var(--text-2)', fontFamily:'inherit', transition:'all 0.15s', minWidth:52 }}>
                <div style={{ fontSize:20, fontFamily:f.css, lineHeight:1, marginBottom:2, color:sel?f.color:'var(--text)' }}>永</div>
                <div style={{ fontSize:10, fontWeight:sel?600:400 }}>{f.name}</div>
              </button>
            );
          })}
        </div>
        {selScript && (
          <div style={{ fontSize:10, color:'var(--text-3)', marginTop:4, display:'flex', gap:6 }}>
            <span style={{ color:selScript.color, fontWeight:500 }}>{selScript.name}</span>
            <span>·</span><span>{selScript.period}</span>
            <span>·</span><span>{selScript.note}</span>
          </div>
        )}
      </div>

      {/* ── Size slider ──────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:11, color:'var(--text-3)', minWidth:28 }}>{L.size}</span>
        <input type="range" min="0.4" max="2.0" step="0.1" value={sizeScale}
          onChange={e=>onSize(parseFloat(e.target.value))}
          style={{ flex:1, accentColor:'#8B4513' }}/>
        <span style={{ fontSize:11, color:'var(--text-3)', minWidth:20 }}>{sizeScale.toFixed(1)}</span>
      </div>

    </div>
  );
}
