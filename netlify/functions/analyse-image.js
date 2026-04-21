/**
 * netlify/functions/analyse-image.js
 * Uses Claude Vision to identify Chinese characters in an image
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

  const { image, mediaType = 'image/jpeg' } = body;
  if (!image) return { statusCode:400, headers, body: JSON.stringify({ error:'No image provided' }) };

  const prompt = `You are a Chinese character recognition expert. Analyse this image and identify all Chinese characters (汉字) you can see.

For each character found, provide:
- character: the exact Chinese character
- pinyin: pronunciation with tone marks (e.g. rì)
- meaning: English meaning
- confidence: high/medium/low

Return ONLY a JSON object in this exact format, nothing else:
{
  "characters": [
    {"character": "日", "pinyin": "rì", "meaning": "sun / day", "confidence": "high"},
    {"character": "月", "pinyin": "yuè", "meaning": "moon", "confidence": "high"}
  ],
  "context": "brief description of what's in the image"
}

If no Chinese characters are found, return: {"characters": [], "context": "no Chinese characters found"}`;

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
        messages: [{
          role: 'user',
          content: [
            { type:'image', source:{ type:'base64', media_type:mediaType, data:image } },
            { type:'text', text:prompt },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode:502, headers, body: JSON.stringify({ error:`Claude API error: ${err}` }) };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g,'').trim();
    
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { return { statusCode:422, headers, body: JSON.stringify({ error:'Could not parse response', raw:text.slice(0,200) }) }; }

    return { statusCode:200, headers, body: JSON.stringify(parsed) };
  } catch(err) {
    return { statusCode:500, headers, body: JSON.stringify({ error:err.message }) };
  }
};
