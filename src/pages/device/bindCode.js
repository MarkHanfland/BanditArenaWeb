/** FR-SW-UI-015: the local console shows a 6-digit bind code for 2 minutes. */

export const CODE_TTL_SECONDS = 120

export function digitsOf(code) {
  return String(code || '').replace(/\D/g, '').slice(0, 6)
}

export function formatBindCode(code) {
  const digits = digitsOf(code)
  if (digits.length !== 6) return digits
  return `${digits.slice(0, 3)} ${digits.slice(3)}`
}

export function remainingSeconds(expiresAt, now = Date.now()) {
  const ms = Date.parse(expiresAt)
  if (!Number.isFinite(ms)) return 0
  return Math.max(0, Math.ceil((ms - now) / 1000))
}

export function bindCodeMessage(result) {
  if (!result?.error) return ''
  if (result.code === 'CLOUD_UNAVAILABLE' || result.status === 503) {
    return 'The cloud is unreachable. Scan the Player\'s pass at the desk instead.'
  }
  if (result.status === 404) {
    return 'This treadmill software does not yet show a bind code.'
  }
  return result.error
}
