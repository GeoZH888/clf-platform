// netlify/functions/tts-proxy.js
// Proxies TTS audio to avoid CORS issues on mobile browsers

export const handler = async (event) => {
  const text = event.queryStringParameters?.text || '';
  if (!text) return { statusCode: 400, body: 'Missing text' };

  const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=zh-CN&client=gtx&ttsspeed=0.8`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible)',
        'Referer': 'https://translate.google.com',
      }
    });

    if (!res.ok) throw new Error(`TTS fetch failed: ${res.status}`);

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }
};
