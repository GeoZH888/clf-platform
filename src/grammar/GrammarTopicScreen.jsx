// src/grammar/GrammarTopicScreen.jsx
// Single topic: shows explanation + examples, then adaptive practice loop.
// Flow: study tab ↔ practice tab. In practice, each answer submits to backend,
// which updates mastery and returns the next exercise seamlessly.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useLang } from '../context/LanguageContext.jsx';
import GrammarExerciseCard from './GrammarExerciseCard.jsx';

const V = {
  bg: 'var(--bg)', card: 'var(--card)', border: 'var(--border)',
  text: 'var(--text)', text2: 'var(--text-2)', text3: 'var(--text-3)',
  accent: '#7B3F3F', accentLight: '#F5E8E8',
  green: '#2E7D32', red: '#c62828', orange: '#E65100',
};

export default function GrammarTopicScreen({ topicId, onBack }) {
  const { lang } = useLang();
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it || en) : en;

  const [topic, setTopic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('study');  // 'study' | 'practice'

  // Practice state
  const [exercise, setExercise] = useState(null);
  const [mastery, setMastery] = useState(0);
  const [loadingEx, setLoadingEx] = useState(false);
  const [feedback, setFeedback] = useState(null);  // {correct, correct_answer, explanation, new_mastery, delta}
  const [submitting, setSubmitting] = useState(false);

  // Fetch topic info
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('clf_grammar_topics')
        .select('*')
        .eq('id', topicId)
        .maybeSingle();
      setTopic(data);
      setLoading(false);
    })();
  }, [topicId]);

  // Fetch next exercise (adaptive)
  const fetchNext = useCallback(async () => {
    setLoadingEx(true);
    setFeedback(null);
    setExercise(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const deviceToken = localStorage.getItem('jgw_device_token');
      if (!session && !deviceToken) throw new Error('未登录');

      const authHeaders = { 'Content-Type': 'application/json' };
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      if (deviceToken)           authHeaders['X-Device-Token'] = deviceToken;

      const res = await fetch('/.netlify/functions/grammar-next-exercise', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ topic_id: topicId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setExercise(data.exercise);
      setMastery(data.mastery || 0);
    } catch (e) {
      console.warn('[grammar] next:', e);
      alert(e.message);
    }
    setLoadingEx(false);
  }, [topicId]);

  // Enter practice tab → auto-load first exercise
  useEffect(() => {
    if (tab === 'practice' && !exercise && !feedback) {
      fetchNext();
    }
  }, [tab, exercise, feedback, fetchNext]);

  async function submitAnswer(userAnswer) {
    if (!exercise || submitting) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const deviceToken = localStorage.getItem('jgw_device_token');

      const authHeaders = { 'Content-Type': 'application/json' };
      if (session?.access_token) authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      if (deviceToken)           authHeaders['X-Device-Token'] = deviceToken;

      const res = await fetch('/.netlify/functions/grammar-submit-answer', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          topic_id: topicId,
          exercise_id: exercise.id,
          user_answer: userAnswer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setFeedback(data);
      setMastery(data.new_mastery);
    } catch (e) {
      alert(e.message);
    }
    setSubmitting(false);
  }

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: V.text3 }}>
      {t('加载中…', 'Loading…', 'Caricamento…')}
    </div>;
  }
  if (!topic) {
    return <div style={{ padding: 60, textAlign: 'center', color: V.text3 }}>
      {t('主题未找到', 'Topic not found', 'Argomento non trovato')}
    </div>;
  }

  const title = lang === 'zh' ? topic.title_zh
             : lang === 'it' ? (topic.title_it || topic.title_en)
             : (topic.title_en || topic.title_zh);

  const masteryPct = Math.round(mastery * 100);
  const masteryLabel =
      mastery >= 0.9 ? (lang === 'zh' ? '已掌握' : 'Mastered')
    : mastery >= 0.6 ? (lang === 'zh' ? '熟练' : 'Proficient')
    : mastery >= 0.3 ? (lang === 'zh' ? '学习中' : 'Learning')
    :                  (lang === 'zh' ? '起步' : 'Beginner');

  return (
    <div style={{ minHeight: '100dvh', background: V.bg, paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ padding: '14px 16px 6px',
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{
          padding: '5px 12px', fontSize: 13, background: V.card,
          border: `1px solid ${V.border}`, borderRadius: 6, cursor: 'pointer',
          color: V.text,
        }}>← {t('返回', 'Back', 'Indietro')}</button>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 500, color: V.accent,
          fontFamily: "'STKaiti','KaiTi',serif" }}>
          {title}
        </div>
      </div>

      {/* Mastery bar */}
      <div style={{ padding: '4px 16px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: V.text3, marginBottom: 3 }}>
          <span>{masteryLabel}</span>
          <span>{masteryPct}%</span>
        </div>
        <div style={{ height: 6, background: V.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: `${masteryPct}%`,
            height: '100%',
            background: masteryPct >= 90 ? V.green : masteryPct >= 60 ? V.orange : V.accent,
            transition: 'width 0.4s',
          }}/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px' }}>
        {[
          ['study',    t('讲解', 'Study', 'Studia')],
          ['practice', t('练习', 'Practice', 'Pratica')],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: '8px', fontSize: 13,
            background: tab === id ? V.accent : V.card,
            color:      tab === id ? '#fff'   : V.text,
            border: `1px solid ${tab === id ? V.accent : V.border}`,
            borderRadius: 6, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {/* ── STUDY TAB ── */}
      {tab === 'study' && (
        <div style={{ padding: '0 16px' }}>
          {topic.explanation && (
            <div style={{
              background: V.card, border: `1px solid ${V.border}`,
              borderRadius: 10, padding: 16, marginBottom: 14,
              fontSize: 14, lineHeight: 1.7, color: V.text,
              whiteSpace: 'pre-wrap',
            }}>
              {renderMarkdown(topic.explanation)}
            </div>
          )}

          {(topic.examples || []).length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: V.text3, margin: '10px 0 8px',
                fontFamily: "'STKaiti','KaiTi',serif" }}>
                · {t('例句', 'Examples', 'Esempi')} ·
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {topic.examples.map((ex, i) => (
                  <div key={i} style={{
                    background: V.accentLight, border: `1px solid ${V.accent}33`,
                    borderRadius: 8, padding: 12,
                  }}>
                    <div style={{ fontSize: 16, color: V.text,
                      fontFamily: "'STKaiti','KaiTi',serif" }}>
                      {ex.zh}
                    </div>
                    {ex.pinyin && (
                      <div style={{ fontSize: 11, color: V.text3, marginTop: 3,
                        fontStyle: 'italic' }}>
                        {ex.pinyin}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: V.text2, marginTop: 4 }}>
                      {lang === 'it' && ex.it ? ex.it : (ex.en || '')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setTab('practice')} style={{
            width: '100%', marginTop: 20, padding: '12px',
            background: V.accent, color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: 14, fontFamily: "'STKaiti','KaiTi',serif",
            letterSpacing: 2,
          }}>
            {t('开始练习 →', 'Start practice →', 'Inizia pratica →')}
          </button>
        </div>
      )}

      {/* ── PRACTICE TAB ── */}
      {tab === 'practice' && (
        <div style={{ padding: '0 16px' }}>
          {loadingEx ? (
            <div style={{ padding: 40, textAlign: 'center', color: V.text3 }}>
              {t('选题中…', 'Loading…', 'Caricamento…')}
            </div>
          ) : feedback ? (
            <FeedbackCard feedback={feedback} lang={lang}
              onNext={() => { setFeedback(null); fetchNext(); }}/>
          ) : exercise ? (
            <GrammarExerciseCard exercise={exercise}
              lang={lang}
              onSubmit={submitAnswer}
              submitting={submitting}/>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: V.text3 }}>
              {t('暂无题目', 'No exercises', 'Nessun esercizio')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ feedback, lang, onNext }) {
  const t = (zh, en, it) => lang === 'zh' ? zh : lang === 'it' ? (it || en) : en;
  const correct = feedback.correct;
  const deltaStr = feedback.delta > 0
    ? `+${(feedback.delta * 100).toFixed(1)}%`
    : `${(feedback.delta * 100).toFixed(1)}%`;

  return (
    <div style={{
      background: correct ? '#E8F5E9' : '#FFEBEE',
      border: `1px solid ${correct ? '#A5D6A7' : '#FFCDD2'}`,
      borderRadius: 10, padding: 20, marginTop: 10,
    }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>
        {correct ? '✓' : '✗'}
      </div>
      <div style={{ fontSize: 15, fontWeight: 500,
        color: correct ? '#2E7D32' : '#c62828', marginBottom: 10 }}>
        {correct
          ? t('正确', 'Correct', 'Corretto')
          : t('不对', 'Not quite', 'Non corretto')}
        <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.7 }}>
          ({deltaStr})
        </span>
      </div>

      {!correct && (
        <div style={{ fontSize: 13, color: '#333', marginBottom: 8 }}>
          <span style={{ fontWeight: 500 }}>
            {t('正确答案：', 'Correct answer: ', 'Risposta: ')}
          </span>
          <span style={{ fontFamily: "'STKaiti','KaiTi',serif" }}>
            {feedback.correct_answer}
          </span>
        </div>
      )}

      {feedback.explanation && (
        <div style={{ fontSize: 12, color: '#555', marginBottom: 12,
          padding: 10, background: 'rgba(0,0,0,0.03)', borderRadius: 6 }}>
          {feedback.explanation}
        </div>
      )}

      <button onClick={onNext} style={{
        width: '100%', padding: 10,
        background: correct ? '#2E7D32' : '#7B3F3F',
        color: '#fff', border: 'none', borderRadius: 6,
        cursor: 'pointer', fontSize: 13,
        fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2,
      }}>
        {t('下一题 →', 'Next →', 'Prossimo →')}
      </button>
    </div>
  );
}

// ── Minimal markdown rendering (bold + line breaks only) ──
function renderMarkdown(md) {
  // Split to paragraphs, handle **bold**
  const parts = md.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}
