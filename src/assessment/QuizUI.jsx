// src/assessment/QuizUI.jsx
//
// Presentation shared by the two places a kid answers questions:
//   /placement            — prospective student, code-gated, no account (012)
//   /student → 测评        — enrolled student, logged in (013)
//
// Both pull from the same item bank and grade server-side, so they must also
// look and behave the same. This file is the only copy of that UI.

import React from 'react';
import { Volume2, Check } from 'lucide-react';

export const BG     = '#fdf6e3';
export const ACCENT = '#c41e3a';
export const INK    = '#1a0a05';
export const MUTED  = '#a07850';
export const KAI    = "'STKaiti','KaiTi',serif";

// ── Audio ────────────────────────────────────────────────────────────
// Azure via the public azure-tts-speak function; Web Speech if that isn't
// deployed (Lingua_School has no netlify functions of its own).
export async function speakChinese(text, audioUrl) {
  if (!text && !audioUrl) return;
  if (audioUrl) {
    try { await new Audio(audioUrl).play(); return; } catch { /* fall through */ }
  }
  try {
    const res = await fetch('/.netlify/functions/azure-tts-speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const json = await res.json();
    if (json.audioBase64) {
      await new Audio(`data:audio/mp3;base64,${json.audioBase64}`).play();
      return;
    }
  } catch { /* fall through */ }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'zh-CN';
    utt.rate = 0.85;
    window.speechSynthesis.speak(utt);
  }
}

// ── Chrome ───────────────────────────────────────────────────────────

export const Shell = ({ children, embedded }) => (
  <div style={{
    minHeight: embedded ? 0 : '100dvh',
    background: embedded ? 'transparent' : BG,
    display: 'flex', alignItems: embedded ? 'flex-start' : 'center',
    justifyContent: 'center', padding: embedded ? 0 : 20,
  }}>{children}</div>
);

export const Card = ({ children }) => (
  <div style={{
    background: '#fff', border: '1px solid #e8d5b0', borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 560, textAlign: 'center',
    boxShadow: '0 2px 12px rgba(160,120,80,.08)',
  }}>{children}</div>
);

export const Spinner = () => (
  <div style={{ padding: 30, textAlign: 'center', color: MUTED, fontSize: 20 }}>···</div>
);

export const btn = (primary) => ({
  marginTop: 16, width: '100%', padding: '12px 16px', fontSize: 15,
  borderRadius: 10, cursor: 'pointer',
  background: primary ? ACCENT : BG,
  color: primary ? '#fff' : MUTED,
  border: primary ? 'none' : '1px solid #e8d5b0',
});

export function ProgressBar({ index, total, skillLabel }) {
  const pct = total ? Math.round(Math.min(1, index / total) * 100) : 0;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 8, color: MUTED, fontSize: 12 }}>
        <span>第 {index + 1} 题{total ? ` / ${total}` : ''}</span>
        <span>{skillLabel || ''}</span>
      </div>
      <div style={{ height: 6, background: '#e8d5b0', borderRadius: 3, marginBottom: 18 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: ACCENT,
          borderRadius: 3, transition: 'width .3s' }} />
      </div>
    </>
  );
}

export function SkillBar({ label, value }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 42, fontSize: 12, color: MUTED, textAlign: 'right' }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: '#f0e4cc', borderRadius: 4 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: ACCENT, borderRadius: 4 }} />
      </div>
      <div style={{ width: 34, fontSize: 12, color: MUTED }}>{pct}%</div>
    </div>
  );
}

// ── Video ────────────────────────────────────────────────────────────
// An uploaded file plays in <video>; a YouTube/Bilibili/Vimeo link has to go
// through that host's iframe player, so watch-page URLs are rewritten to
// their embed form.

export function embedUrl(url = '') {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const bv = url.match(/bilibili\.com\/video\/(BV[\w]+)/i);
  if (bv) return `https://player.bilibili.com/player.html?bvid=${bv[1]}&high_quality=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;   // treat as a direct file
}

export function QuestionVideo({ url }) {
  const embed = embedUrl(url);
  const frame = {
    width: '100%', aspectRatio: '16 / 9', border: 'none',
    borderRadius: 10, marginBottom: 16, background: '#000',
  };
  if (embed) {
    return <iframe src={embed} style={frame} allowFullScreen
      allow="accelerometer; encrypted-media; picture-in-picture" title="题目视频"/>;
  }
  return <video src={url} controls playsInline style={frame}/>;
}

// ── The question itself ──────────────────────────────────────────────
//
// `reveal` is the correct original index, or null. Practice runs pass it so
// the child sees the right answer; official runs pass null so a wrong answer
// mid-test doesn't discourage them (and can't be farmed).

export function ItemView({ item, choices, picked, reveal, onChoose }) {
  if (!item) return <Spinner/>;
  return (
    <>
      {item.skill === 'listening' && (
        <button
          onClick={() => speakChinese(item.audio_text, item.audio_url)}
          style={{
            width: 90, height: 90, borderRadius: '50%', border: 'none',
            background: ACCENT, color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}
          aria-label="播放录音"
        >
          <Volume2 size={34}/>
        </button>
      )}

      <div style={{ fontFamily: KAI, fontSize: 20, color: INK,
        lineHeight: 1.7, marginBottom: item.prompt_hint ? 4 : 18 }}>
        {item.prompt}
      </div>
      {item.prompt_hint && (
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 18 }}>{item.prompt_hint}</div>
      )}
      {item.image_url && (
        <img src={item.image_url} alt="" style={{ maxWidth: '100%',
          borderRadius: 10, marginBottom: 16 }} />
      )}
      {item.video_url && <QuestionVideo url={item.video_url} />}

      {item.options_kind === 'image' ? (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
          {choices.map(({ originalIndex, text }) => {
            const chosen = picked === originalIndex;
            const right  = reveal != null && originalIndex === reveal;
            const wrong  = chosen && reveal != null && originalIndex !== reveal;
            const border = right ? '#217a41' : wrong ? ACCENT : chosen ? ACCENT : '#e8d5b0';
            return (
              <button
                key={originalIndex}
                onClick={() => onChoose(originalIndex)}
                disabled={picked !== null}
                style={{
                  padding: 6, background: '#fff', borderRadius: 12,
                  border: `3px solid ${border}`,
                  cursor: picked === null ? 'pointer' : 'default',
                  position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden',
                }}
              >
                <img src={text} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                }}/>
                {(chosen || right) && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6, width: 24, height: 24,
                    borderRadius: '50%', background: right ? '#217a41' : ACCENT,
                    color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                  }}><Check size={14}/></span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
      <div style={{ display: 'grid', gap: 10 }}>
        {choices.map(({ originalIndex, text }) => {
          const chosen  = picked === originalIndex;
          const right   = reveal != null && originalIndex === reveal;
          const wrong   = chosen && reveal != null && originalIndex !== reveal;
          const bg      = right ? '#eefaf0' : wrong ? '#fdeeee' : chosen ? ACCENT : '#fff';
          const fg      = right ? '#217a41' : wrong ? ACCENT : chosen ? '#fff' : INK;
          const border  = right ? '#b7e2c4' : wrong ? ACCENT : chosen ? ACCENT : '#e8d5b0';
          return (
            <button
              key={originalIndex}
              onClick={() => onChoose(originalIndex)}
              disabled={picked !== null}
              style={{
                padding: '14px 16px', fontSize: 17, textAlign: 'left',
                fontFamily: KAI, cursor: picked === null ? 'pointer' : 'default',
                background: bg, color: fg, border: `1px solid ${border}`,
                borderRadius: 10, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span>{text}</span>
              {(chosen || right) && <Check size={16}/>}
            </button>
          );
        })}
      </div>
      )}
    </>
  );
}
