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
`docker/build-push-action` using the root `Dockerfile` (builder = `node:22-alpine`).
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

The runtime image is `node:22-alpine` (musl). libsql resolves its native binding
via detect-libc, so `@libsql/linux-x64-musl` must be installed explicitly and
copied into `.output/server/node_modules/` (see the `install-musl-binding.sh`
section in the Dockerfile).

## Steps

1. Reproduce the failing step locally with the exact container:
   `docker run --rm -v <build-dir>:/usr/app --workdir /usr/app node:22-alpine sh -c "<apt/deps>; npm i -g pnpm@<pinned>; pnpm i"`
2. If `@pnpm/exe` verification fails → apply Gotcha 1.
3. Rebuild through the failing step to confirm, then clean up
   (`docker rmi`, delete temp build dir — build artifacts are root-owned).