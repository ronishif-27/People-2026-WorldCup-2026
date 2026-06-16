import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), tailwindcss()],

    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},

      // ── Dev proxy: forward /api/* to the local backend ─────────────────────
      // This avoids CORS issues in development — the browser sees everything
      // on the same origin (localhost:3000).
      //
      // In production the frontend and backend are on separate domains;
      // CORS is handled by the backend's cors() middleware.
      proxy: {
        '/api': {
          target: env.VITE_API_URL ?? 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
