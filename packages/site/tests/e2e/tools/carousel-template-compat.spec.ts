import { test, expect } from '@playwright/test';
import { expectBitmap } from './fabric-bitmap';
import { applyLayoutTemplate } from './carousel-helpers';
import { convertLegacySlide, toStringArray, type ConverterData } from '../../../../tools/shared/carousel-scene/html-convert';
import { LEGACY_TEMPLATE_KEYS, presetFor } from '../../../../tools/shared/carousel-scene/legacy-presets';
import { layerToFabricObject, slideToFabricScene } from '../../../../tools/shared/carousel-scene/scene';
import { SCENE_H_PORTRAIT, SCENE_W } from '../../../../tools/shared/carousel-scene/constants';

// PRD-CAROUSEL-MCP-FABRIC Task 1.3 — every legacy HTML template converts to
// paintable object layers. Part A asserts content-completeness for all 28 keys
// (pure, fast). Part B proves 6 representative templates end-to-end in the
// beta preview with zero skipped (HtmlUnsupported) layers.

const PALETTE = { bg: '#0f0e0d', text: '#fafaf9', accent: '#f97316', font: 'Inter' };

const RICH_DATA: ConverterData = {
  kicker: 'THE HOOK',
  headline: 'Make every pixel count',
  body: 'A sentence that earns the swipe every single time.',
  items: ['First specific action', 'Second concrete step', 'Third proven tactic', 'Fourth quick win', 'Fifth bold move'],
  quote: 'Design is intelligence made visible.',
  author: 'Alina Wheeler',
  stat: '87%',
  statLabel: 'of saves come from useful carousels',
  cta: 'Follow for more',
  footer: '@magicsync',
  images: [],
};

const MAX_ITEMS: Record<string, number> = {
  'number-hero': 3,
  'feature-highlight': 3,
  'clay-cards': 3,
  'timeline': 5,
};

function expectedItems(key: string): string[] {
  const all = toStringArray(RICH_DATA.items);
  return all.slice(0, MAX_ITEMS[key] ?? all.length);
}

test.describe('legacy converter covers all 28 templates (pure)', () => {
  test('template registry has exactly the 28 legacy keys', () => {
    expect(LEGACY_TEMPLATE_KEYS).toHaveLength(28);
  });

  for (const key of LEGACY_TEMPLATE_KEYS) {
    test(`${key} converts with all content present and sane geometry`, () => {
      const layers = convertLegacySlide(key, RICH_DATA, PALETTE, { frameH: SCENE_H_PORTRAIT, index: 0, total: 6 });
      expect(layers.length).toBeGreaterThan(1);
      expect(layers[0]!.type).toBe('background');

      const dumped = JSON.stringify(layers);
      // Require exactly the fields this preset renders (mirrors the DOM
      // template: a preset without an items block never shows items).
      const blocks = presetFor(key).blocks;
      const mustContain: string[] = [];
      if (blocks.includes('headline')) mustContain.push(RICH_DATA.headline);
      if (blocks.includes('items')) mustContain.push(...expectedItems(key));
      if (blocks.includes('body') && RICH_DATA.body) mustContain.push(RICH_DATA.body);
      if (blocks.includes('kicker') && RICH_DATA.kicker) mustContain.push(RICH_DATA.kicker.toUpperCase());
      if (blocks.includes('quote') && RICH_DATA.quote) mustContain.push(RICH_DATA.quote);
      if (blocks.includes('author') && RICH_DATA.author) mustContain.push(`— ${RICH_DATA.author}`);
      if (blocks.includes('stat')) mustContain.push(RICH_DATA.stat as string);
      if (blocks.includes('statLabel') && RICH_DATA.statLabel) mustContain.push(RICH_DATA.statLabel);
      if (blocks.includes('ctaButton') && RICH_DATA.cta) mustContain.push(RICH_DATA.cta);
      for (const text of mustContain) {
        expect(dumped).toContain(text);
      }
      expect(dumped).toContain('01 / 06');

      for (const layer of layers) {
        const t = layer.transform;
        for (const v of [t.x, t.y, t.w, t.h ?? 0]) {
          expect(Number.isFinite(v)).toBe(true);
        }
        expect(t.w).toBeGreaterThan(0);
        expect(t.x).toBeGreaterThanOrEqual(-300);
        expect(t.x + t.w).toBeLessThanOrEqual(SCENE_W + 450);
      }

      const scene = slideToFabricScene(layers, { height: SCENE_H_PORTRAIT, palette: PALETTE });
      const types = scene.objects.map(o => o.type);
      expect(types).not.toContain('HtmlUnsupported');
      expect(types).not.toContain('Unknown');
    });
  }

  test('shape radius and stroke survive translation', () => {
    const rounded = layerToFabricObject(
      { type: 'shape', shape: 'rect', visible: true, opacity: 1, transform: { x: 0, y: 0, w: 100, h: 50, rotate: 0 }, fill: '#fff', radius: 14 },
      SCENE_W,
      SCENE_H_PORTRAIT,
      PALETTE,
    );
    expect(rounded.rx).toBe(14);
    expect(rounded.ry).toBe(14);
    const outlined = layerToFabricObject(
      { type: 'shape', shape: 'circle', visible: true, opacity: 1, transform: { x: 0, y: 0, w: 100, h: 100, rotate: 0 }, fill: 'transparent', stroke: { color: '#f00', width: 3 } },
      SCENE_W,
      SCENE_H_PORTRAIT,
      PALETTE,
    );
    expect(outlined.stroke).toBe('#f00');
    expect(outlined.strokeWidth).toBe(3);
  });
});

const BROWSER_KEYS = ['title-kicker', 'quote', 'stat-highlight', 'tips-list', 'cta', 'comparison'];

// Fresh slides carry headline-only data, so templates whose accent lives in
// data-driven blocks (items/cards need items, kicker needs kicker) paint no
// accent. Expectations mirror what the converter must emit for that data.
const BITMAP_EXPECT: Record<string, { light: number | false, fills: string[] }> = {
  'title-kicker': { light: 0, fills: ['#f97316'] },
  'quote': { light: 0, fills: ['#f97316'] },
  'stat-highlight': { light: false, fills: ['#f97316'] },
  'tips-list': { light: 0, fills: [] },
  'cta': { light: 0, fills: ['#f97316'] },
  'comparison': { light: 0, fills: [] },
};

test.describe('legacy templates paint in beta preview', () => {
  test('six representative templates render with zero skipped layers', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(String((err as Error)?.stack || err)));

    await page.goto('/tools/carousel-creator?fabric=1');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid="section-fabric"]')).toBeVisible({ timeout: 20000 });
    // Webfonts must be loaded before any fabric render, or PNGs bake in
    // fallback glyphs and goldens flake between runs (same pattern as
    // renderSlideToPng's document.fonts.ready gate).
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(500);

    const stage = page.locator('[data-testid="fabric-stage"]');
    for (const key of BROWSER_KEYS) {
      await test.step(`template ${key}`, async () => {
        await applyLayoutTemplate(page, stage, key);
        expect(Number(await stage.getAttribute('data-rendered'))).toBeGreaterThan(0);
        expect(Number(await stage.getAttribute('data-skipped'))).toBe(0);
        // Bitmap assertions on the true canvas buffer (see fabric-bitmap.ts).
        // Fresh slides carry headline-only data, so per-template text volume
        // varies — light>0 proves rasterization; fills prove accent paint.
        await expectBitmap(page, stage, BITMAP_EXPECT[key]!);
      });
    }
    expect(errors).toEqual([]);
  });
});
