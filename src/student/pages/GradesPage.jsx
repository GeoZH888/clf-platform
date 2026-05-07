// src/student/pages/GradesPage.jsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Award } from 'lucide-react';

export default function GradesPage() {
  const { user } = useAuth();
  const [grades, setGrades] = useState([]);
  const [avg, setAvg] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('clf_homework_submissions')
        .select('id, score, feedback, graded_at, clf_homework(title, clf_classes(name))')
        .eq('student_id', user.id)
        .not('graded_at', 'is', null)
        .order('graded_at', { ascending: false });
      setGrades(data || []);
      const scored = (data || []).filter(g => g.score != null);
      if (scored.length > 0) {
        setAvg(scored.reduce((s, g) => s + Number(g.score), 0) / scored.length);
      }
    })();
  }, [user?.id]);

  return (
    <div>
      <h1 style={{ margin: '0 0 18px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>我的成绩</h1>
      {avg != null && (
        <div style={{
          background: '#fff', padding: 16, borderRadius: 12,
          border: '1px solid #10b98133', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <Award size={28} color="#10b981"/>
          <div>
            <div style={{ fontSize: 12, color: '#a07850' }}>平均分</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>
              {avg.toFixed(1)}
            </div>
          </div>
        </div>
      )}
      {grades.length === 0 ? (
        <div style={{ background: '#fff', padding: 30, borderRadius: 12,
          border: '1px dashed #e8d5b0', textAlign: 'center', color: '#a07850' }}>
          暂无成绩
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {grades.map(g => (
            <div key={g.id} style={{
              background: '#fff', padding: 12, borderRadius: 10,
              border: '1px solid #e8d5b0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {g.clf_homework?.title}
                </div>
                <div style={{ fontSize: 11, color: '#a07850', marginTop: 2 }}>
                  {g.clf_homework?.clf_classes?.name} · {new Date(g.graded_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{
                fontSize: 22, fontWeight: 700,
                color: g.score >= 80 ? '#10b981' : g.score >= 60 ? '#f59e0b' : '#c41e3a',
              }}>
                {g.score ?? '-'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
