/**
 * src/hooks/useScoring.js
 * Smart scoring with actionable advice per character
 */
import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

// ── Advice engine ─────────────────────────────────────────────────
function getAdvice(mistakes, totalStrokes, char, lang) {
  const ratio = totalStrokes > 0 ? mistakes / totalStrokes : 0;
  const score = Math.max(0, Math.round(100 - ratio * 100));

  if (lang === 'zh') {
    if (score === 100) return { msg:`✦ 完美！${char}的笔顺完全正确`, color:'#2E7D32', emoji:'🏆' };
    if (score >= 80)  return { msg:`◎ 很好！${totalStrokes}笔中有${mistakes}处需注意`, color:'#2E7D32', emoji:'⭐' };
    if (score >= 60)  return { msg:`△ 继续努力！多练习第${getFirstMistakeStroke(mistakes,totalStrokes)}笔附近的笔画`, color:'#E65100', emoji:'📝' };
    if (score >= 40)  return { msg:`× 笔顺有误，建议先看动画示范再练习`, color:'#c0392b', emoji:'👁' };
    return { msg:`× 先看▶全部动画，跟着练习每一笔`, color:'#c0392b', emoji:'🎬' };
  } else if (lang === 'it') {
    if (score === 100) return { msg:`✦ Perfetto! L'ordine dei tratti di ${char} è corretto`, color:'#2E7D32', emoji:'🏆' };
    if (score >= 80)  return { msg:`◎ Molto bene! ${mistakes} tratto da rivedere su ${totalStrokes}`, color:'#2E7D32', emoji:'⭐' };
    if (score >= 60)  return { msg:`△ Continua! Concentrati sul tratto ${getFirstMistakeStroke(mistakes,totalStrokes)}`, color:'#E65100', emoji:'📝' };
    if (score >= 40)  return { msg:`× Ordine errato — guarda prima l'animazione`, color:'#c0392b', emoji:'👁' };
    return { msg:`× Guarda ▶ l'animazione completa e segui tratto per tratto`, color:'#c0392b', emoji:'🎬' };
  } else {
    if (score === 100) return { msg:`✦ Perfect! All ${totalStrokes} strokes of ${char} correct`, color:'#2E7D32', emoji:'🏆' };
    if (score >= 80)  return { msg:`◎ Great! ${mistakes} stroke${mistakes>1?'s':''} to refine out of ${totalStrokes}`, color:'#2E7D32', emoji:'⭐' };
    if (score >= 60)  return { msg:`△ Keep going! Focus on stroke ${getFirstMistakeStroke(mistakes,totalStrokes)} area`, color:'#E65100', emoji:'📝' };
    if (score >= 40)  return { msg:`× Wrong order — watch the animation first, then try`, color:'#c0392b', emoji:'👁' };
    return { msg:`× Start fresh: watch ▶ All animation, copy each stroke`, color:'#c0392b', emoji:'🎬' };
  }
}

function getFirstMistakeStroke(mistakes, total) {
  // Approximate which stroke was first wrong
  return Math.max(1, total - mistakes + 1);
}

// ── Tone advice ───────────────────────────────────────────────────
function getToneAdvice(score, expected, detected, lang) {
  if (lang === 'zh') {
    if (score >= 85) return { msg:`✦ 声调准确！第${expected}声发音正确`, color:'#2E7D32' };
    if (score >= 65) return { msg:`△ 接近了！应为第${expected}声，你发的更像第${detected}声，注意音调走向`, color:'#E65100' };
    return { msg:`× 声调有误。第${expected}声${getToneDescription(expected,'zh')}，多听示范再练`, color:'#c0392b' };
  } else if (lang === 'it') {
    if (score >= 85) return { msg:`✦ Tono corretto! Tono ${expected} perfetto`, color:'#2E7D32' };
    if (score >= 65) return { msg:`△ Quasi! Tono ${expected} atteso, sembrava tono ${detected}`, color:'#E65100' };
    return { msg:`× Tono errato. Tono ${expected}: ${getToneDescription(expected,'it')}`, color:'#c0392b' };
  } else {
    if (score >= 85) return { msg:`✦ Perfect tone! Tone ${expected} correct`, color:'#2E7D32' };
    if (score >= 65) return { msg:`△ Close! Expected tone ${expected}, sounded like tone ${detected}. ${getToneDescription(expected,'en')}`, color:'#E65100' };
    return { msg:`× Wrong tone. Tone ${expected}: ${getToneDescription(expected,'en')}. Listen to demo and retry`, color:'#c0392b' };
  }
}

function getToneDescription(tone, lang) {
  const desc = {
    1: { zh:'高平调，保持高音', en:'high flat — stay high', it:'alta e piatta' },
    2: { zh:'上升调，像问号', en:'rising — like a question', it:'ascendente come una domanda' },
    3: { zh:'先降后升，低谷调', en:'dip then rise — go low then up', it:'scende poi sale' },
    4: { zh:'急降调，像命令', en:'sharp fall — like a command', it:'discendente come un ordine' },
  };
  return desc[tone]?.[lang] || '';
}

export function useScoring() {
  const [tracingScore,  setTracingScore]  = useState(null);
  const [pronounScore,  setPronouncScore] = useState(null);
  const [tracingAdvice, setTracingAdvice] = useState(null);
  const [toneAdvice,    setToneAdvice]    = useState(null);
  const [saved, setSaved] = useState(false);

  const recordTracing = useCallback((totalMistakes, totalStrokes, char, lang) => {
    if (!totalStrokes) return;
    const s = Math.max(0, Math.round(100 - (totalMistakes / totalStrokes) * 100));
    setTracingScore(s);
    setTracingAdvice(getAdvice(totalMistakes, totalStrokes, char, lang));
    return s;
  }, []);

  const recordPronunciation = useCallback((score, expected, detected, lang) => {
    setPronouncScore(score);
    if (score != null) setToneAdvice(getToneAdvice(score, expected, detected, lang));
    return score;
  }, []);

  const combined = (tracingScore !== null && pronounScore !== null)
    ? Math.round(tracingScore * 0.6 + pronounScore * 0.4)
    : tracingScore ?? pronounScore ?? null;

  const saveSession = useCallback(async ({ glyph, mode, scriptStyle, mistakes }) => {
    setSaved(false);
    const sessions = JSON.parse(localStorage.getItem('jgw_sessions') || '[]');
    sessions.push({ glyph, mode, tracingScore, pronounScore, combined, timestamp: new Date().toISOString() });
    if (sessions.length > 500) sessions.splice(0, sessions.length - 500);
    localStorage.setItem('jgw_sessions', JSON.stringify(sessions));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('jgw_practice_sessions').insert({
        user_id: user?.id ?? null, mode,
        script_style: scriptStyle ?? 'kaishu',
        mistakes: mistakes ?? 0,
        score: combined ?? tracingScore ?? null,
      });
    } catch {}
    setSaved(true);
  }, [combined, tracingScore, pronounScore]);

  const reset = useCallback(() => {
    setTracingScore(null); setPronouncScore(null);
    setTracingAdvice(null); setToneAdvice(null); setSaved(false);
  }, []);

  return { tracingScore, pronounScore, combined, tracingAdvice, toneAdvice,
    recordTracing, recordPronunciation, saveSession, reset, saved };
}

export function scoreLabel(score) {
  if (score === null) return '';
  if (score >= 95) return '完美 ✦';
  if (score >= 80) return '优秀 ◎';
  if (score >= 65) return '良好 ○';
  if (score >= 50) return '继续 △';
  return '再试 ×';
}

export function scoreColor(score) {
  if (score === null) return 'var(--color-text-tertiary)';
  if (score >= 80) return '#2E7D32';
  if (score >= 50) return '#E65100';
  return '#c0392b';
}
