// vite.lianzi.config.js
// Build config for the standalone 练字 mobile bundle. Output goes to
// dist-lianzi/, which Capacitor uses as `webDir` to package the
// Android/iOS app. Main web app build (dist/) is untouched.
//
// Usage:
//   npm run dev:lianzi    → vite dev server, opens http://localhost:5175/
//   npm run build:lianzi  → produces dist-lianzi/ (for `npx cap sync`)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Vite project root = the lianzi-mobile/ folder so its index.html is the
  // landing page. src/ is one level up; resolved via the import paths in
  // lianzi-main.jsx (which uses relative ../src/... paths through the
  // top-level src tree).
  root: path.resolve(__dirname, 'lianzi-mobile'),

  // publicDir + resolve.alias still point at the project root so we can
  // share /favicon.svg, /apple-touch-icon.png, and the src/ tree.
  publicDir: path.resolve(__dirname, 'public'),

  plugins: [react()],

  resolve: {
    alias: {
      // Allows /src/lianzi-main.jsx style import from index.html
      '/src': path.resolve(__dirname, 'src'),
    },
  },

  server: {
    port: 5175,   // different from main app (5174) so both can run
    open: true,
    allowedHosts: ['.loca.lt', '.ngrok-free.app', '.trycloudflare.com', '.netlify.live'],
  },

  build: {
    outDir:    path.resolve(__dirname, 'dist-lianzi'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react';
          if (id.includes('node_modules/@supabase')) return 'supabase';
          if (id.includes('node_modules/hanzi-writer')) return 'hanzi-writer';
        },
      },
    },
  },
});
