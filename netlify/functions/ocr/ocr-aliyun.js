// netlify/functions/ocr/ocr-aliyun.js
//
// Aliyun OCR — 通用文字识别 API (RecognizeGeneral)
// Docs: https://help.aliyun.com/document_detail/442304.html
//
// Pricing: 500 free calls/month, then 0.003 RMB per call (as of 2025).
// Endpoint: https://ocr-api.cn-hangzhou.aliyuncs.com
//
// Needs env vars:
//   ALIYUN_ACCESS_KEY_ID      = "LTAI5t..."
//   ALIYUN_ACCESS_KEY_SECRET  = "xxxxx"
//   ALIYUN_OCR_REGION         = "cn-hangzhou"  (optional, defaults to this)

import crypto from 'crypto';

const DEFAULT_REGION = 'cn-hangzhou';
const SERVICE        = 'ocr-api';
const VERSION        = '2021-07-07';
const ACTION         = 'RecognizeGeneral';

// ── Aliyun API v3 signer (HMAC-SHA256) ──────────────────────────────────
// Reference: https://help.aliyun.com/document_detail/315526.html
function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function encodeRFC3986(str) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

// Build canonical headers/query string per Aliyun v3 signature
function buildCanonicalRequest(method, uri, queryParams, headers, bodyHash) {
  // Canonical query string (sorted by key)
  const canonicalQuery = Object.keys(queryParams).sort().map(k => {
    const v = queryParams[k];
    return v === '' ? encodeRFC3986(k) + '=' : encodeRFC3986(k) + '=' + encodeRFC3986(v);
  }).join('&');

  // Canonical headers (lowercased keys, sorted)
  const lowerHeaders = {};
  Object.keys(headers).forEach(k => { lowerHeaders[k.toLowerCase()] = headers[k]; });
  const sortedKeys = Object.keys(lowerHeaders).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${String(lowerHeaders[k]).trim()}\n`).join('');
  const signedHeaders = sortedKeys.join(';');

  const canonicalRequest = [
    method,
    uri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join('\n');

  return { canonicalRequest, signedHeaders };
}

function signAliyunRequest(method, uri, queryParams, bodyBuffer, accessKeyId, accessKeySecret) {
  const algorithm = 'ACS3-HMAC-SHA256';
  const now = new Date();
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = crypto.randomBytes(16).toString('hex');

  const bodyHash = sha256Hex(bodyBuffer);
  const host = `${SERVICE}.${DEFAULT_REGION}.aliyuncs.com`;

  const headers = {
    'host': host,
    'x-acs-action':         ACTION,
    'x-acs-version':        VERSION,
    'x-acs-date':           timestamp,
    'x-acs-signature-nonce': nonce,
    'x-acs-content-sha256': bodyHash,
  };

  const { canonicalRequest, signedHeaders } = buildCanonicalRequest(
    method, uri, queryParams, headers, bodyHash
  );

  const stringToSign = `${algorithm}\n${sha256Hex(canonicalRequest)}`;
  const signature = hmacSha256(accessKeySecret, stringToSign);

  const authHeader = `${algorithm} Credential=${accessKeyId},SignedHeaders=${signedHeaders},Signature=${signature}`;

  return {
    headers: { ...headers, 'authorization': authHeader },
    host,
  };
}

// ── Main OCR function ───────────────────────────────────────────────────
export async function ocrAliyun(imageBuffer, opts = {}) {
  const accessKeyId     = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error('Aliyun OCR: missing ALIYUN_ACCESS_KEY_ID or ALIYUN_ACCESS_KEY_SECRET');
  }

  // Max 3 retries on transient errors
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const method = 'POST';
      const uri = '/';
      const queryParams = {};  // Empty for this API

      // Body is the raw image bytes (Content-Type: application/octet-stream)
      const { headers, host } = signAliyunRequest(
        method, uri, queryParams, imageBuffer, accessKeyId, accessKeySecret
      );

      // Add Content-Type AFTER signing (it's not in the signed headers)
      const allHeaders = { ...headers, 'content-type': 'application/octet-stream' };

      const response = await fetch(`https://${host}/`, {
        method,
        headers: allHeaders,
        body: imageBuffer,
      });

      if (!response.ok) {
        const errText = await response.text();
        lastErr = `Aliyun OCR ${response.status}: ${errText.slice(0, 300)}`;
        // Retry on 5xx and 429
        if (response.status >= 500 || response.status === 429) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error(lastErr);
      }

      const data = await response.json();
      // Response shape: { Data: "{\"content\":\"...\",\"prism_wordsInfo\":[...]}", RequestId: "..." }
      let inner;
      try {
        inner = typeof data.Data === 'string' ? JSON.parse(data.Data) : data.Data;
      } catch {
        throw new Error(`Aliyun OCR: failed to parse inner Data JSON`);
      }

      const text = (inner?.content || '').trim();
      return {
        text,
        raw: inner,
      };
    } catch (err) {
      lastErr = err.message;
      if (attempt === 2) throw err;
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }

  throw new Error(lastErr || 'Aliyun OCR failed after retries');
}
