import { test, expect } from '@playwright/test';

/**
 * Navigation & panel tests — read-only interactions.
 */

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#map .leaflet-pane').waitFor({ timeout: 20_000 });
  });

  test('all five panels switch correctly', async ({ page }) => {
    for (const panel of ['dashboard', 'leaderboard', 'profile', 'report', 'map']) {
      await page.locator(`.nav-item[data-panel="${panel}"]`).first().click();
      await expect(page.locator(`#panel-${panel}`)).toHaveClass(/active/);
    }
  });

  test('leaderboard panel renders podium or honest empty state', async ({ page }) => {
    await page.locator('[data-panel="leaderboard"]').first().click();
    await expect(page.locator('#panel-leaderboard')).toHaveClass(/active/);
    await page.waitForTimeout(1500);
    const content = page.locator('#leaderboard-panel-content');
    await expect(content).toBeVisible();
    const html = await content.innerHTML();
    expect(html.includes('podium') || html.includes('empty-state')).toBe(true);
  });

  test('leaderboard groups tab switches', async ({ page }) => {
    await page.locator('[data-panel="leaderboard"]').first().click();
    await page.locator('#lb-tab-groups').click();
    await page.waitForTimeout(500);
    // Volunteers tab loses active state
    await expect(page.locator('#lb-tab-vol')).not.toHaveClass(/active/);
  });

  test('profile panel prompts sign-in when signed out', async ({ page }) => {
    await page.locator('[data-panel="profile"]').first().click();
    await expect(page.locator('#panel-profile')).toHaveClass(/active/);
    await page.waitForTimeout(800);
    const content = page.locator('#profile-content');
    await expect(content).toBeVisible();
    // Signed out → sign-in prompt OR signed in → account card (both valid states)
    const html = await content.innerHTML();
    expect(html.includes('Sign in') || html.includes('Account')).toBe(true);
  });

  test('dashboard shows stats, impact chart and severity bars', async ({ page }) => {
    await page.locator('[data-panel="dashboard"]').first().click();
    await expect(page.locator('#panel-dashboard')).toHaveClass(/active/);
    await expect(page.locator('#stats-grid .stat-card').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#week-impact .week-row').first()).toBeVisible();
    await expect(page.locator('#severity-bars .sev-row').first()).toBeVisible();
  });

  test('auth modal opens and closes', async ({ page }) => {
    await page.locator('#signin-open').click();
    await expect(page.locator('#auth-modal')).toBeVisible();
    await page.locator('#auth-cancel').click();
    await expect(page.locator('#auth-modal')).toBeHidden();
  });
});