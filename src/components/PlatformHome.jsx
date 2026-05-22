// src/components/PlatformHome.jsx
// Platform hub. Two responsibilities:
//   1. Own the learning-path scope (HSK / Jinan / Theme / All) that applies
//      to ALL modules. Path is persisted to localStorage under
//      "clf_current_path". Each module reads this key on mount and filters
//      its content accordingly.
//   2. List modules via the MODULES array below. Adding a new module is
//      one object append here + one render case in App.jsx.
//
// Current modules: lianzi (character writing), pinyin.
// Easy to add: words, chengyu, poetry, grammar, hsk, games.

import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import { supabase } from '../lib/supabase.js';
import PathSelector from './PathSelector.jsx';
import LangSwitcher from './LangSwitcher.jsx';

const PATH_STORAGE_KEY = 'clf_current_path';

// In-memory cache so pandas stay stable across re-renders within the session.
// Cleared when the tab is closed.
let PANDA_CACHE = null;

// â”€â”€ Module registry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// id â†’ must match what App.jsx's onSelect expects (e.g. 'lianzi' â†’ 'home').
// emoji, name, desc, features, tag â†’ display content in three languages.
// color / border / text â†’ card theme colors.
//
// To add a new module: append an entry here, then add a render case in
// App.jsx. No other changes to this file are required.
const MODULES = [
  {
    id:       'lianzi',
    emoji:    'ðŸ¼',
    // If you later want to use a custom panda illustration asset, set
    // iconImage to a URL/path (e.g. '/panda-lianzi.png' in /public) and it
    // will override the emoji in ModuleCard.
    iconImage: null,
    name:     { zh:'ç»ƒå­—', en:'Character Writing', it:'Scrittura' },
    desc:     { zh:'ç¬”é¡º Â· è½¯ç¬” Â· å£°è°ƒç»ƒä¹ ',
                en:'Stroke order Â· brush Â· tones',
                it:'Tratti Â· pennello Â· toni' },
    features: [
      { zh:'å­—å½¢ä¸´æ‘¹',     en:'Character tracing',  it:'Tracciamento' },
      { zh:'ç¬”é¡ºåŠ¨ç”»å¼•å¯¼', en:'Stroke animations',  it:'Animazioni tratti' },
      { zh:'è½¯ç¬”/ç¡¬ç¬”ç»ƒä¹ ', en:'Brush & hard pen',   it:'Pennello e penna' },
      { zh:'å£°è°ƒæœ—è¯»è¯„åˆ†', en:'Tone scoring',       it:'Punteggio toni' },
    ],
    tag:      { zh:'ä¹¦æ³•', en:'Calligraphy', it:'Calligrafia' },
    color:    '#FBE9E7',
    border:   '#8B4513',
    text:     '#5D2E0C',
  },
  {
    id:       'pinyin',
    emoji:    'ðŸ¼',
    iconImage: null,  // set to e.g. '/panda-pinyin.png' to use a custom illustration
    name:     { zh:'æ‹¼éŸ³', en:'Pinyin', it:'Pinyin' },
    desc:     { zh:'å£°æ¯ Â· éŸµæ¯ Â· å››å£° Â· å‘éŸ³',
                en:'Initials Â· finals Â· tones Â· speech',
                it:'Iniziali Â· finali Â· toni Â· voce' },
    features: [
      { zh:'å£°æ¯éŸµæ¯è¡¨', en:'Initials & finals',     it:'Iniziali e finali' },
      { zh:'å››å£°ç»ƒä¹ ',   en:'Tone practice',         it:'Pratica toni' },
      { zh:'å¬éŸ³è¯†è°ƒ',   en:'Listen & identify',     it:'Ascolta e identifica' },
      { zh:'å‘éŸ³æ‰“åˆ†',   en:'Speech scoring',        it:'Punteggio voce' },
    ],
    tag:      { zh:'å‘éŸ³', en:'Pronunciation', it:'Pronuncia' },
    color:    '#E3F2FD',
    border:   '#1565C0',
    text:     '#0C3C7A',
  },

  {
    id:       'words',
    emoji:    'ðŸ¼',
    iconImage: null,
    name:     { zh:'è¯è¯­', en:'Vocabulary', it:'Vocabolario' },
    desc:     { zh:'ç”Ÿè¯ Â· é—ªå¡ Â· å¬å†™',
                en:'Words Â· flashcards Â· dictation',
                it:'Parole Â· flashcard Â· dettato' },
    features: [
      { zh:'é—ªå¡è®°å¿†',   en:'Flashcards',         it:'Flashcard' },
      { zh:'å¬è¯é€‰ä¹‰',   en:'Listen & choose',    it:'Ascolta e scegli' },
      { zh:'çœ‹ä¹‰å¡«è¯',   en:'Fill in blank',      it:'Completa' },
      { zh:'ä¸»é¢˜åˆ†ç±»',   en:'Browse by theme',    it:'Per tema' },
    ],
    tag:      { zh:'è¯æ±‡', en:'Vocab', it:'Vocab' },
    color:    '#E8F5E9',
    border:   '#2E7D32',
    text:     '#1B5E20',
  },

  {
    id:       'grammar',
    emoji:    'ðŸ¼',
    iconImage: null,
    name:     { zh:'è¯­æ³•', en:'Grammar', it:'Grammatica' },
    desc:     { zh:'å¾ªåºæ¸è¿› Â· è‡ªé€‚åº”ç»ƒä¹ ',
                en:'Step by step Â· adaptive practice',
                it:'Passo dopo passo Â· pratica adattiva' },
    features: [
      { zh:'åŸºç¡€å¥å¼', en:'Basic sentences',     it:'Frasi base' },
      { zh:'è®²è§£ä¾‹å¥', en:'Examples & rules',    it:'Esempi e regole' },
      { zh:'é‡èº«ç»ƒä¹ ', en:'Adaptive difficulty', it:'DifficoltÃ  adattiva' },
      { zh:'è¿›åº¦æŸ¥çœ‹', en:'Mastery tracking',   it:'Monitoraggio livello' },
    ],
    tag:      { zh:'ç»“æž„', en:'Structure', it:'Struttura' },
    color:    '#F5E8E8',
    border:   '#7B3F3F',
    text:     '#4A2020',
  },

  {
    id:       'chengyu',
    emoji:    'ðŸ¼',
    iconImage: null,
    name:     { zh:'æˆè¯­', en:'Idioms', it:'Proverbi' },
    desc:     { zh:'ä¸­åŽæˆè¯­ Â· å…¸æ•… Â· æ¸¸æˆ',
                en:'Chinese idioms Â· stories Â· games',
                it:'Proverbi cinesi Â· storie Â· giochi' },
    features: [
      { zh:'é—ªå¡è®°å¿†',   en:'Flashcards',       it:'Flashcard' },
      { zh:'é€‰ä¹‰æµ‹éªŒ',   en:'Meaning quiz',     it:'Quiz significato' },
      { zh:'é…å¯¹æ¸¸æˆ',   en:'Matching game',    it:'Abbinamento' },
      { zh:'æˆè¯­æŽ¥é¾™',   en:'Idiom chain',      it:'Catena proverbi' },
    ],
    tag:      { zh:'å…¸æ•…', en:'Classics', it:'Classici' },
    color:    '#FFF3E0',
    border:   '#8B4513',
    text:     '#5D2E0C',
  },

  {
    id:       'poetry',
    emoji:    'ðŸª·',
    iconImage: null,
    name:     { zh:'è¯—æ­Œ', en:'Poetry', it:'Poesia' },
    desc:     { zh:'å”è¯—å®‹è¯ Â· æ‹¼éŸ³ Â· æœ—è¯»',
                en:'Classical poems Â· pinyin Â· recitation',
                it:'Poesia classica Â· pinyin Â· recitazione' },
    features: [
      { zh:'å”è¯—å®‹è¯', en:'Tang & Song poems', it:'Poesie Tang e Song' },
      { zh:'é€å­—æ‹¼éŸ³', en:'Per-character pinyin', it:'Pinyin per carattere' },
      { zh:'ä¸‰è¯­ç¿»è¯‘', en:'Trilingual translation', it:'Traduzione trilingue' },
      { zh:'æ„å¢ƒæ’å›¾', en:'Atmospheric illustrations', it:'Illustrazioni' },
    ],
    tag:      { zh:'é£Žé›…', en:'Classics', it:'Classici' },
    color:    '#FFF8E1',     // æ·¡é‡‘è‰²èƒŒæ™¯
    border:   '#C8972A',     // é‡‘è‰²ï¼ˆè·Ÿ PoetryAdminTab GOLD ä¸€è‡´ï¼‰
    text:     '#6b4c2a',     // æ·±æ£•è‰²å­—
  },

  {
    id:       'riddles',
    emoji:    'ðŸ®',
    iconImage: null,
    name:     { zh:'ç¯è°œ', en:'Riddles', it:'Indovinelli' },
    desc:     { zh:'æ‹†å­— Â· è°éŸ³ Â· æ–‡åŒ–å…¸æ•…',
                en:'Wordplay Â· puns Â· cultural allusions',
                it:'Indovinelli classici Â· giochi di parole' },
                  features: [
      { zh:'å› äººè€Œå¼‚',     en:'Tailored to your level',   it:'Su misura per te' },
      { zh:'æ‹†å­— Â· è°éŸ³',   en:'Wordplay & decomposition', it:'Giochi di parole' },
      { zh:'æ¸è¿›æç¤º',     en:'Progressive hints',        it:'Suggerimenti graduali' },
      { zh:'è°œåº•è§£æž',     en:'Answer explanations',      it:'Spiegazioni' },
    ],
    tag:      { zh:'æ–‡åŒ–', en:'Culture', it:'Cultura' },
    color:    '#FFEBEE',     // æµ…çº¢èƒŒæ™¯ï¼Œå‘¼åº”ç¯ç¬¼å–œåº†
    border:   '#C62828',     // å–œåº†çº¢
    text:     '#5D1010',     // æ·±çº¢å­—
  },

  {
    id:       'scenario',
    emoji:    'ðŸ’¬',
    iconImage: null,
    name:     { zh:'åœºæ™¯å¯¹è¯', en:'Scenario Dialogues', it:'Dialoghi di Scenari' },
    desc:     { zh:'ç”Ÿæ´»åœºæ™¯ Â· ä¸‰è¯­å­—å¹• Â· æœ—è¯»',
                en:'Real-life scenes Â· trilingual Â· TTS',
                it:'Scene di vita Â· trilingue Â· TTS' },
    features: [
      { zh:'é¢åŒ…åº—ä¹°æ—©é¤',     en:'Bakery breakfast',     it:'Colazione al bar' },
      { zh:'å­¦æ ¡å¼€å­¦ç¬¬ä¸€å¤©',   en:'First day of school',  it:'Primo giorno di scuola' },
      { zh:'å®¶åº­æ™šé¤',         en:'Family dinner',        it:'Cena in famiglia' },
      { zh:'é—®è·¯ä¸Žäº¤é€š',       en:'Asking directions',    it:'Chiedere indicazioni' },
    ],
    tag:      { zh:'å¯¹è¯', en:'Dialogue', it:'Dialogo' },
    color:    '#E1F5FE',
    border:   '#0277BD',
    text:     '#01579B',
  },
  {
    id:       'story',
    emoji:    'ðŸ“–',
    iconImage: null,
    name:     { zh:'æ•…äº‹ä¼š', en:'Story Time', it:'Ora delle Storie' },
    desc:     { zh:'å¬æ•…äº‹ Â· çœ‹ç»˜æœ¬ Â· å­¦ä¸­æ–‡',
                en:'Listen Â· read Â· learn',
                it:'Ascolta Â· leggi Â· impara' },
    features: [
      { zh:'å°çŒ«é’“é±¼',         en:'Kitten goes fishing',     it:'Il gattino pesca' },
      { zh:'é¾Ÿå…”èµ›è·‘',         en:'Tortoise & hare',         it:'La lepre e la tartaruga' },
      { zh:'ä¸­ç§‹çŽ‰å…”',         en:'Mid-Autumn jade rabbit',  it:'Coniglio di giada' },
      { zh:'ç†ŠçŒ«æ‰¾æœ‹å‹',       en:'Panda finds friends',     it:'Panda trova amici' },
    ],
    tag:      { zh:'ç»˜æœ¬', en:'Picture Book', it:'Libro Illustrato' },
    color:    '#F1F8E9',
    border:   '#558B2F',
    text:     '#33691E',
  },




  // â”€â”€ Future modules â€” uncomment and adjust as they come online â”€â”€
  // {
  //   id:    'hsk', emoji:'ðŸ“š',
  //   name:  { zh:'HSKè€ƒçº§', en:'HSK Levels', it:'Livelli HSK' },
  //   ...
  // },
];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main component
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function PlatformHome({ onSelect, userLabel, onSettings, onLogout, allowedModules }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it || en) : en;

  // Platform-level path scope. Read from localStorage on mount so navigating
  // away and back preserves the selection. Each module (HomeScreen, PinyinApp,
  // etc.) reads the same key when it mounts.
  const [currentPath, setCurrentPath] = useState(() => {
    try { return localStorage.getItem(PATH_STORAGE_KEY) || 'all'; }
    catch { return 'all'; }
  });
  useEffect(() => {
    try { localStorage.setItem(PATH_STORAGE_KEY, currentPath); } catch {}
  }, [currentPath]);

  // All registered modules are shown. If per-user permissions become a
  // requirement later, re-introduce an allowedModules filter here.
  const visibleModules = !allowedModules || allowedModules.length === 0
  ? MODULES
  : MODULES.filter(m => allowedModules.includes(m.id));
  // Fetch panda assets once per session. For each module:
  //   1. If a row in jgw_panda_assets has module_id matching the module â†’ use it
  //   2. Otherwise, fall back to deterministic hash of module id over all pandas
  // This means admins can pin specific pandas in PandaStudio, but unassigned
  // modules still get a stable random panda.
  const [pandaMap, setPandaMap] = useState(PANDA_CACHE);
  const [refetchKey, setRefetchKey] = useState(0);

  // Invalidate cache when admin saves a panda assignment elsewhere in the app
  useEffect(() => {
    function handleUpdate() {
      PANDA_CACHE = null;
      setRefetchKey(k => k + 1);
    }
    window.addEventListener('panda-assets-updated', handleUpdate);
    return () => window.removeEventListener('panda-assets-updated', handleUpdate);
  }, []);

  useEffect(() => {
    // Skip fetch only on initial mount when cache is already populated
    if (PANDA_CACHE && refetchKey === 0) {
      setPandaMap(PANDA_CACHE);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('jgw_panda_assets')
          .select('image_url, module_id')
          .order('created_at', { ascending: true });    // stable ordering for hash fallback
        if (error) throw error;

        const all = (data || []).filter(r => r.image_url);
        if (all.length === 0) { PANDA_CACHE = {}; setPandaMap({}); return; }

        // Build module_id â†’ image_url map for pinned assignments
        const pinned = {};
        all.forEach(r => {
          if (r.module_id) pinned[r.module_id] = r.image_url;
        });

        // For unpinned modules, fall back to deterministic hash over the pool
        // of UNPINNED pandas (so pinned ones don't double-appear).
        const unpinnedUrls = all
          .filter(r => !r.module_id)
          .map(r => r.image_url);
        const hashId = (str) => {
          let h = 5381;
          for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
          return Math.abs(h);
        };

        const map = {};
        visibleModules.forEach(m => {
          if (pinned[m.id]) {
            map[m.id] = pinned[m.id];
          } else if (unpinnedUrls.length > 0) {
            map[m.id] = unpinnedUrls[hashId(m.id) % unpinnedUrls.length];
          }
          // else: no panda for this module â€” emoji fallback in JSX handles it
        });
        PANDA_CACHE = map;
        setPandaMap(map);
      } catch (err) {
        console.warn('[PlatformHome] panda fetch failed:', err?.message);
        PANDA_CACHE = {};
        setPandaMap({});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchKey]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingBottom: 40 }}>

      {/* â”€â”€ Top bar: title + language + settings â”€â”€ */}
      <div style={{ padding: '14px 16px 6px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)',
            fontFamily: "'STKaiti','KaiTi',Georgia,serif" }}>
            {t('å¤§å«å­¦ä¸­æ–‡', 'Hanzi Platform', 'Hanzi Platform')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            {t('é€‰æ‹©å­¦ä¹ è·¯å¾„ï¼Œå†é€‰æ¨¡å—', 'Pick a path, then a module', 'Scegli percorso e modulo')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <LangSwitcher/>
          {onSettings && (
            <button onClick={onSettings} style={{
              width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)',
              background: 'var(--card)', cursor: 'pointer', fontSize: 14,
            }}>âš™</button>
          )}
        </div>
      </div>

      {/* â”€â”€ Learning path (applies to all modules) â”€â”€ */}
      <div style={{ padding: '6px 16px 14px' }}>
        <PathSelector
          currentPath={currentPath}
          onSelectPath={setCurrentPath}
          lang={lang}
        />
      </div>

      {/* ── Quick-jump strip (compact icon row, mirrors the big cards) ── */}
      <ModuleStrip modules={visibleModules} lang={lang} onSelect={onSelect} />

      {/* ── Module grid ── */}
      <div style={{ padding: '0 16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 14 }}>
        {visibleModules.map(m => (
          <ModuleCard key={m.id} mod={m} lang={lang}
            pandaUrl={pandaMap?.[m.id]}
            onClick={() => onSelect?.(m.id)} />
        ))}
      </div>

      {/* â”€â”€ Footer â”€â”€ */}
      <div style={{ textAlign: 'center', padding: '24px 16px 0',
        fontSize: 11, color: 'var(--text-3)' }}>
        {userLabel && <div style={{ marginBottom: 6 }}>{userLabel}</div>}
        david-zhongwen.net Â· {t('æ±‰å­—å­¦ä¹ å¹³å°', 'Hanzi learning platform', 'Piattaforma Hanzi')}
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ModuleCard â€” large gateway card per module
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ModuleCard({ mod, lang, onClick, pandaUrl }) {
  const name = mod.name?.[lang] || mod.name?.en || mod.id;
  const desc = mod.desc?.[lang] || mod.desc?.en || '';
  const tag  = mod.tag?.[lang]  || mod.tag?.en  || '';

  return (
    <button onClick={onClick}
      style={{
        background: mod.color,
        border: `2px solid ${mod.border}`,
        borderRadius: 20,
        padding: '20px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        position: 'relative',
        WebkitTapHighlightColor: 'transparent',
        fontFamily: 'inherit',
        transition: 'transform 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>

      {/* Tag badge */}
      {tag && (
        <div style={{ position: 'absolute', top: 12, right: 12,
          background: mod.border, color: '#fff',
          fontSize: 10, padding: '2px 9px', borderRadius: 10, fontWeight: 600 }}>
          {tag}
        </div>
      )}

      {/* Icon + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        {/* Icon square â€” panda image (deterministic per module) with
            emoji as a small corner badge overlay. If panda fails to load
            or no panda exists, emoji becomes the main icon. */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16,
            background: mod.border, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, overflow: 'hidden' }}>
            {pandaUrl
              ? <img src={pandaUrl} alt={name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => {
                    e.currentTarget.style.display = 'none';
                    const fb = e.currentTarget.parentElement?.querySelector('[data-emoji-fallback]');
                    if (fb) fb.style.display = 'inline';
                  }}/>
              : mod.iconImage
                ? <img src={mod.iconImage} alt={name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { e.currentTarget.style.display = 'none'; }}/>
                : null}
            {/* Main-icon fallback â€” only visible when no panda renders */}
            <span data-emoji-fallback
              style={{ display: pandaUrl ? 'none' : 'inline' }}>
              {mod.emoji}
            </span>
          </div>

          {/* Emoji corner badge â€” only when a panda image is present */}
          {pandaUrl && mod.emoji && (
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 22, height: 22, borderRadius: '50%',
              background: '#fff', border: `1.5px solid ${mod.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, lineHeight: 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }}>
              {mod.emoji}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500, color: mod.text,
            fontFamily: "'STKaiti','KaiTi',Georgia,serif", lineHeight: 1.1 }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: mod.border, marginTop: 3, opacity: 0.85 }}>
            {desc}
          </div>
        </div>
      </div>

      {/* Features (numbered list) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {mod.features.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9,
            fontSize: 13, color: mod.text }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%',
              background: mod.border, color: '#fff',
              fontSize: 10, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0 }}>{i + 1}</div>
            <span>{f?.[lang] || f?.en || ''}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: mod.border, opacity: 0.85 }}>
          {lang === 'zh' ? 'ç‚¹å‡»è¿›å…¥' : lang === 'it' ? 'Tocca per iniziare' : 'Tap to enter'}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%',
          background: mod.border, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18 }}>â€º</div>
      </div>
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────
// ModuleStrip — compact horizontal icon row above the big cards.
// Uses the same `onSelect` so every tap goes through App.jsx's existing
// setScreen() routing. No new screen cases needed.
// ──────────────────────────────────────────────────────────────────────
function ModuleStrip({ modules, lang, onSelect }) {
  // Fixed display order for the 6 core learning modules.
  // Add more ids here if you want more cards in the strip.
  const STRIP_IDS = ['lianzi', 'words', 'pinyin', 'chengyu', 'poetry', 'grammar'];

  // Emoji per id — swap to /icons/*.png later if you want custom art.
  const ICONS = {
    lianzi:  '✍️',
    words:   '📚',
    pinyin:  '🔤',
    chengyu: '🌵',
    poetry:  '🪶',
    grammar: '📐',
  };

  const items = STRIP_IDS
    .map(id => modules.find(m => m.id === id))
    .filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      overflowX: 'auto',
      padding: '4px 16px 14px',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
    }}>
      {items.map(m => (
        <button
          key={m.id}
          onClick={() => onSelect?.(m.id)}
          style={{
            flex: '0 0 auto',
            minWidth: 72,
            background: m.color,
            border: `1.5px solid ${m.border}`,
            borderRadius: 14,
            padding: '10px 6px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
            transition: 'transform 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
          <div style={{ fontSize: 24, lineHeight: 1 }}>
            {ICONS[m.id] || m.emoji}
          </div>
          <div style={{
            fontSize: 12,
            fontWeight: 500,
            color: m.text,
            fontFamily: "'STKaiti','KaiTi',Georgia,serif",
            whiteSpace: 'nowrap',
          }}>
            {m.name?.[lang] || m.name?.en || m.id}
          </div>
        </button>
      ))}
    </div>
  );
}
