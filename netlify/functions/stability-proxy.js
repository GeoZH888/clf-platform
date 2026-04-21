// netlify/functions/stability-proxy.js
// Stability AI — reads key from env var OR request body (admin fallback)
// Tries v2beta first, falls back to v1 SDXL

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers, body:'' };
  if (event.httpMethod !== 'POST')   return { statusCode:405, headers, body: JSON.stringify({ error:'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode:400, headers, body: JSON.stringify({ error:'Invalid JSON' }) }; }

  // Key: env var takes priority, fallback to key passed in request body (admin use only)
  const STABILITY_API_KEY = process.env.STABILITY_API_KEY || body.api_key;
  if (!STABILITY_API_KEY) return {
    statusCode:500, headers,
    body: JSON.stringify({ error:'STABILITY_API_KEY not set — add to Netlify env vars OR check API Keys tab in admin panel' }),
  };

  const { prompt, negative_prompt='blurry, low quality, text, watermark', style='digital-art' } = body;
  if (!prompt) return { statusCode:400, headers, body: JSON.stringify({ error:'prompt required' }) };

  // Try v2beta stable-image/generate/core
  try {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('negative_prompt', negative_prompt);
    form.append('aspect_ratio', '1:1');
    form.append('output_format', 'png');
    if (style && style !== 'none') form.append('style_preset', style);

    const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
      method:'POST',
      headers:{ Authorization:`Bearer ${STABILITY_API_KEY}`, Accept:'image/*' },
      body: form,
    });

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const image_base64 = Buffer.from(buffer).toString('base64');
      return { statusCode:200, headers, body: JSON.stringify({ image_base64 }) };
    }
    if (res.status === 402 || res.status === 403) {
      const errText = await res.text();
      return { statusCode:res.status, headers, body: JSON.stringify({ error:`Stability auth error ${res.status} — check your API key is valid and has credits` }) };
    }
  } catch(e) { /* fall through to v1 */ }

  // Fallback: v1 SDXL
  try {
    const res = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Accept:'application/json',
          Authorization:`Bearer ${STABILITY_API_KEY}`,
        },
        body: JSON.stringify({
          text_prompts:[
            { text:prompt, weight:1 },
            { text:negative_prompt, weight:-1 },
          ],
          cfg_scale:7, width:1024, height:1024, steps:30, samples:1,
          ...(style && style!=='none' ? { style_preset:style } : {}),
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return { statusCode:res.status, headers, body: JSON.stringify({ error:`Stability v1 error: ${err.slice(0,300)}` }) };
    }

    const data = await res.json();
    const image_base64 = data.artifacts?.[0]?.base64 ?? null;
    if (!image_base64) return { statusCode:500, headers, body: JSON.stringify({ error:'No image in response' }) };
    return { statusCode:200, headers, body: JSON.stringify({ image_base64 }) };

  } catch(err) {
    return { statusCode:500, headers, body: JSON.stringify({ error:err.message }) };
  }
};
