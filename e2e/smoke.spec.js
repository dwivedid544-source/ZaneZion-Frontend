import { test, expect } from '@playwright/test';

test.describe('public routes', () => {
  test('landing shell loads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#root')).toBeAttached();
    await expect(page.getByText('ZaneZion Concierge').first()).toBeVisible();
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /system login/i })).toBeVisible();
    await expect(page.getByPlaceholder('Master ID / Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /initialize command/i })).toBeVisible();
  });

  test('signup shows account types', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await expect(page.getByText('Personal Account', { exact: true })).toBeVisible();
    await expect(page.getByText('Business Account', { exact: true })).toBeVisible();
    await expect(page.getByText(/local grocery stores/i)).toBeVisible();
    await expect(page.getByText(/exclusive concierge services/i)).toBeVisible();
  });
});
