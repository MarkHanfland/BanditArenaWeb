/**
 * Cross-page navigation into Session History (no React Router).
 */

let pendingUserId = null

export function requestSessionHistoryForUser(userId) {
  pendingUserId = userId || null
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
