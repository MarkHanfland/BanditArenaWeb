/**
 * Hypothetical demo fleets for console Fleet / Analytics surfaces.
 * Neon Circuit — downtown entertainment districts.
 * Horizon Parks — theme-park destinations.
 *
 * Geo: venue lat/lng (IoT devices inherit venue pin; live GPS is future).
 * Financial: illustrative 30-day operating metrics for FA/CA demos.
 */

export const FLEET_ACCENTS = {
  metro: {
    primary: '#0F6E56',
    secondary: '#1A9B7A',
    wash: 'linear-gradient(145deg, #0a2e28 0%, #134e44 42%, #1a6b5c 100%)',
    pin: '#3DDC97',
  },
  parks: {
    primary: '#8B4513',
    secondary: '#C46B2D',
    wash: 'linear-gradient(145deg, #2a1810 0%, #5c3318 45%, #8B4513 100%)',
    pin: '#F0A868',
  },
}

function money(n) {
  return Math.round(n * 100) / 100
}

function deviceFinancials({
  sessions30d,
  avgTicketUsd,
  utilizationPct,
  contentRoyalty30d,
  licenseCostMonthly,
  maintenanceContractAnnual,
  partsCost30d,
}) {
  const sessionRevenue30d = money(sessions30d * avgTicketUsd)
  const maintenanceAccrual30d = money(maintenanceContractAnnual / 12)
  const contributionMargin30d = money(
    sessionRevenue30d - contentRoyalty30d - licenseCostMonthly - maintenanceAccrual30d - partsCost30d,
  )
  return {
    sessions30d,
    avgTicketUsd,
    utilizationPct,
    sessionRevenue30d,
    contentRoyalty30d,
    licenseCostMonthly,
    maintenanceContractAnnual,
    maintenanceAccrual30d,
    partsCost30d,
    contributionMargin30d,
    revenuePerHourUsd: money(sessionRevenue30d / Math.max(utilizationPct * 7.2, 1)),
  }
}

const NEON_VENUES = [
  {
    venueId: 'venue-chi-rivernorth',
    name: 'Chicago · River North Run Club',
    city: 'Chicago',
    region: 'IL',
    district: 'River North',
    timezone: 'America/Chicago',
    lat: 41.8924,
    lng: -87.6341,
  },
  {
    venueId: 'venue-nash-broadway',
    name: 'Nashville · Broadway Arcade',
    city: 'Nashville',
    region: 'TN',
    district: 'Lower Broadway',
    timezone: 'America/Chicago',
    lat: 36.1627,
    lng: -86.7816,
  },
  {
    venueId: 'venue-aus-rainey',
    name: 'Austin · Rainey Street Studio',
    city: 'Austin',
    region: 'TX',
    district: 'Rainey Street',
    timezone: 'America/Chicago',
    lat: 30.2586,
    lng: -97.7386,
  },
  {
    venueId: 'venue-den-larimer',
    name: 'Denver · Larimer Square Lab',
    city: 'Denver',
    region: 'CO',
    district: 'Larimer Square',
    timezone: 'America/Denver',
    lat: 39.7527,
    lng: -104.9997,
  },
  {
    venueId: 'venue-nyc-hudson',
    name: 'New York · Hudson Yards Edge',
    city: 'New York',
    region: 'NY',
    district: 'Hudson Yards',
    timezone: 'America/New_York',
    lat: 40.7536,
    lng: -74.0015,
  },
]

const PARK_VENUES = [
  {
    venueId: 'venue-orl-adventurebay',
    name: 'Orlando · Adventure Bay VR Hub',
    city: 'Orlando',
    region: 'FL',
    district: 'Adventure Bay',
    timezone: 'America/New_York',
    lat: 28.3852,
    lng: -81.5639,
  },
  {
    venueId: 'venue-ana-pacificgate',
    name: 'Anaheim · Pacific Gate Plaza',
    city: 'Anaheim',
    region: 'CA',
    district: 'Pacific Gate',
    timezone: 'America/Los_Angeles',
    lat: 33.8121,
    lng: -117.919,
  },
  {
    venueId: 'venue-clt-carolinakingdom',
    name: 'Charlotte · Carolina Kingdom',
    city: 'Charlotte',
    region: 'NC',
    district: 'Carolina Kingdom',
    timezone: 'America/New_York',
    lat: 35.1032,
    lng: -80.942,
  },
]

const NEON_DEVICES = [
  {
    instanceId: 'ba-chi-01',
    displayName: 'River North · Bay 1',
    venueId: 'venue-chi-rivernorth',
    computeSerialNumber: 'BA-CHI-RN-01',
    status: 'online',
    healthState: 'healthy',
    firmwareVersion: '1.4.2',
    licenseTier: 'venue_pro',
    updateAvailable: false,
    financials: deviceFinancials({
      sessions30d: 186,
      avgTicketUsd: 28,
      utilizationPct: 72,
      contentRoyalty30d: 410,
      licenseCostMonthly: 199,
      maintenanceContractAnnual: 2500,
      partsCost30d: 45,
    }),
  },
  {
    instanceId: 'ba-chi-02',
    displayName: 'River North · Bay 2',
    venueId: 'venue-chi-rivernorth',
    computeSerialNumber: 'BA-CHI-RN-02',
    status: 'online',
    healthState: 'degraded',
    firmwareVersion: '1.4.1',
    licenseTier: 'venue_pro',
    updateAvailable: true,
    financials: deviceFinancials({
      sessions30d: 142,
      avgTicketUsd: 28,
      utilizationPct: 58,
      contentRoyalty30d: 320,
      licenseCostMonthly: 199,
      maintenanceContractAnnual: 2500,
      partsCost30d: 180,
    }),
  },
  {
    instanceId: 'ba-nash-01',
    displayName: 'Broadway · Unit A',
    venueId: 'venue-nash-broadway',
    computeSerialNumber: 'BA-NSH-BW-01',
    status: 'online',
    healthState: 'healthy',
    firmwareVersion: '1.4.2',
    licenseTier: 'venue_pro',
    updateAvailable: false,
    financials: deviceFinancials({
      sessions30d: 210,
      avgTicketUsd: 32,
      utilizationPct: 81,
      contentRoyalty30d: 480,
      licenseCostMonthly: 199,
      maintenanceContractAnnual: 2500,
      partsCost30d: 20,
    }),
  },
  {
    instanceId: 'ba-aus-01',
    displayName: 'Rainey · Studio 1',
    venueId: 'venue-aus-rainey',
    computeSerialNumber: 'BA-AUS-RS-01',
    status: 'online',
    healthState: 'healthy',
    firmwareVersion: '1.4.2',
    licenseTier: 'venue_pro',
    updateAvailable: false,
    financials: deviceFinancials({
      sessions30d: 168,
      avgTicketUsd: 26,
      utilizationPct: 64,
      contentRoyalty30d: 360,
      licenseCostMonthly: 199,
      maintenanceContractAnnual: 2500,
      partsCost30d: 0,
    }),
  },
  {
    instanceId: 'ba-den-01',
    venueId: 'venue-den-larimer',
    computeSerialNumber: 'BA-DEN-LQ-01',
    status: 'offline',
    healthState: 'unknown',
    firmwareVersion: '1.3.9',
    licenseTier: 'venue_pro',
    updateAvailable: true,
    financials: deviceFinancials({
      sessions30d: 96,
      avgTicketUsd: 27,
      utilizationPct: 41,
      contentRoyalty30d: 210,
      licenseCostMonthly: 199,
      maintenanceContractAnnual: 2500,
      partsCost30d: 90,
    }),
  },
  {
    instanceId: 'ba-nyc-01',
    venueId: 'venue-nyc-hudson',
    computeSerialNumber: 'BA-NYC-HY-01',
    status: 'online',
    healthState: 'healthy',
    firmwareVersion: '1.4.2',
    licenseTier: 'enterprise',
    updateAvailable: false,
    financials: deviceFinancials({
      sessions30d: 248,
      avgTicketUsd: 42,
      utilizationPct: 88,
      contentRoyalty30d: 720,
      licenseCostMonthly: 349,
      maintenanceContractAnnual: 3200,
      partsCost30d: 55,
    }),
  },
]

const PARK_DEVICES = [
  {
    instanceId: 'ba-orl-01',
    venueId: 'venue-orl-adventurebay',
    computeSerialNumber: 'BA-ORL-AB-01',
    status: 'online',
    healthState: 'healthy',
    firmwareVersion: '1.4.2',
    licenseTier: 'enterprise',
    updateAvailable: false,
    financials: deviceFinancials({
      sessions30d: 420,
      avgTicketUsd: 18,
      utilizationPct: 91,
      contentRoyalty30d: 890,
      licenseCostMonthly: 349,
      maintenanceContractAnnual: 4200,
      partsCost30d: 110,
    }),
  },
  {
    instanceId: 'ba-orl-02',
    venueId: 'venue-orl-adventurebay',
    computeSerialNumber: 'BA-ORL-AB-02',
    status: 'online',
    healthState: 'healthy',
    firmwareVersion: '1.4.2',
    licenseTier: 'enterprise',
    updateAvailable: false,
    financials: deviceFinancials({
      sessions30d: 398,
      avgTicketUsd: 18,
      utilizationPct: 87,
      contentRoyalty30d: 840,
      licenseCostMonthly: 349,
      maintenanceContractAnnual: 4200,
      partsCost30d: 40,
    }),
  },
  {
    instanceId: 'ba-orl-03',
    venueId: 'venue-orl-adventurebay',
    computeSerialNumber: 'BA-ORL-AB-03',
    status: 'maintenance',
    healthState: 'degraded',
    firmwareVersion: '1.4.0',
    licenseTier: 'enterprise',
    updateAvailable: true,
    financials: deviceFinancials({
      sessions30d: 210,
      avgTicketUsd: 18,
      utilizationPct: 44,
      contentRoyalty30d: 420,
      licenseCostMonthly: 349,
      maintenanceContractAnnual: 4200,
      partsCost30d: 620,
    }),
  },
  {
    instanceId: 'ba-ana-01',
    venueId: 'venue-ana-pacificgate',
    computeSerialNumber: 'BA-ANA-PG-01',
    status: 'online',
    healthState: 'healthy',
    firmwareVersion: '1.4.2',
    licenseTier: 'enterprise',
    updateAvailable: false,
    financials: deviceFinancials({
      sessions30d: 360,
      avgTicketUsd: 20,
      utilizationPct: 85,
      contentRoyalty30d: 780,
      licenseCostMonthly: 349,
      maintenanceContractAnnual: 4200,
      partsCost30d: 75,
    }),
  },
  {
    instanceId: 'ba-ana-02',
    venueId: 'venue-ana-pacificgate',
    computeSerialNumber: 'BA-ANA-PG-02',
    status: 'online',
    healthState: 'healthy',
    firmwareVersion: '1.4.1',
    licenseTier: 'enterprise',
    updateAvailable: true,
    financials: deviceFinancials({
      sessions30d: 340,
      avgTicketUsd: 20,
      utilizationPct: 79,
      contentRoyalty30d: 740,
      licenseCostMonthly: 349,
      maintenanceContractAnnual: 4200,
      partsCost30d: 30,
    }),
  },
  {
    instanceId: 'ba-clt-01',
    venueId: 'venue-clt-carolinakingdom',
    computeSerialNumber: 'BA-CLT-CK-01',
    status: 'online',
    healthState: 'healthy',
    firmwareVersion: '1.4.2',
    licenseTier: 'venue_pro',
    updateAvailable: false,
    financials: deviceFinancials({
      sessions30d: 275,
      avgTicketUsd: 16,
      utilizationPct: 76,
      contentRoyalty30d: 510,
      licenseCostMonthly: 199,
      maintenanceContractAnnual: 2800,
      partsCost30d: 25,
    }),
  },
]

function hydrateDevices(devices, venues, fleetId, model = 'BanditArena-Alpha') {
  const byId = Object.fromEntries(venues.map((v) => [v.venueId, v]))
  return devices.map((d, index) => {
    const venue = byId[d.venueId]
    const fallbackName = venue?.district
      ? `${venue.district} · Bay ${index + 1}`
      : `Treadmill ${index + 1}`
    return {
      ...d,
      displayName: d.displayName || fallbackName,
      fleetId,
      productId: 'product-demo-treadmill',
      model,
      location: {
        source: 'venue_pin',
        lat: venue.lat,
        lng: venue.lng,
        accuracyM: 25,
        updatedAt: '2026-08-17T18:00:00.000Z',
      },
      venueName: venue.name,
      city: venue.city,
      district: venue.district,
      timezone: venue.timezone,
    }
  })
}

export const DEMO_FLEETS = [
  {
    fleetId: 'fleet-metro-entertainment',
    name: 'Neon Circuit',
    shortLabel: 'Downtown entertainment',
    description:
      'Operator fleet in major-city nightlife and entertainment corridors — walk-up sessions, premium tickets, evening peaks.',
    operatorName: 'Neon Circuit Entertainment',
    customerId: 'customer-neon-circuit',
    accent: FLEET_ACCENTS.metro,
    venues: NEON_VENUES,
    devices: hydrateDevices(NEON_DEVICES, NEON_VENUES, 'fleet-metro-entertainment'),
  },
  {
    fleetId: 'fleet-horizon-parks',
    name: 'Horizon Parks',
    shortLabel: 'Theme park company',
    description:
      'Destination parks with high daily throughput, bundled park-pass pricing, and multi-unit hubs per gate.',
    operatorName: 'Horizon Parks Company',
    customerId: 'customer-horizon-parks',
    accent: FLEET_ACCENTS.parks,
    venues: PARK_VENUES,
    devices: hydrateDevices(PARK_DEVICES, PARK_VENUES, 'fleet-horizon-parks'),
  },
]

export function getFleetById(fleetId) {
  return DEMO_FLEETS.find((f) => f.fleetId === fleetId) || DEMO_FLEETS[0]
}

export function allDemoDevices() {
  return DEMO_FLEETS.flatMap((f) => f.devices)
}

export function allDemoVenues() {
  return DEMO_FLEETS.flatMap((f) =>
    f.venues.map((v) => ({
      ...v,
      fleetId: f.fleetId,
      fleetName: f.name,
      status: 'active',
      ownerCustomerId: f.customerId,
    })),
  )
}

export function rollupFleetFinancials(fleet) {
  const devices = fleet.devices || []
  const sum = (key) => devices.reduce((acc, d) => acc + (d.financials?.[key] || 0), 0)
  const online = devices.filter((d) => d.status === 'online').length
  const needsAttention = devices.filter(
    (d) => d.status === 'offline' || d.status === 'maintenance' || d.updateAvailable || d.healthState === 'degraded',
  ).length
  return {
    deviceCount: devices.length,
    onlineCount: online,
    needsAttention,
    sessions30d: sum('sessions30d'),
    sessionRevenue30d: money(sum('sessionRevenue30d')),
    contentRoyalty30d: money(sum('contentRoyalty30d')),
    contributionMargin30d: money(sum('contributionMargin30d')),
    avgUtilizationPct: devices.length
      ? Math.round(sum('utilizationPct') / devices.length)
      : 0,
    licenseCostMonthly: money(sum('licenseCostMonthly')),
    maintenanceAccrual30d: money(sum('maintenanceAccrual30d')),
  }
}

export function analyticsFleetComparison() {
  return DEMO_FLEETS.map((fleet) => ({
    fleetId: fleet.fleetId,
    name: fleet.name,
    shortLabel: fleet.shortLabel,
    accent: fleet.accent,
    ...rollupFleetFinancials(fleet),
  }))
}

/** Continental US projection helpers for the stylized map (approx). */
export function projectLatLng(lat, lng, width = 100, height = 100) {
  const minLat = 24
  const maxLat = 50
  const minLng = -125
  const maxLng = -66
  const x = ((lng - minLng) / (maxLng - minLng)) * width
  const y = ((maxLat - lat) / (maxLat - minLat)) * height
  return { x: Math.min(Math.max(x, 2), width - 2), y: Math.min(Math.max(y, 2), height - 2) }
}

/**
 * Feasibility note (UI copy): venue-pinned geolocation is demo-ready now;
 * live IoT GPS / Wi-Fi RTT can attach to heartbeat later without changing the map surface.
 */
export const GEOLOCATION_FEASIBILITY = {
  phaseNow: 'venue_pin',
  summary:
    'Feasible for Alpha demos using venue lat/lng assigned at install. Devices inherit the venue pin via heartbeat metadata; live GPS or Wi-Fi geolocation can replace or refine the pin later without a separate map product.',
  sources: ['venue_registry', 'optional_heartbeat_lastKnownLocation', 'future_gnss_or_wifi_rtt'],
  privacy: 'Operator-scoped; no continuous personal tracking — device asset pin only.',
}
