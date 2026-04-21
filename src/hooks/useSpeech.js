// src/hooks/useSpeech.js
import { useState, useCallback } from 'react';

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text) => {
    if (!text) return;
    const charOnly = text.split('，')[0].trim() || text;
    setSpeaking(true);
    setTimeout(() => setSpeaking(false), 4000); // safety reset

    let audio = document.getElementById('jgw-tts');
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'jgw-tts';
      audio.style.display = 'none';
      document.body.appendChild(audio);
    }

    audio.onended = () => setSpeaking(false);
    audio.onerror = () => {
      setSpeaking(false);
      // fallback to Web Speech
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(charOnly);
        utt.lang = 'zh-CN'; utt.rate = 0.85;
        utt.onend = utt.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utt);
      }
    };

    // Use Netlify proxy — no CORS, works on all devices
    audio.src = `/.netlify/functions/tts-proxy?text=${encodeURIComponent(charOnly)}`;
    audio.play().catch(() => setSpeaking(false));
  }, []);

  const stop = useCallback(() => {
    const audio = document.getElementById('jgw-tts');
    if (audio) { audio.pause(); audio.currentTime = 0; }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking };
}

const TONE_MAP = {
  'ā':'a','á':'a','ǎ':'a','à':'a',
  'ē':'e','é':'e','ě':'e','è':'e',
  'ī':'i','í':'i','ǐ':'i','ì':'i',
  'ō':'o','ó':'o','ǒ':'o','ò':'o',
  'ū':'u','ú':'u','ǔ':'u','ù':'u',
  'ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v',
};

function normalizePinyin(s) {
  return s.toLowerCase()
    .replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, c => TONE_MAP[c] || c)
    .replace(/\s+/g, '');
}

export function useSpeechRecognition() {
  const [listening,  setListening]  = useState(false);
  const [transcript, setTranscript] = useState('');
  const [score,      setScore]      = useState(null);
  const [error,      setError]      = useState(null);
  const recRef = { current: null };

  const startListening = useCallback((expectedPinyin, expectedChar) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError('Use Chrome or Edge for voice recognition'); return; }
    setTranscript(''); setScore(null); setError(null); setListening(true);
    const rec = new SR();
    rec.lang = 'zh-CN'; rec.interimResults = false; rec.maxAlternatives = 5;
    recRef.current = rec;
    rec.onresult = (e) => {
      const results = Array.from(e.results[0]);
      let bestScore = 0, bestTranscript = results[0].transcript;
      results.forEach(alt => {
        const t = alt.transcript.trim();
        if (t.includes(expectedChar)) { bestScore = Math.max(bestScore, 100); bestTranscript = t; return; }
        if (normalizePinyin(t) === normalizePinyin(expectedPinyin)) bestScore = Math.max(bestScore, 95);
        const conf = Math.round(alt.confidence * 100);
        if (conf > bestScore) { bestScore = conf; bestTranscript = t; }
      });
      setTranscript(bestTranscript); setScore(bestScore); setListening(false);
    };
    rec.onerror = (e) => {
      setError(e.error === 'no-speech' ? '未检测到声音' : `错误: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    rec.start();
  }, []);

  const stopListening = useCallback(() => {
    recRef.current?.stop(); setListening(false);
  }, []);

  return { startListening, stopListening, listening, transcript, score, error };
}
