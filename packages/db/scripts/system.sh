#!/bin/bash

# Generate Ed25519 keys for local Turso/libsql development
# Usage: ./scripts/system.sh [rw|ro]
#   rw - read/write access (default)
#   ro - read-only access

cd "$(dirname "$0")/.." || exit 1

ACCESS="${1:-rw}"

node scripts/generate-db-keys.mjs "$ACCESS"