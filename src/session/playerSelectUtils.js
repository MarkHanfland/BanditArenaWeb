/** Shared helpers for console player selection. */

export function playerDisplayName(player) {
  return player?.displayName || player?.name || player?.email || player?.userId || ''
}

/** Last token of a multi-word name (e.g. "Alex Runner" → "Runner"). */
export function playerLastName(player) {
  const name = String(player?.name || player?.displayName || '').trim()
  if (!name) {
    return ''
  }
  const parts = name.split(/\s+/).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : parts[0]
}

export function matchesPlayerSearch(player, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) {
    return true
  }
  const lastName = playerLastName(player).toLowerCase()
  const email = String(player?.email || '').toLowerCase()
  return lastName.includes(q) || email.includes(q)
}

const SCHEDULED_STATUSES = new Set(['booked', 'checked_in'])

/**
 * Slots that count as "currently scheduled" for operator pick-list filtering.
 * Window: from 30 minutes before start through 30 minutes after end (or +2h if no end).
 */
export function isReservationCurrent(slot, nowMs = Date.now()) {
  if (!slot?.userId || !SCHEDULED_STATUSES.has(slot.status)) {
    return false
  }
  const startMs = Date.parse(slot.startTime)
  if (!Number.isFinite(startMs)) {
    return false
  }
  const endMs = Date.parse(slot.endTime)
  const windowStart = startMs - 30 * 60 * 1000
  const windowEnd = Number.isFinite(endMs)
    ? endMs + 30 * 60 * 1000
    : startMs + 2 * 60 * 60 * 1000
  return nowMs >= windowStart && nowMs <= windowEnd
}

export function scheduledUserIdsFromReservations(reservations, nowMs = Date.now()) {
  const ids = new Set()
  for (const slot of reservations || []) {
    if (isReservationCurrent(slot, nowMs)) {
      ids.add(slot.userId)
    }
  }
  return ids
}

export function currentSlotsForUser(reservations, userId, nowMs = Date.now()) {
  return (reservations || []).filter(
    (slot) => slot.userId === userId && isReservationCurrent(slot, nowMs),
  )
}
