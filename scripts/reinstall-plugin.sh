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

# ── 2. Read and validate version from extracted package.json ──────────────────
VERSION=$(jq -r '.version // empty' "$SRC/package.json")
if [[ -z "$VERSION" ]]; then
  echo "ERROR: version field missing or null in $SRC/package.json" >&2
  exit 1
fi
echo "Version: $VERSION"

# ── 3. Build staging path (install here first, then move atomically) ─────────
STAGING="$CACHE_BASE/github:${REPO}@staging/node_modules/${PKG_NAME}"
mkdir -p "$STAGING"

# ── 4. Copy plugin files to staging directory ────────────────────────────────
echo "Staging plugin files..."

# Copy dist/
mkdir -p "$STAGING/dist"
cp "$SRC/dist/"* "$STAGING/dist/"

# Copy opencode.json, harness.json, harness.json.example
cp "$SRC/opencode.json" "$STAGING/"
cp "$SRC/harness.json" "$STAGING/"
cp "$SRC/harness.json.example" "$STAGING/"

# Copy assets/
cp -r "$SRC/assets/" "$STAGING/assets/"

# Create package.json in staging directory (Bun needs it)
cp "$SRC/package.json" "$STAGING/package.json"

# ── 5. Verify staging succeeded (dist/ must contain files) ──────────────────
if [[ -z "$(ls -A "$STAGING/dist/")" ]]; then
  echo "ERROR: staging failed — dist/ directory empty" >&2
  rm -rf "$CACHE_BASE/github:${REPO}@staging"
  exit 1
fi

# ── 6. Clear old cached versions (safe — staging is verified) ──────────────
echo "Clearing old cache..."
# Remove all versions of this package from cache (not @staging)
for old_dir in "$CACHE_BASE"/github:${REPO}@*/*/node_modules/${PKG_NAME}; do
  [[ -d "$old_dir" ]] && rm -rf "$old_dir"
done

# ── 7. Move staging to final cache location ─────────────────────────────────
CACHE_DIR="$CACHE_BASE/github:${REPO}@${VERSION}/node_modules/${PKG_NAME}"
mkdir -p "$(dirname "$CACHE_DIR")"
mv "$STAGING" "$CACHE_DIR"

# ── 8. Success ────────────────────────────────────────────────────────────────
echo "✓ Harness plugin installed successfully."
echo "  Cache path: $CACHE_DIR"
echo "  Version:    $VERSION"
echo ""
echo "Restart opencode to pick up the plugin."
