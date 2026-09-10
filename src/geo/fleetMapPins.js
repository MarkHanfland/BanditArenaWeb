/** Staff fleet map helpers (FR-SW-UI-012 / SW-097). */

export function venueCoordinates(venue) {
  if (!venue) return null
  const latitude = Number(venue.latitude ?? venue.lat)
  const longitude = Number(venue.longitude ?? venue.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

const STATUS_RANK = {
  lockout: 4,
  maintenance: 3,
  offline: 2,
  online: 1,
  active: 1,
  provisioned: 0,
}

export function fleetPinStatus(devices = []) {
  let worst = 'unknown'
  let rank = -1
  for (const device of devices) {
    const status = String(device?.status || device?.healthState || '').toLowerCase()
    const next = STATUS_RANK[status] ?? 0
    if (next > rank) {
      rank = next
      worst = status || 'unknown'
    }
  }
  return worst
}

export function pinColor(status, fallback = '#3DDC97') {
  if (status === 'lockout') return '#E53935'
  if (status === 'maintenance') return '#FB8C00'
  if (status === 'offline') return '#FDD835'
  if (status === 'online' || status === 'active') return '#43A047'
  return fallback
}

/** Screen-space clustering for the no-token fallback map. */
export function clusterPins(pins = [], radiusPct = 6) {
  const clusters = []
  for (const pin of pins) {
    const hit = clusters.find((cluster) => {
      const dx = cluster.x - pin.x
      const dy = cluster.y - pin.y
      return Math.hypot(dx, dy) <= radiusPct
    })
    if (hit) {
      hit.venues.push(pin)
      hit.x = (hit.x * (hit.venues.length - 1) + pin.x) / hit.venues.length
      hit.y = (hit.y * (hit.venues.length - 1) + pin.y) / hit.venues.length
    } else {
      clusters.push({ id: pin.venueId, x: pin.x, y: pin.y, venues: [pin] })
    }
  }
  return clusters
}

export function mapboxAccessToken() {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
  return typeof token === 'string' ? token.trim() : ''
}
