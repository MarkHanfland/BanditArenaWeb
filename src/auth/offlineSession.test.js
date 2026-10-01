import test from 'node:test'
import assert from 'node:assert/strict'
import { offlineSessionFromResponse } from './offlineSession.js'

test('AUTH-015: a device token opens a session with the cached local role and expiry', () => {
  const now = 1_000_000
  const s = offlineSessionFromResponse('op-1', { token: 'offline.ab12', role: 'venue-admin', expiresAt: 4600 }, now)
  assert.equal(s.token, 'offline.ab12')
  assert.deepEqual(s.user.groups, ['bandit-venue-admin'])
  assert.equal(s.user.offline, true)
  assert.equal(s.expiresAtMs, 4_600_000)
})

test('AUTH-015: an expired or foreign token is refused', () => {
  const now = 10_000_000
  assert.equal(offlineSessionFromResponse('op-1', { token: 'offline.ab', expiresAt: 5 }, now), null)
  assert.equal(offlineSessionFromResponse('op-1', { token: 'eyJhbGciOi.jwt' }, now), null)
  assert.equal(offlineSessionFromResponse('op-1', {}, now), null)
})
