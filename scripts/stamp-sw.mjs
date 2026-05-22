// scripts/stamp-sw.mjs
// Post-build step: replace `__SW_VERSION__` in dist/sw.js with a fresh
// timestamp. Without this, sw.js bytes are identical across deploys and the
// browser never installs an update — existing PWA installs keep serving the
// previous bundle indefinitely until users manually hard-reload.
//
// Wired into the npm build script:  vite build && node scripts/stamp-sw.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = join(__dirname, '..', 'dist', 'sw.js');

if (!existsSync(swPath)) {
  console.error(`[stamp-sw] ERROR: ${swPath} does not exist. Did vite build run?`);
  process.exit(1);
}

const original = readFileSync(swPath, 'utf8');
if (!original.includes('__SW_VERSION__')) {
  console.error('[stamp-sw] ERROR: __SW_VERSION__ placeholder not found in dist/sw.js.');
  console.error('[stamp-sw] The service worker will NOT auto-update on this deploy.');
  console.error('[stamp-sw] Check that public/sw.js still references __SW_VERSION__.');
  process.exit(1);
}

const version = String(Date.now());
const stamped = original.replace(/__SW_VERSION__/g, version);
writeFileSync(swPath, stamped, 'utf8');
console.log(`[stamp-sw] Stamped dist/sw.js with version ${version}`);
