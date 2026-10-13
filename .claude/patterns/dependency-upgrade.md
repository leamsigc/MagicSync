---
name: dependency-upgrade
description: Upgrading a framework/module package through a major version across a pnpm-layer monorepo — read the installed manifest as the spec, bump the whole pinned family in the workspace catalog, resolve duplicate-version guards with overrides, and verify by booting, not by tests
triggers:
  - "upgrade <package> to vN"
  - "major version bump"
  - "module version does not satisfy"
  - "peerDependencies floor"
  - "catalog bump"
edges:
  - target: patterns/purge-dependency.md
    condition: when the upgraded package is also being removed or replaced
  - target: patterns/safe-build.md
    condition: when the proof requires a full site build
  - target: context/stack.md
    condition: when a version constraint in the stack doc becomes stale
last_updated: 2026-10-13
---

# Upgrade a dependency across a major version

## Context

Reference run: `@nuxtjs/seo` v5 → v6 (2026-10-13). A major bump of a Nuxt module
is rarely one line: the module pins a family of sub-modules it re-exports, guards
them at setup time, and now bundles modules that used to be opt-in. The lockfile
is the only place the truth lives.

## Steps

1. **Read the manifest, not the changelog.** `curl -s
   https://registry.npmjs.org/<pkg>/<version> | jq '.dependencies,
   .peerDependencies'` gives the exact minimums and the framework floor. The
   target version's own manifest is the most reliable spec.
2. **Bump the whole pinned family in `pnpm-workspace.yaml` `catalog:`** — every
   sub-module referenced by a `package.json`, plus `nuxt` itself. Kicking
   sub-modules individually leaves the guard to catch them later.
3. **`pnpm install` then run the framework's prepare step.** A duplicate-version
   guard names the offender: `Module <name> version (x) does not satisfy >=y`.
   Higher-level install-only is not a proof.
4. **Resolve a range lower than the requirement with `overrides`, not the
   catalog.** `^5.0.0` in a sub-module keeps an old copy in peer-scoped
   sub-graphs even when a direct pin exists; `overrides:` (already used in this
   repo for pi) forces one deduped copy repo-wide.
5. **Handle newly-bundled defaults explicitly.** A module that moved from opt-in
   to bundled is now on everywhere it is registered — including inside layers,
   not just the composition root. Opt out or configure each one.
6. **Sweep renamed env vars / import paths / devtool packages** in code, `.env*`,
   CI, and the deploy config. `.env` is easy to miss because it is gitignored.
7. **Re-sync the lockfile** and update `context/stack.md` / `setup.md` if a
   version constraint there is now wrong.

## Gotchas

- The guard checks the **loaded** module; a newer copy in the lockfile does not
  save you if an old copy is what gets resolved. `grep -E "^  <pkg>@" pnpm-lock.yaml`
  must show one version.
- `pnpm install` auto-appends to `minimumReleaseAgeExclude` when a new pin sits
  inside the release-age window. Expected — do not "fix" it.
- Do not add a bundled sub-module to `modules`; a duplicate entry double-registers
  routes.
- Do not add a type checker to run `typecheck` just for the upgrade; the
  framework's prepare step is the cheaper, real signal.

## Verify

- [ ] `pnpm install` clean; lockfile shows one version per upgraded family
- [ ] prepare step (`nuxt prepare` or equivalent) passes — guards + config
- [ ] `pnpm dlx vite-doctor .` — no new diagnostics (pre-existing ones cited, not fixed)
- [ ] the upgraded subsystem's runtime endpoints exercised by hand
- [ ] every changed function ≤ 5 branches (a pure dependency change is 0)
- [ ] `context/stack.md` / `setup.md` version lines updated
