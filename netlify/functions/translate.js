/**
 * netlify/functions/translate.js
 * Translation between Chinese, English and Italian using Claude
 */
exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin':'*', 'Content-Type':'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers, body:'' };
  if (event.httpMethod !== 'POST') return { statusCode:405, headers, body:'Method Not Allowed' };

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return { statusCode:500, headers, body: JSON.stringify({ error:'API key not configured' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode:400, headers, body: JSON.stringify({ error:'Invalid JSON' }) }; }

  const { text, from = 'zh', to = 'en' } = body;
  if (!text?.trim()) return { statusCode:400, headers, body: JSON.stringify({ error:'No text provided' }) };

  const LANG_NAMES = { zh:'Chinese (Mandarin)', en:'English', it:'Italian' };

  const prompt = `Translate the following text from ${LANG_NAMES[from] || from} to ${LANG_NAMES[to] || to}.

Return ONLY the translation, nothing else. No explanations, no original text, just the translation.

Text to translate:
${text}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role:'user', content:prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode:502, headers, body: JSON.stringify({ error:`Claude API error: ${err}` }) };
    }

    const data = await response.json();
    const translation = data.content?.[0]?.text?.trim() || '';
    return { statusCode:200, headers, body: JSON.stringify({ translation, from, to }) };
  } catch(err) {
    return { statusCode:500, headers, body: JSON.stringify({ error:err.message }) };
  }
};
