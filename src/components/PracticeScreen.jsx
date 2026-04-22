import React, { useState, useEffect, useRef, useCallback } from 'react';
import HanziWriter from 'hanzi-writer';
import { useLang } from '../context/LanguageContext.jsx';
import BrushSelector, { SOFT_BRUSHES, HARD_BRUSHES, BRUSH_TYPES, SCRIPT_STYLES, drawBrushStroke, drawMiziGrid, drawTianziGrid, useDeviceType } from './BrushSelector.jsx';
import MnemonicCard from './MnemonicCard.jsx';
import { useTTS } from '../hooks/useSpeech.js';
import { useToneAnalysis, TONE_TEMPLATES, getToneFromPinyin } from '../hooks/useToneAnalysis.js';
import { useScoring, scoreLabel } from '../hooks/useScoring.js';
import { useCharacter } from '../hooks/useJiaguwen.js';
import { logPractice } from '../hooks/usePracticeLog.js';
import { recordCharacterProgress } from '../hooks/useCharacterProgress.js';
import { useCharacterProgress } from '../hooks/useCharacterProgress.js';
import DictationMode from './modes/DictationMode.jsx';
import CompletionMode from './modes/CompletionMode.jsx';
import { FONTS, SETS } from '../data/characters.js';

const S = 300;
const V = {
  card:'var(--card)', parchment:'var(--parchment)',
  text:'var(--text)', text2:'var(--text-2)', text3:'var(--text-3)',
  border:'var(--border)', vermillion:'var(--vermillion)',
};

// ─────────────────────────────────────────────────────────────────────
// Scoring: compare user's drawing against the target character
// Returns { score 0-100, coverage 0-1, precision 0-1, userPixels, level }
// where:
//   coverage  = how much of the target character was covered
//   precision = how much of the user's ink actually landed on the target
//   score     = weighted combination (coverage matters more)
//
// Strategy: rasterize the target char into a hidden offscreen canvas
// (no grid lines, just black pixels) and compare with the user canvas.
// ─────────────────────────────────────────────────────────────────────
// Cache guide rasterization AND its precomputed bbox + centroid + pixel list.
// Adding those here means we don't recompute them every score.
let _guideCache = { char: null, css: null, data: null, bbox: null, centroid: null, count: 0 };

function _analyzeInkAlpha(data, size, thresh) {
  // Single pass: bbox + centroid + pixel count for pixels whose alpha > thresh
  let minX = size, maxX = -1, minY = size, maxY = -1;
  let sumX = 0, sumY = 0, count = 0;
  for (let i = 3, idx = 0; i < data.length; i += 4, idx++) {
    if (data[i] > thresh) {
      const x = idx % size, y = (idx / size) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      sumX += x; sumY += y; count++;
    }
  }
  if (count === 0) return { count: 0 };
  return {
    count,
    bbox:     { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    centroid: { x: sumX / count, y: sumY / count },
  };
}

// Position-invariant scoring. We align user ink's centroid to the guide's
// centroid before measuring overlap, so writing in a corner of the 田字格
// scores the same as writing dead-center — only the shape matters.
// Scale is NOT normalized here (a tiny squiggle still won't match a large glyph),
// but translation is. Per Geo's ask: "先不强调位置".
function computeScore(userCanvas, char, fontCss) {
  if (!char) return null;
  const size = S;

  // ── Rasterize target glyph (cached) ──────────────────────────────
  let guide;
  if (_guideCache.char === char && _guideCache.css === fontCss && _guideCache.data) {
    guide = _guideCache;
  } else {
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const ctx = off.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `230px ${fontCss || "'STKaiti','KaiTi',serif"}`;
    ctx.fillText(char, size / 2, size / 2 + 6);
    const data = ctx.getImageData(0, 0, size, size).data;
    const analysis = _analyzeInkAlpha(data, size, 128);
    guide = { char, css: fontCss, data, ...analysis };
    _guideCache = guide;
  }

  if (guide.count < 100) {
    return { score: 0, coverage: 0, precision: 0, userPixels: 0, guidePixels: guide.count, level: 'unknown' };
  }

  // ── Analyze user ink ─────────────────────────────────────────────
  const userData = userCanvas.getContext('2d').getImageData(0, 0, size, size).data;
  const user = _analyzeInkAlpha(userData, size, 40);

  if (user.count < 30) {
    return { score: 0, coverage: 0, precision: 0, userPixels: user.count, guidePixels: guide.count, level: 'practice' };
  }

  // ── Translation: shift user so its centroid aligns with guide's ──
  const dx = Math.round(guide.centroid.x - user.centroid.x);
  const dy = Math.round(guide.centroid.y - user.centroid.y);

  // Walk the guide's pixels; for each, check user at the shifted location.
  // Iterating the guide instead of every pixel is an optimisation —
  // we only care about overlap on guide pixels for coverage.
  let overlap = 0;
  for (let i = 3, idx = 0; i < guide.data.length; i += 4, idx++) {
    if (guide.data[i] <= 128) continue;
    const gx = idx % size, gy = (idx / size) | 0;
    const ux = gx - dx, uy = gy - dy;
    if (ux < 0 || ux >= size || uy < 0 || uy >= size) continue;
    const uAlpha = userData[(uy * size + ux) * 4 + 3];
    if (uAlpha > 40) overlap++;
  }

  const coverage  = Math.min(1, overlap / guide.count);
  const precision = user.count > 0 ? overlap / user.count : 0;

  // Keep same weighting as before: coverage 70%, precision 30%
  const raw = coverage * 0.7 + precision * 0.3;
  const score = Math.round(100 * raw);

  const level = score >= 80 ? 'great'
              : score >= 60 ? 'good'
              : score >= 40 ? 'fair'
              : 'practice';

  return { score, coverage, precision, userPixels: user.count, guidePixels: guide.count, level };
}


// ── Compact settings drawer ───────────────────────────────────────
function SettingsDrawer({ penMode, onPenMode, selBrush, onBrush, inkColor, onInkColor,
  selScript, onScript, sizeScale, onSize, lang, hintMode, onHintMode }) {
  const [open, setOpen] = React.useState(false);
  const { SOFT_BRUSHES: SB, HARD_BRUSHES: HB } = React.useMemo(() => ({
    SOFT_BRUSHES: [
      { id:'maobi',  name:'毛笔', en:'Brush',    color:'rgba(15,5,2,0.92)',    baseW:16, speedF:0.055, minW:0.4,  mode:'pressure' },
      { id:'zhusha', name:'朱砂', en:'Cinnabar', color:'rgba(170,28,18,0.90)', baseW:13, speedF:0.05,  minW:0.5,  mode:'pressure' },
    ],
    HARD_BRUSHES: [
      { id:'gangbi', name:'钢笔', en:'Pen',    color:'rgba(10,15,40,0.90)',  baseW:2.5, speedF:0, minW:2.5, mode:'uniform' },
      { id:'qianbi', name:'铅笔', en:'Pencil', color:'rgba(40,35,30,0.65)', baseW:3.5, speedF:0, minW:3.5, mode:'texture' },
    ],
  }), []);

  const INK_COLORS = [
    { name:'墨黑', value:'rgba(15,5,2,0.92)' },
    { name:'朱砂', value:'rgba(170,28,18,0.90)' },
    { name:'藏青', value:'rgba(10,15,80,0.88)' },
    { name:'墨绿', value:'rgba(15,60,30,0.88)' },
    { name:'金色', value:'rgba(160,120,10,0.90)' },
  ];

  const FONTS_LIST = [
    { id:'kai',   name:'楷书', en:'Kaiti',   css:"'LXGW WenKai Lite','LXGW WenKai','KaiTi','STKaiti',serif",   color:'#1976D2' },
    { id:'xing',  name:'行书', en:'Running', css:"'Ma Shan Zheng','Liu Jian Mao Cao','STXingkai',cursive",     color:'#E65100' },
    { id:'li',    name:'隶书', en:'Lishu',   css:"'LishuWZ','STLiti','LiSu',serif",                            color:'#2E7D32' },
    { id:'zhuan', name:'篆书', en:'Seal',    css:"'ZhuantiWZ','STXinwei','STKaiti',serif",                     color:'#B71C1C' },
  ];

  const curColor = inkColor || selBrush?.color || 'rgba(15,5,2,0.92)';
  const colorDot = curColor.replace('rgba','rgb').replace(/,[\d.]+\)$/,')');

  return (
    <div style={{position:'relative'}}>
      {/* Trigger button — more visible on mobile */}
      <button onClick={()=>setOpen(o=>!o)}
        style={{padding:'7px 12px',fontSize:12,cursor:'pointer',borderRadius:20,
          border:`1.5px solid ${open?'#8B4513':'var(--border)'}`,
          background:open?'#8B4513':'var(--card)',
          display:'flex',alignItems:'center',gap:5,
          color:open?'#fdf6e3':'var(--text-2)',whiteSpace:'nowrap'}}>
        <span style={{width:10,height:10,borderRadius:'50%',background:colorDot,display:'inline-block',border:'1px solid #ccc'}}/>
        <span style={{fontSize:13}}>{penMode==='soft'?'🖌':'✒️'}</span>
        <span style={{fontFamily:selScript?.css,fontSize:13}}>{selScript?.name||'楷'}</span>
        <span style={{fontSize:11}}>⚙</span>
      </button>

      {/* Drawer */}
      {open && (
        <div style={{position:'fixed',inset:0,zIndex:50}} onClick={()=>setOpen(false)}>
          <div style={{position:'absolute',bottom:52,right:8,width:230,
            background:'var(--card)',borderRadius:16,padding:'14px',
            border:'1px solid var(--border)',boxShadow:'0 8px 32px rgba(0,0,0,0.15)'}}
            onClick={e=>e.stopPropagation()}>

            {/* Dictation hint mode */}
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>
              {lang==='zh'?'默写提示':lang==='it'?'Hint dettato':'Dictation hint'}
            </div>
            <div style={{display:'flex',gap:4,marginBottom:12}}>
              {[['both','拼音+意思'],['pinyin','拼音'],['meaning','意思']].map(([v,l]) => (
                <button key={v} onClick={()=>onHintMode?.(v)}
                  style={{flex:1,padding:'5px',fontSize:10,borderRadius:6,
                    background:hintMode===v?'#8B4513':'#f5ede0',
                    color:hintMode===v?'#fdf6e3':'var(--text-2)',
                    border:'none',cursor:'pointer'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* 软笔/硬笔 */}
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>
              {lang==='zh'?'笔类':lang==='it'?'Tipo':'Pen type'}
            </div>
            <div style={{display:'flex',gap:6,marginBottom:12}}>
              {[['soft','🖌 软笔'],['hard','✒️ 硬笔']].map(([m,l])=>(
                <button key={m} onClick={()=>{onPenMode(m);onBrush(m==='soft'?SB[0]:HB[0]);}}
                  style={{flex:1,padding:'6px',fontSize:12,cursor:'pointer',borderRadius:8,
                    border:'none',fontFamily:'inherit',
                    background:penMode===m?'#8B4513':'#f5ede0',
                    color:penMode===m?'#fdf6e3':'var(--text-2)'}}>
                  {l}
                </button>
              ))}
            </div>

            {/* Brush sub-type */}
            <div style={{display:'flex',gap:5,marginBottom:12}}>
              {(penMode==='soft'?SB:HB).map(b=>(
                <button key={b.id} onClick={()=>onBrush(b)}
                  style={{flex:1,padding:'4px',fontSize:11,cursor:'pointer',borderRadius:7,
                    border:`1.5px solid ${selBrush?.id===b.id?'#8B4513':'var(--border)'}`,
                    background:selBrush?.id===b.id?'#8B4513':'var(--card)',
                    color:selBrush?.id===b.id?'#fdf6e3':'var(--text-2)',fontFamily:'inherit'}}>
                  {b.name}
                </button>
              ))}
            </div>

            {/* Ink color */}
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>
              {lang==='zh'?'墨色':'Color'}
            </div>
            <div style={{display:'flex',gap:6,marginBottom:12,alignItems:'center'}}>
              {INK_COLORS.map(c=>(
                <button key={c.value} onClick={()=>onInkColor(c.value)} title={c.name}
                  style={{width:24,height:24,borderRadius:'50%',cursor:'pointer',padding:0,
                    border:`2px solid ${curColor===c.value?'#8B4513':'transparent'}`,
                    background:c.value.replace('rgba','rgb').replace(/,[\d.]+\)$/,')')}}/> 
              ))}
              <label style={{width:24,height:24,borderRadius:'50%',cursor:'pointer',
                border:'1.5px dashed var(--border)',display:'flex',alignItems:'center',
                justifyContent:'center',fontSize:12,position:'relative'}}>
                🎨
                <input type="color" onChange={e=>{const h=e.target.value;const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);onInkColor(`rgba(${r},${g},${b},0.9)`);}}
                  style={{position:'absolute',opacity:0,width:'100%',height:'100%',cursor:'pointer'}}/>
              </label>
            </div>

            {/* Font */}
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>
              {lang==='zh'?'字体':'Font'}
            </div>
            <div style={{display:'flex',gap:5,marginBottom:12,flexWrap:'wrap'}}>
              {FONTS_LIST.map(f=>(
                <button key={f.id} onClick={()=>onScript(f)}
                  style={{padding:'4px 8px',fontSize:13,cursor:'pointer',borderRadius:7,
                    fontFamily:f.css,border:`1.5px solid ${selScript?.id===f.id?f.color:'var(--border)'}`,
                    background:selScript?.id===f.id?f.color+'18':'var(--card)',
                    color:selScript?.id===f.id?f.color:'var(--text)'}}>
                  {f.name}
                </button>
              ))}
            </div>

            {/* Size */}
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>
              {lang==='zh'?'笔粗':'Size'} {sizeScale.toFixed(1)}
            </div>
            <input type="range" min="0.4" max="2.0" step="0.1" value={sizeScale}
              onChange={e=>onSize(parseFloat(e.target.value))}
              style={{width:'100%',accentColor:'#8B4513'}}/>

            <button onClick={()=>setOpen(false)}
              style={{width:'100%',marginTop:10,padding:'7px',fontSize:12,cursor:'pointer',
                borderRadius:8,border:'none',background:'#8B4513',color:'#fdf6e3',fontFamily:'inherit'}}>
              {lang==='zh'?'完成':'Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tone pitch canvas ──────────────────────────────────────────────
function TonePitchGraph({ expectedTone, result, pitches }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fdf6e3'; ctx.fillRect(0, 0, W, H);
    const tmpl = TONE_TEMPLATES[expectedTone];
    if (!tmpl) return;
    [0.25, 0.5, 0.75].forEach(y => {
      ctx.strokeStyle = '#e8d8c8'; ctx.lineWidth = 0.5; ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(10, y*H); ctx.lineTo(W-10, y*H); ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.strokeStyle = tmpl.color; ctx.lineWidth = 2; ctx.setLineDash([6,3]);
    ctx.beginPath();
    tmpl.contour.forEach((y, i) => {
      const x = 10 + (i/4)*(W-20);
      const py = H - y*(H-16) - 8;
      i === 0 ? ctx.moveTo(x, py) : ctx.lineTo(x, py);
    });
    ctx.stroke(); ctx.setLineDash([]);
    if (result?.contour && result.contour.length >= 5) {
      const c = result.contour;
      const mn = Math.min(...c), mx = Math.max(...c);
      ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 2;
      ctx.beginPath();
      c.forEach((v, i) => {
        const norm = mx > mn ? (v-mn)/(mx-mn) : 0.5;
        const x = 10 + (i/(c.length-1))*(W-20);
        const py = H - norm*(H-16) - 8;
        i === 0 ? ctx.moveTo(x, py) : ctx.lineTo(x, py);
      });
      ctx.stroke();
    }
    if (!result && pitches.length > 0) {
      const valid = pitches.filter(Boolean);
      if (valid.length > 2) {
        const mn = Math.min(...valid), mx = Math.max(...valid);
        ctx.strokeStyle = 'rgba(178,34,34,0.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); let drawn = 0;
        pitches.slice(-60).forEach((p, i, arr) => {
          if (!p) return;
          const norm = mx > mn ? (p-mn)/(mx-mn) : 0.5;
          const x = 10 + (i/arr.length)*(W-20);
          const py = H - norm*(H-16) - 8;
          drawn === 0 ? ctx.moveTo(x,py) : ctx.lineTo(x,py); drawn++;
        });
        ctx.stroke();
      }
    }
    ctx.fillStyle = tmpl.color; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${expectedTone}声 ${tmpl.symbol} ${tmpl.en}`, 12, 14);
    if (result) {
      ctx.textAlign = 'right'; ctx.fillStyle = '#9a8e7a';
      ctx.fillText('- - - expected   —— yours', W-10, 14);
    }
  }, [expectedTone, result, pitches]);
  return (
    <canvas ref={canvasRef} width={400} height={90}
      style={{ width:'100%', borderRadius:8, display:'block', background:'#fdf6e3' }}/>
  );
}

// ── Category badge ─────────────────────────────────────────────────
function CategoryBadge({ set, lang }) {
  if (!set) return null;
  const label = lang === 'zh' ? set.name : lang === 'it' ? set.nameIt : set.nameEn;
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500,
      background: set.color || '#fdf6e3',
      border: `1.5px solid ${set.borderColor || '#8B4513'}`,
      color: set.borderColor || '#8B4513',
    }}>
      <span>{set.emoji}</span>
      <span>{label}</span>
    </div>
  );
}

// ── Difficulty dots ────────────────────────────────────────────────
function DifficultyDots({ level = 1 }) {
  return (
    <div style={{ display:'flex', gap:3 }}>
      {[1,2,3,4].map(i => (
        <div key={i} style={{
          width:6, height:6, borderRadius:'50%',
          background: i <= level ? '#8B4513' : 'var(--border)',
        }}/>
      ))}
    </div>
  );
}

// ── Main PracticeScreen ────────────────────────────────────────────
export default function PracticeScreen({ char, set, initialMode = 'free', onBack, onNext, onPracticed, onQuizComplete }) {
  const { lang } = useLang();
  const [selFont,   setSelFont]   = useState(0);
  const [penMode,   setPenMode]   = useState('soft');
  const [selBrush,  setSelBrush]  = useState(SOFT_BRUSHES[0]);
  const [inkColor,  setInkColor]  = useState(null);
  const [selScript, setSelScript] = useState(SCRIPT_STYLES[0]);

  // Sync font selector → script style (they are the same 4 styles)
  const handleFontChange = (i) => {
    setSelFont(i);
    if (SCRIPT_STYLES[i]) setSelScript(SCRIPT_STYLES[i]);
  };
  const { forceUniform } = useDeviceType();
  const [sizeScale, setSizeScale] = useState(1.0);
  const [mode,      setMode]      = useState(initialMode);
  // If user re-enters via the mode picker with a different mode, reflect that.
  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode]);
  const [showGuide, setShowGuide] = useState(true);
  const [strokeIdx, setStrokeIdx] = useState(0);
  const [totalStr,  setTotalStr]  = useState(0);
  const [isAnim,    setIsAnim]    = useState(false);
  const [qStroke,   setQStroke]   = useState(0);
  const [qFb,       setQFb]       = useState({ msg:'准备好了请开始描画第 1 笔', cls:'' });
  const [freeFb,    setFreeFb]    = useState('');
  const [scoreInfo, setScoreInfo] = useState(null);  // { score, coverage, precision, level } | null
  const [hintMode, setHintMode] = useState(() => localStorage.getItem('dictationHintMode') || 'both');
  useEffect(() => { localStorage.setItem('dictationHintMode', hintMode); }, [hintMode]);

  const { getHideStrokeCount, pickNextChar, getNextLearningChar } = useCharacterProgress();
  const gridRef = useRef(null), drawRef = useRef(null), hzRef = useRef(null);
  const writer  = useRef(null), dataCache = useRef({});
  const painting = useRef(false), last = useRef({ x:0, y:0, t:0, w:0, pressure:0.5 }), recorded = useRef(false);

  const { speak, speaking } = useTTS();
  const { start: startTone, stop: stopTone, recording: toneRecording, pitches, result: toneResult, error: toneError } = useToneAnalysis();
  const { tracingScore, pronounScore, combined, tracingAdvice, toneAdvice, recordTracing, recordPronunciation, reset: resetScore } = useScoring();
  const { data: charData } = useCharacter(char?.c);

  const charObj      = charData?.character || char;
  const pinyin       = charObj?.pinyin || char?.p || '';
  const meaningEn    = charObj?.meaning_en || char?.m || '';
  const meaningZh    = charObj?.meaning_zh || char?.mz || '';
  const meaningIt    = charObj?.meaning_it || char?.mi || '';
  const expectedTone = getToneFromPinyin(pinyin);

  // Find set data if not passed in
  const setData = set || SETS.find(s => s.chars?.some(c => c.c === char?.c));

  // Pick meaning by language
  const meaning = lang === 'zh' ? (meaningZh || meaningEn)
                : lang === 'it' ? (meaningIt || meaningEn)
                : meaningEn;

  useEffect(() => {
    if (toneResult?.score != null) recordPronunciation(toneResult.score);
  }, [toneResult, recordPronunciation]);

  // Auto-dismiss score card: show for 1.5s, then fade (CSS does the fade, we just null it)
  useEffect(() => {
    if (!scoreInfo) return;
    const timer = setTimeout(() => setScoreInfo(null), 1900);  // 1.5s visible + 400ms fade
    return () => clearTimeout(timer);
  }, [scoreInfo]);

  // Fix #1: When user switches calligraphy script, clear any lingering HanziWriter strokes.
  // The animation/quiz data is rendered in Kai only, so switching away means the strokes
  // no longer match what's shown and can create visual confusion.
  useEffect(() => {
    if (!writer.current || !char?.c) return;
    try { writer.current.setCharacter(char.c); } catch {}
    setStrokeIdx(0);
    setIsAnim(false);
  }, [selScript?.id, char?.c]);

  // ── Grid ──────────────────────────────────────────────────────────
  const drawGrid = useCallback(async () => {
    const canvas = gridRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    if (penMode === 'soft') drawMiziGrid(canvas, S);
    else drawTianziGrid(canvas, S);

    if (showGuide && char?.c) {
      const fontCss = selScript?.css || "'STKaiti','KaiTi',serif";
      const fontSize = 230;

      // Wait for font to be ready before drawing on canvas
      try {
        await document.fonts.load(`${fontSize}px ${fontCss}`);
      } catch(e) { /* fallback ok */ }

      ctx.save();
      ctx.font = `${fontSize}px ${fontCss}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = penMode==='soft' ? 'rgba(139,69,19,0.16)' : 'rgba(0,100,180,0.12)';
      ctx.fillText(char.c, S/2, S/2+6);
      ctx.restore();
    }
  }, [char?.c, selScript, showGuide, penMode]);
  useEffect(() => { drawGrid(); }, [drawGrid]);

  // ── HanziWriter ───────────────────────────────────────────────────
  useEffect(() => {
    // Also re-runs when `mode` changes — because the hzRef DOM element is
    // unmounted while in dictation/completion, and we need to re-mount the
    // HanziWriter instance when the user returns to free/quiz/speak.
    if (!hzRef.current || !char?.c) return;
    if (mode === 'dictation' || mode === 'completion') return;
    hzRef.current.innerHTML = '';
    setStrokeIdx(0); setTotalStr(0); setIsAnim(false); setQStroke(0);
    setQFb({ msg:'准备好了请开始描画第 1 笔', cls:'' });
    setFreeFb(''); setScoreInfo(null); recorded.current = false; resetScore();
    const w = HanziWriter.create(hzRef.current, char.c, {
      width:S, height:S, padding:20, showOutline:false, showCharacter:false,
      strokeColor:'#8B4513', highlightColor:'rgba(139,69,19,0.6)', drawingColor:'#1a0a05',
      strokeAnimationSpeed:0.75, delayBetweenStrokes:220,
      charDataLoader(c, onComplete) {
        if (dataCache.current[c]) { setTotalStr(dataCache.current[c].strokes.length); onComplete(dataCache.current[c]); return; }
        fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${c}.json`)
          .then(r=>r.json()).then(d=>{ dataCache.current[c]=d; setTotalStr(d.strokes.length); onComplete(d); }).catch(()=>{});
      },
    });
    writer.current = w;
    return () => { try { w.cancelQuiz(); } catch {} };
  }, [char?.c, mode]);

  // ── Canvas drawing ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = drawRef.current; if (!canvas) return;

    // ── Coordinate helper ────────────────────────────────────────
    // Uses pointer events (modern standard). One code path for mouse/touch/stylus.
    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const sx = S / r.width;
      const sy = S / r.height;
      return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    };

    const onStart = (e) => {
      if (mode !== 'free') return;
      e.preventDefault();
      // Capture pointer so moves outside canvas still register (prevents "jumping" strokes)
      try { canvas.setPointerCapture(e.pointerId); } catch {}
      painting.current = true;
      const p = getPos(e);
      last.current = { ...p, t: Date.now() };
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, selBrush.baseW * sizeScale * 0.38), 0, Math.PI * 2);
      ctx.fillStyle = inkColor || selBrush.color;
      ctx.fill();
    };

    const onMove = (e) => {
      if (!painting.current || mode !== 'free') return;
      e.preventDefault();
      const p = getPos(e);
      const now = Date.now();
      const dx = p.x - last.current.x;
      const dy = p.y - last.current.y;
      const speed = Math.sqrt(dx * dx + dy * dy) / Math.max(now - last.current.t, 1);
      drawBrushStroke(canvas.getContext('2d'), selBrush, last.current, p, speed, sizeScale, inkColor, penMode === 'hard' && forceUniform);
      last.current = { ...p, t: now };
    };

    const onEnd = (e) => {
      if (!painting.current) return;
      painting.current = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}

      // ── Calculate score: rasterize character to compare against user ink ──
      const info = computeScore(canvas, char?.c, selScript?.css);
      if (info && info.userPixels > 200) {
        setScoreInfo(info);

        // Self-adaptive Level 2: record this attempt (char + score)
        if (char?.c) recordCharacterProgress(char.c, info.score);

        if (!recorded.current && info.score >= 30) {
          recorded.current = true;
          onPracticed?.(char?.c);
        }
        setFreeFb('');
      } else {
        if (info && info.userPixels > 50) {
          setFreeFb(lang === 'zh' ? '○ 继续补全笔画' : lang === 'it' ? '○ Continua...' : '○ Keep going...');
        }
      }
    };

    // ── Pointer events (one API for mouse + touch + stylus) ──
    canvas.addEventListener('pointerdown', onStart);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onEnd);
    canvas.addEventListener('pointercancel', onEnd);
    canvas.addEventListener('pointerleave', onEnd);

    return () => {
      canvas.removeEventListener('pointerdown', onStart);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onEnd);
      canvas.removeEventListener('pointercancel', onEnd);
      canvas.removeEventListener('pointerleave', onEnd);
    };
  }, [char?.c, selBrush, sizeScale, mode, onPracticed, inkColor, lang]);

  const clearDraw = () => { drawRef.current?.getContext('2d')?.clearRect(0,0,S,S); setFreeFb(''); setScoreInfo(null); resetScore(); };

  // Resets HanziWriter display — clears rendered strokes without destroying dots state
  const resetStr = () => { if(!writer.current)return; setIsAnim(false); setStrokeIdx(0); writer.current.setCharacter(char?.c); };

  const animAll  = () => {
    if (isAnim || !writer.current) return;
    clearDraw();
    setStrokeIdx(0);
    setIsAnim(true);
    writer.current.animateCharacter({
      onComplete: () => {
        setStrokeIdx(totalStr);
        setIsAnim(false);
        // Auto-clear strokes after a brief pause so they don't linger
        setTimeout(() => {
          try { writer.current?.setCharacter(char?.c); } catch {}
          setStrokeIdx(0);
        }, 1200);
      },
    });
  };

  const stepOne  = () => {
    if (isAnim || strokeIdx >= totalStr || !writer.current) return;
    const s = strokeIdx;
    setIsAnim(true);
    writer.current.animateStroke(s, {
      onComplete: () => {
        setStrokeIdx(s + 1);
        setIsAnim(false);
      },
    });
  };

  const startQuiz = useCallback(() => {
    if (!writer.current) return;
    setQStroke(0); setQFb({msg:'准备好了请开始描画第 1 笔',cls:''});
    writer.current.setCharacter(char?.c).then(()=>{
      writer.current.quiz({
        showHintAfterMisses:1, highlightOnComplete:true,
        onMistake(sd){ const el=document.getElementById('qfb-el'); if(el){el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');} setQFb({msg:`✗ 第 ${sd.strokeNum+1} 笔画错了，看提示重画`,cls:'err'}); },
        onCorrectStroke(sd){ const next=sd.strokeNum+1; const left=(dataCache.current[char?.c]?.strokes.length||0)-next; setQStroke(next); setQFb({msg:left>0?`✓ 第 ${next} 笔正确！继续`:`✓ 第 ${next} 笔正确！`,cls:'ok'}); },
        onComplete(summary){ 
          const total=dataCache.current[char?.c]?.strokes.length||0; 
          setQStroke(total); 
          recordTracing(summary.totalMistakes,total,char?.c,lang); 
          setQFb({msg:summary.totalMistakes===0?'🎉 完美！':`完成！共 ${summary.totalMistakes} 次提示`,cls:'done'}); 
          onQuizComplete?.(char?.c,summary.totalMistakes);
          // Log to personal stats
          const sc = Math.max(0, Math.round(100 - (summary.totalMistakes / Math.max(total,1)) * 50));
          logPractice({ character:char?.c, mistakes:summary.totalMistakes, totalStrokes:total, score:sc });
        },
      });
    });
  }, [char?.c, recordTracing, onQuizComplete]);

  const switchMode = (m) => { setMode(m); clearDraw(); if(m==='quiz') startQuiz(); else { try{writer.current?.cancelQuiz();}catch{} resetStr(); } };
  const makeDots = (filled,total,cur) => Array.from({length:total},(_,i)=><div key={i} className={`dot${i<filled?' done':(i===cur&&cur?' cur':'')}`}/>);

  const tmpl = TONE_TEMPLATES[expectedTone];

  // ── Labels ────────────────────────────────────────────────────────
  const label = {
    calligStyle:  lang==='zh'?'书法字体': lang==='it'?'Stile calligrafico':'Calligraphy style',
    trace:        lang==='zh'?'临摹': lang==='it'?'Traccia':'Trace',
    stroke:       lang==='zh'?'笔顺': lang==='it'?'Tratti':'Strokes',
    pronounce:    lang==='zh'?'朗读': lang==='it'?'Pronuncia':'Speak',
    clear:        lang==='zh'?'清空': lang==='it'?'Cancella':'Clear',
    show:         lang==='zh'?'显示': lang==='it'?'Mostra':'Show',
    hide:         lang==='zh'?'隐藏': lang==='it'?'Nascondi':'Hide',
    guide:        lang==='zh'?'笔画': lang==='it'?'guida':'guide',
    next:         lang==='zh'?'下一个': lang==='it'?'Prossimo':'Next',
    strokeCount:  lang==='zh'?`共 ${totalStr} 笔`: lang==='it'?`${totalStr} tratti`:`${totalStr} strokes`,
    compound:     lang==='zh'?'组合': lang==='it'?'Composto':'Compound',
  };

  return (
    <div className="practice-wrap">

      {/* Keyframes for score card fade animation */}
      <style>{`
        @keyframes scoreFadeInOut {
          0%   { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.92); }
          15%  { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          75%  { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.96); }
        }
      `}</style>

      {/* ── Category frame header ───────────────────────────────── */}
      {setData && (
        <div style={{
          width:'100%', maxWidth:320, margin:'0 auto 8px',
          background: setData.color || '#fdf6e3',
          border: `2px solid ${setData.borderColor || '#8B4513'}`,
          borderRadius:14, padding:'10px 14px',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:22 }}>{setData.emoji}</span>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color: setData.borderColor || '#8B4513' }}>
                  {lang==='zh' ? setData.name : lang==='it' ? setData.nameIt : setData.nameEn}
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)', marginTop:1 }}>
                  {lang==='zh' ? setData.description : lang==='it' ? setData.descriptionIt : setData.description}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
              <DifficultyDots level={char?.difficulty || 1}/>
              {char?.compound && mode !== 'dictation' && mode !== 'completion' && (
                <div style={{ fontSize:10, color:'var(--text-3)', background:'rgba(0,0,0,0.06)', padding:'2px 7px', borderRadius:10 }}>
                  {label.compound}: {char.compound}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────── */}
      {/* In dictation/completion modes, replace 大字 with ？ and suppress  */}
      {/* the TTS button (which would speak the answer). Dictation further */}
      {/* hides pinyin/meaning because DictationMode has its own hint banner */}
      {/* driven by the user's hintMode setting. */}
      {(() => {
        const hideAnswer = mode === 'dictation' || mode === 'completion';
        const hideSideHints = mode === 'dictation';
        return (
      <div style={{display:'flex',alignItems:'center',gap:10,width:'100%',maxWidth:320}}>
        <button className="back-btn" onClick={onBack}>‹</button>
        <div style={{display:'flex',alignItems:'center',gap:12,flex:1}}>
          <div className="char-big" style={{fontFamily:selScript?.css, color: hideAnswer ? '#C8A050' : undefined}}>
            {hideAnswer ? '？' : char?.c}
          </div>
          <div className="char-meta">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {!hideSideHints && <div className="char-py">{pinyin}</div>}
              {!hideSideHints && expectedTone > 0 && tmpl && (
                <span style={{fontSize:11,padding:'1px 7px',borderRadius:20,background:tmpl.color+'22',color:tmpl.color,fontWeight:500}}>
                  {expectedTone}声 {tmpl.symbol}
                </span>
              )}
              {!hideAnswer && (
                <button onClick={()=>speak(`${char?.c}，${pinyin}，${meaning}`)}
                  style={{width:32,height:32,borderRadius:'50%',border:`1px solid ${V.border}`,
                    background:speaking?'#e3f2fd':V.parchment,cursor:'pointer',fontSize:14,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    WebkitTapHighlightColor:'transparent'}}>
                  {speaking?'🔊':'🔈'}
                </button>
              )}
            </div>
            {!hideSideHints && <div className="char-mn">{meaning}</div>}
          </div>
        </div>

      </div>
        );
      })()}

      {/* ── Dictation mode (6A) ─────────────────────────────────────── */}
      {mode === 'dictation' && (
        <DictationMode
          char={char}
          nextChar={() => { clearDraw(); const pick = getNextLearningChar?.(char?.c, setData?.chars || []); onNext?.(pick?.char || char); }}
          hintMode={hintMode}
          lang={lang}
          onScore={(c, s) => recordCharacterProgress(c, s)}
          onClose={() => setMode('free')}
          selBrush={selBrush}
          selScript={selScript}
          sizeScale={sizeScale}
          inkColor={inkColor}
          penMode={penMode}
          forceUniform={forceUniform}
        />
      )}

      {/* ── Completion mode (6B) ────────────────────────────────────── */}
      {mode === 'completion' && (
        <CompletionMode
          char={char}
          nextChar={() => { clearDraw(); const pick = getNextLearningChar?.(char?.c, setData?.chars || []); onNext?.(pick?.char || char); }}
          hideCount={getHideStrokeCount?.(char?.c) || 1}
          lang={lang}
          onScore={(c, s) => recordCharacterProgress(c, s)}
          onClose={() => setMode('free')}
          selBrush={selBrush}
          selScript={selScript}
          sizeScale={sizeScale}
          inkColor={inkColor}
          penMode={penMode}
          forceUniform={forceUniform}
        />
      )}

      {/* ── Canvas + overlay controls ─────────────────────────────── */}
      {mode !== 'dictation' && mode !== 'completion' && (
      <div style={{position:'relative',width:'100%',maxWidth:320,margin:'0 auto'}}>
        {/* Grid canvas */}
        <div className="canvas-wrap">
          <canvas ref={gridRef} width={S} height={S} style={{zIndex:1}}/>
          <div ref={hzRef} className={`hz-layer ${mode==='quiz'?'quiz-active':''}`}
            style={{touchAction:'none', userSelect:'none'}}/>
          <canvas ref={drawRef} className="draw-canvas" width={S} height={S}
            style={{zIndex:3,touchAction:'none',cursor:mode==='free'?'crosshair':'default',pointerEvents:mode==='free'?'all':'none'}}/>
        </div>

        {/* ↺ clear — bottom left corner */}
        {mode==='free' && (
          <button onClick={clearDraw}
            style={{position:'absolute',bottom:8,left:8,width:34,height:34,borderRadius:'50%',
              border:'1px solid rgba(139,69,19,0.3)',background:'rgba(253,246,227,0.9)',
              cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',
              color:'#8B4513',zIndex:10,backdropFilter:'blur(4px)'}}>
            ↺
          </button>
        )}
        {mode==='quiz' && (
          <button onClick={()=>{try{writer.current?.cancelQuiz();}catch{}startQuiz();}}
            style={{position:'absolute',bottom:8,left:8,width:34,height:34,borderRadius:'50%',
              border:'1px solid rgba(139,69,19,0.3)',background:'rgba(253,246,227,0.9)',
              cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',
              color:'#8B4513',zIndex:10}}>
            ↺
          </button>
        )}

        {/* → next — adaptive picker (weak chars first, then unpracticed, then sequence) */}
        <button
          onClick={() => {
            clearDraw();
            const pool = setData?.chars || [];
            const pick = getNextLearningChar?.(char?.c, pool);
            // Pass the char object if we got one; fall back to current for App.jsx's
            // legacy sequential handler.
            onNext?.(pick?.char || char);
          }}
          title={(() => {
            const pool = setData?.chars || [];
            const pick = getNextLearningChar?.(char?.c, pool);
            const reason = pick?.reason;
            const next = pick?.char?.c;
            if (!reason || !next) return '→';
            const label = lang === 'zh'
              ? ({ weak:`薄弱字 ${next}`, new:`新字 ${next}`, sequence:`下一个 ${next}`, wrap:`从头 ${next}` })[reason]
              : ({ weak:`Weak: ${next}`, new:`New: ${next}`, sequence:`Next: ${next}`, wrap:`Wrap: ${next}` })[reason];
            return `✨ ${label}`;
          })()}
          style={{position:'absolute',bottom:8,right:8,width:34,height:34,borderRadius:'50%',
            border:'1px solid rgba(139,69,19,0.3)',background:'rgba(253,246,227,0.9)',
            cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',
            color:'#8B4513',zIndex:10,backdropFilter:'blur(4px)'}}>
          →
          <span style={{position:'absolute',top:-2,right:-2,fontSize:9,lineHeight:1}}>✨</span>
        </button>

        {/* Guide toggle — top right */}
        <button onClick={()=>setShowGuide(g=>!g)}
          style={{position:'absolute',top:8,right:8,padding:'3px 8px',borderRadius:20,
            border:'1px solid rgba(139,69,19,0.3)',background:'rgba(253,246,227,0.85)',
            cursor:'pointer',fontSize:10,color:'#8B4513',zIndex:10}}>
          {showGuide?'隐':'示'}
        </button>

        {/* Stroke progress dots — top left */}
        {totalStr>0 && (
          <div style={{position:'absolute',top:8,left:8,display:'flex',gap:2,zIndex:10,flexWrap:'wrap',maxWidth:120}}>
            {makeDots(mode==='quiz'?qStroke:strokeIdx, totalStr, isAnim)}
          </div>
        )}

        {/* Feedback overlay */}
        {freeFb && mode==='free' && !scoreInfo && (
          <div style={{position:'absolute',bottom:52,left:'50%',transform:'translateX(-50%)',
            padding:'4px 12px',borderRadius:20,background:'rgba(46,125,50,0.9)',
            color:'white',fontSize:12,zIndex:10,whiteSpace:'nowrap'}}>
            {freeFb}
          </div>
        )}

        {/* Score card — shown after user lifts pen in free mode */}
        {scoreInfo && mode==='free' && (() => {
          const c = scoreInfo.level==='great' ? '#2E7D32'
                  : scoreInfo.level==='good'  ? '#558B2F'
                  : scoreInfo.level==='fair'  ? '#E65100'
                  :                             '#C62828';
          const encourage = lang==='zh'
            ? (scoreInfo.level==='great' ? '✨ 很棒！'
             : scoreInfo.level==='good'  ? '👍 不错'
             : scoreInfo.level==='fair'  ? '加油' : '再练练')
            : lang==='it'
            ? (scoreInfo.level==='great' ? 'Ottimo!'
             : scoreInfo.level==='good'  ? 'Bene'
             : scoreInfo.level==='fair'  ? 'Continua' : 'Riprova')
            : (scoreInfo.level==='great' ? 'Great!'
             : scoreInfo.level==='good'  ? 'Nice'
             : scoreInfo.level==='fair'  ? 'Keep going' : 'Try again');
          return (
            <div style={{
              position:'absolute',
              bottom:10,                               // closer to bottom edge, not over character center
              left:'50%',
              transform:'translateX(-50%)',
              padding:'5px 12px',
              borderRadius:16,
              background:'rgba(253,246,227,0.97)',
              border:`1.5px solid ${c}`,
              color:c,
              fontSize:12,
              zIndex:10,
              display:'flex',
              gap:10,
              alignItems:'center',
              boxShadow:'0 2px 10px rgba(0,0,0,0.12)',
              // Fade in+out animation
              animation:'scoreFadeInOut 1.9s ease-out forwards',
              pointerEvents:'none',                     // click-through so user can keep drawing
            }}>
              <span style={{fontSize:20,fontWeight:700}}>{scoreInfo.score}</span>
              <span style={{fontSize:11,opacity:0.8}}>
                {lang==='zh' ? `覆盖 ${Math.round(scoreInfo.coverage*100)}% · 精准 ${Math.round(scoreInfo.precision*100)}%`
                 : lang==='it' ? `Copertura ${Math.round(scoreInfo.coverage*100)}% · Precisione ${Math.round(scoreInfo.precision*100)}%`
                 : `Cover ${Math.round(scoreInfo.coverage*100)}% · Precision ${Math.round(scoreInfo.precision*100)}%`}
              </span>
              <span style={{fontSize:11,fontWeight:600}}>{encourage}</span>
            </div>
          );
        })()}

        {mode==='quiz' && qFb.msg && (
          <div style={{position:'absolute',bottom:52,left:'50%',transform:'translateX(-50%)',
            padding:'4px 12px',borderRadius:20,
            background:qFb.cls==='ok'?'rgba(46,125,50,0.9)':qFb.cls==='err'?'rgba(192,57,43,0.9)':qFb.cls==='done'?'rgba(139,69,19,0.9)':'rgba(100,100,100,0.8)',
            color:'white',fontSize:11,zIndex:10,maxWidth:280,textAlign:'center',whiteSpace:'normal'}}>
            {qFb.msg}
          </div>
        )}
      </div>
      )}

      {/* ── Mode toggle + stroke buttons + settings ─────────────────── */}
      <div style={{width:'100%',maxWidth:320,margin:'0 auto',display:'flex',gap:6,alignItems:'center'}}>
        <div style={{display:'flex',border:'0.5px solid var(--border)',borderRadius:20,overflow:'hidden',flex:1}}>
          {[['free','✏'],['speak','🎤']].map(([m,icon])=>(
            <button key={m} onClick={()=>switchMode(m)}
              style={{flex:1,padding:'7px 4px',fontSize:12,cursor:'pointer',border:'none',
                fontFamily:'inherit',background:mode===m?'#8B4513':'var(--card)',
                color:mode===m?'#fdf6e3':'var(--text-2)'}}>
              {icon}
            </button>
          ))}
        </div>
        {mode==='free' && selScript?.id === 'kai' && (<>
          <button disabled={isAnim||totalStr===0} onClick={animAll}
            style={{padding:'7px 12px',fontSize:12,cursor:'pointer',borderRadius:20,
              border:'0.5px solid var(--border)',background:'var(--card)',color:'var(--text-2)'}}>
            ▶
          </button>
          <button disabled={isAnim||strokeIdx>=totalStr} onClick={stepOne}
            style={{padding:'7px 12px',fontSize:12,cursor:'pointer',borderRadius:20,
              border:'0.5px solid var(--border)',background:'var(--card)',color:'var(--text-2)'}}>
            +1
          </button>
        </>)}
        {/* ⚙ Brush & Font settings */}
        <SettingsDrawer
          penMode={penMode}   onPenMode={setPenMode}
          selBrush={selBrush} onBrush={setSelBrush}
          inkColor={inkColor} onInkColor={setInkColor}
          selScript={selScript} onScript={setSelScript}
          sizeScale={sizeScale} onSize={setSizeScale}
          lang={lang}
          hintMode={hintMode} onHintMode={setHintMode}
        />
      </div>

      {/* Tracing advice */}
      {tracingAdvice && mode==='quiz' && (
        <div style={{width:'100%',maxWidth:320,margin:'0 auto',padding:'8px 12px',
          borderRadius:10,border:`1px solid ${tracingAdvice.color}44`,
          background:tracingAdvice.color+'11',fontSize:12,color:tracingAdvice.color,
          display:'flex',alignItems:'center',gap:8}}>
          <span>{tracingAdvice.emoji}</span>
          <span>{tracingAdvice.msg}</span>
        </div>
      )}

      {/* ── Speak mode ──────────────────────────────────────────────── */}
      {mode==='speak'&&(
        <div style={{width:'100%',maxWidth:320,margin:'0 auto'}}>
          <div style={{background:V.parchment,border:`1px solid ${V.border}`,borderRadius:12,padding:'16px'}}>
            <div style={{textAlign:'center',marginBottom:12}}>
              <div style={{fontSize:52,fontFamily:"'STKaiti','KaiTi',serif",color:V.text,lineHeight:1}}>{char?.c}</div>
              <div style={{fontSize:18,color:V.text2,margin:'4px 0'}}>{pinyin}</div>
              {expectedTone > 0 && tmpl && (
                <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,background:tmpl.color+'18',border:`1px solid ${tmpl.color}44`,marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:500,color:tmpl.color}}>{expectedTone}声 {tmpl.symbol}</span>
                  <span style={{fontSize:12,color:V.text3}}>{tmpl.label} · {tmpl.en}</span>
                </div>
              )}
            </div>
            <div style={{marginBottom:12}}>
              <TonePitchGraph expectedTone={expectedTone} result={toneResult} pitches={pitches}/>
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'center',marginBottom:12}}>
              <button onClick={()=>speak(char?.c)}
                style={{padding:'10px 18px',fontSize:13,cursor:'pointer',borderRadius:20,
                  border:`1px solid ${V.border}`,background:V.card,color:V.text2,
                  fontFamily:'inherit',WebkitTapHighlightColor:'transparent',
                  minWidth:80,minHeight:44}}>
                🔈 {lang==='zh'?'示范':lang==='it'?'Demo':'Demo'}
              </button>
              <button
                onClick={toneRecording ? ()=>stopTone(pinyin, expectedTone) : ()=>startTone(pinyin)}
                style={{width:64,height:64,borderRadius:'50%',border:'none',background:toneRecording?'#c0392b':'#8B4513',color:'#fdf6e3',fontSize:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:toneRecording?'0 0 0 8px rgba(192,57,43,0.2)':'none',transition:'all 0.2s',fontFamily:'inherit'}}>
                {toneRecording?'⏹':'🎤'}
              </button>
            </div>
            <div style={{textAlign:'center',fontSize:12,color:V.text3,marginBottom:10}}>
              {toneRecording
                ? (lang==='zh'?'正在分析声调…':lang==='it'?'Analisi in corso…':'Analysing tone…')
                : toneResult
                  ? (lang==='zh'?'分析完成':lang==='it'?'Analisi completa':'Analysis complete')
                  : (lang==='zh'?'点击 🎤 开始朗读':lang==='it'?'Premi 🎤 per parlare':'Tap 🎤 to speak')}
            </div>
            {toneResult && (
              <div style={{padding:'10px 14px',background:toneResult.match?'#e8f5e9':'#fff3e0',borderRadius:10,border:`1px solid ${toneResult.match?'#2E7D32':'#E65100'}44`,textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:600,color:toneResult.match?'#2E7D32':'#E65100',marginBottom:4}}>
                  {toneResult.score}{lang==='zh'?'分':lang==='it'?' pt':' pt'} {toneResult.match ? '✓' : '✗'}
                </div>
                <div style={{fontSize:12,color:V.text3}}>
                  {toneResult.match
                    ? (lang==='zh'?`${expectedTone}声正确！`:lang==='it'?'Tono corretto!':'Correct tone!')
                    : (lang==='zh'?`检测到${toneResult.detectedTone}声，应为${expectedTone}声`
                      :lang==='it'?`Tono ${toneResult.detectedTone} rilevato, atteso ${expectedTone}`
                      :`Detected tone ${toneResult.detectedTone}, expected tone ${expectedTone}`)}
                </div>
                {toneResult.allScores && (
                  <div style={{display:'flex',gap:6,justifyContent:'center',marginTop:8}}>
                    {toneResult.allScores.map(({tone, score}) => {
                      const t = TONE_TEMPLATES[tone];
                      return (
                        <div key={tone} style={{textAlign:'center',padding:'4px 8px',borderRadius:8,background:tone===expectedTone?t.color+'22':'transparent',border:`1px solid ${t.color}44`}}>
                          <div style={{fontSize:11,fontWeight:500,color:t.color}}>{tone}声 {t.symbol}</div>
                          <div style={{fontSize:13,fontWeight:tone===toneResult.detectedTone?600:400,color:V.text}}>{score}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {toneError && (
              <div style={{padding:'8px 12px',background:'#FFEBEE',borderRadius:8,fontSize:12,color:'#c0392b',marginTop:8}}>
                {toneError}
              </div>
            )}
            <div style={{marginTop:10,fontSize:11,color:V.text3,textAlign:'center',lineHeight:1.5}}>
              Chrome / Edge only · {lang==='zh'?'需要麦克风权限':lang==='it'?'Richiede microfono':'Requires microphone'}
            </div>
          </div>
        </div>
      )}

      {/* ── Score ───────────────────────────────────────────────────── */}
      {combined!==null&&(
        <div style={{width:'100%',maxWidth:320,margin:'0 auto',background:V.parchment,border:`1px solid ${V.border}`,borderRadius:12,padding:'12px 14px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,textAlign:'center'}}>
          {[
            {label:lang==='zh'?'笔顺':lang==='it'?'Tratti':'Tracing', score:tracingScore, sub:''},
            {label:lang==='zh'?'声调':lang==='it'?'Tono':'Tone',      score:pronounScore, sub:''},
            {label:lang==='zh'?'综合':lang==='it'?'Totale':'Total',    score:combined,     sub:''},
          ].filter(x=>x.score!==null).map(({label,score})=>(
            <div key={label}>
              <div style={{fontSize:24,fontWeight:600,color:score>=80?'#2E7D32':score>=50?'#E65100':'#c0392b'}}>{score}</div>
              <div style={{fontSize:11,color:V.text2}}>{label}</div>
              <div style={{fontSize:12,color:score>=80?'#2E7D32':score>=50?'#E65100':'#c0392b'}}>{scoreLabel(score)}</div>
            </div>
          ))}
        </div>
      )}

      {mode !== 'dictation' && mode !== 'completion' && (
        <MnemonicCard character={charObj} lang={lang}/>
      )}
    </div>
  );
}
