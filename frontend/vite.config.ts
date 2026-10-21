import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The Material Symbols font has thousands of icons (~2.3 MB); the app uses about a hundred. Google Fonts can
 * serve just those (icon_names): this plugin collects every icon-like word in src (over-collecting is harmless,
 * unknown names are ignored; e2e/icons.spec.ts checks nothing renders as text).
 * - dev: index.html links the subset straight from Google Fonts;
 * - build: the subset is downloaded once and shipped with the app (same origin, preloaded), so the first paint
 *   doesn't wait for connections to two Google servers. If Google can't be reached at build time, the build
 *   falls back to the Google link.
 */
function materialSymbolsSubset(): Plugin {
  const AXES = 'opsz,wght,FILL,GRAD@24,400..500,0..1,0';
  const cssUrl = (icons: string) => `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:${AXES}&icon_names=${icons}&display=block`;
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
  let selfHosted: { fileName: string; data: Buffer } | null = null;
  let isBuild = false;

  return {
    name: 'material-symbols-subset',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    async buildStart() {
      if (!isBuild) return;
      try {
        // A modern browser user agent makes Google answer with woff2.
        const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
        const css = await (await fetch(cssUrl(collect()), { headers: { 'User-Agent': ua } })).text();
        const fontUrl = /src:\s*url\((https:[^)]+)\)\s*format\('woff2'\)/.exec(css)?.[1];
        if (!fontUrl) throw new Error('no woff2 in the Google Fonts answer');
        const data = Buffer.from(await (await fetch(fontUrl, { headers: { 'User-Agent': ua } })).arrayBuffer());
        const hash = crypto.createHash('sha256').update(data).digest('hex').slice(0, 10);
        selfHosted = { fileName: `assets/material-symbols-${hash}.woff2`, data };
      } catch (err) {
        selfHosted = null;
        this.warn(`Icon font not self-hosted (${(err as Error).message}); using the Google Fonts link instead.`);
      }
    },
    generateBundle() {
      if (selfHosted) this.emitFile({ type: 'asset', fileName: selfHosted.fileName, source: selfHosted.data });
    },
    transformIndexHtml: (html) => {
      if (!selfHosted) return html.replace('%MATERIAL_SYMBOLS_CSS%', cssUrl(collect()));
      const href = `/${selfHosted.fileName}`;
      return html.replace(
        /<!-- icon-font:start -->[\s\S]*?<!-- icon-font:end -->/,
        `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin />\n    ` +
          `<style>@font-face{font-family:'Material Symbols Outlined';font-style:normal;font-weight:400 500;font-display:block;src:url(${href}) format('woff2')}</style>`,
      );
    },
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
