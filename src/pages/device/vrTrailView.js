/** Trailing VR trail window — not the full session. */
export const POSITION_HISTORY_MAX_DURATION_MS = 3 * 60 * 1000
export const VR_VIEW_MIN_SIZE_M = 10
/** Cap auto-zoom so long trails inside the time window stay readable. */
export const VR_VIEW_MAX_SIZE_M = 30

export function prunePositionHistory(points, nowMs, maxAgeMs = POSITION_HISTORY_MAX_DURATION_MS) {
  const cutoff = nowMs - maxAgeMs
  return (points || []).filter((p) => p.timestamp >= cutoff)
}

/**
 * Follow the user and clamp world extent so distance traveled cannot collapse scale.
 */
export function computeVrTrailViewConfig({
  bounds,
  userX,
  userY,
  panelWidth,
  panelHeight,
  minSizeM = VR_VIEW_MIN_SIZE_M,
  maxSizeM = VR_VIEW_MAX_SIZE_M,
  paddingPx = 40,
}) {
  const rangeX = bounds.maxX - bounds.minX
  const rangeY = bounds.maxY - bounds.minY
  const rawSize = Math.max(rangeX, rangeY, minSizeM)
  const viewSize = Math.min(rawSize, maxSizeM)
  const availableSize = Math.min(panelWidth, panelHeight) - paddingPx * 2
  const scale = availableSize > 0 ? availableSize / viewSize : 1
  return {
    scale,
    viewSize,
    viewCenterX: userX,
    viewCenterY: userY,
    centerX: panelWidth / 2,
    centerY: panelHeight / 2,
  }
}
