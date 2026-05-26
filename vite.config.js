import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,   // different port from lingua-learn (5173)
    open:  true,
    // Allow temporary public dev tunnels (localtunnel / ngrok / cloudflare /
    // netlify --live) to reach the dev server. Vite 5 otherwise blocks any
    // Host header it doesn't recognise. Dev-server only — no effect on builds.
    allowedHosts: ['.loca.lt', '.ngrok-free.app', '.trycloudflare.com', '.netlify.live'],
  },
  build: {
    outDir:         'dist',
    sourcemap:      false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react';
          if (id.includes('node_modules/@supabase')) return 'supabase';
        },
      },
    },
  },
});
