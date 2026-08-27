/**
 * Resolve treadmill + venue identity for cloud Session History records.
 * Prefer device-linked instanceId (mTLS /auth/info or session start), then
 * denormalize display labels from Fleet registry when available.
 */
import { getAuthInfo } from '../api/device'
import { listProductInstances, listVenues } from '../api/cloud'

export async function resolveSessionDeviceContext({ deviceId } = {}) {
  let instanceId = deviceId || null
  if (!instanceId) {
    const auth = await getAuthInfo()
    instanceId = auth.data?.deviceId || null
  }
  if (!instanceId) {
    return {}
  }

  const [instancesRes, venuesRes] = await Promise.all([
    listProductInstances(),
    listVenues(),
  ])
  const instance = (instancesRes.data?.instances || []).find(
    (entry) => entry.instanceId === instanceId,
  )
  const venueId = instance?.venueId || null
  const venue = (venuesRes.data?.venues || []).find((entry) => entry.venueId === venueId)

  return {
    instanceId,
    venueId: venueId || undefined,
    venueName: venue?.name || instance?.venueName || undefined,
    instanceDisplayName: instance?.displayName || undefined,
  }
}

export function formatTreadmillLabel({ instanceDisplayName, instanceId } = {}) {
  if (instanceDisplayName) return instanceDisplayName
  if (instanceId) return instanceId
  return '—'
}

export function formatVenueLabel({ venueName, venueId } = {}) {
  if (venueName) return venueName
  if (venueId) return venueId
  return '—'
}
