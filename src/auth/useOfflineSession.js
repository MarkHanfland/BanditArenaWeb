import { useSyncExternalStore } from 'react'
import { getOfflineSession, subscribeOfflineSession } from './offlineSession'

/** FR-SW-AUTH-015: the current device-issued offline session, or null. */
export function useOfflineSession() {
  return useSyncExternalStore(subscribeOfflineSession, getOfflineSession, () => null)
}
