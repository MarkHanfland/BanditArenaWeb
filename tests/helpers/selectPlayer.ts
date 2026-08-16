import { expect } from '@playwright/test';

/**
 * Opens the player select overlay and confirms a player.
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} namePattern
 * @param {{ compact?: boolean, userId?: string }} [options]
 */
export async function selectEnrolledPlayer(page, namePattern, options: {
  compact?: boolean
  userId?: string
} = {}) {
  const compact = options.compact !== false;
  const openId = compact ? 'header-player-select' : 'player-select';
  const dialogId = compact ? 'header-player-select-dialog' : 'player-select-dialog';

  await page.getByTestId(openId).click();
  await expect(page.getByTestId(dialogId)).toBeVisible();

  const showAll = page.getByTestId(`${dialogId}-show-all`);
  if (await showAll.count()) {
    await showAll.click();
  } else {
    const scheduledOnly = page.getByTestId(`${dialogId}-scheduled-only`);
    if (await scheduledOnly.isChecked()) {
      // Keep scheduled filter when the target is scheduled; otherwise show all via search path.
    }
  }

  if (options.userId) {
    await page.getByTestId(`${dialogId}-row-${options.userId}`).click();
  } else {
    await page.getByTestId(new RegExp(`^${dialogId}-row-`)).filter({ hasText: namePattern }).first().click();
  }

  await page.getByTestId(`${dialogId}-confirm`).click();
  await expect(page.getByTestId(dialogId)).toHaveCount(0);
}
