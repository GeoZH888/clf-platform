// netlify/functions/ocr/ocr-router.js
//
// Universal OCR interface. Picks a provider based on which env vars are set.
// Priority: aliyun > tencent > (future: baidu, google).
//
// Usage from process-document-background.js:
//   import { ocrPageImage, isOcrAvailable } from './ocr/ocr-router.js';
//
//   if (isOcrAvailable()) {
//     const text = await ocrPageImage(pngBuffer, { lang: 'zh' });
//   }

import { ocrAliyun }  from './ocr-aliyun.js';
import { ocrTencent } from './ocr-tencent.js';

// ── Detect which provider has credentials configured ────────────────────
export function getActiveProvider() {
  if (process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET) return 'aliyun';
  if (process.env.TENCENT_SECRET_ID     && process.env.TENCENT_SECRET_KEY)     return 'tencent';
  return null;
}

export function isOcrAvailable() {
  return getActiveProvider() !== null;
}

// ── Universal OCR interface ─────────────────────────────────────────────
// Input:
//   imageBuffer: Buffer  (PNG bytes)
//   opts.lang:   'zh' | 'en' | 'zh-traditional' — hint for OCR engine
//
// Output:
//   { text: string, confidence?: number, provider: string }
//
// Throws on error so caller can decide to skip/fallback.
export async function ocrPageImage(imageBuffer, opts = {}) {
  const provider = getActiveProvider();
  if (!provider) {
    throw new Error('No OCR provider configured (need ALIYUN_* or TENCENT_* env vars)');
  }

  const result = provider === 'aliyun'
    ? await ocrAliyun(imageBuffer, opts)
    : await ocrTencent(imageBuffer, opts);

  return { ...result, provider };
}

// ── Provider descriptor (for admin UI / debugging) ──────────────────────
export function getProviderInfo() {
  const provider = getActiveProvider();
  return {
    active: provider,
    aliyun_configured:  !!(process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET),
    tencent_configured: !!(process.env.TENCENT_SECRET_ID    && process.env.TENCENT_SECRET_KEY),
  };
}
