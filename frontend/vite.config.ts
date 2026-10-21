import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The Material Symbols font has thousands of icons (~2.3 MB); the app uses about a hundred. This asks Google
 * Fonts for only those (icon_names) by filling %MATERIAL_SYMBOLS_ICONS% in index.html with every icon-like
 * word found in src. Over-collecting is harmless (unknown names are ignored); a missed icon would show as text,
 * which e2e/icons.spec.ts checks. New icons are picked up automatically on the next build or dev start.
 */
function materialSymbolsSubset(): Plugin {
  const collect = () => {
    const names = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
          const src = fs.readFileSync(file, 'utf8');
          for (const m of src.matchAll(/['"`]([a-z][a-z0-9_]{1,40})['"`]/g)) names.add(m[1]);
        }
      }
    };
    walk(path.resolve(import.meta.dirname, 'src'));
    return [...names].sort().join(',');
  };
  return {
    name: 'material-symbols-subset',
    transformIndexHtml: (html) => html.replace('%MATERIAL_SYMBOLS_ICONS%', collect()),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), materialSymbolsSubset()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    server: {
      port: 5173,
      // Dev: proxy API calls so the browser sees a single origin (refresh-token cookie just works).
      proxy: { '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true } },
    },
  };
});
