/**
 * netlify/functions/generate-illustration.js
 * Generates vivid pictographic SVG illustrations connecting
 * the oracle bone origin to the modern character meaning.
 *
 * POST body: { char, pinyin, meaning, story, style, lang }
 * style: 'pictographic' | 'compound' | 'scene'
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode:204, headers:{ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type' }, body:'' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode:405, body:'Method Not Allowed' };
  }

  const headers = { 'Access-Control-Allow-Origin':'*', 'Content-Type':'application/json' };
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return { statusCode:500, headers, body: JSON.stringify({ error:'ANTHROPIC_API_KEY not set' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode:400, headers, body: JSON.stringify({ error:'Invalid JSON' }) }; }

  const { char = '日', pinyin = '', meaning = '', story = '', style = 'pictographic' } = body;

  // ── Vivid mnemonic prompts by character ────────────────────────
  const KNOWN_PROMPTS = {
    '一': 'ONE single horizontal bamboo stick lying flat on white paper. Simple, clean, like a Chinese calligraphy brush stroke.',
    '二': 'TWO parallel horizontal bamboo sticks lying one above the other. Clean minimal illustration.',
    '三': 'THREE parallel horizontal bamboo sticks stacked. Simple counting illustration.',
    '十': 'A CROSS shape — one vertical and one horizontal bamboo stick crossing in the middle. Like a plus sign.',
    '日': 'A bright YELLOW SUN in a light blue sky, with a darker yellow circle in the centre representing warmth/brightness. Simple, friendly, like a children\'s book.',
    '月': 'A WHITE CRESCENT MOON against a deep blue night sky, with two or three small stars nearby. Soft, dreamlike.',
    '山': 'THREE MOUNTAIN PEAKS with the middle one taller, green slopes, simple scenic landscape. Like a Chinese ink painting.',
    '水': 'A BLUE WAVY RIVER flowing between two green banks, with small ripples. Fresh and flowing.',
    '火': 'ORANGE AND RED FLAMES leaping upward from a small pile of wood. Warm, energetic, three distinct flame tongues.',
    '木': 'A TREE with a brown trunk, green spreading branches above, and visible brown roots spreading below the ground line.',
    '人': 'A SIMPLE PERSON walking — seen from the side. Stick figure style but friendly. Two clear strokes: body leaning forward, one leg stepping ahead.',
    '口': 'An OPEN MOUTH — round lips forming an O shape, showing teeth. Simple cartoon style.',
    '大': 'A PERSON standing with ARMS SPREAD WIDE open, like saying "this big!" Joyful, energetic pose.',
    '手': 'A HAND with five FINGERS spread open, seen from the front. Friendly waving hand.',
    '目': 'A BIG EYE looking to the side. Clear iris and pupil, with simple eyelashes. Curious expression.',
    '牛': 'An OX HEAD seen from the front — two curved horns at the top, simple nose and face below.',
    '羊': 'A SHEEP HEAD seen from the front — two curved horns, fluffy wool, friendly face.',
    '鸟': 'A BIRD in profile — beak, body, wing, and tail feathers visible. Simple but recognisable.',
    '马': 'A HORSE galloping in profile — mane flying, four legs in motion, tail streaming behind.',
    '鱼': 'A FISH swimming — eye dot, scaly body, bifurcated tail fin. Simple and cute.',
    '龟': 'A TURTLE — hexagonal shell pattern on its back, head peeking out, four stubby legs, tail.',
    '田': 'A RICE PADDY FIELD — square divided into four equal sections by a cross of paths, bright green.',
    '雨': 'RAINDROPS falling from a grey cloud — six or eight individual drops, light blue on white.',
    '女': 'A WOMAN kneeling gracefully — flowing robes, arms crossed in a respectful traditional posture.',
    '子': 'A BABY with arms raised up — wanting to be held. Round head, simple body, happy expression.',
    '好': 'A MOTHER holding her BABY lovingly. Warm, tender scene. Woman on the left, child on the right.',
    '休': 'A PERSON sitting with their BACK against a TREE TRUNK, resting peacefully. Tree has visible roots. Person looks relaxed.',
    '明': 'A BRIGHT SUN on the left and a GLOWING MOON on the right — both shining together, making everything bright.',
    '林': 'TWO TREES standing side by side — a small grove.',
    '森': 'THREE TREES grouped together — a dense small forest. One in front, two behind.',
    '王': 'Three horizontal GOLD BARS stacked, connected by one vertical rod in the centre. Like a royal sceptre.',
    '天': 'A PERSON with an enormous HEAD — the sky is above a person\'s head! Big round sky-head, smaller body.',
    '土': 'A SMALL MOUND of brown earth on flat ground — like a raised platform or altar mound.',
    '上': 'An ARROW pointing UP from a flat horizontal ground line. Simple directional.',
    '下': 'An ARROW pointing DOWN from a flat horizontal ground line.',
    '中': 'A VERTICAL POLE or ARROW in the EXACT CENTRE of a rectangular space.',
    '日': 'A bright YELLOW SUN with a distinct centre circle representing brightness.',
  };

  const STYLE_INSTRUCTIONS = {
    pictographic: `Draw the REAL WORLD OBJECT this character originally depicted. 
Simple, friendly, colorful — like a children's picture book illustration.
Make it OBVIOUS what it represents at first glance.
Use clear outlines, bright natural colors, white or light background.`,
    compound: `Show how TWO COMPONENTS combine to create the meaning.
For example: 休 (rest) = person leaning on tree. Show BOTH components clearly and their relationship.
Label each part if helpful. Simple, educational, clear.`,
    scene: `Show a VIVID SCENE from ancient Shang Dynasty China where this character was used.
Atmospheric but simple. Warm earth tones. Show the character's meaning through action.`,
  };

  const knownPrompt = KNOWN_PROMPTS[char];
  const prompt = `Create a simple, charming, VIVID SVG illustration (viewBox="0 0 120 120") for the Chinese character "${char}" (${pinyin}) meaning "${meaning}".

${knownPrompt
  ? `Specific illustration: ${knownPrompt}`
  : `${STYLE_INSTRUCTIONS[style] || STYLE_INSTRUCTIONS.pictographic}
${story ? `Mnemonic context: ${story}` : ''}`}

CRITICAL rules:
- viewBox MUST be "0 0 120 120"
- Background: fill the full 120×120 with a gentle background color (light sky blue, warm ivory, or soft green — matching the subject)
- Make it IMMEDIATELY RECOGNISABLE — a child should understand it in 1 second
- Colorful and warm — use natural colors (sky blue, grass green, sun yellow, earth brown)
- Simple clean shapes — circles, rectangles, paths — no tiny details
- NO text or labels inside the SVG
- NO black background — always light/warm background
- The illustration should TELL the story of what the character means
- Output ONLY the SVG code starting with <svg and ending with </svg>`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role:'user', content:prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { statusCode:502, headers, body: JSON.stringify({ error:`Claude API: ${err}` }) };
    }

    const data  = await response.json();
    const text  = data.content?.[0]?.text || '';
    const match = text.match(/<svg[\s\S]*?<\/svg>/);

    if (!match) {
      return { statusCode:422, headers, body: JSON.stringify({ error:'No SVG in response', raw:text.slice(0,200) }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ svg:match[0], char, meaning, style }),
    };
  } catch (err) {
    return { statusCode:500, headers, body: JSON.stringify({ error:err.message }) };
  }
};
