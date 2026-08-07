// src/story/StoryApp.jsx
// 故事会 student reader.
//   • List view: published stories from clf_stories, with cover image,
//     difficulty stars, summary.
//   • Reader view: paginated clf_story_pages. Each page renders image_url +
//     Chinese text + pinyin. Translation lives at the story level (summary)
//     since pages only store zh + pinyin per the schema.
//
// Lang source: useLang() from ../context/LanguageContext — this is the
// provider App.jsx wraps the /learn tree with, kept reactive via the global
// 'clf-langchange' event from FloatingLangMenu. (The other LanguageContext
// under school/contexts/ is not mounted on this route.)

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';
import { usePhone } from '../hooks/useMediaQuery';

const PALETTE = {
  tint:   '#ede9fe',
  accent: '#6d28d9',
  soft:   '#c4b5fd',
  ink:    '#1a0a05',
  ink2:   '#6b4c2a',
  ink3:   '#a07850',
  bg:     'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
};

const STR = {
  title:      { zh: '故事会',       en: 'Story Time',    it: 'Ora delle Storie' },
  back:       { zh: '返回',         en: 'Back',          it: 'Indietro' },
  empty:      { zh: '还没有发布故事。', en: 'No stories yet.', it: 'Nessuna storia.' },
  loading:    { zh: '加载中…',      en: 'Loading…',      it: 'Caricamento…' },
  prev:       { zh: '上一页',       en: 'Previous',      it: 'Precedente' },
  next:       { zh: '下一页',       en: 'Next',          it: 'Avanti' },
  page_of:    { zh: '页',           en: 'of',            it: 'di' },
  show_pinyin:{ zh: '显示拼音',     en: 'Show pinyin',   it: 'Mostra pinyin' },
  hide_pinyin:{ zh: '隐藏拼音',     en: 'Hide pinyin',   it: 'Nascondi pinyin' },
  listen:     { zh: '朗读',         en: 'Listen',        it: 'Ascolta' },
  stop:       { zh: '停止',         en: 'Stop',          it: 'Ferma' },
};
function tr(L, k) {
  const code = L === 'en' || L === 'it' || L === 'zh' ? L : 'zh';
  return STR[k]?.[code] ?? STR[k]?.zh ?? k;
}

export default function StoryApp({ onBack }) {
  const { lang } = useLang();
  const isPhone = usePhone();
  const L = lang === 'en' || lang === 'it' || lang === 'zh' ? lang : 'zh';

  const [stories, setStories] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clf_stories')
        .select('*')
        .eq('is_published', true)
        .order('order_idx', { ascending: true })
        .order('created_at', { ascending: false });
      setStories(data || []);
    })();
  }, []);

  const open = openId ? stories?.find(s => s.id === openId) : null;

  return (
    <div style={{ minHeight: '100dvh', background: PALETTE.bg, color: PALETTE.ink }}>
      <Header
        title={open ? titleFor(open, L) : tr(L, 'title')}
        onBack={() => open ? setOpenId(null) : onBack?.()}
        isPhone={isPhone}
      />
      <main style={{ padding: isPhone ? '16px 14px 40px' : '24px 28px 48px',
        maxWidth: 760, margin: '0 auto' }}>
        {stories === null && <Centered>{tr(L, 'loading')}</Centered>}
        {stories && stories.length === 0 && <Centered>{tr(L, 'empty')}</Centered>}
        {stories && !open && (
          <StoryList stories={stories} L={L} onOpen={setOpenId} isPhone={isPhone}/>
        )}
        {open && <StoryReader story={open} L={L} isPhone={isPhone}/>}
      </main>
    </div>
  );
}

function titleFor(s, L) {
  return (L === 'en' && s.title_en) || (L === 'it' && s.title_it) || s.title_zh || s.slug;
}
function summaryFor(s, L) {
  return (L === 'en' && s.summary_en) || (L === 'it' && s.summary_it) || s.summary_zh || '';
}

function Header({ title, onBack, isPhone }) {
  return (
    <header style={{
      padding: isPhone ? '12px 16px' : '18px 24px',
      paddingTop: `calc(${isPhone ? 12 : 18}px + var(--safe-top))`,
      background: `linear-gradient(90deg, ${PALETTE.accent} 0%, #4c1d95 100%)`,
      color: '#fff5e6',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <button onClick={onBack} aria-label="Back" style={{
        background: 'rgba(255,255,255,0.15)', color: '#fff5e6',
        border: '1px solid rgba(255,255,255,0.3)',
        width: 32, height: 32, borderRadius: 16, padding: 0,
        cursor: 'pointer', fontSize: 16,
      }}>‹</button>
      <div style={{ fontSize: isPhone ? 18 : 22, fontWeight: 700,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: isPhone ? 2 : 3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
    </header>
  );
}

function Centered({ children }) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: PALETTE.ink3 }}>{children}</div>
  );
}

function StoryList({ stories, L, onOpen, isPhone }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isPhone ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: isPhone ? 12 : 18,
    }}>
      {stories.map(s => (
        <button key={s.id} onClick={() => onOpen(s.id)} style={{
          background: '#fff',
          border: `1.5px solid ${PALETTE.soft}`,
          borderRadius: 16,
          padding: 0,
          overflow: 'hidden',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex', flexDirection: 'column',
          color: PALETTE.ink,
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}>
          <div style={{
            width: '100%', height: isPhone ? 140 : 160,
            background: s.cover_image_url
              ? `url(${s.cover_image_url}) center/cover`
              : PALETTE.tint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40,
          }}>
            {!s.cover_image_url && '📖'}
          </div>
          <div style={{ padding: isPhone ? '12px 14px 14px' : '14px 18px 16px' }}>
            <div style={{ fontSize: isPhone ? 17 : 19, fontWeight: 700,
              color: PALETTE.accent,
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1 }}>
              {titleFor(s, L)}
            </div>
            {s.difficulty && (
              <div style={{ marginTop: 6, display: 'inline-block',
                fontSize: 11, padding: '2px 8px', borderRadius: 10,
                background: '#fff8e1', color: '#b45309' }}>
                {'⭐'.repeat(s.difficulty)}
              </div>
            )}
            {summaryFor(s, L) && (
              <div style={{ fontSize: 13, color: PALETTE.ink2, marginTop: 8,
                lineHeight: 1.4 }}>{summaryFor(s, L)}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function StoryReader({ story, L, isPhone }) {
  const [pages, setPages] = useState(null);
  const [idx, setIdx] = useState(0);
  const [showPinyin, setShowPinyin] = useState(true);
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  // Turning the page must silence the previous page's narration.
  useEffect(() => {
    const el = audioRef.current;
    if (el) { el.pause(); el.currentTime = 0; }
    setPlaying(false);
  }, [idx]);

  function toggleAudio() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else { el.pause(); setPlaying(false); }
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clf_story_pages')
        .select('*')
        .eq('story_id', story.id)
        .order('page_order', { ascending: true });
      setPages(data || []);
      setIdx(0);
    })();
  }, [story.id]);

  if (pages === null) return <Centered>{tr(L, 'loading')}</Centered>;
  if (pages.length === 0) return <Centered>{tr(L, 'empty')}</Centered>;

  const page = pages[idx];
  const last = pages.length - 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        {page.audio_url && (
          <>
            <Toggle on={playing} onClick={toggleAudio}
              label={`${playing ? '⏸' : '🔊'} ${tr(L, playing ? 'stop' : 'listen')}`}/>
            <audio
              key={page.audio_url}
              ref={audioRef}
              src={page.audio_url}
              preload="none"
              onEnded={() => setPlaying(false)}
              onPause={() => setPlaying(false)}
              style={{ display: 'none' }}
            />
          </>
        )}
        <Toggle on={showPinyin} onClick={() => setShowPinyin(v => !v)}
          label={tr(L, showPinyin ? 'hide_pinyin' : 'show_pinyin')}/>
      </div>

      <div style={{
        background: '#fff',
        border: `1.5px solid ${PALETTE.soft}`,
        borderRadius: 18,
        overflow: 'hidden',
      }}>
        {page.image_url && (
          <div style={{
            width: '100%',
            aspectRatio: '16 / 9',
            background: `url(${page.image_url}) center/cover`,
          }}/>
        )}
        <div style={{ padding: isPhone ? '18px 18px 22px' : '24px 28px 28px' }}>
          <div style={{
            fontSize: isPhone ? 20 : 24, fontWeight: 600,
            fontFamily: "'STKaiti','KaiTi',serif",
            color: PALETTE.ink, lineHeight: 1.7, whiteSpace: 'pre-wrap',
          }}>{page.text_zh}</div>
          {showPinyin && page.pinyin && (
            <div style={{ fontSize: isPhone ? 13 : 14, color: PALETTE.ink2,
              marginTop: 12, fontStyle: 'italic', lineHeight: 1.5,
              whiteSpace: 'pre-wrap' }}>{page.pinyin}</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 10 }}>
        <NavBtn disabled={idx === 0} onClick={() => setIdx(i => Math.max(0, i - 1))}>
          ‹ {tr(L, 'prev')}
        </NavBtn>
        <div style={{ fontSize: 12, color: PALETTE.ink3, fontWeight: 600 }}>
          {idx + 1} / {pages.length}
        </div>
        <NavBtn disabled={idx === last} onClick={() => setIdx(i => Math.min(last, i + 1))}>
          {tr(L, 'next')} ›
        </NavBtn>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      background: on ? PALETTE.accent : '#fff',
      color: on ? '#fff5e6' : PALETTE.accent,
      border: `1.5px solid ${PALETTE.accent}`,
      padding: '6px 12px', borderRadius: 18,
      fontSize: 12, fontWeight: 600,
      cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
    }}>{label}</button>
  );
}

function NavBtn({ children, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? '#f3f4f6' : PALETTE.accent,
      color: disabled ? '#9ca3af' : '#fff5e6',
      border: 'none',
      padding: '10px 18px', borderRadius: 22,
      fontSize: 13, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer',
      WebkitTapHighlightColor: 'transparent',
      minWidth: 110,
    }}>{children}</button>
  );
}
