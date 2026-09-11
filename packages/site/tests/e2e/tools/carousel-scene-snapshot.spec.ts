import { test, expect } from '@playwright/test';
import { buildSceneSnapshots, resolveSlideLayers } from '../../../../tools/shared/carousel-scene/scene-snapshot';
import { createCarouselSchema, updateCarouselSchema } from '../../../../tools/server/utils/carousel-schema';

// PRD-CAROUSEL-MCP-FABRIC Task 1.4 — scene snapshot persistence.
// Snapshots freeze the exact scene JSON a render used. Pure builder + schema
// tests here; the guest browser test guards the save auth gate.

const PALETTE = { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316', font: 'Inter' };
const FRAME = { w: 1080, h: 1350 };

const OBJECT_SLIDE = {
  id: 'slide-0',
  templateKey: 'layer-split-screen',
  data: { headline: 'Make every pixel count' },
  layers: [
    { type: 'background', visible: true, opacity: 1, transform: { x: 0, y: 0, w: 1080, h: 1350, rotate: 0 }, fill: { kind: 'color', color: '#000000' } },
    { type: 'text', visible: true, opacity: 1, transform: { x: 590, y: 480, w: 430, rotate: 0 }, content: 'Make every pixel count', fontSize: 76, color: '#fafaf9' },
  ],
};

const LEGACY_SLIDE = {
  id: 'slide-1',
  templateKey: 'title-kicker',
  data: { kicker: 'THE HOOK', headline: 'Starter deck', body: 'Swipe for more.' },
};

function validSlide(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 's1',
    templateKey: 'title-kicker',
    data: { headline: 'Hi' },
    pattern: 'dots',
    patternColor: '#fff',
    patternOpacity: 0.08,
    bgImage: null,
    customHtml: '',
    ...overrides,
  };
}

test.describe('scene snapshots (pure)', () => {
  test('maps slideIds and builds paintable scenes', () => {
    const snaps = buildSceneSnapshots([OBJECT_SLIDE, LEGACY_SLIDE], PALETTE, FRAME);
    expect(snaps.map(s => s.slideId)).toEqual(['slide-0', 'slide-1']);
    for (const snap of snaps) {
      expect(snap.scene.width).toBe(1080);
      expect(snap.scene.objects.length).toBeGreaterThan(0);
    }
    const types = snaps[1]!.scene.objects.map(o => o.type);
    expect(types).not.toContain('HtmlUnsupported');
  });

  test('empty slides build no snapshots', () => {
    expect(buildSceneSnapshots([], PALETTE, FRAME)).toEqual([]);
  });

  test('resolveSlideLayers prefers native layers, converts legacy', () => {
    const native = resolveSlideLayers(OBJECT_SLIDE, PALETTE, FRAME, 0, 2);
    expect(native).toHaveLength(2);
    const converted = resolveSlideLayers(LEGACY_SLIDE, PALETTE, FRAME, 1, 2);
    expect(converted.length).toBeGreaterThan(2);
    expect(converted[0]!.type).toBe('background');
  });

  test('create schema accepts layers + scene, strips unknowns', () => {
    const parsed = createCarouselSchema.parse({
      id: 'c1',
      name: 'Test',
      slides: [validSlide({ layers: [{ type: 'text', foo: 1 }], extra: 'drop-me' })],
      palette: PALETTE,
      scene: [{ slideId: 's1', scene: { version: 'fabric-scene/1', width: 1080, height: 1350, objects: [] } }],
    });
    expect(parsed.slides[0]!.layers).toHaveLength(1);
    expect(parsed.scene).toHaveLength(1);
    expect((parsed.slides[0] as Record<string, unknown>).extra).toBeUndefined();
  });

  test('schemas reject oversize scene payloads', () => {
    const big = Array.from({ length: 16 }, (_, i) => ({ slideId: `s${i}`, scene: { a: 1 } }));
    expect(() => createCarouselSchema.parse({
      id: 'c1',
      slides: [validSlide()],
      palette: PALETTE,
      scene: big,
    })).toThrow();
    expect(() => updateCarouselSchema.parse({ scene: big })).toThrow();
  });

  test('update schema keeps scene optional', () => {
    expect(updateCarouselSchema.parse({ name: 'Renamed' }).scene).toBeUndefined();
  });
});

test.describe('carousel save auth gate (guest)', () => {
  test('guest save asks for login and stays on the page', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String((err as Error)?.stack || err)));

    await page.goto('/tools/carousel-creator');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="control-bar"]')).toBeVisible({ timeout: 20000 });
    await page.locator('[data-testid="pill-save-carousel"]').click();
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
    await expect(page).toHaveURL(/\/tools\/carousel-creator/);
  });
});
