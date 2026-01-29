#!/usr/bin/env node
/**
 * build-admin-components.js
 *
 * Compiles plugin admin page components to browser-ready JavaScript bundles.
 * These bundles can be loaded client-side without runtime transpilation.
 *
 * Output: plugins/<plugin-name>/dist/admin-pages.js
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

/**
 * esbuild plugin to replace React imports with window globals
 */
const reactGlobalsPlugin = {
  name: 'react-globals',
  setup(build) {
    // Handle 'react' imports
    build.onResolve({ filter: /^react$/ }, args => ({
      path: args.path,
      namespace: 'react-global',
    }));

    build.onLoad({ filter: /.*/, namespace: 'react-global' }, () => ({
      contents: `
        const React = window.__PLUGIN_REACT__;
        export default React;
        export const {
          useState, useEffect, useMemo, useRef, useCallback,
          forwardRef, createElement, Fragment, memo, useContext,
          createContext, useReducer, useLayoutEffect, Children,
          cloneElement, isValidElement, lazy, Suspense
        } = React;
      `,
      loader: 'js',
    }));

    // Handle 'react/jsx-runtime' imports
    build.onResolve({ filter: /^react\/jsx-runtime$/ }, args => ({
      path: args.path,
      namespace: 'jsx-runtime-global',
    }));

    build.onLoad({ filter: /.*/, namespace: 'jsx-runtime-global' }, () => ({
      contents: `
        const jsxRuntime = window.__PLUGIN_JSX_RUNTIME__;
        export const jsx = jsxRuntime.jsx;
        export const jsxs = jsxRuntime.jsxs;
        export const Fragment = jsxRuntime.Fragment;
      `,
      loader: 'js',
    }));

    // Handle '@/lib/plugins' type imports (strip them)
    build.onResolve({ filter: /^@\/lib\/plugins/ }, args => ({
      path: args.path,
      namespace: 'plugin-types',
    }));

    build.onLoad({ filter: /.*/, namespace: 'plugin-types' }, () => ({
      contents: `export const PluginComponentProps = {};`,
      loader: 'js',
    }));
  },
};

async function buildPluginAdminComponents(pluginDir) {
  const pluginName = path.basename(pluginDir);
  const manifestPath = path.join(pluginDir, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.log(`  Skipping ${pluginName} (no manifest.json)`);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Check if plugin has admin pages defined
  const indexPath = path.join(pluginDir, 'index.ts');
  if (!fs.existsSync(indexPath)) {
    console.log(`  Skipping ${pluginName} (no index.ts)`);
    return;
  }

  // Find admin component files
  const componentsDir = path.join(pluginDir, 'components');
  if (!fs.existsSync(componentsDir)) {
    console.log(`  Skipping ${pluginName} (no components directory)`);
    return;
  }

  // Read index.ts to find which components are used in adminPages
  const indexContent = fs.readFileSync(indexPath, 'utf-8');

  // Look for admin page components (exclude sidebar items)
  const adminComponents = fs.readdirSync(componentsDir)
    .filter(f => {
      if (!f.endsWith('.tsx')) return false;
      // Include files that are admin pages, not sidebar items
      if (f.includes('sidebar')) return false;
      // Check if it's used in adminPages
      const componentName = getExportedNameFromFile(path.join(componentsDir, f));
      return indexContent.includes(`component: ${componentName}`);
    });

  if (adminComponents.length === 0) {
    console.log(`  Skipping ${pluginName} (no admin page components)`);
    return;
  }

  console.log(`  Building ${pluginName} admin components: ${adminComponents.join(', ')}`);

  // Create dist directory
  const distDir = path.join(pluginDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Create an entry file that exports all admin components
  const entryContent = adminComponents.map((file) => {
    const name = file.replace('.tsx', '');
    return `export { ${getExportedNameFromFile(path.join(componentsDir, file))} } from './components/${name}';`;
  }).join('\n');

  const entryFile = path.join(pluginDir, '_admin-entry.ts');
  fs.writeFileSync(entryFile, entryContent);

  try {
    // Build with esbuild - IIFE format for browser loading
    const globalName = `__PLUGIN_${pluginName.replace(/-/g, '_').toUpperCase()}__`;

    await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      format: 'iife',
      globalName: globalName,
      outfile: path.join(distDir, 'admin-pages.js'),
      platform: 'browser',
      target: ['es2020'],
      jsx: 'automatic',
      jsxImportSource: 'react',
      plugins: [reactGlobalsPlugin],
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
      },
      minify: false,  // Keep readable for debugging
      sourcemap: true,
    });

    // Create a manifest of exported components
    const componentManifest = {
      version: manifest.version,
      buildTime: new Date().toISOString(),
      globalName: globalName,
      components: adminComponents.map(file => {
        const name = getExportedNameFromFile(path.join(componentsDir, file));
        return {
          file: file,
          exportName: name,
        };
      }),
    };

    fs.writeFileSync(
      path.join(distDir, 'admin-pages.manifest.json'),
      JSON.stringify(componentManifest, null, 2)
    );

    console.log(`  ✓ Built ${pluginName}/dist/admin-pages.js (global: ${globalName})`);
    console.log(`  ✓ Created ${pluginName}/dist/admin-pages.manifest.json`);
  } finally {
    // Clean up entry file
    fs.unlinkSync(entryFile);
  }
}

/**
 * Extract the exported component name from a file
 */
function getExportedNameFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Match "export function ComponentName" or "export const ComponentName"
  const funcMatch = content.match(/export\s+function\s+(\w+)/);
  if (funcMatch) return funcMatch[1];
  const constMatch = content.match(/export\s+const\s+(\w+)/);
  if (constMatch) return constMatch[1];
  // Fallback to filename-based name
  const name = path.basename(filePath, '.tsx');
  return name.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

async function main() {
  console.log('Building plugin admin components...\n');

  const plugins = fs.readdirSync(PLUGINS_DIR)
    .filter(f => fs.statSync(path.join(PLUGINS_DIR, f)).isDirectory());

  for (const plugin of plugins) {
    await buildPluginAdminComponents(path.join(PLUGINS_DIR, plugin));
  }

  console.log('\nDone!');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
