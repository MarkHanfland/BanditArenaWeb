import { isCloudDeployment } from '../config/runtime.js'
import { MENU_GROUP, MENU_LEAF_CATALOG } from '../nav/consoleMenu.js'

export const ROLE_OPERATOR = 'operator'
export const ROLE_TECHNICIAN = 'technician'
export const ROLE_VENUE_ADMIN = 'venue-admin'
export const ROLE_FLEET_ADMIN = 'fleet-admin'
export const ROLE_CLOUD_ADMIN = 'cloud-admin'
export const ROLE_DEVELOPER = 'developer'
export const ROLE_FRONT_DESK = 'front-desk'
export const ROLE_ACCOUNT_OWNER = 'account-owner'
export const ROLE_BILLING_ADMIN = 'billing-admin'
export const ROLE_ORG_ADMIN = 'org-admin'
export const ROLE_INSTRUCTOR = 'instructor'
export const ROLE_SUPPORT = 'support'
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
  ...leafIdsInGroups(MENU_GROUP.DEVICE_FLEET, MENU_GROUP.ANALYTICS),
  ...leafIdsInGroups(MENU_GROUP.ADMINISTRATION).filter((id) => id !== 'audit'),
  'billing',
  'venue-hours',
]
/** Field Service Technician: support and diagnostics only (Domains 12, 13, 17). */
const TECHNICIAN_CLOUD = ['support', 'diagnostics']
/** Integration Developer: read-only on Domains 03, 04, 09, 10, 11. */
const DEVELOPER_CLOUD = ['reservations', 'users', 'staff', 'sessions', 'usage']
/**
 * FR-SW-AUTH-012 tenant staff roles. Account Owner: every venue page plus agreements and
 * billing and staff delegation, no fleet or catalog writes. Billing Admin: billing only.
 * Front Desk: reservations, check-in, and Player lookup and enrollment.
 */
const ACCOUNT_OWNER_CLOUD = [...VENUE_CLOUD, 'billing', 'usage', 'audit']
const BILLING_ADMIN_CLOUD = ['billing']
const FRONT_DESK_CLOUD = ['reservations', 'users', 'incidents']
const ORG_ADMIN_CLOUD = ['organizations']
const INSTRUCTOR_CLOUD = ['cohorts']
const SUPPORT_CLOUD = []

export const ROLE_PERMISSIONS = {
  [ROLE_OPERATOR]: ['dashboard', 'treadmill', 'events'],
  [ROLE_TECHNICIAN]: [...DEVICE_MENU_IDS, ...TECHNICIAN_CLOUD],
  [ROLE_VENUE_ADMIN]: [...DEVICE_MENU_IDS, ...VENUE_CLOUD],
  [ROLE_FLEET_ADMIN]: [...DEVICE_MENU_IDS, ...FLEET_ADMIN_CLOUD],
  [ROLE_CLOUD_ADMIN]: [...DEVICE_MENU_IDS, ...CLOUD_ADMIN_CLOUD],
  [ROLE_DEVELOPER]: DEVELOPER_CLOUD,
  [ROLE_ACCOUNT_OWNER]: ACCOUNT_OWNER_CLOUD,
  [ROLE_BILLING_ADMIN]: BILLING_ADMIN_CLOUD,
  [ROLE_FRONT_DESK]: FRONT_DESK_CLOUD,
  [ROLE_ORG_ADMIN]: ORG_ADMIN_CLOUD,
  [ROLE_INSTRUCTOR]: INSTRUCTOR_CLOUD,
  [ROLE_SUPPORT]: SUPPORT_CLOUD,
  [ROLE_NONE]: [],
}

const GROUP_ROLE = {
  'bandit-cloud-admin': ROLE_CLOUD_ADMIN,
  'bandit-fleet-admin': ROLE_FLEET_ADMIN,
  'bandit-venue-admin': ROLE_VENUE_ADMIN,
  'bandit-account-owner': ROLE_ACCOUNT_OWNER,
  'bandit-billing-admin': ROLE_BILLING_ADMIN,
  'bandit-front-desk': ROLE_FRONT_DESK,
  'bandit-technician': ROLE_TECHNICIAN,
  'bandit-developer': ROLE_DEVELOPER,
  'bandit-operator': ROLE_OPERATOR,
  'bandit-org-admin': ROLE_ORG_ADMIN,
  'bandit-instructor': ROLE_INSTRUCTOR,
  'bandit-support': ROLE_SUPPORT,
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

/** Highest role, for labels; menus come from every group the user holds (getAllowedMenuIds). */
const ROLE_ORDER = [
  ROLE_CLOUD_ADMIN, ROLE_FLEET_ADMIN, ROLE_ACCOUNT_OWNER, ROLE_VENUE_ADMIN, ROLE_BILLING_ADMIN,
  ROLE_FRONT_DESK, ROLE_INSTRUCTOR, ROLE_TECHNICIAN, ROLE_DEVELOPER, ROLE_ORG_ADMIN,
  ROLE_SUPPORT, ROLE_OPERATOR,
]

/** Roles the user holds, from their Cognito groups. */
export function userRoles(user) {
  const roles = new Set(extractGroupsFromUser(user).map((g) => GROUP_ROLE[g]).filter(Boolean))
  return ROLE_ORDER.filter((r) => roles.has(r))
}

export function deriveUserRole(user) {
  const roles = userRoles(user)
  if (roles.length) return roles[0]
  // FR-SW-UI-014: a cloud user with no staff group sees no cloud menus (fail closed). On a
  // device console with authentication off (lab), the local bypass user is an Operator.
  return isCloudDeployment() ? ROLE_NONE : ROLE_OPERATOR
}

/**
 * FR-SW-UI-018 landing: the first page of the user's primary role. A role not listed lands on
 * its first permitted page. Account Owner lands on Reservations until the onboarding checklist
 * (FR-SW-UI-016) exists. Field Service Technician lands on Support.
 */
const ROLE_LANDING = {
  [ROLE_OPERATOR]: 'dashboard',
  [ROLE_VENUE_ADMIN]: 'dashboard',
  [ROLE_CLOUD_ADMIN]: 'dashboard',
  [ROLE_FRONT_DESK]: 'reservations',
  [ROLE_ACCOUNT_OWNER]: 'reservations',
  [ROLE_BILLING_ADMIN]: 'billing',
  [ROLE_FLEET_ADMIN]: 'fleet',
  [ROLE_TECHNICIAN]: 'support',
}

export function landingMenuId(user) {
  const allowed = getAllowedMenuIds(user)
  const leaves = new Map(MENU_LEAF_CATALOG.map((leaf) => [leaf.id, leaf]))
  const usable = (id) => allowed.includes(id) && leaves.get(id)?.implemented !== false
  const wanted = ROLE_LANDING[deriveUserRole(user)]
  if (wanted && usable(wanted)) return wanted
  return MENU_LEAF_CATALOG.find((leaf) => usable(leaf.id))?.id || null
}

/** FR-SW-UI-014: the union of the menus every one of the user's roles permits. */
export function getAllowedMenuIds(user) {
  const roles = userRoles(user)
  const effective = roles.length ? roles : [deriveUserRole(user)]
  return [...new Set(effective.flatMap((r) => ROLE_PERMISSIONS[r] || []))]
}

/**
 * FR-SW-UI-014 (device chrome): true when the user holds any Local Device menu. Only these
 * roles see the device status band (Player/Media, speeds, Start Session) and the header
 * Safety Stop. Front Desk, Account Owner, Billing Admin, and Integration Developer have no
 * Local Device menu, so those controls are hidden rather than shown disabled.
 */
export function canOperateDevice(user) {
  const allowed = new Set(getAllowedMenuIds(user))
  return DEVICE_MENU_IDS.some((id) => allowed.has(id))
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
  const accountOwner = cloudAdmin || has('bandit-account-owner')
  return {
    cloudAdmin,
    fleetAdmin,
    accountOwner,
    billingAdmin: accountOwner || has('bandit-billing-admin'),
    venueAdmin: accountOwner || has('bandit-venue-admin'),
    frontDesk: accountOwner || has('bandit-venue-admin') || has('bandit-front-desk'),
    technician: fleetAdmin || has('bandit-technician'),
  }
}
