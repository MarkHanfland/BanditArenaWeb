import { expect, test } from '@playwright/test';
import { getTestAdministratorUser } from '../helpers/testCredentials';

const demoTenant = {
  tenantId: 'tenant-demo-001',
  name: 'Bandit Demo Venue Group',
  venueId: 'venue-demo-001',
  venueName: 'Bandit Arena Lab',
};

const demoUsers = {
  users: [
    {
      userId: 'user-demo-001',
      name: 'Alex Runner',
      email: 'alex.runner@example.com',
      enrollmentState: 'active',
      safetyProfile: { heightCm: 178, weightKg: 72, strideCm: 75 },
    },
  ],
  tenant: demoTenant,
};

async function signInAsVenueAdmin(page) {
  const admin = getTestAdministratorUser('venueAdmin');
  await page.goto('/?e2eAuthBypass=true');
  await page.getByTestId('login-username').fill(admin.username);
  await page.getByTestId('login-password').fill(admin.password);
  await page.getByLabel('Role').click();
  await page.getByRole('option', { name: admin.label }).click();
  await page.getByTestId('login-submit').click();
}

async function mockCloudApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '') || '/';

    const json = (body: object, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/tenants/me') {
      return json({ tenant: demoTenant, message: 'Current tenant context' });
    }
    if (path === '/users' && route.request().method() === 'GET') {
      return json({ ...demoUsers, message: 'List of users' });
    }
    if (path === '/users' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      return json({
        user: { userId: 'user-new', name: body.name, email: body.email, enrollmentState: 'pending' },
        message: 'User created',
      }, 201);
    }
    if (path === '/analytics/summary') {
      return json({
        sessionsCompleted: 5,
        activeDevices: 1,
        enrolledUsers: 1,
        weeklySessionTrend: [1, 2, 3],
        alerts: [],
      });
    }
    if (path === '/media' && route.request().method() === 'GET') {
      return json({ media: [{ mediaId: 'm1', name: 'Alpine Trail', description: 'Demo', cover: 'https://placehold.co/200x120', pricePerMinute: 0.1, version: 1 }] });
    }
    if (path === '/product-instances' && route.request().method() === 'GET') {
      return json({ instances: [{ instanceId: 'i1', status: 'online', firmwareVersion: '1.0', updateAvailable: false }] });
    }
    if (path.startsWith('/updates/check')) {
      return json({ updateAvailable: true, latestVersion: '1.1', currentVersion: '1.0' });
    }
    if (path === '/reservations') {
      return json({ reservations: [{ slotId: 'slot-001', startTime: '2026-06-10T14:00:00.000Z', status: 'available' }] });
    }
    if (path === '/entitlements/check') {
      return json({ allowed: true, reason: 'active_enrollment' });
    }
    if (path === '/sessions' && route.request().method() === 'POST') {
      return json({ session: { sessionId: 'session-new', status: 'active' }, message: 'Session created' }, 201);
    }
    if (path === '/notifications/send') {
      return json({ notificationId: 'n1', status: 'sent' }, 202);
    }

    return json({ message: 'stub' });
  });
}

test('enrollment happy path: list users and add user', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-users').click();
  await expect(page.getByText('Alex Runner')).toBeVisible();
  await page.getByTestId('add-user').click();
  await page.getByLabel('Name').fill('New Demo User');
  await page.getByLabel('Email').fill('new.demo@example.com');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Created New Demo User')).toBeVisible();
});

test('analytics page shows summary cards', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-usage').click();
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('Sessions (7d)')).toBeVisible();
  await expect(page.getByText('5')).toBeVisible();
});
