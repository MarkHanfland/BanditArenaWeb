import test from 'node:test'
import assert from 'node:assert/strict'
import { PATCH_SCOPE, planEmergencyPatch } from './emergencyPatch.js'

test('device and venue patches send without a second confirmation', () => {
  const device = planEmergencyPatch({
    scope: PATCH_SCOPE.DEVICE,
    instanceId: 'dev-1',
    targetVersion: '1.2.2',
    reason: 'hotfix',
  })
  assert.equal(device.send, true)
  assert.equal(device.route, '/updates/emergency-patch')
  assert.deepEqual(device.payload, {
    instanceId: 'dev-1',
    targetVersion: '1.2.2',
    reason: 'hotfix',
  })

  const venue = planEmergencyPatch({
    scope: PATCH_SCOPE.VENUE,
    venueId: 'venue-1',
    targetVersion: '1.2.2',
    reason: 'hotfix',
  })
  assert.equal(venue.send, true)
  assert.equal(venue.payload.venueId, 'venue-1')
  assert.equal(venue.payload.fleetScopeConfirmed, undefined)
})

test('tenant-wide patch is not sent until fleet scope is confirmed', () => {
  const blocked = planEmergencyPatch({
    scope: PATCH_SCOPE.TENANT,
    targetVersion: '1.2.2',
    reason: 'hotfix',
  })
  assert.equal(blocked.send, false)
  assert.equal(blocked.status, 400)
  assert.equal(blocked.payload, undefined)

  const sent = planEmergencyPatch({
    scope: PATCH_SCOPE.TENANT,
    targetVersion: '1.2.2',
    reason: 'hotfix',
    fleetScopeConfirmed: true,
  })
  assert.equal(sent.send, true)
  assert.equal(sent.route, '/admin/firmware-push')
  assert.equal(sent.payload.fleetScopeConfirmed, true)
  assert.equal(sent.payload.venueId, undefined)
  assert.equal(sent.payload.instanceId, undefined)
})

test('missing version or reason never sends', () => {
  assert.equal(
    planEmergencyPatch({ scope: PATCH_SCOPE.DEVICE, instanceId: 'dev-1', reason: 'hotfix' }).send,
    false,
  )
  assert.equal(
    planEmergencyPatch({
      scope: PATCH_SCOPE.TENANT,
      targetVersion: '1.2.2',
      fleetScopeConfirmed: true,
    }).send,
    false,
  )
})
