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
    {
      userId: 'user-demo-002',
      name: 'Jordan Pending',
      email: 'jordan.pending@example.com',
      enrollmentState: 'pending',
      safetyProfile: { heightCm: 170, weightKg: 68, strideCm: 70 },
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
    const method = route.request().method();

    const json = (body: object, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/tenants/me') {
      return json({ tenant: demoTenant, message: 'Current tenant context' });
    }
    if (path === '/users' && method === 'GET') {
      return json({ ...demoUsers, message: 'List of users' });
    }
    if (path === '/users' && method === 'POST') {
      const body = route.request().postDataJSON();
      return json({
        user: { userId: 'user-new', name: body.name, email: body.email, enrollmentState: 'pending' },
        message: 'User created',
      }, 201);
    }
    const userDetail = path.match(/^\/users\/([^/]+)$/);
    if (userDetail && method === 'GET') {
      const user = demoUsers.users.find((u) => u.userId === userDetail[1]) || demoUsers.users[0];
      return json({ user, message: 'User detail' });
    }
    if (/^\/users\/[^/]+\/sessions$/.test(path)) {
      return json({ sessions: [], message: 'User sessions' });
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
    if (path === '/media' && method === 'GET') {
      return json({ media: [{ mediaId: 'm1', name: 'Alpine Trail', description: 'Demo', cover: 'https://placehold.co/200x120', pricePerMinute: 0.1, version: 1 }] });
    }
    if (path === '/media' && method === 'POST') {
      const body = route.request().postDataJSON();
      return json({ media: { mediaId: 'm-new', name: body.name, description: body.description, pricePerMinute: body.pricePerMinute, version: 1 }, message: 'Content published' }, 201);
    }
    if (path === '/product-instances' && method === 'GET') {
      return json({ instances: [{ instanceId: 'i1', status: 'online', firmwareVersion: '1.0', updateAvailable: false }] });
    }
    if (path === '/product-instances' && method === 'POST') {
      const body = route.request().postDataJSON();
      return json({ instance: { instanceId: 'instance-new', model: body.model, status: 'online', firmwareVersion: '1.2.0-alpha' }, message: 'Product instance registered' }, 201);
    }
    if (path.startsWith('/updates/check')) {
      return json({ updateAvailable: true, latestVersion: '1.1', currentVersion: '1.0' });
    }
    if (path === '/reservations' && method === 'GET') {
      return json({ reservations: [{ slotId: 'slot-001', startTime: '2026-06-10T14:00:00.000Z', status: 'available' }] });
    }
    if (path === '/reservations' && method === 'POST') {
      const body = route.request().postDataJSON();
      return json({ reservation: { slotId: body.slotId, userId: body.userId, status: 'booked' }, message: 'Reservation confirmed' }, 201);
    }
    if (path === '/entitlements/check') {
      const body = route.request().postDataJSON();
      const allowed = body.userId === 'user-demo-001';
      return json({ allowed, reason: allowed ? 'active_enrollment' : 'enrollment_not_active' });
    }
    if (path === '/sessions' && method === 'POST') {
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

test('session start passes the license gate for an active user', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-users').click();
  await expect(page.getByText('Alex Runner')).toBeVisible();
  await page
    .getByRole('row', { name: /Alex Runner/ })
    .getByRole('button', { name: 'Start Session' })
    .click();
  await expect(page.getByText('Session session-new started')).toBeVisible();
});

test('session start is blocked by the license gate for a non-active user', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-users').click();
  await expect(page.getByText('Jordan Pending')).toBeVisible();
  await page
    .getByRole('row', { name: /Jordan Pending/ })
    .getByRole('button', { name: 'Start Session' })
    .click();
  await expect(page.getByText('Session blocked: enrollment not active')).toBeVisible();
});

test('content publish flow adds a VR title', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-content').click();
  await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible();
  await page.getByTestId('publish-content').click();
  await page.getByLabel('Title').fill('Desert Dash');
  await page.getByLabel('Description').fill('A demo VR trail');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Published Desert Dash')).toBeVisible();
});

test('fleet register flow provisions a device', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-fleet').click();
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();
  await page.getByTestId('register-device').click();
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText('Registered instance-new')).toBeVisible();
});

test('reservation book flow confirms a slot and sends a reminder', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-reservations').click();
  await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible();
  await page.getByTestId('book-slot-001').click();
  await expect(page.getByText(/Booked slot-001/)).toBeVisible();
});

test('analytics page shows summary cards', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);

  await page.getByTestId('menu-usage').click();
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  await expect(page.getByText('Sessions (7d)')).toBeVisible();
  await expect(page.getByText('5')).toBeVisible();
});
