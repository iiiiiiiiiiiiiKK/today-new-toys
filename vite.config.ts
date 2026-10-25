import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Static-only build. `TOYS_BASE` lets the same source deploy to a subpath
 * (GitHub Pages project site, `/toys/`) or the domain root (Cloudflare Pages).
 */
export default defineConfig({
  base: process.env.TOYS_BASE || '/',
  plugins: [react()],
  server: { port: 5180, strictPort: false },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
    testTimeout: 20000,
  },
});
