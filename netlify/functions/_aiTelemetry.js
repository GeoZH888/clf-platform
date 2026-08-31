// netlify/functions/_aiTelemetry.js
//
// Records one row per AI provider call into clf_ai_calls.
//
// Two rules govern everything here:
//
//   1. Telemetry must never break a request. Every failure is swallowed. A
//      learner losing a generated story because the metrics table was
//      unreachable would be an absurd trade.
//
//   2. Telemetry must never leak content. Prompts and completions are not
//      recorded — they are large, they contain learner writing, and none of
//      the questions this exists to answer need them. Errors are reduced to a
//      coarse `kind` plus a truncated detail.
//
// The await is deliberate despite being fire-and-forget in spirit: on Lambda,
// work left pending when the handler returns may simply never run, so an
// un-awaited insert would silently record nothing. It is bounded by a short
// timeout so a slow metrics write cannot hold up a response.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Long enough to succeed normally, short enough that nobody waits on metrics.
const WRITE_TIMEOUT_MS = 1500;

let client = null;
function db() {
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * Reduce an error to something groupable. The raw message is unbounded, varies
 * per provider, and can echo the prompt back — none of which belongs in a
 * dashboard axis.
 */
export function classifyError(err) {
  const m = String(err?.message || err || '').toLowerCase();
  if (!m) return 'unknown';
  if (m.includes('timeout') || m.includes('timed out') || m.includes('etimedout')) return 'timeout';
  if (m.includes('rate limit') || m.includes('429') || m.includes('overloaded')) return 'rate_limit';
  if (m.includes('api key') || m.includes('unauthor') || m.includes('401') || m.includes('403')) return 'auth';
  if (m.includes('no text block') || m.includes('empty')) return 'empty_response';
  if (m.includes('json')) return 'bad_json';
  if (m.includes('fetch') || m.includes('network') || m.includes('econnre')) return 'network';
  if (m.includes('not set') || m.includes('not configured')) return 'not_configured';
  return 'provider_error';
}

/**
 * Record one call. Never throws.
 *
 * @param {string}  feature       product-level name: 'story_draft', 'story_tts', …
 * @param {string}  [action]      gateway action, where there is one
 * @param {string}  [provider]    claude | openai | azure | …
 * @param {string}  [model]
 * @param {boolean} ok
 * @param {*}       [error]       Error or message; reduced to a kind
 * @param {number}  [latencyMs]
 * @param {number}  [inputTokens]
 * @param {number}  [outputTokens]
 * @param {object}  [meta]        small, non-sensitive extras only
 */
export async function recordAiCall({
  feature,
  action = null,
  provider = null,
  model = null,
  ok,
  error = null,
  latencyMs = null,
  inputTokens = null,
  outputTokens = null,
  meta = {},
} = {}) {
  try {
    const supabase = db();
    if (!supabase || !feature) return;

    const row = {
      feature,
      action,
      provider,
      model,
      ok: !!ok,
      error_kind:   ok ? null : classifyError(error),
      error_detail: ok ? null : String(error?.message || error || '').slice(0, 200),
      latency_ms:   latencyMs == null ? null : Math.round(latencyMs),
      input_tokens: inputTokens ?? null,
      output_tokens: outputTokens ?? null,
      meta,
    };

    await Promise.race([
      supabase.from('clf_ai_calls').insert(row),
      new Promise(resolve => setTimeout(resolve, WRITE_TIMEOUT_MS)),
    ]);
  } catch {
    // Swallowed on purpose — see rule 1 above.
  }
}

/**
 * Wrap an AI call so timing and outcome are recorded either way.
 *
 * The result is returned untouched and errors are rethrown, so adding this to
 * an existing call site changes no behaviour — only what gets written down.
 *
 * `usage` optionally pulls token counts out of whatever the provider returned.
 */
export async function tracked(info, fn, usage) {
  const started = Date.now();
  try {
    const result = await fn();
    const u = (() => { try { return usage ? usage(result) || {} : {}; } catch { return {}; } })();
    await recordAiCall({
      ...info,
      ok: true,
      latencyMs: Date.now() - started,
      inputTokens: u.input ?? null,
      outputTokens: u.output ?? null,
    });
    return result;
  } catch (err) {
    await recordAiCall({
      ...info,
      ok: false,
      error: err,
      latencyMs: Date.now() - started,
    });
    throw err;
  }
}
