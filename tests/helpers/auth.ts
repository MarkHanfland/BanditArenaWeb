import { getTestAdministratorUser } from './testCredentials';

export type E2eAdminRole =
  | 'operator' | 'technician' | 'venueAdmin' | 'fleetAdmin' | 'cloudAdmin'
  | 'accountOwner' | 'billingAdmin' | 'frontDesk' | 'orgAdmin' | 'instructor' | 'support';

const E2E_BYPASS_USERS: Record<E2eAdminRole, { username: string; password: string; label: string }> = {
  operator: { username: 'test-operator', password: 'e2e-bypass', label: 'Operator' },
  technician: { username: 'test-technician', password: 'e2e-bypass', label: 'Technician' },
  venueAdmin: { username: 'test-venue-admin', password: 'e2e-bypass', label: 'Venue Admin' },
  fleetAdmin: { username: 'test-fleet-admin', password: 'e2e-bypass', label: 'Fleet Admin' },
  cloudAdmin: { username: 'test-cloud-admin', password: 'e2e-bypass', label: 'Cloud Admin' },
  accountOwner: { username: 'test-account-owner', password: 'e2e-bypass', label: 'Account Owner' },
  billingAdmin: { username: 'test-billing-admin', password: 'e2e-bypass', label: 'Billing Admin' },
  frontDesk: { username: 'test-front-desk', password: 'e2e-bypass', label: 'Front Desk' },
  orgAdmin: { username: 'test-org-admin', password: 'e2e-bypass', label: 'Organization Admin' },
  instructor: { username: 'test-instructor', password: 'e2e-bypass', label: 'Instructor' },
  support: { username: 'test-support', password: 'e2e-bypass', label: 'Support Agent' },
};

export function resolveE2eAdminUser(roleId: E2eAdminRole) {
  try {
    const user = getTestAdministratorUser(roleId);
    const password =
      !user.password || user.password.startsWith('__SET_') ? 'e2e-bypass' : user.password;
    return { ...user, password };
  } catch {
    return E2E_BYPASS_USERS[roleId];
  }
}

export async function signInAs(page, roleId: E2eAdminRole, options: { cloudConsole?: boolean } = {}) {
  const user = resolveE2eAdminUser(roleId);
  const cloud = options.cloudConsole ? '&e2eCloudConsole=true' : '';
  await page.goto(`/?e2eAuthBypass=true${cloud}`);
  await page.getByTestId('login-username').fill(user.username);
  await page.getByTestId('login-password').fill(user.password);
  await page.getByLabel('Role').click();
  await page.getByRole('option', { name: user.label }).click();
  await page.getByTestId('login-submit').click();
}

export async function signInAsVenueAdmin(page) {
  await signInAs(page, 'venueAdmin');
}

export async function signInAsFleetAdmin(page) {
  await signInAs(page, 'fleetAdmin');
}

export async function signInAsCloudAdmin(page) {
  await signInAs(page, 'cloudAdmin');
}
