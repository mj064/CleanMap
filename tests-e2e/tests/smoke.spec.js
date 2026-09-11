import { test, expect } from '@playwright/test';

/**
 * Smoke tests — app loads, core APIs respond, PWA assets serve.
 * Read-only: no data is created or modified.
 */

test.describe('Smoke — app loads', () => {
  test('page loads with map, nav and header', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CleanMap/i);
    await expect(page.locator('#map .leaflet-pane')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.nav-links .nav-item')).toHaveCount(5);
    await expect(page.locator('#presence-pill')).toBeVisible();
  });

  test('health API is green with Supabase configured', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.supabase_configured).toBe(true);
  });

  test('config API serves Supabase credentials for realtime', async ({ request }) => {
    const res = await request.get('/api/config');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.url).toContain('supabase');
  });

  test('PWA assets are served', async ({ request }) => {
    expect((await request.get('/manifest.json')).ok()).toBeTruthy();
    expect((await request.get('/sw.js')).ok()).toBeTruthy();
    expect((await request.get('/icon-192.png')).ok()).toBeTruthy();
  });

  test('service worker registers', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    const registered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg;
    });
    expect(registered).toBe(true);
  });
});

test.describe('Smoke — reports data', () => {
  test('reports API returns valid list', async ({ request }) => {
    const res = await request.get('/api/reports');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('stats API returns aggregates', async ({ request }) => {
    const res = await request.get('/api/stats');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.data.total).toBe('number');
    expect(body.data.severity).toHaveProperty('high');
  });
});