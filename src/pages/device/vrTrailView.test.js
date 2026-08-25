import test from 'node:test'
import assert from 'node:assert/strict'
import {
  POSITION_HISTORY_MAX_DURATION_MS,
  VR_VIEW_MAX_SIZE_M,
  VR_VIEW_MIN_SIZE_M,
  computeVrTrailViewConfig,
  prunePositionHistory,
} from './vrTrailView.js'

test('prunePositionHistory keeps only the trailing time window', () => {
  const now = 1_000_000
  const points = [
    { x: 0, y: 0, timestamp: now - POSITION_HISTORY_MAX_DURATION_MS - 1 },
    { x: 1, y: 0, timestamp: now - 60_000 },
    { x: 2, y: 0, timestamp: now },
  ]
  const kept = prunePositionHistory(points, now)
  assert.equal(kept.length, 2)
  assert.equal(kept[0].x, 1)
  assert.equal(kept[1].x, 2)
})

test('computeVrTrailViewConfig clamps long-distance trails to max view size', () => {
  const cfg = computeVrTrailViewConfig({
    bounds: { minX: 0, maxX: 400, minY: -5, maxY: 5 },
    userX: 400,
    userY: 0,
    panelWidth: 600,
    panelHeight: 600,
  })
  assert.equal(cfg.viewSize, VR_VIEW_MAX_SIZE_M)
  assert.equal(cfg.viewCenterX, 400)
  assert.equal(cfg.viewCenterY, 0)
  assert.ok(cfg.scale > 10, `expected readable px/m, got ${cfg.scale}`)
})

test('computeVrTrailViewConfig uses minimum view for short local motion', () => {
  const cfg = computeVrTrailViewConfig({
    bounds: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
    userX: 0,
    userY: 0,
    panelWidth: 600,
    panelHeight: 600,
  })
  assert.equal(cfg.viewSize, VR_VIEW_MIN_SIZE_M)
})
