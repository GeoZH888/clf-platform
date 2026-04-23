// src/grammar/GrammarHomeScreen.jsx
// Lists all grammar topics grouped by level, with per-user mastery badges.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';

const V = {
  bg: 'var(--bg)', card: 'var(--card)', border: 'var(--border)',
  text: 'var(--text)', text2: 'var(--text-2)', text3: 'var(--text-3)',
  accent: '#7B3F3F',            // 墨红 for grammar
  accentLight: '#F5E8E8',
  green: '#2E7D32',
  orange: '#E65100',
};

export default function GrammarHomeScreen({ onSelectTopic, onExit }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it || en) : en;

  const [topics, setTopics] = useState([]);
  const [progress, setProgress] = useState({});   // topic_id → mastery
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Fetch topics (public read, no auth needed)
      const { data: topicsData, error: tErr } = await supabase
        .from('clf_grammar_topics')
        .select('*')
        .order('level', { ascending: true })
        .order('order_idx', { ascending: true });
      if (tErr) { console.warn('[grammar] topics:', tErr); setLoading(false); return; }

      // Fetch user progress — only meaningful for JWT-authed users.
      // For device_token-only users, progress won't be visible via RLS so
      // we skip. Badges simply show "new" for all topics.
      const { data: { session } } = await supabase.auth.getSession();
      const pMap = {};
      if (session) {
        const { data: progData } = await supabase
          .from('clf_grammar_progress')
          .select('topic_id, mastery, total_attempts');
        (progData || []).forEach(p => { pMap[p.topic_id] = p; });
      }

      setTopics(topicsData || []);
      setProgress(pMap);
      setLoading(false);
    })();
  }, []);

  // Group by level
  const byLevel = {};
  topics.forEach(tp => {
    (byLevel[tp.level] = byLevel[tp.level] || []).push(tp);
  });
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);

  const levelLabel = (lvl) => {
    if (lang === 'zh') return ['基础', '初级', '中级', '高级', '精通'][lvl - 1] || `L${lvl}`;
    if (lang === 'it') return ['Base', 'Elementare', 'Intermedio', 'Avanzato', 'Esperto'][lvl - 1] || `L${lvl}`;
    return ['Basics', 'Elementary', 'Intermediate', 'Advanced', 'Mastery'][lvl - 1] || `L${lvl}`;
  };

  return (
    <div style={{ minHeight: '100dvh', background: V.bg, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 10px',
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onExit} style={{
          padding: '5px 12px', fontSize: 13, background: V.card,
          border: `1px solid ${V.border}`, borderRadius: 6, cursor: 'pointer',
          color: V.text,
        }}>← {t('返回', 'Back', 'Indietro')}</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: V.accent,
            fontFamily: "'STKaiti','KaiTi',serif" }}>
            {t('语法', 'Grammar', 'Grammatica')}
          </div>
          <div style={{ fontSize: 11, color: V.text3, marginTop: 2 }}>
            {t('循序渐进，掌握中文结构', 'Step by step, master Chinese structure',
               'Passo dopo passo, padroneggia il cinese')}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: V.text3 }}>
          {t('加载中…', 'Loading…', 'Caricamento…')}
        </div>
      ) : topics.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: V.text3 }}>
          {t('暂无语法点', 'No topics yet', 'Nessun argomento')}
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {levels.map(lvl => (
            <div key={lvl} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: V.accent,
                margin: '8px 0 10px',
                fontFamily: "'STKaiti','KaiTi',serif" }}>
                · {levelLabel(lvl)} ·
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {byLevel[lvl].map(tp => {
                  const p = progress[tp.id];
                  return (
                    <TopicCard key={tp.id} topic={tp} lang={lang}
                      mastery={p?.mastery}
                      attempts={p?.total_attempts || 0}
                      onClick={() => onSelectTopic(tp.id)}/>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopicCard({ topic, lang, mastery, attempts, onClick }) {
  const title = lang === 'zh' ? topic.title_zh
             : lang === 'it' ? (topic.title_it || topic.title_en)
             : (topic.title_en || topic.title_zh);

  const masteryPct = mastery != null ? Math.round(mastery * 100) : null;
  const badge =
    mastery == null       ? { text: lang === 'zh' ? '未开始' : lang === 'it' ? 'Nuovo' : 'New',        color: V.text3 }
    : mastery >= 0.9      ? { text: lang === 'zh' ? '已掌握' : lang === 'it' ? 'Padroneggiato' : 'Mastered', color: V.green }
    : mastery >= 0.3      ? { text: `${masteryPct}%`, color: V.orange }
    :                       { text: `${masteryPct}%`, color: V.accent };

  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', width: '100%',
      background: V.card, border: `1px solid ${V.border}`,
      borderRadius: 10, cursor: 'pointer', textAlign: 'left',
      fontFamily: 'inherit', transition: 'transform 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, color: V.text,
          fontFamily: "'STKaiti','KaiTi',serif", fontWeight: 500 }}>
          {title}
        </div>
        {attempts > 0 && (
          <div style={{ fontSize: 10, color: V.text3, marginTop: 3 }}>
            {attempts} {lang === 'zh' ? '次练习' : lang === 'it' ? 'esercizi' : 'attempts'}
          </div>
        )}
      </div>

      <div style={{
        padding: '3px 10px', fontSize: 10, fontWeight: 500,
        background: badge.color + '22',
        color: badge.color,
        borderRadius: 10,
        whiteSpace: 'nowrap',
      }}>
        {badge.text}
      </div>

      <div style={{ color: V.text3, fontSize: 16 }}>›</div>
    </button>
  );
}
