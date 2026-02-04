# CFP Directory Official Plugins

Official plugin repository for [CFP Directory](https://github.com/l33tdawg/cfp-directory-self-hosted). This repo hosts plugin source code and the `registry.json` that the plugin gallery fetches.

## Available Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| [AI Paper Reviewer](plugins/ai-paper-reviewer/) | 1.28.0 | Intelligent submission analysis with cost tracking, budget management, speaker context, criteria-based scoring, and Google Search grounding for fact-checking |
| [Example: Webhook Notifications](plugins/example-webhook/) | 1.1.0 | A starter template for plugin developers demonstrating hooks, config schemas, HMAC signatures, and background job retries |

## How It Works

The CFP Directory admin panel includes a **Plugins Gallery** that fetches `registry.json` from this repository. Each entry in the registry points to a downloadable zip file attached to a GitHub release.

### For Users

1. Open your CFP Directory admin panel
2. Go to **Admin > Plugins > Available Plugins**
3. Browse the gallery and click **Install** on any plugin
4. Configure the plugin settings and enable it

### For Plugin Developers

See the [Plugin SDK Guide](https://github.com/l33tdawg/cfp-directory-self-hosted/blob/main/docs/PLUGIN-SDK.md) for comprehensive documentation on building plugins, including:
- Manifest format and configuration schemas
- Hooks API (submission, review, event, email lifecycle events)
- Capabilities (submissions, users, reviews, events, storage, email, data store)
- Background jobs with retry support
- UI extension slots and admin pages
- Service account creation

Use the `example-webhook` plugin in this repo as a starter template.

## Repository Structure

```
cfp-directory-official-plugins/
├── registry.json                    # Gallery fetches this
├── plugins/
│   ├── ai-paper-reviewer/          # AI-powered submission analysis
│   │   ├── README.md
│   │   ├── manifest.json
│   │   ├── index.ts
│   │   ├── components/
│   │   │   ├── ai-review-panel.tsx
│   │   │   ├── admin-sidebar-item.tsx
│   │   │   ├── admin-dashboard.tsx
│   │   │   ├── admin-review-history.tsx
│   │   │   └── admin-personas.tsx
│   │   ├── lib/
│   │   │   ├── prompts.ts
│   │   │   ├── providers.ts
│   │   │   ├── json-repair.ts
│   │   │   └── similarity.ts
│   │   └── dist/                    # Pre-compiled admin bundles (generated)
│   │       ├── admin-pages.js
│   │       ├── admin-pages.js.map
│   │       └── admin-pages.manifest.json
│   └── example-webhook/             # Developer starter template
│       ├── manifest.json
│       └── index.ts
├── tests/
│   └── ai-paper-reviewer/          # Plugin tests
├── docs/
│   └── ai-paper-reviewer.md        # Extended documentation
└── scripts/
    ├── build-archives.sh           # Builds release zips
    └── build-admin-components.js   # Compiles admin page components
```

## Building Release Archives

To create zip archives for a GitHub release:

```bash
npm run build
```

This runs two steps:
1. **Compiles admin components** - Uses esbuild to bundle admin page components (`components/admin-*.tsx`) into browser-ready JavaScript (`dist/admin-pages.js`). These bundles use the host app's React instance via window globals.
2. **Creates zip archives** - Packages each plugin (including the compiled bundles) into `dist/<plugin-name>.zip`

Attach the zip to a GitHub release matching the `downloadUrl` pattern in `registry.json`.

### Admin Component Compilation

Plugin admin pages (like Review History and Personas) use React hooks and need to run client-side. The build process:
- Compiles TypeScript/JSX to browser-ready IIFE bundles
- Replaces React imports with `window.__PLUGIN_REACT__` (provided by host app)
- Bundles dependencies like lucide-react icons
- Generates a manifest listing available components

This allows plugins to provide interactive admin UIs without requiring runtime transpilation.

## Creating a Release

1. Update the plugin version in `manifest.json` and `registry.json`
2. Run `./scripts/build-archives.sh`
3. Create a GitHub release tagged as `v<version>` (e.g., `v1.28.0`)
4. Attach the zip from `dist/` to the release

## Adding a New Plugin

1. Create a new directory under `plugins/<plugin-name>/`
2. Add `manifest.json`, `index.ts`, and a `README.md`
3. Add tests under `tests/<plugin-name>/`
4. Add an entry to `registry.json`
5. Run `./scripts/build-archives.sh` to verify packaging

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.
