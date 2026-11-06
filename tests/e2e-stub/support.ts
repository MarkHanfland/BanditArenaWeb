import { expect } from '@playwright/test';

export const STUB = 'http://127.0.0.1:3912';
const CONSOLE = 'http://127.0.0.1:4179';

// Ids from the canonical dataset (testData/fullDataset.js in BanditArenaCloud).
export const DATA = {
  chicago: 'venue-test-a1',
  full: 'dev-a1-full',
  basic: 'dev-a1-basic',
  adultUser: 'user-adult',
  adultPlayer: 'player-adult',
  bookedSlot: 'slot-booked', // the adult on the full treadmill, 2099-09-02 15:00 UTC (10:00 in Chicago)
  trail: 'media-trail',
};

const STAFF = { sub: 'sub-staff', 'cognito:groups': ['bandit-cloud-admin'], 'custom:operatorId': 'operator-tenant-a' };

/** Put the dataset back as it was at start-up. */
export async function resetData() {
  const res = await fetch(`${STUB}/__stub/reset`, { method: 'POST' });
  expect(res.status, 'the stub reset').toBe(200);
}

/** A direct call to the cloud as staff, for setting up and for checking what the console stored. */
export async function staffCall(path: string, body?: unknown, method = 'GET') {
  const res = await fetch(`${STUB}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-stub-claims': JSON.stringify(STAFF) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}

/** A direct call as a signed-in Player, to see what a Player sees after staff act. */
export async function playerCall(playerId: string, path: string) {
  const res = await fetch(`${STUB}/api${path}`, {
    headers: { 'x-stub-claims': JSON.stringify({ sub: playerId, 'custom:realm': 'player' }) },
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}

/** Send the console's cloud calls to the stub, as the staff identity a Cognito token would carry. */
export async function forwardCloud(page, venueId = DATA.chicago) {
  // The console remembers the venue a login last used. Start at the venue the dataset's treadmills are in.
  await page.addInitScript((id) => {
    window.localStorage.setItem('bandit.venue.test-venue-admin', id);
  }, venueId);
  await page.route((url) => url.origin === CONSOLE && url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-stub-claims': JSON.stringify(STAFF),
    };
    const tenant = request.headers()['x-bandit-tenant'];
    if (tenant) headers['x-bandit-tenant'] = tenant;
    const hasBody = !['GET', 'HEAD'].includes(request.method());
    const upstream = await fetch(`${STUB}${url.pathname}${url.search}`, {
      method: request.method(),
      headers,
      body: hasBody ? request.postData() ?? undefined : undefined,
    });
    await route.fulfill({
      status: upstream.status,
      contentType: 'application/json',
      body: await upstream.text(),
    });
  });
}
