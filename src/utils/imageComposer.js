// src/utils/imageComposer.js
// Overlays Chinese character + pinyin onto an illustration image
// Returns a base64 PNG — no server needed

export async function composeWordImage({ imageUrl, wordZh, pinyin, meaning, meaningIt }) {
  return new Promise((resolve, reject) => {
    const canvas  = document.createElement('canvas');
    const ctx     = canvas.getContext('2d');
    const imgSize = 400;
    const bannerH = 110;
    canvas.width  = imgSize;
    canvas.height = imgSize + bannerH;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // ── Draw illustration on top ───────────────────────────────
      ctx.drawImage(img, 0, 0, imgSize, imgSize);

      // ── Banner background underneath ──────────────────────────
      ctx.fillStyle = '#fdf6e3';
      ctx.fillRect(0, imgSize, imgSize, bannerH);

      // ── Top border line ────────────────────────────────────────
      ctx.fillStyle = '#C8A050';
      ctx.fillRect(0, imgSize, imgSize, 2);

      // ── Chinese character (large, left) ───────────────────────
      ctx.font       = "bold 52px 'STKaiti','KaiTi','SimSun',serif";
      ctx.fillStyle  = '#1a0a05';
      ctx.textAlign  = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(wordZh, 16, imgSize + 10);

      // ── Pinyin ────────────────────────────────────────────────
      ctx.font      = "500 18px Arial, sans-serif";
      ctx.fillStyle = '#1565C0';
      ctx.fillText(pinyin, 16, imgSize + 68);

      // ── Meanings (right side) ─────────────────────────────────
      ctx.textAlign = 'right';

      // English
      ctx.font      = "16px Georgia, serif";
      ctx.fillStyle = '#2E7D32';
      const shortEn = meaning.length > 20 ? meaning.slice(0, 18) + '…' : meaning;
      ctx.fillText(shortEn, imgSize - 12, imgSize + 14);

      // Italian
      if (meaningIt) {
        ctx.font      = "italic 14px Georgia, serif";
        ctx.fillStyle = '#6b4c2a';
        const shortIt = meaningIt.length > 22 ? meaningIt.slice(0, 20) + '…' : meaningIt;
        ctx.fillText(shortIt, imgSize - 12, imgSize + 38);
      }

      // ── Small watermark ───────────────────────────────────────
      ctx.font      = "11px 'STKaiti', serif";
      ctx.fillStyle = 'rgba(139,69,19,0.3)';
      ctx.textAlign = 'right';
      ctx.fillText('大卫学中文', imgSize - 12, imgSize + bannerH - 12);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

// Converts base64 data URL to Blob for upload
export function dataURLtoBlob(dataURL) {
  const arr  = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n      = bstr.length;
  const u8   = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}
