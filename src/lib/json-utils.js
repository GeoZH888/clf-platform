// src/lib/json-utils.js
// ═══════════════════════════════════════════════════════════════════════════
// Tolerant JSON parser for AI-generated content.
//
// LLMs frequently produce nearly-valid JSON with edge issues:
//   - Wrapped in ```json ... ``` markdown fences
//   - Trailing prose after the JSON
//   - Chinese quotes “ ” instead of "
//   - Chinese punctuation ， ：
//   - Unescaped inner double quotes inside string values, e.g.
//     "explanation": "这是"被"字句的结构..."
//
// parseTolerant() works through escalating fallback strategies. Use it
// anywhere you'd otherwise call JSON.parse() on AI output.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a string that should contain JSON (object or array).
 * Returns the parsed value, or throws with a helpful preview.
 *
 * Strategies (in order):
 *   1. Strip markdown fences, plain JSON.parse
 *   2. Slice from first [ / { to matching ]/}, parse
 *   3. Replace Chinese punctuation with ASCII, parse
 *   4. Auto-escape unescaped inner quotes inside string values, parse
 */
export function parseTolerant(text) {
  if (text == null) throw new Error('parseTolerant: empty input');
  const stripped = String(text).replace(/```(?:json)?/gi, '').trim();

  // (1) Direct parse
  try { return JSON.parse(stripped); } catch (_) {}

  // Try arrays first (more common from batch prompts), then objects
  for (const [open, close] of [['[', ']'], ['{', '}']]) {
    const first = stripped.indexOf(open);
    const last  = stripped.lastIndexOf(close);
    if (first === -1 || last === -1 || last < first) continue;
    const slice = stripped.slice(first, last + 1);

    // (2) Sliced raw
    try { return JSON.parse(slice); } catch (_) {}

    // (3) Sliced with Chinese punctuation normalized
    const cleaned = slice
      .replace(/[\u201C\u201D]/g, '"')   // " " → "
      .replace(/[\u2018\u2019]/g, "'")    // ' ' → '
      .replace(/，/g, ',')
      .replace(/：/g, ':');
    try { return JSON.parse(cleaned); } catch (_) {}

    // (4) Auto-escape unescaped inner quotes inside string values.
    // Matches  "key": "value with "inner" quotes"  and escapes the inner ones.
    const deepClean = cleaned.replace(
      /"([^"\\]*)":\s*"((?:[^"\\]|\\.)*)"(?=\s*[,}\]])/g,
      (_, k, v) => `"${k}":"${v.replace(/(?<!\\)"/g, '\\"')}"`
    );
    try { return JSON.parse(deepClean); } catch (e) {
      // Save error and try next bracket type, but if this is the only
      // viable slice, throw with diagnostic preview.
      throw new Error(
        `parseTolerant failed (${e.message}). First 200 chars of slice: ${slice.slice(0, 200)}`
      );
    }
  }

  throw new Error(
    `parseTolerant: no JSON object or array found. First 200 chars: ${stripped.slice(0, 200)}`
  );
}
