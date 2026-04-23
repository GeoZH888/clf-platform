// netlify/functions/word-to-clf.js
// Takes input text in any language (EN/IT/ZH/FR/DE/ES) → translates to
// Chinese and breaks down each character with etymology, pinyin, strokes.
// Uses server-side ANTHROPIC_API_KEY (no client key needed).
//
// Called by MyWordScreen.jsx.

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, headers,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in Netlify env.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON.' }) };
  }

  const text = (body.text || '').trim();
  if (!text) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing "text" in request.' }) };
  }
  if (text.length > 40) {
    return { statusCode: 400, headers,
      body: JSON.stringify({ error: '输入太长，请限制在 40 字以内' }) };
  }

  // Ask Claude for translation + per-character breakdown
  const prompt = `You are a Chinese-language tutor. Given this input word or phrase:

"${text}"

Translate it to simplified Chinese and give per-character details.

Return ONLY valid JSON (no markdown, no explanation), matching this exact shape:

{
  "inputText": "${text.replace(/"/g, '\\"')}",
  "chineseText": "<the Chinese translation>",
  "pinyin": "<pinyin with tone marks>",
  "meaning": "<short English explanation, one phrase>",
  "characters": [
    {
      "character": "<single Chinese char>",
      "pinyin": "<pinyin with tone marks>",
      "strokes": <number of strokes, integer>,
      "meaning_en": "<short English gloss>",
      "meaning_zh": "<Chinese meaning>",
      "meaning_it": "<short Italian gloss>",
      "etymology": "<brief etymology, ~15 chars, in Chinese>",
      "tips": "<optional learner tip, or null>"
    }
  ]
}

Rules:
- If input is already Chinese, just break it down (chineseText = inputText).
- If input is a single word, chineseText is usually 1-3 characters.
- "characters" must contain one entry per Chinese character in chineseText.
- Skip punctuation characters.
- Use simplified Chinese, not traditional.
- Use actual stroke count (not radical count).
- Keep etymology under 20 Chinese characters.
- If tips are not illuminating, set to null instead of empty string.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const text_resp = await resp.text();
    if (!resp.ok) {
      return { statusCode: 502, headers,
        body: JSON.stringify({ error: `Claude API ${resp.status}: ${text_resp.slice(0, 200)}` }) };
    }

    const data = JSON.parse(text_resp);
    const raw = data?.content?.[0]?.text || '';

    // Robust JSON extraction (matches ai-gateway pattern)
    let parsed;
    let cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/(\{[\s\S]*\})/);
      if (!m) throw new Error('No JSON object in Claude response');
      parsed = JSON.parse(m[1]);
    }

    // Validate shape
    if (!parsed.chineseText || !Array.isArray(parsed.characters)) {
      return { statusCode: 502, headers,
        body: JSON.stringify({ error: 'Unexpected response shape from Claude',
                               raw: raw.slice(0, 500) }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify(parsed) };
  } catch (err) {
    return { statusCode: 500, headers,
      body: JSON.stringify({ error: 'Translation failed: ' + err.message }) };
  }
};
