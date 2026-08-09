// src/components/HomeScreen.jsx
//
// 练字 home. There are no sets, paths or categories here any more: the learner
// presses 开始练习 and the scheduler decides which characters come out, ordered
// by what is due and what they can handle.
//
// Sets still exist in the database and in the admin — they are how content is
// organised and imported. They are simply no longer a thing a learner browses.

import { useMemo, useState } from 'react';
import { useLang } from '../context/LanguageContext.jsx';
import ModuleTemplate from './ModuleTemplate.jsx';
import AdaptiveCard from './AdaptiveCard.jsx';
import {
  buildQueue, queueStats, masteryOf, isDue, START_LEVELS, DEFAULT_START,
} from '../lib/adaptiveChars.js';

const QUEUE_LENGTH = 20;   // one sitting
const PREVIEW      = 5;    // shown on the card
const START_KEY    = 'lianzi_start_level';

export default function HomeScreen({
  sets = [],
  progress = {},
  stats = {},
  onStartAdaptive,
  onGames,
  onBack,
}) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? it : en;

  const streak         = stats?.streak         ?? 0;
  const totalPracticed = stats?.totalPracticed  ?? 0;
  const accuracy       = stats?.accuracy        ?? null;
  const characters     = progress?.characters   ?? {};

  // ── One flat pool ─────────────────────────────────────────────────────
  // Every character the learner has, deduplicated. Which set it came from is
  // kept only so admin-side grouping still round-trips; nothing here reads it.
  const allChars = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of sets) {
      for (const c of (s.chars || [])) {
        if (!c?.c || seen.has(c.c)) continue;
        seen.add(c.c);
        out.push(c);
      }
    }
    return out;
  }, [sets]);

  const practicedCount = Object.keys(characters).length;
  const totalChars     = allChars.length;

  // Asked once, before the first character. Someone who has already practised
  // is never asked — their history is a better answer than their self-estimate.
  const [startLevel, setStartLevel] = useState(() => {
    try { return localStorage.getItem(START_KEY); } catch { return null; }
  });
  // Set when the learner asks to pick again, so the chooser can be reopened
  // after they already have history.
  const [reChoosing, setReChoosing] = useState(false);

  const needsStart =
    totalChars > 0 && (reChoosing || (!startLevel && practicedCount === 0));

  function chooseStart(id) {
    try { localStorage.setItem(START_KEY, id); } catch {}
    setStartLevel(id);
    setReChoosing(false);
  }

  const queue = useMemo(
    () => buildQueue(allChars, characters, QUEUE_LENGTH, startLevel || DEFAULT_START),
    [allChars, characters, startLevel]
  );
  const qStats = useMemo(
    () => queueStats(allChars, characters),
    [allChars, characters]
  );

  // No set cards — ModuleTemplate renders the practice card via `extra`.
  const modules = [];

  const statsChips = [
    { value: streak,         label: t('连续天数', 'Streak', 'Giorni') },
    { value: totalPracticed, label: t('练习次数', 'Practices', 'Sessioni') },
    ...(accuracy !== null ? [{ value: accuracy + '%', label: t('笔顺准确', 'Accuracy', 'Accuratezza') }] : []),
  ];

  return (
    <ModuleTemplate
      color="#8B4513"
      icon="✍️"
      title={t('练字', 'Character Writing', 'Scrittura')}
      subtitle={t('笔顺 · 临摹 · 声调练习', 'Stroke order · tracing · tones', 'Tratti · tracciamento · toni')}
      onBack={onBack}
      backLabel={t('‹ 返回主页', '‹ Back', '‹ Indietro')}
      stats={statsChips}
      modules={modules}
      lang={lang}
      extra={
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {/* Asked once; after that the scheduler runs on its own */}
          {needsStart ? (
            <StartPointCard lang={lang} onChoose={chooseStart} t={t}/>
          ) : queue.length > 0 && (
            <PracticeCard
              queue={queue}
              stats={qStats}
              characters={characters}
              startLevel={startLevel}
              onRestart={() => setReChoosing(true)}
              onStart={() => onStartAdaptive?.(queue)}
              t={t}
            />
          )}

          <AdaptiveCard module="lianzi" lang={lang}/>

          {totalChars === 0 && (
            <div style={{
              background: '#fff8e1', borderRadius: 14, padding: '20px 16px',
              border: '1px dashed #F57F17', textAlign: 'center',
              color: '#a07850', fontSize: 13,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {t('还没有字符', 'No characters yet', 'Nessun carattere')}
              </div>
              <div style={{ fontSize: 11 }}>
                {t('去 admin 导入字符', 'Import characters via admin', 'Importa dall\'admin')}
              </div>
            </div>
          )}

          {totalChars > 0 && (
            <div style={{
              background: '#fff', borderRadius: 14, padding: '12px 16px',
              border: '1px solid #E8D5B0',
              fontSize: 12, color: '#a07850',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>
                {t('总进度', 'Overall', 'Progresso')}：{practicedCount} / {totalChars} {t('字', 'chars', 'car.')}
              </span>
              <div style={{
                flex: 1, maxWidth: 160, height: 6, borderRadius: 3,
                background: '#E8D5B0', marginLeft: 12, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 3, background: '#8B4513',
                  width: `${Math.round((practicedCount / totalChars) * 100)}%`,
                  transition: 'width 0.4s ease',
                }}/>
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// The practice card — the only way into 练字.
// Shows what the scheduler picked, then starts the whole queue.
// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// Asked once, before the first character: where should we start?
// ─────────────────────────────────────────────────────────────────────────
function StartPointCard({ lang, onChoose, t }) {
  const label = l => lang === 'zh' ? l.zh : lang === 'it' ? l.it : l.en;
  const desc  = l => lang === 'zh' ? l.descZh : lang === 'it' ? l.descIt : l.descEn;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
      border: '1.5px solid #E8D5B0', borderRadius: 16, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#8B4513', marginBottom: 3 }}>
        {t('从哪里开始？', 'Where should we start?', 'Da dove iniziamo?')}
      </div>
      <div style={{ fontSize: 11, color: '#a07850', marginBottom: 12 }}>
        {t('选一次就好,之后由练习记录决定难度',
           'Asked once — after this your practice decides the difficulty',
           'Una volta sola — poi decide la tua pratica')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {START_LEVELS.map(l => (
          <button key={l.id} onClick={() => onChoose(l.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '11px 12px', borderRadius: 12, cursor: 'pointer',
              border: '1.5px solid #E8D5B0', background: '#fff',
              textAlign: 'left', fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}>
            <span style={{ fontSize: 22 }}>{l.emoji}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#8B4513' }}>
                {label(l)}
              </span>
              <span style={{ display: 'block', fontSize: 11, color: '#a07850', marginTop: 1 }}>
                {desc(l)}
              </span>
            </span>
            <span style={{ fontSize: 16, color: '#C8A87C' }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function PracticeCard({ queue, stats, characters, startLevel, onRestart, onStart, t }) {
  const dueCount = stats?.due ?? 0;
  const newCount = stats?.fresh ?? 0;

  const focusLabel = dueCount > 0
    ? t(`📚 ${dueCount} 个待复习`, `📚 ${dueCount} to review`, `📚 ${dueCount} da rivedere`)
    : newCount > 0
      ? t(`✨ ${newCount} 个新字`, `✨ ${newCount} new`, `✨ ${newCount} nuovi`)
      : t('🏆 全部掌握', '🏆 All mastered', '🏆 Tutto appreso');

  const preview = queue.slice(0, PREVIEW).map(ch => {
    const rec = characters[ch.c];
    return { ch, isNew: !rec?.practiced, due: isDue(rec), mastery: masteryOf(rec) };
  });

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
      border: '1.5px solid #E8D5B0',
      borderRadius: 16, padding: '14px 16px',
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
        <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#8B4513' }}>
            {t('接下来练这些字', 'Practice these next', 'Pratica questi')}
          </span>
        </div>
        {focusLabel && (
          <span style={{ fontSize: 11, color: '#8B4513', opacity: 0.85 }}>
            {focusLabel}
          </span>
        )}
      </div>

      {/* What is coming up — a preview, not a menu */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {preview.map(({ ch, isNew, due }) => (
          <div
            key={ch.c}
            style={{
              width: 56, height: 56, borderRadius: 12,
              background: isNew ? '#fff' : due ? '#FFE0B2' : '#F1F8E9',
              border: `1.5px solid ${isNew ? '#8B4513' : due ? '#F57F17' : '#A5D6A7'}`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              fontFamily: "'STKaiti','KaiTi',Georgia,serif",
            }}
            title={isNew ? '新字' : due ? '待复习' : '已掌握'}
          >
            <div style={{
              fontSize: 22, fontWeight: 500, lineHeight: 1,
              color: isNew ? '#8B4513' : due ? '#E65100' : '#2E7D32',
            }}>
              {ch.c}
            </div>
            <div style={{ fontSize: 9, marginTop: 2, opacity: 0.7 }}>
              {isNew ? '新' : due ? '复习' : '✓'}
            </div>
          </div>
        ))}
        {queue.length > PREVIEW && (
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            border: '1.5px dashed #C8A87C', color: '#a07850', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            +{queue.length - PREVIEW}
          </div>
        )}
      </div>

      <button
        onClick={onStart}
        style={{
          marginTop: 12, width: '100%', padding: '12px',
          borderRadius: 12, border: 'none', cursor: 'pointer',
          background: '#8B4513', color: '#fdf6e3',
          fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {t('开始练习', 'Start practising', 'Inizia')} · {queue.length} {t('字', 'chars', 'car.')}
      </button>

      {startLevel && (
        <button onClick={onRestart}
          style={{
            marginTop: 8, width: '100%', padding: 0, border: 'none',
            background: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 10, color: '#a07850', textDecoration: 'underline',
          }}>
          {t('重新选择起点', 'Change starting point', 'Cambia punto di partenza')}
        </button>
      )}
    </div>
  );
}
