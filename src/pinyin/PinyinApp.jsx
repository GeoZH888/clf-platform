// src/pinyin/PinyinApp.jsx
// 拼音 module hub — uses unified ModuleTemplate
import { useState, useEffect } from 'react';
import ModuleTemplate from '../components/ModuleTemplate.jsx';
import AdaptiveCard from '../components/AdaptiveCard.jsx';
import PinyinTable    from './PinyinTable.jsx';
import TonePractice   from './TonePractice.jsx';
import ListenIdentify from './ListenIdentify.jsx';
import TypePinyin     from './TypePinyin.jsx';
import PinyinSpeak    from './PinyinSpeak.jsx';

// Valid sub-screens that can be deep-linked via the initialScreen prop
const VALID_SCREENS = new Set(['home','table','tones','listen','type','speak']);

export default function PinyinApp({ onBack, initialScreen }) {
  const start = VALID_SCREENS.has(initialScreen) ? initialScreen : 'home';
  const [screen, setScreen] = useState(start);
  const [lang,   setLang]   = useState(
    () => document.documentElement.lang?.slice(0, 2) || 'zh'
  );

  // If App passes a new initialScreen after mount (e.g. user goes to
  // PracticeModeScreen → pinyin → different mode), sync internal state.
  useEffect(() => {
    if (VALID_SCREENS.has(initialScreen) && initialScreen !== screen) {
      setScreen(initialScreen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScreen]);

  // Try to read lang from context if available
  let langCtx;
  try {
    const ctx = require('../context/LanguageContext.jsx');
    langCtx = ctx.useLang?.()?.lang;
  } catch {}
  const l = langCtx || lang;

  const t = (zh, en, it) => l === 'zh' ? zh : l === 'it' ? it : en;

  const modules = [
    {
      id:     'table',
      icon:   '📋',
      title:  t('声母韵母表', 'Initials & Finals', 'Tabella Pinyin'),
      desc:   t('认识所有拼音 · 口型动画', 'All sounds with mouth animation', 'Tutti i suoni con animazione'),
      color:  '#E3F2FD',
      accent: '#1565C0',
      onClick: () => setScreen('table'),
    },
    {
      id:     'tones',
      icon:   '🎵',
      title:  t('四声练习', 'Tone Practice', 'Pratica dei Toni'),
      desc:   t('掌握四个声调', 'Master the four tones', 'Padroneggia i quattro toni'),
      color:  '#E8F5E9',
      accent: '#2E7D32',
      onClick: () => setScreen('tones'),
    },
    {
      id:     'listen',
      icon:   '👂',
      title:  t('听音识调', 'Listen & Identify', 'Ascolta e Identifica'),
      desc:   t('听声音选声调', 'Hear and choose the tone', 'Scegli il tono'),
      color:  '#FFF8E1',
      accent: '#F57F17',
      onClick: () => setScreen('listen'),
    },
    {
      id:     'type',
      icon:   '⌨️',
      title:  t('拼音输入', 'Type Pinyin', 'Scrivi Pinyin'),
      desc:   t('看字写拼音', 'See character, type pinyin', 'Vedi e scrivi'),
      color:  '#F3E5F5',
      accent: '#6A1B9A',
      onClick: () => setScreen('type'),
    },
    {
      id:     'speak',
      icon:   '🎤',
      title:  t('发音练习', 'Speak & Score', 'Pronuncia'),
      desc:   t('听发音→开口说→看评分', 'Listen → Speak → Get scored', 'Ascolta → Parla → Punteggio'),
      color:  '#FCE4EC',
      accent: '#C62828',
      tag:    t('新功能','New','Nuovo'),
      onClick: () => setScreen('speak'),
    },
  ];

  if (screen === 'table')  return <PinyinTable    lang={l} onBack={() => setScreen('home')} />;
  if (screen === 'tones')  return <TonePractice   lang={l} onBack={() => setScreen('home')} />;
  if (screen === 'listen') return <ListenIdentify lang={l} onBack={() => setScreen('home')} />;
  if (screen === 'type')   return <TypePinyin     lang={l} onBack={() => setScreen('home')} />;
  if (screen === 'speak')  return <PinyinSpeak         onBack={() => setScreen('home')} />;

  return (
    <ModuleTemplate
      color="#1565C0"
      icon="🔤"
      title={t('拼音学习', 'Pinyin', 'Pinyin')}
      subtitle={t('从零开始，掌握汉语拼音', 'Master Mandarin pronunciation', 'Padroneggia la pronuncia')}
      onBack={onBack}
      backLabel={t('‹ 返回主页', '‹ Back', '‹ Indietro')}
      modules={modules}
      lang={l}
      extra={
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <AdaptiveCard module="pinyin" lang={l}/>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '12px 16px',
            border: '1px solid #BBDEFB', fontSize: 12, color: '#1565C0',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span>{t(
              '建议顺序：先学声母韵母表，再练四声，然后听音，最后输入练习',
              'Recommended: start with the sound table, then tone practice, listening, then typing',
              'Consigliato: tabella suoni → toni → ascolto → scrittura'
            )}</span>
          </div>
        </div>
      }
    />
  );
}
