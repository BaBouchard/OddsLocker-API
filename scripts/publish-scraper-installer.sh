#!/usr/bin/env bash
# Push terminal code, publish installer + .env zip to GitHub Releases, set Railway SCRAPER_INSTALLER_URL.
# Prerequisites (one time): gh auth login && npx @railway/cli login
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Sync scraper-release.json, .env template, and release zip"
node scripts/sync-scraper-release.js

read_manifest() {
  node -p "JSON.parse(require('fs').readFileSync('terminal/scraper-release.json','utf8')).$1"
}

VERSION="$(read_manifest version)"
FILENAME="$(read_manifest filename)"
ENV_FILENAME="$(read_manifest envFilename)"
BUNDLE_FILENAME="$(read_manifest bundleFilename)"
INSTALLER="$ROOT/desktop/release/$FILENAME"
ENV_FILE="$ROOT/terminal/downloads/$ENV_FILENAME"
BUNDLE="$ROOT/terminal/downloads/$BUNDLE_FILENAME"
TAG="scraper-v${VERSION}"

if [[ ! -f "$INSTALLER" ]]; then
  echo "Missing installer: $INSTALLER"
  echo "Build it first: cd desktop && npm run dist"
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env template: $ENV_FILE"
  exit 1
fi
if [[ ! -f "$BUNDLE" ]]; then
  echo "Missing release zip: $BUNDLE"
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

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
ENCODED_BUNDLE="$(node -p "encodeURIComponent(process.argv[1])" "$BUNDLE_FILENAME")"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${TAG}/${ENCODED_BUNDLE}"

echo "==> GitHub release ${TAG}"
if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "$BUNDLE" "$INSTALLER" "$ENV_FILE" --clobber
  echo "Updated existing release assets."
else
  gh release create "$TAG" "$BUNDLE" "$INSTALLER" "$ENV_FILE" \
    --title "OddsLocker Scraper ${VERSION}" \
    --notes "Windows installer, versioned .env template (${ENV_FILENAME}), and ${BUNDLE_FILENAME} bundle."
fi

echo ""
echo "Download bundle URL (set on Railway as SCRAPER_INSTALLER_URL):"
echo "  ${DOWNLOAD_URL}"
echo ""

RAILWAY_CMD=""
if command -v railway >/dev/null && railway whoami >/dev/null 2>&1; then
  RAILWAY_CMD=railway
elif npx --yes @railway/cli whoami >/dev/null 2>&1; then
  RAILWAY_CMD="npx @railway/cli"
fi

if [[ -n "$RAILWAY_CMD" ]]; then
  echo "==> Set SCRAPER_INSTALLER_URL on linked Railway service"
  $RAILWAY_CMD variables set "SCRAPER_INSTALLER_URL=${DOWNLOAD_URL}"
  echo "Railway will redeploy with the new variable."
else
  echo "Railway CLI not logged in. In Railway dashboard, set:"
  echo "  SCRAPER_INSTALLER_URL=${DOWNLOAD_URL}"
fi

echo ""
echo "Done. Download button serves ${BUNDLE_FILENAME} (installer + ${ENV_FILENAME})."
