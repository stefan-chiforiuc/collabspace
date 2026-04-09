import { test, expect } from '@playwright/test';

test('App loads and landing page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('CollabSpace')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByPlaceholder('Enter your display name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create Room' })).toBeVisible();
});

test('Can create a room', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Enter your display name').fill('TestUser');
  await page.getByRole('button', { name: 'Create Room' }).click();

  // Should navigate to room view — wait for tabs to appear
  await expect(page.getByRole('tab', { name: 'Chat' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('tab', { name: 'Polls' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Poker' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Timer' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Notes' })).toBeVisible();

  // Copy Link and Leave buttons visible
  await expect(page.getByRole('button', { name: /copy/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();
});
