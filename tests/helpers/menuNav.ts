/**
 * @param {import('@playwright/test').Page} page
 * @param {string} groupId - e.g. 'operations', 'local'
 */
export async function expandMenuGroup(page, groupId) {
  const toggle = page.getByTestId(`menu-group-toggle-${groupId}`);
  await toggle.waitFor({ state: 'visible' });
  const expanded = await toggle.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await toggle.click();
  }
}

/**
 * Expand a pillar if needed, then click a menu item.
 * @param {import('@playwright/test').Page} page
 * @param {string} groupId
 * @param {string} menuTestId - e.g. 'menu-users'
 */
export async function openMenuItem(page, groupId, menuTestId) {
  await expandMenuGroup(page, groupId);
  await page.getByTestId(menuTestId).click();
}

/** Expand every visible pillar toggle so role assertions can see leaf items. */
export async function expandAllMenuGroups(page) {
  const toggles = page.locator('[data-testid^="menu-group-toggle-"]');
  const count = await toggles.count();
  for (let i = 0; i < count; i += 1) {
    const toggle = toggles.nth(i);
    if (!(await toggle.isEnabled())) continue;
    const expanded = await toggle.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await toggle.click();
    }
  }
}
