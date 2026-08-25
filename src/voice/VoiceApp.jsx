// src/voice/VoiceApp.jsx
//
// 语音评测 — say a phrase, see which character was wrong.
//
// The point of this screen is the per-character verdict. A single overall
// number ("72%") tells a learner nothing they can act on; being told that the
// third character was the problem, and what was heard instead, is a correction
// they can actually make on the next attempt.

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';
import { usePhone } from '../hooks/useMediaQuery';
import { usePronunciationAssessment, weakest } from '../hooks/usePronunciationAssessment.js';
import { recordLearning } from '../lib/learningLog.js';

const P = {
  bg:     'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
  accent: '#0f766e',
  soft:   '#5eead4',
  tint:   '#ccfbf1',
  ink:    '#1a0a05', ink2: '#6b4c2a', ink3: '#a07850',
};

// Used until phrases come from the database. Deliberately short: assessment is
// most useful on something a learner can hold in their head and repeat.
const FALLBACK_PHRASES = [
  { text: '你好',           pinyin: 'nǐ hǎo',            en: 'Hello' },
  { text: '谢谢你',         pinyin: 'xiè xie nǐ',        en: 'Thank you' },
  { text: '我想买苹果',     pinyin: 'wǒ xiǎng mǎi píngguǒ', en: 'I want to buy apples' },
  { text: '今天天气很好',   pinyin: 'jīntiān tiānqì hěn hǎo', en: 'The weather is nice today' },
  { text: '妈妈骑马',       pinyin: 'māma qí mǎ',        en: 'Mother rides a horse' },
];

const STR = {
  title:   { zh:'语音评测', en:'Pronunciation', it:'Pronuncia' },
  record:  { zh:'🎤 开始朗读', en:'🎤 Read aloud', it:'🎤 Leggi' },
  again:   { zh:'🎤 再试一次', en:'🎤 Try again', it:'🎤 Riprova' },
  listening:{ zh:'聆听中…', en:'Listening…', it:'In ascolto…' },
  next:    { zh:'换一句', en:'Next phrase', it:'Prossima' },
  heard:   { zh:'听到', en:'Heard', it:'Sentito' },
  focus:   { zh:'重点练这几个字', en:'Practise these', it:'Esercita questi' },
  perfect: { zh:'🎉 每个字都很准！', en:'🎉 Every character was accurate!', it:'🎉 Tutto corretto!' },
};
const tr = (L, k) => STR[k]?.[L] ?? STR[k]?.zh ?? k;

// Green / amber / red, on the same thresholds the character chips use.
function colourFor(score) {
  if (score == null)  return { bg:'#f5f5f5', fg:'#9e9e9e', edge:'#e0e0e0' };
  if (score >= 80)    return { bg:'#e8f5e9', fg:'#1b5e20', edge:'#a5d6a7' };
  if (score >= 60)    return { bg:'#fff8e1', fg:'#e65100', edge:'#ffcc80' };
  return                     { bg:'#ffebee', fg:'#b71c1c', edge:'#ef9a9a' };
}

export default function VoiceApp({ onBack }) {
  const { lang } = useLang();
  const L = lang === 'en' || lang === 'it' ? lang : 'zh';
  const isPhone = usePhone();

  const [phrases, setPhrases] = useState(FALLBACK_PHRASES);
  const [idx, setIdx] = useState(0);
  const { assess, busy, result, error, reset } = usePronunciationAssessment();

  // Scenario lines make good assessment material and are already written and
  // levelled, so use them when present rather than inventing a second corpus.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('clf_scenarios')
          .select('title_zh, lines')
          .limit(20);
        const fromDb = (data || [])
          .flatMap(s => (Array.isArray(s.lines) ? s.lines : []))
          .map(l => (typeof l === 'string' ? l : l?.zh || l?.text_zh))
          .filter(t => typeof t === 'string' && t.length >= 2 && t.length <= 12)
          .slice(0, 20)
          .map(text => ({ text, pinyin: '', en: '' }));
        if (fromDb.length >= 3) setPhrases(fromDb);
      } catch { /* keep the fallback list */ }
    })();
  }, []);

  const phrase = phrases[idx % phrases.length];

  async function run() {
    reset();
    await assess(phrase.text);
  }

  // Record the attempt once a verdict exists, so 语音评测 feeds the same
  // history every other module writes to.
  useEffect(() => {
    if (!result || result.overall == null) return;
    recordLearning({
      module: 'voice', itemType: 'phrase', itemId: phrase.text,
      event: 'quiz',
      correct: result.overall >= 80,
      score: Math.round(result.overall),
      meta: {
        accuracy: result.accuracy, fluency: result.fluency,
        prosody: result.prosody, heard: result.heard,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const weak = weakest(result);

  return (
    <div style={{ minHeight:'100dvh', background:P.bg, color:P.ink }}>
      <header style={{
        padding: isPhone ? '12px 16px' : '18px 24px',
        paddingTop: `calc(${isPhone ? 12 : 18}px + var(--safe-top))`,
        background: `linear-gradient(90deg, ${P.accent} 0%, #134e4a 100%)`,
        color:'#f0fdfa', display:'flex', alignItems:'center', gap:10,
      }}>
        <button onClick={onBack} aria-label="Back" style={{
          background:'rgba(255,255,255,0.15)', color:'#f0fdfa',
          border:'1px solid rgba(255,255,255,0.3)', width:32, height:32,
          borderRadius:16, padding:0, cursor:'pointer', fontSize:16,
        }}>‹</button>
        <div style={{ fontSize: isPhone ? 18 : 22, fontWeight:700,
          fontFamily:"'STKaiti','KaiTi',serif", letterSpacing: isPhone ? 2 : 3 }}>
          {tr(L, 'title')}
        </div>
      </header>

      <main style={{ padding: isPhone ? '18px 16px 40px' : '26px 28px 48px',
        maxWidth:640, margin:'0 auto' }}>

        {/* The phrase to read */}
        <div style={{ background:'#fff', border:`1.5px solid ${P.soft}`,
          borderRadius:18, padding: isPhone ? '20px 18px' : '26px 24px', textAlign:'center' }}>
          <div style={{ fontSize: isPhone ? 30 : 38, fontWeight:600,
            fontFamily:"'STKaiti','KaiTi',serif", letterSpacing:4, lineHeight:1.5 }}>
            {phrase.text}
          </div>
          {phrase.pinyin && (
            <div style={{ fontSize:14, color:P.ink3, marginTop:8, fontStyle:'italic' }}>
              {phrase.pinyin}
            </div>
          )}
          {phrase.en && L !== 'zh' && (
            <div style={{ fontSize:13, color:P.ink2, marginTop:4 }}>{phrase.en}</div>
          )}

          <button onClick={run} disabled={busy} style={{
            marginTop:18, width:'100%', padding:'14px', borderRadius:12,
            border:'none', background: busy ? '#94a3b8' : P.accent, color:'#f0fdfa',
            fontSize:16, fontWeight:700, fontFamily:'inherit',
            cursor: busy ? 'default' : 'pointer',
          }}>
            {busy ? tr(L,'listening') : result ? tr(L,'again') : tr(L,'record')}
          </button>

          <button onClick={() => { reset(); setIdx(i => i + 1); }} disabled={busy}
            style={{
              marginTop:8, width:'100%', padding:0, border:'none', background:'none',
              color:P.ink3, fontSize:12, textDecoration:'underline',
              cursor: busy ? 'default' : 'pointer', fontFamily:'inherit',
            }}>
            {tr(L,'next')}
          </button>
        </div>

        {error && (
          <div style={{ marginTop:14, background:'#ffebee', border:'1px solid #ef9a9a',
            color:'#b71c1c', borderRadius:12, padding:'12px 14px', fontSize:13, lineHeight:1.6 }}>
            {error}
          </div>
        )}

        {result && (
          <>
            {/* Per-character verdict — the whole reason this screen exists */}
            <div style={{ marginTop:16, background:'#fff', border:`1px solid ${P.soft}`,
              borderRadius:16, padding: isPhone ? '16px 14px' : '20px 18px' }}>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                {result.chars.map((c, i) => {
                  const col = colourFor(c.score);
                  return (
                    <div key={i} style={{
                      minWidth:56, padding:'8px 6px', borderRadius:12,
                      background:col.bg, border:`1.5px solid ${col.edge}`, textAlign:'center',
                    }}>
                      <div style={{ fontSize:26, fontWeight:600, color:col.fg,
                        fontFamily:"'STKaiti','KaiTi',serif", lineHeight:1.2 }}>{c.char}</div>
                      {c.syllable && (
                        <div style={{ fontSize:10, color:col.fg, opacity:0.75 }}>{c.syllable}</div>
                      )}
                      <div style={{ fontSize:11, color:col.fg, fontWeight:600 }}>
                        {c.score == null ? '—' : Math.round(c.score)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {weak.length === 0 ? (
                <div style={{ marginTop:14, textAlign:'center', fontSize:14,
                  color:'#1b5e20', fontWeight:600 }}>{tr(L,'perfect')}</div>
              ) : (
                <div style={{ marginTop:14, fontSize:13, color:P.ink2, textAlign:'center' }}>
                  {tr(L,'focus')}：
                  <strong style={{ fontSize:18, letterSpacing:3, color:'#b71c1c' }}>
                    {weak.map(c => c.char).join(' ')}
                  </strong>
                </div>
              )}

              {result.heard && result.heard !== result.reference && (
                <div style={{ marginTop:10, fontSize:12, color:P.ink3, textAlign:'center' }}>
                  {tr(L,'heard')}：{result.heard}
                </div>
              )}
            </div>

            {/* Score breakdown */}
            <div style={{ marginTop:12, display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(88px, 1fr))', gap:8 }}>
              {[
                ['总分',   result.overall],
                ['准确',   result.accuracy],
                ['流利',   result.fluency],
                ['声调',   result.prosody],
                ['完整',   result.completeness],
              ].filter(([, v]) => v != null).map(([label, v]) => (
                <div key={label} style={{ background:'#fff', border:`1px solid ${P.soft}`,
                  borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:700, color:P.accent }}>{Math.round(v)}</div>
                  <div style={{ fontSize:11, color:P.ink3 }}>{label}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
