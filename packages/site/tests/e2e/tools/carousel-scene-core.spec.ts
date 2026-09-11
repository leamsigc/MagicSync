import { test, expect } from '@playwright/test';
import {
  resolveToken,
  layerToFabricObject,
  slideToFabricScene,
  type InputLayer,
  type ScenePalette,
} from '../../../../tools/shared/carousel-scene/scene';
import { SCENE_H_PORTRAIT, SCENE_W } from '../../../../tools/shared/carousel-scene/constants';

// PRD-CAROUSEL-MCP-FABRIC Task 1.1 — isomorphic scene core.
// Part A asserts the pure translator (shared/, DOM-free, no fabric dep).
// Part B captures the current DOM-rendered creator as the parity oracle the
// fabric stage (Task 1.2/1.3) must match pixel-for-pixel.

const PALETTE: ScenePalette = { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316', font: 'Inter' };

function layer(overrides: Partial<InputLayer> & { type: string }): InputLayer {
  return {
    visible: true,
    opacity: 1,
    transform: { x: 0, y: 0, w: 100, h: 100, rotate: 0 },
    ...overrides,
  } as InputLayer;
}

test.describe('scene translator (pure)', () => {
  test('resolves palette tokens', () => {
    expect(resolveToken('__BG__', PALETTE)).toBe('#0f0e0d');
    expect(resolveToken('1px solid __ACCENT__', PALETTE)).toBe('1px solid #f97316');
    expect(resolveToken('no-tokens', PALETTE)).toBe('no-tokens');
  });

  test('background color becomes a full-bleed Rect', () => {
    const obj = layerToFabricObject(
      layer({ type: 'background', fill: { kind: 'color', color: '__BG__' } }),
      SCENE_W,
      SCENE_H_PORTRAIT,
      PALETTE,
    );
    expect(obj.type).toBe('Rect');
    expect(obj.width).toBe(SCENE_W);
    expect(obj.height).toBe(SCENE_H_PORTRAIT);
    expect(obj.fill).toBe('#0f0e0d');
  });

  test('text becomes a Textbox with resolved color and font', () => {
    const obj = layerToFabricObject(
      layer({ type: 'text', content: 'Hello', fontSize: 64, color: '__TEXT__' }),
      SCENE_W,
      SCENE_H_PORTRAIT,
      PALETTE,
    );
    expect(obj.type).toBe('Textbox');
    expect(obj.text).toBe('Hello');
    expect(obj.fill).toBe('#fafaf9');
    expect(obj.fontFamily).toBe('Inter');
  });

  test('star shape becomes a Path, rect stays a Rect', () => {
    const star = layerToFabricObject(
      layer({ type: 'shape', shape: 'star', fill: '__ACCENT__' }),
      SCENE_W,
      SCENE_H_PORTRAIT,
      PALETTE,
    );
    expect(star.type).toBe('Path');
    expect(star.fill).toBe('#f97316');
    const rect = layerToFabricObject(
      layer({ type: 'shape', shape: 'rect', fill: '#fff' }),
      SCENE_W,
      SCENE_H_PORTRAIT,
      PALETTE,
    );
    expect(rect.type).toBe('Rect');
  });

  test('html layers become explicit markers, never silent drops', () => {
    const obj = layerToFabricObject(
      layer({ type: 'html', bindings: { templateKey: 'quote', data: {} } }),
      SCENE_W,
      SCENE_H_PORTRAIT,
      PALETTE,
    );
    expect(obj.type).toBe('HtmlUnsupported');
    expect(obj.templateKey).toBe('quote');
  });

  test('pattern/overlay/frame/effect pass through as descriptors', () => {
    for (const kind of ['pattern', 'overlay', 'frame', 'effect']) {
      const obj = layerToFabricObject(
        layer({ type: kind, key: 'dots', color: '__ACCENT__' }),
        SCENE_W,
        SCENE_H_PORTRAIT,
        PALETTE,
      );
      expect(obj.type).toMatch(/^Scene/);
      expect(obj.key).toBe('dots');
    }
  });

  test('slide scene orders backgrounds first, drops hidden layers', () => {
    const scene = slideToFabricScene(
      [
        layer({ type: 'text', content: 'top' }),
        layer({ type: 'background', fill: { kind: 'color', color: '#000' } }),
        layer({ type: 'text', content: 'hidden', visible: false }),
      ],
      { height: SCENE_H_PORTRAIT, palette: PALETTE },
    );
    expect(scene.version).toBe('fabric-scene/1');
    expect(scene.width).toBe(SCENE_W);
    expect(scene.objects.map(o => o.type)).toEqual(['Rect', 'Textbox']);
  });
});

test.describe('creator parity oracle (DOM render)', () => {
  test('creator loads clean and stage matches golden baseline', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String((err as Error)?.stack || err)));

    await page.goto('/tools/carousel-creator');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="control-bar"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="preview-switcher"]')).toBeVisible();

    expect(errors).toEqual([]);
    // Dev-only overlays (Nuxt DevTools shadow-DOM timing pill, inspect panel,
    // vue-tracer) are transient and poison golden screenshots — hide the host
    // elements before capture. Production builds have no devtools.
    await page.addStyleTag({
      content: '#vue-tracer-overlay,nuxt-devtools-frame,nuxt-devtools-inspect-panel,#__nuxt-devtools__{display:none!important}',
    });
    // The bar animates on enter — let it settle, then freeze CSS animations
    // so the golden baseline is deterministic across runs.
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-testid="control-bar"]')).toHaveScreenshot('scene-core-control-bar.png', {
      animations: 'disabled',
    });
  });

  test('control bar matches golden baseline in dark mode', async ({ page }) => {
    // Force dark via color-mode's stored preference (system preference alone
    // does not flip the app). Fresh context per test, so no leakage.
    await page.addInitScript(() => {
      localStorage.setItem('nuxt-color-mode', 'dark');
    });
    await page.goto('/tools/carousel-creator');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="control-bar"]')).toBeVisible({ timeout: 20000 });
    await expect.poll(async () => page.evaluate(() => document.documentElement.className)).toContain('dark');
    await page.addStyleTag({
      content: '#vue-tracer-overlay,nuxt-devtools-frame,nuxt-devtools-inspect-panel,#__nuxt-devtools__{display:none!important}',
    });
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-testid="control-bar"]')).toHaveScreenshot('scene-core-control-bar-dark.png', {
      animations: 'disabled',
    });
  });
});
