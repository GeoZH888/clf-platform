// src/pinyin/TonePractice.jsx
// 四声练习 — with LearningNav prev / refresh / next
import { useState } from 'react';
import TtsButton from '../components/TtsButton';
import LearningNav from '../components/LearningNav';

// ── Tone data ─────────────────────────────────────────────────────────────────
const TONES = [
  {
    index: 0,
    name: '阴平', nameEn: '1st Tone', nameIt: '1° tono',
    mark: 'ā', color: '#1565C0',
    contour: [1, 1, 1, 1, 1],          // high level
    desc: '高平调，像唱歌', descEn: 'High level — like singing', descIt: 'Tono alto e piatto',
    arrowPath: 'M 30 44 L 170 44',     // flat arrow →
    arrowDash: '',
  },
  {
    index: 1,
    name: '阳平', nameEn: '2nd Tone', nameIt: '2° tono',
    mark: 'á', color: '#E65100',
    contour: [0.3, 0.5, 0.7, 0.85, 1],   // rising
    desc: '中升调，像提问', descEn: 'Rising — like asking a question', descIt: 'Tono ascendente',
    arrowPath: 'M 30 65 Q 100 45 170 22',
    arrowDash: '',
  },
  {
    index: 2,
    name: '上声', nameEn: '3rd Tone', nameIt: '3° tono',
    mark: 'ǎ', color: '#2E7D32',
    contour: [0.6, 0.3, 0.15, 0.35, 0.75], // dipping
    desc: '降升调，先降后升', descEn: 'Dip — falls then rises', descIt: 'Tono a U',
    arrowPath: 'M 30 26 Q 80 75 100 80 Q 140 82 170 38',
    arrowDash: '',
  },
  {
    index: 3,
    name: '去声', nameEn: '4th Tone', nameIt: '4° tono',
    mark: 'à', color: '#C62828',
    contour: [1, 0.75, 0.5, 0.25, 0.05],  // falling
    desc: '全降调，像命令', descEn: 'Falling — like a command', descIt: 'Tono discendente',
    arrowPath: 'M 30 22 Q 100 50 170 72',
    arrowDash: '',
  },
  {
    index: 4,
    name: '轻声', nameEn: 'Neutral', nameIt: 'Neutro',
    mark: 'a', color: '#546E7A',
    contour: [0.4, 0.4, 0.4, 0.4, 0.4],  // short neutral
    desc: '轻短调，无固定音高', descEn: 'Light and short — no fixed pitch', descIt: 'Leggero e breve',
    arrowPath: 'M 65 48 L 115 48',
    arrowDash: '6,5',
  },
];

// Example words for each tone (one per tone, using mā/má/mǎ/mà/ma)
const EXAMPLES = [
  { zh: '妈', py: 'mā', en: 'mother', it: 'madre' },
  { zh: '麻', py: 'má', en: 'hemp / numb', it: 'canapa' },
  { zh: '马', py: 'mǎ', en: 'horse', it: 'cavallo' },
  { zh: '骂', py: 'mà', en: 'scold', it: 'sgridare' },
  { zh: '吗', py: 'ma', en: 'question particle', it: 'particella interrogativa' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tone contour SVG
// ─────────────────────────────────────────────────────────────────────────────
function ToneContour({ tone }) {
  const W = 200, H = 96;
  const pts = tone.contour.map((y, i) => {
    const x = 20 + (i / 4) * (W - 40);
    const py = H - 12 - y * (H - 28);
    return [x, py];
  });
  const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 260, display: 'block' }}>
      {/* Guide lines */}
      {[0.25, 0.5, 0.75].map(frac => {
        const y = H - 12 - frac * (H - 28);
        return (
          <line key={frac} x1={14} y1={y} x2={W - 14} y2={y}
            stroke="#E0E0E0" strokeWidth="1" strokeDasharray="4,4" />
        );
      })}
      {/* Level labels */}
      {[{ label: '5', frac: 1 }, { label: '3', frac: 0.5 }, { label: '1', frac: 0 }].map(({ label, frac }) => (
        <text key={label} x={8} y={H - 12 - frac * (H - 28) + 4}
          fontSize="9" fill="#BDBDBD" textAnchor="middle" fontFamily="sans-serif">
          {label}
        </text>
      ))}
      {/* Tone curve */}
      <polyline points={polyline}
        fill="none" stroke={tone.color} strokeWidth="3.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots on curve */}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill={tone.color} />
      ))}
      {/* Arrow head at last point */}
      {(() => {
        const [x2, y2] = pts[pts.length - 1];
        const [x1, y1] = pts[pts.length - 2];
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return (
          <polygon
            points={`0,-5 10,0 0,5`}
            transform={`translate(${x2},${y2}) rotate(${angle})`}
            fill={tone.color}
          />
        );
      })()}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export default function TonePractice({ onBack, lang = 'zh' }) {
  const [selected, setSelected] = useState(0);
  const tone = TONES[selected];
  const example = EXAMPLES[selected];
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? it : en;

  function goPrev() { if (selected > 0) setSelected(s => s - 1); }
  function goNext() { if (selected < TONES.length - 1) setSelected(s => s + 1); }
  function goReset() { setSelected(0); }

  return (
    <div style={{ background: 'var(--bg, #F5F5F5)', minHeight: '100dvh', paddingBottom: 80 }}>

      {/* ── Header ── */}
      <div style={{
        background: '#2E7D32', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{
          border: 'none', background: 'none', fontSize: 24,
          color: '#fff', cursor: 'pointer', lineHeight: 1,
        }}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
          {t('四声练习', 'Tone Practice', 'Pratica dei Toni')}
        </div>
      </div>

      {/* ── Tone chip selector ── */}
      <div style={{ display: 'flex', gap: 6, padding: '14px 16px 0' }}>
        {TONES.map((tn, i) => (
          <button key={i} onClick={() => setSelected(i)} style={{
            flex: 1, padding: '9px 2px', borderRadius: 12, cursor: 'pointer',
            border: `2px solid ${selected === i ? tn.color : '#E0E0E0'}`,
            background: selected === i ? tn.color : '#fff',
            color: selected === i ? '#fff' : tn.color,
            fontWeight: selected === i ? 700 : 500,
            fontSize: 15, transition: 'all 0.18s',
            WebkitTapHighlightColor: 'transparent',
          }}>
            {tn.mark}
          </button>
        ))}
      </div>

      {/* ── Main card ── */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{
          background: '#fff', borderRadius: 18,
          border: `2px solid ${tone.color}33`,
          boxShadow: `0 4px 20px ${tone.color}18`,
          padding: '18px 16px',
        }}>

          {/* Tone name */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: tone.color }}>
              {lang === 'zh' ? tone.name : lang === 'it' ? tone.nameIt : tone.nameEn}
            </div>
            <div style={{ fontSize: 11, color: '#90A4AE', marginTop: 2 }}>
              {lang === 'zh' ? `第${selected + 1}声` : `Tone ${selected + 1} / 5`}
            </div>
          </div>

          {/* Contour diagram */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <ToneContour tone={tone} />
          </div>

          {/* Description */}
          <div style={{
            textAlign: 'center', fontSize: 14, color: '#546E7A',
            padding: '6px 8px', background: tone.color + '0D',
            borderRadius: 10,
          }}>
            {lang === 'zh' ? tone.desc : lang === 'it' ? tone.descIt : tone.descEn}
          </div>
        </div>
      </div>

      {/* ── Example card ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{
          background: '#fff', borderRadius: 18,
          border: '1px solid #E0E0E0',
          padding: '18px 16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: '#90A4AE', marginBottom: 8 }}>
            {t('例子', 'Example', 'Esempio')}
          </div>

          <div style={{ fontSize: 56, fontWeight: 300, color: '#212121', lineHeight: 1.1 }}>
            {example.zh}
          </div>
          <div style={{ fontSize: 22, color: tone.color, fontWeight: 600, marginTop: 6 }}>
            {example.py}
          </div>
          <div style={{ fontSize: 14, color: '#78909C', marginTop: 4 }}>
            {lang === 'zh' ? '' : lang === 'it' ? example.it : example.en}
          </div>

          {/* TTS — sends CHINESE CHARACTER only, no English audio */}
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
            <TtsButton text={example.zh} lang="zh-TW"
              label={t('听发音', 'Listen', 'Ascolta')}
              color={tone.color} size="large" />
          </div>
        </div>
      </div>

      {/* ── All 4 tone contrast strip ── */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ fontSize: 11, color: '#90A4AE', marginBottom: 8, textAlign: 'center' }}>
          {t('四声对比', 'All Tones', 'Confronto toni')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setSelected(i)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 12,
              border: `2px solid ${selected === i ? TONES[i].color : '#E0E0E0'}`,
              background: selected === i ? TONES[i].color + '14' : '#fff',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              {/* small speaker icon */}
              <span style={{ fontSize: 14 }}>🔊</span>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: selected === i ? TONES[i].color : '#546E7A',
              }}>{ex.py}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Navigation ── */}
      <div style={{ padding: '8px 16px 16px' }}>
        <LearningNav
          onPrev={selected > 0 ? goPrev : null}
          onRefresh={goReset}
          onNext={selected < TONES.length - 1 ? goNext : null}
          label={`${selected + 1} / ${TONES.length}`}
          color={tone.color}
        />
      </div>
    </div>
  );
}
