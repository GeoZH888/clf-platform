// src/teacher/pages/GradingPage.jsx
// Teacher's grading workflow: list submissions -> grade + comment
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { PageHero } from '../../shared/RolePanelLayout';
import { CheckCircle, Clock } from 'lucide-react';

export default function GradingPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    const { data: cls } = await supabase
      .from('clf_classes').select('id').eq('teacher_id', user.id);
    const classIds = (cls || []).map(c => c.id);
    if (classIds.length === 0) { setPending([]); return; }

    const { data: hw } = await supabase
      .from('clf_homework').select('id').in('class_id', classIds);
    const hwIds = (hw || []).map(h => h.id);
    if (hwIds.length === 0) { setPending([]); return; }

    const { data } = await supabase
      .from('clf_homework_submissions')
      .select('*, clf_homework(title, clf_classes(name))')
      .in('homework_id', hwIds)
      .is('graded_at', null)
      .order('submitted_at', { ascending: true });
    setPending(data || []);
  };
  useEffect(() => { load(); }, [user?.id]);

  const grade = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await supabase.from('clf_homework_submissions').update({
        score: score ? Number(score) : null,
        feedback: feedback.trim() || null,
        graded_at: new Date().toISOString(),
        graded_by: user.id,
      }).eq('id', active.id);
      setActive(null); setScore(''); setFeedback('');
      load();
    } catch (e) { alert('保存失败：' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHero icon="✅" title="作业批改" subtitle="Grading" accentColor="#c41e3a"/>
      <div style={{ display: 'grid', gap: 16,
        gridTemplateColumns: active ? '1fr 1.5fr' : '1fr' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.length === 0 ? (
            <Empty>暂无待批改作业</Empty>
          ) : pending.map(s => (
            <button key={s.id} onClick={() => { setActive(s); setScore(''); setFeedback(''); }} style={{
              background: active?.id === s.id ? 'rgba(196,30,58,0.18)' : 'rgba(253,246,227,0.05)',
              border: `1px solid ${active?.id === s.id ? '#c41e3a' : 'rgba(255,245,230,0.15)'}`,
              borderRadius: 10, padding: 12, textAlign: 'left', cursor: 'pointer',
              color: '#fff5e6',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <Clock size={12} color="#fda4af"/>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {s.clf_homework?.title || '(无标题)'}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)' }}>
                {s.clf_homework?.clf_classes?.name} · 提交于 {new Date(s.submitted_at).toLocaleString()}
              </div>
            </button>
          ))}
        </div>

        {active && (
          <div style={{
            background: 'rgba(253,246,227,0.05)',
            border: '1px solid rgba(255,245,230,0.15)',
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff5e6', marginBottom: 6 }}>
              {active.clf_homework?.title}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(253,246,227,0.6)', marginBottom: 12 }}>
              提交内容：
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8,
              fontSize: 13, color: '#fff5e6', whiteSpace: 'pre-wrap',
              maxHeight: 240, overflowY: 'auto', marginBottom: 14,
            }}>
              {active.content || '(无文字内容)'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="number" value={score} onChange={e => setScore(e.target.value)}
                placeholder="分数 (0-100)" min={0} max={100} style={input}/>
              <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
                placeholder="批语（可选）" rows={4} style={{...input, resize: 'vertical'}}/>
              <button onClick={grade} disabled={saving} style={{
                background: '#10b981', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, display: 'inline-flex',
                alignItems: 'center', gap: 6, justifyContent: 'center',
              }}>
                <CheckCircle size={14}/> {saving ? '保存中…' : '完成批改'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const input = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,245,230,0.2)',
  color: '#fff5e6', padding: '8px 12px', borderRadius: 6,
  fontSize: 13, fontFamily: 'inherit',
};

function Empty({ children }) {
  return (
    <div style={{
      background: 'rgba(253,246,227,0.04)',
      border: '1px dashed rgba(255,245,230,0.2)',
      borderRadius: 12, padding: 30, textAlign: 'center',
      color: 'rgba(253,246,227,0.5)', fontSize: 13,
    }}>{children}</div>
  );
}
