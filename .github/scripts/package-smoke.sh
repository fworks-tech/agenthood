#!/usr/bin/env bash
set -euo pipefail

# Package smoke test: pack the tarball, verify required files, install it into
# a scratch project, and confirm the CLI runs.
# Regression gate for #391/#392: scripts/postinstall.mjs was omitted from the
# files whitelist, breaking consumers' npm install with MODULE_NOT_FOUND.

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT
PACK_DIR="$WORK_DIR/pack"
SCRATCH_DIR="$WORK_DIR/scratch"

echo "The Envoy: building"
npm run build >/dev/null

mkdir -p "$PACK_DIR"
npm pack --pack-destination "$PACK_DIR" >/dev/null
TARBALL=$(ls "$PACK_DIR"/agenthood-*.tgz)

echo "The Envoy: verifying tarball contents ($(basename "$TARBALL"))"
# No grep -q here: -q closes the pipe on first match and the resulting
# SIGPIPE to tar intermittently false-fails the check (see #394 review).
if ! FILES=$(tar -tzf "$TARBALL"); then
  echo "The Envoy: failed to read tarball $TARBALL" >&2
  exit 1
fi
for required in \
  "package/dist/cli.js" \
  "package/scripts/postinstall.mjs" \
  "package/AGENTS.md" \
  "package/skills/the-scribe/SKILL.md" \
  "package/docs/members/registry.json"; do
  if ! grep -x "$required" >/dev/null <<<"$FILES"; then
    echo "The Envoy: tarball missing required file: $required" >&2
    echo "$FILES"
    exit 1
  fi
done

echo "The Envoy: installing tarball into scratch project"
# Lifecycle scripts run here (the consumer path); the repo install
# above suppresses them with --ignore-scripts.
mkdir -p "$SCRATCH_DIR"
pushd "$SCRATCH_DIR" >/dev/null
npm init -y >/dev/null
npm install "$TARBALL" --no-audit --no-fund >/dev/null
OUTPUT=$(npx agenthood list 2>&1)
if ! grep "The Society" >/dev/null <<<"$OUTPUT"; then
  echo "The Envoy: CLI smoke check failed - expected member listing" >&2
  echo "$OUTPUT"
  exit 1
fi
popd >/dev/null

echo "The Envoy: published artifact installs and CLI runs."
