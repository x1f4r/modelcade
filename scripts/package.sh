#!/bin/sh
# Builds the Chrome Web Store ZIP from the runtime allowlist only.
set -eu
cd "$(dirname "$0")/.."
version=$(node -p "require('./manifest.json').version")
node scripts/check.mjs >/dev/null
mkdir -p releases
out="releases/modelcade-$version.zip"
rm -f "$out"
zip -q -r -X "$out" manifest.json icons src assets/brand/modelcade-mark.svg LICENSE -x "*.DS_Store"
unzip -tq "$out"
echo "$out"
