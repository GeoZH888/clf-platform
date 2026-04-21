/**
 * src/context/LanguageContext.jsx
 * Trilingual context: zh (Chinese) | it (Italian) | en (English)
 */
import { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem('jgw_lang') || 'en';
  });

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('jgw_lang', l);
  };

  const t = (key, vars = {}) => {
    const str = I18N[lang]?.[key] || I18N.en?.[key] || key;
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), str);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);

// ── Translations ─────────────────────────────────────────────
export const I18N = {
  zh: {
    // App
    appName:       '甲骨文描红',
    tagline:       '商朝文字 · 三千年前的智慧',
    // Nav
    home:          '首页',
    progress:      '进度',
    practice:      '练习',
    games:         '进阶',
    // Practice screen
    freeTrace:     '自由临摹',
    strokeOrder:   '笔顺检验',
    readAloud:     '朗读',
    nextChar:      '下一个',
    prevChar:      '上一个',
    clearCanvas:   '清空',
    showGuide:     '显示笔画',
    hideGuide:     '隐藏笔画',
    playAll:       '▶ 全部',
    nextStroke:    '下一笔 →',
    reset:         '↺ 重置',
    strokeProgress:'笔画进度',
    ready:         '准备好了请开始描画第 1 笔',
    correct:       '✓ 第 {n} 笔正确！继续',
    mistake:       '✗ 第 {n} 笔画错了，看提示重画',
    allDoneQuiz:   '🎉 完美！',
    doneWithHints: '完成！共 {n} 次提示',
    listenHint:    '正在聆听… 请朗读',
    tapToRecord:   '点击开始朗读',
    demoSound:     '🔈 示范发音',
    recognized:    '识别结果',
    // Fonts
    fontLabel:     '选择临摹字体 · 字体选择',
    // Brush
    brushLabel:    '选择毛笔 · 笔型选择',
    // JiaguWen panel
    panelLabel:    '甲骨文介绍 · 字源',
    oracleBone:    '甲骨文',
    illustration:  '图解',
    evolution:     '3000年演变',
    // Scores
    tracingScore:  '笔顺',
    speakScore:    '朗读',
    combined:      '综合',
    perfect:       '完美 ✦',
    excellent:     '优秀 ◎',
    good:          '良好 ○',
    keepTrying:    '继续 △',
    tryAgain:      '再试 ×',
    // Progress screen
    totalPracticed:'已练习字数',
    avgScore:      '平均得分',
    streak:        '连续天数',
    // Game hub
    selectGame:    '选择游戏模式',
    memoryMatch:   '记忆配对',
    glyphQuiz:     '字形辨认',
    speedTrace:    '描红竞速',
    dailyChallenge:'每日挑战',
    mmDesc:        '翻牌匹配甲骨文与现代字',
    gqDesc:        '看图猜字，限时10秒',
    stDesc:        '争分夺秒，计时描红',
    dcDesc:        '每天5字，保持连击',
    comingSoon:    '敬请期待',
    // XP/Levels
    level:         '等级',
    xp:            '经验值',
    levelUp:       '升级了！',
    xpGained:      '+{n} 经验',
    levels:        ['初学者','学童','书生','学士','进士','状元'],
    // Memory game
    moves:         '步数',
    matched:       '配对成功！',
    allMatched:    '全部配对！',
    restart:       '重新开始',
    back:          '返回',
    choose:        '选择答案',
    timeUp:        '时间到！',
    // Daily
    todayChars:    '今日汉字',
    streak_n:      '连续{n}天',
    // Custom input
    customInput:   '自定义练习',
    customPlaceholder: '输入一个汉字',
    pinyinPlaceholder: '拼音 e.g. hàn',
    meaningPlaceholder:'含义 (选填)',
    startPractice: '开始练习 {char}',
    nextStep:      '下一步 →',
    saving:        '保存中…',
    // Character card
    meaning:       '含义',
    pinyin:        '拼音',
    origin:        '字源',
    inscriptions:  '甲骨出土数',
  },

  it: {
    appName:       '甲骨文描红',
    tagline:       'Scrittura della Dinastia Shang · 3000 anni di saggezza',
    home:          'Home',
    progress:      'Progresso',
    practice:      'Pratica',
    games:         'Avanzato',
    freeTrace:     'Tracciatura libera',
    strokeOrder:   'Ordine tratti',
    readAloud:     'Lettura ad alta voce',
    nextChar:      'Prossimo',
    prevChar:      'Precedente',
    clearCanvas:   'Cancella',
    showGuide:     'Mostra tratti',
    hideGuide:     'Nascondi tratti',
    playAll:       '▶ Tutto',
    nextStroke:    'Tratto succ. →',
    reset:         '↺ Ricomincia',
    strokeProgress:'Avanzamento tratti',
    ready:         'Pronto — traccia il primo tratto',
    correct:       '✓ Tratto {n} corretto! Continua',
    mistake:       '✗ Tratto {n} sbagliato — segui il suggerimento',
    allDoneQuiz:   '🎉 Perfetto!',
    doneWithHints: 'Completato! {n} suggerimenti usati',
    listenHint:    'In ascolto… pronuncia il carattere',
    tapToRecord:   'Tocca per pronunciare',
    demoSound:     '🔈 Ascolta pronuncia',
    recognized:    'Trascrizione',
    fontLabel:     'Scegli carattere tipografico',
    brushLabel:    'Scegli pennello',
    panelLabel:    'Origine oracolare · Etimologia',
    oracleBone:    'Osso oracolare',
    illustration:  'Illustrazione',
    evolution:     'Evoluzione 3000 anni',
    tracingScore:  'Tracciatura',
    speakScore:    'Pronuncia',
    combined:      'Punteggio',
    perfect:       'Perfetto ✦',
    excellent:     'Eccellente ◎',
    good:          'Buono ○',
    keepTrying:    'Continua △',
    tryAgain:      'Riprova ×',
    totalPracticed:'Caratteri esercitati',
    avgScore:      'Punteggio medio',
    streak:        'Giorni consecutivi',
    selectGame:    'Scegli modalità di gioco',
    memoryMatch:   'Abbinamento',
    glyphQuiz:     'Quiz Glifo',
    speedTrace:    'Tracciatura veloce',
    dailyChallenge:'Sfida giornaliera',
    mmDesc:        'Abbina glifo osseo al carattere moderno',
    gqDesc:        'Identifica il carattere — 10 secondi',
    stDesc:        'Traccia il carattere contro il tempo',
    dcDesc:        '5 caratteri al giorno, mantieni la serie',
    comingSoon:    'Prossimamente',
    level:         'Livello',
    xp:            'Esperienza',
    levelUp:       'Livello superiore!',
    xpGained:      '+{n} XP',
    levels:        ['Principiante','Studente','Letterato','Dottore','Accademico','Primo Scholar'],
    moves:         'Mosse',
    matched:       'Abbinato!',
    allMatched:    'Tutto abbinato!',
    restart:       'Ricomincia',
    back:          'Indietro',
    choose:        'Scegli la risposta',
    timeUp:        'Tempo scaduto!',
    todayChars:    'Caratteri di oggi',
    streak_n:      '{n} giorni consecutivi',
    customInput:   'Pratica libera',
    customPlaceholder: 'Inserisci un carattere',
    pinyinPlaceholder: 'Pinyin e.g. hàn',
    meaningPlaceholder:'Significato (opzionale)',
    startPractice: 'Inizia pratica {char}',
    nextStep:      'Avanti →',
    saving:        'Salvataggio…',
    meaning:       'Significato',
    pinyin:        'Pinyin',
    origin:        'Origine',
    inscriptions:  'Iscrizioni trovate',
  },

  en: {
    appName:       '甲骨文描红',
    tagline:       'Shang Dynasty Script · 3000 years of wisdom',
    home:          'Home',
    progress:      'Progress',
    practice:      'Practice',
    games:         'Advanced',
    freeTrace:     'Free tracing',
    strokeOrder:   'Stroke order',
    readAloud:     'Read aloud',
    nextChar:      'Next',
    prevChar:      'Previous',
    clearCanvas:   'Clear',
    showGuide:     'Show strokes',
    hideGuide:     'Hide strokes',
    playAll:       '▶ All strokes',
    nextStroke:    'Next stroke →',
    reset:         '↺ Reset',
    strokeProgress:'Stroke progress',
    ready:         'Ready — draw the 1st stroke',
    correct:       '✓ Stroke {n} correct! Keep going',
    mistake:       '✗ Stroke {n} wrong — follow the hint',
    allDoneQuiz:   '🎉 Perfect!',
    doneWithHints: 'Done! Used {n} hints',
    listenHint:    'Listening… say the character',
    tapToRecord:   'Tap to record',
    demoSound:     '🔈 Hear pronunciation',
    recognized:    'Recognition result',
    fontLabel:     'Choose tracing font',
    brushLabel:    'Choose brush',
    panelLabel:    'Oracle bone origin · Etymology',
    oracleBone:    'Oracle bone form',
    illustration:  'Illustration',
    evolution:     '3000-year evolution',
    tracingScore:  'Tracing',
    speakScore:    'Speaking',
    combined:      'Combined',
    perfect:       'Perfect ✦',
    excellent:     'Excellent ◎',
    good:          'Good ○',
    keepTrying:    'Keep going △',
    tryAgain:      'Try again ×',
    totalPracticed:'Characters practised',
    avgScore:      'Average score',
    streak:        'Day streak',
    selectGame:    'Choose game mode',
    memoryMatch:   'Memory Match',
    glyphQuiz:     'Glyph Quiz',
    speedTrace:    'Speed Trace',
    dailyChallenge:'Daily Challenge',
    mmDesc:        'Flip cards to match oracle bone to modern character',
    gqDesc:        'Identify the character from its illustration — 10 seconds',
    stDesc:        'Trace the character against the clock',
    dcDesc:        '5 characters per day, keep your streak',
    comingSoon:    'Coming soon',
    level:         'Level',
    xp:            'XP',
    levelUp:       'Level Up!',
    xpGained:      '+{n} XP',
    levels:        ['Beginner','Student','Scholar','Bachelor','Academician','Top Scholar'],
    moves:         'moves',
    matched:       'Matched!',
    allMatched:    'All matched!',
    restart:       'Play again',
    back:          'Back',
    choose:        'Choose the answer',
    timeUp:        "Time's up!",
    todayChars:    "Today's characters",
    streak_n:      '{n}-day streak',
    customInput:   'Custom practice',
    customPlaceholder: 'Enter any character',
    pinyinPlaceholder: 'Pinyin e.g. hàn',
    meaningPlaceholder:'Meaning (optional)',
    startPractice: 'Practice {char}',
    nextStep:      'Next →',
    saving:        'Saving…',
    meaning:       'Meaning',
    pinyin:        'Pinyin',
    origin:        'Origin',
    inscriptions:  'Inscriptions found',
  },
};

export const LEVELS_DATA = [
  { min:0,    en:'Beginner',     zh:'初学者', it:'Principiante', icon:'🌱' },
  { min:100,  en:'Student',      zh:'学童',   it:'Studente',     icon:'📖' },
  { min:300,  en:'Scholar',      zh:'书生',   it:'Letterato',    icon:'🖌'  },
  { min:600,  en:'Bachelor',     zh:'学士',   it:'Dottore',      icon:'🎓' },
  { min:1000, en:'Academician',  zh:'进士',   it:'Accademico',   icon:'🏆' },
  { min:2000, en:'Top Scholar',  zh:'状元',   it:'Primo Scholar', icon:'👑' },
];

export function getLevel(xp) {
  for (let i = LEVELS_DATA.length - 1; i >= 0; i--) {
    if (xp >= LEVELS_DATA[i].min) return { ...LEVELS_DATA[i], index: i };
  }
  return { ...LEVELS_DATA[0], index: 0 };
}

export function getXPProgress(xp) {
  const cur = getLevel(xp);
  const next = LEVELS_DATA[cur.index + 1];
  if (!next) return { pct: 100, toNext: 0, nextLevel: null };
  const range = next.min - cur.min;
  const earned = xp - cur.min;
  return { pct: Math.round((earned / range) * 100), toNext: next.min - xp, nextLevel: next };
}
