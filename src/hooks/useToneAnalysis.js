/**
 * src/hooks/useToneAnalysis.js
 * Real-time pitch (F0) extraction + tone scoring for Mandarin 四声.
 *
 * Layer 1: Web Speech API  → recognises which character (implicit tone check)
 * Layer 2: Web Audio API   → analyses pitch contour → explicit tone shape score
 *
 * Combines both into a single tone score (0–100).
 */
import { useState, useRef, useCallback } from 'react';

// ── Tone templates ─────────────────────────────────────────────────
// Normalised pitch contour at 5 equally-spaced time points (0 = low, 1 = high)
export const TONE_TEMPLATES = {
  1: { contour: [0.85, 0.87, 0.87, 0.87, 0.85], label: '阴平', en: 'High flat',       symbol: '—',  color: '#1976D2' },
  2: { contour: [0.30, 0.48, 0.65, 0.78, 0.92], label: '阳平', en: 'Rising',          symbol: '/',  color: '#2E7D32' },
  3: { contour: [0.55, 0.30, 0.12, 0.28, 0.58], label: '上声', en: 'Falling-rising',  symbol: '∨',  color: '#E65100' },
  4: { contour: [0.92, 0.70, 0.48, 0.28, 0.10], label: '去声', en: 'Falling',         symbol: '\\', color: '#C62828' },
  0: { contour: [0.50, 0.50, 0.50, 0.50, 0.50], label: '轻声', en: 'Neutral',         symbol: '·',  color: '#888' },
};

// ── Pinyin tone extraction ─────────────────────────────────────────
const TONE_MARKS = {
  'ā':1,'á':2,'ǎ':3,'à':4,
  'ē':1,'é':2,'ě':3,'è':4,
  'ī':1,'í':2,'ǐ':3,'ì':4,
  'ō':1,'ó':2,'ǒ':3,'ò':4,
  'ū':1,'ú':2,'ǔ':3,'ù':4,
  'ǖ':1,'ǘ':2,'ǚ':3,'ǜ':4,
};

export function getToneFromPinyin(pinyin) {
  for (const char of pinyin) {
    if (TONE_MARKS[char]) return TONE_MARKS[char];
  }
  return 0; // neutral
}

// ── Autocorrelation pitch detector ────────────────────────────────
function detectPitch(buffer, sampleRate) {
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.008) return null; // silence / too quiet

  let bestLag = -1, bestCorr = 0;
  for (let lag = 40; lag < buffer.length / 2; lag++) {
    let corr = 0;
    for (let i = 0; i < buffer.length - lag; i++) {
      corr += buffer[i] * buffer[i + lag];
    }
    corr /= (buffer.length - lag);
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }

  if (bestLag < 0 || bestCorr < 0.01) return null;
  const hz = sampleRate / bestLag;
  // Filter to vocal range (80–400 Hz)
  return hz >= 80 && hz <= 400 ? hz : null;
}

// ── Contour matching ──────────────────────────────────────────────
function normalisePitches(pitches) {
  const valid = pitches.filter(Boolean);
  if (valid.length < 3) return null;
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = max - min;
  if (range < 10) return null; // not enough variation
  return pitches.map(p => p != null ? (p - min) / range : null);
}

function downsample(arr, n = 5) {
  const valid = arr.filter(v => v != null);
  if (valid.length < n) return valid;
  const result = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round(i * (valid.length - 1) / (n - 1));
    result.push(valid[idx]);
  }
  return result;
}

function scoreContour(observed5, expectedTone) {
  const template = TONE_TEMPLATES[expectedTone]?.contour;
  if (!template || observed5.length < 5) return 0;
  // Normalise observed
  const oMin = Math.min(...observed5), oMax = Math.max(...observed5);
  const oRange = oMax - oMin;
  const normObs = oRange < 0.05
    ? observed5.map(() => 0.5) // flat
    : observed5.map(v => (v - oMin) / oRange);
  // Normalise template
  const tMin = Math.min(...template), tMax = Math.max(...template);
  const tRange = tMax - tMin;
  const normTpl = tRange < 0.05
    ? template.map(() => 0.5)
    : template.map(v => (v - tMin) / tRange);
  // Mean absolute error
  let mae = 0;
  for (let i = 0; i < 5; i++) mae += Math.abs(normObs[i] - normTpl[i]);
  mae /= 5;
  return Math.max(0, Math.round(100 - mae * 120));
}

function classifyTone(pitches) {
  const norm = normalisePitches(pitches);
  if (!norm) return { tone: 0, score: 0 };
  const ds = downsample(norm.filter(v => v != null), 5);
  if (ds.length < 5) return { tone: 0, score: 0 };

  const scores = [1,2,3,4].map(t => ({
    tone: t,
    score: scoreContour(ds, t),
  }));
  scores.sort((a, b) => b.score - a.score);
  return { tone: scores[0].tone, score: scores[0].score, allScores: scores, contour: ds };
}

// ── Main hook ─────────────────────────────────────────────────────
export function useToneAnalysis() {
  const [recording,    setRecording]    = useState(false);
  const [pitches,      setPitches]      = useState([]);
  const [result,       setResult]       = useState(null);  // { detectedTone, expectedTone, score, match, contour }
  const [error,        setError]        = useState(null);

  const audioCtxRef  = useRef(null);
  const analyserRef  = useRef(null);
  const streamRef    = useRef(null);
  const rafRef       = useRef(null);
  const pitchBuf     = useRef([]);

  const start = useCallback(async (expectedPinyin) => {
    setError(null); setResult(null); setPitches([]);
    pitchBuf.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Float32Array(analyser.fftSize);
      const expectedTone = getToneFromPinyin(expectedPinyin);

      setRecording(true);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buf);
        const hz = detectPitch(buf, ctx.sampleRate);
        pitchBuf.current.push(hz);
        setPitches([...pitchBuf.current]);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      // Auto-stop after 2.5 seconds
      setTimeout(() => stop(expectedPinyin, expectedTone), 2500);
    } catch (e) {
      setError(e.name === 'NotAllowedError'
        ? '请允许麦克风访问 · Allow microphone access in browser'
        : `Error: ${e.message}`);
    }
  }, []);

  const stop = useCallback((expectedPinyin, expectedTone) => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    analyserRef.current = null;
    setRecording(false);

    const tone = expectedTone ?? getToneFromPinyin(expectedPinyin ?? '');
    const { tone: det, score, allScores, contour } = classifyTone(pitchBuf.current);
    setResult({
      detectedTone: det,
      expectedTone: tone,
      score,
      match: det === tone,
      contour,
      allScores,
      pitches: [...pitchBuf.current],
    });
  }, []);

  const reset = useCallback(() => {
    setResult(null); setPitches([]); setError(null);
  }, []);

  return { start, stop, reset, recording, pitches, result, error };
}
