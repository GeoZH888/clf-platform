// src/teacher/pages/CoursePrepWizard.jsx
// AI course-prep flow: knowledge map -> outline -> PPT/quiz
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../school/contexts/AuthContext';
import { supabase } from '../../school/services/supabase';
import { Sparkles, ArrowLeft, FileText, Brain, FileQuestion, Loader2 } from 'lucide-react';

const PROVIDERS = ['claude', 'gpt-4o', 'deepseek', 'gemini'];

export default function CoursePrepWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [provider, setProvider] = useState('claude');
  const [busy, setBusy] = useState(null);

  const load = async () => {
    const { data } = await supabase.from('clf_courses').select('*').eq('id', id).single();
    setCourse(data);
  };
  useEffect(() => { load(); }, [id]);

  const aiCall = async (task, payload = {}) => {
    setBusy(task);
    try {
      const res = await fetch('/.netlify/functions/clf-teacher-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, course_id: id, provider, payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } finally { setBusy(null); }
  };

  const buildKnowledgeMap = async () => {
    const result = await aiCall('knowledge_map');
    await supabase.from('clf_courses').update({ knowledge_map: result.data })
      .eq('id', id);
    load();
  };

  const buildOutline = async () => {
    const result = await aiCall('lesson_outline');
    await supabase.from('clf_courses').update({ outline: result.data })
      .eq('id', id);
    load();
  };

  const buildQuiz = async () => {
    const result = await aiCall('quiz');
    await supabase.from('clf_courses').update({ quiz: result.data })
      .eq('id', id);
    load();
  };

  if (!course) return <div style={{ padding: 24, color: '#a07850' }}>···</div>;

  return (
    <div>
      <button onClick={() => navigate('/courses')} style={{
        background: 'transparent', border: 'none', color: '#a07850',
        cursor: 'pointer', display: 'flex', gap: 4, alignItems: 'center',
        fontSize: 12, marginBottom: 12,
      }}><ArrowLeft size={12}/> 返回</button>

      <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#1a0a05',
        fontFamily: "'STKaiti','KaiTi',serif" }}>{course.title}</h1>
      <div style={{ fontSize: 12, color: '#a07850', marginBottom: 18 }}>
        {course.topic} · {course.level}
      </div>

      <div style={{ background: '#fff', padding: 14, borderRadius: 10,
        border: '1px solid #e8d5b0', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#5d4630' }}>AI 提供商:</span>
        <select value={provider} onChange={e => setProvider(e.target.value)}
          style={{ padding: '4px 8px', fontSize: 12,
            border: '1px solid #e8d5b0', borderRadius: 6 }}>
          {PROVIDERS.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <SectionCard
          icon={Brain} color="#8b5cf6" title="知识图谱"
          subtitle="补充与关联点 (algorithmic)"
          busy={busy === 'knowledge_map'}
          onRun={buildKnowledgeMap}
          payload={course.knowledge_map}
          renderPayload={km => (
            <pre style={{ fontSize: 11, color: '#5d4630', whiteSpace: 'pre-wrap',
              maxHeight: 200, overflow: 'auto', margin: 0 }}>
              {JSON.stringify(km, null, 2)}
            </pre>
          )}
        />
        <SectionCard
          icon={FileText} color="#3b82f6" title="课程大纲"
          subtitle="45 分钟课时计划"
          busy={busy === 'lesson_outline'}
          onRun={buildOutline}
          payload={course.outline}
          renderPayload={o => (
            <pre style={{ fontSize: 11, color: '#5d4630', whiteSpace: 'pre-wrap',
              maxHeight: 200, overflow: 'auto', margin: 0 }}>
              {typeof o === 'string' ? o : JSON.stringify(o, null, 2)}
            </pre>
          )}
        />
        <SectionCard
          icon={FileQuestion} color="#10b981" title="随堂小测"
          subtitle="多选 + 填空"
          busy={busy === 'quiz'}
          onRun={buildQuiz}
          payload={course.quiz}
          renderPayload={q => (
            <pre style={{ fontSize: 11, color: '#5d4630', whiteSpace: 'pre-wrap',
              maxHeight: 200, overflow: 'auto', margin: 0 }}>
              {JSON.stringify(q, null, 2)}
            </pre>
          )}
        />
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, color, title, subtitle, busy, onRun, payload, renderPayload }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12,
      border: `1px solid ${color}33`, padding: 16,
      display: 'flex', flexDirection: 'column', minHeight: 280 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon size={16} color={color}/></div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          <div style={{ fontSize: 11, color: '#a07850' }}>{subtitle}</div>
        </div>
      </div>

      <div style={{ flex: 1, marginBottom: 10 }}>
        {payload ? renderPayload(payload) : (
          <div style={{ fontSize: 12, color: '#a07850', fontStyle: 'italic',
            padding: 16, textAlign: 'center' }}>
            点击下方生成
          </div>
        )}
      </div>

      <button onClick={onRun} disabled={busy} style={{
        padding: '8px 12px', background: busy ? '#ccc' : color,
        color: '#fff', border: 'none', borderRadius: 8,
        cursor: busy ? 'wait' : 'pointer', fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
      }}>
        {busy ? <Loader2 size={12}/> : <Sparkles size={12}/>}
        {payload ? '重新生成' : '生成'}
      </button>
    </div>
  );
}
