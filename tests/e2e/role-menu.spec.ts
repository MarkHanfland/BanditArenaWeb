import { expect, test } from '@playwright/test';
import { getTestAdministratorUser } from '../helpers/testCredentials';

type RoleCase = {
  roleId: 'operator' | 'technician' | 'venueAdmin';
  expected: string[];
  notExpected: string[];
};

const roleCases: RoleCase[] = [
  {
    roleId: 'operator',
    expected: ['menu-dashboard', 'menu-user', 'menu-treadmill', 'menu-events'],
    notExpected: [
      'menu-config',
      'menu-services',
      'menu-users',
      'menu-fleet',
      'menu-billing',
      'menu-content',
      'menu-staff',
    ],
  },
  {
    roleId: 'technician',
    expected: [
      'menu-dashboard',
      'menu-services',
      'menu-config',
      'menu-content',
      'menu-maintenance',
      'menu-usage',
    ],
    notExpected: ['menu-billing', 'menu-fleet', 'menu-users', 'menu-staff'],
  },
  {
    roleId: 'venueAdmin',
    expected: [
      'menu-dashboard',
      'menu-user',
      'menu-treadmill',
      'menu-services',
      'menu-events',
      'menu-config',
      'menu-content',
      'menu-users',
      'menu-reservations',
      'menu-staff',
      'menu-billing',
      'menu-usage',
      'menu-fleet',
      'menu-maintenance',
    ],
    notExpected: [],
  },
];

for (const roleCase of roleCases) {
  test(`renders the correct menu for ${roleCase.roleId}`, async ({ page }) => {
    const user = getTestAdministratorUser(roleCase.roleId);

    await page.goto('/?e2eAuthBypass=true');

    await page.getByTestId('login-username').fill(user.username);
    await page.getByTestId('login-password').fill(user.password);
    await page.getByLabel('Role').click();
    await page.getByRole('option', { name: user.label }).click();
    await page.getByTestId('login-submit').click();

    for (const menuId of roleCase.expected) {
      await expect(page.getByTestId(menuId)).toBeVisible();
    }

    for (const menuId of roleCase.notExpected) {
      await expect(page.getByTestId(menuId)).toHaveCount(0);
    }
  });
}
