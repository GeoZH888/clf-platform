# install_teacher.py
# Phase 2B: AI-first TeacherDashboard for /school/teacher-dashboard
# Run from clf-platform root: python install_teacher.py

import pathlib, sys, re

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "school" / "SchoolApp.jsx").exists():
    print("ERROR: run this from the clf-platform root (no src/school/SchoolApp.jsx)")
    sys.exit(1)

TEACHER = ROOT / "src" / "school" / "teacher"
for sub in ["", "home", "analytics"]:
    (TEACHER / sub).mkdir(parents=True, exist_ok=True)

(ROOT / "netlify" / "functions").mkdir(parents=True, exist_ok=True)
(ROOT / "supabase_migrations").mkdir(parents=True, exist_ok=True)


# ====================================================================
# FILE: src/school/teacher/TeacherDashboard.jsx
# ====================================================================
TEACHER_DASHBOARD = '''// src/school/teacher/TeacherDashboard.jsx
// AI-first teacher landing. 4 quick-action cards + live stats + AI panels.
// Built fresh; existing David-Chinese pages (homework / messages / notices)
// are linked via the action cards but not replaced.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, FileCheck, MessageSquare, Bell, LogOut } from 'lucide-react';
import DashboardStats     from './home/DashboardStats';
import ClassAnalyticsCard from './analytics/ClassAnalyticsCard';
import StudentSpotlight   from './analytics/StudentSpotlight';

const T = {
  zh: {
    title: '\u6559\u5e08\u5de5\u4f5c\u53f0',
    subtitle: '\u5927\u536b\u5b66\u4e2d\u6587 \u00B7 \u6559\u5e08\u7aef',
    quickActions: '\u5feb\u901f\u8bbf\u95ee',
    coursePrep: '\u5907\u8bfe',
    homework: '\u4f5c\u4e1a',
    communication: '\u5bb6\u6821\u6c9f\u901a',
    notices: '\u901a\u77e5\u516c\u544a',
    coursePrepDesc: 'AI + RAG \u8f85\u52a9',
    homeworkDesc: '\u5e03\u7f6e \u00B7 \u6279\u6539 \u00B7 \u591a\u6a21\u6001',
    communicationDesc: '\u4e0e\u5bb6\u957f\u4e00\u5bf9\u4e00',
    noticesDesc: '\u73ed\u7ea7\u5e7f\u64ad',
  },
  en: {
    title: 'Teacher Workspace',
    subtitle: 'David Chinese \u00B7 Teacher',
    quickActions: 'Quick actions',
    coursePrep: 'Course prep',
    homework: 'Homework',
    communication: 'Communication',
    notices: 'Notices',
    coursePrepDesc: 'AI + RAG assistant',
    homeworkDesc: 'Assign \u00B7 grade \u00B7 multimodal',
    communicationDesc: '1-on-1 with parents',
    noticesDesc: 'Class broadcasts',
  },
  it: {
    title: 'Workspace Insegnante',
    subtitle: 'David Chinese \u00B7 Insegnante',
    quickActions: 'Azioni rapide',
    coursePrep: 'Preparazione',
    homework: 'Compiti',
    communication: 'Comunicazione',
    notices: 'Avvisi',
    coursePrepDesc: 'Assistente AI + RAG',
    homeworkDesc: 'Assegna \u00B7 correggi \u00B7 multimodale',
    communicationDesc: '1 a 1 con i genitori',
    noticesDesc: 'Annunci di classe',
  },
};

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [lang, setLang] = useState('zh');
  const t = T[lang];

  const cards = [
    { icon: BookOpen,      title: t.coursePrep,     desc: t.coursePrepDesc,     to: '/teacher-materials',     color: '#3b82f6' },
    { icon: FileCheck,     title: t.homework,       desc: t.homeworkDesc,       to: '/teacher-homework',      color: '#10b981' },
    { icon: MessageSquare, title: t.communication,  desc: t.communicationDesc,  to: '/teacher-communication', color: '#f59e0b' },
    { icon: Bell,          title: t.notices,        desc: t.noticesDesc,        to: '/notifications',         color: '#8b5cf6' },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: '#fdf6e3' }}>
      <header style={{
        background: '#c41e3a', color: '#fff', padding: '16px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700,
            fontFamily: "'STKaiti','KaiTi',serif", letterSpacing: 2 }}>
            {t.title}
          </div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            {t.subtitle} \u00B7 {user?.name || user?.email}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['zh','en','it'].map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              background: lang === l ? '#fff' : 'transparent',
              color: lang === l ? '#c41e3a' : '#fff',
              border: '1px solid rgba(255,255,255,0.4)',
            }}>{l.toUpperCase()}</button>
          ))}
          <button onClick={logout} style={{
            marginLeft: 8, padding: '6px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer',
            fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <LogOut size={14}/>
          </button>
        </div>
      </header>

      <div style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
        <DashboardStats lang={lang}/>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16, marginTop: 24,
        }}>
          <ClassAnalyticsCard lang={lang}/>
          <StudentSpotlight lang={lang}/>
        </div>

        <div style={{ marginTop: 28, fontSize: 13, fontWeight: 600,
          color: '#8B4513', marginBottom: 12 }}>
          {t.quickActions}
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12,
        }}>
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <button key={i} onClick={() => navigate(c.to)} style={{
                background: '#fff', border: `1.5px solid ${c.color}33`,
                borderRadius: 14, padding: 16, textAlign: 'left', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: `0 2px 8px ${c.color}15`, transition: 'transform .15s',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: `${c.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={20} color={c.color}/>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a0a05' }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#a07850', marginTop: 2 }}>
                    {c.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
'''


# ====================================================================
# FILE: src/school/teacher/home/useTeacherRealtime.js
# ====================================================================
USE_REALTIME = '''// src/school/teacher/home/useTeacherRealtime.js
// Subscribes to Supabase Realtime channels for the teacher's class data.
// Returns live counters: today's submissions, attendance %, students, pending grades.

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../services/supabase';

export function useTeacherRealtime(teacherId) {
  const [stats, setStats] = useState({
    submissionsToday: 0,
    attendanceRate: 0,
    activeStudents: 0,
    pendingHomework: 0,
  });
  const [loading, setLoading] = useState(true);
  const fetchTimer = useRef(null);

  const fetchStats = async () => {
    if (!teacherId) return;
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Teacher's classes
      const { data: classes } = await supabase
        .from('clf_classes')
        .select('id')
        .eq('teacher_id', teacherId);
      const classIds = (classes || []).map(c => c.id);

      if (classIds.length === 0) {
        setStats({ submissionsToday: 0, attendanceRate: 0, activeStudents: 0, pendingHomework: 0 });
        setLoading(false);
        return;
      }

      const queries = await Promise.all([
        supabase.from('clf_homework_submissions')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', today + 'T00:00:00Z')
          .in('class_id', classIds),
        supabase.from('clf_class_attendance')
          .select('present')
          .eq('date', today)
          .in('class_id', classIds),
        supabase.from('clf_class_members')
          .select('*', { count: 'exact', head: true })
          .in('class_id', classIds),
        supabase.from('clf_homework_submissions')
          .select('*', { count: 'exact', head: true })
          .is('graded_at', null)
          .in('class_id', classIds),
      ]);

      const submissionsToday = queries[0].count || 0;
      const attRows = queries[1].data || [];
      const attendanceRate = attRows.length > 0
        ? Math.round((attRows.filter(a => a.present).length / attRows.length) * 100)
        : 0;
      const activeStudents = queries[2].count || 0;
      const pendingHomework = queries[3].count || 0;

      setStats({ submissionsToday, attendanceRate, activeStudents, pendingHomework });
    } catch (e) {
      console.warn('[useTeacherRealtime]', e);
    } finally {
      setLoading(false);
    }
  };

  // Debounced re-fetch on realtime events
  const scheduleRefetch = () => {
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(fetchStats, 500);
  };

  useEffect(() => {
    if (!teacherId) return;
    fetchStats();

    const channel = supabase
      .channel(`teacher-stats-${teacherId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'clf_homework_submissions' },
        scheduleRefetch
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'clf_class_attendance' },
        scheduleRefetch
      )
      .subscribe();

    return () => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  return { stats, loading, refresh: fetchStats };
}
'''


# ====================================================================
# FILE: src/school/teacher/home/DashboardStats.jsx
# ====================================================================
DASHBOARD_STATS = '''// src/school/teacher/home/DashboardStats.jsx
// 4 live tiles: today's submissions, attendance %, students, pending grades.
// All update via Supabase Realtime channels (see useTeacherRealtime).

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { FileCheck, Users, Clock, TrendingUp } from 'lucide-react';
import { useTeacherRealtime } from './useTeacherRealtime';

const T = {
  zh: {
    submissionsToday: '\u4eca\u65e5\u63d0\u4ea4',
    attendance: '\u51fa\u52e4\u7387',
    students: '\u5b66\u751f\u603b\u6570',
    pending: '\u5f85\u6279\u6539',
  },
  en: {
    submissionsToday: 'Submitted today',
    attendance: 'Attendance',
    students: 'Students',
    pending: 'To grade',
  },
  it: {
    submissionsToday: 'Compiti di oggi',
    attendance: 'Presenza',
    students: 'Studenti',
    pending: 'Da correggere',
  },
};

export default function DashboardStats({ lang = 'zh' }) {
  const { user } = useAuth();
  const { stats, loading } = useTeacherRealtime(user?.id);
  const t = T[lang];

  const tiles = [
    { icon: FileCheck,  label: t.submissionsToday, value: stats.submissionsToday, color: '#10b981', suffix: '' },
    { icon: TrendingUp, label: t.attendance,       value: stats.attendanceRate,   color: '#3b82f6', suffix: '%' },
    { icon: Users,      label: t.students,         value: stats.activeStudents,   color: '#f59e0b', suffix: '' },
    { icon: Clock,      label: t.pending,          value: stats.pendingHomework,  color: '#c41e3a', suffix: '' },
  ];

  return (
    <div style={{ display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
      {tiles.map((tile, i) => {
        const Icon = tile.icon;
        return (
          <div key={i} style={{
            background: '#fff', borderRadius: 12, padding: 16,
            border: `1px solid ${tile.color}22`,
            boxShadow: `0 1px 3px ${tile.color}10`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', gap: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10,
                background: `${tile.color}15`, display: 'flex',
                alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={tile.color}/>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700,
                color: tile.color, lineHeight: 1 }}>
                {loading ? '\u2014' : `${tile.value}${tile.suffix}`}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#a07850', marginTop: 6 }}>
              {tile.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
'''


# ====================================================================
# FILE: src/school/teacher/analytics/useClassAnalytics.js
# ====================================================================
USE_ANALYTICS = '''// src/school/teacher/analytics/useClassAnalytics.js
// Fetches AI weekly summary, caches in clf_class_ai_summaries (24-hr TTL).

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../services/supabase';

export function useClassAnalytics(teacherId, opts = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const refresh = useCallback(async (force = false) => {
    if (!teacherId) return;
    setLoading(true); setErr(null);
    try {
      if (!force) {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: cache } = await supabase
          .from('clf_class_ai_summaries')
          .select('summary, created_at, provider')
          .eq('teacher_id', teacherId)
          .eq('task', 'analyze_class')
          .gte('created_at', yesterday)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cache) {
          setData({ text: cache.summary, cached: true,
            generated_at: cache.created_at, provider: cache.provider });
          setLoading(false);
          return;
        }
      }

      const res = await fetch('/.netlify/functions/clf-teacher-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'analyze_class',
          teacher_id: teacherId,
          provider: opts.provider || 'claude',
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`AI gateway ${res.status}: ${txt.slice(0,200)}`);
      }
      const json = await res.json();
      setData({ text: json.summary, cached: false,
        generated_at: new Date().toISOString(), provider: json.provider });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [teacherId, opts.provider]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, err, refresh: () => refresh(true) };
}
'''


# ====================================================================
# FILE: src/school/teacher/analytics/ClassAnalyticsCard.jsx
# ====================================================================
ANALYTICS_CARD = '''// src/school/teacher/analytics/ClassAnalyticsCard.jsx
// AI weekly summary panel. Uses useClassAnalytics with caching.

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Brain, RefreshCw, Loader2 } from 'lucide-react';
import { useClassAnalytics } from './useClassAnalytics';

const T = {
  zh: {
    title: 'AI \u73ed\u7ea7\u5468\u62a5',
    poweredBy: '\u7531 {p} \u5206\u6790',
    refresh: '\u91cd\u65b0\u751f\u6210',
    loading: '\u6b63\u5728\u5206\u6790\u00b7\u00b7\u00b7',
    empty: '\u6682\u65e0\u73ed\u7ea7\u6570\u636e',
    cached: '\u7f13\u5b58\u4e8e {t}',
    error: '\u751f\u6210\u5931\u8d25',
  },
  en: {
    title: 'AI weekly summary',
    poweredBy: 'by {p}',
    refresh: 'Regenerate',
    loading: 'Analyzing\u2026',
    empty: 'No class data',
    cached: 'Cached at {t}',
    error: 'Generation failed',
  },
  it: {
    title: 'Riepilogo settimanale AI',
    poweredBy: 'da {p}',
    refresh: 'Rigenera',
    loading: 'Analisi\u2026',
    empty: 'Nessun dato',
    cached: 'In cache da {t}',
    error: 'Errore',
  },
};

const PROVIDERS = ['claude', 'gpt-4o', 'deepseek', 'gemini'];

export default function ClassAnalyticsCard({ lang = 'zh' }) {
  const { user } = useAuth();
  const [provider, setProvider] = useState('claude');
  const { data, loading, err, refresh } = useClassAnalytics(user?.id, { provider });
  const t = T[lang];

  const fmtTime = (iso) => new Date(iso).toLocaleString();

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 18,
      border: '1px solid #e8d5b0', minHeight: 220,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: '#3b82f615',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={18} color="#3b82f6"/>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a0a05' }}>{t.title}</div>
            <div style={{ fontSize: 10, color: '#a07850' }}>
              {t.poweredBy.replace('{p}', data?.provider || provider)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={provider} onChange={e => setProvider(e.target.value)}
            disabled={loading} style={{
              fontSize: 11, padding: '4px 6px', borderRadius: 6,
              border: '1px solid #e8d5b0', background: '#fff',
              color: '#5d4630', cursor: loading ? 'default' : 'pointer',
            }}>
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={refresh} disabled={loading} style={{
            padding: '4px 8px', borderRadius: 6, border: '1px solid #e8d5b0',
            background: '#fff', cursor: loading ? 'default' : 'pointer',
            fontSize: 11, color: '#8B4513',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {loading ? <Loader2 size={12}/> : <RefreshCw size={12}/>}
            {t.refresh}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 13, color: '#3a2410',
        lineHeight: 1.7, flex: 1 }}>
        {loading ? (
          <div style={{ color: '#a07850' }}>{t.loading}</div>
        ) : err ? (
          <div style={{ color: '#c41e3a', fontSize: 12 }}>{t.error}: {err}</div>
        ) : data?.text ? (
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
            {data.text}
          </pre>
        ) : (
          <div style={{ color: '#a07850' }}>{t.empty}</div>
        )}
      </div>

      {data?.cached && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#a07850',
          textAlign: 'right', fontStyle: 'italic' }}>
          {t.cached.replace('{t}', fmtTime(data.generated_at))}
        </div>
      )}
    </div>
  );
}
'''


# ====================================================================
# FILE: src/school/teacher/analytics/StudentSpotlight.jsx
# ====================================================================
SPOTLIGHT = '''// src/school/teacher/analytics/StudentSpotlight.jsx
// AI-flagged students who need attention. Reads clf_teacher_alerts.
// Realtime subscription so new flags appear without refresh.

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Sparkles, X } from 'lucide-react';
import { supabase } from '../../services/supabase';

const T = {
  zh: {
    title: 'AI \u5b66\u751f\u5173\u6ce8',
    subtitle: '\u9700\u8981\u60a8\u5173\u6ce8\u7684\u5b66\u751f',
    empty: '\u6240\u6709\u5b66\u751f\u8fdb\u5ea6\u826f\u597d \u2728',
    severity: { high: '\u7d27\u6025', medium: '\u9700\u5173\u6ce8', low: '\u63d0\u793a' },
    dismiss: '\u5ffd\u7565',
  },
  en: {
    title: 'AI student spotlight',
    subtitle: 'Students who need attention',
    empty: 'All students on track \u2728',
    severity: { high: 'Urgent', medium: 'Attention', low: 'Info' },
    dismiss: 'Dismiss',
  },
  it: {
    title: 'Spotlight studenti AI',
    subtitle: 'Studenti che richiedono attenzione',
    empty: 'Tutti gli studenti procedono bene \u2728',
    severity: { high: 'Urgente', medium: 'Attenzione', low: 'Info' },
    dismiss: 'Ignora',
  },
};

const SEVERITY_COLORS = {
  high: '#c41e3a',
  medium: '#f59e0b',
  low: '#3b82f6',
};

const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

export default function StudentSpotlight({ lang = 'zh' }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const t = T[lang];

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('clf_teacher_alerts')
      .select('*')
      .eq('teacher_id', user.id)
      .eq('dismissed', false)
      .limit(10);
    const sorted = (data || []).sort(
      (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0)
    ).slice(0, 5);
    setAlerts(sorted);
    setLoading(false);
  };

  const dismiss = async (id) => {
    await supabase.from('clf_teacher_alerts')
      .update({ dismissed: true })
      .eq('id', id);
    setAlerts(alerts.filter(a => a.id !== id));
  };

  useEffect(() => {
    if (!user?.id) return;
    load();

    const channel = supabase
      .channel(`alerts-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'clf_teacher_alerts',
          filter: `teacher_id=eq.${user.id}` },
        load
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 18,
      border: '1px solid #e8d5b0', minHeight: 220,
    }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: '#f59e0b15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={18} color="#f59e0b"/>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a0a05' }}>{t.title}</div>
          <div style={{ fontSize: 10, color: '#a07850' }}>{t.subtitle}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: '#a07850' }}>\u00b7\u00b7\u00b7</div>
      ) : alerts.length === 0 ? (
        <div style={{ fontSize: 13, color: '#a07850',
          padding: '24px 0', textAlign: 'center' }}>
          {t.empty}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map(a => {
            const color = SEVERITY_COLORS[a.severity] || '#a07850';
            return (
              <div key={a.id} style={{
                padding: 10, borderRadius: 8, background: `${color}08`,
                borderLeft: `3px solid ${color}`,
                display: 'flex', justifyContent: 'space-between', gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 4, gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600,
                      color: '#1a0a05', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.student_name}
                    </div>
                    <span style={{ fontSize: 10, padding: '2px 6px',
                      borderRadius: 4, background: color, color: '#fff',
                      flexShrink: 0 }}>
                      {t.severity[a.severity]}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#5d4630',
                    lineHeight: 1.5 }}>{a.reason}</div>
                </div>
                <button onClick={() => dismiss(a.id)} title={t.dismiss}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: '#a07850', padding: 0, alignSelf: 'flex-start',
                  }}>
                  <X size={14}/>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
'''


# ====================================================================
# FILE: netlify/functions/clf-teacher-ai.js
# ====================================================================
NETLIFY_FN = '''// netlify/functions/clf-teacher-ai.js
// Multi-provider AI gateway for teacher analytics.
// Tasks: analyze_class | spotlight_students | lesson_plan
// Providers: claude | gpt-4o | deepseek | gemini

const { createClient } = require('@supabase/supabase-js');

const SUPA_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const { task, teacher_id, provider = 'claude', payload = {} } = body;
  if (!task || !teacher_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'task and teacher_id required' }) };
  }

  try {
    if (!SUPA_URL || !SUPA_KEY) {
      throw new Error('Supabase env vars not configured on Netlify');
    }
    const supa = createClient(SUPA_URL, SUPA_KEY);
    const ctx = await gatherContext(supa, teacher_id);

    if (!ctx.hasData) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: 'No class data yet. Add classes and students to begin.',
          provider, task, empty: true,
        }),
      };
    }

    const prompt = buildPrompt(task, ctx, payload);
    const text = await callProvider(provider, prompt);

    if (task === 'analyze_class') {
      await supa.from('clf_class_ai_summaries').insert({
        teacher_id, summary: text, provider, task,
      }).then(() => null).catch(e => console.warn('cache insert failed', e));
    }

    if (task === 'spotlight_students') {
      try {
        const alerts = JSON.parse(text);
        if (Array.isArray(alerts)) {
          const rows = alerts
            .filter(a => a.student_name && a.severity && a.reason)
            .map(a => ({
              teacher_id,
              student_id: a.student_id || null,
              student_name: a.student_name,
              severity: ['high','medium','low'].includes(a.severity) ? a.severity : 'low',
              reason: a.reason,
              category: a.category || null,
            }));
          if (rows.length) {
            await supa.from('clf_teacher_alerts').insert(rows);
          }
        }
      } catch (e) {
        console.warn('spotlight parse failed', e);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: text, provider, task }),
    };
  } catch (err) {
    console.error('[clf-teacher-ai]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

async function gatherContext(supa, teacherId) {
  const { data: classes } = await supa.from('clf_classes')
    .select('id, name, grade_level').eq('teacher_id', teacherId);
  if (!classes || classes.length === 0) return { hasData: false };

  const classIds = classes.map(c => c.id);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [subs, att, members] = await Promise.all([
    supa.from('clf_homework_submissions')
      .select('class_id, student_id, score, created_at, graded_at')
      .in('class_id', classIds).gte('created_at', weekAgo),
    supa.from('clf_class_attendance')
      .select('class_id, student_id, present, date')
      .in('class_id', classIds).gte('date', weekAgo.slice(0, 10)),
    supa.from('clf_class_members')
      .select('class_id, student_id, student_name')
      .in('class_id', classIds),
  ]);

  return {
    hasData: true,
    classes,
    submissions: subs.data || [],
    attendance: att.data || [],
    members: members.data || [],
  };
}

function buildPrompt(task, ctx, payload) {
  const blob = JSON.stringify(ctx, null, 2);

  if (task === 'analyze_class') {
    return {
      system: `You are a Chinese-language teaching assistant. Given the past 7 days of class data, write a concise weekly summary (4-6 sentences) in Simplified Chinese covering: overall engagement, attendance trends, common difficulties, and one specific actionable recommendation. Keep it warm and practical.`,
      user: `Past 7 days of class data:\\n\\n${blob}\\n\\nWrite the weekly summary now.`,
    };
  }
  if (task === 'spotlight_students') {
    return {
      system: `You are a Chinese-language teaching assistant. Identify 3-5 students who need attention based on this data. Return ONLY a JSON array (no prose). Each item: { student_id, student_name, severity: "high"|"medium"|"low", reason: "concise Chinese explanation", category: "attendance"|"grades"|"engagement" }. Be specific and actionable.`,
      user: `Class data:\\n\\n${blob}\\n\\nReturn the JSON array.`,
    };
  }
  if (task === 'lesson_plan') {
    return {
      system: `You are a Chinese-language teaching assistant. Generate a 45-minute lesson plan adapted to this class's level. Format: Goals / Warm-up / Core / Practice / Assessment / Homework. Use Simplified Chinese.`,
      user: `Topic: ${payload.topic || 'unspecified'}\\n\\nClass context:\\n${blob}\\n\\nGenerate the lesson plan.`,
    };
  }
  throw new Error(`Unknown task: ${task}`);
}

async function callProvider(provider, { system, user }) {
  if (provider === 'claude') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Claude ${r.status}`);
    return j.content[0].text;
  }

  if (provider === 'gpt-4o' || provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 1500,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `OpenAI ${r.status}`);
    return j.choices[0].message.content;
  }

  if (provider === 'deepseek') {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 1500,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `DeepSeek ${r.status}`);
    return j.choices[0].message.content;
  }

  if (provider === 'gemini') {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: 1500 },
        }),
      }
    );
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `Gemini ${r.status}`);
    return j.candidates[0].content.parts[0].text;
  }

  throw new Error(`Unknown provider: ${provider}`);
}
'''


# ====================================================================
# FILE: supabase_migrations/phase2b_teacher_dashboard.sql
# ====================================================================
SQL = '''-- =================================================================
-- Phase 2B: TeacherDashboard tables
-- Run in Supabase SQL editor for project yqcojudvvjntaajnrilr.
-- Idempotent. Safe to re-run.
-- =================================================================

-- Cache for AI weekly summaries (24-hour TTL via app-side query filter)
CREATE TABLE IF NOT EXISTS clf_class_ai_summaries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id    uuid,
  summary     text NOT NULL,
  provider    text,
  task        text NOT NULL DEFAULT 'analyze_class',
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clf_class_ai_summaries_teacher_idx
  ON clf_class_ai_summaries(teacher_id, task, created_at DESC);

-- AI-flagged students needing attention
CREATE TABLE IF NOT EXISTS clf_teacher_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name    text NOT NULL,
  severity        text NOT NULL CHECK (severity IN ('low','medium','high')),
  reason          text NOT NULL,
  category        text,
  dismissed       boolean NOT NULL DEFAULT false,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clf_teacher_alerts_active_idx
  ON clf_teacher_alerts(teacher_id, dismissed, severity);

-- Enable Realtime on the alerts table so StudentSpotlight gets live updates
DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='clf_teacher_alerts';
  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE clf_teacher_alerts;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Row-Level Security
ALTER TABLE clf_class_ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clf_teacher_alerts     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher own summaries" ON clf_class_ai_summaries;
CREATE POLICY "teacher own summaries"
  ON clf_class_ai_summaries FOR ALL
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "teacher own alerts" ON clf_teacher_alerts;
CREATE POLICY "teacher own alerts"
  ON clf_teacher_alerts FOR ALL
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Sanity check
SELECT 'tables' AS what, count(*) FROM information_schema.tables
  WHERE table_name IN ('clf_class_ai_summaries','clf_teacher_alerts')
UNION ALL
SELECT 'policies', count(*) FROM pg_policies
  WHERE tablename IN ('clf_class_ai_summaries','clf_teacher_alerts');
'''


# ====================================================================
# Write everything
# ====================================================================
files = {
    "src/school/teacher/TeacherDashboard.jsx":                    TEACHER_DASHBOARD,
    "src/school/teacher/home/useTeacherRealtime.js":              USE_REALTIME,
    "src/school/teacher/home/DashboardStats.jsx":                 DASHBOARD_STATS,
    "src/school/teacher/analytics/useClassAnalytics.js":          USE_ANALYTICS,
    "src/school/teacher/analytics/ClassAnalyticsCard.jsx":        ANALYTICS_CARD,
    "src/school/teacher/analytics/StudentSpotlight.jsx":          SPOTLIGHT,
    "netlify/functions/clf-teacher-ai.js":                        NETLIFY_FN,
    "supabase_migrations/phase2b_teacher_dashboard.sql":          SQL,
}

print("=== Writing teacher dashboard files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    print(f"  wrote  {rel}")

# Verify Chinese survived
sample = (ROOT / "src/school/teacher/TeacherDashboard.jsx").read_text(encoding="utf-8")
assert "\u6559\u5e08\u5de5\u4f5c\u53f0" in sample, "Chinese chars corrupted!"
print("  OK -- Chinese chars preserved")

# ====================================================================
# Patch SchoolApp.jsx to mount /teacher-dashboard route
# ====================================================================
print("\n=== Patching src/school/SchoolApp.jsx ===")
sa = ROOT / "src" / "school" / "SchoolApp.jsx"
src = sa.read_text(encoding="utf-8")
orig = src

if "TeacherDashboard" not in src:
    # Find a good place to add the import (after the other page imports)
    # We look for the last `import ... from './pages/...'` line
    import_pattern = re.compile(r"(import\s+\w+\s+from\s+'\./pages/[^']+';\s*\n)(?!.*import\s+\w+\s+from\s+'\./pages/)", re.DOTALL)
    m = import_pattern.search(src)
    if m:
        insertion = m.end()
        new_import = "import TeacherDashboard from './teacher/TeacherDashboard';\n"
        src = src[:insertion] + new_import + src[insertion:]
        print("  added TeacherDashboard import")
    else:
        print("  WARN: couldn't find page-imports section -- add manually:")
        print("        import TeacherDashboard from './teacher/TeacherDashboard';")

    # Add the route before the catch-all (or before </Routes>)
    route_jsx = '          <Route path="/teacher-dashboard" element={<TeacherDashboard />} />\n'
    if "</Routes>" in src and route_jsx not in src:
        src = src.replace("</Routes>", route_jsx + "        </Routes>", 1)
        print("  added /teacher-dashboard route")
    else:
        print("  WARN: couldn't find </Routes> closing tag -- add manually:")
        print(f'        <Route path="/teacher-dashboard" element={{<TeacherDashboard />}} />')

if src != orig:
    sa.write_text(src, encoding="utf-8")
    print("  SchoolApp.jsx written")
else:
    print("  no changes (already patched or markers not found)")

# ====================================================================
# Done
# ====================================================================
print("\n=== DONE ===")
print()
print("Next steps:")
print("  1. Run SQL migration:")
print("       Open Supabase SQL editor for yqcojudvvjntaajnrilr")
print("       Paste contents of supabase_migrations/phase2b_teacher_dashboard.sql")
print("       Run. Sanity check should print: tables=2, policies=2")
print()
print("  2. Set Netlify function env vars (in dashboard or via CLI):")
print('       netlify env:set ANTHROPIC_API_KEY "sk-ant-..." --context production')
print('       netlify env:set OPENAI_API_KEY    "sk-..."     --context production')
print('       netlify env:set DEEPSEEK_API_KEY  "sk-..."     --context production')
print('       netlify env:set GEMINI_API_KEY    "..."        --context production')
print('       netlify env:set SUPABASE_SERVICE_KEY "eyJ..."  --context production')
print("       (only the providers you actually use; SUPABASE_SERVICE_KEY is required)")
print()
print("  3. Test locally:")
print("       npm run dev")
print("       Open http://localhost:5174/school/teacher-dashboard")
print()
print("  4. Deploy when ready:")
print("       npm run build")
print("       netlify deploy --prod --dir dist --no-build")
