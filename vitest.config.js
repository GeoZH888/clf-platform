import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',          // for React component tests
    globals: true,                 // describe/it/expect without imports
    setupFiles: ['./tests/setup.js'],
    // Skip Supabase RLS integration tests in CI by default — they require
    // seeded test users and a live Supabase project. Run locally with
    //   VITE_RUN_RLS_TESTS=1 npm test
    env: {
      VITE_RUN_RLS_TESTS: process.env.VITE_RUN_RLS_TESTS || '',
    },
  },
});
