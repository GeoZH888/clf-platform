// netlify/functions/generate-grammar-points.js
//
// Netlify Function — multi-provider AI dispatcher for the CLF
// GrammarPointBatchPanel. Keeps API keys server-side.
//
// Required env vars (set in Netlify dashboard → Site settings → Environment variables,
// or via CLI: `netlify env:set ANTHROPIC_API_KEY sk-ant-...`):
//   ANTHROPIC_API_KEY   — for Claude
//   OPENAI_API_KEY      — for GPT-4o
//   DEEPSEEK_API_KEY    — for DeepSeek
//
// Requires Node 18+ on Netlify (native fetch). Default for new Netlify sites.

// ─── provider implementations ──────────────────────────────────────────────
async function callClaude(prompt, model) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-6",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Claude API ${r.status}: ${err}`);
  }
  const data = await r.json();
  return data?.content?.[0]?.text || "";
}

async function callOpenAI(prompt, model) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`OpenAI API ${r.status}: ${err}`);
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function callDeepSeek(prompt, model) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY not set");

  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model || "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`DeepSeek API ${r.status}: ${err}`);
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content || "";
}

// ─── handler ────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  // Same-origin in Netlify, but keep CORS for safety
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "content-type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { prompt, provider = "claude", model } = JSON.parse(event.body || "{}");
    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "prompt is required" }),
      };
    }

    let text;
    switch (provider) {
      case "claude":
      case "claude-opus":
        text = await callClaude(prompt, model);
        break;
      case "gpt-4o":
        text = await callOpenAI(prompt, model);
        break;
      case "deepseek":
        text = await callDeepSeek(prompt, model);
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown provider: ${provider}` }),
        };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ text }) };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
    };
  }
};
