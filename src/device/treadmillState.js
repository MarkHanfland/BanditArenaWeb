export const TREADMILL_STATE_MAP = {
  0: { label: 'Startup', color: 'warning' },
  1: { label: 'Failure', color: 'error' },
  2: { label: 'Operating', color: 'success' },
  3: { label: 'Safety Stop', color: 'error' },
  4: { label: 'Calibration', color: 'info' },
  5: { label: 'User Standby', color: 'warning' },
}

export function treadmillStateInfo(state) {
  if (state == null || TREADMILL_STATE_MAP[state] == null) {
    return { label: 'Unknown', color: 'default' }
  }
  return TREADMILL_STATE_MAP[state]
}
