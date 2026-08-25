// src/hooks/usePronunciationAssessment.js
//
// Per-character pronunciation scoring for a whole phrase.
//
// useToneAnalysis already does the other half of this: it listens to the mic,
// tracks the pitch contour and compares it with a tone template. That works
// beautifully for ONE syllable — but it cannot tell you which character in
// 我想买一个苹果 was wrong, because it never segments the audio.
//
// Azure's pronunciation assessment does the segmentation, and returns an
// accuracy score per word, per syllable and per phoneme, plus an error type
// (mispronunciation, omission, insertion). That is what turns "your tones are
// 72%" into "the third character was wrong" — which is the entire point.
//
// The Speech SDK is ~1 MB, so it is imported dynamically: nobody who never
// opens 语音评测 should pay for it.

import { useCallback, useRef, useState } from 'react';

// Short-lived token, so the Azure key never reaches the browser.
async function getAuth() {
  const res = await fetch('/.netlify/functions/azure-speech-token');
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`语音服务返回异常 · Speech token endpoint returned: ${text.slice(0, 120)}`); }
  if (!res.ok || data.error) {
    throw new Error(data.error || `语音服务不可用 (HTTP ${res.status})`);
  }
  if (!data.token || !data.region) throw new Error('语音服务未配置 · AZURE_SPEECH_KEY / REGION not set');
  return data;
}

/**
 * One entry per character of the reference text.
 * @typedef {{ char:string, score:number, errorType:string, syllable:string|null }} CharScore
 */

export function usePronunciationAssessment() {
  const [busy,    setBusy]    = useState(false);
  const [result,  setResult]  = useState(null);   // { overall, accuracy, fluency, completeness, prosody, chars:CharScore[], heard }
  const [error,   setError]   = useState(null);

  const recognizerRef = useRef(null);

  const stop = useCallback(() => {
    const r = recognizerRef.current;
    recognizerRef.current = null;
    if (r) {
      try { r.close(); } catch { /* already closed */ }
    }
    setBusy(false);
  }, []);

  /**
   * Record once and score it against `referenceText`.
   * Resolves when Azure has returned a verdict; never throws — read `error`.
   */
  const assess = useCallback(async (referenceText) => {
    if (!referenceText?.trim()) return;
    setError(null);
    setResult(null);
    setBusy(true);

    try {
      const SDK = await import('microsoft-cognitiveservices-speech-sdk');
      const { token, region } = await getAuth();

      const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = 'zh-CN';

      const paConfig = new SDK.PronunciationAssessmentConfig(
        referenceText,
        SDK.PronunciationAssessmentGradingSystem.HundredMark,
        // Phoneme granularity is what makes a per-character verdict possible;
        // Word alone would only say the phrase was poor.
        SDK.PronunciationAssessmentGranularity.Phoneme,
        // enableMiscue: report omitted and inserted characters rather than
        // silently scoring only what was said. A child who skips a character
        // should be told, not quietly given a good score for the rest.
        true
      );
      // Tone lives in prosody. Without this the score reflects segment accuracy
      // and largely ignores whether 妈 was said as mā or mà — which for Chinese
      // is most of what matters.
      try { paConfig.enableProsodyAssessment = true; } catch { /* older SDK */ }

      const audioConfig = SDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer  = new SDK.SpeechRecognizer(speechConfig, audioConfig);
      paConfig.applyTo(recognizer);
      recognizerRef.current = recognizer;

      const raw = await new Promise((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          r => resolve(r),
          e => reject(new Error(typeof e === 'string' ? e : '识别失败 · recognition failed'))
        );
      });

      if (raw.reason === SDK.ResultReason.NoMatch) {
        throw new Error('没有听清,请靠近麦克风再试一次 · Nothing was heard — try again closer to the mic.');
      }
      if (raw.reason === SDK.ResultReason.Canceled) {
        const d = SDK.CancellationDetails.fromResult(raw);
        throw new Error(`语音服务中断: ${d.errorDetails || d.reason}`);
      }

      const pa = SDK.PronunciationAssessmentResult.fromResult(raw);
      setResult(shape(pa, raw.text, referenceText));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      stop();
    }
  }, [stop]);

  return { assess, stop, busy, result, error, reset: () => { setResult(null); setError(null); } };
}

// ── Turn Azure's nested detail into one row per character ─────────────────
// Azure groups by "word", which for Chinese is usually one or two characters.
// The UI needs to point at a single character, so words are expanded and their
// score carried down to each character they cover.
function shape(pa, heard, referenceText) {
  const words = pa?.detailResult?.Words || [];
  const chars = [];

  for (const w of words) {
    const text  = w.Word || '';
    const score = w.PronunciationAssessment?.AccuracyScore ?? null;
    const err   = w.PronunciationAssessment?.ErrorType || 'None';
    // Syllables line up with characters in Chinese far more often than
    // phonemes do, so prefer them when present.
    const syls  = w.Syllables || [];

    Array.from(text).forEach((ch, i) => {
      chars.push({
        char: ch,
        score: syls[i]?.PronunciationAssessment?.AccuracyScore ?? score,
        errorType: err,
        syllable: syls[i]?.Syllable ?? null,
      });
    });
  }

  return {
    overall:      pa?.pronunciationScore ?? null,
    accuracy:     pa?.accuracyScore ?? null,
    fluency:      pa?.fluencyScore ?? null,
    completeness: pa?.completenessScore ?? null,
    prosody:      pa?.prosodyScore ?? null,
    heard:        heard || '',
    reference:    referenceText,
    chars,
  };
}

/** Worst characters first — what the learner should fix next. */
export function weakest(result, limit = 3) {
  if (!result?.chars?.length) return [];
  return [...result.chars]
    .filter(c => typeof c.score === 'number')
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .filter(c => c.score < 80);
}
