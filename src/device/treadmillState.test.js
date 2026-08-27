import test from 'node:test'
import assert from 'node:assert/strict'
import { treadmillStateInfo, treadmillStatusForSession } from './treadmillState.js'

test('treadmillStateInfo maps standby and unknown', () => {
  assert.equal(treadmillStateInfo(5).label, 'Standby')
  assert.equal(treadmillStateInfo(null).label, 'Unknown')
})

test('without a Player session, missing or standby state shows Offline', () => {
  assert.equal(treadmillStatusForSession(null, { sessionActive: false }).label, 'Offline')
  assert.equal(treadmillStatusForSession(5, { sessionActive: false }).label, 'Offline')
  assert.equal(treadmillStatusForSession(2, { sessionActive: true }).label, 'Operating')
})
