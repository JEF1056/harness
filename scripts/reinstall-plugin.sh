#!/usr/bin/env bash
set -euo pipefail

CACHE_DIR="$HOME/.cache/opencode/packages/github:JEF1056/harness"

echo "Committing and pushing..."
cd /home/jfan/harness && git add -A
if ! git diff --cached --quiet; then
  git commit -m "chore: update harness plugin"
fi
git push

echo "Clearing cached plugin..."
rm -rf "$CACHE_DIR"

echo "Done. Restart opencode to re-fetch."
