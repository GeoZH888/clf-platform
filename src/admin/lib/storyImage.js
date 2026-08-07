// src/admin/lib/storyImage.js
//
// Cover-image generation for 故事会.
//
// Follows the path PoetryAdminTab already uses — ai-gateway generates, the
// browser re-uploads the result to Supabase Storage — for one reason that
// matters: DALL-E hands back a temporary URL that expires in about an hour.
// Storing the bytes is what makes a cover survive the day it was made.
//
// Files go to the existing `illustrations` bucket under a story-covers/
// prefix rather than a new bucket, because a bucket cannot be created from
// the browser (that needs the service role) and this one is already in use
// by three other admin tools.

import { supabase } from '../../lib/supabase.js';

const BUCKET = 'illustrations';
const PREFIX = 'story-covers';

export const COVER_STYLES = [
  { id: 'storybook', label: '📖 绘本',   hint: 'classic children picture-book illustration, warm gouache texture, soft rounded shapes' },
  { id: 'ink',       label: '🖌️ 水墨',   hint: 'traditional Chinese ink wash painting, xieyi style, generous negative space, muted earth tones' },
  { id: 'cartoon',   label: '🎈 卡通',   hint: 'bright flat cartoon, bold clean outlines, cheerful saturated colours' },
  { id: 'papercut',  label: '✂️ 剪纸',   hint: 'Chinese folk paper-cut art, layered silhouettes, festive red and gold' },
];

export const IMAGE_PROVIDERS = [
  { id: 'openai',    label: 'DALL-E 3' },
  { id: 'stability', label: 'Stability' },
  { id: 'ideogram',  label: 'Ideogram' },
];

/**
 * Build the image prompt from whatever the story already knows about itself.
 * Falls back down the chain so a story with only a Chinese title still works.
 */
export function buildCoverPrompt({ title_zh, title_en, summary_en, summary_zh, style = 'storybook' }) {
  const styleHint = (COVER_STYLES.find(s => s.id === style) || COVER_STYLES[0]).hint;
  const subject = summary_en || summary_zh || title_en || title_zh || 'a gentle children story';
  const named   = title_en || title_zh || '';

  return `Book cover illustration for a children's story${named ? ` titled "${named}"` : ''}.

Scene: ${subject}

Style: ${styleHint}. Single clear focal scene, friendly and age-appropriate for children aged 5-10, inviting composition with room at the top where a title would sit.

Absolutely no text, no letters, no words, no Chinese characters, no calligraphy, no watermark, and no signature anywhere in the image.`;
}

/**
 * Generate a cover and return a durable public URL.
 *
 * @param {string} slug     used only to name the stored file
 * @param {string} style    key of COVER_STYLES
 * @param {string} provider key of IMAGE_PROVIDERS
 * @returns {{ url:string, stored:boolean }} stored=false means the upload
 *          failed and `url` is the provider's own temporary URL
 */
export async function generateCover({
  slug = 'story',
  style = 'storybook',
  provider = 'openai',
  titles = {},
} = {}) {
  const prompt = buildCoverPrompt({ ...titles, style });

  // Admins may hold their own key in the API Keys tab; otherwise the
  // server-side env key is used.
  const clientKey = localStorage.getItem(`admin_key_${provider}`) || undefined;

  const res = await fetch('/.netlify/functions/ai-gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate_image', provider, prompt, style,
      ...(clientKey ? { client_key: clientKey } : {}),
    }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`服务器返回非 JSON: ${text.slice(0, 160)}`); }
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

  const safeSlug = String(slug || 'story').replace(/[^a-z0-9-]/gi, '') || 'story';
  const path = `${PREFIX}/${safeSlug}_${style}_${Date.now()}.png`;

  // Providers answer with either a URL or raw base64 depending on which one
  // and which model actually served the request.
  let body = null;
  if (data.base64) {
    body = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
  } else if (data.url || data.image_url) {
    const src = data.url || data.image_url;
    try {
      body = await fetch(src).then(r => r.blob());
    } catch {
      // Cross-origin fetch blocked — hand back the provider URL and let the
      // caller warn that it is temporary.
      return { url: src, stored: false };
    }
  } else {
    throw new Error('图片服务没有返回图片 · Provider returned no image');
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { upsert: true, contentType: 'image/png' });

  if (upErr) {
    const fallback = data.url || data.image_url;
    if (fallback) return { url: fallback, stored: false };
    throw new Error(`上传失败: ${upErr.message}`);
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: publicUrl, stored: true };
}
