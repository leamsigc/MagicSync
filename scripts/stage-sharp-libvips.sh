#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# stage-sharp-libvips.sh
#
# Nitro traces each `@img/sharp-<platform>@<ver>` binding and the versioned
# `@img/sharp-libvips-<platform>@<ver>` package, but the binding's RPATH looks
# for sibling directories Nitro never creates:
#
#   $ORIGIN/../../sharp-libvips-<platform>/lib
#   $ORIGIN/../../../sharp-libvips-<platform>/<libvips-version>/lib
#   $ORIGIN/../../../node_modules/@img/sharp-libvips-<platform>/lib
#
# Result at startup: `ERR_DLOPEN_FAILED: Error loading shared library
# libvips-cpp.so.8.18.6: No such file or directory`.
#
# This stages relative symlinks for every musl binding/version pair found in
# the Nitro output. The runtime image is Alpine (musl); the newest libvips
# version becomes the unversioned sibling, and every binding keeps its own
# versioned candidate so mixed sharp versions (0.34.x -> libvips 1.2.4,
# 0.35.x -> libvips 1.3.3) both resolve.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SERVER_MODULES="${PROJECT_ROOT}/packages/site/.output/server/node_modules"
NITRO_DIR="${SERVER_MODULES}/.nitro"

if [[ ! -d "${NITRO_DIR}" ]]; then
  echo "No Nitro output at ${NITRO_DIR}; nothing to stage"
  exit 0
fi

staged=0
# Collect every traced musl libvips package: @img/sharp-libvips-linuxmusl-*@<ver>
for versioned in "${NITRO_DIR}"/@img/sharp-libvips-linuxmusl-*@*; do
  [[ -d "${versioned}" ]] || continue
  pkg_dir="$(basename "${versioned}")"   # sharp-libvips-linuxmusl-x64@1.3.3
  platform="${pkg_dir%@*}"               # sharp-libvips-linuxmusl-x64
  version="${pkg_dir##*@}"               # 1.3.3

  # RPATH candidate 2: $ORIGIN/../../../sharp-libvips-<platform>/<version>/lib
  version_dir="${NITRO_DIR}/${platform}"
  mkdir -p "${version_dir}"
  ln -sfn "../@img/${pkg_dir}" "${version_dir}/${version}"

  echo "${version} ${pkg_dir}" >> "${version_dir}/.versions"
  staged=$((staged + 1))
done

if [[ "${staged}" -eq 0 ]]; then
  echo "No musl sharp-libvips packages found in the Nitro output; skipping"
  exit 0
fi

for version_dir in "${NITRO_DIR}"/sharp-libvips-linuxmusl-*; do
  [[ -d "${version_dir}" ]] || continue
  platform="$(basename "${version_dir}")"
  # Newest version (lexical sort is fine for libvips 1.x.y).
  newest="$(sort "${version_dir}/.versions" | tail -1 | awk '{print $2}')"
  rm -f "${version_dir}/.versions"

  # RPATH candidate 1: $ORIGIN/../../sharp-libvips-<platform>/lib
  ln -sfn "${newest}" "${NITRO_DIR}/@img/${platform}"

  # RPATH candidate 4: $ORIGIN/../../../node_modules/@img/sharp-libvips-<platform>/lib
  mkdir -p "${NITRO_DIR}/node_modules/@img"
  ln -sfn "../../../@img/${newest}" "${NITRO_DIR}/node_modules/@img/${platform}"

  # Plain require() resolution from the server root (Nitro normally symlinks
  # this already; recreate it if it is missing or dangling).
  mkdir -p "${SERVER_MODULES}/@img"
  if [[ ! -e "${SERVER_MODULES}/@img/${platform}" ]]; then
    ln -sfn "../.nitro/@img/${newest}" "${SERVER_MODULES}/@img/${platform}"
  fi

  echo "Staged ${platform}: versioned candidates + unversioned -> ${newest}"
done
