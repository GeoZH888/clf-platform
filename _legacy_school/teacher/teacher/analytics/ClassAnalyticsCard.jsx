// src/school/teacher/analytics/ClassAnalyticsCard.jsx
// AI weekly summary panel. Uses useClassAnalytics with caching.

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Brain, RefreshCw, Loader2 } from 'lucide-react';
import { useClassAnalytics } from './useClassAnalytics';

const T = {
  zh: {
    title: 'AI 班级周报',
    poweredBy: '由 {p} 分析',
    refresh: '重新生成',
    loading: '正在分析···',
    empty: '暂无班级数据',
    cached: '缓存于 {t}',
    error: '生成失败',
  },
  en: {
    title: 'AI weekly summary',
    poweredBy: 'by {p}',
    refresh: 'Regenerate',
    loading: 'Analyzing…',
    empty: 'No class data',
    cached: 'Cached at {t}',
    error: 'Generation failed',
  },
  it: {
    title: 'Riepilogo settimanale AI',
    poweredBy: 'da {p}',
    refresh: 'Rigenera',
    loading: 'Analisi…',
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
