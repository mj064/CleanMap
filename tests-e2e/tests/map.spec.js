import { test, expect } from '@playwright/test';

/**
 * Map tests — markers, heatmap toggle, card → detail popup.
 * Read-only: no reports are created or deleted.
 * Skips gracefully when the map has no reports yet.
 */

test.describe('Map & reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#map .leaflet-pane').waitFor({ timeout: 20_000 });
    // Give reports time to load and markers to render
    await page.waitForTimeout(3000);
  });

  test('markers render as vivid solid circles', async ({ page }) => {
    const count = await page.locator('.marker-pin').count();
    test.skip(count === 0, 'No reports on the map yet');
    expect(count).toBeGreaterThan(0);
    const bg = await page.locator('.marker-pin').first().evaluate(el => getComputedStyle(el).backgroundColor);
    // Solid fill (the "faded markers" regression check)
    expect(bg).not.toContain('rgba(0, 0, 0, 0)');
  });

  test('heatmap toggle renders and removes the layer', async ({ page }) => {
    const count = await page.locator('.marker-pin').count();
    test.skip(count === 0, 'No reports on the map yet');
    await page.locator('#heatmap-btn').click();
    await expect(page.locator('#heatmap-btn')).toHaveClass(/active/);
    await page.locator('#heatmap-btn').click();
    await expect(page.locator('#heatmap-btn')).not.toHaveClass(/active/);
  });

  test('clicking a report card opens the detail popup with actions', async ({ page }) => {
    const card = page.locator('.report-card').first();
    test.skip((await card.count()) === 0, 'No report cards yet');
    await card.click();
    await expect(page.locator('.detail-popup')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.detail-popup .detail-heading')).toBeVisible();
    await expect(page.locator('.detail-popup .detail-rows > div')).toHaveCount(3);
    // Close button works
    await page.locator('.detail-popup .leaflet-popup-close-button').click();
    await expect(page.locator('.detail-popup')).toBeHidden();
  });

  test('detail popup includes share button', async ({ page }) => {
    const card = page.locator('.report-card').first();
    test.skip((await card.count()) === 0, 'No report cards yet');
    await card.click();
    await expect(page.locator('.detail-popup')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.detail-popup button:has-text("Share report")')).toBeVisible();
  });

  test('filter tabs filter the report list', async ({ page }) => {
    await page.locator('.filter-tab[data-filter="cleaned"]').click();
    await page.waitForTimeout(500);
    // All visible cards (if any) should be cleaned status
    const pills = await page.locator('.report-card .status-pill.cleaned').count();
    const cards = await page.locator('.report-card').count();
    if (cards > 0) expect(pills).toBe(cards);
    // Back to all
    await page.locator('.filter-tab[data-filter="all"]').click();
  });

  test('zoom controls sit above the locate button (regression)', async ({ page }) => {
    const zoom = page.locator('#map .leaflet-bottom.leaflet-right');
    await expect(zoom).toBeVisible();
    const zoomBox = await zoom.boundingBox();
    const locateBox = await page.locator('.map-locate-btn').boundingBox();
    expect(zoomBox.y + zoomBox.height).toBeLessThanOrEqual(locateBox.y + 5);
  });
});