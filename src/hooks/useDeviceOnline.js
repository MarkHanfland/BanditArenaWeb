import { useEffect, useState } from 'react'
import { pingDevice } from '../api/device'

export function useDeviceOnline(pollMs = 10000) {
  const [online, setOnline] = useState(null)

  useEffect(() => {
    let mounted = true

    const check = async () => {
      const reachable = await pingDevice()
      if (mounted) {
        setOnline(reachable)
      }
    }

    check()
    const interval = setInterval(check, pollMs)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [pollMs])

  return online
}
