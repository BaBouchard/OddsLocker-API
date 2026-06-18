#!/usr/bin/env bash
# Push terminal code, publish installer to GitHub Releases.
# Download URL on the terminal site is built automatically from terminal/scraper-release.json
# (githubRepo + version) — no Railway URL update needed each release.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Sync scraper-release.json from desktop/package.json"
node scripts/sync-scraper-release.js

read_manifest() {
  node -p "JSON.parse(require('fs').readFileSync('terminal/scraper-release.json','utf8')).$1"
}

VERSION="$(read_manifest version)"
FILENAME="$(read_manifest filename)"
REPO="$(read_manifest githubRepo)"
INSTALLER="$ROOT/desktop/release/$FILENAME"
TAG="scraper-v${VERSION}"

if [[ ! -f "$INSTALLER" ]]; then
  echo "Missing installer: $INSTALLER"
  echo "Build it first: cd desktop && npm run dist"
  exit 1
fi

if ! command -v gh >/dev/null; then
  echo "Install GitHub CLI: brew install gh && gh auth login"
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

echo "==> Push main"
git push origin main

ENCODED_NAME="$(node -p "encodeURIComponent(process.argv[1])" "$FILENAME")"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${ENCODED_NAME}"

echo "==> GitHub release ${TAG}"
if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "$INSTALLER" --clobber
  echo "Updated existing release asset."
else
  gh release create "$TAG" "$INSTALLER" \
    --title "OddsLocker Scraper ${VERSION}" \
    --notes "Windows NSIS installer for OddsLocker Scraper ${VERSION}. Books .env is bundled inside the app."
fi

echo ""
echo "Auto download URL (terminal builds this from scraper-release.json after deploy):"
echo "  ${DOWNLOAD_URL}"
echo ""
echo "Optional: remove SCRAPER_INSTALLER_URL from Railway — githubRepo in the manifest is enough."
echo "Done."
