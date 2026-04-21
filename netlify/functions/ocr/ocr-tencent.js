// netlify/functions/ocr/ocr-tencent.js
//
// Tencent Cloud OCR — GeneralBasicOCR action
// Docs: https://www.tencentcloud.com/document/product/866/33526
//
// Pricing: 1000 free calls/month, then 0.025 CNY per call.
// Endpoint: https://ocr.tencentcloudapi.com
// Signature: TC3-HMAC-SHA256 (v3)
//
// Needs env vars:
//   TENCENT_SECRET_ID   = "AKID..."
//   TENCENT_SECRET_KEY  = "xxx"
//   TENCENT_OCR_REGION  = "ap-guangzhou"   (optional, default)

import crypto from 'crypto';

const DEFAULT_REGION = 'ap-guangzhou';
const HOST           = 'ocr.tencentcloudapi.com';
const SERVICE        = 'ocr';
const VERSION        = '2018-11-19';
const ACTION         = 'GeneralBasicOCR';

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function signTencentRequest(body, secretId, secretKey, region) {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  // Canonical request
  const httpMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQuery = '';
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${HOST}\nx-tc-action:${ACTION.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedRequestPayload = sha256Hex(body);
  const canonicalRequest = [
    httpMethod, canonicalUri, canonicalQuery,
    canonicalHeaders, signedHeaders, hashedRequestPayload,
  ].join('\n');

  // String to sign
  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    algorithm, timestamp, credentialScope, sha256Hex(canonicalRequest),
  ].join('\n');

  // Signing key
  const secretDate    = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, SERVICE);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature     = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: {
      'Authorization':     authorization,
      'Content-Type':      'application/json; charset=utf-8',
      'Host':              HOST,
      'X-TC-Action':       ACTION,
      'X-TC-Timestamp':    String(timestamp),
      'X-TC-Version':      VERSION,
      'X-TC-Region':       region,
    },
  };
}

export async function ocrTencent(imageBuffer, opts = {}) {
  const secretId  = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error('Tencent OCR: missing TENCENT_SECRET_ID or TENCENT_SECRET_KEY');
  }

  const region = process.env.TENCENT_OCR_REGION || DEFAULT_REGION;

  // Tencent expects base64-encoded image in the JSON body
  const bodyObj = {
    ImageBase64: imageBuffer.toString('base64'),
    LanguageType: opts.lang === 'en' ? 'eng' : 'zh',
  };
  const body = JSON.stringify(bodyObj);

  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { headers } = signTencentRequest(body, secretId, secretKey, region);

      const response = await fetch(`https://${HOST}`, {
        method: 'POST',
        headers,
        body,
      });

      const data = await response.json();

      if (data.Response?.Error) {
        lastErr = `Tencent OCR: ${data.Response.Error.Code} - ${data.Response.Error.Message}`;
        if (data.Response.Error.Code === 'RequestLimitExceeded' || data.Response.Error.Code === 'InternalError') {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error(lastErr);
      }

      const detections = data.Response?.TextDetections || [];
      const text = detections.map(d => d.DetectedText).join('\n').trim();

      return {
        text,
        raw: data.Response,
      };
    } catch (err) {
      lastErr = err.message;
      if (attempt === 2) throw err;
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new Error(lastErr || 'Tencent OCR failed after retries');
}
