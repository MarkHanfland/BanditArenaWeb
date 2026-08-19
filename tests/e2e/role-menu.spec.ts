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
      'menu-media',
      'menu-staff',
      'menu-maintenance',
    ],
  },
  {
    roleId: 'technician',
    expected: [
      'menu-dashboard',
      'menu-services',
      'menu-config',
      'menu-media',
      'menu-fleet',
      'menu-usage',
    ],
    notExpected: ['menu-billing', 'menu-users', 'menu-staff', 'menu-maintenance'],
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
      'menu-media',
      'menu-users',
      'menu-reservations',
      'menu-staff',
      'menu-usage',
      'menu-fleet',
      'menu-billing',
    ],
    notExpected: ['menu-maintenance'],
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
