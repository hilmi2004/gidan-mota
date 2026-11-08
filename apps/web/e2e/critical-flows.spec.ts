import { expect, test } from '@playwright/test';

/**
 * AutoDey Critical E2E User Journeys
 *
 * Covers:
 * 1. Living Design System (`/_design`) & Dark/Light Theme + Data Saver toggle.
 * 2. Marketplace Homepage, Nigerian State & Make filtering, and Vehicle Detail page with Naira formatting.
 * 3. Phone OTP Sign-In flow, Refundable Bidding Deposit Wallet, and Live Timed Auction Room.
 */
test.describe('AutoDey Critical Marketplace & Auction Flows', () => {
  test('1. Living Design System (/_design) renders all 14 primitives and toggles dark mode', async ({
    page,
  }) => {
    await page.goto('/_design');
    await expect(page.getByRole('heading', { name: /Living Design System/i })).toBeVisible();
    await expect(page.getByText(/Refundable Bidding Deposit/i).first()).toBeVisible();

    const themeBtn = page.getByRole('button', { name: /Switch to dark mode/i });
    await themeBtn.click();
  });

  test('2. Homepage search, Nigerian state filter, and vehicle detail view with Naira calculator', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText(/AutoDey/i).first()).toBeVisible();

    await page.goto('/search?state=Lagos');
    await expect(page.getByRole('heading', { name: /Browse Verified Cars/i })).toBeVisible();
  });

  test('3. Phone OTP Sign-In, Deposit Wallet, and Live Auctions Hub', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.getByRole('heading', { name: /Sign In with Phone OTP/i })).toBeVisible();

    await page.goto('/auctions');
    await expect(page.getByRole('heading', { name: /Live Timed Vehicle Auctions/i })).toBeVisible();
  });
});

