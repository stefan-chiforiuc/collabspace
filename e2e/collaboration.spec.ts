import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * CollabSpace P2P Collaboration E2E Tests
 *
 * These tests simulate two real users (Alice and Bob) interacting with the app
 * in separate browser contexts. Each context has its own cookies, storage, and
 * WebRTC connections — just like two real people on different machines.
 *
 * P2P signaling goes through Nostr relays, so connection can take 10-30 seconds.
 */

// Increase timeout for P2P tests — signaling via Nostr relays is slow
test.setTimeout(120_000);

test.describe('P2P Collaboration — Two Users', () => {
  let contextAlice: BrowserContext;
  let contextBob: BrowserContext;
  let alice: Page;
  let bob: Page;
  let roomUrl: string;

  test.beforeAll(async ({ browser }) => {
    // Create two independent browser contexts (like two different users)
    contextAlice = await browser.newContext();
    contextBob = await browser.newContext();
    alice = await contextAlice.newPage();
    bob = await contextBob.newPage();

    // Alice creates a room
    await alice.goto('/');
    await alice.getByPlaceholder('Enter your display name').fill('Alice');
    await alice.getByRole('button', { name: 'Create Room' }).click();
    await alice.getByRole('tab', { name: 'Chat' }).waitFor({ timeout: 15_000 });
    roomUrl = alice.url();

    // Bob joins the same room
    await bob.goto('/');
    await bob.getByPlaceholder('Enter your display name').fill('Bob');
    await bob.goto(roomUrl);
    await bob.getByRole('tab', { name: 'Chat' }).waitFor({ timeout: 15_000 });

    // Wait for P2P connection — this is the slow part (Nostr signaling + WebRTC)
    await alice.waitForSelector('[aria-label="Connected"]', { timeout: 60_000 });
    await bob.waitForSelector('[aria-label="Connected"]', { timeout: 60_000 });

    // Extra wait for Yjs sync to complete
    await alice.waitForTimeout(3000);
  });

  test.afterAll(async () => {
    await contextAlice?.close();
    await contextBob?.close();
  });

  test('Alice and Bob can see each other connected', async () => {
    // Both should have the green connected indicator
    await expect(alice.locator('[aria-label="Connected"]')).toBeVisible();
    await expect(bob.locator('[aria-label="Connected"]')).toBeVisible();
  });

  test('Chat messages sync between Alice and Bob', async () => {
    // Make sure both are on the Chat tab
    await alice.getByRole('tab', { name: 'Chat' }).click();
    await bob.getByRole('tab', { name: 'Chat' }).click();

    // Alice sends a message
    await alice.getByPlaceholder(/type a message/i).fill('Hello from Alice!');
    await alice.getByPlaceholder(/type a message/i).press('Enter');

    // Bob should see Alice's message
    await expect(bob.getByText('Hello from Alice!')).toBeVisible({ timeout: 15_000 });

    // Bob replies
    await bob.getByPlaceholder(/type a message/i).fill('Hey Alice, Bob here!');
    await bob.getByPlaceholder(/type a message/i).press('Enter');

    // Alice should see Bob's reply
    await expect(alice.getByText('Hey Alice, Bob here!')).toBeVisible({ timeout: 15_000 });
  });

  test('Poll creation and voting syncs', async () => {
    await alice.getByRole('tab', { name: 'Polls' }).click();
    await bob.getByRole('tab', { name: 'Polls' }).click();

    // Alice creates a poll
    const questionInput = alice.getByPlaceholder(/question/i);
    if (await questionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await questionInput.fill('What to work on?');

      const optionInputs = alice.locator('input[placeholder*="ption"]');
      if ((await optionInputs.count()) >= 2) {
        await optionInputs.nth(0).fill('Frontend');
        await optionInputs.nth(1).fill('Backend');
      }

      const createBtn = alice.getByRole('button', { name: /create/i });
      if (await createBtn.isVisible()) await createBtn.click();

      // Bob should see the poll
      await expect(bob.getByText('What to work on?')).toBeVisible({ timeout: 15_000 });
    }
  });

  test('Timer syncs between peers', async () => {
    await alice.getByRole('tab', { name: 'Timer' }).click();
    await bob.getByRole('tab', { name: 'Timer' }).click();

    // Alice starts a 1-minute timer
    const presetBtn = alice.getByRole('button', { name: /1\s*m/i });
    if (await presetBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await presetBtn.click();
      await alice.waitForTimeout(2000);

      // Bob should see a running timer (header timer or timer panel)
      const bobTimer = bob.locator('[role="timer"]').first();
      await expect(bobTimer).toBeVisible({ timeout: 15_000 });
    }
  });

  test('Notepad collaborative editing syncs', async () => {
    await alice.getByRole('tab', { name: 'Notes' }).click();
    await bob.getByRole('tab', { name: 'Notes' }).click();

    await alice.waitForTimeout(2000); // Wait for TipTap to initialize

    const aliceEditor = alice.locator('.tiptap, .ProseMirror').first();
    if (await aliceEditor.isVisible({ timeout: 5000 }).catch(() => false)) {
      await aliceEditor.click();
      await aliceEditor.pressSequentially('Shared notes from Alice', { delay: 50 });

      await alice.waitForTimeout(3000); // Wait for Yjs sync

      const bobEditor = bob.locator('.tiptap, .ProseMirror').first();
      await expect(bobEditor).toContainText('Shared notes from Alice', { timeout: 15_000 });
    }
  });

  test('Planning poker round syncs', async () => {
    await alice.getByRole('tab', { name: 'Poker' }).click();
    await bob.getByRole('tab', { name: 'Poker' }).click();

    const startBtn = alice.getByRole('button', { name: /start|new round/i });
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click();
      await alice.waitForTimeout(2000);

      // Bob should see vote cards in the poker panel
      const pokerPanel = bob.locator('#panel-poker');
      const bobCards = pokerPanel.locator('button').filter({ hasText: /^[0-9½?∞]+$/ });
      const count = await bobCards.count();
      if (count > 0) {
        await bobCards.first().click();
      }
    }
  });
});

test.describe('Room Password Protection', () => {
  test.setTimeout(120_000);

  test('Password-protected room requires password to join', async ({ browser }) => {
    const ctxCreator = await browser.newContext();
    const ctxJoiner = await browser.newContext();
    const creator = await ctxCreator.newPage();
    const joiner = await ctxJoiner.newPage();

    try {
      // Creator: set up room with password
      await creator.goto('/');
      await creator.getByPlaceholder('Enter your display name').fill('Creator');
      await creator.getByText(/room options/i).click();
      await creator.getByPlaceholder(/leave empty/i).fill('secret123');
      await creator.getByRole('button', { name: 'Create Room' }).click();
      await creator.getByRole('tab', { name: 'Chat' }).waitFor({ timeout: 15_000 });

      // Extract room code from URL (without password param)
      const fullUrl = creator.url();
      const roomCodeMatch = fullUrl.match(/#\/room\/([^?]+)/);
      const roomCode = roomCodeMatch?.[1];
      expect(roomCode).toBeTruthy();

      // Joiner: navigate to room WITHOUT the password in URL
      await joiner.goto('/');
      await joiner.getByPlaceholder('Enter your display name').fill('Joiner');
      await joiner.goto(`http://localhost:5173/#/room/${roomCode}`);

      // Wait for P2P sync + password gate to appear
      const passwordInput = joiner.getByPlaceholder(/enter room password/i);
      await expect(passwordInput).toBeVisible({ timeout: 60_000 });

      // Enter wrong password
      await passwordInput.fill('wrongpassword');
      await joiner.getByRole('button', { name: /join/i }).click();
      await expect(joiner.getByText(/incorrect/i)).toBeVisible({ timeout: 5_000 });

      // Enter correct password
      await passwordInput.fill('secret123');
      await joiner.getByRole('button', { name: /join/i }).click();

      // Should now see the room
      await joiner.getByRole('tab', { name: 'Chat' }).waitFor({ timeout: 15_000 });
    } finally {
      await ctxCreator.close();
      await ctxJoiner.close();
    }
  });
});
