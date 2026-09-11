import { test, expect } from '@playwright/test';

/**
 * Mobile responsive layout tests (Pixel 7 project).
 */

test.describe('Mobile layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#map .leaflet-map-pane').waitFor({ timeout: 20_000 });
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