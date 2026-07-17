# ============ BUILDER ============
FROM node:22-alpine AS builder

# bash is required by ./scripts/tts_assets_folder.sh (bash-only constructs:
# [[ ]], arrays, (( )). node:22-alpine ships only busybox sh by default.
# curl is required by the same script — node:22-alpine does NOT include curl
# (busybox has wget, but the script's --retry/--location semantics need curl).
RUN apk add --no-cache bash curl g++ make py3-pip vips-dev
RUN npm install -g pnpm

WORKDIR /usr/app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .

# The runtime image is node:22-alpine (musl libc). Hint to pnpm that it should
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

# The libsql package resolves its native binding at runtime via detect-libc,
# so on Alpine it needs @libsql/linux-x64-musl. pnpm/Nitro may have bundled
# the glibc variant (linux-x64-gnu) depending on the lockfile, so we explicitly
# install the matching musl binding and copy it into the bundled server deps.
# TODO: Remove this workaround once pnpm/Nitro reliably bundles the musl
# binding when building on node:22-alpine.
RUN cat > /tmp/install-musl-binding.sh <<'EOF'
#!/bin/sh
set -e
MUSL_DIR='/usr/app/packages/site/.output/server/node_modules/@libsql/linux-x64-musl'
if [ -d "$MUSL_DIR" ] && [ -n "$(ls -A "$MUSL_DIR" 2>/dev/null)" ]; then
  echo "Musl binding already bundled; skipping explicit install"
  exit 0
fi

GNU_PKG=$(find /usr/app -path '*/@libsql/linux-x64-gnu/package.json' -print -quit)
if [ -z "$GNU_PKG" ]; then
  echo "ERROR: Could not find installed @libsql/linux-x64-gnu binding" >&2
  exit 1
fi

VERSION=$(node -e "console.log(require('$GNU_PKG').version)")
echo "Found @libsql/linux-x64-gnu version $VERSION; installing matching musl binding"
npm install "@libsql/linux-x64-musl@$VERSION" --prefix /tmp/musl --no-save --no-package-lock
ls -la /tmp/musl/node_modules/@libsql/linux-x64-musl/
EOF
RUN sh /tmp/install-musl-binding.sh

# ============ RUNTIME ============
FROM node:22-alpine

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
