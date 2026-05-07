// src/admin/SchemaDiscoveryTab.jsx
// Introspects which clf_* tables exist + row counts per module.
// This is the foundation for building real CRUD per module in next sessions.
import React, { useEffect, useState } from 'react';
import { supabase } from '../school/services/supabase';
import { MODULES } from '../config/modules';

// Best-guess table mapping per module id (informed by session history)
const MODULE_TABLES = {
  home:       null,
  profile:    'clf_user_profiles',
  progress:   null,
  lianzi:     'clf_characters',
  words:      'clf_words',
  pinyin:     'clf_pinyin_lessons',
  grammar:    'clf_grammar_points',
  hsk:        'clf_hsk_questions',
  lessons:    'clf_lessons',
  chengyu:    'clf_chengyu',
  poetry:     'clf_poems',
  riddles:    'clf_riddles',
  scenario:   'clf_scenarios',
  story:      'clf_stories',
  chat:       null,
  voice:      null,
  homework:   'clf_homework',
  shop:       null,
  parents:    null,
};

export default function SchemaDiscoveryTab() {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

  const probe = async () => {
    setRunning(true);
    const out = {};
    for (const m of MODULES) {
      const tbl = MODULE_TABLES[m.id];
      if (!tbl) {
        out[m.id] = { table: null, exists: false, count: 0, status: 'no-table-needed' };
        continue;
      }
      try {
        const { count, error } = await supabase.from(tbl)
          .select('*', { count: 'exact', head: true });
        if (error) {
          out[m.id] = { table: tbl, exists: false, count: 0, status: 'missing',
            error: error.message };
        } else {
          out[m.id] = { table: tbl, exists: true, count: count || 0, status: 'ok' };
        }
      } catch (e) {
        out[m.id] = { table: tbl, exists: false, count: 0, status: 'error',
          error: e.message };
      }
    }
    setResults(out);
    setRunning(false);
  };

  useEffect(() => { probe(); }, []);

  const colorFor = (status) => {
    if (status === 'ok')   return '#10b981';
    if (status === 'no-table-needed') return '#a07850';
    return '#c41e3a';
  };

  const statusLabel = (status) => ({
    'ok':              '✓ 表存在',
    'missing':         '✗ 表缺失',
    'error':           '! 错误',
    'no-table-needed': '— 无需表',
  }[status] || status);

  return (
    <div>
      <div style={{
        background: '#fff', padding: 16, borderRadius: 12,
        border: '1px solid #e8d5b0', marginBottom: 16, fontSize: 13, color: '#5d4630',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <strong>模块内容架构发现</strong>
          <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
            扫描每个模块对应的 clf_* 表，显示是否存在 + 行数。
            这是为下一阶段构建模块 CRUD 的基础。
          </div>
        </div>
        <button onClick={probe} disabled={running} style={{
          padding: '8px 14px', background: '#c41e3a', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
        }}>
          {running ? '扫描中…' : '重新扫描'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {MODULES.map(m => {
          const r = results[m.id];
          if (!r) return null;
          return (
            <div key={m.id} style={{
              background: '#fff', border: `1px solid ${colorFor(r.status)}30`,
              borderLeft: `4px solid ${colorFor(r.status)}`,
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a0a05' }}>
                  {m.label} <span style={{ fontSize: 10, color: '#a07850',
                    fontFamily: 'monospace', marginLeft: 8 }}>{m.id}</span>
                </div>
                <div style={{ fontSize: 11, color: '#5d4630', fontFamily: 'monospace' }}>
                  {r.table || '(no table mapping)'}
                </div>
                {r.error && (
                  <div style={{ fontSize: 11, color: '#c41e3a', marginTop: 2 }}>
                    {r.error}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: colorFor(r.status) }}>
                  {statusLabel(r.status)}
                </div>
                {r.exists && (
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a0a05' }}>
                    {r.count} 行
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 20, padding: 14,
        background: '#fef3e2', border: '1px solid #f59e0b40',
        borderRadius: 10, fontSize: 12, color: '#92400e',
      }}>
        <strong>下一阶段：</strong> 对于显示「✓ 表存在」的模块，下一会话将构建专门的 CRUD 界面。
        对于「✗ 表缺失」的模块，需要先创建表或确认正确的表名。
        对于「— 无需表」的模块（如主页/进度），它们是 UI-only 不需要内容管理。
      </div>
    </div>
  );
}
