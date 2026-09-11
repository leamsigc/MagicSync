import { test, expect } from '@playwright/test';

test.describe('Podcast Player', () => {
  test.describe('Search Page', () => {
    test('should display podcast player title and search input', async ({ page }) => {
      await page.goto('/tools/podcast');

      await expect(page.locator('h1:has-text("Podcast Player")')).toBeVisible();
      await expect(page.locator('[data-testid="podcast-search-input"]')).toBeVisible();
    });

    test('should show empty state before searching', async ({ page }) => {
      await page.goto('/tools/podcast');

      await expect(page.locator('p:has-text("Search for your favorite podcasts above")')).toBeVisible();
    });

    test('should show loading indicator while searching', async ({ page }) => {
      await page.goto('/tools/podcast');

      const searchInput = page.locator('[data-testid="podcast-search-input"] input');
      await searchInput.fill('javascript');

      await expect(page.locator('[data-testid="podcast-search-loading"]')).toBeVisible({ timeout: 5000 });
    });

    test('should return podcast results when searching', async ({ page }) => {
      await page.goto('/tools/podcast');

      const searchInput = page.locator('[data-testid="podcast-search-input"] input');
      await searchInput.fill('javascript');

      await expect(page.locator('[data-testid="podcast-results"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="podcast-card"]').first()).toBeVisible();
    });

    test('should show no results for nonsensical search', async ({ page }) => {
      await page.goto('/tools/podcast');

      const searchInput = page.locator('[data-testid="podcast-search-input"] input');
      await searchInput.fill('xyzzy999qqqzzz');

      await expect(page.locator('[data-testid="podcast-no-results"]')).toBeVisible({ timeout: 15000 });
    });

    test('should clear results when search term is emptied', async ({ page }) => {
      await page.goto('/tools/podcast');

      const searchInput = page.locator('[data-testid="podcast-search-input"] input');
      await searchInput.fill('javascript');

      await expect(page.locator('[data-testid="podcast-results"]')).toBeVisible({ timeout: 15000 });

      await searchInput.fill('');

      await expect(page.locator('[data-testid="podcast-results"]')).not.toBeVisible();
      await expect(page.locator('p:has-text("Search for your favorite podcasts above")')).toBeVisible();
    });
  });

  test.describe('Episode Detail Page', () => {
    test('should navigate to podcast detail page when clicking a result', async ({ page }) => {
      await page.goto('/tools/podcast');

      const searchInput = page.locator('[data-testid="podcast-search-input"] input');
      await searchInput.fill('javascript');

      await expect(page.locator('[data-testid="podcast-results"]')).toBeVisible({ timeout: 15000 });

      await page.locator('[data-testid="podcast-card"]').first().click();

      await expect(page).toHaveURL(/\/tools\/podcast\/\d+/);
      await expect(page.locator('[data-testid="podcast-title"]')).toBeVisible();
    });

    test('should display episodes for a podcast', async ({ page }) => {
      await page.goto('/tools/podcast/1256114327?title=Syntax%20%E2%80%93%20Web%20Development%20Podcast&author=Wes%20Bos%20%26%20Scott%20Tolinski&feed=https%3A%2F%2Ffeeds.simplecast.com%2FhEI_f6Dz');

      await expect(page.locator('[data-testid="podcast-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="podcast-episodes"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="episode-card"]').first()).toBeVisible();
    });

    test('should display back button and favorites toggle', async ({ page }) => {
      await page.goto('/tools/podcast/1256114327?title=Syntax&author=Wes+Bos&feed=https%3A%2F%2Ffeeds.simplecast.com%2FhEI_f6Dz');

      await expect(page.locator('[data-testid="podcast-back"]')).toBeVisible();
      await expect(page.locator('[data-testid="podcast-favorite-toggle"]')).toBeVisible();
    });

    test('should toggle favorite state', async ({ page }) => {
      await page.goto('/tools/podcast/1256114327?title=Syntax&author=Wes+Bos&feed=https%3A%2F%2Ffeeds.simplecast.com%2FhEI_f6Dz');

      const favButton = page.locator('[data-testid="podcast-favorite-toggle"]');
      await expect(favButton).toBeVisible();
      await expect(favButton).toContainText('Save');

      await favButton.click();
      await expect(favButton).toContainText('Saved');

      await favButton.click();
      await expect(favButton).toContainText('Save');
    });
  });

  test.describe('Global Mini-Player', () => {
    test('should show mini-player when an episode is played', async ({ page }) => {
      await page.goto('/tools/podcast/1256114327?title=Syntax%20%E2%80%93%20Web%20Development%20Podcast&author=Wes%20Bos%20%26%20Scott%20Tolinski&feed=https%3A%2F%2Ffeeds.simplecast.com%2FhEI_f6Dz');

      await expect(page.locator('[data-testid="podcast-episodes"]')).toBeVisible({ timeout: 15000 });
      await page.locator('[data-testid="episode-card"]').first().click();
      await expect(page.locator('[data-testid="podcast-mini-player"]')).toBeVisible();
    });

    test('should persist mini-player across page navigation', async ({ page }) => {
      await page.goto('/tools/podcast/1256114327?title=Syntax%20%E2%80%93%20Web%20Development%20Podcast&author=Wes%20Bos%20%26%20Scott%20Tolinski&feed=https%3A%2F%2Ffeeds.simplecast.com%2FhEI_f6Dz');

      await expect(page.locator('[data-testid="podcast-episodes"]')).toBeVisible({ timeout: 15000 });
      await page.locator('[data-testid="episode-card"]').first().click();
      await expect(page.locator('[data-testid="podcast-mini-player"]')).toBeVisible();

      await page.locator('[data-testid="podcast-back"]').click();
      await expect(page).toHaveURL(/\/tools\/podcast/);
      await expect(page.locator('[data-testid="podcast-mini-player"]')).toBeVisible();
    });

    test('should show mini-player after search and click through', async ({ page }) => {
      await page.goto('/tools/podcast');

      const searchInput = page.locator('[data-testid="podcast-search-input"] input');
      await searchInput.fill('javascript');

      await expect(page.locator('[data-testid="podcast-results"]')).toBeVisible({ timeout: 15000 });
      await page.locator('[data-testid="podcast-card"]').first().click();

      await expect(page).toHaveURL(/\/tools\/podcast\/\d+/);
      await expect(page.locator('[data-testid="podcast-title"]')).toBeVisible();

      await expect(page.locator('[data-testid="podcast-episodes"]')).toBeVisible({ timeout: 15000 });
      await page.locator('[data-testid="episode-card"]').first().click();
      await expect(page.locator('[data-testid="podcast-mini-player"]')).toBeVisible();
    });
  });

  test.describe('Tool Listing', () => {
    test('should list podcast player in tools page', async ({ page }) => {
      await page.goto('/tools');

      await expect(page.locator('text=Podcast Player')).toBeVisible();
    });

    test('should navigate to podcast player from tools page', async ({ page }) => {
      await page.goto('/tools');

      const podcastLink = page.locator('a[href="/tools/podcast"]');
      await expect(podcastLink).toBeVisible();
      await podcastLink.click();

      await expect(page).toHaveURL(/\/tools\/podcast/);
      await expect(page.locator('h1:has-text("Podcast Player")')).toBeVisible();
    });
  });
});
