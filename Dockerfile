# ============ BUILDER ============
FROM node:26-alpine AS builder

# bash is required by ./scripts/tts_assets_folder.sh (bash-only constructs:
# [[ ]], arrays, (( )). node:26-alpine ships only busybox sh by default.
# curl is required by the same script — node:26-alpine does NOT include curl
# (busybox has wget, but the script's --retry/--location semantics need curl).
# NOTE: do NOT add vips-dev here. sharp's install/check.js detects a global
# libvips and switches from its vendored prebuilt binary to a node-gyp source
# build — which fails under pnpm ("Please add node-gyp to your dependencies")
# and breaks `pnpm i` (sharp@0.34.5 via @huggingface/transformers/nuxt-og-image).
# Without vips-dev, sharp uses its prebuilt linuxmusl binaries, which also keeps
# the runtime image working (it ships no system libvips).
#
# node-canvas (`canvas@3.x`, via `fabric/node` in @local-monorepo/tools for the
# carousel render API) publishes NO musl prebuilds, so on Alpine
# `prebuild-install -r napi` always 404s and falls back to `node-gyp rebuild`.
# That source build needs cairo/pango/jpeg/gif/svg headers + pkgconfig —
# without them `pnpm i` fails with `canvas install: Failed`. These -dev
# packages do NOT affect sharp (it only probes for libvips).
RUN apk add --no-cache bash curl python3 make g++ pkgconfig \
  cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev pixman-dev

WORKDIR /usr/app

# Pin pnpm to the exact version from the "packageManager" field in package.json.
# Installing the latest pnpm (11.x) makes `pnpm i` fail on this lockfileVersion
# 9.0 lockfile with:
#   Cannot verify the identity of the @pnpm/exe.linux-x64 native binary:
#   it is missing from pnpm-lock.yaml.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")
RUN pnpm --version

COPY . .

# The runtime image is node:26-alpine (musl libc). Hint to pnpm that it should
# resolve native optional dependencies for musl. This is a best-effort hint;
# the real fix below explicitly installs the musl binding because pnpm/Nitro
# may still bundle the glibc variant depending on the lockfile.
ENV npm_config_libc=musl

RUN pnpm i
RUN pnpm dev:prepare

# Populate Supertonic-3 ONNX weights + voice styles from HuggingFace before
# the site build. The asset directory is .gitignored to keep pushes small.
RUN bash ./scripts/tts_assets_folder.sh

RUN pnpm site

# The `libsql` package (native core behind `@libsql/client`) resolves its
# platform binding at runtime via detect-libc, so on Alpine it needs
# `@libsql/linux-x64-musl`. Nitro does not trace the dynamically-loaded
# `index.node` binary, so the binding is missing from `.output/server` and we
# inject it here. NOTE: pnpm installs only the platform-matching optional dep —
# on Alpine that is the musl binding, never the gnu one — so the version must
# come from the store's musl package (or the `libsql` release line, which the
# bindings track in lockstep), NOT from a gnu lookup.
# TODO: Remove this workaround once Nitro traces the native binding into
# .output when building on node:26-alpine.
RUN cat > /tmp/install-musl-binding.sh <<'EOF'
#!/bin/sh
set -e
DEST='/usr/app/packages/site/.output/server/node_modules/@libsql/linux-x64-musl'
STAGE='/tmp/musl/node_modules/@libsql/linux-x64-musl'

stage_from() {
  SRC_DIR="$1"
  echo "Staging musl binding from $SRC_DIR"
  mkdir -p "$DEST" "$STAGE"
  cp -r "$SRC_DIR/." "$DEST/"
  cp -r "$SRC_DIR/." "$STAGE/"
  ls -la "$STAGE/"
}

# 1. Already bundled by Nitro — still stage it, because the runtime image
#    COPYs from /tmp/musl unconditionally.
if [ -f "$DEST/package.json" ] && ls "$DEST"/*.node >/dev/null 2>&1; then
  echo "Musl binding already bundled; staging copy for runtime image"
  mkdir -p "$STAGE"
  cp -r "$DEST/." "$STAGE/"
  exit 0
fi

# 2. Normal case on Alpine: musl binding is in the pnpm store (pnpm skips the
#    gnu optional dep on musl, so a gnu lookup would always fail here).
MUSL_PKG=$(find /usr/app -path '*node_modules/@libsql/linux-x64-musl/package.json' -not -path '*/.output/*' -print -quit 2>/dev/null)
if [ -n "$MUSL_PKG" ]; then
  stage_from "$(dirname "$MUSL_PKG")"
  exit 0
fi

# 3. Fallback: npm-install the musl binding matching the `libsql` release line.
LIBSQL_PKG=$(find /usr/app -path '*node_modules/libsql/package.json' -not -path '*/.output/*' -print -quit 2>/dev/null)
if [ -z "$LIBSQL_PKG" ]; then
  echo "ERROR: no @libsql/linux-x64-musl binding and no libsql package found under /usr/app" >&2
  exit 1
fi
VERSION=$(node -e "console.log(require('$LIBSQL_PKG').version)")
echo "Musl binding absent from store; installing @libsql/linux-x64-musl@$VERSION to match libsql@$VERSION"
npm install "@libsql/linux-x64-musl@$VERSION" --prefix /tmp/musl --no-save --no-package-lock
mkdir -p "$DEST"
cp -r "$STAGE/." "$DEST/"
ls -la "$STAGE/"
EOF
RUN sh /tmp/install-musl-binding.sh

# ============ RUNTIME ============
FROM node:26-alpine

# node-canvas is compiled against these shared libs in the builder stage, so
# the runtime image must ship them too — otherwise the carousel render API
# (`fabric/node` → canvas.node) fails at startup with
# "Error loading shared library libcairo.so.2". ttf-dejavu gives Pango a
# real font to fall back to (bare Alpine ships zero fonts → tofu text).
RUN apk add --no-cache cairo pango giflib libjpeg-turbo librsvg pixman freetype fontconfig ttf-dejavu

WORKDIR /usr/app

COPY --from=builder /usr/app/packages/site/.output ./.output
# Copy the musl native binding into the exact location where libsql resolves it.
COPY --from=builder /tmp/musl/node_modules/@libsql/linux-x64-musl /usr/app/.output/server/node_modules/@libsql/linux-x64-musl

# Verify the musl binding is present and can be loaded by Node before shipping.
RUN node -e "require('/usr/app/.output/server/node_modules/@libsql/linux-x64-musl')" && \
    echo "Musl binding verified and loadable"

ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
