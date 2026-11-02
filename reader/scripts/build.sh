#!/usr/bin/env bash
# bash scripts/build.sh — bundle into dist/ and type-check
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/bundle.mjs
npx tsc -p tsconfig.reader.json
chmod +x dist/cli.cjs
echo "[build] ok"
