import { expect, test } from '@playwright/test';
import { resolveE2eAdminUser } from '../helpers/auth';
import { expandAllMenuGroups } from '../helpers/menuNav';
import { mockConsoleApis } from '../helpers/mockApis';

type RoleCase = {
  roleId: 'operator' | 'technician' | 'venueAdmin' | 'fleetAdmin' | 'cloudAdmin';
  expected: string[];
  expectedDisabled: string[];
  notExpected: string[];
};

// Cloud menus follow FR-SW-AUTH-010: business pages (Cloud Administrator ⊇ Venue
// Administrator) and fleet pages (Fleet Administrator ⊇ Field Service Technician).
const roleCases: RoleCase[] = [
  {
    roleId: 'operator',
    expected: ['menu-dashboard', 'menu-treadmill', 'menu-events'],
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
      'menu-group-operations',
      'menu-group-device-fleet',
      'menu-group-administration',
    ],
  },
  {
    roleId: 'technician',
    expected: ['menu-dashboard', 'menu-services', 'menu-config', 'menu-group-device-fleet'],
    expectedDisabled: ['menu-diagnostics', 'menu-support'],
    notExpected: [
      'menu-fleet',
      'menu-firmware',
      'menu-media',
      'menu-usage',
      'menu-billing',
      'menu-users',
      'menu-staff',
      'menu-sessions',
      'menu-group-operations',
      'menu-group-content',
      'menu-group-business',
      'menu-group-analytics',
      'menu-group-administration',
    ],
  },
  {
    roleId: 'venueAdmin',
    expected: [
      'menu-dashboard',
      'menu-treadmill',
      'menu-services',
      'menu-events',
      'menu-config',
      'menu-media',
      'menu-users',
      'menu-reservations',
      'menu-staff',
      'menu-sessions',
      'menu-group-operations',
      'menu-group-content',
    ],
    expectedDisabled: ['menu-notifications', 'menu-media-uploads', 'menu-session-recordings'],
    notExpected: [
      'menu-fleet',
      'menu-usage',
      'menu-billing',
      'menu-accounts',
      'menu-service-logs',
      'menu-group-device-fleet',
      'menu-group-business',
      'menu-group-analytics',
      'menu-group-administration',
    ],
  },
  {
    roleId: 'fleetAdmin',
    expected: [
      'menu-dashboard',
      'menu-fleet',
      'menu-usage',
      'menu-billing',
      'menu-service-logs',
      'menu-group-device-fleet',
      'menu-group-analytics',
      'menu-group-administration',
    ],
    expectedDisabled: ['menu-firmware', 'menu-diagnostics', 'menu-roles', 'menu-audit'],
    notExpected: ['menu-users', 'menu-sessions', 'menu-media', 'menu-staff', 'menu-accounts', 'menu-group-operations'],
  },
  {
    roleId: 'cloudAdmin',
    expected: [
      'menu-dashboard',
      'menu-users',
      'menu-sessions',
      'menu-media',
      'menu-billing',
      'menu-accounts',
      'menu-usage',
      'menu-service-logs',
      'menu-group-operations',
      'menu-group-content',
      'menu-group-business',
      'menu-group-administration',
    ],
    expectedDisabled: ['menu-subscriptions', 'menu-roles', 'menu-audit'],
    notExpected: ['menu-fleet', 'menu-group-device-fleet'],
  },
];

for (const roleCase of roleCases) {
  test(`renders the correct pillar menu for ${roleCase.roleId}`, async ({ page }) => {
    await mockConsoleApis(page);
    const user = resolveE2eAdminUser(roleCase.roleId);

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
