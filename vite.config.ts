import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

const SPA_REDIRECT_404_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Prithvi Editify — Redirecting...</title>
    <script>
      // Single Page Apps for GitHub Pages redirect handler
      // Keeps 1 path segment (/prithvi-editify) when hosted on github.io project pages, or 0 on root domains
      var pathSegmentsToKeep = window.location.pathname.indexOf('/prithvi-editify') === 0 ? 1 : 0;
      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body></body>
</html>
`;

/**
 * 1. During `vite dev` and `vite build`, transforms `index.html` to use `/src/main.tsx`
 *    instead of the static GitHub Pages `./bundle/loader.js` fallback.
 * 2. Generates `dist/404.html` and `dist/.nojekyll` during production builds.
 */
function githubPagesSpaPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'github-pages-spa-fallback',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html
          .replace(/<link\s+id="gh-pages-css"[^>]*>\s*/g, '')
          .replace(
            /<script\s+id="gh-pages-entry"[^>]*><\/script>/g,
            '<script type="module" src="./src/main.tsx"></script>'
          );
      },
    },
    configResolved(resolvedConfig) {
      outDir = resolvedConfig.build.outDir || 'dist';
    },
    closeBundle() {
      const resolvedOutDir = path.resolve(__dirname, outDir);
      if (fs.existsSync(resolvedOutDir)) {
        fs.writeFileSync(path.join(resolvedOutDir, '404.html'), SPA_REDIRECT_404_HTML, 'utf-8');
        fs.writeFileSync(path.join(resolvedOutDir, '.nojekyll'), '\n', 'utf-8');
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [githubPagesSpaPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/app.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
