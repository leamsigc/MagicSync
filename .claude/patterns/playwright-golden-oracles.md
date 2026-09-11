# Playwright Golden Oracles (deterministic screenshots)

Use when a spec asserts `toHaveScreenshot` on a dev-server page (`pnpm site:dev`, port 3000).

## Suppress dev-only overlays before capture

Nuxt DevTools renders a shadow-DOM timing pill (`NUXT-DEVTOOLS-FRAME`, text like
`572 ms`) plus `nuxt-devtools-inspect-panel`, `#vue-tracer-overlay`, and toasts
(`OL.fixed…`). None appear in production, all poison goldens. Hide them:

```ts
await page.addStyleTag({
  content: '#vue-tracer-overlay,nuxt-devtools-frame,nuxt-devtools-inspect-panel,#__nuxt-devtools__{display:none!important}',
});
```

Fixed/sticky app chrome (navbar, sticky bars) also bleeds into element clips —
prefer screenshotting the painted element itself (e.g. `canvas.lower-canvas`)
over the wrapper, and additionally hide chrome for purity goldens:

```ts
content: '...header,nav,.sticky{visibility:hidden!important}',
```

`visibility` (not `display`) avoids reflow.

## Settle motion, freeze animations

Enter transitions (`v-motion`, popovers) cause run-to-run diffs:

```ts
await page.waitForTimeout(1000);
await expect(loc).toHaveScreenshot('name.png', { animations: 'disabled' });
```

## Dark-mode goldens

`emulateMedia({ colorScheme: 'dark' })` alone does not flip Nuxt color-mode.
Force it via the stored preference in a fresh context, then assert the class:

```ts
await page.addInitScript(() => {
  localStorage.setItem('nuxt-color-mode', 'dark');
});
// …goto…
await expect.poll(async () => page.evaluate(() => document.documentElement.className)).toContain('dark');
```

## First-run workflow

A missing golden fails once ("writing actual") — inspect the actual image
visually before accepting it, then re-run twice to prove stability. Never
`--update-snapshots` blindly on a red run.

## Gotchas

- Scoped SFC CSS does NOT reach runtime-created DOM (fabric wrappers, upper
  canvases lack the scope attr) — use `:deep()` for those selectors.
- `pnpm dev` (playground) vs `pnpm site:dev` (port 3000): specs assume the
  latter via `baseURL`; if the dev server OOMs (Nitro worker `JS heap out of
  memory` 500s on all routes), restart it — no spec change will fix that.
