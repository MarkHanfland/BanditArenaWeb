import { expect, test } from '@playwright/test';
import { signInAsFleetAdmin } from '../helpers/auth';
import { mockCloudApi } from '../helpers/mockApis';
import { openMenuItem } from '../helpers/menuNav';

test('tenant emergency patch is not sent until fleet scope is confirmed', async ({ page }) => {
  await mockCloudApi(page);
  const posts: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/updates/emergency-patch')) {
      posts.push(request.postDataJSON());
    }
  });
  await signInAsFleetAdmin(page);
  await openMenuItem(page, 'device-fleet', 'menu-fleet');
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();

  await page.getByTestId('emergency-patch-fleet').click();
  await page.getByRole('combobox', { name: 'Scope' }).click();
  await page.getByRole('option', { name: 'Every device in the tenant' }).click();
  await page.getByTestId('emergency-patch-version').fill('1.2.2-hotfix');
  await page.getByTestId('emergency-patch-reason').fill('Critical runtime fix');
  await expect(page.getByTestId('emergency-patch-submit')).toBeDisabled();
  await expect(page.getByTestId('emergency-patch-fleet-gate')).toBeVisible();
  expect(posts).toEqual([]);

  await page.getByTestId('emergency-patch-fleet-confirm').check();
  await expect(page.getByTestId('emergency-patch-submit')).toBeEnabled();
  await page.getByTestId('emergency-patch-submit').click();
  await expect(page.getByText('Emergency patch queued (Every device in the tenant)')).toBeVisible();
  expect(posts).toEqual([
    {
      targetVersion: '1.2.2-hotfix',
      reason: 'Critical runtime fix',
      fleetScopeConfirmed: true,
    },
  ]);
});

test('one-device emergency patch posts instanceId and does not ask for fleet confirmation', async ({
  page,
}) => {
  await mockCloudApi(page);
  const posts: Array<Record<string, unknown>> = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/updates/emergency-patch')) {
      posts.push(request.postDataJSON());
    }
  });
  await signInAsFleetAdmin(page);
  await openMenuItem(page, 'device-fleet', 'menu-fleet');
  await page.getByTestId('fleet-view-list').click();
  await page.getByTestId('emergency-patch-fleet').click();
  await page.getByTestId('emergency-patch-version').fill('1.2.2-hotfix');
  await page.getByTestId('emergency-patch-reason').fill('Single device hotfix');
  await expect(page.getByTestId('emergency-patch-fleet-confirm')).toHaveCount(0);
  await page.getByTestId('emergency-patch-submit').click();
  await expect(page.getByText('Emergency patch queued (This device)')).toBeVisible();
  expect(posts[0]?.fleetScopeConfirmed).toBeUndefined();
  expect(posts[0]?.instanceId).toBeTruthy();
  expect(posts[0]?.targetVersion).toBe('1.2.2-hotfix');
});

test('provision sends the commissioning record with the golden image', async ({ page }) => {
  await mockCloudApi(page);
  const posts: Array<Record<string, unknown>> = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/devices/provision')) {
      posts.push(request.postDataJSON());
    }
  });
  await signInAsFleetAdmin(page);
  await openMenuItem(page, 'device-fleet', 'menu-fleet');
  await page.getByTestId('register-device').click();
  await page.getByTestId('register-compute-serial').fill('BA-COMPUTE-E2E-COMM');
  await page.getByTestId('register-golden-image').fill('');
  await expect(page.getByTestId('register-device-submit')).toBeDisabled();
  await page.getByTestId('register-golden-image').fill('golden-alpha-e2e');
  await page.getByTestId('register-device-submit').click();
  await expect(page.getByText(/Provisioned instance-new \(SN BA-COMPUTE-E2E-COMM\)/)).toBeVisible();
  const commissioning = posts[0]?.commissioning as Record<string, string>;
  expect(commissioning.goldenImageId).toBe('golden-alpha-e2e');
  expect(commissioning.serialBind).toBe('pass');
  expect(commissioning.selfTest).toBe('pass');
  expect(commissioning.windowsVersion).toBeTruthy();
  expect(commissioning.banditArenaVersion).toBeTruthy();
});
