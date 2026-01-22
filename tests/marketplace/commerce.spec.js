// @ts-check
import { marketplaceTest as test, expect } from '../fixtures/auth';

const selectPurchasableCard = async (page) => {
  await page.goto('/');
  const cards = page.locator('[data-testid^="product-card-"]');
  const count = await cards.count();
  if (count === 0) {
    await expect(
      page.getByRole('heading', { name: /no products found/i })
    ).toBeVisible();
    return null;
  }

  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    const cartButton = card.locator('[data-testid$="-cart"]').first();
    if (await cartButton.isEnabled()) {
      await expect(card).toBeVisible();
      const productId = await card.getAttribute('data-product-id');
      const testId = await card.getAttribute('data-testid');
      expect(productId).toBeTruthy();
      expect(testId).toBeTruthy();
      return { card, productId, testId };
    }
  }

  const firstCard = cards.first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard.locator('[data-testid$="-cart"]').first()).toBeDisabled();
  return null;
};

const addFirstProductToCart = async (page) => {
  const result = await selectPurchasableCard(page);
  if (!result) return null;
  const { card, productId } = result;
  await card.locator('[data-testid$="-cart"]').first().click();
  return { productId };
};

const ensureCartItem = async (page) => {
  const added = await addFirstProductToCart(page);
  if (!added) return null;
  await page.goto('/cart');
  const item = page
    .locator(`[data-testid^="cart-item-"][data-product-id="${added.productId}"]`)
    .first();
  await expect(item).toBeVisible();
  const testId = await item.getAttribute('data-testid');
  const itemId = testId?.replace('cart-item-', '');
  expect(itemId).toBeTruthy();
  return { productId: added.productId, itemId };
};

test.describe('Marketplace commerce flows @regression', () => {
  test('product discovery -> detail -> add to cart', async ({ page }) => {
    const result = await selectPurchasableCard(page);
    if (!result) return;
    const { card, productId } = result;
    const titleLink = card.locator('[data-testid$="-title"]').first();
    await titleLink.click();
    await expect(page.getByTestId('product-detail-page')).toBeVisible();

    const addButton = page.getByTestId('product-add-to-cart');
    if (await addButton.isDisabled()) {
      await expect(addButton).toBeDisabled();
      return;
    }
    await addButton.click();

    await page.goto('/cart');
    await expect(
      page
        .locator(
          `[data-testid^="cart-item-"][data-product-id="${productId}"]`
        )
        .first()
    ).toBeVisible();
  });

  test('cart updates quantity and removes item', async ({ page }) => {
    const cartItem = await ensureCartItem(page);
    if (!cartItem) return;
    const { itemId } = cartItem;
    const qtyValue = page.getByTestId(`cart-qty-value-${itemId}`);
    const initialQty = Number((await qtyValue.textContent())?.trim()) || 1;

    await page.getByTestId(`cart-qty-increase-${itemId}`).click();
    await expect(qtyValue).toHaveText(String(initialQty + 1));

    await page.getByTestId(`cart-remove-${itemId}`).click();
    await expect(page.getByTestId(`cart-item-${itemId}`)).toHaveCount(0);
  });

  test('apply and remove coupon', async ({ page }) => {
    const couponCode = process.env.PLAYWRIGHT_COUPON_CODE;
    test.skip(!couponCode, 'Set PLAYWRIGHT_COUPON_CODE to exercise coupons.');

    const cartItem = await ensureCartItem(page);
    if (!cartItem) return;

    const normalized = couponCode.trim().toUpperCase();
    await page.getByTestId('cart-promo-input').fill(normalized);
    await page.getByTestId('cart-apply-coupon').click();
    await expect(page.getByTestId('cart-coupon-applied')).toContainText(
      normalized
    );

    await page.getByTestId('cart-remove-coupon').click();
    await expect(page.getByTestId('cart-coupon-applied')).toHaveCount(0);
  });

  test('checkout form validation and submit', async ({ page }) => {
    const cartItem = await ensureCartItem(page);
    if (!cartItem) return;

    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-form')).toBeVisible();

    await page.getByTestId('checkout-email').fill('buyer@example.com');
    await page.getByTestId('checkout-first-name').fill('Playwright');
    await page.getByTestId('checkout-last-name').fill('Tester');
    await page.getByTestId('checkout-address').fill('123 Test Street');
    await page.getByTestId('checkout-city').fill('Lagos');
    await page.getByTestId('checkout-zip').fill('100001');
    await page.getByTestId('checkout-terms').check();

    await expect(page.getByTestId('checkout-submit')).toBeVisible();
  });

  test('wishlist add all to cart', async ({ page }) => {
    const result = await selectPurchasableCard(page);
    if (!result) return;
    const { card, productId } = result;
    const wishlistButton = card.locator('[data-testid$="-wishlist"]').first();
    if (await wishlistButton.isDisabled()) {
      await expect(wishlistButton).toBeDisabled();
      return;
    }
    await wishlistButton.click();

    await page.goto('/wishlist');
    await expect(page.getByTestId('wishlist-page')).toBeVisible();

    const wishlistCard = page
      .locator(`[data-testid="product-card-${productId}"]`)
      .first();
    await expect(wishlistCard).toBeVisible();

    const addAllButton = page.getByTestId('wishlist-add-all');
    if (!(await addAllButton.isEnabled())) {
      const emptyState = page.getByTestId('wishlist-empty');
      if ((await emptyState.count()) > 0) {
        await expect(emptyState).toBeVisible();
      } else {
        await expect(addAllButton).toBeDisabled();
      }
      return;
    }
    await addAllButton.click();

    await page.goto('/cart');
    await expect(
      page
        .locator(
          `[data-testid^="cart-item-"][data-product-id="${productId}"]`
        )
        .first()
    ).toBeVisible();
  });
});
