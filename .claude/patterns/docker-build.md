---
name: docker-build
description: Fixing Docker/CI image build failures — pnpm native binary verification, musl native deps, pnpm version pinning
triggers:
  - "docker build failed"
  - "buildx failed"
  - "pnpm i did not complete successfully"
  - "Cannot verify the identity of the @pnpm/exe"
  - "docker ci pipeline"
edges:
  - target: context/setup.md
    condition: when checking dev/build environment setup
last_updated: 2026-08-16
---

# Docker Build (CI pipeline) — pnpm + Alpine gotchas

## Context

The CI pipeline (`/.github/workflows/build-docker-image.yml`) builds the site with
`docker/build-push-action` using the root `Dockerfile` (builder = `node:26-alpine`).
All package installs in containers go through `pnpm i`.

## Gotcha 1 — pnpm version must be pinned (native @pnpm/exe verification)

`npm install -g pnpm` pulls the **latest** pnpm (11.x). pnpm ≥11 refuses to run on
the repo's `lockfileVersion: '9.0'` lockfile because its native
`@pnpm/exe.linux-x64` binary cannot be verified against `pnpm-lock.yaml`.

Failure signature:

```
[ERROR] Cannot verify the identity of the @pnpm/exe.linux-x64 native binary:
it is missing from pnpm-lock.yaml.   (exit code 1)
```

Fix — pin pnpm to the version in `package.json`'s `packageManager` field
(do it dynamically so the Dockerfile can't drift):

```dockerfile
WORKDIR /usr/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")
```

## Gotcha 2 — Alpine (musl) native binding for libsql

The runtime image is `node:26-alpine` (musl). libsql resolves its native binding
via detect-libc, so `@libsql/linux-x64-musl` must be installed explicitly and
copied into `.output/server/node_modules/` (see the `install-musl-binding.sh`
section in the Dockerfile).

## Gotcha 3 — musl binding lookup must target musl, never gnu

Chain: `@libsql/client` → `libsql@0.5.x` → optional binding
`@libsql/linux-x64-musl@0.5.x` (bindings track the `libsql` release line, NOT
the `@libsql/client` version). pnpm installs only the platform-matching
optional dep, so on Alpine the store contains the musl binding and **zero**
gnu bindings — verified: `pnpm add libsql@0.5.29` on `node:26-alpine` installs
musl only. Any script that derives the musl version from a gnu lookup
(`find ... linux-x64-gnu ...`) fails unconditionally on Alpine with
`ERROR: Could not find installed @libsql/linux-x64-gnu binding`.

Fix (see `Dockerfile` `install-musl-binding.sh`): look for
`*node_modules/@libsql/linux-x64-musl/package.json` in the pnpm store first
and copy it into `.output/server/node_modules/` (+ stage to `/tmp/musl` for
the runtime `COPY`, which needs the source to exist in every success path);
fall back to `npm install @libsql/linux-x64-musl@$VERSION` with `$VERSION`
read from the store's `libsql` package. Every success path must populate
`/tmp/musl` — including the already-bundled early exit.

## Gotcha 4 — node-canvas has NO musl prebuilds (Alpine always compiles from source)

`canvas@3.x` (pulled in by `fabric/node` in `@local-monorepo/tools` for the
carousel render API — `packages/tools/package.json` → catalog `canvas: 3.2.1`)
publishes no `linux-musl` prebuilds (upstream PR #2370 still open), so on
Alpine `prebuild-install -r napi` always 404s and falls back to
`node-gyp rebuild`. Without system headers `pnpm i` fails with:

```
.../canvas@3.2.1/node_modules/canvas install: Failed
canvas@3.2.1 install: `prebuild-install -r napi || node-gyp rebuild` (exit 1)
```

Fix — builder stage needs the cairo/pango stack (safe for sharp: it only
probes for libvips, so everything below is fine — just never add `vips-dev`):

```dockerfile
RUN apk add --no-cache bash curl python3 make g++ pkgconfig \
  cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev pixman-dev
```

And the runtime stage must ship the shared libs the compiled `canvas.node`
links against, plus a font (bare Alpine ships zero fonts → Pango renders
tofu). Verified 2026-09-11 with a two-stage `node:26-alpine` build that
`npm i canvas@3.2.1` + renders a PNG in both stages:

```dockerfile
RUN apk add --no-cache cairo pango giflib libjpeg-turbo librsvg pixman freetype fontconfig ttf-dejavu
```

Notes:
- `canvas@3.2.1` contains the GCC 15 fix (upstream #2546) — no
  `CXXFLAGS="-include cstdint"` workaround needed. Do NOT downgrade to 3.0.x.
- `pnpm-workspace.yaml` already has `allowBuilds: canvas: true`, so no
  `pnpm approve-builds` step is needed in CI.
- Historical note: on 2026-09-08 a `pkg-config pixman-1` error blamed canvas
  when canvas was NOT a dependency of any workspace package — that time it was
  a red herring. Since `canvas` became a direct dependency of
  `@local-monorepo/tools`, this failure signature is real: check
  `grep '"canvas"' packages/*/package.json` and step ordering first.

 1. Reproduce the failing step locally with the exact container:
     `docker run --rm -v <build-dir>:/usr/app --workdir /usr/app node:26-alpine sh -c "<apt/deps>; npm i -g pnpm@<pinned>; pnpm i"`
 2. If `@pnpm/exe` verification fails → apply Gotcha 1.
 3. Rebuild through the failing step to confirm, then clean up
    (`docker rmi`, delete temp build dir — build artifacts are root-owned).

## Gotcha 5 — `actions/setup-node` does NOT install pnpm

`setup-node@v4` only installs Node. A workflow step like
`run: pnpm install --frozen-lockfile` then fails with
`pnpm: command not found (exit code 127)`. This is what broke
`/.github/workflows/layer-rules.yml` — the sister workflow
(`doc-deploy.yml`) already had the fix.

Fix — add `pnpm/action-setup@v4` before `setup-node` (it reads the
pinned version from `package.json`'s `packageManager` field, so no
`with: version:` is needed) and enable the pnpm cache on `setup-node`:

```yaml
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm
```

## Gotcha 6 — `type=gha` cache needs the container buildx driver

`docker/build-push-action` with `cache-from/to: type=gha` fails on the
default `docker` driver with:

```
ERROR: failed to build: Cache export is not supported for the docker driver.
```

Fix — create a `docker-container` builder with `setup-buildx-action`
before the build step (also bumped `login-action@v2` → `v3` and
`build-push-action@v4` → `v6` to drop the deprecated Node 16 runtime
that emits the `punycode` DEP0040 warning):

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
- name: Build image and push to registry
  uses: docker/build-push-action@v6
```

## Gotcha 7 — Nitro prunes `unhead` out of the server output (Coolify boot crash)

Symptom at container boot (local `node .output/server/index.mjs` reproduces it identically):

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'/usr/app/.output/server/node_modules/unhead/dist/server.mjs'
imported from /usr/app/.output/server/chunks/nitro/nitro.mjs
```

Root cause, verified against a local site build: Nitro externalises `unhead`
but its node_modules trace copies only `package.json` + `dist/minify.mjs` into
`.output/server/node_modules/unhead/`, while bundled `nitro.mjs`/`entry.mjs`/
renderer/og-image chunks keep static `unhead/server|utils|plugins` imports.
Separately, the SSR pass rewrites other app-chunk imports to dangling
pnpm-store relative paths (`../../../../../../unhead@3.4.2.../node_modules/unhead/dist/minify.mjs`
side-effect imports in `chunks/build/*.mjs`), which crash SSR on those routes
once boot is fixed.

Fix — bundle it instead of tracing it (`packages/site/nuxt.config.ts`, next to
the `papaparse` precedent which documents the opposite direction):

```ts
externals: {
  external: ['papaparse'],
  inline: ['unhead'],
},
```

Verify without redeploying: rebuild, then scan the output — zero bare
`unhead/*` specifiers and zero store-relative `unhead@*` imports under
`.output/server/`, and the server must get past module load (any remaining
boot failure should be environmental, e.g. host-missing system libs like
libvips that the Alpine runtime provides — see Gotchas 2–4 — never
`ERR_MODULE_NOT_FOUND`). Only inline what is proven broken: `@unhead/vue` was
checked and has no bare runtime imports (only `//#region` bundler comments),
so it stays external.