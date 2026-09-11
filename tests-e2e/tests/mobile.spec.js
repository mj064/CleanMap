import { test, expect } from '@playwright/test';

/**
 * Mobile responsive layout tests (Pixel 7 project only).
 * Skips automatically when running in a desktop viewport —
 * the bottom nav is hidden by design above 900px.
 */
test.skip(({ viewport }) => viewport.width >= 900, 'mobile-only tests');

test.describe('Mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#map.leaflet-container').waitFor({ timeout: 30_000 });
  });

  test('bottom nav is visible, desktop sidebar hidden', async ({ page }) => {
    await expect(page.locator('.bottom-nav')).toBeVisible();
    const sidebarDisplay = await page.locator('.app-nav').evaluate(el => getComputedStyle(el).display);
    expect(sidebarDisplay).toBe('none');
  });

  test('no horizontal overflow at mobile width', async ({ page }) => {
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2
    );
    expect(overflow).toBe(false);
  });

  test('bottom nav switches panels', async ({ page }) => {
    await page.locator('.bottom-nav .nav-item[data-panel="leaderboard"]').click();
    await expect(page.locator('#panel-leaderboard')).toHaveClass(/active/);
    await page.locator('.bottom-nav .nav-item[data-panel="map"]').click();
    await expect(page.locator('#panel-map')).toHaveClass(/active/);
  });
});

