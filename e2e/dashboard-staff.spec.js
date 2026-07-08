import { test, expect } from '@playwright/test';

const email = process.env.PLAYWRIGHT_STAFF_EMAIL;
const password = process.env.PLAYWRIGHT_STAFF_PASSWORD;

test.describe('staff dashboard (backend + env required)', () => {
  test.skip(!email || !password, 'Set PLAYWRIGHT_STAFF_EMAIL and PLAYWRIGHT_STAFF_PASSWORD to run this test.');

  test('after login, top bar shows clock check-in', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Master ID / Email').fill(email);
    await page.getByPlaceholder('Encryption Key / Password').fill(password);
    await page.getByRole('button', { name: /initialize command/i }).click();
    await page.waitForURL(/\/dashboard/i, { timeout: 60_000 });
    await expect(page.getByRole('button', { name: /^check in$/i }).first()).toBeVisible({ timeout: 20_000 });
  });
});
