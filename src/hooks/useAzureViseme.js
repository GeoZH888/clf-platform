// src/hooks/useAzureViseme.js
// Azure TTS via REST proxy — Edge-safe, no WebSocket.
// speak(text, phonemeKey) — if phonemeKey provided, uses IPA SSML for exact sound.

import { useCallback, useRef, useState } from 'react';

export function useAzureViseme() {
  const [speaking,  setSpeaking]  = useState(false);
  const [visemeId,  setVisemeId]  = useState(0);
  const [error,     setError]     = useState(null);

  const audioCtxRef = useRef(null);
  const sourceRef   = useRef(null);
  const timersRef   = useRef([]);

  const cancel = useCallback(() => {
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current = null;
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    setSpeaking(false);
    setVisemeId(0);
  }, []);

  // text      = Chinese character (for display / example word)
  // phonemeKey = pinyin key like 'd', 'zh', 'an' — triggers IPA SSML
  const speak = useCallback(async (text, phonemeKey = null) => {
    cancel();
    setError(null);

    // Unlock AudioContext immediately in click handler
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    await audioCtxRef.current.resume();

    try {
      const res = await fetch('/.netlify/functions/azure-tts-speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, phonemeKey, rate: '0.75' }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }

      const { audioBase64, visemes, durationMs } = await res.json();

      const binary = atob(audioBase64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const ctx = audioCtxRef.current;
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      sourceRef.current = source;

      setSpeaking(true);
      source.onended = () => {
        setSpeaking(false);
        setVisemeId(0);
        sourceRef.current = null;
      };
      source.start(0);

      const timers = [];
      visemes.forEach(({ id, offsetMs }) => {
        timers.push(setTimeout(() => setVisemeId(id), offsetMs));
      });
      timers.push(setTimeout(() => { setVisemeId(0); setSpeaking(false); }, durationMs + 150));
      timersRef.current = timers;

    } catch (e) {
      setError(e.message);
      setSpeaking(false);
      setVisemeId(0);
    }
  }, [cancel]);

  return { speak, speaking, visemeId, error, cancel };
}

// ── Viseme ID → mouth shape ───────────────────────────────────────────────────
export const VISEME_SHAPES = {
   0: { lipGap:0,  tongueY:10, tongueX:50, tongueCurve:5,  rounded:false, label:'静止' },
   1: { lipGap:3,  tongueY:5,  tongueX:50, tongueCurve:0,  rounded:false, label:'æ ə ʌ' },
   2: { lipGap:0,  tongueY:10, tongueX:50, tongueCurve:0,  rounded:false, label:'b p m' },
   3: { lipGap:2,  tongueY:62, tongueX:82, tongueCurve:40, rounded:false, label:'t d n l' },
   4: { lipGap:2,  tongueY:68, tongueX:60, tongueCurve:65, rounded:false, label:'r 卷舌' },
   5: { lipGap:2,  tongueY:70, tongueX:68, tongueCurve:50, rounded:false, label:'j q x' },
   6: { lipGap:1,  tongueY:10, tongueX:50, tongueCurve:0,  rounded:false, label:'f' },
   7: { lipGap:2,  tongueY:60, tongueX:84, tongueCurve:36, rounded:false, label:'s z' },
   8: { lipGap:2,  tongueY:55, tongueX:86, tongueCurve:30, rounded:false, label:'θ ð' },
   9: { lipGap:2,  tongueY:68, tongueX:18, tongueCurve:60, rounded:false, label:'g k h' },
  10: { lipGap:1,  tongueY:72, tongueX:78, tongueCurve:52, rounded:false, label:'y 半元音' },
  11: { lipGap:1,  tongueY:68, tongueX:15, tongueCurve:58, rounded:true,  label:'u w' },
  12: { lipGap:1,  tongueY:35, tongueX:40, tongueCurve:15, rounded:false, label:'ə 轻声' },
  13: { lipGap:2,  tongueY:35, tongueX:22, tongueCurve:28, rounded:true,  label:'o' },
  14: { lipGap:2,  tongueY:30, tongueX:25, tongueCurve:20, rounded:true,  label:'ɔ' },
  15: { lipGap:1,  tongueY:72, tongueX:78, tongueCurve:50, rounded:false, label:'e i' },
  16: { lipGap:3,  tongueY:8,  tongueX:55, tongueCurve:0,  rounded:false, label:'a 开口' },
  17: { lipGap:2,  tongueY:40, tongueX:28, tongueCurve:22, rounded:true,  label:'ou 复韵' },
  18: { lipGap:2,  tongueY:10, tongueX:50, tongueCurve:5,  rounded:false, label:'ai 复韵' },
  19: { lipGap:3,  tongueY:8,  tongueX:45, tongueCurve:0,  rounded:false, label:'ao 复韵' },
  20: { lipGap:2,  tongueY:32, tongueX:26, tongueCurve:25, rounded:true,  label:'oi 复韵' },
  21: { lipGap:0,  tongueY:10, tongueX:50, tongueCurve:5,  rounded:false, label:'声门' },
};
