/**
 * Unified console information architecture (FR-SW-UI-008 / FR-SW-UI-009).
 * Local Device is a separate pillar from Device & Fleet (estate management).
 * Roadmap leaves appear in the menu disabled until implemented.
 */

export const MENU_GROUP = {
  LOCAL: 'local',
  OPERATIONS: 'operations',
  DEVICE_FLEET: 'device-fleet',
  CONTENT: 'content',
  BUSINESS: 'business',
  ANALYTICS: 'analytics',
  ADMINISTRATION: 'administration',
}

/**
 * Canonical leaf catalog. `implemented: false` → visible but disabled in the sidebar.
 * Keep in sync with BanditRequirements FR-SW-UI-009.
 */
export const MENU_LEAF_CATALOG = [
  // Local Device (Alpha)
  { id: 'dashboard', groupId: MENU_GROUP.LOCAL, label: 'Dashboard', implemented: true },
  { id: 'user', groupId: MENU_GROUP.LOCAL, label: 'User', implemented: true },
  { id: 'treadmill', groupId: MENU_GROUP.LOCAL, label: 'Treadmill', implemented: true },
  { id: 'services', groupId: MENU_GROUP.LOCAL, label: 'Services', implemented: true },
  { id: 'events', groupId: MENU_GROUP.LOCAL, label: 'Events', implemented: true },
  { id: 'config', groupId: MENU_GROUP.LOCAL, label: 'Config', implemented: true },
  // Operations
  { id: 'reservations', groupId: MENU_GROUP.OPERATIONS, label: 'Reservations', implemented: true },
  { id: 'users', groupId: MENU_GROUP.OPERATIONS, label: 'Enrollment / Check-In', implemented: true },
  { id: 'staff', groupId: MENU_GROUP.OPERATIONS, label: 'Staff Management', implemented: true },
  { id: 'sessions', groupId: MENU_GROUP.OPERATIONS, label: 'Session History', implemented: true },
  { id: 'notifications', groupId: MENU_GROUP.OPERATIONS, label: 'Notifications', implemented: false, phase: 'Beta 1' },
  // Device & Fleet
  { id: 'fleet', groupId: MENU_GROUP.DEVICE_FLEET, label: 'Treadmills / Devices', implemented: true },
  { id: 'firmware', groupId: MENU_GROUP.DEVICE_FLEET, label: 'Firmware & Updates', implemented: false, phase: 'Beta 1' },
  { id: 'diagnostics', groupId: MENU_GROUP.DEVICE_FLEET, label: 'Diagnostics & Health', implemented: false, phase: 'Beta 1' },
  { id: 'support', groupId: MENU_GROUP.DEVICE_FLEET, label: 'Support & Maintenance', implemented: false, phase: 'Beta 1' },
  { id: 'network', groupId: MENU_GROUP.DEVICE_FLEET, label: 'Network & Connectivity', implemented: false, phase: 'Beta 2' },
  // Content & Media
  { id: 'media', groupId: MENU_GROUP.CONTENT, label: 'Experience Library', implemented: true },
  { id: 'media-uploads', groupId: MENU_GROUP.CONTENT, label: 'Media Uploads', implemented: false, phase: 'Beta 1' },
  { id: 'session-recordings', groupId: MENU_GROUP.CONTENT, label: 'Session Recordings', implemented: false, phase: 'Beta 1' },
  // Business & Commerce
  { id: 'billing', groupId: MENU_GROUP.BUSINESS, label: 'Payments & Billing', implemented: true },
  { id: 'accounts', groupId: MENU_GROUP.BUSINESS, label: 'Customers / Operators / Venues', implemented: true },
  { id: 'subscriptions', groupId: MENU_GROUP.BUSINESS, label: 'Subscriptions', implemented: false, phase: 'Beta 1' },
  { id: 'pricing', groupId: MENU_GROUP.BUSINESS, label: 'Pricing Rules', implemented: false, phase: 'Beta 1' },
  // Analytics & Reporting
  { id: 'usage', groupId: MENU_GROUP.ANALYTICS, label: 'Usage Analytics', implemented: true },
  { id: 'device-analytics', groupId: MENU_GROUP.ANALYTICS, label: 'Device Analytics', implemented: false, phase: 'Beta 1' },
  { id: 'experience-analytics', groupId: MENU_GROUP.ANALYTICS, label: 'Experience Performance', implemented: false, phase: 'Beta 1' },
  { id: 'revenue-analytics', groupId: MENU_GROUP.ANALYTICS, label: 'Revenue Analytics', implemented: false, phase: 'Beta 2' },
  // Administration
  { id: 'roles', groupId: MENU_GROUP.ADMINISTRATION, label: 'Roles & Permissions', implemented: false, phase: 'Beta 2' },
  { id: 'integrations', groupId: MENU_GROUP.ADMINISTRATION, label: 'Integrations (API, Webhooks)', implemented: false, phase: 'Beta 2' },
  { id: 'branding', groupId: MENU_GROUP.ADMINISTRATION, label: 'Branding & Customization', implemented: false, phase: 'Beta 2' },
  { id: 'audit', groupId: MENU_GROUP.ADMINISTRATION, label: 'Audit Logs', implemented: false, phase: 'Beta 2' },
]

export const MENU_ITEM_LABELS = Object.fromEntries(
  MENU_LEAF_CATALOG.map((leaf) => [leaf.id, leaf.label]),
)

export const IMPLEMENTED_MENU_IDS = new Set(
  MENU_LEAF_CATALOG.filter((leaf) => leaf.implemented).map((leaf) => leaf.id),
)

/** @deprecated Prefer MENU_LEAF_CATALOG; kept for tests that listed roadmap-only leaves. */
export const FUTURE_MENU_LEAVES = MENU_LEAF_CATALOG.filter((leaf) => !leaf.implemented).reduce(
  (acc, leaf) => {
    if (!acc[leaf.groupId]) acc[leaf.groupId] = []
    acc[leaf.groupId].push({ id: leaf.id, label: leaf.label, phase: leaf.phase })
    return acc
  },
  {},
)

/** Pillar definitions: itemIds derived from the leaf catalog. */
export const MENU_PILLARS = [
  {
    id: MENU_GROUP.LOCAL,
    label: 'Local Device',
    expandByDefaultWhenOnline: true,
    itemIds: MENU_LEAF_CATALOG.filter((l) => l.groupId === MENU_GROUP.LOCAL).map((l) => l.id),
  },
  {
    id: MENU_GROUP.OPERATIONS,
    label: 'Operations',
    expandByDefaultWhenOnline: false,
    itemIds: MENU_LEAF_CATALOG.filter((l) => l.groupId === MENU_GROUP.OPERATIONS).map((l) => l.id),
  },
  {
    id: MENU_GROUP.DEVICE_FLEET,
    label: 'Device & Fleet',
    expandByDefaultWhenOnline: false,
    itemIds: MENU_LEAF_CATALOG.filter((l) => l.groupId === MENU_GROUP.DEVICE_FLEET).map((l) => l.id),
  },
  {
    id: MENU_GROUP.CONTENT,
    label: 'Content & Media',
    expandByDefaultWhenOnline: false,
    itemIds: MENU_LEAF_CATALOG.filter((l) => l.groupId === MENU_GROUP.CONTENT).map((l) => l.id),
  },
  {
    id: MENU_GROUP.BUSINESS,
    label: 'Business & Commerce',
    expandByDefaultWhenOnline: false,
    itemIds: MENU_LEAF_CATALOG.filter((l) => l.groupId === MENU_GROUP.BUSINESS).map((l) => l.id),
  },
  {
    id: MENU_GROUP.ANALYTICS,
    label: 'Analytics & Reporting',
    expandByDefaultWhenOnline: false,
    itemIds: MENU_LEAF_CATALOG.filter((l) => l.groupId === MENU_GROUP.ANALYTICS).map((l) => l.id),
  },
  {
    id: MENU_GROUP.ADMINISTRATION,
    label: 'Administration',
    expandByDefaultWhenOnline: false,
    itemIds: MENU_LEAF_CATALOG.filter((l) => l.groupId === MENU_GROUP.ADMINISTRATION).map((l) => l.id),
  },
]

/**
 * @param {Record<string, object>} itemsById - map of menu item id → item descriptor
 * @returns {Array<{ id: string, label: string, expandByDefaultWhenOnline: boolean, items: object[] }>}
 */
export function buildMenuGroups(itemsById) {
  return MENU_PILLARS.map((pillar) => ({
    id: pillar.id,
    label: pillar.label,
    expandByDefaultWhenOnline: pillar.expandByDefaultWhenOnline,
    items: pillar.itemIds.map((id) => itemsById[id]).filter(Boolean),
  })).filter((group) => group.items.length > 0)
}

/**
 * Default expanded pillar ids.
 * Only Local Device starts open; when the local unit is unavailable, all start collapsed.
 * @param {boolean | null} deviceOnline
 * @returns {Set<string>}
 */
export function initialExpandedGroupIds(deviceOnline) {
  if (deviceOnline === false) {
    return new Set()
  }
  return new Set([MENU_GROUP.LOCAL])
}

/**
 * @param {Array<{ id: string, items: Array<{ id: string }> }>} groups
 * @param {string} itemId
 * @returns {string | null}
 */
export function findGroupIdForItem(groups, itemId) {
  const group = groups.find((g) => g.items.some((item) => item.id === itemId))
  return group?.id || null
}

/**
 * First navigable (implemented) cloud menu item after local goes offline.
 * @param {Array<{ id: string, items: Array<{ id: string, implemented?: boolean }> }>} groups
 * @returns {{ groupId: string, itemId: string } | null}
 */
export function firstCloudLanding(groups) {
  for (const group of groups) {
    if (group.id === MENU_GROUP.LOCAL) continue
    const first = group.items.find((item) => item.implemented !== false)
    if (first) {
      return { groupId: group.id, itemId: first.id }
    }
  }
  return null
}

export function isMenuItemImplemented(itemId) {
  return IMPLEMENTED_MENU_IDS.has(itemId)
}
