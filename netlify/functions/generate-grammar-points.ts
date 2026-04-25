// supabase/functions/generate-grammar-points/index.ts
//
// Supabase Edge Function — multi-provider AI dispatcher for the CLF
// GrammarPointBatchPanel. Keeps API keys server-side.
//
// Deploy:
//   supabase functions deploy generate-grammar-points
//
// Required secrets (set with `supabase secrets set ...`):
//   ANTHROPIC_API_KEY   — for Claude
//   OPENAI_API_KEY      — for GPT-4o
//   DEEPSEEK_API_KEY    — for DeepSeek

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

// ─── provider implementations ──────────────────────────────────────────────
async function callClaude(prompt: string, model: string): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
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

async function callOpenAI(prompt: string, model: string): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
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

async function callDeepSeek(prompt: string, model: string): Promise<string> {
  const key = Deno.env.get("DEEPSEEK_API_KEY");
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

// ─── dispatcher ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")
    return json({ error: "Method not allowed" }, 405);

  try {
    const { prompt, provider = "claude", model } = await req.json();
    if (!prompt) return json({ error: "prompt is required" }, 400);

    let text: string;
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
        return json({ error: `Unknown provider: ${provider}` }, 400);
    }

    return json({ text });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
