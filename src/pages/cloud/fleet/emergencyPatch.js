export const PATCH_SCOPE = {
  DEVICE: 'device',
  VENUE: 'venue',
  TENANT: 'tenant',
}

/**
 * FR-SW-SVC-007. One device or one venue can be queued on the first submit.
 * A patch of every device in the tenant stays unsent until fleetScopeConfirmed is true.
 */
export function planEmergencyPatch({
  scope,
  instanceId,
  venueId,
  targetVersion,
  reason,
  fleetScopeConfirmed = false,
} = {}) {
  const version = typeof targetVersion === 'string' ? targetVersion.trim() : ''
  const auditReason = typeof reason === 'string' ? reason.trim() : ''
  if (!version) {
    return { send: false, status: 400, error: 'targetVersion is required' }
  }
  if (!auditReason) {
    return { send: false, status: 400, error: 'reason is required' }
  }

  if (scope === PATCH_SCOPE.DEVICE) {
    if (!instanceId) return { send: false, status: 400, error: 'instanceId is required' }
    return {
      send: true,
      status: 202,
      route: '/updates/emergency-patch',
      payload: { instanceId, targetVersion: version, reason: auditReason },
    }
  }

  if (scope === PATCH_SCOPE.VENUE) {
    if (!venueId) return { send: false, status: 400, error: 'venueId is required' }
    return {
      send: true,
      status: 202,
      route: '/admin/firmware-push',
      payload: { venueId, targetVersion: version, reason: auditReason },
    }
  }

  if (scope === PATCH_SCOPE.TENANT) {
    if (fleetScopeConfirmed !== true) {
      return {
        send: false,
        status: 400,
        error: 'A patch of every device in the tenant requires a second confirmation of fleet scope',
      }
    }
    return {
      send: true,
      status: 202,
      route: '/admin/firmware-push',
      payload: {
        targetVersion: version,
        reason: auditReason,
        fleetScopeConfirmed: true,
      },
    }
  }

  return { send: false, status: 400, error: 'scope is required' }
}
