import { test, expect } from '@playwright/test';

/**
 * Navigation & panel tests — read-only interactions.
 * Viewport-aware: uses whichever nav is visible (sidebar on desktop,
 * bottom bar on mobile).
 */

async function gotoPanel(page, panel) {
  await page.locator(`.nav-item[data-panel="${panel}"]:visible`).first().click();
  await expect(page.locator(`#panel-${panel}`)).toHaveClass(/active/);
}

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#map.leaflet-container').waitFor({ timeout: 30_000 });
  });

  test('all five panels switch correctly', async ({ page }) => {
    for (const panel of ['dashboard', 'leaderboard', 'profile', 'report', 'map']) {
      await gotoPanel(page, panel);
    }
  });

  test('leaderboard panel renders podium or honest empty state', async ({ page }) => {
    await gotoPanel(page, 'leaderboard');
    await page.waitForTimeout(1500);
    const content = page.locator('#leaderboard-panel-content');
    await expect(content).toBeVisible();
    const html = await content.innerHTML();
    expect(html.includes('podium') || html.includes('empty-state')).toBe(true);
  });

  test('leaderboard groups tab switches', async ({ page }) => {
    await gotoPanel(page, 'leaderboard');
    await page.locator('#lb-tab-groups').click();
    await page.waitForTimeout(500);
    // Volunteers tab loses active state
    await expect(page.locator('#lb-tab-vol')).not.toHaveClass(/active/);
  });

  test('profile panel prompts sign-in when signed out', async ({ page }) => {
    await gotoPanel(page, 'profile');
    await page.waitForTimeout(800);
    const content = page.locator('#profile-content');
    await expect(content).toBeVisible();
    // Signed out → sign-in prompt OR signed in → account card (both valid states)
    const html = await content.innerHTML();
    expect(html.includes('Sign in') || html.includes('Account')).toBe(true);
  });

  test('dashboard shows stats, impact chart and severity bars', async ({ page }) => {
    await gotoPanel(page, 'dashboard');
    await expect(page.locator('#stats-grid .stat-card').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#week-impact .week-row').first()).toBeVisible();
    await expect(page.locator('#severity-bars .sev-row').first()).toBeVisible();
  });

  test('auth modal opens and closes', async ({ page }) => {
    // Viewport-aware entry point: sidebar button on desktop, Profile CTA on mobile
    const desktopBtn = page.locator('#signin-open');
    if (await desktopBtn.isVisible()) {
      await desktopBtn.click();
    } else {
      await gotoPanel(page, 'profile');
      await page.locator('#profile-content button:has-text("Sign In")').first().click();
    }
    await expect(page.locator('#auth-modal')).toBeVisible();
    await page.locator('#auth-cancel').click();
    await expect(page.locator('#auth-modal')).toBeHidden();
  });
});

