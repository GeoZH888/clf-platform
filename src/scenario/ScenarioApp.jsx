// src/scenario/ScenarioApp.jsx
// 场景对话 student reader.
//   • List view: published scenarios from clf_scenarios, with category +
//     difficulty + cover emoji.
//   • Detail view: chat-bubble dialogue rendering clf_scenario_lines.
//     Chinese line is always shown with pinyin below; user can toggle the
//     translation in their UI language (en/it) on/off.
//
// Lang source: useLang() from ../context/LanguageContext — this is the
// provider App.jsx wraps the /learn tree with, kept reactive via the global
// 'clf-langchange' event from FloatingLangMenu. (The other LanguageContext
// under school/contexts/ is not mounted on this route.)

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';
import { usePhone } from '../hooks/useMediaQuery';

const PALETTE = {
  tint:   '#ede9fe',   // violet — matches the community tile category
  accent: '#6d28d9',
  soft:   '#c4b5fd',
  ink:    '#1a0a05',
  ink2:   '#6b4c2a',
  ink3:   '#a07850',
  bg:     'linear-gradient(160deg, #fdf6e3 0%, #f5e6c8 50%, #f0d9b5 100%)',
};

const STR = {
  title:        { zh: '场景对话',         en: 'Scenario Dialogues',  it: 'Dialoghi di Scenari' },
  back:         { zh: '返回',             en: 'Back',                it: 'Indietro' },
  empty:        { zh: '还没有发布场景。', en: 'No scenarios yet.',   it: 'Nessuno scenario.' },
  loading:      { zh: '加载中…',          en: 'Loading…',            it: 'Caricamento…' },
  show_trans:   { zh: '显示翻译',         en: 'Show translation',    it: 'Mostra traduzione' },
  hide_trans:   { zh: '隐藏翻译',         en: 'Hide translation',    it: 'Nascondi traduzione' },
  show_pinyin:  { zh: '显示拼音',         en: 'Show pinyin',         it: 'Mostra pinyin' },
  hide_pinyin:  { zh: '隐藏拼音',         en: 'Hide pinyin',         it: 'Nascondi pinyin' },
  difficulty:   { zh: '难度',             en: 'Level',               it: 'Livello' },
  category:     { zh: '分类',             en: 'Category',            it: 'Categoria' },
};
function tr(L, k) {
  const code = L === 'en' || L === 'it' || L === 'zh' ? L : 'zh';
  return STR[k]?.[code] ?? STR[k]?.zh ?? k;
}

const CATEGORY_LABEL = {
  daily:   { zh: '日常', en: 'Daily',   it: 'Quotidiano' },
  school:  { zh: '学校', en: 'School',  it: 'Scuola' },
  family:  { zh: '家庭', en: 'Family',  it: 'Famiglia' },
  travel:  { zh: '出行', en: 'Travel',  it: 'Viaggi' },
  health:  { zh: '健康', en: 'Health',  it: 'Salute' },
  shop:    { zh: '购物', en: 'Shop',    it: 'Negozio' },
  food:    { zh: '饮食', en: 'Food',    it: 'Cibo' },
  other:   { zh: '其他', en: 'Other',   it: 'Altro' },
};
const catLabel = (id, L) => CATEGORY_LABEL[id]?.[L] || id;

export default function ScenarioApp({ onBack }) {
  const { lang } = useLang();
  const isPhone = usePhone();
  const L = lang === 'en' || lang === 'it' || lang === 'zh' ? lang : 'zh';

  const [scenarios, setScenarios] = useState(null);  // null = loading
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clf_scenarios')
        .select('*')
        .eq('is_published', true)
        .order('order_idx', { ascending: true })
        .order('created_at', { ascending: false });
      setScenarios(data || []);
    })();
  }, []);

  const open = openId ? scenarios?.find(s => s.id === openId) : null;

  return (
    <div style={{ minHeight: '100dvh', background: PALETTE.bg, color: PALETTE.ink }}>
      <Header
        title={open ? titleFor(open, L) : tr(L, 'title')}
        onBack={() => open ? setOpenId(null) : onBack?.()}
        isPhone={isPhone}
      />
      <main style={{ padding: isPhone ? '16px 14px 40px' : '24px 28px 48px',
        maxWidth: 880, margin: '0 auto' }}>
        {scenarios === null && <Centered>{tr(L, 'loading')}</Centered>}
        {scenarios && scenarios.length === 0 && <Centered>{tr(L, 'empty')}</Centered>}
        {scenarios && !open && (
          <ScenarioList scenarios={scenarios} L={L} onOpen={setOpenId} isPhone={isPhone}/>
        )}
        {open && <ScenarioReader scenario={open} L={L} isPhone={isPhone}/>}
      </main>
    </div>
  );
}

function titleFor(s, L) {
  return (L === 'en' && s.title_en) || (L === 'it' && s.title_it) || s.title_zh || s.slug;
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

function ScenarioList({ scenarios, L, onOpen, isPhone }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isPhone
        ? '1fr'
        : 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: isPhone ? 12 : 18,
    }}>
      {scenarios.map(s => (
        <button key={s.id} onClick={() => onOpen(s.id)} style={{
          background: '#fff',
          border: `1.5px solid ${PALETTE.soft}`,
          borderRadius: 16,
          padding: isPhone ? '14px 14px' : '18px 18px',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 14,
          color: PALETTE.ink,
          transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'manipulation',
        }}>
          <div style={{
            width: isPhone ? 48 : 56, height: isPhone ? 48 : 56, borderRadius: '50%',
            background: PALETTE.tint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isPhone ? 28 : 32, lineHeight: 1, flexShrink: 0,
          }}>{s.cover_emoji || '💬'}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: isPhone ? 16 : 18, fontWeight: 700,
              color: PALETTE.accent,
              fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {titleFor(s, L)}
            </div>
            <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {s.category && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: PALETTE.tint, color: PALETTE.accent }}>
                  {catLabel(s.category, L)}
                </span>
              )}
              {s.difficulty && (
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: '#fff8e1', color: '#b45309' }}>
                  {'⭐'.repeat(s.difficulty)}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ScenarioReader({ scenario, L, isPhone }) {
  const [lines, setLines] = useState(null);
  const [showTrans, setShowTrans] = useState(L !== 'zh');
  const [showPinyin, setShowPinyin] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clf_scenario_lines')
        .select('*')
        .eq('scenario_id', scenario.id)
        .order('line_order', { ascending: true });
      setLines(data || []);
    })();
  }, [scenario.id]);

  if (lines === null) return <Centered>{tr(L, 'loading')}</Centered>;

  return (
    <div>
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        marginBottom: 18, justifyContent: 'flex-end',
      }}>
        <Toggle on={showPinyin} onClick={() => setShowPinyin(v => !v)}
          label={tr(L, showPinyin ? 'hide_pinyin' : 'show_pinyin')}/>
        {L !== 'zh' && (
          <Toggle on={showTrans} onClick={() => setShowTrans(v => !v)}
            label={tr(L, showTrans ? 'hide_trans' : 'show_trans')}/>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {lines.map(line => (
          <LineBubble key={line.id}
            line={line}
            speakerA={scenario.speaker_a_name || 'A'}
            speakerB={scenario.speaker_b_name || 'B'}
            L={L} showTrans={showTrans} showPinyin={showPinyin}
            isPhone={isPhone}/>
        ))}
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

function LineBubble({ line, speakerA, speakerB, L, showTrans, showPinyin, isPhone }) {
  const isA = line.speaker === 'A';
  const speakerName = isA ? speakerA : speakerB;
  const translation = (L === 'en' && line.text_en) || (L === 'it' && line.text_it) || '';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isA ? 'flex-start' : 'flex-end',
    }}>
      <div style={{ maxWidth: isPhone ? '85%' : '70%' }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: PALETTE.ink3,
          marginBottom: 4, textAlign: isA ? 'left' : 'right',
        }}>{speakerName}</div>
        <div style={{
          background: isA ? '#fff' : PALETTE.tint,
          border: `1.5px solid ${isA ? PALETTE.soft : PALETTE.accent}33`,
          borderRadius: 16,
          borderTopLeftRadius:  isA ? 4 : 16,
          borderTopRightRadius: isA ? 16 : 4,
          padding: isPhone ? '10px 14px' : '12px 18px',
        }}>
          <div style={{
            fontSize: isPhone ? 20 : 22, fontWeight: 600,
            fontFamily: "'STKaiti','KaiTi',serif",
            color: PALETTE.ink, lineHeight: 1.4,
          }}>{line.text_zh}</div>
          {showPinyin && line.pinyin && (
            <div style={{ fontSize: isPhone ? 12 : 13,
              color: PALETTE.ink2, marginTop: 4, fontStyle: 'italic' }}>{line.pinyin}</div>
          )}
          {showTrans && translation && (
            <div style={{ fontSize: isPhone ? 13 : 14, color: PALETTE.accent,
              marginTop: 6, opacity: 0.9 }}>{translation}</div>
          )}
        </div>
      </div>
    </div>
  );
}
