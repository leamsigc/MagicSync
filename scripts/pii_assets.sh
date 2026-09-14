#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# pii_assets.sh
#
# Downloads the pinned ONNX NER model used by private-mode chat into
# packages/agent/public/pii/. The directory is .gitignored so the repo stays
# small. Private mode fails closed when these files are missing
# (PII_ALLOW_REGEX_ONLY=1 is an explicit, non-default escape hatch).
#
# Usage:
#   ./scripts/pii_assets.sh              # skip files already present
#   ./scripts/pii_assets.sh --force      # re-download everything
#   HF_REVISION=<sha> ./scripts/pii_assets.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HF_REPO="${HF_REPO:-Xenova/bert-base-NER}"
HF_REVISION="${HF_REVISION:-main}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGET_DIR="${PROJECT_ROOT}/packages/agent/public/pii"

FILES=(
  config.json
  tokenizer.json
  tokenizer_config.json
  special_tokens_map.json
  onnx/model.onnx
)

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 3; }

mkdir -p "${TARGET_DIR}/onnx"
for file in "${FILES[@]}"; do
  destination="${TARGET_DIR}/${file}"
  if [[ -f "${destination}" && "${FORCE}" -eq 0 ]]; then
    echo "✓ ${file}"
    continue
  fi
  mkdir -p "$(dirname "${destination}")"
  url="https://huggingface.co/${HF_REPO}/resolve/${HF_REVISION}/${file}"
  echo "↓ ${file}"
  curl -fL --retry 3 --retry-delay 2 -o "${destination}" "${url}"
done

echo "PII assets ready in ${TARGET_DIR}"
