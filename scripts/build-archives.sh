#!/usr/bin/env bash
#
# build-archives.sh
#
# Zips each plugin directory under plugins/ into dist/<plugin-name>.zip
# suitable for attaching to a GitHub release.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGINS_DIR="$REPO_ROOT/plugins"
DIST_DIR="$REPO_ROOT/dist"

# Clean and create dist directory
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Build admin components first
echo "Building admin components..."
node "$REPO_ROOT/scripts/build-admin-components.js"
echo ""

# Build server bundles
echo "Building server bundles..."
node "$REPO_ROOT/scripts/build-server-bundle.js"
echo ""

echo "Building plugin archives..."

for plugin_dir in "$PLUGINS_DIR"/*/; do
  plugin_name="$(basename "$plugin_dir")"

  if [ ! -f "$plugin_dir/manifest.json" ]; then
    echo "  Skipping $plugin_name (no manifest.json)"
    continue
  fi

  version="$(python3 -c "import json; print(json.load(open('$plugin_dir/manifest.json'))['version'])")"
  archive="$DIST_DIR/${plugin_name}.zip"

  echo "  Packaging $plugin_name v$version -> $archive"

  # Create zip from within the plugins directory so the archive
  # contains the plugin folder at the top level
  (cd "$PLUGINS_DIR" && zip -r "$archive" "$plugin_name" -x '*/__pycache__/*' '*/node_modules/*' '*/.DS_Store')

  echo "  Done: $(du -h "$archive" | cut -f1) compressed"
done

echo ""
echo "Archives ready in $DIST_DIR/"
ls -lh "$DIST_DIR/"
