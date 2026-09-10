import { expect, test } from '@playwright/test';
import { signInAsCloudAdmin, signInAsFleetAdmin, signInAsVenueAdmin } from '../helpers/auth';
import { createCloudFixture, mockCloudApi } from '../helpers/mockApis';
import { expandMenuGroup, openMenuItem } from '../helpers/menuNav';

function opsFixture() {
  const fixture = createCloudFixture();
  fixture.opsLogs = [
    {
      logId: 'log-e2e-001',
      timestamp: '2026-09-08T18:00:00.000Z',
      severity: 'ERROR',
      code: 'INTERNAL',
      route: 'GET /media',
      message: 'INTERNAL: boom',
      operatorId: 'operator-demo-001',
    },
    {
      logId: 'log-e2e-002',
      timestamp: '2026-09-08T18:05:00.000Z',
      severity: 'ERROR',
      code: 'INTERNAL_OTHER',
      route: 'GET /licenses',
      message: 'INTERNAL_OTHER: other boom',
      operatorId: 'operator-other-001',
    },
  ];
  fixture.opsIncidents = [
    {
      incidentId: 'inc-e2e-001',
      status: 'open',
      severity: 'ERROR',
      code: 'INTERNAL',
      route: 'GET /media',
      count: 2,
      lastAt: '2026-09-08T18:00:00.000Z',
      operatorId: 'operator-demo-001',
    },
  ];
  fixture.operators = [
    { operatorId: 'operator-demo-001', name: 'Bandit Demo Operator' },
    { operatorId: 'operator-other-001', name: 'Other Operator' },
  ];
  return fixture;
}

test('SW-093: fleet admin views service logs and acknowledges an incident', async ({ page }) => {
  const fixture = opsFixture();
  await mockCloudApi(page, fixture);
  await signInAsFleetAdmin(page);

  const logsRequest = page.waitForRequest(
    (request) => request.method() === 'GET' && new URL(request.url()).pathname.endsWith('/ops/logs'),
  );
  const incidentsRequest = page.waitForRequest(
    (request) =>
      request.method() === 'GET' && new URL(request.url()).pathname.endsWith('/ops/incidents'),
  );

  await openMenuItem(page, 'administration', 'menu-service-logs');
  await logsRequest;
  await incidentsRequest;

  await expect(page.getByTestId('service-logs-page')).toBeVisible();
  await expect(page.getByTestId('service-logs-table')).toContainText('INTERNAL');
  await expect(page.getByTestId('service-incidents-table')).toContainText('GET /media');

  const ackRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname.endsWith('/ops/incidents/inc-e2e-001/ack'),
  );
  await page.getByTestId('service-incident-ack-inc-e2e-001').click();
  await ackRequest;
  await expect(page.getByText(/Incident acknowledged/i)).toBeVisible();
  expect(fixture.opsIncidents.find((item) => item.incidentId === 'inc-e2e-001')?.status).toBe(
    'acknowledged',
  );
});

test('SW-093: cloud admin can filter service logs across operators', async ({ page }) => {
  const fixture = opsFixture();
  await mockCloudApi(page, fixture);
  await signInAsCloudAdmin(page);

  await openMenuItem(page, 'administration', 'menu-service-logs');
  await expect(page.getByTestId('service-logs-page')).toBeVisible();
  await expect(page.getByTestId('service-logs-operator')).toBeVisible();
  await expect(page.getByTestId('service-logs-table')).toContainText('INTERNAL_OTHER');
  await expect(page.getByTestId('service-logs-table')).toContainText('operator-other-001');

  await page.getByTestId('service-logs-operator').click();
  await page.getByRole('option', { name: 'Other Operator' }).click();
  await expect(page.getByTestId('service-logs-table')).toContainText('INTERNAL_OTHER');
  await expect(page.getByTestId('service-logs-table')).not.toContainText('INTERNAL: boom');
});

test('SW-093: venue admin cannot open service logs', async ({ page }) => {
  await mockCloudApi(page);
  await signInAsVenueAdmin(page);
  await expandMenuGroup(page, 'administration');
  await expect(page.getByTestId('menu-service-logs')).toHaveCount(0);
});
