export const TREADMILL_STATE_MAP = {
  0: { label: 'Startup', color: 'warning' },
  1: { label: 'Failure', color: 'error' },
  2: { label: 'Operating', color: 'success' },
  3: { label: 'Safety Stop', color: 'error' },
  4: { label: 'Calibration', color: 'info' },
  5: { label: 'Standby', color: 'warning' },
}

export function treadmillStateInfo(state) {
  if (state == null || TREADMILL_STATE_MAP[state] == null) {
    return { label: 'Unknown', color: 'default' }
  }
  return TREADMILL_STATE_MAP[state]
}

/**
 * Status-bar treadmill label.
 * With no Player session, never show Unknown — show Offline instead.
 */
export function treadmillStatusForSession(state, { sessionActive = false } = {}) {
  if (!sessionActive) {
    if (state == null || TREADMILL_STATE_MAP[state] == null || state === 5) {
      return { label: 'Offline', color: 'default' }
    }
  }
  return treadmillStateInfo(state)
}
