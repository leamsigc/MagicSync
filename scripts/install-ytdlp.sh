#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# install-ytdlp.sh
#
# Installs the pinned yt-dlp musllinux binary into ./.bin/yt-dlp and verifies
# its sha256 against the release's SHA2-256SUMS file. Used by the Docker builder
# stage; the runtime stage copies the binary and adds ffmpeg.
#
# Overrides:
#   YTDLP_VERSION=2026.08.19           release tag (must contain the asset)
#   YTDLP_ASSET=yt-dlp_musllinux       release asset — use
#                                      yt-dlp_musllinux_aarch64 on arm64
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

YTDLP_VERSION="${YTDLP_VERSION:-2026.08.19}"
YTDLP_ASSET="${YTDLP_ASSET:-yt-dlp_musllinux}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BIN_DIR="${PROJECT_ROOT}/.bin"
BINARY="${BIN_DIR}/yt-dlp"
BASE_URL="https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}"

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 3; }
command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum is required" >&2; exit 3; }

SUMS="$(mktemp)"
trap 'rm -f "${SUMS}" "${BINARY}.tmp"' EXIT

echo "Fetching ${BASE_URL}/SHA2-256SUMS"
curl -fL --retry 3 --retry-delay 2 -o "${SUMS}" "${BASE_URL}/SHA2-256SUMS"

# Resolve the checksum first: a bad pin (or a missing asset for the platform)
# fails here with a readable message instead of a bare curl 404 mid-download.
EXPECTED="$(awk -v asset="${YTDLP_ASSET}" '$2 == asset || $2 == ("*" asset) { print $1; exit }' "${SUMS}")"
if [[ -z "${EXPECTED}" ]]; then
  echo "yt-dlp ${YTDLP_VERSION} has no '${YTDLP_ASSET}' asset. Available musl assets:" >&2
  awk '$2 ~ /musl/ { print "  - " $2 }' "${SUMS}" >&2 || true
  exit 4
fi

# Reuse a cached binary only when it matches the pinned checksum.
if [[ -f "${BINARY}" ]]; then
  CACHED="$(sha256sum "${BINARY}" | awk '{print $1}')"
  if [[ "${CACHED}" == "${EXPECTED}" ]]; then
    echo "✓ yt-dlp ${YTDLP_VERSION} already verified at ${BINARY}"
    exit 0
  fi
  echo "Cached yt-dlp does not match ${YTDLP_VERSION}; re-downloading"
fi

mkdir -p "${BIN_DIR}"
echo "↓ yt-dlp ${YTDLP_VERSION} (${YTDLP_ASSET})"
curl -fL --retry 3 --retry-delay 2 -o "${BINARY}.tmp" "${BASE_URL}/${YTDLP_ASSET}"

ACTUAL="$(sha256sum "${BINARY}.tmp" | awk '{print $1}')"
if [[ "${ACTUAL}" != "${EXPECTED}" ]]; then
  echo "sha256 mismatch for yt-dlp: expected ${EXPECTED}, got ${ACTUAL}" >&2
  exit 4
fi

mv "${BINARY}.tmp" "${BINARY}"
chmod +x "${BINARY}"
echo "✓ yt-dlp ${YTDLP_VERSION} verified at ${BINARY}"
