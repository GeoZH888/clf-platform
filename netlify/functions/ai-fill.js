// netlify/functions/ai-fill.js
// Hardened: key guard, structured errors, never returns empty body

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // ── Preflight ──────────────────────────────────────────────────────────────
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // ── Key guard ─────────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "ANTHROPIC_API_KEY not configured in Netlify environment variables.",
        hint: "Go to Site → Site configuration → Environment variables and add ANTHROPIC_API_KEY, then redeploy.",
      }),
    };
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON in request body." }),
    };
  }

  const { character, fields = [] } = payload;

  if (!character) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required field: character" }),
    };
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const prompt = `You are an expert in Classical Chinese, oracle bone script (甲骨文), and Chinese etymology.

Fill in the following fields for the oracle bone script character: "${character}"

Return ONLY a valid JSON object with these keys (all values in the language specified):
{
  "pinyin": "romanization with tone marks",
  "meaning_zh": "meaning in Simplified Chinese (1–2 sentences)",
  "meaning_en": "meaning in English (1–2 sentences)",
  "meaning_it": "meaning in Italian (1–2 sentences)",
  "stroke_count": <integer>,
  "radical": "radical character",
  "mnemonic_zh": "memory hook in Chinese (vivid, 1 sentence)",
  "mnemonic_en": "memory hook in English (vivid, 1 sentence)",
  "mnemonic_it": "memory hook in Italian (vivid, 1 sentence)",
  "etymology": "brief oracle bone etymology (2–3 sentences in English)",
  "example_word_zh": "a 2-character compound using this character",
  "example_word_en": "English gloss of the compound",
  "difficulty": <integer 1–5>
}

Fields requested: ${fields.length > 0 ? fields.join(", ") : "all"}
Character: ${character}

Return ONLY the JSON object. No markdown, no explanation, no backticks.`;

  // ── Call Anthropic ────────────────────────────────────────────────────────
  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (networkErr) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Network error reaching Anthropic API.", detail: networkErr.message }),
    };
  }

  // ── Parse Anthropic response ──────────────────────────────────────────────
  let anthropicData;
  try {
    anthropicData = await anthropicRes.json();
  } catch {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: "Anthropic returned non-JSON response.", status: anthropicRes.status }),
    };
  }

  if (!anthropicRes.ok) {
    return {
      statusCode: anthropicRes.status,
      headers,
      body: JSON.stringify({
        error: "Anthropic API error.",
        detail: anthropicData?.error?.message || JSON.stringify(anthropicData),
      }),
    };
  }

  const rawText = anthropicData?.content?.[0]?.text || "";

  // Strip possible markdown fences
  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Claude returned non-parseable JSON.",
        raw: cleaned.slice(0, 500),
      }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, data: parsed }),
  };
};
