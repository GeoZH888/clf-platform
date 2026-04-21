/**
 * netlify/functions/voice-to-char.js
 * User says something in any language → find the matching Chinese character
 * e.g. "sun" / "sole" / "太阳" → 日
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

  const { text } = body;
  if (!text?.trim()) return { statusCode:400, headers, body: JSON.stringify({ error:'No text provided' }) };

  const prompt = `The user said: "${text}"

They are looking for a Chinese character (汉字) that matches this concept, word, or description.
The user may have spoken in English, Italian, Chinese, or any other language.

From this list of available characters, find the best match(es):
一(one/uno/一) 二(two/due/二) 三(three/tre/三) 十(ten/dieci/十)
人(person/persona/人) 山(mountain/montagna/山) 口(mouth/bocca/口) 日(sun/sole/日) 月(moon/luna/月)
木(tree/albero/木) 水(water/acqua/水) 火(fire/fuoco/火) 土(earth/terra/土) 金(metal/metallo/金)
明(bright/luminoso/明) 休(rest/riposo/休) 林(grove/boschetto/林) 森(forest/foresta/森) 好(good/buono/好)
马(horse/cavallo/马) 鱼(fish/pesce/鱼) 龟(turtle/tartaruga/龟) 鸟(bird/uccello/鸟)
王(king/re/王) 天(heaven/cielo/天) 帝(emperor/imperatore/帝) 贞(divine/divinare/贞) 吉(auspicious/propizio/吉)

Return ONLY a JSON object:
{
  "matches": [
    {"character": "日", "pinyin": "rì", "meaning_en": "sun / day", "meaning_zh": "太阳/白天", "meaning_it": "sole / giorno", "confidence": "high", "reason": "user said 'sun'"}
  ],
  "interpreted": "what the system understood the user meant"
}

Return 1-3 best matches ordered by confidence. If nothing matches, return {"matches": [], "interpreted": "..."}`;

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
        max_tokens: 500,
        messages: [{ role:'user', content:prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode:502, headers, body: JSON.stringify({ error:`API error: ${err}` }) };
    }

    const data = await response.json();
    const text2 = data.content?.[0]?.text || '{}';
    const clean = text2.replace(/```json|```/g,'').trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { return { statusCode:422, headers, body: JSON.stringify({ error:'Parse error', raw:text2.slice(0,200) }) }; }

    return { statusCode:200, headers, body: JSON.stringify(parsed) };
  } catch(err) {
    return { statusCode:500, headers, body: JSON.stringify({ error:err.message }) };
  }
};
