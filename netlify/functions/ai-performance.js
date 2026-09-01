// netlify/functions/ai-performance.js
// AI 生产线读数 — read-only performance aggregation over the AI pipelines.
//
// This is the service-role counterpart to what the anon key can already see.
// The interesting half of the picture — job durations, run status, failure
// text — lives in tables RLS keeps from the browser, so it has to come from
// here. Role gate matches admin-stats.js: super_admin | school_master.
//
// Actions:
//   { action: 'summary', days? }  → the full readout (see shape below)
//   { action: 'runs', limit? }    → recent pipeline runs, one row each
//
// DESIGN NOTE — every read is tolerant.
// admin-stats.js throws the moment one table is missing, which takes the whole
// summary down with it. Here a missing table, a denied table or a statement
// timeout degrades to an empty result plus an entry in `notes[]`, and the
// caller renders that as a blind spot. A readout about instrumentation gaps
// must survive its own instrumentation gaps.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL              = process.env.SUPABASE_URL              || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY         = process.env.SUPABASE_ANON_KEY         || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_ROWS = 5000;

const json = (status, body) => ({
  statusCode: status,
  headers: {
    'Content-Type':                 'application/json',
    'Cache-Control':                'no-store',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  },
  body: JSON.stringify(body),
});

// ── small helpers ────────────────────────────────────────────────────
const ne = (v) => v !== null && v !== undefined && (typeof v !== 'string' || v.trim() !== '');
const day = (iso) => (iso ? String(iso).slice(0, 10) : null);

function tally(rows, key) {
  const out = {};
  for (const r of rows) {
    const k = typeof key === 'function' ? key(r) : r[key];
    const label = k === null || k === undefined || k === '' ? '(none)' : String(k);
    out[label] = (out[label] || 0) + 1;
  }
  return out;
}

/** Rate with its denominator kept attached — never ship a bare percentage. */
function rate(numerator, denominator) {
  return {
    n: numerator,
    of: denominator,
    pct: denominator ? +((100 * numerator) / denominator).toFixed(1) : null,
    // Under ~30 observations a percentage is direction, not measurement.
    small_sample: denominator > 0 && denominator < 30,
  };
}

function stats(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { n: 0 };
  const at = (p) => v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))];
  return {
    n: v.length,
    min: v[0],
    p50: at(50),
    p90: at(90),
    p95: at(95),
    max: v[v.length - 1],
    mean: +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(4),
  };
}

/** Field completeness over a row set, as a list ordered by coverage. */
function coverage(rows, fields) {
  return fields.map((f) => {
    const filled = rows.filter((r) => ne(r[f])).length;
    return { field: f, ...rate(filled, rows.length) };
  }).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
}

// ── tolerant reader ──────────────────────────────────────────────────
// Classifies the ways a read can fail so the UI can say WHY a panel is empty.
function classify(table, error) {
  const code = error?.code || '';
  const msg  = error?.message || String(error);
  if (code === 'PGRST205' || code === '42P01' || /does not exist|schema cache/i.test(msg)) {
    return { table, kind: 'missing', message: msg,
             impact: 'Table is not in the exposed schema — nothing is being recorded here.' };
  }
  if (code === '57014' || /statement timeout/i.test(msg)) {
    return { table, kind: 'timeout', message: msg,
             impact: 'Query exceeded the statement timeout — narrow the columns or add an index.' };
  }
  if (code === '42501' || /permission denied/i.test(msg)) {
    return { table, kind: 'denied', message: msg,
             impact: 'Service role was refused — check grants and RLS.' };
  }
  return { table, kind: 'error', message: msg, impact: 'Read failed; panel is incomplete.' };
}

function makeReader(admin, notes) {
  return async function read(table, columns, tune) {
    try {
      let q = admin.from(table).select(columns).limit(MAX_ROWS);
      if (tune) q = tune(q);
      const { data, error } = await q;
      if (error) { notes.push(classify(table, error)); return null; }
      return data || [];
    } catch (e) {
      notes.push(classify(table, e));
      return null;
    }
  };
}

/**
 * Row count without transferring the rows.
 *
 * Needed because some columns cannot be selected at all: clf_chengyu.image_url
 * holds base64 data URIs of roughly 4.7 MB each, so any select touching it
 * exceeds the statement timeout. A head count answers "how many have one?"
 * in under a second without moving the payload.
 */
function makeCounter(admin, notes) {
  return async function countRows(table, tune) {
    try {
      let q = admin.from(table).select('id', { count: 'exact', head: true });
      if (tune) q = tune(q);
      const { count, error } = await q;
      if (error) { notes.push(classify(table, error)); return null; }
      return count ?? 0;
    } catch (e) {
      notes.push(classify(table, e));
      return null;
    }
  };
}

/** First table name that reads successfully — for renamed/uncertain tables. */
async function readFirstOf(read, candidates, columns, tune) {
  for (const table of candidates) {
    const rows = await read(table, columns, tune);
    if (rows) return { table, rows };
  }
  return { table: null, rows: [] };
}

// ── handler ──────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: 'Server misconfigured: missing Supabase env vars' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return json(401, { error: 'Missing Authorization header' });
  }

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: getUserErr } = await anon.auth.getUser(authHeader.slice(7));
  const caller = userData?.user;
  if (getUserErr || !caller) return json(401, { error: 'Invalid session' });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await admin
    .from('clf_user_profiles')
    .select('role, is_active')
    .eq('user_id', caller.id)
    .maybeSingle();

  if (!profile)                    return json(403, { error: 'No CLF profile for caller' });
  if (profile.is_active === false) return json(403, { error: 'Account disabled' });
  if (!['super_admin', 'school_master'].includes(profile.role)) {
    return json(403, { error: 'Forbidden' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON body' }); }

  try {
    if (body.action === 'summary') return await handleSummary(admin, body);
    if (body.action === 'runs')    return await handleRuns(admin, body);
    return json(400, { error: `Unknown action: ${body.action}` });
  } catch (err) {
    console.error('[ai-performance]', err);
    return json(500, { error: err.message || 'Internal server error' });
  }
};

// ═════════════════════════════════════════════════════════════════════
//  summary
// ═════════════════════════════════════════════════════════════════════
async function handleSummary(admin, body) {
  const notes = [];
  const read  = makeReader(admin, notes);
  const count = makeCounter(admin, notes);

  // days omitted → all time. The estate was built in bursts, so a rolling
  // window silently reports an empty platform; make narrowing deliberate.
  const days  = Number.isFinite(+body.days) && +body.days > 0 ? +body.days : null;
  const since = days ? new Date(Date.now() - days * 86400_000).toISOString() : null;

  const [
    jobs, teacher, calls, chars, riddles, attempts, words, grammar, chengyu, poems,
  ] = await Promise.all([
    // ── the part the anon key cannot see ──────────────────────────────
    read(
      'character_extraction_jobs',
      'id,source_type,source_label,extraction_method,status,total_candidates,' +
      'total_added,total_updated,total_skipped,started_at,completed_at,error_message,config',
      (q) => (since ? q.gte('started_at', since) : q),
    ),
    // ai_jobs may have been renamed to dwxz_ai_jobs — try both, report which.
    readFirstOf(read, ['ai_jobs', 'dwxz_ai_jobs'], 'id,status,action,created_at,updated_at',
      (q) => (since ? q.gte('created_at', since) : q)),

    // Per-call provider telemetry (migration 017). This is the only source of
    // real latency on the platform — extraction jobs never stamp started_at —
    // so the latency effect stands or falls on this table.
    read('clf_ai_calls',
      'id,feature,action,provider,model,ok,error_kind,error_detail,latency_ms,' +
      'input_tokens,output_tokens,created_at',
      (q) => (since ? q.gte('created_at', since) : q)),

    // ── content estate (narrow selects: wide ones time out) ───────────
    read('jgw_characters',
      'id,source,status,ai_filled_at,human_edited_at,ai_confidence,needs_review,verified,' +
      'hsk_level,meaning_zh,meaning_en,meaning_it,mnemonic_zh,mnemonic_en,mnemonic_it,' +
      'etymology,example_word_zh,illustration_url,mnemonic_image_url,svg_modern,created_at'),
    read('clf_riddles',
      'id,source,generated_by,generation_meta,status,approved_at,approved_by,level,' +
      'illustration_provider,illustration_url,images_generated_at,upvotes,downvotes,created_at'),
    read('clf_riddle_attempts', 'id,riddle_id,success,attempts,hints_used,time_spent_ms,vote,created_at'),
    read('clf_words', 'id,meaning_zh,meaning_en,meaning_it,example_zh,example_en,example_it,pinyin,audio_url,image_url,created_at'),
    read('clf_grammar_exercises', 'id,type,difficulty,question,answer,explanation,created_at'),
    // image_url deliberately absent — see makeCounter. Counted separately below.
    read('clf_chengyu', 'id,image_provider,image_style,active,created_at'),
    read('clf_poems', 'id,audio_provider,audio_voice,audio_url,audio_duration,image_url,active,created_at'),
  ]);

  const J  = jobs     || [];
  const K  = calls    || [];
  const C  = chars    || [];
  const R  = riddles  || [];
  const A  = attempts || [];
  const W  = words    || [];
  const G  = grammar  || [];
  const CY = chengyu  || [];
  const P  = poems    || [];

  // ── A · pipeline runs ─────────────────────────────────────────────
  // A run can finish with status 'complete' and still carry an error_message
  // (partial batch failure, e.g. "4 errors. First: stability 402"), so status
  // alone understates failure. Classify on both.
  const failed = J.filter((j) => j.status === 'error' || ne(j.error_message));
  const done   = J.filter((j) => j.status === 'complete' && !ne(j.error_message));
  const durations = J
    .filter((j) => j.started_at && j.completed_at)
    .map((j) => new Date(j.completed_at) - new Date(j.started_at))
    .filter((ms) => ms >= 0);

  const sum = (f) => J.reduce((s, j) => s + (j[f] || 0), 0);
  const candidates = sum('total_candidates');

  // Per-method yield separates a pipeline that works from one that only ran:
  // a method can log hundreds of candidates and add none of them.
  const byMethod = {};
  for (const j of J) {
    const m = j.extraction_method || '(none)';
    byMethod[m] = byMethod[m] || { runs: 0, candidates: 0, added: 0, unfinished: 0 };
    byMethod[m].runs += 1;
    byMethod[m].candidates += j.total_candidates || 0;
    byMethod[m].added += j.total_added || 0;
    if (!j.completed_at) byMethod[m].unfinished += 1;
  }
  for (const m of Object.keys(byMethod)) {
    byMethod[m].add_rate = rate(byMethod[m].added, byMethod[m].candidates);
  }

  // A run with no completed_at never reported an end. Held candidates are
  // work the pipeline produced and then parked.
  const unfinished = J.filter((j) => !j.completed_at);

  const pipelines = {
    runs: {
      total:      J.length,
      by_status:  tally(J, 'status'),
      by_method:  tally(J, 'extraction_method'),
      // A run is judged only against runs that actually finished either way.
      success:    rate(done.length, done.length + failed.length),
      unfinished: {
        ...rate(unfinished.length, J.length),
        by_status: tally(unfinished, 'status'),
        held_candidates: unfinished.reduce((s, j) => s + (j.total_candidates || 0), 0),
      },
    },
    duration_ms: stats(durations),
    // Which timestamps actually get written — the duration meter depends on
    // both, and a missing one is the reason the meter is empty.
    timestamps: {
      started_at:   rate(J.filter((j) => ne(j.started_at)).length, J.length),
      completed_at: rate(J.filter((j) => ne(j.completed_at)).length, J.length),
    },
    by_method: byMethod,
    yield: {
      candidates,
      added:    sum('total_added'),
      updated:  sum('total_updated'),
      skipped:  sum('total_skipped'),
      add_rate: rate(sum('total_added'), candidates),
    },
    failures: failed
      .filter((j) => ne(j.error_message))
      .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
      .slice(0, 10)
      .map((j) => ({
        method: j.extraction_method,
        source: j.source_label,
        started_at: j.started_at,
        error: String(j.error_message).slice(0, 400),
      })),
  };

  // Duration needs both ends. Say which one is missing rather than shipping
  // an empty chart the reader has to interpret.
  if (J.length > 0 && durations.length === 0) {
    const missing = [
      pipelines.timestamps.started_at.n === 0 ? 'started_at' : null,
      pipelines.timestamps.completed_at.n === 0 ? 'completed_at' : null,
    ].filter(Boolean);
    notes.push({
      table: 'character_extraction_jobs', kind: 'uninstrumented',
      message: missing.length
        ? `${missing.join(' and ')} never written across ${J.length} runs.`
        : `No run carries both timestamps across ${J.length} runs.`,
      impact: 'Run duration cannot be computed — the latency meter stays empty until both ends are stamped.',
    });
  }
  if (unfinished.length > 0) {
    notes.push({
      table: 'character_extraction_jobs', kind: 'stalled',
      message: `${unfinished.length} run(s) never reported completion, holding ` +
               `${pipelines.runs.unfinished.held_candidates} candidate(s).`,
      impact: 'Extracted work is parked mid-pipeline and will not reach the estate on its own.',
    });
  }

  // ── B · teacher assistant ─────────────────────────────────────────
  const T = teacher.rows || [];
  const teacherDur = T
    .filter((t) => t.created_at && t.updated_at)
    .map((t) => new Date(t.updated_at) - new Date(t.created_at))
    .filter((ms) => ms >= 0);

  const teacher_ai = {
    table:     teacher.table,
    available: !!teacher.table,
    runs:      T.length,
    by_status: tally(T, 'status'),
    by_action: tally(T, 'action'),
    duration_ms: stats(teacherDur),
  };
  if (teacher.table && T.length === 0) {
    notes.push({
      table: teacher.table, kind: 'empty',
      message: 'Table resolves but holds no rows.',
      impact: 'Teacher-assistant runs are completing without being recorded.',
    });
  }

  // ── B2 · provider calls (clf_ai_calls, migration 017) ─────────────
  // One row per provider call, with latency and tokens. Everything the job
  // tables cannot answer — how slow, how often it fails, and which failure
  // class — is answerable here and nowhere else.
  const okCalls   = K.filter((c) => c.ok === true);
  const failCalls = K.filter((c) => c.ok === false);
  const provider_calls = {
    table: 'clf_ai_calls',
    available: calls !== null,
    total: K.length,
    success:     rate(okCalls.length, K.length),
    latency_ms:  stats(K.map((c) => c.latency_ms)),
    by_feature:  tally(K, 'feature'),
    by_action:   tally(K, 'action'),
    by_provider: tally(K, 'provider'),
    by_model:    tally(K, 'model'),
    by_error_kind: tally(failCalls, 'error_kind'),
    tokens: {
      input:  K.reduce((s, c) => s + (c.input_tokens || 0), 0),
      output: K.reduce((s, c) => s + (c.output_tokens || 0), 0),
    },
    // Empty completions are a silent failure: ok=true with nothing returned.
    empty_completions: okCalls.filter((c) => c.output_tokens === 0).length,
    first_call: K.length ? K.map((c) => c.created_at).sort()[0] : null,
    last_call:  K.length ? K.map((c) => c.created_at).sort().slice(-1)[0] : null,
    recent: [...K]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 15)
      .map((c) => ({
        at: c.created_at, feature: c.feature, action: c.action,
        provider: c.provider, model: c.model, ok: c.ok,
        error_kind: c.error_kind, latency_ms: c.latency_ms,
        input_tokens: c.input_tokens, output_tokens: c.output_tokens,
      })),
  };
  if (calls !== null && K.length === 0) {
    notes.push({
      table: 'clf_ai_calls', kind: 'empty',
      message: 'Telemetry table exists but holds no calls in this window.',
      impact: 'Instrumentation is in place; either nothing has run or the window is too narrow.',
    });
  }

  // ── C · attribution ───────────────────────────────────────────────
  // `column: null` means the schema has nowhere to put a provider at all —
  // a different problem from a column that exists and is left null.
  const attribution = [
    {
      key: 'riddle_text', label: 'Riddle writer', medium: 'text', column: 'generated_by',
      ...(() => {
        const ai = R.filter((r) => r.source === 'ai_generated');
        return { total: ai.length, ...rate(ai.filter((r) => ne(r.generated_by)).length, ai.length),
                 providers: tally(ai.filter((r) => ne(r.generated_by)), 'generated_by') };
      })(),
    },
    {
      key: 'riddle_image', label: 'Riddle illustrator', medium: 'image', column: 'illustration_provider',
      ...(() => {
        const img = R.filter((r) => ne(r.illustration_url));
        return { total: img.length, ...rate(img.filter((r) => ne(r.illustration_provider)).length, img.length),
                 providers: tally(img, 'illustration_provider') };
      })(),
    },
    {
      key: 'poem_audio', label: 'Poem narrator', medium: 'speech', column: 'audio_provider',
      ...(() => {
        const aud = P.filter((p) => ne(p.audio_url));
        return { total: aud.length, ...rate(aud.filter((p) => ne(p.audio_provider)).length, aud.length),
                 providers: tally(aud, 'audio_provider'),
                 voices: tally(aud, 'audio_voice'),
                 seconds: P.reduce((s, p) => s + (p.audio_duration || 0), 0) };
      })(),
    },
    {
      key: 'chengyu_image', label: 'Chengyu illustrator', medium: 'image', column: 'image_provider',
      total: CY.length,
      ...rate(CY.filter((c) => ne(c.image_provider)).length, CY.length),
      providers: tally(CY, 'image_provider'),
      styles: tally(CY, 'image_style'),
    },
    {
      key: 'character_extract', label: 'Character extractor', medium: 'extract + fill',
      column: 'config->provider (jobs only)',
      total: C.filter((c) => ne(c.ai_filled_at)).length,
      ...rate(J.filter((j) => ne(j.config?.provider)).length, J.length),
      providers: tally(J.filter((j) => ne(j.config?.provider)), (j) => j.config?.provider),
    },
    // No provider column exists on these tables at all — pct stays null so the
    // UI can say "nowhere to record it" rather than "recorded 0% of the time".
    { key: 'word_image', label: 'Word illustrator', medium: 'image', column: null,
      total: W.filter((w) => ne(w.image_url)).length, ...rate(0, 0), providers: {} },
    { key: 'grammar_text', label: 'Grammar generator', medium: 'text', column: null,
      total: G.length, ...rate(0, 0), providers: {} },
  ];

  // ── D · quality & acceptance ──────────────────────────────────────
  const aiChars = C.filter((c) => ne(c.ai_filled_at));
  const conf    = aiChars.map((c) => c.ai_confidence).filter((x) => Number.isFinite(x));
  const confHist = {};
  for (const c of conf) { const b = c.toFixed(2); confHist[b] = (confHist[b] || 0) + 1; }

  const aiRiddles = R.filter((r) => r.generation_meta && typeof r.generation_meta === 'object');
  const selfPass  = aiRiddles.filter((r) => r.generation_meta.self_check_passed === true);

  const quality = {
    characters: {
      total: C.length,
      ai_filled:     rate(aiChars.length, C.length),
      human_edited:  rate(C.filter((c) => ne(c.human_edited_at)).length, C.length),
      needs_review:  rate(C.filter((c) => c.needs_review === true).length, C.length),
      verified:      rate(C.filter((c) => c.verified === true).length, C.length),
      confidence:    { ...stats(conf), histogram: confHist },
    },
    riddles: {
      total:        R.length,
      ai_generated: rate(R.filter((r) => r.source === 'ai_generated').length, R.length),
      // The generator's own verdict on its output, before anyone looked.
      self_check:   rate(selfPass.length, aiRiddles.length),
      // Approval is only meaningful if someone left a fingerprint on it.
      approved:           rate(R.filter((r) => r.status === 'approved').length, R.length),
      approval_timestamp: rate(R.filter((r) => ne(r.approved_at)).length, R.length),
      approval_actor:     rate(R.filter((r) => ne(r.approved_by)).length, R.length),
      illustrated:        rate(R.filter((r) => ne(r.illustration_url)).length, R.length),
      votes: R.reduce((s, r) => s + (r.upvotes || 0) + (r.downvotes || 0), 0),
    },
    learners: {
      attempts:      A.length,
      solved:        rate(A.filter((a) => a.success === true).length, A.length),
      used_hints:    rate(A.filter((a) => (a.hints_used || 0) > 0).length, A.length),
      voted:         rate(A.filter((a) => ne(a.vote)).length, A.length),
      time_ms:       stats(A.map((a) => a.time_spent_ms)),
      riddles_tried: new Set(A.map((a) => a.riddle_id)).size,
    },
  };

  // clf_chengyu.image_url holds base64 data URIs measured in megabytes, so it
  // is counted rather than read. Flag the storage itself — inlined images are
  // why every wide read of this table times out.
  const chengyuWithImage = await count('clf_chengyu', (q) => q.not('image_url', 'is', null));
  if (chengyuWithImage) {
    notes.push({
      table: 'clf_chengyu', kind: 'inline_blob',
      message: `${chengyuWithImage} row(s) store the image inline in image_url as a data URI ` +
               `(observed around 4.7 MB each).`,
      impact: 'Any select touching image_url exceeds the statement timeout. Move these to Storage and keep a URL.',
    });
  }

  // ── E · coverage, with the character cohort split ─────────────────
  const aiCohort  = C.filter((c) => c.source === 'ai_extracted');
  const humCohort = C.filter((c) => c.source !== 'ai_extracted');
  const charFields = ['meaning_zh', 'meaning_en', 'meaning_it', 'mnemonic_zh', 'mnemonic_en',
                      'mnemonic_it', 'etymology', 'example_word_zh', 'hsk_level',
                      'illustration_url', 'mnemonic_image_url', 'svg_modern'];

  const coverageOut = {
    characters: {
      total: C.length,
      cohorts: { ai_extracted: aiCohort.length, other: humCohort.length },
      fields: charFields.map((f) => ({
        field: f,
        all:          rate(C.filter((r) => ne(r[f])).length, C.length),
        ai_extracted: rate(aiCohort.filter((r) => ne(r[f])).length, aiCohort.length),
        other:        rate(humCohort.filter((r) => ne(r[f])).length, humCohort.length),
      })),
    },
    words:   { total: W.length,  fields: coverage(W, ['pinyin', 'meaning_zh', 'meaning_en', 'meaning_it', 'example_zh', 'example_en', 'example_it', 'image_url', 'audio_url']) },
    grammar: { total: G.length,  fields: coverage(G, ['question', 'answer', 'explanation']), by_type: tally(G, 'type') },
    chengyu: {
      total: CY.length,
      fields: coverage(CY, ['image_provider', 'image_style']),
      // Counted, not selected — the column is too heavy to read (see below).
      image_url: rate(chengyuWithImage ?? 0, CY.length),
      image_url_measured: chengyuWithImage !== null,
    },
    poems:   { total: P.length,  fields: coverage(P, ['audio_url', 'image_url']) },
    riddles: { total: R.length,  fields: coverage(R, ['illustration_url', 'approved_at', 'generated_by']) },
  };

  // ── F · production timeline ───────────────────────────────────────
  const buckets = {};
  const bump = (iso, kind) => {
    const d = day(iso);
    if (!d) return;
    buckets[d] = buckets[d] || { day: d, characters: 0, riddles: 0, words: 0, grammar: 0, chengyu: 0, poems: 0, total: 0 };
    buckets[d][kind] += 1;
    buckets[d].total += 1;
  };
  for (const r of C)  bump(r.created_at, 'characters');
  for (const r of R)  bump(r.created_at, 'riddles');
  for (const r of W)  bump(r.created_at, 'words');
  for (const r of G)  bump(r.created_at, 'grammar');
  for (const r of CY) bump(r.created_at, 'chengyu');
  for (const r of P)  bump(r.created_at, 'poems');
  const production = Object.values(buckets).sort((a, b) => a.day.localeCompare(b.day));

  const lastLearnerActivity = A.length
    ? A.map((a) => a.created_at).filter(Boolean).sort().slice(-1)[0]
    : null;

  return json(200, {
    generated_at: new Date().toISOString(),
    window: days ? { days, since } : { days: null, since: null, label: 'all time' },
    estate: {
      characters: C.length, words: W.length, grammar: G.length,
      riddles: R.length, chengyu: CY.length, poems: P.length,
    },
    pipelines,
    teacher_ai,
    provider_calls,
    attribution,
    quality,
    coverage: coverageOut,
    production,
    last_learner_activity: lastLearnerActivity,
    notes,
  });
}

// ═════════════════════════════════════════════════════════════════════
//  runs — the raw job rows behind the duration percentiles
// ═════════════════════════════════════════════════════════════════════
async function handleRuns(admin, body) {
  const notes = [];
  const read  = makeReader(admin, notes);
  const limit = Math.min(Math.max(+body.limit || 50, 1), 500);

  const rows = await read(
    'character_extraction_jobs',
    'id,source_type,source_label,extraction_method,status,total_candidates,total_added,' +
    'total_updated,total_skipped,started_at,completed_at,error_message,config',
    (q) => q.order('started_at', { ascending: false }).limit(limit),
  );

  return json(200, {
    generated_at: new Date().toISOString(),
    runs: (rows || []).map((j) => ({
      id: j.id,
      method: j.extraction_method,
      source_type: j.source_type,
      source: j.source_label,
      status: j.status,
      started_at: j.started_at,
      completed_at: j.completed_at,
      duration_ms: j.started_at && j.completed_at
        ? new Date(j.completed_at) - new Date(j.started_at)
        : null,
      candidates: j.total_candidates,
      added: j.total_added,
      updated: j.total_updated,
      skipped: j.total_skipped,
      provider: j.config?.provider ?? null,
      error: j.error_message ? String(j.error_message).slice(0, 400) : null,
    })),
    notes,
  });
}
