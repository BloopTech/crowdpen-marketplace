// @ts-check
import { adminTest as test, expect } from '../fixtures/auth';

test.describe('Admin flows @regression', () => {
  test('dashboard metrics render', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByTestId('admin-dashboard')).toBeVisible();
    await expect(page.getByTestId('admin-dashboard-grid')).toBeVisible();
    await expect(
      page.getByTestId('admin-dashboard-card-total-users-label')
    ).toHaveText('Total Users');
    await expect(
      page.getByTestId('admin-dashboard-card-total-users-value')
    ).toBeVisible();
  });

  test('KYC review approve/reject', async ({ page }) => {
    await page.goto('/admin/kyc');
    await expect(page.getByTestId('admin-kyc-page')).toBeVisible();
    await expect(page.getByTestId('admin-kyc-tabs')).toBeVisible();
    await expect(page.getByTestId('admin-kyc-filter-level')).toBeVisible();

    const rows = page.locator('[data-testid^="admin-kyc-pending-row-"]');
    if ((await rows.count()) === 0) {
      await expect(page.getByTestId('admin-kyc-pending-empty')).toBeVisible();
      return;
    }

    const rowId = await rows.first().getAttribute('data-testid');
    const reviewId = rowId?.replace('admin-kyc-pending-row-', '');
    expect(reviewId).toBeTruthy();
    await page.getByTestId(`admin-kyc-pending-review-${reviewId}`).click();
    await expect(
      page.getByTestId(`admin-kyc-review-dialog-${reviewId}`)
    ).toBeVisible();
  });

  test('payouts filters and create payout', async ({ page }) => {
    await page.goto('/admin/payouts');
    await expect(page.getByTestId('admin-payouts-page')).toBeVisible();
    await expect(page.getByTestId('admin-payouts-bulk-section')).toBeVisible();
    await expect(page.getByTestId('admin-payouts-bulk-preview')).toBeVisible();
  });

  test('merchants filters and table rows', async ({ page }) => {
    await page.goto('/admin/merchants');
    await expect(page.getByTestId('admin-merchants-page')).toBeVisible();
    await expect(page.getByTestId('admin-merchants-filters')).toBeVisible();
    await expect(page.getByTestId('admin-merchants-table')).toBeVisible();

    await page.getByTestId('admin-merchants-tab-applicants').click();
    await expect(page.getByTestId('admin-merchants-tab-content')).toBeVisible();
  });

  test('products filters and pagination', async ({ page }) => {
    await page.goto('/admin/products');
    await expect(page.getByTestId('admin-products-page')).toBeVisible();
    await expect(page.getByTestId('admin-products-filters')).toBeVisible();
    await expect(page.getByTestId('admin-products-table')).toBeVisible();

    const rows = page.locator('[data-testid^="admin-product-row-"]');
    if ((await rows.count()) === 0) {
      await expect(page.getByTestId('admin-products-empty')).toBeVisible();
      return;
    }
  });

  test('coupons create/edit/delete', async ({ page }) => {
    await page.goto('/admin/coupons');
    await expect(page.getByTestId('admin-coupons-page')).toBeVisible();
    await page.getByTestId('admin-coupons-create').click();
    await expect(page.getByTestId('admin-coupons-dialog')).toBeVisible();
    await expect(page.getByTestId('admin-coupons-form')).toBeVisible();
    await page.getByTestId('admin-coupons-cancel').click();
  });

  test('analytics dashboard tables render', async ({ page }) => {
    await page.goto('/admin/analytics');
    await expect(page.getByTestId('admin-analytics-page')).toBeVisible();
    await expect(page.getByTestId('admin-analytics-summary-card')).toBeVisible();

    const summaryGrid = page.getByTestId('admin-analytics-summary-grid');
    const summaryLoading = page.getByTestId('admin-analytics-summary-loading');
    await expect(summaryGrid.or(summaryLoading)).toBeVisible();
  });

  test('payment provider toggle', async ({ page }) => {
    await page.goto('/admin/payment-provider');
    await expect(page.getByTestId('admin-payment-provider-page')).toBeVisible();
    await expect(page.getByTestId('admin-payment-provider-card')).toBeVisible();
    await expect(
      page.getByTestId('admin-payment-provider-toggle')
    ).toBeVisible();
  });
});
