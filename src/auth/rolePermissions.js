import React from 'react'
import { isCloudDeployment } from '../config/runtime'

export const ROLE_OPERATOR = 'operator'
export const ROLE_TECHNICIAN = 'technician'
export const ROLE_VENUE_ADMIN = 'venue-admin'
export const ROLE_FLEET_ADMIN = 'fleet-admin'
export const ROLE_CLOUD_ADMIN = 'cloud-admin'

const DEVICE_MENU_IDS = ['dashboard', 'user', 'treadmill', 'services', 'events', 'config']

/** Menus for purchase / install / operate lifecycle by Cognito role. */
const ORG_AND_FLEET = ['organizations', 'fleet', 'staff', 'maintenance']
const VENUE_OPS = ['media', 'users', 'reservations', 'usage', ...ORG_AND_FLEET]

export const ROLE_PERMISSIONS = {
  [ROLE_OPERATOR]: ['dashboard', 'user', 'treadmill', 'events'],
  [ROLE_TECHNICIAN]: [
    'dashboard',
    'user',
    'treadmill',
    'services',
    'events',
    'config',
    'media',
    'usage',
    'maintenance',
  ],
  [ROLE_VENUE_ADMIN]: [...DEVICE_MENU_IDS, ...VENUE_OPS],
  [ROLE_FLEET_ADMIN]: [...DEVICE_MENU_IDS, ...VENUE_OPS, 'billing'],
  [ROLE_CLOUD_ADMIN]: [...DEVICE_MENU_IDS, ...VENUE_OPS, 'billing'],
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
