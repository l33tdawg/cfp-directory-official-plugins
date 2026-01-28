# CFP Directory Official Plugins

Official plugin repository for [CFP Directory](https://github.com/l33tdawg/cfp-directory-self-hosted). This repo hosts plugin source code and the `registry.json` that the plugin gallery fetches.

## Available Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| [AI Paper Reviewer](plugins/ai-paper-reviewer/) | 1.1.0 | Intelligent submission analysis with event-aware criteria, duplicate detection, and confidence thresholds |

## How It Works

The CFP Directory admin panel includes a **Plugins Gallery** that fetches `registry.json` from this repository. Each entry in the registry points to a downloadable zip file attached to a GitHub release.

### For Users

1. Open your CFP Directory admin panel
2. Go to **Admin > Plugins > Available Plugins**
3. Browse the gallery and click **Install** on any plugin
4. Configure the plugin settings and enable it

### For Plugin Developers

See the [CFP Directory Plugin SDK documentation](https://github.com/l33tdawg/cfp-directory-self-hosted) for details on building plugins. The main repo includes example plugins (`example-logger` and `example-webhook`) to get started.

## Repository Structure

```
cfp-directory-official-plugins/
├── registry.json                    # Gallery fetches this
├── plugins/
│   └── ai-paper-reviewer/          # Plugin source code
│       ├── README.md
│       ├── manifest.json
│       ├── index.ts
│       ├── components/
│       │   └── ai-review-panel.tsx
│       └── lib/
│           ├── prompts.ts
│           ├── providers.ts
│           ├── json-repair.ts
│           └── similarity.ts
├── tests/
│   └── ai-paper-reviewer/          # Plugin tests
├── docs/
│   └── ai-paper-reviewer.md        # Extended documentation
└── scripts/
    └── build-archives.sh           # Builds release zips
```

## Building Release Archives

To create zip archives for a GitHub release:

```bash
./scripts/build-archives.sh
```

This produces a zip for each plugin in the `dist/` directory. Attach the zip to a GitHub release matching the `downloadUrl` pattern in `registry.json`.

## Creating a Release

1. Update the plugin version in `manifest.json` and `registry.json`
2. Run `./scripts/build-archives.sh`
3. Create a GitHub release tagged as `<plugin-name>-v<version>` (e.g., `ai-paper-reviewer-v1.1.0`)
4. Attach the zip from `dist/` to the release

## Adding a New Plugin

1. Create a new directory under `plugins/<plugin-name>/`
2. Add `manifest.json`, `index.ts`, and a `README.md`
3. Add tests under `tests/<plugin-name>/`
4. Add an entry to `registry.json`
5. Run `./scripts/build-archives.sh` to verify packaging

## License

MIT
