#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# tts_assets_folder.sh
#
# Downloads the Supertonic-3 ONNX model weights (~340 MB) and voice-style JSONs
# from HuggingFace into packages/site/public/assets/onnx/ and
# packages/site/public/assets/voice_styles/. The directory is .gitignored so the
# repo stays small and git pushes stay under GitHub's 100 MB file-size limit.
#
# Default source:
#   https://huggingface.co/spaces/Supertone/supertonic-3/tree/main/assets
# Pin a specific revision with HF_REVISION=<sha-or-branch>.
#
# Usage:
#   ./scripts/tts_assets_folder.sh                  # skip files already present
#   ./scripts/tts_assets_folder.sh --force          # re-download everything
#   ./scripts/tts_assets_folder.sh --dry-run        # show what would be fetched
#   ./scripts/tts_assets_folder.sh --quiet          # minimal output
#   HF_REVISION=abc123 ./scripts/tts_assets_folder.sh
#
# Exit codes:
#   0 — all files present (and verified)
#   1 — one or more downloads failed
#   2 — invalid arguments
#   3 — required tool (curl) missing
#   4 — source URL unreachable / network error
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
SCRIPT_NAME="$(basename "$0")"
HF_REPO="spaces/Supertone/supertonic-3"
HF_REVISION="${HF_REVISION:-main}"
HF_BASE_URL="https://huggingface.co/${HF_REPO}/resolve/${HF_REVISION}/assets"
HF_TREE_URL="https://huggingface.co/${HF_REPO}/tree/${HF_REVISION}/assets"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ASSETS_DIR="${PROJECT_ROOT}/packages/site/public/assets"
ONNX_DIR="${ASSETS_DIR}/onnx"
VOICE_DIR="${ASSETS_DIR}/voice_styles"

# Files to download (relative to the assets/ tree on HF)
ONNX_FILES=(
  duration_predictor.onnx
  text_encoder.onnx
  vector_estimator.onnx
  vocoder.onnx
  tts.json
  unicode_indexer.json
)
VOICE_FILES=(
  F1.json F2.json F3.json F4.json F5.json
  M1.json M2.json M3.json M4.json M5.json
)

# ─── Color output (matches scripts/system.sh style, with NO_COLOR support) ───
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; NC=''
fi
info() { [[ ${QUIET} -eq 0 ]] && echo -e "${CYAN}[tts]${NC} $*" >&2 || true; }
ok()   { [[ ${QUIET} -eq 0 ]] && echo -e "${GREEN}[tts]${NC} $*" >&2 || true; }
warn() { [[ ${QUIET} -eq 0 ]] && echo -e "${YELLOW}[tts]${NC} $*" >&2 || true; }
# Errors always print to stderr regardless of --quiet (intentional bypass).
err()  { echo -e "${RED}[tts]${NC} $*" >&2; }
hdr()  { [[ ${QUIET} -eq 0 ]] && echo -e "${BLUE}$*${NC}" >&2 || true; }

# ─── Cleanup: wipe any *.part files if we're killed mid-download ─────────────
cleanup() {
  local rc=$?
  rm -f "${ONNX_DIR}"/*.part "${VOICE_DIR}"/*.part 2>/dev/null || true
  exit "${rc}"
}
trap cleanup EXIT INT TERM

# ─── Usage ────────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
$SCRIPT_NAME — download Supertonic-3 TTS assets from HuggingFace

Usage:
  $SCRIPT_NAME [options]

Options:
  --force         Re-download even if the local file already exists
  --dry-run       Print what would be downloaded without downloading
  --quiet, -q     Suppress progress output (errors still print)
  --help, -h      Show this help

Environment:
  HF_REVISION     HuggingFace commit / branch / tag to pin to (default: main)
  NO_COLOR        Set to any value to disable ANSI color output

Source:
  $HF_TREE_URL

Destination:
  $ASSETS_DIR/{onnx,voice_styles}/
EOF
}

# ─── CLI parsing ──────────────────────────────────────────────────────────────
FORCE=0
DRY_RUN=0
QUIET=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)    usage; exit 0 ;;
    --force)      FORCE=1 ;;
    --dry-run)    DRY_RUN=1 ;;
    --quiet|-q)   QUIET=1 ;;
    -*)           err "Unknown flag: $1"; usage >&2; exit 2 ;;
    *)            err "Unknown arg: $1"; usage >&2; exit 2 ;;
  esac
  shift
done

# ─── Sanity checks ───────────────────────────────────────────────────────────
need() {
  if ! command -v "$1" &>/dev/null; then
    err "Missing required tool: $1"
    exit 3
  fi
}
need curl

# ─── Helpers ─────────────────────────────────────────────────────────────────
# human-readable size: 1234567 -> "1.2 MB"
hr_size() {
  local bytes=$1
  awk -v b="$bytes" 'BEGIN {
    if (b < 1024) printf "%d B", b
    else if (b < 1048576) printf "%.1f KB", b/1024
    else if (b < 1073741824) printf "%.1f MB", b/1024
    else printf "%.2f GB", b/1073741824
  }'
}

# File size in bytes (Linux or macOS)
file_size() {
  stat -c %s "$1" 2>/dev/null || stat -f %z "$1" 2>/dev/null || echo 0
}

# Verify that a HF URL resolves (200/302/307 — 302/307 are normal CDN redirects)
verify_url() {
  local url=$1
  local code
  code=$(curl -sIL --max-time 30 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "000")
  case "$code" in
    200|302|307) return 0 ;;
    *) return 1 ;;
  esac
}

# HEAD request that returns Content-Length (or 0 on timeout / non-2xx).
# HF's CDN occasionally omits Content-Length on HEAD; callers should treat 0
# as "size unknown" rather than a fatal error.
remote_size() {
  local url=$1
  local line
  line=$(curl -sIL --max-time 30 -o /dev/null -w '%{http_code} %{size_download}\n' "$url" 2>/dev/null | tail -1 || true)
  if [[ "${line}" =~ ^(200|302|307)\ ([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[2]}"
  else
    echo 0
  fi
}

# Download a single file atomically with Content-Length verification.
# Args: url dest
download_one() {
  local url=$1 dest=$2
  local tmp="${dest}.part"
  local expected actual

  if [[ ${DRY_RUN} -eq 1 ]]; then
    info "would download $(basename "$dest")"
    return 0
  fi

  expected=$(remote_size "$url")
  info "↓ $(basename "$dest") (~$(hr_size "$expected"))"

  if curl --fail --location --retry 3 --retry-delay 2 --connect-timeout 30 \
         --max-time 1800 --silent --show-error \
         --output "$tmp" "$url"; then
    actual=$(file_size "$tmp")
    # Verify size matches Content-Length (skip if HEAD couldn't determine size)
    if [[ "${expected}" -gt 0 ]]; then
      if [[ "${actual}" -ne "${expected}" ]]; then
        err "  ✗ $(basename "$dest") — size mismatch: expected ${expected} bytes, got ${actual} bytes"
        rm -f "${tmp}"
        return 1
      fi
    else
      warn "  (no Content-Length from CDN — skipping size check for $(basename "$dest"))"
    fi
    mv "${tmp}" "${dest}"
    ok "  ✓ $(basename "$dest") ($(hr_size "${actual}"))"
    return 0
  else
    rm -f "${tmp}"
    err "  ✗ $(basename "$dest") — curl failed for ${url}"
    return 1
  fi
}

# Fetch unless already present (or unless --force)
fetch() {
  local subdir=$1 file=$2
  local dest="${ASSETS_DIR}/${subdir}/${file}"
  local url="${HF_BASE_URL}/${subdir}/${file}"

  if [[ -s "$dest" && ${FORCE} -eq 0 ]]; then
    info "skip ${file} (already exists; use --force to overwrite)"
    return 0
  fi
  download_one "$url" "$dest"
}

# ─── Run ─────────────────────────────────────────────────────────────────────
main() {
  hdr ""
  hdr "════════════════════════════════════════════════════════════════"
  hdr "  Supertonic-3 TTS asset downloader"
  hdr "════════════════════════════════════════════════════════════════"
  hdr ""
  info "Source:       ${HF_TREE_URL}"
  info "Destination:  ${ASSETS_DIR}/{onnx,voice_styles}/"
  info "Mode:         $([[ ${FORCE} -eq 1 ]] && echo "force re-download" \
        || ([[ ${DRY_RUN} -eq 1 ]] && echo "dry-run" || echo "skip existing"))"
  hdr ""

  if ! verify_url "${HF_BASE_URL}/onnx/tts.json"; then
    err "Cannot reach ${HF_BASE_URL} — check your network or HF_REVISION."
    err "Test in a browser: ${HF_TREE_URL}"
    exit 4
  fi
  ok "Source reachable"
  hdr ""

  mkdir -p "$ONNX_DIR" "$VOICE_DIR"

  local failed=0

  hdr "→ ONNX model weights"
  for f in "${ONNX_FILES[@]}"; do
    fetch "onnx" "$f" || failed=$((failed + 1))
  done
  hdr ""

  hdr "→ Voice style JSONs"
  for f in "${VOICE_FILES[@]}"; do
    fetch "voice_styles" "$f" || failed=$((failed + 1))
  done
  hdr ""

  if (( failed == 0 )); then
    ok "All assets ready in ${ASSETS_DIR}/"
    hdr ""
    info "Next steps:"
    info "  • Dev:   pnpm site:dev   (or ./system.sh dev:site)"
    info "  • Build: pnpm site:build"
    hdr ""
    exit 0
  else
    err "${failed} file(s) failed to download. Re-run $SCRIPT_NAME to retry."
    exit 1
  fi
}

main "$@"