import { isCloudDeployment } from '../config/runtime'
import { MENU_GROUP, MENU_LEAF_CATALOG } from '../nav/consoleMenu'

export const ROLE_OPERATOR = 'operator'
export const ROLE_TECHNICIAN = 'technician'
export const ROLE_VENUE_ADMIN = 'venue-admin'
export const ROLE_FLEET_ADMIN = 'fleet-admin'
export const ROLE_CLOUD_ADMIN = 'cloud-admin'
export const ROLE_DEVELOPER = 'developer'
export const ROLE_FRONT_DESK = 'front-desk'
/** Cloud user with no staff group: no cloud menus (fail closed). */
export const ROLE_NONE = 'none'

const leafIdsInGroups = (...groupIds) =>
  MENU_LEAF_CATALOG.filter((leaf) => groupIds.includes(leaf.groupId)).map((leaf) => leaf.id)

const DEVICE_MENU_IDS = leafIdsInGroups(MENU_GROUP.LOCAL)

/**
 * Cloud menus per Cognito group, matched to the FR-SW-AUTH-010 staff role of the
 * routes each page calls. The server stays authoritative; a hidden menu only spares
 * the user a 403. Business pages follow Cloud Administrator ⊇ Venue Administrator;
 * fleet pages follow Fleet Administrator ⊇ Field Service Technician.
 */
const VENUE_CLOUD = leafIdsInGroups(MENU_GROUP.OPERATIONS, MENU_GROUP.CONTENT)
/** Usage shows Cloud Administrator only its notification panel (Domain 14). */
const CLOUD_ADMIN_CLOUD = [
  ...VENUE_CLOUD,
  ...leafIdsInGroups(MENU_GROUP.BUSINESS, MENU_GROUP.ADMINISTRATION),
  'usage',
]
/** Commerce shows Fleet Administrator only its Licensing tab (Domain 06). */
const FLEET_ADMIN_CLOUD = [
  ...leafIdsInGroups(MENU_GROUP.DEVICE_FLEET, MENU_GROUP.ANALYTICS, MENU_GROUP.ADMINISTRATION),
  'billing',
]
/** Field Service Technician: support and diagnostics only (Domains 12, 13, 17). */
const TECHNICIAN_CLOUD = ['support', 'diagnostics']
/** Integration Developer: read-only on Domains 03, 04, 09, 10, 11. */
const DEVELOPER_CLOUD = ['reservations', 'users', 'staff', 'sessions', 'usage']

export const ROLE_PERMISSIONS = {
  [ROLE_OPERATOR]: ['dashboard', 'treadmill', 'events'],
  [ROLE_TECHNICIAN]: [...DEVICE_MENU_IDS, ...TECHNICIAN_CLOUD],
  [ROLE_VENUE_ADMIN]: [...DEVICE_MENU_IDS, ...VENUE_CLOUD],
  [ROLE_FLEET_ADMIN]: [...DEVICE_MENU_IDS, ...FLEET_ADMIN_CLOUD],
  [ROLE_CLOUD_ADMIN]: [...DEVICE_MENU_IDS, ...CLOUD_ADMIN_CLOUD],
  [ROLE_DEVELOPER]: DEVELOPER_CLOUD,
  [ROLE_NONE]: [],
}

const GROUP_ROLE = {
  'bandit-cloud-admin': ROLE_CLOUD_ADMIN,
  'bandit-fleet-admin': ROLE_FLEET_ADMIN,
  'bandit-venue-admin': ROLE_VENUE_ADMIN,
  'bandit-account-owner': ROLE_VENUE_ADMIN,
  'bandit-front-desk': ROLE_FRONT_DESK,
  'bandit-technician': ROLE_TECHNICIAN,
  'bandit-developer': ROLE_DEVELOPER,
  'bandit-operator': ROLE_OPERATOR,
}

ROLE_PERMISSIONS[ROLE_FRONT_DESK] = ['reservations', 'users']

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

/**
 * Which sides of FR-SW-AUTH-010 a user can act on, for pages that combine
 * business and fleet routes. Mirrors the server's ownership rule.
 */
export function cloudCapabilities(user) {
  const groups = extractGroupsFromUser(user)
  const has = (g) => groups.includes(g)
  const cloudAdmin = has('bandit-cloud-admin')
  const fleetAdmin = has('bandit-fleet-admin')
  return {
    cloudAdmin,
    fleetAdmin,
    venueAdmin: cloudAdmin || has('bandit-account-owner') || has('bandit-venue-admin'),
    technician: fleetAdmin || has('bandit-technician'),
  }
}
