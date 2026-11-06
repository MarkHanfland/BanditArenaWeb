import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { signInAs, type E2eAdminRole } from '../helpers/auth';
import { mockConsoleApis } from '../helpers/mockApis';
import { expandAllMenuGroups } from '../helpers/menuNav';

// FR-SW-UI-021: an automated WCAG 2.2 A and AA check on the console. A violation fails the build.
// Menus follow the role (FR-SW-AUTH-010), so each implemented page is reached by a role that owns it.
const PAGE_SETS: Array<{ role: E2eAdminRole; cloudConsole: boolean; pages: string[] }> = [
  { role: 'venueAdmin', cloudConsole: false, pages: ['dashboard', 'treadmill', 'services', 'events', 'config'] },
  {
    role: 'cloudAdmin',
    cloudConsole: true,
    pages: ['reservations', 'venue-hours', 'users', 'staff', 'sessions', 'media', 'billing', 'accounts', 'usage', 'service-logs'],
  },
  { role: 'fleetAdmin', cloudConsole: true, pages: ['fleet'] },
];

const LANDINGS: Array<{ role: E2eAdminRole; label: string }> = [
  { role: 'operator', label: 'Operator' },
  { role: 'venueAdmin', label: 'Venue Administrator' },
  { role: 'frontDesk', label: 'Front Desk' },
  { role: 'accountOwner', label: 'Account Owner' },
  { role: 'billingAdmin', label: 'Billing Admin' },
  { role: 'fleetAdmin', label: 'Fleet Administrator' },
];

async function violations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes[0].target.join(' ').slice(0, 90)}`);
}

for (const { role, cloudConsole, pages } of PAGE_SETS) {
  test(`${role} ${cloudConsole ? 'cloud' : 'device'} pages have no detectable WCAG A or AA violation (FR-SW-UI-021)`, async ({ page }) => {
    test.setTimeout(240_000);
    await mockConsoleApis(page);
    await signInAs(page, role, { cloudConsole });
    await expect(page.getByTestId('sign-out')).toBeVisible();
    await expandAllMenuGroups(page);
    for (const id of pages) {
      await page.getByTestId(`menu-${id}`).click({ timeout: 10_000 });
      await expect(page.getByRole('heading', { level: 1 }), id).toBeAttached();
      await page.waitForTimeout(500);
      expect(await violations(page), id).toEqual([]);
    }
  });
}

test('the sign-in page has no detectable WCAG A or AA violation', async ({ page }) => {
  await page.goto('/?e2eAuthBypass=true');
  await expect(page.getByTestId('login-submit')).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

for (const { role, label } of LANDINGS) {
  test(`${label} landing page has no detectable WCAG A or AA violation`, async ({ page }) => {
    await mockConsoleApis(page);
    await signInAs(page, role);
    await expect(page.getByTestId('sign-out')).toBeVisible();
    await page.waitForTimeout(600);
    expect(await violations(page)).toEqual([]);
  });
}

test('every page names itself with one level-1 heading and the menu is a labelled navigation', async ({ page }) => {
  await mockConsoleApis(page);
  await signInAs(page, 'operator');
  await expect(page.getByRole('navigation', { name: 'Console' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bandit Arena Console');
  await expect(page).toHaveTitle('Dashboard · Bandit Arena Console');
  await page.getByTestId('menu-events').click();
  await expect(page).toHaveTitle('Events · Bandit Arena Console');
});
