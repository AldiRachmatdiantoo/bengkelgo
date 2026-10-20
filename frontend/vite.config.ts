import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    server: {
      port: 5173,
      // Dev: proxy API calls so the browser sees a single origin (refresh-token cookie just works).
      proxy: { '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true } },
    },
  };
});
