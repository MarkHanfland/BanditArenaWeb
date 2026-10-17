/** A staff or player JWT whose exp has passed. Cognito uses numeric exp; the player portal uses an ISO string. */
export function jwtExpiryMs(token) {
  const parts = String(token || '').split('.')
  const body = parts.length >= 3 ? parts[1] : parts[0]
  if (!body) return null
  try {
    const base64 = body.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(globalThis.atob(padded))
    if (typeof payload?.exp === 'number') return payload.exp * 1000
    const parsed = Date.parse(payload?.exp || '')
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function sessionNeedsSignIn(token, now = Date.now()) {
  const exp = jwtExpiryMs(token)
  return exp !== null && exp <= now
}

/**
 * A 401 is a dead session. Refresh once; if that does not produce a token, leave for sign-in.
 * @returns {'stay' | 'retry' | 'sign-in'}
 */
export async function recoverExpiredSession({ status, alreadyRetried, refresh, signedIn }) {
  if (status !== 401 || alreadyRetried) return 'stay'
  if (refresh) {
    const ok = await refresh()
    if (ok && signedIn()) return 'retry'
  }
  return 'sign-in'
}

import { noticeFromAxios, reportPageError } from '../pageError.js'

/** One response path for every console client. Pages do not handle a dead session themselves. */
export function attachSessionRecovery(client, { refresh, signedIn, onSignIn, applyAuthorization }) {
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config
      const decision = await recoverExpiredSession({
        status: error.response?.status,
        alreadyRetried: Boolean(original?._authRetried),
        refresh,
        signedIn,
      })
      if (!original || decision === 'stay') {
        reportPageError(noticeFromAxios(error))
        return Promise.reject(error)
      }
      original._authRetried = true
      if (decision === 'retry') {
        applyAuthorization(original)
        return client(original)
      }
      reportPageError(noticeFromAxios(error))
      onSignIn()
      return Promise.reject(error)
    },
  )
}
