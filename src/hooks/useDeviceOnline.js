import { useEffect, useState } from 'react'
import { pingDevice } from '../api/device'

/**
 * Poll local Bandit Arena REST reachability.
 * While offline (or unknown), recheck every offlinePollMs (default 5s) so the
 * console can restore Local Device navigation when the unit comes back.
 */
export function useDeviceOnline({ onlinePollMs = 10000, offlinePollMs = 5000 } = {}) {
  const [online, setOnline] = useState(null)

  useEffect(() => {
    let mounted = true
    let timer = null

    const scheduleNext = (reachable) => {
      const delay = reachable ? onlinePollMs : offlinePollMs
      timer = setTimeout(runCheck, delay)
    }

    const runCheck = async () => {
      const reachable = await pingDevice()
      if (!mounted) {
        return
      }
      setOnline(reachable)
      scheduleNext(reachable)
    }

    runCheck()

    return () => {
      mounted = false
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [onlinePollMs, offlinePollMs])

  return online
}
