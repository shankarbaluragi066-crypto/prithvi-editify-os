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
 * Generates `404.html` and `.nojekyll` in both `dist/` and repository root `/`,
 * and mirrors the compiled bundle into `/bundle/app.js` and `/bundle/app.css` so
 * GitHub Pages works directly from the root of the `main` branch without workflow files.
 */
function githubPagesSpaPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'github-pages-spa-fallback',
    configResolved(resolvedConfig) {
      outDir = resolvedConfig.build.outDir || 'dist';
    },
    closeBundle() {
      const resolvedOutDir = path.resolve(__dirname, outDir);
      if (fs.existsSync(resolvedOutDir)) {
        fs.writeFileSync(path.join(resolvedOutDir, '404.html'), SPA_REDIRECT_404_HTML, 'utf-8');
        fs.writeFileSync(path.join(resolvedOutDir, '.nojekyll'), '');

        // Mirror compiled JS and CSS into /bundle for branch-root GitHub Pages hosting
        const bundleDir = path.resolve(__dirname, 'bundle');
        if (!fs.existsSync(bundleDir)) {
          fs.mkdirSync(bundleDir, { recursive: true });
        }
        const builtJs = path.join(resolvedOutDir, 'assets', 'app.js');
        const builtCss = path.join(resolvedOutDir, 'assets', 'index.css');
        if (fs.existsSync(builtJs)) {
          fs.copyFileSync(builtJs, path.join(bundleDir, 'app.js'));
        }
        if (fs.existsSync(builtCss)) {
          fs.copyFileSync(builtCss, path.join(bundleDir, 'app.css'));
        }
      }
      // Also write 404.html and .nojekyll to repository root for branch-root GitHub Pages hosting
      fs.writeFileSync(path.resolve(__dirname, '404.html'), SPA_REDIRECT_404_HTML, 'utf-8');
      fs.writeFileSync(path.resolve(__dirname, '.nojekyll'), '');
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), githubPagesSpaPlugin()],
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
