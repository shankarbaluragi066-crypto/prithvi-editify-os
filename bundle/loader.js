/**
 * GitHub Pages Branch-Root Runtime Loader for Prithvi Editify CRM
 * Automatically mounts the React + TypeScript application when GitHub Pages serves
 * the repository root (`.github/workflows/static.yml` with `path: '.'`).
 */
const EXTERNAL_MODULES = {
  'react': 'https://esm.sh/react@19.0.1',
  'react/jsx-runtime': 'https://esm.sh/react@19.0.1/jsx-runtime',
  'react-dom': 'https://esm.sh/react-dom@19.0.1?deps=react@19.0.1',
  'react-dom/client': 'https://esm.sh/react-dom@19.0.1/client?deps=react@19.0.1',
  'react-router-dom': 'https://esm.sh/react-router-dom@7.1.5?deps=react@19.0.1,react-dom@19.0.1',
  'lucide-react': 'https://esm.sh/lucide-react@0.475.0?deps=react@19.0.1',
  '@supabase/supabase-js': 'https://esm.sh/@supabase/supabase-js@2.48.1',
  'recharts': 'https://esm.sh/recharts@2.15.1?deps=react@19.0.1,react-dom@19.0.1',
  'zod': 'https://esm.sh/zod@3.24.2',
  'react-hook-form': 'https://esm.sh/react-hook-form@7.54.2?deps=react@19.0.1',
  '@hookform/resolvers/zod': 'https://esm.sh/@hookform/resolvers@3.10.0/zod?deps=react-hook-form@7.54.2,zod@3.24.2',
};

// Topological order from leaf modules up to src/main.tsx
const SOURCE_MODULES = [
  'src/types/crm.ts',
  'src/lib/supabaseClient.ts',
  'src/schemas/validation.ts',
  'src/utils/formatters.ts',
  'src/utils/mediaValidation.ts',
  'src/utils/seedData.ts',
  'src/contexts/ToastContext.tsx',
  'src/contexts/AuthContext.tsx',
  'src/services/crmService.ts',
  'src/components/ErrorBoundary.tsx',
  'src/components/MediaSearchFilterBar.tsx',
  'src/components/MediaPreviewModal.tsx',
  'src/components/MediaLibraryManager.tsx',
  'src/components/InquiryForm.tsx',
  'src/layouts/PublicLayout.tsx',
  'src/layouts/AdminLayout.tsx',
  'src/layouts/ClientLayout.tsx',
  'src/pages/PublicPages.tsx',
  'src/pages/AuthPages.tsx',
  'src/pages/AdminCorePages.tsx',
  'src/pages/AdminBusinessPages.tsx',
  'src/pages/ClientPortalPages.tsx',
  'src/App.tsx',
  'src/main.tsx',
];

const RAW_SQL_PATH = 'supabase/migrations/20261018000000_prithvi_editify_schema_and_rls.sql';

function normalizeRepoPath(fromFile, relativeImport) {
  const cleanImport = relativeImport.replace(/\?raw$/, '');
  const fromParts = fromFile.split('/').slice(0, -1);
  const relParts = cleanImport.split('/');
  for (const part of relParts) {
    if (part === '.' || part === '') continue;
    if (part === '..') fromParts.pop();
    else fromParts.push(part);
  }
  const joined = fromParts.join('/');
  if (SOURCE_MODULES.includes(joined)) return joined;
  if (SOURCE_MODULES.includes(joined + '.ts')) return joined + '.ts';
  if (SOURCE_MODULES.includes(joined + '.tsx')) return joined + '.tsx';
  return joined;
}

async function bootFromSourceTree() {
  const { transform } = await import('https://esm.sh/sucrase@3.35.0');

  const [sqlText, ...sourceTexts] = await Promise.all([
    fetch('./' + RAW_SQL_PATH).then((r) => (r.ok ? r.text() : '')),
    ...SOURCE_MODULES.map((modPath) =>
      fetch('./' + modPath).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch ' + modPath + ' (' + r.status + ')');
        return r.text();
      })
    ),
  ]);

  const blobUrls = new Map();

  // Register raw SQL migration module
  const sqlBlob = new Blob([`export default ${JSON.stringify(sqlText)};`], {
    type: 'text/javascript',
  });
  blobUrls.set(RAW_SQL_PATH, URL.createObjectURL(sqlBlob));

  const envReplacement = JSON.stringify({
    BASE_URL: './',
    MODE: 'production',
    DEV: false,
    PROD: true,
    VITE_SUPABASE_URL: 'https://kjsnawvgctdsikexzjfp.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_QIkiS3KZxMr5ct9Y7CrfDQ_ZAt4j42V',
    VITE_SUPABASE_ANON_KEY: '',
  });

  for (let i = 0; i < SOURCE_MODULES.length; i++) {
    const modPath = SOURCE_MODULES[i];
    let rawCode = sourceTexts[i];

    // Remove CSS side-effect imports (already loaded via ./bundle/app.css)
    rawCode = rawCode.replace(/import\s+['"]\.\/index\.css['"];?/g, '');
    // Replace import.meta.env references
    rawCode = rawCode.replace(/import\.meta\.env/g, `(${envReplacement})`);

    let jsCode = transform(rawCode, {
      transforms: ['typescript', 'jsx'],
      jsxRuntime: 'automatic',
      production: true,
    }).code;

    // Rewrite module specifiers in import/export statements
    jsCode = jsCode.replace(
      /(from\s+['"]|import\s*\(\s*['"]|import\s+['"])([^'"]+)(['"])/g,
      (fullMatch, prefix, specifier, suffix) => {
        if (EXTERNAL_MODULES[specifier]) {
          return prefix + EXTERNAL_MODULES[specifier] + suffix;
        }
        if (specifier.startsWith('.')) {
          const resolvedPath = normalizeRepoPath(modPath, specifier);
          const blobUrl = blobUrls.get(resolvedPath);
          if (blobUrl) {
            return prefix + blobUrl + suffix;
          }
        }
        return fullMatch;
      }
    );

    const blob = new Blob([jsCode + `\n//# sourceURL=${modPath}`], {
      type: 'text/javascript',
    });
    blobUrls.set(modPath, URL.createObjectURL(blob));
  }

  const entryBlobUrl = blobUrls.get('src/main.tsx');
  if (!entryBlobUrl) {
    throw new Error('Entry module src/main.tsx was not compiled.');
  }
  await import(entryBlobUrl);
}

bootFromSourceTree().catch((err) => {
  console.error('Failed to initialize Prithvi Editify application:', err);
});
