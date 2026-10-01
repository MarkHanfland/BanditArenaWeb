/**
 * FR-SW-AUTH-015 offline sign-in on the console.
 *
 * The device verifies the PIN (POST /auth/offline-pin) and returns a short-lived
 * device token with the user's cached local role. The console keeps that session
 * in memory only — never in browser storage — and drops it at its expiry. The
 * token is valid on this device only; cloud calls fail and show "cloud unavailable".
 */
import axios from 'axios'

const ROLE_GROUP = {
  operator: 'bandit-operator',
  technician: 'bandit-technician',
  'venue-admin': 'bandit-venue-admin',
}

let current = null
let expiryTimer = null
const listeners = new Set()

function notify() {
  for (const fn of listeners) fn(current)
}

/** Session record from a device /auth/offline-pin response. */
export function offlineSessionFromResponse(username, data, nowMs = Date.now()) {
  if (!data?.token || typeof data.token !== 'string' || !data.token.startsWith('offline.')) return null
  const expiresAtMs = Number(data.expiresAt) > 0 ? Number(data.expiresAt) * 1000 : nowMs + 60 * 60 * 1000
  if (expiresAtMs <= nowMs) return null
  const group = ROLE_GROUP[data.role] || ROLE_GROUP.operator
  return {
    token: data.token,
    expiresAtMs,
    user: { userId: username, username, groups: [group], offline: true },
  }
}

export function getOfflineSession() {
  if (current && current.expiresAtMs <= Date.now()) clearOfflineSession()
  return current
}

export function setOfflineSession(session) {
  current = session
  if (expiryTimer) clearTimeout(expiryTimer)
  expiryTimer = session
    ? setTimeout(() => clearOfflineSession(), Math.max(0, session.expiresAtMs - Date.now()))
    : null
  notify()
}

export function clearOfflineSession() {
  if (expiryTimer) clearTimeout(expiryTimer)
  expiryTimer = null
  current = null
  notify()
}

export function subscribeOfflineSession(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const DEVICE_MESSAGES = {
  PIN_REJECTED: 'PIN was not accepted',
  PIN_LOCKED: 'Offline sign-in is locked. Sign in online to unlock it.',
  PIN_EXPIRED: 'Offline sign-in has expired: more than 1 hour since the device last reached the cloud.',
  PIN_DENIED: 'No offline PIN is set for this user on this device.',
}

/** Ask the device to verify the PIN; on success the console opens on the device token. */
export async function signInWithDevicePin(username, pin) {
  try {
    const { getDeviceApiBaseUrl } = await import('../config/runtime')
    const res = await axios.post(
      `${getDeviceApiBaseUrl()}/auth/offline-pin`,
      { username, pin },
      { timeout: 5000 },
    )
    const session = offlineSessionFromResponse(username, res.data)
    if (!session) return { ok: false, message: 'Offline sign-in was not accepted' }
    setOfflineSession(session)
    return { ok: true, session }
  } catch (err) {
    const code = err.response?.data?.code
    return { ok: false, code, message: DEVICE_MESSAGES[code] || err.response?.data?.error || 'Device unreachable' }
  }
}
