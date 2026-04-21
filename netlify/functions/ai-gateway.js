// netlify/functions/ai-gateway.js
// Supports: fill, translate, generate_image, analyse_image, auto_populate
// Providers: claude, deepseek, openai, gemini

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
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown action: "${effectiveAction}". Valid actions: fill, translate, generate_image, analyse_image, auto_populate, generate_words, generate_text, generate_word_image` }),
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
      model: "claude-sonnet-4-20250514",
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
  const text = (data.content?.[0]?.text || "").replace(/```json|```/g, "").trim();
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: JSON.parse(text) }) };
}

// ── AI ROUTER ─────────────────────────────────────────────────────────────────
// Routes text prompts to the selected AI provider
async function callAI(provider, prompt, maxTokens = 1500) {
  switch (provider) {
    case "deepseek":
      return callDeepSeek(prompt, maxTokens);
    case "openai":
      return callOpenAI(prompt, maxTokens);
    case "gemini":
      return callGemini(prompt, maxTokens);
    case "claude":
    default:
      return callClaude(prompt, maxTokens);
  }
}

// ── Claude ────────────────────────────────────────────────────────────────────
async function callClaude(prompt, maxTokens = 1500) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set in Netlify env vars.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
  return data.content?.[0]?.text || "";
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
  const raw = await callClaude(prompt, max_tokens);
  // Return result/content/text as aliases so any consumer shape works
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ result: raw, content: raw, text: raw }),
  };
}
