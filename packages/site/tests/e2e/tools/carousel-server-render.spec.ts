import { test, expect } from '@playwright/test';

// PRD-CAROUSEL-MCP-FABRIC Task 1.5 — server-side fabric render.
// Render correctness (PNG bytes/dimensions, skipped accounting, allowlist)
// is covered deterministically in tests/unit/fabric-scene-render.test.ts
// (real fabric/node, ~2s). Here: the HTTP surface auth gate, mirroring the
// menu-board rejection specs.

test.describe('render endpoint auth gate', () => {
  test('rejects unauthenticated render calls', async ({ request }) => {
    const response = await request.post('/api/v1/carousel/render', {
      data: { scene: { width: 1080, height: 1350, objects: [] } },
    });
    expect(response.ok()).toBe(false);
  });
});
