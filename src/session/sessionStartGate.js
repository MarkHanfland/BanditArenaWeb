/** FR-SW-SAFE-007, SAFE-009, SAFE-010, CLOUD-004, AUTH-015. */

export const CORE_LIMITS = {
  minHeightM: 1.5,
  maxHeightM: 2.0,
  maxWeightKg: 150,
  minAge: 8,
}

export function ageYears(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) return null
  const born = new Date(dateOfBirth)
  if (Number.isNaN(born.getTime())) return null
  let age = now.getUTCFullYear() - born.getUTCFullYear()
  const month = now.getUTCMonth() - born.getUTCMonth()
  if (month < 0 || (month === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1
  return age
}

export function evaluateEligibility({
  heightM,
  weightKg,
  dateOfBirth,
  guardianAuthorized = false,
  measuredHeightM = null,
  limits = CORE_LIMITS,
  now = new Date(),
} = {}) {
  const age = ageYears(dateOfBirth, now)
  if (heightM == null || weightKg == null || age == null) {
    return { allow: false, status: 412, code: 'PLAYER_INELIGIBLE', limit: 'profile', message: 'Profile is missing height, weight, or date of birth' }
  }
  if (heightM < limits.minHeightM || heightM > limits.maxHeightM) {
    return { allow: false, status: 412, code: 'PLAYER_INELIGIBLE', limit: 'height', message: 'Height is outside this model' }
  }
  if (weightKg > limits.maxWeightKg) {
    return { allow: false, status: 412, code: 'PLAYER_INELIGIBLE', limit: 'weight', message: 'Weight is above this model' }
  }
  if (age < limits.minAge) {
    return { allow: false, status: 412, code: 'PLAYER_INELIGIBLE', limit: 'age', message: 'Player is under the minimum age' }
  }
  if (age < 18 && !guardianAuthorized) {
    return { allow: false, status: 412, code: 'PLAYER_INELIGIBLE', limit: 'guardian', message: 'A guardian authorization is required' }
  }
  if (measuredHeightM != null && (measuredHeightM < limits.minHeightM || measuredHeightM > limits.maxHeightM)) {
    return { allow: false, status: 412, code: 'PLAYER_INELIGIBLE', limit: 'measuredHeight', message: 'Measured height is outside this model' }
  }
  if (measuredHeightM != null && Math.abs(measuredHeightM - heightM) > 0.1) {
    return { allow: false, status: 412, code: 'PLAYER_INELIGIBLE', limit: 'heightConfirm', message: 'Confirm or correct the stored height before start' }
  }
  return { allow: true, status: 200, code: null, limit: null, message: '' }
}

export function evaluateCloudStart({ cloudReachable, eligibility }) {
  if (!cloudReachable) {
    return { allow: false, status: 503, code: 'CLOUD_UNAVAILABLE', message: 'cloud unavailable' }
  }
  return eligibility
}

export const HOUR_MS = 60 * 60 * 1000
export const TREAD_EXIT_MS = 3000

export function evaluateOfflinePin({ signedInAtMs, nowMs, startingSession }) {
  const ageMs = nowMs - signedInAtMs
  const valid = ageMs >= 0 && ageMs <= HOUR_MS
  if (!valid) return { allow: false, code: 'PIN_EXPIRED', message: 'Offline sign-in has expired' }
  if (startingSession) return { allow: false, code: 'CLOUD_UNAVAILABLE', message: 'cloud unavailable' }
  return { allow: true, code: null, message: '' }
}

/** FNV-1a of salt:pin. The PIN is never stored. Matches the device verifier. */
export function pinDigest(salt, pin) {
  let hash = 2166136261
  const text = `${salt}:${pin}`
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function createOfflineCredential({ pin, salt, roles = ['bandit-operator'], lastContactMs }) {
  if (!/^\d{6,}$/.test(String(pin || ''))) {
    return { ok: false, code: 'PIN_TOO_SHORT', message: 'PIN must be at least 6 digits' }
  }
  return {
    ok: true,
    credential: {
      salt,
      verifier: pinDigest(salt, pin),
      roles,
      lastContactMs,
      failures: 0,
      locked: false,
      disabled: false,
      denied: false,
    },
  }
}

export function attemptOfflineSignIn({ credential, pin, nowMs, limitMs = HOUR_MS }) {
  if (!credential || credential.disabled || credential.denied) {
    return { allow: false, code: 'PIN_DENIED', message: 'Offline sign-in is not allowed', credential }
  }
  if (credential.locked) {
    return { allow: false, code: 'PIN_LOCKED', message: 'Offline sign-in is locked', credential }
  }
  if (nowMs - credential.lastContactMs > limitMs) {
    return { allow: false, code: 'PIN_EXPIRED', message: 'Offline sign-in has expired', credential }
  }
  if (pinDigest(credential.salt, pin) !== credential.verifier) {
    const failures = (credential.failures || 0) + 1
    const locked = failures >= 5
    const next = { ...credential, failures, locked }
    return {
      allow: false,
      code: locked ? 'PIN_LOCKED' : 'PIN_REJECTED',
      message: locked ? 'Offline sign-in is locked' : 'PIN was not accepted',
      credential: next,
    }
  }
  return {
    allow: true,
    code: null,
    message: '',
    roles: credential.roles || [],
    expiresAtMs: credential.lastContactMs + limitMs,
    credential: { ...credential, failures: 0 },
  }
}

export function offlineActionAllowed(action) {
  if (action === 'session-start') {
    return { allow: false, code: 'CLOUD_UNAVAILABLE', message: 'cloud unavailable' }
  }
  if (action === 'config-write' || action === 'service-start' || action === 'service-stop' || action === 'shutdown') {
    return { allow: false, code: 'ONLINE_SIGN_IN_REQUIRED', message: 'Online sign-in is required' }
  }
  return { allow: true, code: null, message: '' }
}

export function evaluateResume({
  trackingOk = false,
  upright = false,
  inDeadZone = false,
  confirmed = false,
  cloudReachable = false,
  stopSource = 'player_pose',
} = {}) {
  if (stopSource === 'safety') {
    return { action: 'hold', code: 'SAFETY_STOP', message: 'An authorized start is required' }
  }
  if (!cloudReachable) {
    return { action: 'end', code: 'CLOUD_UNAVAILABLE', message: 'cloud unavailable' }
  }
  if (trackingOk && upright && inDeadZone && confirmed) {
    return { action: 'resume', code: null, message: '' }
  }
  return { action: 'hold', code: 'PENDING_RESTART', message: 'Restart is not confirmed' }
}

export function evaluateTreadExit({ pendingRestart, absentMs, timeoutMs = TREAD_EXIT_MS }) {
  if (!pendingRestart || absentMs < timeoutMs) return { end: false, code: null, message: '' }
  return { end: true, code: 'TREAD_EXIT', message: 'Player left the tread' }
}

export function evaluateCloudLoss({ sessionActive, lastContactMs, nowMs, limitMs = HOUR_MS }) {
  if (!sessionActive || lastContactMs == null) return { end: false, code: null, message: '' }
  if (nowMs - lastContactMs >= limitMs) {
    return { end: true, code: 'CLOUD_UNAVAILABLE', message: 'cloud unavailable' }
  }
  return { end: false, code: null, message: '' }
}

export function rejectReservedPose(actionName) {
  return typeof actionName === 'string' && actionName.startsWith('bandit/safety/')
}

export function stopPoseHeld(joints) {
  if (!joints) return false
  const above = joints.leftWristY > joints.headY && joints.rightWristY > joints.headY
  const crossed = joints.leftWristX > joints.bodyCenterX && joints.rightWristX < joints.bodyCenterX
  return above && crossed
}

export function createStopDwell(dwellMs = 1500) {
  let heldSince = null
  return function observe(poseHeld, stationary, nowMs) {
    if (!poseHeld || !stationary) {
      heldSince = null
      return false
    }
    if (heldSince == null) heldSince = nowMs
    return nowMs - heldSince >= dwellMs
  }
}

export function fallProbability(sample) {
  const headBase = sample.baselineHeadM > 0.2 ? sample.baselineHeadM : 1.7
  const hipBase = sample.baselineHipM > 0.2 ? sample.baselineHipM : 0.9
  const headRatio = sample.headHeightM / headBase
  const hipRatio = sample.hipHeightM / hipBase
  const drop = Math.max(0, 1 - Math.min(headRatio, hipRatio))
  const vel = Math.min(1, Math.max(0, -sample.headVelocityMps) / 2)
  const accel = Math.min(1, Math.max(0, -sample.headAccelMps2) / 8)
  const incline = Math.min(1, Math.abs(sample.trunkInclinationRad) / (Math.PI / 2))
  const com = Math.min(1, Math.abs(sample.comBeyondBaseM) / 0.4)
  return {
    pFall: Math.min(1, 0.35 * drop + 0.25 * vel + 0.15 * accel + 0.15 * incline + 0.1 * com),
    reducedConfidence: !sample.calibrated,
  }
}

export function createFallStage(confirmFrames = 2, stumbleThreshold = 0.4, fallThreshold = 0.8) {
  let stumbleFrames = 0
  let fallFrames = 0
  return function observe(pFall) {
    if (pFall >= fallThreshold) {
      fallFrames += 1
      stumbleFrames = 0
    } else if (pFall >= stumbleThreshold) {
      stumbleFrames += 1
      fallFrames = 0
    } else {
      stumbleFrames = 0
      fallFrames = 0
    }
    if (fallFrames >= confirmFrames) return 'FALL'
    if (stumbleFrames >= confirmFrames) return 'STUMBLE'
    return 'NONE'
  }
}

export function profileFromUser(user) {
  const safety = user?.safetyProfile || {}
  const heightCm = safety.heightCm
  const weightKg = safety.weightKg
  return {
    heightM: heightCm == null ? null : Number(heightCm) / 100,
    weightKg: weightKg == null ? null : Number(weightKg),
    dateOfBirth: user?.dateOfBirth || null,
    guardianAuthorized: Boolean(user?.guardianAuthorized),
  }
}
