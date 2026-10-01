import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createFallStage,
  createStopDwell,
  evaluateCloudStart,
  evaluateEligibility,
  evaluateOfflinePin,
  fallProbability,
  attemptOfflineSignIn,
  createOfflineCredential,
  evaluateCloudLoss,
  evaluateResume,
  evaluateTreadExit,
  offlineActionAllowed,
  pinDigest,
  rejectReservedPose,
  stopPoseHeld,
} from './sessionStartGate.js'

const adult = {
  heightM: 1.78,
  weightKg: 72,
  dateOfBirth: '1990-01-01',
  guardianAuthorized: false,
}

test('eligibility refuses each Core limit and a missing profile field', () => {
  assert.equal(evaluateEligibility(adult).allow, true)
  assert.equal(evaluateEligibility({ ...adult, heightM: 1.2 }).limit, 'height')
  assert.equal(evaluateEligibility({ ...adult, heightM: 2.1 }).limit, 'height')
  assert.equal(evaluateEligibility({ ...adult, weightKg: 160 }).limit, 'weight')
  assert.equal(evaluateEligibility({ ...adult, dateOfBirth: '2020-01-01' }).limit, 'age')
  assert.equal(evaluateEligibility({ ...adult, dateOfBirth: null }).limit, 'profile')
  const teen = evaluateEligibility({ ...adult, dateOfBirth: '2012-01-01', guardianAuthorized: false })
  assert.equal(teen.limit, 'guardian')
  assert.equal(evaluateEligibility({ ...adult, dateOfBirth: '2012-01-01', guardianAuthorized: true }).allow, true)
})

test('measured height can refuse a profile that would otherwise pass', () => {
  assert.equal(evaluateEligibility({ ...adult, measuredHeightM: 1.2 }).limit, 'measuredHeight')
  assert.equal(evaluateEligibility({ ...adult, measuredHeightM: 1.95 }).limit, 'heightConfirm')
  assert.equal(evaluateEligibility({ ...adult, measuredHeightM: 1.8 }).allow, true)
})

test('a cached allow does not start a session when the cloud is down', () => {
  const down = evaluateCloudStart({ cloudReachable: false, eligibility: evaluateEligibility(adult) })
  assert.equal(down.allow, false)
  assert.equal(down.status, 503)
  assert.equal(down.code, 'CLOUD_UNAVAILABLE')
  const up = evaluateCloudStart({ cloudReachable: true, eligibility: evaluateEligibility(adult) })
  assert.equal(up.allow, true)
})

test('offline PIN allows local sign-in and never starts a session', () => {
  const now = 3_600_000
  assert.equal(evaluateOfflinePin({ signedInAtMs: 0, nowMs: now, startingSession: false }).allow, true)
  assert.equal(evaluateOfflinePin({ signedInAtMs: 0, nowMs: now + 1, startingSession: false }).code, 'PIN_EXPIRED')
  assert.equal(evaluateOfflinePin({ signedInAtMs: 0, nowMs: 1000, startingSession: true }).code, 'CLOUD_UNAVAILABLE')
})

test('stop pose is armed only while stationary and only after the dwell', () => {
  const held = { headY: 1.6, leftWristY: 1.9, rightWristY: 1.9, leftWristX: 0.2, rightWristX: -0.2, bodyCenterX: 0 }
  assert.equal(stopPoseHeld(held), true)
  assert.equal(stopPoseHeld({ ...held, leftWristY: 1.2 }), false)
  const dwell = createStopDwell(1500)
  assert.equal(dwell(true, false, 0), false)
  assert.equal(dwell(true, true, 0), false)
  assert.equal(dwell(true, true, 1499), false)
  assert.equal(dwell(true, true, 1500), true)
})

test('stumble does not become a fall, and a fast fall skips stumble', () => {
  const upright = fallProbability({
    headHeightM: 1.7, hipHeightM: 0.9, baselineHeadM: 1.7, baselineHipM: 0.9,
    headVelocityMps: 0, headAccelMps2: 0, trunkInclinationRad: 0, comBeyondBaseM: 0, calibrated: true,
  })
  assert.ok(upright.pFall < 0.4)
  const dropping = fallProbability({
    headHeightM: 0.4, hipHeightM: 0.2, baselineHeadM: 1.7, baselineHipM: 0.9,
    headVelocityMps: -3, headAccelMps2: -10, trunkInclinationRad: 1.4, comBeyondBaseM: 0.5, calibrated: false,
  })
  assert.ok(dropping.pFall >= 0.8)
  assert.equal(dropping.reducedConfidence, true)
  const stumble = createFallStage()
  assert.equal(stumble(0.5), 'NONE')
  assert.equal(stumble(0.5), 'STUMBLE')
  const fall = createFallStage()
  assert.equal(fall(0.9), 'NONE')
  assert.equal(fall(0.9), 'FALL')
})

test('restart ends when the cloud is down and tread exit ends a pending restart', () => {
  assert.equal(evaluateResume({ trackingOk: true, upright: true, inDeadZone: true, confirmed: true, cloudReachable: false }).action, 'end')
  assert.equal(evaluateResume({ trackingOk: true, upright: true, inDeadZone: true, confirmed: true, cloudReachable: true }).action, 'resume')
  assert.equal(evaluateResume({ stopSource: 'safety', cloudReachable: true, trackingOk: true, upright: true, inDeadZone: true, confirmed: true }).code, 'SAFETY_STOP')
  assert.equal(evaluateTreadExit({ pendingRestart: true, absentMs: 3000 }).code, 'TREAD_EXIT')
  assert.equal(evaluateTreadExit({ pendingRestart: false, absentMs: 9000 }).end, false)
  assert.equal(evaluateCloudLoss({ sessionActive: true, lastContactMs: 0, nowMs: 60 * 60 * 1000 }).end, true)
  assert.equal(evaluateCloudLoss({ sessionActive: true, lastContactMs: 0, nowMs: 1000 }).end, false)
})

test('offline PIN locks after five failures and never starts a session', () => {
  const created = createOfflineCredential({ pin: '123456', salt: 'abc', lastContactMs: 0 })
  assert.equal(created.ok, true)
  assert.notEqual(created.credential.verifier, '123456')
  assert.equal(pinDigest('abc', '123456'), created.credential.verifier)
  let credential = created.credential
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rejected = attemptOfflineSignIn({ credential, pin: '000000', nowMs: 1000 })
    assert.equal(rejected.code, 'PIN_REJECTED')
    credential = rejected.credential
  }
  const locked = attemptOfflineSignIn({ credential, pin: '000000', nowMs: 1000 })
  assert.equal(locked.code, 'PIN_LOCKED')
  const accepted = attemptOfflineSignIn({ credential: created.credential, pin: '123456', nowMs: 1000 })
  assert.equal(accepted.allow, true)
  assert.equal(offlineActionAllowed('session-start').code, 'CLOUD_UNAVAILABLE')
  assert.equal(offlineActionAllowed('config-write').code, 'ONLINE_SIGN_IN_REQUIRED')
  assert.equal(rejectReservedPose('bandit/safety/stop'), true)
  assert.equal(rejectReservedPose('jump'), false)
})
