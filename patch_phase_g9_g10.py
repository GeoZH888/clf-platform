# patch_phase_g9_g10.py
# Phase G.9 — Teacher knowledge map (aggregated cross-class view in admin-v2)
# Phase G.10 — RAG retrieval API (SQL match_chunks RPC + Netlify retrieve-content + batch embedder)

import pathlib, sys

ROOT = pathlib.Path.cwd()
if not (ROOT / "src" / "App.jsx").exists():
    print("ERROR: run from clf-platform root")
    sys.exit(1)

files = {}

# ============================================================
# G.9 — Teacher Knowledge Map
# Lives at /admin-v2 → 模块内容 → 教学.
# Aggregates clf_user_learning_state across all students.
# Reuses tree-map pattern from G.8.
# ============================================================
files["src/admin/v2/pillars/TeacherKnowledgeMap.jsx"] = '''// src/admin/v2/pillars/TeacherKnowledgeMap.jsx
// Phase G.9 — Aggregated knowledge map across all students.
// For super_admin/teacher view in admin-v2.
//
// Per-atom stats: total students who have a state record, % per state.
// Per Q5: per-student names visible by default (drill-down on click).

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const TYPE_LABELS = {
  character: { label: '汉字', icon: '✍️', color: '#3b82f6' },
  word:      { label: '词语', icon: '📚', color: '#8b5cf6' },
  pinyin:    { label: '拼音', icon: '🔤', color: '#06b6d4' },
  grammar:   { label: '语法', icon: '📐', color: '#10b981' },
  chengyu:   { label: '成语', icon: '🎋', color: '#f59e0b' },
  poem:      { label: '诗歌', icon: '🪶', color: '#ec4899' },
  topic:     { label: '游戏', icon: '🏮', color: '#ef4444' },
};

function classMasteryColor(masteredPct) {
  // Heat scale: red (low mastery) -> yellow -> green
  if (masteredPct < 0.2) return '#fee2e2';        // pale red — class struggling
  if (masteredPct < 0.4) return '#fed7aa';
  if (masteredPct < 0.6) return '#fef3c7';
  if (masteredPct < 0.8) return '#bbf7d0';
  return '#86efac';                                // green — class doing well
}

export default function TeacherKnowledgeMap() {
  const [atoms, setAtoms] = useState([]);
  const [stateRows, setStateRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drilldownAtom, setDrilldownAtom] = useState(null);
  const [filterLevel, setFilterLevel] = useState(null);
  const [filterType, setFilterType] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      // All atoms
      supabase.from('clf_atoms')
        .select('id, type, display_text, level, difficulty')
        .order('type, level'),
      // All learning state rows
      supabase.from('clf_user_learning_state')
        .select('user_id, atom_id, state'),
      // All student profiles (for name drilldown)
      supabase.from('clf_user_profiles')
        .select('user_id, name, email, role')
        .in('role', ['student', 'parent']),
    ])
      .then(([aRes, sRes, uRes]) => {
        if (cancelled) return;
        if (aRes.error) throw aRes.error;
        if (sRes.error) console.warn('[TKM] state:', sRes.error);
        if (uRes.error) console.warn('[TKM] users:', uRes.error);
        setAtoms(aRes.data || []);
        setStateRows(sRes.data || []);
        setStudents(uRes.data || []);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[TKM] load:', err);
        setError(err.message || String(err));
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // Aggregate state per atom
  const atomStats = useMemo(() => {
    const byAtom = {};
    for (const row of stateRows) {
      if (!byAtom[row.atom_id]) {
        byAtom[row.atom_id] = {
          mastered: 0, practicing: 0, exposed: 0,
          forgotten: 0, unseen: 0, total: 0,
          students: [],
        };
      }
      byAtom[row.atom_id][row.state] = (byAtom[row.atom_id][row.state] || 0) + 1;
      byAtom[row.atom_id].total += 1;
      byAtom[row.atom_id].students.push({ user_id: row.user_id, state: row.state });
    }
    return byAtom;
  }, [stateRows]);

  const studentMap = useMemo(() => {
    const m = {};
    for (const s of students) m[s.user_id] = s;
    return m;
  }, [students]);

  // Filter atoms
  const filtered = useMemo(() => {
    return atoms.filter(a =>
      (filterLevel === null || a.level === filterLevel) &&
      (filterType === null || a.type === filterType)
    );
  }, [atoms, filterLevel, filterType]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#8b6f47' }}>加载中…</div>;
  }
  if (error) {
    return (
      <div style={{ padding: 30, background: '#fef2f2',
        border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠ 加载失败</div>
        <div style={{ fontSize: 12 }}>{error}</div>
      </div>
    );
  }

  // Compute totals
  const totalAtoms = atoms.length;
  const atomsWithRecords = Object.keys(atomStats).length;
  const totalStudents = students.length;

  // Levels available
  const levels = Array.from(new Set(atoms.map(a => a.level).filter(l => l != null)))
    .sort((a, b) => a - b);
  const types = Array.from(new Set(atoms.map(a => a.type)));

  return (
    <div>
      {/* Stat strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
        marginBottom: 16,
      }}>
        <Stat label="知识单元" value={totalAtoms.toLocaleString()} icon="🧩"/>
        <Stat label="有学习记录" value={atomsWithRecords.toLocaleString()}
              sub={totalAtoms > 0 ? `${(atomsWithRecords/totalAtoms*100).toFixed(0)}%` : ''}
              icon="📊"/>
        <Stat label="学生人数" value={totalStudents.toLocaleString()} icon="👥"/>
        <Stat label="活动记录" value={stateRows.length.toLocaleString()} icon="📝"/>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        padding: 12, background: '#fff', borderRadius: 10,
        border: '1px solid #e8d5b0', marginBottom: 16,
      }}>
        <span style={{ fontSize: 12, color: '#5d4630', fontWeight: 600 }}>类型:</span>
        <button onClick={() => setFilterType(null)} style={chipStyle(filterType === null)}>全部</button>
        {types.map(t => (
          <button key={t} onClick={() => setFilterType(t === filterType ? null : t)}
            style={chipStyle(filterType === t)}>
            {TYPE_LABELS[t]?.icon || ''} {TYPE_LABELS[t]?.label || t}
          </button>
        ))}
        <span style={{ marginLeft: 16, fontSize: 12, color: '#5d4630', fontWeight: 600 }}>HSK 等级:</span>
        <button onClick={() => setFilterLevel(null)} style={chipStyle(filterLevel === null)}>全部</button>
        {levels.map(l => (
          <button key={l} onClick={() => setFilterLevel(l === filterLevel ? null : l)}
            style={chipStyle(filterLevel === l)}>
            HSK {l}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {atomsWithRecords === 0 && (
        <div style={{
          padding: 30, background: '#fff', borderRadius: 10,
          border: '1px dashed #e8d5b0', textAlign: 'center',
          color: '#8b6f47', fontSize: 13, marginBottom: 16,
        }}>
          目前还没有学生活动记录。学生开始练习后这里会显示班级整体掌握情况。
        </div>
      )}

      {/* Heatmap grid */}
      <div style={{
        background: '#fff', border: '1px solid #e8d5b0',
        borderRadius: 12, padding: 12, maxHeight: 600, overflowY: 'auto',
      }}>
        <div style={{
          fontSize: 11, color: '#8b6f47', marginBottom: 8,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{filtered.length.toLocaleString()} 个单元</span>
          <span>颜色 = 班级掌握率（红 = 困难，绿 = 良好）</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))',
          gap: 4,
        }}>
          {filtered.slice(0, 1500).map(a => {
            const stats = atomStats[a.id];
            const masteredPct = stats && stats.total > 0
              ? stats.mastered / stats.total : 0;
            const hasData = stats && stats.total > 0;
            return (
              <div key={a.id}
                onClick={() => hasData && setDrilldownAtom(a)}
                style={{
                  padding: '6px 4px', textAlign: 'center',
                  background: hasData ? classMasteryColor(masteredPct) : '#f5f5f4',
                  border: '1px solid #e8d5b0',
                  borderRadius: 4, cursor: hasData ? 'pointer' : 'default',
                  fontSize: 11, color: '#1a0a05',
                  opacity: hasData ? 1 : 0.5,
                  fontWeight: hasData ? 600 : 400,
                }}
                title={hasData
                  ? `${a.display_text} | 已掌握 ${stats.mastered}/${stats.total}`
                  : `${a.display_text} (无记录)`}>
                {(a.display_text || '').slice(0, 4)}
              </div>
            );
          })}
        </div>
        {filtered.length > 1500 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#8b6f47',
            textAlign: 'center' }}>
            显示前 1500 / {filtered.length.toLocaleString()} 单元 — 用筛选器缩小范围
          </div>
        )}
      </div>

      {/* Drilldown modal */}
      {drilldownAtom && (
        <DrilldownModal atom={drilldownAtom}
          stats={atomStats[drilldownAtom.id]}
          studentMap={studentMap}
          onClose={() => setDrilldownAtom(null)}/>
      )}
    </div>
  );
}

function Stat({ label, value, sub, icon }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8d5b0',
      borderRadius: 10, padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1a0a05' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#8b6f47', marginTop: 2 }}>
        {label}{sub ? ` · ${sub}` : ''}
      </div>
    </div>
  );
}

function chipStyle(active) {
  return {
    padding: '4px 10px', fontSize: 11, fontWeight: 600,
    background: active ? '#c41e3a' : '#fff',
    color: active ? '#fff' : '#5d4630',
    border: `1px solid ${active ? '#c41e3a' : '#e8d5b0'}`,
    borderRadius: 6, cursor: 'pointer',
  };
}

function DrilldownModal({ atom, stats, studentMap, onClose }) {
  const groups = useMemo(() => {
    const g = { mastered: [], practicing: [], exposed: [], forgotten: [], unseen: [] };
    if (stats?.students) {
      for (const s of stats.students) {
        const profile = studentMap[s.user_id] || {};
        if (g[s.state]) {
          g[s.state].push({ ...s, name: profile.name || profile.email || s.user_id });
        }
      }
    }
    return g;
  }, [stats, studentMap]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, maxWidth: 500, width: '90%',
        maxHeight: '80vh', overflow: 'auto', padding: 20,
      }}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: '#1a0a05',
          fontFamily: "'STKaiti','KaiTi',serif", marginBottom: 4,
        }}>
          {atom.display_text}
        </div>
        <div style={{ fontSize: 11, color: '#8b6f47', marginBottom: 16 }}>
          {atom.type} · 等级 {atom.level ?? '—'} · 难度 {Math.round(atom.difficulty || 0)}
        </div>

        {Object.entries(groups).map(([state, list]) => list.length > 0 && (
          <div key={state} style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#5d4630', marginBottom: 4,
            }}>
              {state} ({list.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {list.map(s => (
                <span key={s.user_id} style={{
                  fontSize: 11, padding: '3px 8px',
                  background: '#fef3e2', border: '1px solid #f59e0b40',
                  borderRadius: 4, color: '#92400e',
                }}>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        ))}

        <button onClick={onClose} style={{
          marginTop: 12, padding: '8px 16px', fontSize: 12,
          background: '#fff', border: '1px solid #e8d5b0',
          borderRadius: 6, color: '#5d4630', cursor: 'pointer',
        }}>关闭</button>
      </div>
    </div>
  );
}
'''

# ============================================================
# G.10 Part A — SQL: match_chunks RPC for similarity search
# ============================================================
files["db_phase_g10_match_chunks.sql"] = '''-- =========================================================
-- Phase G.10 — match_chunks RPC for vector similarity search
--
-- Returns chunks ranked by cosine similarity to query_embedding.
-- Optionally filtered by HSK level.
--
-- Usage from JS:
--   supabase.rpc('match_chunks', {
--     query_embedding: [...1536 floats...],
--     match_threshold: 0.5,
--     match_count: 10,
--     filter_hsk_level: 2,
--   })
-- =========================================================

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_hsk_level int DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  content text,
  title text,
  hsk_level int,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id AS chunk_id,
    c.content,
    c.title,
    c.hsk_level,
    c.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM clf_corpus_chunks c
  JOIN clf_chunk_embeddings e ON e.chunk_id = c.id
  WHERE
    (filter_hsk_level IS NULL OR c.hsk_level = filter_hsk_level)
    AND (1 - (e.embedding <=> query_embedding)) >= match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION match_chunks(vector, float, int, int) TO authenticated;

-- Verify the function exists:
SELECT proname, prosrc IS NOT NULL AS has_body
FROM pg_proc
WHERE proname = 'match_chunks';
'''

# ============================================================
# G.10 Part B — Netlify function: retrieve-content
# ============================================================
files["netlify/functions/retrieve-content.js"] = '''// netlify/functions/retrieve-content.js
// Phase G.10 — RAG retrieval API.
//
// POST { query: "...", hsk_level: 2, max_results: 10, threshold: 0.5 }
// Returns { ok: true, results: [{chunk_id, content, title, hsk_level, similarity}] }
//
// Internal flow:
//   1. Embed the query via OpenAI
//   2. Call Supabase match_chunks RPC with the embedding
//   3. Return ranked results

import { createClient } from '@supabase/supabase-js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMBED_MODEL = 'text-embedding-3-small';

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

async function embedQuery(text) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI embed error ${resp.status}: ${err}`);
  }
  const data = await resp.json();
  return data.data[0].embedding;
}

export default async function handler(req) {
  if (!OPENAI_API_KEY || !supabase) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY or Supabase not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }

  const query = (body.query || '').trim();
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query' }),
      { status: 400, headers: { 'Content-Type': 'application/json' }});
  }

  const hsk_level = body.hsk_level ?? null;
  const max_results = Math.min(body.max_results ?? 10, 50);
  const threshold = body.threshold ?? 0.4;

  // Embed the query
  let embedding;
  try {
    embedding = await embedQuery(query);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Embed failed: ' + e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  // Call match_chunks RPC
  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: max_results,
    filter_hsk_level: hsk_level,
  });

  if (error) {
    return new Response(JSON.stringify({ error: 'RPC failed: ' + error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' }});
  }

  return new Response(JSON.stringify({
    ok: true,
    query,
    results: data || [],
    count: (data || []).length,
    model: EMBED_MODEL,
  }), { status: 200, headers: { 'Content-Type': 'application/json' }});
}
'''

# ============================================================
# G.10 Part C — Embedding batch runner (Python script)
# Reads chunks without embeddings, sends them in batches of 100 to embed-chunk
# Netlify function (which writes to clf_chunk_embeddings).
# ============================================================
files["scripts/embed_corpus_chunks.py"] = '''# scripts/embed_corpus_chunks.py
# Embed corpus chunks via the deployed embed-chunk Netlify function.
# Reads chunks WITHOUT existing embeddings, batches of N, calls function.
#
# Run after corpus is populated:
#   python scripts/embed_corpus_chunks.py
#
# Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EMBED_FUNCTION_URL env vars.
# EMBED_FUNCTION_URL = https://david-zhongwen.net/.netlify/functions/embed-chunk
#                      (or http://localhost:8888/... in netlify dev)

import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# ============================================================
# Auto-load .env
# ============================================================
def _load_dotenv():
    env_path = Path.cwd() / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip(\'"\').strip("\'")
        if k == "VITE_SUPABASE_URL" and not os.environ.get("SUPABASE_URL"):
            os.environ["SUPABASE_URL"] = v
        elif k == "SUPABASE_SERVICE_ROLE_KEY" and not os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
            os.environ["SUPABASE_SERVICE_ROLE_KEY"] = v
        elif k == "EMBED_FUNCTION_URL" and not os.environ.get("EMBED_FUNCTION_URL"):
            os.environ["EMBED_FUNCTION_URL"] = v

_load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
FUNCTION_URL = os.environ.get(
    "EMBED_FUNCTION_URL",
    "https://david-zhongwen.net/.netlify/functions/embed-chunk"
)

BATCH_SIZE = 50  # chunks per request to embed function
MAX_BATCHES = 250  # safety cap (~12,500 chunks max per run)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    sys.exit(1)

print(f"Supabase: {SUPABASE_URL}")
print(f"Embed function: {FUNCTION_URL}")
print(f"Batch size: {BATCH_SIZE}")
print()

# ============================================================
# Step 1: find chunks WITHOUT embeddings
# ============================================================
def fetch_unembedded_chunks(limit=BATCH_SIZE):
    """Returns chunk_ids that don't have an embedding yet."""
    # Query chunks NOT IN (SELECT chunk_id FROM clf_chunk_embeddings)
    # PostgREST doesn't directly support NOT IN subquery, so use a custom RPC
    # OR we read all embeddings and diff in memory (acceptable for ~11k).
    req = urllib.request.Request(
        SUPABASE_URL + f"/rest/v1/clf_corpus_chunks?select=id&limit={limit*5}",
        method="GET"
    )
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    with urllib.request.urlopen(req, timeout=30) as resp:
        chunks = json.loads(resp.read().decode("utf-8"))

    # Get embedded chunk_ids
    req2 = urllib.request.Request(
        SUPABASE_URL + "/rest/v1/clf_chunk_embeddings?select=chunk_id&limit=20000",
        method="GET"
    )
    req2.add_header("apikey", SUPABASE_KEY)
    req2.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    with urllib.request.urlopen(req2, timeout=30) as resp:
        embedded = json.loads(resp.read().decode("utf-8"))

    embedded_ids = set(e["chunk_id"] for e in embedded)
    pending = [c["id"] for c in chunks if c["id"] not in embedded_ids]
    return pending[:limit]

# ============================================================
# Step 2: call embed function for a batch
# ============================================================
def embed_batch(chunk_ids):
    payload = json.dumps({"chunks": chunk_ids}).encode("utf-8")
    req = urllib.request.Request(FUNCTION_URL, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            txt = resp.read().decode("utf-8")
            return resp.getcode(), json.loads(txt)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return None, str(e)

# ============================================================
# Main loop
# ============================================================
print("=== Starting embedding loop ===")
total_embedded = 0
start = time.time()

for batch_idx in range(MAX_BATCHES):
    pending = fetch_unembedded_chunks(BATCH_SIZE)
    if not pending:
        print(f"\\n[OK] No more chunks to embed.")
        break

    print(f"  Batch {batch_idx+1}: embedding {len(pending)} chunks...", end=" ", flush=True)
    code, result = embed_batch(pending)
    if code != 200:
        print(f"[FAIL] code={code}, body={str(result)[:200]}")
        # Don\'t exit — try to continue with next batch
        time.sleep(5)
        continue

    n = result.get("embedded", 0) if isinstance(result, dict) else 0
    total_embedded += n
    elapsed = time.time() - start
    rate = total_embedded / elapsed if elapsed > 0 else 0
    print(f"[OK] +{n}  total={total_embedded}  rate={rate:.1f}/s")

    # Polite delay to avoid rate limits
    time.sleep(0.5)

elapsed = time.time() - start
print(f"\\n=== Done. Embedded {total_embedded} chunks in {elapsed:.0f}s ===")
print(f"Cost estimate: ~${total_embedded * 0.000002:.4f} at OpenAI text-embedding-3-small rates")
'''

# ============================================================
# Patch AdminAppV2 to add Teacher Knowledge Map sub-tab in 教学 pillar
# ============================================================
print("=== Writing G.9 + G.10 files ===")
for rel, content in files.items():
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    data = content.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
    p.write_bytes(data)
    print(f"  [OK] {rel}  ({len(data)} bytes)")

# ============================================================
# Patch AdminAppV2.jsx to wire 教学 pillar to TeacherKnowledgeMap
# ============================================================
print("\n=== Patching AdminAppV2.jsx ===")
p_v2 = ROOT / "src" / "admin" / "AdminAppV2.jsx"
src = p_v2.read_text(encoding="utf-8")

# Add import
old1 = "import CommunityPillar from './v2/pillars/CommunityPillar';"
new1 = """import CommunityPillar from './v2/pillars/CommunityPillar';
import TeacherKnowledgeMap from './v2/pillars/TeacherKnowledgeMap';"""
if old1 in src and "TeacherKnowledgeMap" not in src:
    src = src.replace(old1, new1, 1)
    print("[OK] added TeacherKnowledgeMap import")
elif "TeacherKnowledgeMap" in src:
    print("[SKIP] TeacherKnowledgeMap import already present")
else:
    print("[FAIL] could not find CommunityPillar import line")

# Find the existing 教学 pillar handler and replace its placeholder with TeacherKnowledgeMap.
# Look for activeTab === 'pillar-teaching' or similar.
# If a placeholder exists, replace it. Otherwise insert a new branch.
TEACH_HANDLER_OLD = """  // Module pillars"""
TEACH_HANDLER_NEW = """  // 教学 pillar — Teacher Knowledge Map (Phase G.9)
  if (activeTab === 'pillar-teaching') {
    return (
      <div>
        <SectionHeader icon="🏫" title="教学" subtitle="班级整体掌握情况 · 知识点热度图" color="#c41e3a"/>
        <TeacherKnowledgeMap/>
      </div>
    );
  }

  // Module pillars"""

if "if (activeTab === 'pillar-teaching')" in src:
    print("[SKIP] pillar-teaching handler already present")
elif TEACH_HANDLER_OLD in src:
    src = src.replace(TEACH_HANDLER_OLD, TEACH_HANDLER_NEW, 1)
    print("[OK] added pillar-teaching handler")
else:
    print("[WARN] could not find '// Module pillars' marker — manual wiring may be needed")

data = src.encode("utf-16","surrogatepass").decode("utf-16").encode("utf-8")
p_v2.write_bytes(data)
print(f"[OK] wrote AdminAppV2.jsx ({len(data)} bytes)")

# ============================================================
# Verify
# ============================================================
print("\n=== Verification ===")
final = p_v2.read_text(encoding="utf-8")
checks = [
    ('TeacherKnowledgeMap.jsx exists',
        (ROOT / "src" / "admin" / "v2" / "pillars" / "TeacherKnowledgeMap.jsx").exists()),
    ('match_chunks SQL exists',
        (ROOT / "db_phase_g10_match_chunks.sql").exists()),
    ('retrieve-content.js exists',
        (ROOT / "netlify" / "functions" / "retrieve-content.js").exists()),
    ('embed_corpus_chunks.py exists',
        (ROOT / "scripts" / "embed_corpus_chunks.py").exists()),
    ('AdminAppV2: TeacherKnowledgeMap import',
        "import TeacherKnowledgeMap from './v2/pillars/TeacherKnowledgeMap'" in final),
    ('AdminAppV2: pillar-teaching handler',
        "activeTab === 'pillar-teaching'" in final),
]
all_ok = True
for label, val in checks:
    print(f"  [{'OK' if val else 'FAIL'}] {label}")
    if not val: all_ok = False

# Escape check
hex_chars = set('0123456789abcdefABCDEF')
total_escapes = 0
for rel in files.keys():
    p = ROOT / rel
    txt = p.read_text(encoding="utf-8")
    i = 0
    while i < len(txt) - 5:
        if txt[i] == chr(92) and txt[i+1] == 'u':
            if all(c in hex_chars for c in txt[i+2:i+6]):
                total_escapes += 1
                i += 6
                continue
        i += 1
print(f"  Raw escapes: {total_escapes}")

print("\n" + ("=== ALL OK ===" if all_ok and total_escapes == 0 else "=== SOME FAIL ==="))

print()
print("=" * 60)
print("PHASE G.9 + G.10 SHIPPED")
print("=" * 60)
print()
print("FILES CREATED:")
print("  src/admin/v2/pillars/TeacherKnowledgeMap.jsx    (G.9)")
print("  db_phase_g10_match_chunks.sql                   (G.10 SQL RPC)")
print("  netlify/functions/retrieve-content.js           (G.10 Netlify fn)")
print("  scripts/embed_corpus_chunks.py                  (G.10 batch embedder)")
print()
print("NEXT STEPS — IN ORDER:")
print()
print("1. Run SQL in Supabase SQL Editor:")
print("   File: db_phase_g10_match_chunks.sql")
print("   Creates the match_chunks() function for vector similarity search.")
print()
print("2. Verify build:")
print("   npm run build")
print()
print("3. Deploy:")
print("   netlify deploy --prod --dir dist --no-build")
print()
print("4. Set env vars in Netlify (if not already set):")
print("   OPENAI_API_KEY               (for embed-chunk + retrieve-content)")
print("   SUPABASE_URL                 (your Supabase project URL)")
print("   SUPABASE_SERVICE_ROLE_KEY    (service_role, NOT anon)")
print("   Without these, the Netlify functions return 500.")
print()
print("5. Test G.9 (Teacher Knowledge Map):")
print("   Login as superadmin -> /admin-v2 -> 模块内容 -> 教学")
print("   Should show stat strip + filters + heatmap grid (mostly gray since")
print("   no students have practiced yet).")
print()
print("6. Run embedding pipeline (G.10 prerequisite):")
print("   python scripts/embed_corpus_chunks.py")
print("   This embeds all 11,092 chunks via the embed-chunk function.")
print("   ~10-15 min runtime, ~$0.02 cost.")
print()
print("7. Test G.10 retrieval (after embeddings complete):")
print("   curl -X POST https://david-zhongwen.net/.netlify/functions/retrieve-content \\")
print("        -H 'Content-Type: application/json' \\")
print("        -d '{\"query\": \"family members\", \"hsk_level\": 1, \"max_results\": 5}'")
print("   Should return JSON with 5 ranked chunks.")
print()
print("HONEST EXPECTATIONS:")
print("  - G.9 renders empty heatmap until students practice (correct behavior)")
print("  - G.10 retrieval returns [] until you run step 6 (embed corpus)")
print("  - G.11 (wiring RAG into 社区 modules) deferred")
