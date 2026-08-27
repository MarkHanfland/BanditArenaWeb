/**
 * Cross-page navigation into Session History (no React Router).
 * Alpha: History is Player-scoped — remember last selected account for reopen.
 */

const LAST_HISTORY_USER_KEY = 'bandit.sessionHistory.userId'

let pendingUserId = null

export function requestSessionHistoryForUser(userId) {
  pendingUserId = userId || null
  if (userId) {
    rememberSessionHistoryUser(userId)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bandit:open-session-history', { detail: { userId: pendingUserId } }),
    )
  }
}

export function consumeSessionHistoryUserFilter() {
  const value = pendingUserId
  pendingUserId = null
  return value
}

export function peekSessionHistoryUserFilter() {
  return pendingUserId
}

export function rememberSessionHistoryUser(userId) {
  if (typeof localStorage === 'undefined') return
  if (!userId) {
    localStorage.removeItem(LAST_HISTORY_USER_KEY)
    return
  }
  localStorage.setItem(LAST_HISTORY_USER_KEY, String(userId))
}

export function readLastSessionHistoryUser() {
  if (typeof localStorage === 'undefined') return ''
  try {
    return localStorage.getItem(LAST_HISTORY_USER_KEY) || ''
  } catch {
    return ''
  }
}
