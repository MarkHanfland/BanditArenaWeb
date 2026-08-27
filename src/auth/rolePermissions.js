import { isCloudDeployment } from '../config/runtime'
import { MENU_GROUP, MENU_LEAF_CATALOG } from '../nav/consoleMenu'

export const ROLE_OPERATOR = 'operator'
export const ROLE_TECHNICIAN = 'technician'
export const ROLE_VENUE_ADMIN = 'venue-admin'
export const ROLE_FLEET_ADMIN = 'fleet-admin'
export const ROLE_CLOUD_ADMIN = 'cloud-admin'

const leafIdsInGroups = (...groupIds) =>
  MENU_LEAF_CATALOG.filter((leaf) => groupIds.includes(leaf.groupId)).map((leaf) => leaf.id)

const DEVICE_MENU_IDS = leafIdsInGroups(MENU_GROUP.LOCAL)

/** Technician: local full + content/fleet/analytics estate tools (incl. disabled roadmap leaves). */
const TECHNICIAN_CLOUD = leafIdsInGroups(
  MENU_GROUP.DEVICE_FLEET,
  MENU_GROUP.CONTENT,
  MENU_GROUP.ANALYTICS,
)

/** Venue / fleet / cloud admin: all cloud pillars including Administration roadmap leaves. */
const VENUE_CLOUD = leafIdsInGroups(
  MENU_GROUP.OPERATIONS,
  MENU_GROUP.DEVICE_FLEET,
  MENU_GROUP.CONTENT,
  MENU_GROUP.BUSINESS,
  MENU_GROUP.ANALYTICS,
  MENU_GROUP.ADMINISTRATION,
)

export const ROLE_PERMISSIONS = {
  [ROLE_OPERATOR]: ['dashboard', 'treadmill', 'events'],
  [ROLE_TECHNICIAN]: [...DEVICE_MENU_IDS, ...TECHNICIAN_CLOUD],
  [ROLE_VENUE_ADMIN]: [...DEVICE_MENU_IDS, ...VENUE_CLOUD],
  [ROLE_FLEET_ADMIN]: [...DEVICE_MENU_IDS, ...VENUE_CLOUD],
  [ROLE_CLOUD_ADMIN]: [...DEVICE_MENU_IDS, ...VENUE_CLOUD],
}

export function extractGroupsFromUser(user) {
  if (Array.isArray(user?.groups)) {
    return user.groups.filter(Boolean)
  }

  const payload = user?.signInUserSession?.idToken?.payload
  const groups = payload?.['cognito:groups']
  if (Array.isArray(groups)) {
    return groups.filter(Boolean)
  }
  if (typeof groups === 'string' && groups.length > 0) {
    return [groups]
  }

  return []
}

export function deriveUserRole(user) {
  const groups = extractGroupsFromUser(user)
  if (groups.includes('bandit-cloud-admin')) {
    return ROLE_CLOUD_ADMIN
  }
  if (groups.includes('bandit-fleet-admin')) {
    return ROLE_FLEET_ADMIN
  }
  if (groups.includes('bandit-venue-admin') || groups.includes('bandit-developer')) {
    return ROLE_VENUE_ADMIN
  }
  if (groups.includes('bandit-technician')) {
    return ROLE_TECHNICIAN
  }
  if (groups.includes('bandit-operator')) {
    return ROLE_OPERATOR
  }
  // Cloud console without groups: treat as venue admin for Alpha lab access.
  if (isCloudDeployment()) {
    return ROLE_VENUE_ADMIN
  }
  return ROLE_OPERATOR
}

export function getAllowedMenuIds(user) {
  const role = deriveUserRole(user)
  return [...(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[ROLE_OPERATOR])]
}

export function filterMenuGroups(menuGroups, user) {
  const allowedIds = new Set(getAllowedMenuIds(user))
  return menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowedIds.has(item.id)),
    }))
    .filter((group) => group.items.length > 0)
}
