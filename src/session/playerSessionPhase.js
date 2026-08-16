export const SESSION_PHASE = {
  idle: 'idle',
  pending: 'pending',
  active: 'active',
}

export const SESSION_PHASE_LABEL = {
  idle: 'No session',
  pending: 'Pending start',
  active: 'Active session',
}

export function sessionPhaseFrom({ session, selected }) {
  if (session?.active) {
    return SESSION_PHASE.active
  }
  if (selected?.userId) {
    return SESSION_PHASE.pending
  }
  return SESSION_PHASE.idle
}

export function formatSessionClock(totalSec) {
  if (totalSec == null || totalSec < 0 || !Number.isFinite(totalSec)) {
    return '—'
  }
  const seconds = Math.floor(totalSec)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
  }
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
