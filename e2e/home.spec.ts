import { expect, test } from '@playwright/test';

test.describe('Home page', () => {
  test('loads the dashboard and daily challenge hero', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.brand')).toContainText('Vexiio');
    await expect(page.locator('.daily-hero-card h1')).toBeVisible();
    await expect(page.getByRole('link', { name: /défi|challenge/i })).toBeVisible();
  });

  test('shows guest account actions in the header', async ({ page }, testInfo) => {
    await page.goto('/');

    await expect(page.locator('.auth-button')).toBeVisible();

    if (testInfo.project.name === 'mobile-chrome') {
      await expect(page.locator('.menu-trigger')).toBeVisible();
    } else {
      await expect(page.locator('.desktop-nav')).toBeVisible();
    }
  });
});
