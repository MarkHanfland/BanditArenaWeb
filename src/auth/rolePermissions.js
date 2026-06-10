import React from 'react'
import { isCloudDeployment } from '../config/runtime'

export const ROLE_OPERATOR = 'operator'
export const ROLE_TECHNICIAN = 'technician'
export const ROLE_VENUE_ADMIN = 'venue-admin'

const DEVICE_MENU_IDS = ['dashboard', 'user', 'treadmill', 'services', 'events', 'config']
const CLOUD_MENU_IDS = ['content', 'users', 'reservations', 'billing', 'usage', 'fleet', 'maintenance']

export const ROLE_PERMISSIONS = {
  [ROLE_OPERATOR]: ['dashboard', 'user', 'treadmill', 'events'],
  [ROLE_TECHNICIAN]: [
    'dashboard',
    'user',
    'treadmill',
    'services',
    'events',
    'config',
    'content',
    'usage',
    'maintenance',
  ],
  [ROLE_VENUE_ADMIN]: [...DEVICE_MENU_IDS, ...CLOUD_MENU_IDS],
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
  if (
    groups.includes('bandit-venue-admin') ||
    groups.includes('bandit-cloud-admin') ||
    groups.includes('bandit-fleet-admin') ||
    groups.includes('bandit-developer')
  ) {
    return ROLE_VENUE_ADMIN
  }
  if (groups.includes('bandit-technician')) {
    return ROLE_TECHNICIAN
  }
  if (groups.includes('bandit-operator')) {
    return ROLE_OPERATOR
  }
  return ROLE_OPERATOR
}

export function getAllowedMenuIds(user) {
  const role = deriveUserRole(user)
  const ids = [...(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[ROLE_OPERATOR])]

  // banditarena.com is the unified cloud console — show cloud navigation for all signed-in users.
  if (isCloudDeployment()) {
    for (const cloudId of CLOUD_MENU_IDS) {
      if (!ids.includes(cloudId)) {
        ids.push(cloudId)
      }
    }
  }

  return ids
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
