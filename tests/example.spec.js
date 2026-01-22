// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Marketplace public pages @smoke', () => {
  test('homepage renders header and search @smoke', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('marketplace-header')).toBeVisible();
    await expect(page.getByTestId('marketplace-search-input')).toBeVisible();
  });

  test('wishlist prompts login for guests @smoke', async ({ page }) => {
    await page.goto('/wishlist');
    await expect(page.getByTestId('wishlist-login-card')).toBeVisible();
    await expect(page.getByTestId('wishlist-login')).toBeVisible();
  });

  test('cart prompts login for guests @smoke', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByTestId('cart-signin')).toBeVisible();
  });
});
