// src/school/teacher/analytics/StudentSpotlight.jsx
// AI-flagged students who need attention. Reads clf_teacher_alerts.
// Realtime subscription so new flags appear without refresh.

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Sparkles, X } from 'lucide-react';
import { supabase } from '../../services/supabase';

const T = {
  zh: {
    title: 'AI 学生关注',
    subtitle: '需要您关注的学生',
    empty: '所有学生进度良好 ✨',
    severity: { high: '紧急', medium: '需关注', low: '提示' },
    dismiss: '忽略',
  },
  en: {
    title: 'AI student spotlight',
    subtitle: 'Students who need attention',
    empty: 'All students on track ✨',
    severity: { high: 'Urgent', medium: 'Attention', low: 'Info' },
    dismiss: 'Dismiss',
  },
  it: {
    title: 'Spotlight studenti AI',
    subtitle: 'Studenti che richiedono attenzione',
    empty: 'Tutti gli studenti procedono bene ✨',
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
        <div style={{ fontSize: 12, color: '#a07850' }}>···</div>
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
