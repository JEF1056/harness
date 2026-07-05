#!/usr/bin/env bash
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO="JEF1056/harness"
BRANCH="main"
PKG_NAME="@jef1056/opencode-harness"
CACHE_BASE="$HOME/.cache/opencode/packages"
TARBALL_URL="https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}"

# ── 1. Download and extract tarball to a temp directory ───────────────────────
TMPDIR_WORK="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_WORK"' EXIT

echo "Downloading ${REPO} (${BRANCH})..."
curl -fsSL "$TARBALL_URL" | tar xzf - -C "$TMPDIR_WORK"

# The tarball extracts to $TMPDIR_WORK/harness-main/
SRC="$TMPDIR_WORK/harness-main"

# ── 2. Read version from extracted package.json ───────────────────────────────
VERSION=$(jq -r '.version' "$SRC/package.json")
echo "Version: $VERSION"

# ── 3. Build the target cache path ────────────────────────────────────────────
CACHE_DIR="$CACHE_BASE/github:${REPO}@${VERSION}/node_modules/${PKG_NAME}"

# ── 4. Clear any existing cached version of this plugin ──────────────────────
echo "Clearing old cache..."
# Remove all versions of this package from cache
for old_dir in "$CACHE_BASE"/github:${REPO}@*/; do
  [ -d "$old_dir" ] && rm -rf "$old_dir"
done

# ── 5. Create target directory structure ─────────────────────────────────────
mkdir -p "$CACHE_DIR"

# ── 6. Copy plugin files ─────────────────────────────────────────────────────
echo "Installing plugin files..."

# Copy dist/
mkdir -p "$CACHE_DIR/dist"
cp "$SRC/dist/"* "$CACHE_DIR/dist/"

# Copy opencode.json, harness.json, harness.json.example
cp "$SRC/opencode.json" "$CACHE_DIR/"
cp "$SRC/harness.json" "$CACHE_DIR/"
cp "$SRC/harness.json.example" "$CACHE_DIR/"

# Copy assets/
cp -r "$SRC/assets/" "$CACHE_DIR/assets/"

# ── 7. Create package.json in cache directory (Bun needs it) ─────────────────
cp "$SRC/package.json" "$CACHE_DIR/package.json"

# ── 8. Success ───────────────────────────────────────────────────────────────
echo "✓ Harness plugin installed successfully."
echo "  Cache path: $CACHE_DIR"
echo "  Version:    $VERSION"
echo ""
echo "Restart opencode to pick up the plugin."
