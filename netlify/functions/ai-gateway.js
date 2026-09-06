// netlify/functions/ai-gateway.js
// Supports: fill, translate, generate_image, analyse_image, auto_populate
// Providers: claude, deepseek, openai, gemini

import { tracked } from './_aiTelemetry.js';

// The action being served, so callAI can label the row without every handler
// having to thread it through. One Lambda invocation serves one request, so a
// module-scoped value is request-scoped in practice.
let currentAction = null;

// Anthropic returns token counts alongside the text; callClaude stashes them
// here so callAI can record them without changing what it returns.
let lastUsage = null;

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { action, provider = "claude", client_key, ...rest } = payload;
  // Allow admin to pass their own API key from browser localStorage
  if (client_key) rest._client_key = client_key;

  // ── Back-compat: tabs that send only {prompt, max_tokens} without action
  // (e.g. older ChengyuAdminTab, WordsAdminTab batch-generate flows)
  const effectiveAction = action || (rest.prompt ? "generate_text" : null);
  if (!effectiveAction) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Missing 'action' or 'prompt' in request body.",
        hint: "Pass either an action like 'fill' or a raw 'prompt' field.",
      }),
    };
  }

  currentAction = effectiveAction;
  try {
    switch (effectiveAction) {
      case "fill":
        return await handleFill(rest, provider, headers);
      case "translate":
        return await handleTranslate(rest, provider, headers);
      case "generate_image":
        return await handleGenerateImage(rest, provider, headers);
      case "analyse_image":
        return await handleAnalyseImage(rest, headers);
      case "auto_populate":
        return await handleAutoPopulate(rest, provider, headers);
      case "generate_words":
        return await handleGenerateWords(rest, provider, headers);
      case "generate_text":
        return await handleGenerateText(rest, provider, headers);
      case "generate_word_image":
        return await handleGenerateWordImage(rest, provider, headers);
      case "chat":
        return await handleChat(rest, provider, headers);
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown action: "${effectiveAction}". Valid actions: fill, translate, generate_image, analyse_image, auto_populate, generate_words, generate_text, generate_word_image, chat` }),
        };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

// ── ROBUST JSON EXTRACTOR ─────────────────────────────────────────────────────
// Handles: markdown fences, trailing text, unescaped quotes in values
function extractJSON(raw) {
  // 1. Strip markdown fences
  let text = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

  // 2. Try direct parse first
  try { return JSON.parse(text); } catch (_) {}

  // 3. Extract first {...} or [...] block
  const objMatch = text.match(/(\{[\s\S]*\})/);
  const arrMatch = text.match(/(\[[\s\S]*\])/);
  const match = objMatch || arrMatch;
  if (match) {
    try { return JSON.parse(match[1]); } catch (_) {}
  }

  // 4. Last resort: sanitize by replacing unescaped inner quotes in string values
  const sanitized = text.replace(/"([^"\\]*)"/g, (_, content) =>
    `"${content.replace(/"/g, '\\"')}"`
  );
  try { return JSON.parse(sanitized); } catch (_) {}

  throw new Error(`Could not parse AI response as JSON. Raw (first 300 chars): ${raw.slice(0, 300)}`);
}

// ── FILL ──────────────────────────────────────────────────────────────────────
async function handleFill({ character, fields = [] }, provider, headers) {
  if (!character) return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing: character" }) };

  const prompt = `You are an expert in oracle bone script (大卫学中文) and Classical Chinese etymology.
Fill in ALL fields for the character: "${character}"

CRITICAL: Use ONLY Simplified Chinese (简体字) in all Chinese fields. Never use Traditional Chinese.

CRITICAL: Return ONLY a valid JSON object. Use double quotes for all strings.
Do NOT use quotes inside string values — rephrase instead.
Do NOT include any text before or after the JSON.

Keys required:
{
  "pinyin": "romanization with tone marks e.g. ri4",
  "meaning_zh": "meaning in Simplified Chinese 1-2 sentences",
  "meaning_en": "meaning in English 1-2 sentences",
  "meaning_it": "meaning in Italian 1-2 sentences",
  "stroke_count": <integer>,
  "radical": "radical character",
  "mnemonic_zh": "vivid memory hook in Chinese 1 sentence no inner quotes",
  "mnemonic_en": "vivid memory hook in English 1 sentence no inner quotes",
  "mnemonic_it": "vivid memory hook in Italian 1 sentence no inner quotes",
  "etymology": "oracle bone etymology in English 2-3 sentences no inner quotes",
  "example_word_zh": "a 2-character compound",
  "example_word_en": "English gloss of the compound",
  "difficulty": <integer 1-5>
}

Only the JSON object. No markdown, no backticks, no explanation.`;

  const text = await callAI(provider, prompt);
  const parsed = extractJSON(text);
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: parsed }) };
}

// ── AUTO POPULATE ─────────────────────────────────────────────────────────────
// Generates a batch of oracle bone characters ordered by difficulty (1→5)
async function handleAutoPopulate({ count = 5, difficulty_from = 1, difficulty_to = 5, category = "all", exclude = [] }, provider, headers) {
  const categoryNote = category !== "all" ? `Focus on characters in the category: ${category}.` : "";
  const excludeNote  = exclude.length > 0 ? `Do NOT include any of these characters (already generated): ${exclude.join(" ")}` : "";

  const prompt = `You are an expert in oracle bone script (大卫学中文) and Classical Chinese.

CRITICAL: Use ONLY Simplified Chinese characters (简体字) — never Traditional Chinese (繁体字).
For example: use 鸟 NOT 鳥, use 龟 NOT 龜, use 马 NOT 馬, use 鱼 NOT 魚.

Generate a list of ${count} oracle bone script characters, ordered from difficulty ${difficulty_from} (simplest) to ${difficulty_to} (most complex).
${categoryNote}
${excludeNote}
Choose characters that are:
- Pedagogically valuable for learners
- Visually interesting in oracle bone form
- Spread across difficulty levels ${difficulty_from} to ${difficulty_to}
- Include basic radicals and common pictographs at lower levels
- Include compound/complex characters at higher levels

Return ONLY a valid JSON array of objects, each with:
{
  "character": "简体汉字 (SIMPLIFIED only)",
  "pinyin": "tone-marked romanization",
  "meaning_en": "English meaning (1 sentence)",
  "meaning_zh": "Chinese meaning in simplified Chinese (1 sentence)",
  "meaning_it": "Italian meaning (1 sentence)",
  "stroke_count": <integer — stroke count of the SIMPLIFIED form>,
  "radical": "radical in simplified form",
  "mnemonic_en": "vivid English memory hook",
  "mnemonic_zh": "vivid Chinese memory hook in simplified Chinese",
  "mnemonic_it": "vivid Italian memory hook",
  "etymology": "oracle bone etymology (2 sentences)",
  "example_word_zh": "2-char compound in simplified Chinese",
  "example_word_en": "English gloss",
  "difficulty": <integer ${difficulty_from}-${difficulty_to}>,
  "category": "one of: nature, body, animals, numbers, actions, objects, people, time, places"
}

No markdown, no backticks. Only the JSON array.`;

  const text = await callAI(provider, prompt, 2000);
  const parsed = extractJSON(text);
  const characters = Array.isArray(parsed) ? parsed : [parsed];
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, characters, count: characters.length }) };
}

// ── TRANSLATE ─────────────────────────────────────────────────────────────────
async function handleTranslate({ text, from = "zh", to = "en" }, provider, headers) {
  const prompt = `Translate from ${from} to ${to}. Return only the translated text.\n\n${text}`;
  const translation = await callAI(provider, prompt);
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, translation: translation.trim() }) };
}

// ── GENERATE IMAGE ────────────────────────────────────────────────────────────
async function handleGenerateImage({ character, prompt, style, _client_key }, provider, headers) {
  // Use provided prompt directly, or build one from character
  const finalPrompt = prompt || `Illustration for Chinese character "${character}". ${style || 'Clean educational illustration style'}.`;

  // ── OpenAI DALL-E ──────────────────────────────────────────────────────────
  if (provider === 'openai') {
    const key = _client_key || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OpenAI key not set — add it in Admin → API Keys tab.');

    // Try gpt-image-1 first, fallback to dall-e-3
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'dall-e-3', prompt: finalPrompt, n: 1, size: '1024x1024', quality: 'standard' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `DALL-E error ${res.status}`);
      const url = data.data?.[0]?.url;
      if (!url) throw new Error('DALL-E returned no URL');
      return { statusCode: 200, headers, body: JSON.stringify({ url }) };
    } catch(e) {
      throw new Error(`OpenAI image error: ${e.message}`);
    }
  }

  // ── Stability AI ──────────────────────────────────────────────────────────
  if (provider === 'stability') {
    const key = _client_key || process.env.STABILITY_API_KEY;
    if (!key) throw new Error('Stability AI key not set — add it in Admin → API Keys tab (Stability AI row).');

    // Try v2beta
    try {
      const form = new FormData();
      form.append('prompt', finalPrompt);
      form.append('negative_prompt', 'blurry, low quality, text, watermark, ugly');
      form.append('aspect_ratio', '1:1');
      form.append('output_format', 'png');

      const res2 = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, Accept: 'image/*' },
        body: form,
      });

      if (res2.ok) {
        const buf = await res2.arrayBuffer();
        if (buf.byteLength === 0) throw new Error('v2beta returned empty image');
        const base64 = Buffer.from(buf).toString('base64');
        return { statusCode: 200, headers, body: JSON.stringify({ base64 }) };
      }
      const errText = await res2.text();
      if (res2.status === 402 || res2.status === 403) {
        throw new Error(`Stability auth error ${res2.status} — check key has credits: ${errText.slice(0,200)}`);
      }
      console.log(`Stability v2beta ${res2.status}: ${errText.slice(0,200)}`);
    } catch(e) {
      if (e.message.includes('Stability auth')) throw e;
    }

    // Fallback to v1 SDXL
    const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        text_prompts: [{ text: finalPrompt, weight: 1 }],
        cfg_scale: 7, height: 1024, width: 1024, steps: 30, samples: 1,
      }),
    });
    const v1Text = await res.text();
    let data;
    try { data = JSON.parse(v1Text); } catch { throw new Error(`Stability v1 non-JSON (${res.status}): ${v1Text.slice(0,200)}`); }
    if (!res.ok) throw new Error(`Stability v1 error ${res.status}: ${data.message || v1Text.slice(0,200)}`);
    const b64 = data.artifacts?.[0]?.base64;
    if (!b64) throw new Error(`Stability v1 no base64. Response keys: ${Object.keys(data).join(', ')}`);
    return { statusCode: 200, headers, body: JSON.stringify({ base64: b64 }) };
  }

  // ── Ideogram ──────────────────────────────────────────────────────────────
  if (provider === 'ideogram') {
    const key = _client_key || process.env.IDEOGRAM_API_KEY;
    if (!key) throw new Error('Ideogram key not set — add it in Admin → API Keys tab.');

    const STYLE_MAP = {
      ink:'DESIGN', cartoon:'ANIME', oil:'REALISTIC',
      woodblock:'DESIGN', minimal:'DESIGN', manga:'ANIME',
    };
    const ideogramStyle = STYLE_MAP[style] || 'GENERAL';

    // 20s abort so we don't hit Netlify's 26s hard limit silently
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      // Try V_2_TURBO first (faster, ~8-12s)
      const res = await fetch('https://api.ideogram.ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Api-Key': key },
        signal: controller.signal,
        body: JSON.stringify({
          image_request: {
            prompt: finalPrompt,
            model: 'V_2_TURBO',
            aspect_ratio: 'ASPECT_1_1',
            style_type: ideogramStyle,
          },
        }),
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok) {
        // Fall through to V_2 on certain errors
        if (res.status !== 400) {
          throw new Error(`Ideogram error ${res.status}: ${JSON.stringify(data).slice(0,300)}`);
        }
        console.log('Ideogram V_2_TURBO failed, trying V_2:', data);
        // Retry with V_2
        const res2 = await fetch('https://api.ideogram.ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Api-Key': key },
          body: JSON.stringify({
            image_request: {
              prompt: finalPrompt,
              model: 'V_2',
              aspect_ratio: 'ASPECT_1_1',
              style_type: ideogramStyle,
            },
          }),
        });
        const data2 = await res2.json();
        if (!res2.ok) throw new Error(`Ideogram V_2 error ${res2.status}: ${JSON.stringify(data2).slice(0,300)}`);
        const url2 = data2.data?.[0]?.url;
        if (!url2) throw new Error(`Ideogram V_2 no URL in response`);
        return { statusCode:200, headers, body: JSON.stringify({ url: url2 }) };
      }

      const url = data.data?.[0]?.url;
      if (!url) throw new Error(`Ideogram no URL. Keys: ${Object.keys(data).join(', ')}`);
      return { statusCode: 200, headers, body: JSON.stringify({ url }) };

    } catch(e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        throw new Error('Ideogram timed out (>20s) — try Stability AI or DALL-E instead');
      }
      throw e;
    }
  }

  throw new Error(`Unknown image provider: "${provider}". Use: openai, stability, ideogram`);
}

// ── ANALYSE IMAGE ─────────────────────────────────────────────────────────────
async function handleAnalyseImage({ imageBase64, mediaType = "image/jpeg" }, headers) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-opus-5",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: 'Identify the Chinese character shown. Return JSON only: {"character":"","pinyin":"","confidence":0.9,"notes":""}' },
        ],
      }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
  const text = claudeText(data).replace(/```json|```/g, "").trim();
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: JSON.parse(text) }) };
}

// ── AI ROUTER ─────────────────────────────────────────────────────────────────
// Routes text prompts to the selected AI provider
async function callAI(provider, prompt, maxTokens = 1500) {
  const p = provider || "claude";
  lastUsage = null;
  // Wrapped here rather than in each provider function: this is the one place
  // every text generation passes through, so instrumenting it cannot be
  // bypassed by adding a provider later.
  return tracked(
    { feature: "ai_gateway", action: currentAction, provider: p,
      model: p === "claude" ? "claude-opus-5" : null },
    () => {
      switch (p) {
        case "deepseek": return callDeepSeek(prompt, maxTokens);
        case "openai":   return callOpenAI(prompt, maxTokens);
        case "gemini":   return callGemini(prompt, maxTokens);
        case "claude":
        default:         return callClaude(prompt, maxTokens);
      }
    },
    // An empty completion is a success by HTTP and a failure by every measure
    // that matters — recording output tokens is what makes it visible.
    () => ({ input: lastUsage?.input_tokens ?? null,
             output: lastUsage?.output_tokens ?? null }),
  );
}

// ── Claude ────────────────────────────────────────────────────────────────────
// A reply is an ARRAY of content blocks, and a reasoning model puts a thinking
// block first. Reading content[0].text therefore yields undefined and the reply
// looks empty — the caller then reports "could not parse AI response" with a
// blank Raw, which points at the prompt instead of at this line.
// Join every text block, and make a genuinely empty reply say why.
function claudeText(data) {
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks
    .filter(b => b?.type === "text")
    .map(b => b.text || "")
    .join("")
    .trim();
  if (text) return text;

  const reason = data?.stop_reason || "unknown";
  if (reason === "max_tokens") {
    throw new Error(
      "Claude reached max_tokens before emitting any text. Raise max_tokens, or ask for less in one call."
    );
  }
  throw new Error(
    `Claude returned no text block (stop_reason: ${reason}, blocks: ${
      blocks.map(b => b?.type).join(",") || "none"
    }).`
  );
}

async function callClaude(prompt, maxTokens = 1500) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set in Netlify env vars.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-opus-5", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
  lastUsage = data?.usage || null;
  return claudeText(data);
}

// ── DeepSeek ──────────────────────────────────────────────────────────────────
async function callDeepSeek(prompt, maxTokens = 1500) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY not set in Netlify env vars.");
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `DeepSeek HTTP ${res.status}`);
  return data.choices?.[0]?.message?.content || "";
}

// ── OpenAI ────────────────────────────────────────────────────────────────────
async function callOpenAI(prompt, maxTokens = 1500) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set in Netlify env vars.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
  return data.choices?.[0]?.message?.content || "";
}

// ── Gemini ────────────────────────────────────────────────────────────────────
async function callGemini(prompt, maxTokens = 1500) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set in Netlify env vars.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini HTTP ${res.status}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ── Generate Words ────────────────────────────────────────────────────────────
async function handleGenerateWords({ theme, count = 10, exclude = [], hsk_level = 1 }, provider, headers) {
  const excludeStr = exclude.length
    ? `Do NOT include any of these words: ${exclude.slice(0, 50).join(', ')}`
    : '';
  const hskDesc = ['','beginner (HSK1, 150 most common words)','elementary (HSK2, basic daily life)','pre-intermediate (HSK3)','intermediate (HSK4)','upper-intermediate (HSK5)','advanced (HSK6)'][hsk_level] || 'beginner';

  const prompt = `Generate ${count} useful Chinese vocabulary words/phrases for the theme: "${theme}".
Level: ${hskDesc} (HSK level ${hsk_level}).
${excludeStr}

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "word_zh": "你好",
    "pinyin": "nǐ hǎo",
    "meaning_en": "Hello",
    "meaning_it": "Ciao",
    "meaning_zh": "打招呼用语",
    "example_zh": "你好，我叫大卫。",
    "example_en": "Hello, my name is David.",
    "example_it": "Ciao, mi chiamo David.",
    "hsk_level": ${hsk_level},
    "difficulty": 1
  }
]

Rules:
- Simplified Chinese only
- Tone-marked pinyin (ā á ǎ à etc.)
- Italian translations required
- Match HSK ${hsk_level} vocabulary level
- Practical everyday vocabulary
- No duplicates`;

  const raw = await callClaude(prompt, 2000);
  const words = extractJSON(raw);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ words: Array.isArray(words) ? words : [] }),
  };
}

// ── Generate Word Image ───────────────────────────────────────────────────────
async function handleGenerateWordImage({ word_zh, meaning_en, provider: imgProvider, _client_key }, provider, headers) {
  const useProvider = imgProvider || provider || 'openai';
  const apiKey = _client_key || process.env.OPENAI_API_KEY || process.env.STABILITY_API_KEY;

  // Build a pedagogically styled prompt
  const prompt = `Flat vector illustration for Chinese language learning. 
Topic: "${meaning_en}" (Chinese: ${word_zh}).
Style: clean flat cartoon, warm pastel colors, white background, 
simple bold shapes, friendly and child-appropriate, 
inspired by Chinese educational books, 
similar to Chinese elementary school textbook illustrations.
No text, no letters, no Chinese characters in the image.
Single clear focal object or scene representing "${meaning_en}".
Colorful, cheerful, minimalist, high contrast edges.`;

  if (useProvider === 'openai' || useProvider === 'dalle') {
    const key = _client_key || process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OpenAI API key not set. Add it in Admin → API Keys.');

    // For panda generation, use gpt-image-1 which supports transparent backgrounds
    const isPanda = prompt.includes('panda mascot');
    
    if (isPanda) {
      // Use gpt-image-1 with transparent background
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: prompt + ' IMPORTANT: completely transparent background, no background at all, PNG with alpha channel',
          n: 1,
          size: '1024x1024',
          output_format: 'png',
          background: 'transparent',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Fallback to dall-e-3 with stronger prompt
        const res2 = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: prompt + '. CRITICAL: pure white background #FFFFFF only, absolutely no grey, no shadow, no gradient background whatsoever',
            n: 1,
            size: '1024x1024',
            quality: 'standard',
          }),
        });
        const data2 = await res2.json();
        if (!res2.ok) throw new Error(data2.error?.message || 'DALL-E failed');
        return { statusCode: 200, headers, body: JSON.stringify({ url: data2.data[0].url }) };
      }
      // gpt-image-1 returns base64
      const b64 = data.data?.[0]?.b64_json;
      if (b64) return { statusCode: 200, headers, body: JSON.stringify({ base64: b64 }) };
      if (data.data?.[0]?.url) return { statusCode: 200, headers, body: JSON.stringify({ url: data.data[0].url }) };
      throw new Error('No image in response');
    }

    // Standard DALL-E 3 for word images
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'DALL-E failed');
    return { statusCode: 200, headers, body: JSON.stringify({ url: data.data[0].url }) };
  }

  if (useProvider === 'stability') {
    const key = _client_key || process.env.STABILITY_API_KEY;
    if (!key) throw new Error('Stability AI key not set — add it in Admin → API Keys tab (Stability AI row).');

    // Try v2beta first (current Stability AI API)
    try {
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('negative_prompt', 'blurry, low quality, text, watermark, ugly');
      form.append('aspect_ratio', '1:1');
      form.append('output_format', 'png');

      const res2 = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, Accept: 'image/*' },
        body: form,
      });

      if (res2.ok) {
        const buf = await res2.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        return { statusCode: 200, headers, body: JSON.stringify({ base64: b64 }) };
      }
      // Auth errors — no point retrying
      if (res2.status === 402 || res2.status === 403) {
        const e = await res2.text();
        throw new Error(`Stability auth error ${res2.status}: ${e.slice(0,200)}`);
      }
    } catch(e) {
      if (e.message.includes('Stability auth')) throw e;
      // Otherwise fall through to v1
    }

    // Fallback: v1 SDXL
    const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt, weight: 1 }],
        cfg_scale: 7, height: 1024, width: 1024, steps: 30, samples: 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Stability v1 error ${res.status}`);
    const b64 = data.artifacts?.[0]?.base64;
    if (!b64) throw new Error('Stability returned no image data');
    return { statusCode: 200, headers, body: JSON.stringify({ base64: b64 }) };
  }

  if (useProvider === 'ideogram') {
    const key = _client_key || process.env.IDEOGRAM_API_KEY;
    if (!key) throw new Error('Ideogram key not set. Add it in Admin → API Keys.');

    const res = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': key },
      body: JSON.stringify({
        image_request: {
          prompt,
          model: 'V_2',
          aspect_ratio: 'ASPECT_1_1',
          style_type: 'ILLUSTRATION',
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ideogram failed');
    return { statusCode: 200, headers, body: JSON.stringify({ url: data.data[0].url }) };
  }

  throw new Error(`Unknown image provider: ${useProvider}. Use: openai, stability, ideogram`);
}

// ── Generate text (free-form prompt) ─────────────────────────────
async function handleGenerateText({ prompt, max_tokens = 1500 }, provider, headers) {
  if (!prompt) throw new Error('Missing: prompt');
  // Honour the caller's provider — this used to hardcode Claude, which made
  // the provider selector in every admin tab a no-op.
  const raw = await callAI(provider, prompt, max_tokens);
  // Return result/content/text as aliases so any consumer shape works
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ result: raw, content: raw, text: raw }),
  };
}

// ── Chat (智能对话) ────────────────────────────────────────────────
// The tutor chatbot. The one action here that is a CONVERSATION rather than a
// single instruction, so it is the only one that sends a message array.
//
// Every reply carries four things, because a wall of Chinese a beginner cannot
// read is not practice — it is a wall:
//   reply        the tutor's Chinese, at the learner's level
//   pinyin       tone-marked, so it can be sounded out
//   translation  in the learner's own language, hidden behind a toggle
//   correction   a note on the learner's last message, or null
//
// Limits are not politeness: this endpoint is unauthenticated (as the whole
// gateway is), so an unbounded history would let anyone bill an arbitrary
// prompt to our Anthropic key by pasting a novel into it.
const CHAT_MAX_TURNS    = 20;    // history kept; older turns are dropped
const CHAT_MAX_CHARS    = 500;   // per message
const CHAT_MAX_TOKENS   = 700;

const HSK_GUIDANCE = {
  1: 'HSK 1 (about 150 words). Very short sentences. Present tense. No idioms.',
  2: 'HSK 2 (about 300 words). Short sentences, one clause each.',
  3: 'HSK 3 (about 600 words). Simple connectives are fine.',
  4: 'HSK 4 (about 1200 words). Ordinary everyday register.',
  5: 'HSK 5 (about 2500 words). Some 成语 are fine if common.',
  6: 'HSK 6 (about 5000 words). Natural adult Chinese.',
};

const UI_LANG_NAME = { en: 'English', it: 'Italian', zh: 'Chinese' };

function buildChatSystem(hskLevel, uiLang, topic) {
  const level = HSK_GUIDANCE[hskLevel] || HSK_GUIDANCE[2];
  const lang  = UI_LANG_NAME[uiLang] || 'English';

  return `You are a warm, patient Chinese conversation tutor for a learner studying Simplified Chinese.

VOCABULARY CEILING: ${level}
Stay at or below this level. If you need a harder word, use it once and explain it in the translation.

YOUR FIRST JOB IS TO ANSWER WHAT THE LEARNER JUST SAID.
Read their last message and reply to its actual content — the specific thing
they told you, asked, or wanted. Examples of what that means:
- They say they are happy -> ask what happened, do not greet them.
- They name a food they like -> talk about that food.
- They tell you their name -> use it, and never ask for it again.
Never ask for something the learner has already told you. Never open with a
greeting or introduce yourself unless their message is itself only a greeting.
A reply that would make equal sense as an answer to any other message is wrong.

HOW TO REPLY
- Reply ONLY in Simplified Chinese (简体字). Never Traditional.
- One to three short sentences. Shorter is better.
- End with a question that follows from what they said, so the conversation
  goes somewhere. Not a generic opener.
- Follow the learner's subject. Do not change it for them.
- If you genuinely cannot tell what they meant, ask about the specific part you
  did not understand. Never say you did not understand a sentence that is
  ordinary, correct Chinese.
${topic ? `- Today's topic: ${topic}` : ''}

CORRECTING
- If the learner's last message has a mistake in their Chinese, put a short, kind note in "correction", written in ${lang}, naming what to say instead.
- One correction at a time — the most important one. Ignore small typos.
- If their Chinese was fine, or they wrote in ${lang}, set "correction" to null. Do not invent mistakes to seem useful.
- Never refuse to talk because their Chinese is imperfect. Answer the person, then correct.

OUTPUT
Return ONLY a JSON object, no markdown fence, no text around it:
{"reply":"<Chinese>","pinyin":"<tone-marked pinyin of reply>","translation":"<reply in ${lang}>","correction":<string or null>}
Use double quotes. Do not put quote characters inside any value.`;
}

// Claude takes a real system parameter and a real message array. Flattening a
// conversation into one string works, but the model then has to infer who said
// what, and it starts answering its own earlier turns.
async function callClaudeChat(system, messages) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set in Netlify env vars.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-opus-5",
      max_tokens: CHAT_MAX_TOKENS,
      system,
      messages,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
  lastUsage = data?.usage || null;
  return claudeText(data);
}

// Providers other than Claude go through the existing single-prompt path, with
// the conversation transcribed into the prompt. Lower fidelity, but it means
// the provider selector is not a lie for the other three.
function flattenChat(system, messages) {
  const turns = messages
    .map(m => `${m.role === 'assistant' ? 'Tutor' : 'Learner'}: ${m.content}`)
    .join('\n');
  return `${system}\n\n--- Conversation so far ---\n${turns}\n\nTutor (reply as the JSON object described above):`;
}

async function handleChat({ messages = [], hsk_level = 2, ui_lang = 'en', topic = null }, provider, headers) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing: messages' }) };
  }

  // Normalise before anything else. Whatever the client sent, what reaches the
  // provider is a clean array of short strings with no extra keys.
  const clean = messages
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .slice(-CHAT_MAX_TURNS)
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.trim().slice(0, CHAT_MAX_CHARS),
    }));

  // Anthropic rejects a history that opens on an assistant turn, which is
  // exactly what slicing the last N messages can produce mid-conversation.
  while (clean.length && clean[0].role === 'assistant') clean.shift();
  if (!clean.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Conversation must start with a learner message' }) };
  }

  const lvl    = Number(hsk_level);
  const level  = lvl >= 1 && lvl <= 6 ? lvl : 2;
  const lang   = ['en', 'it', 'zh'].includes(ui_lang) ? ui_lang : 'en';
  const system = buildChatSystem(level, lang, typeof topic === 'string' ? topic.slice(0, 100) : null);

  const p = provider || 'claude';
  lastUsage = null;
  const raw = await tracked(
    { feature: 'chat', action: 'chat', provider: p,
      model: p === 'claude' ? 'claude-opus-5' : null },
    () => p === 'claude'
      ? callClaudeChat(system, clean)
      : callAI(p, flattenChat(system, clean), CHAT_MAX_TOKENS),
    () => ({ input: lastUsage?.input_tokens ?? null,
             output: lastUsage?.output_tokens ?? null }),
  );

  // A malformed reply must not become an error page. The learner asked a
  // question and there is Chinese in `raw`; showing it without pinyin beats
  // showing "could not parse AI response", which is the failure that already
  // cost this project a day.
  let parsed;
  try {
    parsed = extractJSON(raw);
  } catch {
    parsed = { reply: raw, pinyin: '', translation: '', correction: null };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      reply:       String(parsed.reply || raw || '').trim(),
      pinyin:      String(parsed.pinyin || '').trim(),
      translation: String(parsed.translation || '').trim(),
      correction:  parsed.correction ? String(parsed.correction).trim() : null,
    }),
  };
}
