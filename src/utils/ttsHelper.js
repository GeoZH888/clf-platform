// src/utils/ttsHelper.js
// TTS with pinyin phoneme library support
// Priority: 1) Youdao phoneme API (for initials/finals)  2) TTS proxy  3) Web Speech API

// ── Pinyin tone number map ─────────────────────────────────────────
// Convert tone-marked pinyin to tone-numbered for Youdao API
const TONE_MAP = {
  'ā':'a1','á':'a2','ǎ':'a3','à':'a4',
  'ē':'e1','é':'e2','ě':'e3','è':'e4',
  'ī':'i1','í':'i2','ǐ':'i3','ì':'i4',
  'ō':'o1','ó':'o2','ǒ':'o3','ò':'o4',
  'ū':'u1','ú':'u2','ǔ':'u3','ù':'u4',
  'ǖ':'v1','ǘ':'v2','ǚ':'v3','ǜ':'v4',
  'ü':'v',
};

// Convert tone-marked pinyin to Youdao format e.g. "xī" → "xi1"
function pinyinToYoudao(py) {
  if (!py) return null;
  let result = py.toLowerCase();
  for (const [marked, numbered] of Object.entries(TONE_MAP)) {
    result = result.replace(marked, numbered.slice(0,-1)); // replace vowel
    // add tone number at end
    if (result !== py.toLowerCase()) {
      const toneNum = numbered.slice(-1);
      // Insert tone number after the vowel group
      result = result + toneNum;
      break;
    }
  }
  // Handle ü → v
  result = result.replace('ü', 'v');
  return result;
}

// Check if text is a pinyin syllable (not a Chinese character)
function isPinyin(text) {
  if (!text) return false;
  // Chinese characters range
  return !/[\u4e00-\u9fff]/.test(text);
}

// Get audio element (singleton)
function getAudioEl() {
  let audio = document.getElementById('jgw-tts');
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = 'jgw-tts';
    audio.style.display = 'none';
    document.body.appendChild(audio);
  }
  return audio;
}

// Try playing from URL, return promise
function tryPlay(audio, src) {
  return new Promise((resolve, reject) => {
    audio.src = src;
    const t = setTimeout(() => reject(new Error('timeout')), 4000);
    audio.oncanplaythrough = () => {};
    audio.onerror = () => { clearTimeout(t); reject(new Error('audio error')); };
    audio.onended = () => { clearTimeout(t); resolve(); };
    audio.play()
      .then(() => clearTimeout(t))
      .catch(e => { clearTimeout(t); reject(e); });
  });
}

// Web Speech API fallback
function webSpeech(text, lang='zh-CN', onSuccess, onError) {
  if (!window.speechSynthesis) { onError?.(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang; utt.rate = 0.8;
  utt.onend   = () => onSuccess?.();
  utt.onerror = () => onError?.();
  window.speechSynthesis.speak(utt);
}

// ── Main export ────────────────────────────────────────────────────
export async function playTTS(text, onSuccess, onError) {
  if (!text?.trim()) return;
  const audio = getAudioEl();
  const clean = text.trim();

  // For pinyin (initials/finals) — use Youdao phoneme library
  if (isPinyin(clean)) {
    const youdao = pinyinToYoudao(clean);
    if (youdao) {
      try {
        await tryPlay(audio,
          `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(youdao)}&type=1`);
        onSuccess?.();
        return;
      } catch(e) {
        console.warn('Youdao phoneme failed, falling back:', e.message);
      }
    }
  }

  // For Chinese characters — use our TTS proxy
  try {
    await tryPlay(audio,
      `/.netlify/functions/tts-proxy?text=${encodeURIComponent(clean)}`);
    onSuccess?.();
    return;
  } catch(e) {
    console.warn('TTS proxy failed, using Web Speech:', e.message);
  }

  // Final fallback — Web Speech API
  webSpeech(clean, 'zh-CN', onSuccess, onError);
}

// ── Dedicated phoneme player (for PinyinTable) ────────────────────
// Plays the pure initial/final sound using best available source
export async function playPhonemeTTS(py, exampleChar, onSuccess, onError) {
  const audio = getAudioEl();

  // Strategy 1: Youdao with tone-numbered pinyin
  const youdao = pinyinToYoudao(py);
  if (youdao) {
    try {
      await tryPlay(audio,
        `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(youdao)}&type=1`);
      onSuccess?.(); return;
    } catch(e) {}
  }

  // Strategy 2: Use example Chinese character via proxy
  if (exampleChar) {
    try {
      await tryPlay(audio,
        `/.netlify/functions/tts-proxy?text=${encodeURIComponent(exampleChar)}`);
      onSuccess?.(); return;
    } catch(e) {}
  }

  // Strategy 3: Web Speech with example char
  if (exampleChar) {
    webSpeech(exampleChar, 'zh-CN', onSuccess, onError);
    return;
  }

  onError?.();
}
