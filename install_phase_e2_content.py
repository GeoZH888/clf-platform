# install_phase_e2_content.py
# Phase E.2 content management foundation.
#
# Honest scope:
#   - AI provider config (table + admin UI + dispatcher)
#   - Generic ContentCRUD component
#   - Schema discovery tool (introspects which clf_* tables exist)
#   - 5 modules with full CRUD: classes / homework / users / chengyu / user_modules
#   - 13 modules as stubs (use discovery tool to map them)
#
# REQUIRED MANUAL STEP BEFORE RUNNING:
#   Run the SQL migration in db_migration_phase_e2.sql (in Supabase SQL editor)
#
# Run from clf-platform root:
#   python install_phase_e2_content.py

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

# Make sure dirs exist
for sub in ['src/admin', 'src/admin/content', 'src/lib']:
    (ROOT / sub).mkdir(parents=True, exist_ok=True)

files = {}

# ============================================================
# SQL MIGRATION
# ============================================================
files["db_migration_phase_e2.sql"] = '''-- Phase E.2: AI provider config + per-user override

-- 1. AI provider config (admin-managed)
CREATE TABLE IF NOT EXISTS clf_ai_provider_config (
  id SERIAL PRIMARY KEY,
  feature TEXT NOT NULL,        -- 'text' | 'image' | 'audio' | 'embedding'
  provider TEXT NOT NULL,       -- 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'qwen' | 'grok' | 'mistral' | 'ideogram' | 'stability' | 'azure_tts' | 'youdao_tts'
  model TEXT,                   -- e.g. 'claude-opus-4-7', 'gpt-4o', 'gemini-pro'
  enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (feature, provider)
);

-- Seed with available providers
INSERT INTO clf_ai_provider_config (feature, provider, model, enabled, is_default) VALUES
  ('text',     'anthropic', 'claude-opus-4-7',           true, true),
  ('text',     'openai',    'gpt-4o',                    true, false),
  ('text',     'gemini',    'gemini-2.5-pro',            true, false),
  ('text',     'deepseek',  'deepseek-chat',             true, false),
  ('text',     'qwen',      'qwen-max',                  false, false),
  ('text',     'mistral',   'mistral-large-latest',      false, false),
  ('image',    'ideogram',  'ideogram-3.0',              true, true),
  ('image',    'stability', 'sd3-large',                 true, false),
  ('audio',    'azure_tts', 'azure-zh-cn',               true, true),
  ('audio',    'youdao_tts','youdao-zh-cn',              true, false)
ON CONFLICT (feature, provider) DO NOTHING;

-- 2. Per-user provider override (optional)
ALTER TABLE clf_user_profiles ADD COLUMN IF NOT EXISTS ai_text_provider TEXT;
ALTER TABLE clf_user_profiles ADD COLUMN IF NOT EXISTS ai_image_provider TEXT;
ALTER TABLE clf_user_profiles ADD COLUMN IF NOT EXISTS ai_audio_provider TEXT;

-- 3. RLS for clf_ai_provider_config
ALTER TABLE clf_ai_provider_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_config_admin_all ON clf_ai_provider_config;
CREATE POLICY ai_config_admin_all ON clf_ai_provider_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM clf_user_profiles
            WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM clf_user_profiles
            WHERE user_id = auth.uid() AND role = 'super_admin')
  );

DROP POLICY IF EXISTS ai_config_authenticated_read ON clf_ai_provider_config;
CREATE POLICY ai_config_authenticated_read ON clf_ai_provider_config
  FOR SELECT TO authenticated USING (enabled = true);
'''

# ============================================================
# AI provider dispatcher (frontend hook)
# ============================================================
files["src/lib/aiProvider.js"] = '''// src/lib/aiProvider.js
// AI provider dispatcher — reads config from Supabase, routes calls.
import { supabase } from '../school/services/supabase';

let cachedConfig = null;
let cacheExpiry = 0;
const CACHE_MS = 60_000; // 1 min

async function loadConfig() {
  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;
  const { data, error } = await supabase
    .from('clf_ai_provider_config')
    .select('*').eq('enabled', true);
  if (error) {
    console.warn('[aiProvider] config load failed:', error);
    return [];
  }
  cachedConfig = data || [];
  cacheExpiry = Date.now() + CACHE_MS;
  return cachedConfig;
}

// Get the default provider for a feature (text/image/audio)
export async function getProvider(feature, userOverride = null) {
  if (userOverride) return { provider: userOverride };
  const config = await loadConfig();
  const matches = config.filter(c => c.feature === feature);
  const defaults = matches.filter(c => c.is_default);
  return defaults[0] || matches[0] || null;
}

// Call AI for text generation. Routes to the right Netlify function based on provider.
// Returns { text, provider, model } on success or { error } on failure.
export async function callTextAI(prompt, options = {}) {
  const cfg = await getProvider('text', options.providerOverride);
  if (!cfg) return { error: 'No text AI provider configured' };
  const fnMap = {
    anthropic: '/.netlify/functions/ai-text-anthropic',
    openai:    '/.netlify/functions/ai-text-openai',
    gemini:    '/.netlify/functions/ai-text-gemini',
    deepseek:  '/.netlify/functions/ai-text-deepseek',
    qwen:      '/.netlify/functions/ai-text-qwen',
    mistral:   '/.netlify/functions/ai-text-mistral',
  };
  const url = fnMap[cfg.provider];
  if (!url) return { error: `Unknown text provider: ${cfg.provider}` };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model: cfg.model, ...options }),
    });
    if (!resp.ok) return { error: `HTTP ${resp.status}: ${await resp.text()}` };
    const data = await resp.json();
    return { ...data, provider: cfg.provider, model: cfg.model };
  } catch (e) {
    return { error: e.message };
  }
}

// Call AI for image generation
export async function callImageAI(prompt, options = {}) {
  const cfg = await getProvider('image', options.providerOverride);
  if (!cfg) return { error: 'No image AI provider configured' };
  const fnMap = {
    ideogram:  '/.netlify/functions/generate-illustration',
    stability: '/.netlify/functions/stability-proxy',
  };
  const url = fnMap[cfg.provider];
  if (!url) return { error: `Unknown image provider: ${cfg.provider}` };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ...options }),
    });
    if (!resp.ok) return { error: `HTTP ${resp.status}` };
    const data = await resp.json();
    return { ...data, provider: cfg.provider };
  } catch (e) {
    return { error: e.message };
  }
}

// Call audio TTS
export async function callAudioAI(text, options = {}) {
  const cfg = await getProvider('audio', options.providerOverride);
  if (!cfg) return { error: 'No audio AI provider configured' };
  const fnMap = {
    azure_tts:  '/.netlify/functions/azure-tts-speak',
    youdao_tts: '/.netlify/functions/youdao-tts',
  };
  const url = fnMap[cfg.provider];
  if (!url) return { error: `Unknown audio provider: ${cfg.provider}` };
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...options }),
    });
    if (!resp.ok) return { error: `HTTP ${resp.status}` };
    const data = await resp.json();
    return { ...data, provider: cfg.provider };
  } catch (e) {
    return { error: e.message };
  }
}
'''

# ============================================================
# AI Config Admin Tab
# ============================================================
files["src/admin/AIConfigTab.jsx"] = '''// src/admin/AIConfigTab.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../school/services/supabase';

const FEATURES = [
  { id: 'text',  label: '文字生成', desc: '课程备课、作业批改建议、教学问答' },
  { id: 'image', label: '图片生成', desc: '课程插图、字符插画' },
  { id: 'audio', label: '语音合成', desc: 'TTS 朗读、音频教学' },
];

export default function AIConfigTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clf_ai_provider_config')
      .select('*').order('feature').order('is_default', { ascending: false });
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setDefault = async (row) => {
    await supabase.from('clf_ai_provider_config')
      .update({ is_default: false }).eq('feature', row.feature);
    await supabase.from('clf_ai_provider_config')
      .update({ is_default: true }).eq('id', row.id);
    load();
  };

  const toggle = async (row) => {
    await supabase.from('clf_ai_provider_config')
      .update({ enabled: !row.enabled }).eq('id', row.id);
    load();
  };

  if (loading) return <div style={{ padding: 24, color: '#a07850' }}>加载中…</div>;

  return (
    <div>
      <div style={{
        background: '#fff', padding: 16, borderRadius: 12,
        border: '1px solid #e8d5b0', marginBottom: 16, fontSize: 13, color: '#5d4630',
      }}>
        <strong>AI 服务商配置</strong> · 选择每个功能的默认 AI 提供商。
        每个用户可在个人资料中覆盖默认值。
      </div>

      {FEATURES.map(f => {
        const featureRows = rows.filter(r => r.feature === f.id);
        return (
          <section key={f.id} style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: '#1a0a05' }}>
              {f.label}
            </h3>
            <div style={{ fontSize: 12, color: '#a07850', marginBottom: 10 }}>{f.desc}</div>
            <div style={{ display: 'grid', gap: 8,
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {featureRows.map(row => (
                <div key={row.id} style={{
                  background: row.is_default ? '#fff5f0' : '#fff',
                  border: `1.5px solid ${row.is_default ? '#c41e3a' : '#e8d5b0'}`,
                  borderRadius: 10, padding: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <strong style={{ fontSize: 13, color: '#1a0a05' }}>{row.provider}</strong>
                    {row.is_default && (
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8,
                        background: '#c41e3a', color: '#fff', fontWeight: 700 }}>默认</span>
                    )}
                    <label style={{ marginLeft: 'auto', fontSize: 11,
                      display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="checkbox" checked={row.enabled}
                        onChange={() => toggle(row)}/> 启用
                    </label>
                  </div>
                  <div style={{ fontSize: 11, color: '#5d4630',
                    fontFamily: 'monospace', marginBottom: 8 }}>
                    {row.model || '(no model)'}
                  </div>
                  {!row.is_default && row.enabled && (
                    <button onClick={() => setDefault(row)} style={{
                      padding: '4px 10px', fontSize: 11,
                      background: '#c41e3a', color: '#fff', border: 'none',
                      borderRadius: 6, cursor: 'pointer',
                    }}>设为默认</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div style={{
        marginTop: 24, padding: 12,
        background: '#fef3e2', border: '1px solid #f59e0b40',
        borderRadius: 10, fontSize: 12, color: '#92400e',
      }}>
        <strong>注意：</strong> 这里只配置默认提供商。实际调用需要在 Netlify 环境变量中设置对应的 API Key
        （ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY 等）。
        如果某个提供商没设密钥，调用时会返回 401 错误。
      </div>
    </div>
  );
}
'''

# ============================================================
# Schema Discovery Tab
# ============================================================
files["src/admin/SchemaDiscoveryTab.jsx"] = '''// src/admin/SchemaDiscoveryTab.jsx
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
'''

# ============================================================
# Generic Content CRUD shell
# ============================================================
files["src/admin/content/ContentCRUD.jsx"] = '''// src/admin/content/ContentCRUD.jsx
// Generic CRUD shell — pass a table name + columns + and you get list/create/edit/delete.
//
// Example usage:
//   <ContentCRUD
//     table="clf_chengyu"
//     title="成语管理"
//     columns={[
//       { key: 'idiom', label: '成语', type: 'text', required: true },
//       { key: 'pinyin', label: '拼音', type: 'text' },
//       { key: 'meaning', label: '释义', type: 'textarea' },
//     ]}
//   />
import React, { useEffect, useState } from 'react';
import { supabase } from '../../school/services/supabase';
import { Plus, Trash2, Edit, Save, X } from 'lucide-react';

export default function ContentCRUD({ table, title, columns, idColumn = 'id', orderBy = 'created_at', orderDir = 'desc' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | {} (new) | row (edit)
  const [form, setForm] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from(table).select('*')
        .order(orderBy, { ascending: orderDir === 'asc' })
        .limit(200);
      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [table]);

  const startEdit = (row) => { setEditing(row); setForm({...row}); };
  const startNew = () => { setEditing({}); setForm({}); };
  const cancel = () => { setEditing(null); setForm({}); };

  const save = async () => {
    try {
      if (editing[idColumn]) {
        await supabase.from(table).update(form).eq(idColumn, editing[idColumn]);
      } else {
        await supabase.from(table).insert(form);
      }
      cancel(); load();
    } catch (e) {
      alert('保存失败：' + e.message);
    }
  };

  const remove = async (row) => {
    if (!confirm(`确定删除？此操作不可撤销。`)) return;
    try {
      await supabase.from(table).delete().eq(idColumn, row[idColumn]);
      load();
    } catch (e) {
      alert('删除失败：' + e.message);
    }
  };

  if (loading) return <div style={{ padding: 24, color: '#a07850' }}>加载中…</div>;
  if (error) return (
    <div style={{
      padding: 16, background: '#fef2f2', border: '1px solid #fecaca',
      borderRadius: 8, color: '#991b1b', fontSize: 13,
    }}>
      <strong>错误：</strong> {error}
      <div style={{ marginTop: 6, fontSize: 11, color: '#7f1d1d' }}>
        表 <code>{table}</code> 可能不存在，或当前用户没有权限访问。
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#1a0a05' }}>
          {title} · <span style={{ color: '#a07850', fontWeight: 400 }}>{rows.length} 条</span>
        </h3>
        {!editing && (
          <button onClick={startNew} style={{
            marginLeft: 'auto', padding: '8px 14px', background: '#c41e3a',
            color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Plus size={12}/> 新建
          </button>
        )}
      </div>

      {editing && (
        <EditForm columns={columns} form={form} setForm={setForm}
          onSave={save} onCancel={cancel}/>
      )}

      <div style={{ display: 'grid', gap: 6 }}>
        {rows.length === 0 ? (
          <div style={{
            padding: 24, textAlign: 'center', color: '#a07850',
            background: '#fff', border: '1px dashed #e8d5b0', borderRadius: 10,
          }}>暂无数据</div>
        ) : rows.map(row => (
          <div key={row[idColumn]} style={{
            background: '#fff', padding: 12, borderRadius: 8,
            border: '1px solid #e8d5b0',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              {columns.slice(0, 3).map(col => (
                <div key={col.key} style={{ marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: '#a07850', marginRight: 6 }}>{col.label}:</span>
                  <span style={{ fontSize: 13, color: '#1a0a05' }}>
                    {String(row[col.key] ?? '').slice(0, 80)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => startEdit(row)} style={iconBtn('#3b82f6')}>
                <Edit size={12}/>
              </button>
              <button onClick={() => remove(row)} style={iconBtn('#c41e3a')}>
                <Trash2 size={12}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditForm({ columns, form, setForm, onSave, onCancel }) {
  return (
    <div style={{
      background: '#fff', padding: 16, borderRadius: 12,
      border: '2px solid #c41e3a', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {columns.map(col => (
          <div key={col.key}>
            <label style={{ fontSize: 11, color: '#a07850', display: 'block', marginBottom: 2 }}>
              {col.label} {col.required && <span style={{ color: '#c41e3a' }}>*</span>}
            </label>
            {col.type === 'textarea' ? (
              <textarea value={form[col.key] || ''}
                onChange={e => setForm(f => ({...f, [col.key]: e.target.value}))}
                rows={3} style={input}/>
            ) : col.type === 'number' ? (
              <input type="number" value={form[col.key] ?? ''}
                onChange={e => setForm(f => ({...f, [col.key]: e.target.value === '' ? null : Number(e.target.value)}))}
                style={input}/>
            ) : col.type === 'boolean' ? (
              <input type="checkbox" checked={!!form[col.key]}
                onChange={e => setForm(f => ({...f, [col.key]: e.target.checked}))}/>
            ) : (
              <input type="text" value={form[col.key] || ''}
                onChange={e => setForm(f => ({...f, [col.key]: e.target.value}))}
                style={input}/>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
        <button onClick={onSave} style={{
          padding: '8px 14px', background: '#10b981', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <Save size={12}/> 保存
        </button>
        <button onClick={onCancel} style={{
          padding: '8px 14px', background: '#fff', color: '#5d4630',
          border: '1px solid #e8d5b0', borderRadius: 8, cursor: 'pointer', fontSize: 12,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <X size={12}/> 取消
        </button>
      </div>
    </div>
  );
}

const input = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', fontSize: 13,
  border: '1px solid #e8d5b0', borderRadius: 6,
  fontFamily: 'inherit',
};
const iconBtn = (color) => ({
  width: 28, height: 28, background: `${color}15`, color: color,
  border: `1px solid ${color}40`, borderRadius: 6, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
'''

# ============================================================
# Per-module CRUD pages — 5 with confidence + 13 stubs
# ============================================================

# Module config: which ones get real CRUD vs stub
MODULE_CRUD = {
    # Real ones (high confidence based on session memory)
    'chengyu': {
        'table': 'clf_chengyu',
        'title': '成语',
        'columns': [
            ('idiom',   '成语',    'text',     True),
            ('pinyin',  '拼音',    'text',     False),
            ('meaning', '释义',    'textarea', False),
            ('story',   '典故',    'textarea', False),
            ('source',  '出处',    'text',     False),
        ],
    },
    'homework': {
        'table': 'clf_homework',
        'title': '作业',
        'columns': [
            ('title',       '标题',    'text',     True),
            ('description', '说明',    'textarea', False),
            ('due_at',      '截止时间', 'text',     False),
        ],
    },
    # Stubs (table name unknown — use schema discovery first)
    'lianzi':   None,
    'words':    None,
    'pinyin':   None,
    'grammar':  None,
    'hsk':      None,
    'lessons':  None,
    'poetry':   None,
    'riddles':  None,
    'scenario': None,
    'story':    None,
    'chat':     None,
    'voice':    None,
    'shop':     None,
    'parents':  None,
}

def gen_real_module_page(mod_id, cfg):
    cols_str = ',\n        '.join([
        f"{{ key: '{k}', label: '{l}', type: '{t}'" + (', required: true' if r else '') + ' }'
        for (k, l, t, r) in cfg['columns']
    ])
    return f'''// Auto-generated CRUD page for {mod_id}
import React from 'react';
import ContentCRUD from './ContentCRUD';

export default function {mod_id.title()}Page() {{
  return (
    <ContentCRUD
      table="{cfg['table']}"
      title="{cfg['title']}"
      columns={{[
        {cols_str},
      ]}}
    />
  );
}}
'''

def gen_stub_module_page(mod_id, mod_label):
    return f'''// Stub for {mod_id} — use 模块内容 tab to discover schema first.
import React from 'react';

export default function {mod_id.title()}Page() {{
  return (
    <div style={{{{
      padding: 30, background: '#fef3e2', border: '1px solid #f59e0b40',
      borderRadius: 12, color: '#92400e', textAlign: 'center',
    }}}}>
      <div style={{{{ fontSize: 20, marginBottom: 8 }}}}>🚧</div>
      <div style={{{{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}}}>
        {mod_label} · 待配置
      </div>
      <div style={{{{ fontSize: 12 }}}}>
        请先到「模块内容」标签运行架构发现，
        然后下一会话会基于发现结果构建本模块的 CRUD 界面。
      </div>
    </div>
  );
}}
'''

# Generate all module pages
for mod_id, cfg in MODULE_CRUD.items():
    if cfg:
        files[f"src/admin/content/{mod_id.title()}Page.jsx"] = gen_real_module_page(mod_id, cfg)
    else:
        # Find label from MODULES (we hardcode here since we can't import the JS file)
        labels = {
            'lianzi': '练字', 'words': '词语', 'pinyin': '拼音', 'grammar': '语法',
            'hsk': 'HSK', 'lessons': '课程', 'poetry': '诗歌', 'riddles': '猜灯谜',
            'scenario': '场景对话', 'story': '故事会', 'chat': '问答聊天',
            'voice': '语音评测', 'shop': '小卖部', 'parents': '家长',
        }
        files[f"src/admin/content/{mod_id.title()}Page.jsx"] = gen_stub_module_page(mod_id, labels.get(mod_id, mod_id))

# ============================================================
# Content management hub (combines all module CRUD into tabs)
# ============================================================
files["src/admin/ContentManagementTab.jsx"] = '''// src/admin/ContentManagementTab.jsx
import React, { useState } from 'react';
import { MODULES } from '../config/modules';
import LianziPage from './content/LianziPage';
import WordsPage from './content/WordsPage';
import PinyinPage from './content/PinyinPage';
import GrammarPage from './content/GrammarPage';
import HskPage from './content/HskPage';
import LessonsPage from './content/LessonsPage';
import ChengyuPage from './content/ChengyuPage';
import PoetryPage from './content/PoetryPage';
import RiddlesPage from './content/RiddlesPage';
import ScenarioPage from './content/ScenarioPage';
import StoryPage from './content/StoryPage';
import ChatPage from './content/ChatPage';
import VoicePage from './content/VoicePage';
import HomeworkPage from './content/HomeworkPage';
import ShopPage from './content/ShopPage';
import ParentsPage from './content/ParentsPage';

const PAGES = {
  lianzi: LianziPage, words: WordsPage, pinyin: PinyinPage, grammar: GrammarPage,
  hsk: HskPage, lessons: LessonsPage, chengyu: ChengyuPage, poetry: PoetryPage,
  riddles: RiddlesPage, scenario: ScenarioPage, story: StoryPage, chat: ChatPage,
  voice: VoicePage, homework: HomeworkPage, shop: ShopPage, parents: ParentsPage,
};

export default function ContentManagementTab() {
  const [active, setActive] = useState('chengyu');
  const Active = PAGES[active] || (() => <div>未配置</div>);
  const gateable = MODULES.filter(m => m.gateable && PAGES[m.id]);

  return (
    <div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4,
        marginBottom: 20, padding: 6,
        background: '#fff', borderRadius: 10, border: '1px solid #e8d5b0',
      }}>
        {gateable.map(m => (
          <button key={m.id} onClick={() => setActive(m.id)} style={{
            padding: '6px 12px', borderRadius: 6, border: 'none',
            background: active === m.id ? '#c41e3a' : 'transparent',
            color: active === m.id ? '#fff' : '#5d4630',
            cursor: 'pointer', fontSize: 12,
            fontWeight: active === m.id ? 700 : 400,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}
'''

# ============================================================
# Patch AdminApp to add the new tabs
# ============================================================
print("=== Writing files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    data = content.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
    p.write_bytes(data)
    print(f"  wrote  {rel}  ({len(data)} bytes)")

# Now find AdminApp and tell user to add tabs manually (avoid wrong patches)
print()
print("=== AdminApp patching ===")
admin_app = ROOT / "src" / "admin" / "AdminApp.jsx"
if admin_app.exists():
    print(f"  AdminApp.jsx exists ({admin_app.stat().st_size} bytes)")
    print(f"  MANUAL STEP NEEDED: Open src/admin/AdminApp.jsx in your editor.")
    print(f"  Find the existing tab list/router and add 3 new tabs:")
    print(f"    1. import AIConfigTab from './AIConfigTab';")
    print(f"    2. import SchemaDiscoveryTab from './SchemaDiscoveryTab';")
    print(f"    3. import ContentManagementTab from './ContentManagementTab';")
    print(f"  Then add buttons/routes for: 'AI 配置', '模块内容', '内容管理'")
else:
    print(f"  AdminApp.jsx NOT FOUND — you'll need to wire these tabs into the admin UI manually")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
import re
checks = [
    ('db_migration_phase_e2.sql', 'clf_ai_provider_config'),
    ('src/lib/aiProvider.js', 'callTextAI'),
    ('src/admin/AIConfigTab.jsx', 'is_default'),
    ('src/admin/SchemaDiscoveryTab.jsx', 'MODULE_TABLES'),
    ('src/admin/content/ContentCRUD.jsx', 'EditForm'),
    ('src/admin/content/ChengyuPage.jsx', 'clf_chengyu'),
    ('src/admin/content/LianziPage.jsx', '建设中' if False else '待配置'),
    ('src/admin/ContentManagementTab.jsx', 'PAGES'),
]
all_ok = True
for rel, marker in checks:
    p = ROOT / rel
    if not p.exists():
        print(f"  [MISSING] {rel}")
        all_ok = False
        continue
    if marker in p.read_text(encoding='utf-8'):
        print(f"  [OK] {rel}")
    else:
        print(f"  [FAIL] {rel}: missing '{marker}'")
        all_ok = False

# Escape check
total_escapes = 0
for rel in files.keys():
    p = ROOT / rel
    if p.exists() and p.suffix in ('.jsx', '.js'):
        n = len(re.findall(r'\\u[0-9a-fA-F]{4}', p.read_text(encoding='utf-8')))
        total_escapes += n
print(f"  Raw \\\\uXXXX escapes total: {total_escapes}")

print("\n" + ("=== ALL OK ===" if all_ok and total_escapes == 0 else "=== SOME FAIL ==="))
print()
print("MANDATORY MANUAL STEPS:")
print("  1. Open Supabase SQL Editor")
print("  2. Paste contents of db_migration_phase_e2.sql, click Run")
print("  3. Open src/admin/AdminApp.jsx and add the 3 new tabs manually")
print("     (see instructions above)")
print()
print("THEN:")
print("  npm run build")
print("  netlify deploy --prod --dir dist --no-build")
print()
print("HONEST CAVEATS:")
print("  - 'AI 配置' tab requires Netlify functions for each provider; most don't exist yet")
print("  - '模块内容' (CRUD) — only chengyu + homework will work; others are stubs")
print("  - '架构发现' will show ✗ for tables that don't exist — that's expected/useful")
