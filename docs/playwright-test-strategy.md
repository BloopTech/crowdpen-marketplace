# Playwright Test Strategy (Crowdpen Marketplace)

## Goals

- Catch user-visible regressions across marketplace + admin experiences before they hit production.
- Treat Playwright as a "senior QA" by asserting UI correctness, absence of errors, and critical workflow completion.
- Provide fast feedback for PRs and scheduled synthetic monitoring with alerts.

## Guiding Principles

- Prefer stable selectors via `data-testid` (already added across key UI).
- Focus on user-visible behavior, not implementation details.
- Keep smoke tests lightweight and reliable; push heavy scenarios into regression suites.
- Fail on console/page errors whenever possible.
- Keep test data isolated and deterministic (seeded users + fixtures).

## Environments

- **Local/CI PRs**: run against local web server via `playwright.config.js`.
- **Synthetic monitoring**: run against production-like URL with `PLAYWRIGHT_BASE_URL`.

## Test Layers
### 1) Smoke (always on / scheduled)

- Fast checks verifying site is up and key pages render without errors.
- Tagged with `@smoke` and run via `npm run test:e2e:smoke`.

### 2) Core Regression (PR gating)

- Covers primary user flows for marketplace + admin.
- Runs on every PR via CI.

### 3) Extended / Nightly

- Long-running, broader scenarios (edge cases, larger datasets, multi-step flows).
- Run on schedule or manual trigger.

## Cross-Cutting Assertions

- Page renders without `pageerror` or console errors.
- Critical CTAs are visible and enabled when appropriate.
- Network-driven UI states show a non-error state.
- Error handling (toast, banners, inline states) is user-readable.

## Test Data & Auth Strategy

- Maintain **seeded test accounts** (marketplace user, merchant, admin) in a non-prod environment.
- Use Playwright storage state to avoid repeated login flows in regression suites.
- For production monitoring, avoid auth-required flows unless a dedicated monitoring account is available.

### Playwright Auth Storage State

- Global setup writes storage state files to `playwright/.auth/marketplace.json` and `playwright/.auth/admin.json`.
- Prefer dedicated seeded test accounts for Playwright (avoid shared human accounts to keep data clean).
- Set these environment variables before running regression tests:
  - `PLAYWRIGHT_MARKETPLACE_USER_ID`
  - `PLAYWRIGHT_MARKETPLACE_USER_EMAIL`
  - `PLAYWRIGHT_MARKETPLACE_USER_NAME` (optional)
  - `PLAYWRIGHT_MARKETPLACE_USER_IMAGE` (optional)
  - `PLAYWRIGHT_ADMIN_USER_ID`
  - `PLAYWRIGHT_ADMIN_USER_EMAIL`
  - `PLAYWRIGHT_ADMIN_USER_NAME` (optional)
  - `PLAYWRIGHT_ADMIN_USER_IMAGE` (optional)
- For production-like environments that enforce SSO signing, set `PLAYWRIGHT_SSO_SECRET` to generate signatures.

## Coverage Map (Flows + Key Assertions)
| Area | Pages / Components | Smoke Assertions | Regression Assertions |
| --- | --- | --- | --- |
| Marketplace header | `MarketplaceHeader` | Header, search input, cart/wishlist buttons present | Search suggestions render, navigation links work |
| Browse & discover | Home/search | Search input usable | Search results filter/sort, category navigation |
| Product detail | Product cards | Product card renders | View product detail, add to cart/wishlist |
| Cart | `/cart` | Guest sees login prompt | Quantity update, remove item, coupon apply/remove |
| Checkout | `/checkout` | Page renders (if accessible) | Contact + payment form validation, submit order |
| Wishlist | `/wishlist` | Guest sees login prompt | Add/remove items, add-all-to-cart, filters |
| Account purchases | `/account` tab Purchases | Tab renders | Order details, download actions |
| Account products | `/account` tab Products | Tab renders | Drafts, create, edit/delete product |
| Account payouts | `/account` tab Payouts | Tab renders | Bank details form, payout history |
| Account billing | `/account` tab Billing | Tab renders | Transactions + currency conversion |
| Account settings | `/account` tab Settings | Tab renders | Toggle preferences, share link, danger zone |
| Account verification | `/account` tab Verification | Tab renders | KYC multi-step form, upload validation |
| Admin dashboard | `/admin` | Dashboard cards render | Key metrics values, navigation |
| Admin KYC | `/admin/kyc` | Tab renders | Approve/reject flow, review dialog |
| Admin payouts | `/admin/payouts` | Page renders | Create payout, filter, pagination |
| Admin merchants | `/admin/merchants` | Page renders | Filter/sort, view merchants/applicants |
| Admin products | `/admin/products` | Page renders | Filter, product status, pagination |
| Admin coupons | `/admin/coupons` | Page renders | Create/edit/delete coupon |
| Admin analytics | `/admin/analytics` | Page renders | Charts + tables populated |
| Admin payment provider | `/admin/payment-provider` | Toggle renders | Toggle state updates |

## Reporting & Artifacts

- HTML report for local/CI.
- JUnit for CI integration.
- Trace, screenshot, and video on failure.

## Alerting & Monitoring

- Scheduled Playwright smoke tests run on GitHub Actions.
- Failures create/append a GitHub issue to alert the team.
- Recovery closes the issue automatically.

## Next Steps

- Add auth storage state + fixtures for seeded test accounts.
- Extend regression tests with real workflows once test data and API mocks are finalized.
- Integrate Slack or email alerts (optional).
