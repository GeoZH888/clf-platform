// netlify/functions/generate-riddle-images.js
//
// Generates ONE image for a riddle and stores it.
//
// Body: { riddle_id: uuid, type: 'illustration' | 'answer', provider?: string }
//
// Flow:
//   1. Load riddle from DB
//   2. Build prompt based on type:
//      - 'illustration' → visualize 谜面 WITHOUT spoiling answer
//      - 'answer'       → visualize 谜底 (the answer character/word)
//   3. Call /ai-gateway internally (uses your existing image provider setup)
//   4. Upload returned image to Supabase Storage
//   5. Update clf_riddles with the URL
//
// Called from:
//   - generate-riddle.js (fire-and-forget, after riddle creation, twice — once
//     per type)
//   - RiddleAdminTab "🎨 重新生成" button (manual regen)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const BUCKET = 'riddle-illustrations';

// ─────────────────────────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: HEADERS });
  if (req.method !== 'POST')    return json(405, { error: 'Method not allowed' });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      riddle_id,
      type      = 'answer',         // 'illustration' | 'answer'
      provider  = 'stability',
      force     = false,            // regenerate even if image exists
    } = body;

    if (!riddle_id) return json(400, { error: 'riddle_id required' });
    if (!['illustration', 'answer'].includes(type))
      return json(400, { error: 'type must be illustration or answer' });

    // 1. Load riddle
    const { data: riddle, error: rErr } = await supabase
      .from('clf_riddles')
      .select('*')
      .eq('id', riddle_id)
      .single();
    if (rErr || !riddle) return json(404, { error: 'Riddle not found' });

    // Skip if image exists and not forcing
    const existingUrl = type === 'illustration' ? riddle.illustration_url : riddle.answer_image_url;
    if (existingUrl && !force) {
      return json(200, { url: existingUrl, skipped: true });
    }

    // 2. Build prompt
    const prompt = buildPrompt(riddle, type);

    // 3. Generate via ai-gateway
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || '';
    const aiRes = await fetch(`${baseUrl}/.netlify/functions/ai-gateway`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'generate_image', provider, prompt }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return json(500, { error: `AI gateway ${aiRes.status}: ${errText.slice(0, 200)}` });
    }

    const aiData = await aiRes.json();
    if (aiData.error) return json(500, { error: aiData.error });

    // Extract image bytes (handle multiple response shapes from ai-gateway)
    const blob = await extractImageBlob(aiData);
    if (!blob) return json(500, { error: '未找到图片字段', raw: JSON.stringify(aiData).slice(0, 200) });

    // 4. Upload to Supabase Storage
    const key = `riddle_${riddle.id.slice(0, 8)}_${type}.png`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(key, blob, {
        upsert:       true,
        contentType:  'image/png',
        cacheControl: '3600',
      });
    if (upErr) return json(500, { error: `Storage upload: ${upErr.message}` });

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(key);
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    // 5. Update riddle
    const updateField = type === 'illustration' ? 'illustration_url' : 'answer_image_url';
    const update = { [updateField]: publicUrl };

    // If both are now present, mark images_generated_at
    const otherField = type === 'illustration' ? 'answer_image_url' : 'illustration_url';
    const otherUrl = type === 'illustration' ? riddle.answer_image_url : riddle.illustration_url;
    if (otherUrl) update.images_generated_at = new Date().toISOString();

    const { error: dbErr } = await supabase
      .from('clf_riddles')
      .update(update)
      .eq('id', riddle_id);
    if (dbErr) return json(500, { error: `DB update: ${dbErr.message}` });

    return json(200, { url: publicUrl, type, riddle_id });
  } catch (err) {
    console.error('[generate-riddle-images]', err);
    return json(500, { error: err.message || String(err) });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt building — the trickiest part
// ─────────────────────────────────────────────────────────────────────────────
function buildPrompt(riddle, type) {
  const { riddle_text, answer, answer_type, category_hint, explanation } = riddle;

  if (type === 'answer') {
    // Visualize the answer — same approach as WordIllustrationStudio
    return [
      `Educational illustration representing "${answer}".`,
      `Context: this is the answer to a Chinese riddle about "${riddle_text}".`,
      explanation ? `Concept: ${explanation}` : null,
      `Style: warm, festive Chinese art style with red and gold accents.`,
      `Single central subject, clean background, no Chinese text or characters in the image.`,
      `Suitable for a riddle game reveal screen.`,
    ].filter(Boolean).join(' ');
  }

  // type === 'illustration' — the hard one. Must NOT spoil.
  // For 字谜, showing components reveals the answer. So we go ABSTRACT.
  if (answer_type === 'character') {
    return [
      `Abstract artistic illustration evoking the Chinese riddle: "${riddle_text}".`,
      `Style: minimalist Chinese ink painting, decorative, atmospheric.`,
      `Use symbolic imagery suggesting the riddle's metaphor without literal text.`,
      `IMPORTANT: do NOT render any Chinese characters in the image. Specifically avoid drawing or hinting at the character "${answer}".`,
      `Warm festival lantern aesthetic. Suitable as a teaser image for a riddle.`,
    ].join(' ');
  }

  // For 词谜 / 成语谜 / 物 — illustration is more straightforward
  return [
    `Decorative illustration evoking the Chinese riddle "${riddle_text}".`,
    `Hint at the riddle's theme without revealing the answer.`,
    `Style: warm Chinese festival aesthetic, lanterns, scrolls, soft lighting.`,
    `IMPORTANT: do NOT include any Chinese text or characters in the image.`,
    `Suitable as a teaser before the player solves the riddle.`,
  ].join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Convert ai-gateway response → Blob, handling multiple shapes
// ─────────────────────────────────────────────────────────────────────────────
async function extractImageBlob(data) {
  // Direct URL response
  const directUrl = data.url || data.imageUrl || data.image_url
    || data.result?.url || data.data?.[0]?.url
    || data.images?.[0]?.url || (typeof data.images?.[0] === 'string' ? data.images[0] : null);

  if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) {
    const r = await fetch(directUrl);
    if (!r.ok) return null;
    return await r.blob();
  }

  // Base64 response
  const b64 = data.base64 || data.image || data.b64_json || data.images?.[0]?.base64;
  if (b64) {
    const mime = data.mimeType || data.mime_type || 'image/png';
    const bin  = atob(b64);
    const arr  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // data: URL
  if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('data:')) {
    const [meta, b64part] = directUrl.split(',');
    const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/png';
    const bin  = atob(b64part);
    const arr  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  return null;
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}
