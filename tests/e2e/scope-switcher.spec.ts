import { expect, test } from '@playwright/test';
import { resolveE2eAdminUser } from '../helpers/auth';
import { mockCloudApi } from '../helpers/mockApis';
import { openMenuItem } from '../helpers/menuNav';

// FR-SW-UI-014 / FR-SW-AUTH-011: a staff member bound in two tenants switches scope; the
// console sends the choice as x-bandit-tenant and the cloud checks the binding.
test('a multi-tenant user switches scope and requests carry x-bandit-tenant', async ({ page }) => {
  await mockCloudApi(page);
  await page.route('**/role-bindings/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tenants: ['operator-home', 'operator-second'], homeOperatorId: 'operator-home', bindings: [] }),
    }),
  );
  const seen: (string | undefined)[] = [];
  page.on('request', (req) => {
    if (/\/api\/users(\?|$)/.test(req.url())) seen.push(req.headers()['x-bandit-tenant']);
  });

  const owner = resolveE2eAdminUser('accountOwner');
  await page.goto('/?e2eAuthBypass=true&e2eCloudConsole=true');
  await page.getByTestId('login-username').fill(owner.username);
  await page.getByTestId('login-password').fill(owner.password);
  await page.getByLabel('Role').click();
  await page.getByRole('option', { name: owner.label }).click();
  await page.getByTestId('login-submit').click();

  const switcher = page.getByTestId('scope-switcher');
  await expect(switcher).toBeVisible();
  await switcher.click();
  await page.getByTestId('scope-option-operator-second').click();

  await openMenuItem(page, 'operations', 'menu-users');
  await expect.poll(() => seen.includes('operator-second')).toBe(true);

  // Back to the home tenant: the header is dropped (the token's tenant applies).
  await switcher.click();
  await page.getByTestId('scope-option-operator-home').click();
  const before = seen.length;
  await openMenuItem(page, 'operations', 'menu-reservations');
  await openMenuItem(page, 'operations', 'menu-users');
  await expect.poll(() => seen.length > before).toBe(true);
  expect(seen[seen.length - 1]).toBeUndefined();
});
