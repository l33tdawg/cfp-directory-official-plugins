#!/usr/bin/env node
/**
 * build-server-bundle.js
 *
 * Compiles each plugin's server-side code (index.ts + lib/) into a single
 * ESM bundle suitable for import() at runtime — no jiti or runtime TS
 * compilation required.
 *
 * Output: plugins/<plugin-name>/dist/server.mjs
 *
 * - Stubs out ./components/* imports (React components are client-only,
 *   already handled by admin-pages.js)
 * - Stubs out @/lib/plugins imports (all are `import type` — erased at compile)
 * - Bundles manifest.json via JSON loader
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

/**
 * esbuild plugin to stub out client-only and platform imports
 */
const serverStubsPlugin = {
  name: 'server-stubs',
  setup(build) {
    // Stub out all component imports — these are React components that
    // only run in the browser via admin-pages.js.
    // We need to scan the actual component file for its export names and
    // generate matching stub exports so the bundle resolves cleanly.
    build.onResolve({ filter: /^\.\/components\// }, (args) => {
      // Resolve to the actual file path so we can read its exports
      const dir = path.dirname(args.importer);
      const resolved = path.resolve(dir, args.path);
      // Try .tsx then .ts
      const candidates = [resolved + '.tsx', resolved + '.ts', resolved];
      let filePath = null;
      for (const c of candidates) {
        if (fs.existsSync(c)) { filePath = c; break; }
      }
      return {
        path: filePath || resolved,
        namespace: 'component-stub',
      };
    });

    build.onLoad({ filter: /.*/, namespace: 'component-stub' }, (args) => {
      // Read the source file and extract exported names
      let exportNames = [];
      try {
        const src = fs.readFileSync(args.path, 'utf-8');
        // Match "export function Name", "export const Name", "export class Name"
        const re = /export\s+(?:function|const|class)\s+(\w+)/g;
        let m;
        while ((m = re.exec(src)) !== null) {
          exportNames.push(m[1]);
        }
        // Also match "export default function Name" for default exports
        const defaultRe = /export\s+default\s+(?:function|class)\s+(\w+)/;
        const dm = src.match(defaultRe);
        if (dm) {
          // Already captured by the general regex, but ensure default is also provided
        }
      } catch {
        // File not found — provide a generic stub
      }

      const stub = () => null;
      const lines = exportNames.map(
        (name) => `export function ${name}() { return null; }`
      );
      // Always provide a default export
      lines.push(`export default function Stub() { return null; }`);

      return {
        contents: lines.join('\n'),
        loader: 'js',
      };
    });

    // Stub out @/lib/plugins imports — these are all `import type` in plugin
    // source, but esbuild doesn't strip them if isolatedModules isn't perfect.
    // Provide a minimal stub so the bundle resolves cleanly.
    build.onResolve({ filter: /^@\/lib\/plugins/ }, (args) => ({
      path: args.path,
      namespace: 'platform-types-stub',
    }));

    build.onLoad({ filter: /.*/, namespace: 'platform-types-stub' }, () => ({
      contents: `export {};`,
      loader: 'js',
    }));

    // Stub out react — server-side plugin code doesn't render components,
    // but some type-level imports or re-exports might reference it
    build.onResolve({ filter: /^react(\/.*)?$/ }, (args) => ({
      path: args.path,
      namespace: 'react-stub',
    }));

    build.onLoad({ filter: /.*/, namespace: 'react-stub' }, () => ({
      contents: `export default {}; export const createElement = () => null;`,
      loader: 'js',
    }));
  },
};

async function buildPluginServerBundle(pluginDir) {
  const pluginName = path.basename(pluginDir);
  const entryPath = path.join(pluginDir, 'index.ts');

  if (!fs.existsSync(entryPath)) {
    console.log(`  Skipping ${pluginName} (no index.ts)`);
    return;
  }

  if (!fs.existsSync(path.join(pluginDir, 'manifest.json'))) {
    console.log(`  Skipping ${pluginName} (no manifest.json)`);
    return;
  }

  console.log(`  Building ${pluginName} server bundle...`);

  // Create dist directory
  const distDir = path.join(pluginDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    outfile: path.join(distDir, 'server.mjs'),
    plugins: [serverStubsPlugin],
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.json': 'json',
    },
    // Keep readable for debugging
    minify: false,
    sourcemap: true,
    // Banner to identify the bundle
    banner: {
      js: `// Server bundle for ${pluginName} — auto-generated, do not edit`,
    },
  });

  console.log(`  \u2713 Built ${pluginName}/dist/server.mjs`);
}

async function main() {
  console.log('Building plugin server bundles...\n');

  const plugins = fs.readdirSync(PLUGINS_DIR)
    .filter((f) => fs.statSync(path.join(PLUGINS_DIR, f)).isDirectory());

  for (const plugin of plugins) {
    await buildPluginServerBundle(path.join(PLUGINS_DIR, plugin));
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Server bundle build failed:', err);
  process.exit(1);
});
