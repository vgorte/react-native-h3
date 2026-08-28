#!/bin/bash
# Releases the workspace: every package publishes itself, then the root owns the commit and the tag.
#
# Usage:
#   scripts/release.sh 0.2.0
#   scripts/release.sh --dry-run --ci
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: scripts/release.sh <version> | scripts/release.sh --dry-run --ci" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

# Verification gate, before the first publish rather than after it
bun install
bun run lint
bun run typecheck
bun run build
bun run specs
bun test

# the parity suite skips itself when its probe is missing, so build the probe and make a miss fatal
cmake -S packages/react-native-h3/cpp/test -B build/host -DCMAKE_BUILD_TYPE=Release
cmake --build build/host --target parity_probe -j
export H3_PARITY_PROBE="${ROOT}/build/host/parity_probe"
export H3_PARITY_REQUIRED=1
bun run --cwd packages/react-native-h3 parity

# Packages: npm publish only, no git operations
for pkg in packages/*; do
  [ -d "$pkg" ] || continue
  (cd "$pkg" && bun release "$@")
done

# Root: the version bump commit, the tag, the changelog and the GitHub release
bun run release-it "$@"
