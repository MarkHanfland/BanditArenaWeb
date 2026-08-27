import { expect, test } from '@playwright/test';
import { getTestAdministratorUser } from '../helpers/testCredentials';
import { expandAllMenuGroups } from '../helpers/menuNav';
import { mockConsoleApis } from '../helpers/mockApis';

type RoleCase = {
  roleId: 'operator' | 'technician' | 'venueAdmin';
  expected: string[];
  expectedDisabled: string[];
  notExpected: string[];
};

const roleCases: RoleCase[] = [
  {
    roleId: 'operator',
    expected: ['menu-dashboard', 'menu-user', 'menu-treadmill', 'menu-events'],
    expectedDisabled: [],
    notExpected: [
      'menu-config',
      'menu-services',
      'menu-users',
      'menu-fleet',
      'menu-billing',
      'menu-media',
      'menu-staff',
      'menu-sessions',
      'menu-maintenance',
      'menu-group-operations',
      'menu-group-device-fleet',
      'menu-group-administration',
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
      'menu-group-device-fleet',
      'menu-group-content',
      'menu-group-analytics',
    ],
    expectedDisabled: [
      'menu-firmware',
      'menu-diagnostics',
      'menu-media-uploads',
      'menu-device-analytics',
    ],
    notExpected: [
      'menu-billing',
      'menu-users',
      'menu-staff',
      'menu-sessions',
      'menu-maintenance',
      'menu-group-operations',
      'menu-group-business',
      'menu-group-administration',
    ],
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
      'menu-sessions',
      'menu-group-operations',
      'menu-group-device-fleet',
      'menu-group-content',
      'menu-group-business',
      'menu-group-analytics',
      'menu-group-administration',
    ],
    expectedDisabled: [
      'menu-notifications',
      'menu-firmware',
      'menu-diagnostics',
      'menu-support',
      'menu-network',
      'menu-media-uploads',
      'menu-session-recordings',
      'menu-subscriptions',
      'menu-pricing',
      'menu-device-analytics',
      'menu-experience-analytics',
      'menu-revenue-analytics',
      'menu-roles',
      'menu-integrations',
      'menu-branding',
      'menu-audit',
    ],
    notExpected: ['menu-maintenance'],
  },
];

for (const roleCase of roleCases) {
  test(`renders the correct pillar menu for ${roleCase.roleId}`, async ({ page }) => {
    await mockConsoleApis(page);
    const user = getTestAdministratorUser(roleCase.roleId);

    await page.goto('/?e2eAuthBypass=true');

    await page.getByTestId('login-username').fill(user.username);
    await page.getByTestId('login-password').fill(user.password);
    await page.getByLabel('Role').click();
    await page.getByRole('option', { name: user.label }).click();
    await page.getByTestId('login-submit').click();

    await expandAllMenuGroups(page);

    for (const menuId of roleCase.expected) {
      await expect(page.getByTestId(menuId)).toBeVisible();
    }

    for (const menuId of roleCase.expectedDisabled) {
      await expect(page.getByTestId(menuId)).toBeVisible();
      await expect(page.getByTestId(menuId)).toBeDisabled();
      await expect(page.getByTestId(menuId)).toHaveAttribute('data-implemented', 'false');
    }

    for (const menuId of roleCase.notExpected) {
      await expect(page.getByTestId(menuId)).toHaveCount(0);
    }
  });
}
