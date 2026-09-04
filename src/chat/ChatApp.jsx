// src/chat/ChatApp.jsx
// 智能对话 — the AI conversation tutor.
//
// The one module where the learner produces Chinese instead of recognising it.
// Everything else on the platform asks them to pick, match, trace or repeat;
// here they have to say something nobody wrote for them in advance.
//
// Three things follow from that, and they are what this screen is:
//   • The tutor's Chinese always carries pinyin, and a translation behind a
//     toggle. Conversation practice a learner cannot read is not practice.
//   • Mistakes get one gentle correction, attached to the message that had it,
//     never a red wall. The reply comes first; the correction sits under it.
//   • The vocabulary ceiling follows HSK, like the rest of the platform.
//
// Free-tier limit is counted in MESSAGES, not minutes — see lib/chatQuota.js
// for why the minute meter is the wrong unit here.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';
import { usePhone } from '../hooks/useMediaQuery';
import {
  chatExceeded, messagesRemaining, recordChatMessage,
} from '../lib/chatQuota.js';

const PALETTE = {
  tint:   '#e0f2fe',   // sky — distinct from 场景对话's violet, same family
  accent: '#0369a1',
  soft:   '#7dd3fc',
  ink:    '#1a0a05',
  ink2:   '#6b4c2a',
  ink3:   '#a07850',
  bg:     'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
};

const STR = {
  title:       { zh: '智能对话',       en: 'AI Chat Tutor',    it: 'Tutor AI' },
  placeholder: { zh: '用中文说点什么…', en: 'Say something in Chinese…', it: 'Scrivi in cinese…' },
  send:        { zh: '发送',           en: 'Send',             it: 'Invia' },
  thinking:    { zh: '老师在想…',      en: 'Tutor is typing…', it: 'Il tutor scrive…' },
  show_trans:  { zh: '显示翻译',       en: 'Show translation', it: 'Mostra traduzione' },
  hide_trans:  { zh: '隐藏翻译',       en: 'Hide translation', it: 'Nascondi traduzione' },
  show_pinyin: { zh: '显示拼音',       en: 'Show pinyin',      it: 'Mostra pinyin' },
  hide_pinyin: { zh: '隐藏拼音',       en: 'Hide pinyin',      it: 'Nascondi pinyin' },
  level:       { zh: '难度',           en: 'Level',            it: 'Livello' },
  starters:    { zh: '选一个话题开始：', en: 'Pick a topic to start:', it: 'Scegli un argomento:' },
  intro:       { zh: '和 AI 老师用中文聊天。说错了没关系 —— 老师会温和地纠正你。',
                 en: 'Chat in Chinese with an AI tutor. Mistakes are fine — you will get one gentle correction at a time.',
                 it: 'Chatta in cinese con un tutor AI. Gli errori vanno bene — riceverai una correzione gentile alla volta.' },
  tip:         { zh: '提示',           en: 'Tip',              it: 'Suggerimento' },
  error:       { zh: '没能连上老师，请再试一次。', en: 'Could not reach the tutor. Please try again.',
                 it: 'Impossibile contattare il tutor. Riprova.' },
  retry:       { zh: '重试',           en: 'Retry',            it: 'Riprova' },
  left:        { zh: '今天还剩 %n 句', en: '%n messages left today', it: '%n messaggi rimasti oggi' },
  spent:       { zh: '今天的免费对话用完了。登录后可以继续聊。',
                 en: 'You have used today’s free messages. Sign in to keep chatting.',
                 it: 'Hai finito i messaggi gratuiti di oggi. Accedi per continuare.' },
  login:       { zh: '登录',           en: 'Sign in',          it: 'Accedi' },
  clear:       { zh: '重新开始',       en: 'Start over',       it: 'Ricomincia' },
  listen:      { zh: '朗读',           en: 'Listen',           it: 'Ascolta' },
};
function tr(L, k) {
  const code = L === 'en' || L === 'it' || L === 'zh' ? L : 'zh';
  return STR[k]?.[code] ?? STR[k]?.zh ?? k;
}

// Openers, not lessons. Each is something a real beginner can answer with a
// sentence they already have, which is the only way a first turn goes well.
const STARTERS = [
  { emoji: '👋', zh: '你好！我叫…', en: 'Say hello',        it: 'Saluta' },
  { emoji: '🍜', zh: '我喜欢吃…',   en: 'Food you like',    it: 'Cibo preferito' },
  { emoji: '🏫', zh: '说说我的学校', en: 'About my school',  it: 'La mia scuola' },
  { emoji: '🌦️', zh: '今天天气怎么样？', en: 'The weather',  it: 'Il tempo' },
  { emoji: '👨‍👩‍👧', zh: '介绍我的家人', en: 'My family',   it: 'La mia famiglia' },
  { emoji: '⚽', zh: '我的爱好是…',  en: 'My hobbies',       it: 'I miei hobby' },
];

// The learner's own pace of speech, not a character drill — so the whole
// sentence is read, unlike useTTS which clips at the first comma.
function speak(text) {
  if (!text) return;
  let audio = document.getElementById('clf-chat-tts');
  if (!audio) {
    audio = document.createElement('audio');
    audio.id = 'clf-chat-tts';
    audio.style.display = 'none';
    document.body.appendChild(audio);
  }
  audio.onerror = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'zh-CN';
    utt.rate = 0.85;
    window.speechSynthesis.speak(utt);
  };
  audio.src = `/.netlify/functions/tts-proxy?text=${encodeURIComponent(text)}`;
  audio.play().catch(() => audio.onerror());
}

export default function ChatApp({ onBack }) {
  const { lang } = useLang();
  const isPhone = usePhone();
  const L = lang === 'en' || lang === 'it' || lang === 'zh' ? lang : 'zh';

  const [turns,      setTurns]      = useState([]);   // {role, zh, pinyin, translation, correction}
  const [draft,      setDraft]      = useState('');
  const [busy,       setBusy]       = useState(false);
  const [failed,     setFailed]     = useState(null); // the text to retry
  const [hsk,        setHsk]        = useState(() => Number(localStorage.getItem('clf_chat_hsk')) || 2);
  const [showTrans,  setShowTrans]  = useState(L !== 'zh');
  const [showPinyin, setShowPinyin] = useState(true);

  // 0 = unlimited, matching the launch policy of open free use and the same
  // fallback useUsageGate takes. A settings table that cannot be read must not
  // silently impose a limit nobody configured.
  const [limit,   setLimit]   = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [isPaid,  setIsPaid]  = useState(false);

  const endRef = useRef(null);

  useEffect(() => { localStorage.setItem('clf_chat_hsk', String(hsk)); }, [hsk]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let paid = false;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data } = await supabase
            .from('clf_user_profiles')
            .select('tier_id, clf_tiers ( is_time_limited )')
            .eq('user_id', session.user.id)
            .maybeSingle();
          paid = !!data?.tier_id && data?.clf_tiers?.is_time_limited !== true;
        }
      } catch { /* offline or signed out — treat as a free visitor */ }

      let n = 0;
      try {
        const { data } = await supabase
          .from('clf_app_settings')
          .select('value')
          .eq('key', 'chat_free_messages_per_day')
          .maybeSingle();
        const v = Number(data?.value);
        if (Number.isFinite(v) && v >= 0) n = v;
      } catch { /* keep unlimited */ }

      if (cancelled) return;
      setIsPaid(paid);
      setLimit(n);
      setBlocked(!paid && chatExceeded(n));
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, busy]);

  const send = useCallback(async (text) => {
    const content = (text ?? draft).trim();
    if (!content || busy || blocked) return;

    setDraft('');
    setFailed(null);
    const mine = { role: 'user', zh: content };
    const history = [...turns, mine];
    setTurns(history);
    setBusy(true);

    try {
      const res = await fetch('/.netlify/functions/ai-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          hsk_level: hsk,
          ui_lang: L,
          // Only what the model needs: role and text. Pinyin and translations
          // we generated are ours, not part of what was said.
          messages: history.map(t => ({
            role: t.role === 'assistant' ? 'assistant' : 'user',
            content: t.zh,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      setTurns(prev => {
        const next = [...prev, {
          role: 'assistant',
          zh: data.reply,
          pinyin: data.pinyin,
          translation: data.translation,
        }];
        // The correction belongs to the message it is about, so it renders
        // under the learner's own words rather than as a separate scolding.
        if (data.correction) {
          const lastMine = next.map(t => t.role).lastIndexOf('user');
          if (lastMine >= 0) next[lastMine] = { ...next[lastMine], correction: data.correction };
        }
        return next;
      });

      if (!isPaid && limit > 0) {
        recordChatMessage();
        if (chatExceeded(limit)) setBlocked(true);
      }
    } catch {
      // Put their sentence back in the box. Losing what a learner typed in
      // Chinese, which may have taken a minute, is the worst possible failure.
      setTurns(prev => prev.slice(0, -1));
      setDraft(content);
      setFailed(content);
    } finally {
      setBusy(false);
    }
  }, [draft, busy, blocked, turns, hsk, L, isPaid, limit]);

  const remaining = isPaid ? Infinity : messagesRemaining(limit);

  return (
    <div style={{ minHeight: '100dvh', background: PALETTE.bg, color: PALETTE.ink,
      display: 'flex', flexDirection: 'column' }}>
      <Header
        title={tr(L, 'title')}
        onBack={onBack}
        onClear={turns.length ? () => { setTurns([]); setFailed(null); } : null}
        clearLabel={tr(L, 'clear')}
        isPhone={isPhone}
      />

      <Toolbar
        L={L} isPhone={isPhone}
        hsk={hsk} setHsk={setHsk}
        showPinyin={showPinyin} setShowPinyin={setShowPinyin}
        showTrans={showTrans} setShowTrans={setShowTrans}
        remaining={remaining}
      />

      <main style={{
        flex: 1, overflowY: 'auto',
        padding: isPhone ? '14px 14px 20px' : '20px 28px 28px',
        maxWidth: 880, width: '100%', margin: '0 auto',
      }}>
        {turns.length === 0 && (
          <Welcome L={L} isPhone={isPhone} onPick={send} disabled={busy || blocked}/>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {turns.map((t, i) => (
            <Bubble key={i} turn={t} L={L} isPhone={isPhone}
              showPinyin={showPinyin} showTrans={showTrans}/>
          ))}
          {busy && <Typing label={tr(L, 'thinking')}/>}
          {failed && (
            <div style={{ textAlign: 'center', color: '#b45309', fontSize: 13 }}>
              {tr(L, 'error')}{' '}
              <button onClick={() => send(failed)} style={{
                background: 'none', border: 'none', color: PALETTE.accent,
                textDecoration: 'underline', cursor: 'pointer', fontSize: 13,
              }}>{tr(L, 'retry')}</button>
            </div>
          )}
        </div>
        <div ref={endRef}/>
      </main>

      {blocked
        ? <Spent L={L} isPhone={isPhone}/>
        : <Composer
            L={L} isPhone={isPhone}
            draft={draft} setDraft={setDraft}
            onSend={() => send()} busy={busy}/>}
    </div>
  );
}

function Header({ title, onBack, onClear, clearLabel, isPhone }) {
  return (
    <header style={{
      padding: isPhone ? '12px 16px' : '18px 24px',
      paddingTop: `calc(${isPhone ? 12 : 18}px + var(--safe-top))`,
      background: `linear-gradient(90deg, ${PALETTE.accent} 0%, #075985 100%)`,
      color: '#f0f9ff',
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    }}>
      <button onClick={onBack} aria-label="Back" style={{
        background: 'rgba(255,255,255,0.15)', color: '#f0f9ff',
        border: '1px solid rgba(255,255,255,0.3)',
        width: 32, height: 32, borderRadius: 16, padding: 0,
        cursor: 'pointer', fontSize: 16, flexShrink: 0,
      }}>‹</button>
      <div style={{ fontSize: isPhone ? 18 : 22, fontWeight: 700, flex: 1,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: isPhone ? 2 : 3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      {onClear && (
        <button onClick={onClear} style={{
          background: 'rgba(255,255,255,0.15)', color: '#f0f9ff',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '5px 12px', borderRadius: 14,
          cursor: 'pointer', fontSize: 12, flexShrink: 0,
        }}>{clearLabel}</button>
      )}
    </header>
  );
}

function Toolbar({ L, isPhone, hsk, setHsk, showPinyin, setShowPinyin, showTrans, setShowTrans, remaining }) {
  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      padding: isPhone ? '10px 14px' : '12px 28px',
      maxWidth: 880, width: '100%', margin: '0 auto',
      borderBottom: `1px solid ${PALETTE.soft}55`, flexShrink: 0,
    }}>
      <span style={{ fontSize: 12, color: PALETTE.ink3 }}>{tr(L, 'level')}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5, 6].map(n => (
          <button key={n} onClick={() => setHsk(n)} aria-pressed={hsk === n} style={{
            width: 26, height: 26, borderRadius: 13, padding: 0,
            background: hsk === n ? PALETTE.accent : '#fff',
            color: hsk === n ? '#f0f9ff' : PALETTE.accent,
            border: `1.5px solid ${PALETTE.accent}`,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}>{n}</button>
        ))}
      </div>
      <div style={{ flex: 1 }}/>
      <Toggle on={showPinyin} onClick={() => setShowPinyin(v => !v)}
        label={tr(L, showPinyin ? 'hide_pinyin' : 'show_pinyin')}/>
      {L !== 'zh' && (
        <Toggle on={showTrans} onClick={() => setShowTrans(v => !v)}
          label={tr(L, showTrans ? 'hide_trans' : 'show_trans')}/>
      )}
      {Number.isFinite(remaining) && (
        <span style={{ fontSize: 11, color: remaining <= 3 ? '#b45309' : PALETTE.ink3 }}>
          {tr(L, 'left').replace('%n', remaining)}
        </span>
      )}
    </div>
  );
}

function Toggle({ on, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      background: on ? PALETTE.accent : '#fff',
      color: on ? '#f0f9ff' : PALETTE.accent,
      border: `1.5px solid ${PALETTE.accent}`,
      padding: '5px 11px', borderRadius: 16,
      fontSize: 11, fontWeight: 600, cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
    }}>{label}</button>
  );
}

function Welcome({ L, isPhone, onPick, disabled }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        background: '#fff', border: `1.5px solid ${PALETTE.soft}`,
        borderRadius: 16, padding: isPhone ? '14px 16px' : '18px 22px',
        color: PALETTE.ink2, fontSize: isPhone ? 13 : 14, lineHeight: 1.6,
      }}>
        {tr(L, 'intro')}
      </div>
      <div style={{ margin: '18px 0 10px', fontSize: 12, color: PALETTE.ink3 }}>
        {tr(L, 'starters')}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isPhone ? '1fr 1fr' : 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 10,
      }}>
        {STARTERS.map(s => (
          <button key={s.zh} disabled={disabled} onClick={() => onPick(s.zh)} style={{
            background: '#fff', border: `1.5px solid ${PALETTE.soft}`,
            borderRadius: 14, padding: '12px 14px', cursor: disabled ? 'default' : 'pointer',
            textAlign: 'left', color: PALETTE.ink, opacity: disabled ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: 10,
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{s.emoji}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600,
                fontFamily: "'STKaiti','KaiTi',serif",
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.zh}</span>
              {L !== 'zh' && (
                <span style={{ display: 'block', fontSize: 11, color: PALETTE.ink3 }}>
                  {s[L] || s.en}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({ turn, L, isPhone, showPinyin, showTrans }) {
  const mine = turn.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column',
      alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: isPhone ? '88%' : '72%',
        background: mine ? PALETTE.tint : '#fff',
        border: `1.5px solid ${mine ? PALETTE.accent + '33' : PALETTE.soft}`,
        borderRadius: 16,
        borderTopLeftRadius:  mine ? 16 : 4,
        borderTopRightRadius: mine ? 4 : 16,
        padding: isPhone ? '10px 14px' : '12px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{
            fontSize: isPhone ? 19 : 21, fontWeight: 600,
            fontFamily: "'STKaiti','KaiTi',serif",
            color: PALETTE.ink, lineHeight: 1.5, flex: 1,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>{turn.zh}</div>
          {!mine && (
            <button onClick={() => speak(turn.zh)} aria-label={tr(L, 'listen')} title={tr(L, 'listen')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 16, padding: 2, lineHeight: 1, flexShrink: 0, opacity: 0.65,
              }}>🔊</button>
          )}
        </div>
        {!mine && showPinyin && turn.pinyin && (
          <div style={{ fontSize: isPhone ? 12 : 13, color: PALETTE.ink2,
            marginTop: 5, fontStyle: 'italic' }}>{turn.pinyin}</div>
        )}
        {!mine && showTrans && turn.translation && (
          <div style={{ fontSize: isPhone ? 13 : 14, color: PALETTE.accent,
            marginTop: 6, opacity: 0.9 }}>{turn.translation}</div>
        )}
      </div>

      {turn.correction && (
        <div style={{
          maxWidth: isPhone ? '88%' : '72%',
          marginTop: 6,
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: 12,
          padding: '8px 12px',
          fontSize: isPhone ? 12 : 13,
          color: '#92400e',
          lineHeight: 1.5,
        }}>
          <strong style={{ fontWeight: 700 }}>{tr(L, 'tip')}: </strong>{turn.correction}
        </div>
      )}
    </div>
  );
}

function Typing({ label }) {
  return (
    <div style={{ alignSelf: 'flex-start', color: PALETTE.ink3, fontSize: 13,
      padding: '8px 4px' }}>{label}</div>
  );
}

function Composer({ L, isPhone, draft, setDraft, onSend, busy }) {
  return (
    <div style={{
      flexShrink: 0,
      borderTop: `1px solid ${PALETTE.soft}55`,
      background: 'rgba(255,255,255,0.6)',
      padding: isPhone ? '10px 14px' : '14px 28px',
      paddingBottom: `calc(${isPhone ? 10 : 14}px + var(--safe-bottom, 0px))`,
    }}>
      <div style={{ display: 'flex', gap: 8, maxWidth: 880, margin: '0 auto' }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={tr(L, 'placeholder')}
          maxLength={500}
          disabled={busy}
          style={{
            flex: 1, minWidth: 0,
            padding: isPhone ? '11px 14px' : '12px 16px',
            borderRadius: 22,
            border: `1.5px solid ${PALETTE.soft}`,
            background: '#fff', color: PALETTE.ink,
            fontSize: isPhone ? 15 : 16,
            fontFamily: "'STKaiti','KaiTi',serif",
            outline: 'none',
          }}/>
        <button onClick={onSend} disabled={busy || !draft.trim()} style={{
          background: busy || !draft.trim() ? PALETTE.soft : PALETTE.accent,
          color: '#f0f9ff', border: 'none',
          padding: isPhone ? '0 18px' : '0 22px',
          borderRadius: 22, fontSize: 14, fontWeight: 600,
          cursor: busy || !draft.trim() ? 'default' : 'pointer',
          flexShrink: 0, WebkitTapHighlightColor: 'transparent',
        }}>{tr(L, 'send')}</button>
      </div>
    </div>
  );
}

function Spent({ L, isPhone }) {
  return (
    <div style={{
      flexShrink: 0,
      borderTop: `1px solid ${PALETTE.soft}55`,
      background: '#fffbeb',
      padding: isPhone ? '16px 14px' : '20px 28px',
      paddingBottom: `calc(${isPhone ? 16 : 20}px + var(--safe-bottom, 0px))`,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: isPhone ? 13 : 14, color: '#92400e', marginBottom: 10 }}>
        {tr(L, 'spent')}
      </div>
      <button onClick={() => { window.location.href = '/login'; }} style={{
        background: PALETTE.accent, color: '#f0f9ff', border: 'none',
        padding: '10px 26px', borderRadius: 20,
        fontSize: 14, fontWeight: 600, cursor: 'pointer',
      }}>{tr(L, 'login')}</button>
    </div>
  );
}
