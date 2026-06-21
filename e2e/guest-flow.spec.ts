import { expect, test } from '@playwright/test';

test.describe('Speedrun page', () => {
  test('loads the intro state for guest users', async ({ page }) => {
    await page.goto('/speedrun');

    await expect(page.locator('.speedrun-hero h1')).toBeVisible();
    await expect(page.getByRole('button', { name: /lancer|start/i })).toBeVisible();
    await expect(page.locator('.speedrun-leaderboard-panel')).toBeVisible();
  });
});

test.describe('Privacy page', () => {
  test('shows export guidance for guest users', async ({ page }) => {
    await page.goto('/confidentialite');

    await expect(page.locator('.privacy-hero h1')).toContainText(/confidentialité|privacy/i);
    await expect(page.locator('.privacy-guest-note')).toBeVisible();
  });
});
