import test from 'node:test'
import assert from 'node:assert/strict'
import { bindCodeMessage, digitsOf, formatBindCode, remainingSeconds } from './bindCode.js'

test('FR-SW-UI-015: a 6-digit code is grouped for the Operator to read aloud', () => {
  assert.equal(formatBindCode('123456'), '123 456')
  assert.equal(formatBindCode('12 34 56'), '123 456')
  assert.equal(formatBindCode('12'), '12')
  assert.equal(formatBindCode(''), '')
  assert.equal(digitsOf('12a34b56'), '123456')
})

test('FR-SW-UI-015: remaining time is never negative and treats a bad expiry as zero', () => {
  const now = Date.parse('2026-11-07T20:00:00.000Z')
  assert.equal(remainingSeconds('2026-11-07T20:02:00.000Z', now), 120)
  assert.equal(remainingSeconds('2026-11-07T20:00:00.500Z', now), 1)
  assert.equal(remainingSeconds('2026-11-07T19:59:00.000Z', now), 0)
  assert.equal(remainingSeconds('not-a-date', now), 0)
  assert.equal(remainingSeconds('', now), 0)
})

test('FR-SW-UI-015: a missing cloud or missing local route explains the next step', () => {
  assert.equal(
    bindCodeMessage({ error: 'cloud unavailable', code: 'CLOUD_UNAVAILABLE', status: 503 }),
    'The cloud is unreachable. Scan the Player\'s pass at the desk instead.',
  )
  assert.equal(
    bindCodeMessage({ error: 'Not Found', status: 404 }),
    'This treadmill software does not yet show a bind code.',
  )
  assert.equal(bindCodeMessage({ error: 'Device certificate required' }), 'Device certificate required')
  assert.equal(bindCodeMessage({ data: { code: '123456' } }), '')
})
