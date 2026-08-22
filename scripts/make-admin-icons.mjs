// scripts/make-admin-icons.mjs
//
// Generates the admin app icons into public/icons/.
//
//   node scripts/make-admin-icons.mjs
//
// Kept as a script rather than a pair of committed binaries nobody can edit:
// when the colours change, this is the file you change.
//
// The design is geometric on purpose — no text. A glyph like 管 depends on a
// CJK font being installed wherever this runs, and would silently render as a
// tofu box on a machine without one. Shapes render identically everywhere.
//
// It must not be mistakable for the learner app at home-screen size, so it is
// cold slate against the learner's warm brown, and a different silhouette.

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'icons');

const BG    = '#243447';   // slate — cold, against the learner app's #8B4513
const PANEL = '#f7fafc';
const BAR   = '#8fa3bf';
const ACCENT= '#e0a458';   // one warm bar, so it still belongs to the family

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function draw(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const u = size / 100;   // work in percentage units

  // Full bleed: a maskable icon is cropped to a circle on some launchers, so
  // the background must reach every corner and the artwork stay well inside.
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);

  // Everything below sits inside the middle 60%, which survives any mask.
  const px = 22 * u, py = 24 * u, pw = 56 * u, ph = 52 * u;

  ctx.fillStyle = PANEL;
  roundRect(ctx, px, py, pw, ph, 5 * u);
  ctx.fill();

  // Title bar, then rows — reads as a dashboard rather than a document.
  ctx.fillStyle = ACCENT;
  roundRect(ctx, px + 6 * u, py + 7 * u, pw - 12 * u, 6 * u, 3 * u);
  ctx.fill();

  ctx.fillStyle = BAR;
  const rowY = [22, 32, 42];
  const rowW = [pw - 12 * u, pw - 22 * u, pw - 16 * u];
  rowY.forEach((ry, i) => {
    roundRect(ctx, px + 6 * u, py + ry * u, rowW[i], 5 * u, 2.5 * u);
    ctx.fill();
  });

  return c.toBuffer('image/png');
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = join(OUT_DIR, `admin-${size}.png`);
  writeFileSync(file, draw(size));
  console.log(`[make-admin-icons] wrote ${file}`);
}
