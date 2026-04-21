// src/components/PandaTeacher.jsx
// AI-powered panda teacher — loads images from Supabase panda assets

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Fallback emoji if no image generated yet
const FALLBACK = {
  normal: '🐼', excited: '🐼', sad: '🐼',
  thinking: '🐼', sleeping: '🐼', cheering: '🐼', surprised: '🐼',
};

// Cache panda URLs in memory
let pandaCache = null;

async function loadPandaAssets() {
  if (pandaCache) return pandaCache;
  const { data } = await supabase.from('jgw_panda_assets').select('emotion, image_url');
  pandaCache = {};
  (data || []).forEach(r => { pandaCache[r.emotion] = r.image_url; });
  return pandaCache;
}

// Contexts the panda reacts to
export const PANDA_CONTEXT = {
  GREETING:    'greeting',    // App open — daily greeting
  CORRECT:     'correct',     // Right answer
  WRONG:       'wrong',       // Wrong answer
  HINT:        'hint',        // Student asked for hint
  COMPLETE:    'complete',    // Finished a session
  STREAK:      'streak',      // Streak milestone
  LOADING:     'loading',     // AI is thinking
  ACHIEVEMENT: 'achievement', // New level/badge
  IDLE:        'idle',        // No activity
};

const CONTEXT_EMOTION = {
  greeting:    ['normal', 'excited'],
  correct:     ['excited', 'cheering'],
  wrong:       ['sad', 'normal'],
  hint:        ['thinking', 'normal'],
  complete:    ['cheering', 'excited'],
  streak:      ['cheering', 'surprised'],
  loading:     ['thinking'],
  achievement: ['surprised', 'excited'],
  idle:        ['sleeping', 'normal'],
};

function pickEmotion(context) {
  const options = CONTEXT_EMOTION[context] || ['normal'];
  return options[Math.floor(Math.random() * options.length)];
}

// Call Claude API for a contextual panda message
async function generatePandaMessage({ context, lang, dayCount, character,
  score, streak, hint, wrong_count }) {

  const langLabel = lang === 'it' ? 'Italian' : lang === 'zh' ? 'Chinese' : 'English';

  const prompts = {
    greeting: `You are a friendly Chinese panda teacher. The student has been learning Chinese for ${dayCount} days. 
Write a warm, encouraging greeting in ${langLabel} (max 2 sentences). 
Include "第${dayCount}天" naturally. Be specific and personal, not generic.
Examples of tone: "今天是你学习中文的第${dayCount}天！每天进步一点点，加油！"`,

    correct: `You are a friendly Chinese panda teacher. The student just answered correctly about "${character}".
Write a short celebratory message in ${langLabel} (1-2 sentences). Be enthusiastic!
Mention the character or its meaning if possible.`,

    wrong: `You are a friendly Chinese panda teacher. The student got "${character}" wrong (${wrong_count} attempts).
Write a gentle, encouraging message in ${langLabel} (1-2 sentences). Don't be negative.
Offer a small memory tip if possible.`,

    hint: `You are a friendly Chinese panda teacher. The student needs a hint for the character "${character}".
Give a clever, memorable hint in ${langLabel} (1-2 sentences).
Use visual mnemonics, stories, or etymology if helpful.`,

    complete: `You are a friendly Chinese panda teacher. The student just completed a practice session with score ${score}%.
Write a congratulatory message in ${langLabel} (1-2 sentences).
If score >= 80, be very enthusiastic. If < 60, be encouraging.`,

    streak: `You are a friendly Chinese panda teacher. The student has a ${streak}-day learning streak!
Write an excited congratulatory message in ${langLabel} (1-2 sentences). 
Make them feel proud of their consistency.`,

    achievement: `You are a friendly Chinese panda teacher. The student just unlocked a new achievement.
Write a surprised and delighted message in ${langLabel} (1-2 sentences).`,

    idle: `You are a friendly Chinese panda teacher. The student hasn't practiced today.
Write a gentle, non-guilt reminder in ${langLabel} (1 sentence). Be warm, not pushy.`,

    loading: null, // No AI needed — use static messages
  };

  const prompt = prompts[context];
  if (!prompt) return null;

  const res = await fetch('/.netlify/functions/ai-gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'fill',
      provider: 'claude',
      prompt: prompt + '\n\nRespond ONLY with the message text, no quotes, no explanation.',
      max_tokens: 100,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result?.trim() || data.text?.trim();
}

// Static fallback messages (used when offline or during loading)
const STATIC_MESSAGES = {
  loading: ['思考中…', 'Un momento…', 'Thinking…'],
  idle:    ['今天练习了吗？', 'Hai studiato oggi?', 'Practiced today?'],
};

// ── Main component ────────────────────────────────────────────────
export default function PandaTeacher({
  context = 'greeting',
  lang = 'zh',
  size = 'md',           // sm | md | lg
  dayCount = 1,
  character = '',
  score = 0,
  streak = 0,
  wrong_count = 0,
  autoLoad = true,       // fetch message on mount
  message: propMessage,  // override message externally
  emotion: propEmotion,  // override emotion externally
  onMessageReady,        // callback when message is ready
  style = {},
}) {
  const [emotion,  setEmotion]  = useState(propEmotion || pickEmotion(context));
  const [message,  setMessage]  = useState(propMessage || '');
  const [loading,  setLoading]  = useState(false);
  const [visible,  setVisible]  = useState(false);
  const [pandaUrls, setPandaUrls] = useState({});

  // Load panda assets from Supabase on mount
  useEffect(() => {
    loadPandaAssets().then(setPandaUrls).catch(() => {});
  }, []);

  const sizes = {
    sm: { img: 64,  font: 12, bubble: 200 },
    md: { img: 100, font: 13, bubble: 260 },
    lg: { img: 140, font: 15, bubble: 320 },
  };
  const sz = sizes[size] || sizes.md;

  const fetchMessage = useCallback(async () => {
    if (propMessage) { setMessage(propMessage); setVisible(true); return; }
    if (context === 'loading') {
      const msgs = STATIC_MESSAGES.loading;
      setMessage(msgs[Math.floor(Math.random() * msgs.length)]);
      setVisible(true);
      return;
    }
    setLoading(true);
    setEmotion('thinking');
    try {
      const msg = await generatePandaMessage({
        context, lang, dayCount, character, score, streak, wrong_count,
      });
      if (msg) {
        setMessage(msg);
        setEmotion(propEmotion || pickEmotion(context));
        setVisible(true);
        onMessageReady?.(msg);
      }
    } catch(e) {
      // Fallback to static
      setMessage(lang === 'zh' ? '加油！你能做到的！' : lang === 'it' ? 'Dai, ce la fai!' : 'You can do it!');
      setEmotion(pickEmotion(context));
      setVisible(true);
    }
    setLoading(false);
  }, [context, lang, dayCount, character, score, streak, propMessage, propEmotion]);

  useEffect(() => {
    if (autoLoad) fetchMessage();
  }, [context, character]);

  // Animation on appear
  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    }
  }, [visible]);

  const imgSrc = pandaUrls[emotion] || null;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 10,
      ...style,
    }}>
      {/* Panda image or emoji fallback */}
      <div style={{ flexShrink:0, width:sz.img, height:sz.img,
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {imgSrc ? (
          <img src={imgSrc} alt={`panda ${emotion}`}
            style={{ width:'100%', height:'100%', objectFit:'contain',
              transition:'all 0.3s ease',
              filter: loading ? 'brightness(0.85)' : 'none' }}/>
        ) : (
          <span style={{ fontSize: sz.img * 0.7, lineHeight:1 }}>
            {FALLBACK[emotion] || '🐼'}
          </span>
        )}
        {loading && (
          <div style={{ position:'absolute', bottom:4, right:4, fontSize:16 }}>⏳</div>
        )}
      </div>

      {/* Speech bubble */}
      {(message || loading) && (
        <div style={{
          position: 'relative',
          background: '#fff',
          border: '2px solid #e8d5b0',
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          padding: '10px 14px',
          maxWidth: sz.bubble,
          fontSize: sz.font,
          color: '#1a0a05',
          lineHeight: 1.6,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          fontFamily: "'STKaiti','KaiTi',Georgia,serif",
        }}>
          {loading ? (
            <span style={{ color: '#a07850' }}>
              {'　…'.split('').map((c, i) => (
                <span key={i} style={{
                  display: 'inline-block',
                  animation: `bounce 1s ease ${i*0.2}s infinite`,
                }}>{c}</span>
              ))}
            </span>
          ) : message}

          {/* Bubble tail */}
          <div style={{
            position: 'absolute',
            bottom: -8, left: -2,
            width: 14, height: 14,
            background: '#fff',
            borderLeft: '2px solid #e8d5b0',
            borderBottom: '2px solid #e8d5b0',
            transform: 'rotate(45deg)',
            clipPath: 'polygon(0 100%, 0 0, 100% 100%)',
          }}/>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Convenience wrappers ──────────────────────────────────────────

export function PandaGreeting({ lang, dayCount, style }) {
  return <PandaTeacher context="greeting" lang={lang}
    dayCount={dayCount} size="lg" autoLoad style={style}/>;
}

export function PandaCorrect({ character, lang }) {
  return <PandaTeacher context="correct" character={character}
    lang={lang} size="md" autoLoad/>;
}

export function PandaWrong({ character, lang, wrong_count }) {
  return <PandaTeacher context="wrong" character={character}
    lang={lang} wrong_count={wrong_count} size="md" autoLoad/>;
}

export function PandaHint({ character, lang }) {
  return <PandaTeacher context="hint" character={character}
    lang={lang} size="md" autoLoad/>;
}

export function PandaComplete({ score, lang }) {
  return <PandaTeacher context="complete" score={score}
    lang={lang} size="lg" autoLoad/>;
}

export function PandaLoading({ lang }) {
  return <PandaTeacher context="loading" lang={lang}
    size="sm" autoLoad emotion="thinking"/>;
}
