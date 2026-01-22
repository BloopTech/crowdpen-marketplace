// @ts-check
import path from 'path';
import { marketplaceTest as test, expect } from '../fixtures/auth';

test.describe('Marketplace account flows @regression', () => {
  test('purchases list and downloads', async ({ page }) => {
    await page.goto('/account?tab=purchases');
    await expect(page.getByTestId('account-tabs')).toBeVisible();
    await expect(page.getByTestId('purchases-card')).toBeVisible();

    const orders = page.locator('[data-testid^="purchase-order-"]');
    const purchasesList = page.getByTestId('purchases-list');
    await expect(purchasesList).toBeVisible();
    if ((await orders.count()) === 0) {
      return;
    }

    const orderId = await orders.first().getAttribute('data-testid');
    const orderKey = orderId?.replace('purchase-order-', '');
    expect(orderKey).toBeTruthy();
    await expect(page.getByTestId(`purchase-order-header-${orderKey}`)).toBeVisible();
    await expect(page.getByTestId(`purchase-order-items-${orderKey}`)).toBeVisible();

    const item = page
      .getByTestId(`purchase-order-items-${orderKey}`)
      .locator('[data-testid^="purchase-item-"]')
      .first();
    if ((await item.count()) > 0) {
      await expect(item).toBeVisible();
      const download = page.locator('[data-testid^="purchase-download-"]').first();
      if ((await download.count()) > 0) {
        await expect(download).toBeVisible();
      }
    }
  });

  test('products drafts and manage actions', async ({ page }) => {
    const uploadCheck = await page.request.get(
      '/api/marketplace/products/upload-capabilities'
    );
    const uploadData = await uploadCheck.json().catch(() => ({}));
    test.skip(
      !uploadCheck.ok || uploadData?.status !== 'success',
      'Uploads unavailable for product tests.'
    );

    const timestamp = Date.now();
    const productTitle = `PW Product ${timestamp}`;
    const updatedTitle = `${productTitle} Updated`;
    const description = `Playwright description ${timestamp}`;
    const imagePath = path.resolve(
      process.cwd(),
      'public',
      'placeholder-logo.png'
    );

    await page.goto('/product/create');
    await expect(page.getByTestId('product-create-form')).toBeVisible();

    await page.getByTestId('product-create-title').fill(productTitle);
    await page.getByTestId('product-create-description').click();
    await page.keyboard.type(description);

    await page.getByTestId('product-create-category').click();
    await page.getByRole('option').first().click();

    await page.getByTestId('product-create-subcategory').click();
    await page.getByRole('option').first().click();

    await page.getByTestId('product-create-original-price').fill('25');
    await page.getByTestId('product-create-stock').fill('5');

    await page.getByTestId('product-create-images').setInputFiles(imagePath);
    await page.getByTestId('product-create-file').setInputFiles({
      name: 'sample.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'),
    });

    await page.getByTestId('product-create-submit').click();
    await page.waitForURL(/\/product\/[A-Za-z0-9]+$/);

    const pathnameParts = new URL(page.url()).pathname.split('/');
    const productId = pathnameParts[pathnameParts.length - 1];
    expect(productId).toBeTruthy();

    await page.goto(`/product/edit/${productId}`);
    await expect(page.getByTestId('product-edit-form')).toBeVisible();
    await page.getByTestId('product-edit-title').fill(updatedTitle);
    await page.getByTestId('product-edit-submit').click();
    await page.waitForURL(new RegExp(`/product/${productId}$`));

    await page.goto('/account?tab=my-products');
    await expect(page.getByTestId('account-products-card')).toBeVisible();
    await expect(
      page.getByTestId(`account-product-${productId}`)
    ).toContainText(updatedTitle);
  });

  test('payouts bank details and history', async ({ page }) => {
    await page.goto('/account?tab=payouts');
    await expect(page.getByTestId('account-payouts')).toBeVisible();
    await expect(page.getByTestId('account-payouts-analytics')).toBeVisible();
    await expect(page.getByTestId('bank-details-card')).toBeVisible();
    await expect(page.getByTestId('account-payouts-history')).toBeVisible();

    const historyList = page.getByTestId('account-payouts-list');
    const historyEmpty = page.getByTestId('account-payouts-empty');
    await expect(historyList.or(historyEmpty)).toBeVisible();
  });

  test('billing transactions render', async ({ page }) => {
    await page.goto('/account?tab=billing');
    await expect(page.getByTestId('billing-card')).toBeVisible();
    await expect(page.getByTestId('billing-transactions')).toBeVisible();

    const rows = page.locator('[data-testid^="billing-transaction-"]');
    if ((await rows.count()) === 0) {
      await expect(page.getByTestId('billing-transactions-list')).toBeVisible();
      return;
    }

    const rowId = await rows.first().getAttribute('data-testid');
    const rowKey = rowId?.replace('billing-transaction-', '');
    expect(rowKey).toBeTruthy();
    await expect(page.getByTestId(`billing-transaction-title-${rowKey}`)).toBeVisible();
    await expect(page.getByTestId(`billing-transaction-amount-${rowKey}`)).toBeVisible();
  });

  test('settings preferences and danger zone', async ({ page }) => {
    await page.goto('/account?tab=settings');
    await expect(page.getByTestId('account-settings-card')).toBeVisible();
    await expect(page.getByTestId('settings-email-section')).toBeVisible();
    await expect(page.getByTestId('settings-privacy-section')).toBeVisible();
    await expect(page.getByTestId('settings-danger-zone')).toBeVisible();
    await expect(page.getByTestId('settings-delete-account')).toBeVisible();
  });

  test('verification multi-step KYC', async ({ page }) => {
    await page.goto('/account?tab=verification');
    await expect(page.getByTestId('verification-card')).toBeVisible();

    const exemptNotice = page.getByTestId('verification-exempt');
    if ((await exemptNotice.count()) > 0 && (await exemptNotice.isVisible())) {
      await expect(exemptNotice).toBeVisible();
      return;
    }

    await expect(page.getByTestId('verification-form')).toBeVisible();
    await expect(page.getByTestId('verification-status')).toBeVisible();

    const stepper = page.getByTestId('verification-stepper');
    if ((await stepper.count()) > 0) {
      await expect(stepper).toBeVisible();
      await expect(page.getByTestId('verification-step-0')).toBeVisible();
    }
  });
});
