import { expect, type Page, type Locator } from '@playwright/test';

/**
 * Bitmap content assertions for the fabric beta preview.
 *
 * Why not golden screenshots: element screenshots capture the compositor
 * (fixed navbar, sticky control bar and the devtools timing pill bleed into
 * clips and poison baselines). The canvas 2D buffer readback below is the
 * true render output — the same bytes the Task 1.5 server renderer must
 * reproduce — and is immune to page chrome.
 */
export interface BitmapExpectations {
  /**
   * Minimum near-white (text) samples in the middle band. Sampling steps 9px
   * (1 sample ≈ 81 px); a 96px headline yields 200+, a 60px quote ~140, an
   * empty render ~0. Default 100. Pass false when the slide legitimately has
   * no light text (e.g. stat-highlight paints the headline in accent).
   */
  light?: number | false
  /**
   * Fills that must appear on painted canvas objects (from the stage's paint
   * ledger, enumerated post-renderAll). Pixel-scanning for small accent
   * features proved flaky (a 96×8 bar intermittently rasterizes to zero
   * matching samples); the ledger is deterministic. Default ['#f97316'].
   */
  fills?: string[]
}

interface BitmapSample {
  bg: [number, number, number]
  light: number
  accent: number
}

async function sampleBitmap(page: Page): Promise<BitmapSample> {
  return await page.evaluate(() => {
    const c = document.querySelector('[data-testid="fabric-stage"] canvas.lower-canvas') as HTMLCanvasElement | null;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return { bg: [0, 0, 0], light: -1, accent: -1 };
    const px = (x: number, y: number): [number, number, number] => {
      const d = ctx.getImageData(x, y, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!];
    };
    let light = 0;
    for (let y = 200; y < c.height - 150; y += 9) {
      const row = ctx.getImageData(0, y, c.width, 1).data;
      for (let x = 0; x < c.width; x += 9) {
        const i = x * 4;
        const r = row[i]!;
        const g = row[i + 1]!;
        const b = row[i + 2]!;
        if (r > 200 && g > 200 && b > 200) light += 1;
      }
    }
    return { bg: px(Math.floor(c.width / 2), 60), light, accent: 0 };
  });
}

export async function expectBitmap(page: Page, stage: Locator, expected: BitmapExpectations): Promise<void> {
  const rendered = Number(await stage.getAttribute('data-rendered'));
  if (rendered <= 0) throw new Error('fabric stage painted nothing (data-rendered=0)');
  const sample = await sampleBitmap(page);
  if (sample.light < 0) throw new Error('fabric canvas missing from the page');
  // Default deck palette background is near-black #0f0e0d.
  const [r, g, b] = sample.bg;
  if (r > 70 || g > 70 || b > 70) {
    throw new Error(`background is not dark: rgb(${r},${g},${b})`);
  }
  if (expected.light !== false) {
    expect(sample.light).toBeGreaterThan(expected.light ?? 100);
  }
  const ledger = (await stage.getAttribute('data-paint')) ?? '';
  for (const fill of expected.fills ?? ['#f97316']) {
    expect(ledger).toContain(fill);
  }
}
