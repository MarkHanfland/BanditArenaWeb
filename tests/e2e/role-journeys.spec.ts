import { expect, test } from '@playwright/test';
import { signInAs } from '../helpers/auth';
import { mockConsoleApis } from '../helpers/mockApis';
import { expandAllMenuGroups, expandMenuGroup } from '../helpers/menuNav';

// Role-journey acceptance (PM review, FR-SW-UI-014 / FR-SW-UI-017 / FR-SW-UI-018).
// Each role lands on the screen its job needs, and sees only the chrome it can use.

test.describe('device chrome is limited to roles that hold a Local Device menu', () => {
  for (const roleId of ['frontDesk', 'accountOwner', 'billingAdmin'] as const) {
    test(`${roleId} sees no device status band and no Safety Stop`, async ({ page }) => {
      await mockConsoleApis(page);
      await signInAs(page, roleId);
      await expect(page.getByTestId('sign-out')).toBeVisible();
      await expect(page.getByTestId('device-status-band')).toHaveCount(0);
      await expect(page.getByTestId('header-player-select')).toHaveCount(0);
      await expect(page.getByTestId('header-session-start')).toHaveCount(0);
      await expect(page.getByTestId('safety-control')).toHaveCount(0);
    });
  }

  for (const roleId of ['operator', 'venueAdmin'] as const) {
    test(`${roleId} keeps the device status band and Safety Stop`, async ({ page }) => {
      await mockConsoleApis(page);
      await signInAs(page, roleId);
      await expect(page.getByTestId('device-status-bar')).toBeVisible();
      await expect(page.getByTestId('safety-control')).toBeVisible();
    });
  }
});

test.describe('safety stop is unmistakable', () => {
  test('a stopped belt shows a full-width banner and a red treadmill state', async ({ page }) => {
    await mockConsoleApis(page, undefined, { treadmillState: 3 });
    await signInAs(page, 'operator');
    const banner = page.getByTestId('safety-stop-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('SAFETY STOP');
    await expect(page.getByTestId('dashboard-treadmill-state')).toHaveCSS('color', 'rgb(255, 82, 82)');
  });

  test('no banner while the belt is operating', async ({ page }) => {
    await mockConsoleApis(page, undefined, { treadmillState: 2 });
    await signInAs(page, 'operator');
    await expect(page.getByTestId('device-status-bar')).toBeVisible();
    await expect(page.getByTestId('safety-stop-banner')).toHaveCount(0);
  });

  test('Safety Stop stays on one line and visible at tablet width', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await mockConsoleApis(page, undefined, { treadmillState: 2 });
    await signInAs(page, 'venueAdmin');
    const stop = page.getByTestId('safety-control');
    await expect(stop).toBeVisible();
    const box = await stop.boundingBox();
    expect(box, 'Safety Stop has a layout box').not.toBeNull();
    // One line of text: a wrapped label would roughly double the height.
    expect(box!.height).toBeLessThan(40);
    const viewport = page.viewportSize()!;
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  });
});

test.describe('customer billing roles land on their own invoices', () => {
  for (const roleId of ['accountOwner', 'billingAdmin'] as const) {
    test(`${roleId} opens Payments & Billing on Invoices, not Bandit's price list`, async ({ page }) => {
      await mockConsoleApis(page);
      await page.route('**/billing/invoices', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invoices: [{
            invoiceId: 'inv-e2e-001',
            createdAt: new Date().toISOString(),
            totalUsd: 1250,
            status: 'issued',
            downloadUrl: 'https://billing.local/invoices/inv-e2e-001.pdf',
          }],
        }),
      }));
      await signInAs(page, roleId);
      await expandMenuGroup(page, 'business');
      await page.getByTestId('menu-billing').click();
      await expect(page.getByRole('heading', { name: 'Payments & Billing' })).toBeVisible();
      await expect(page.getByTestId('commerce-tab-invoices')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('billing-invoices-table')).toContainText('inv-e2e-001');
      await expect(page.getByTestId('commerce-tab-models')).toHaveCount(0);
    });
  }

  test('cloud admin still sees the internal Commerce page', async ({ page }) => {
    await mockConsoleApis(page);
    await signInAs(page, 'cloudAdmin');
    await expandMenuGroup(page, 'business');
    await page.getByTestId('menu-billing').click();
    await expect(page.getByRole('heading', { name: 'Commerce' })).toBeVisible();
    await expect(page.getByTestId('commerce-tab-invoices')).toHaveCount(0);
  });
});

// FR-SW-UI-018 role journeys: given this role, when it signs in, it lands on this page, sees these
// controls, and does not see those.
const JOURNEYS = [
  { role: 'frontDesk', lands: 'menu-reservations', heading: 'Reservations', sees: ['menu-reservations', 'menu-users'], hidden: ['menu-venue-hours', 'menu-staff', 'menu-billing', 'menu-fleet', 'menu-dashboard'] },
  { role: 'accountOwner', lands: 'menu-reservations', heading: 'Reservations', sees: ['menu-reservations', 'menu-venue-hours', 'menu-staff', 'menu-billing'], hidden: ['menu-fleet', 'menu-dashboard', 'menu-treadmill'] },
  { role: 'billingAdmin', lands: 'menu-billing', heading: 'Payments & Billing', sees: ['menu-billing'], hidden: ['menu-reservations', 'menu-fleet', 'menu-dashboard', 'menu-staff'] },
  { role: 'fleetAdmin', lands: 'menu-fleet', heading: 'Fleet', sees: ['menu-fleet', 'menu-dashboard'], hidden: ['menu-reservations', 'menu-staff'] },
  { role: 'venueAdmin', lands: 'menu-dashboard', heading: null, sees: ['menu-dashboard', 'menu-reservations', 'menu-venue-hours'], hidden: ['menu-billing', 'menu-fleet'] },
  { role: 'operator', lands: 'menu-dashboard', heading: null, sees: ['menu-dashboard', 'menu-treadmill'], hidden: ['menu-reservations', 'menu-billing', 'menu-fleet'] },
] as const;

test.describe('FR-SW-UI-018 each role lands on its own page', () => {
  for (const journey of JOURNEYS) {
    test(`FR-SW-UI-018: ${journey.role} lands on ${journey.lands}`, async ({ page }) => {
      await mockConsoleApis(page);
      await signInAs(page, journey.role);
      await expect(page.getByTestId('sign-out')).toBeVisible();
      await expandAllMenuGroups(page);
      await expect(page.getByTestId(journey.lands)).toHaveAttribute('aria-current', 'page');
      if (journey.heading) await expect(page.getByRole('heading', { name: journey.heading, exact: true })).toBeVisible();
      for (const id of journey.sees) await expect(page.getByTestId(id)).toBeVisible();
      for (const id of journey.hidden) await expect(page.getByTestId(id)).toHaveCount(0);
    });
  }
});
