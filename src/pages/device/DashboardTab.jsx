import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Box, CircularProgress, Alert, Typography, Button } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { getConfig, getTelemetryCurrent } from '../../api/device'
import { usePlayerSession } from '../../session/PlayerSessionContext'
import {
  POSITION_HISTORY_MAX_DURATION_MS,
  computeVrTrailViewConfig,
  prunePositionHistory,
} from './vrTrailView'

const POSITION_HISTORY_PRUNE_INTERVAL_MS = 5000
const USER_STATUS_FALL = 2
const TRAIL_COLOR_SAFE = '#4db6c4'
const TRAIL_COLOR_WARNING = '#ffeb3b'
const DEFAULT_BOUNDARY_WARNING_RADIUS_M = 1.0
const DEFAULT_BOUNDARY_VIOLATION_RADIUS_M = 1.4

function safetyBoundaryRadii(config) {
  let warning = DEFAULT_BOUNDARY_WARNING_RADIUS_M
  let violation = DEFAULT_BOUNDARY_VIOLATION_RADIUS_M
  const safety = (config?.services || []).find((s) => s.name === 'SafetyController')
  const props = safety?.properties || {}
  if (props.boundary_warning_radius != null && props.boundary_warning_radius !== '') {
    warning = Number(props.boundary_warning_radius)
  }
  if (props.boundary_violation_radius != null && props.boundary_violation_radius !== '') {
    violation = Number(props.boundary_violation_radius)
  }
  return { warning, violation }
}

function trailPathFromPoints(points, worldToSvg) {
  if (!points || points.length < 2) {
    return ''
  }
  const mapped = points.map((p) => worldToSvg(p.x, p.y))
  let d = `M ${mapped[0].x} ${mapped[0].y}`
  for (let i = 1; i < mapped.length; i++) {
    d += ` L ${mapped[i].x} ${mapped[i].y}`
  }
  return d
}

// Zoom-invariant UI scales (baseline sizes rendered at 100% zoom)
const BASELINE_ICON_PX = 10
const TREAD_HEX_SCALE = 1.5 // 25% smaller than original 2.0 — tread surface hex tile size
const USER_ICON_SCALE = 1.75
const REFERENCE_VIEW_SIZE = 600
/**
 * User marker radius as a fraction of tread surface (inner) radius.
 * ~0.095 matches the prior ~17.5px look at a 600px panel while tracking tread scale.
 */
const USER_MARKER_INNER_RADIUS_FRAC = 0.095
const USER_MARKER_MIN_PX = 12
const USER_MARKER_MAX_INNER_FRAC = 0.12
const COMPASS_NATIVE_SIZE = 100
/** Single 3D cylinder (2 tall × 30 circumference) + values then pitch/roll labels. */
const GRADE_NATIVE_WIDTH = 176
const GRADE_NATIVE_HEIGHT = 110
/**
 * Clearance is against the tread *surface* (inner circle), not the outer wall.
 * Corner widgets may overlap the dark safety-wall ring — that ring is visual
 * padding — but must stay off the tread disk.
 */
const TREAD_SURFACE_GAP_PX = 6
const TREAD_GRAPHIC_SIDE_INSET = 15 // extra margin each side around tread circle
const TREAD_VIEW_PADDING = 40 + TREAD_GRAPHIC_SIDE_INSET
const CORNER_MARGIN = 10
/** Modest pad for label overflow; oversized pads were crushing visual scale. */
const COMPASS_LABEL_PAD = 8
const GRADE_LABEL_PAD = 6
const COMPASS_PACK_SIZE = COMPASS_NATIVE_SIZE + COMPASS_LABEL_PAD
const GRADE_PACK_WIDTH = GRADE_NATIVE_WIDTH + GRADE_LABEL_PAD
const GRADE_PACK_HEIGHT = GRADE_NATIVE_HEIGHT + GRADE_LABEL_PAD
const CORNER_FILL = 1.0
const COMPASS_CORNER_MARGIN = CORNER_MARGIN
const COMPASS_LEFT_MARGIN = CORNER_MARGIN + TREAD_GRAPHIC_SIDE_INSET
const GRADE_CORNER_MARGIN = CORNER_MARGIN
/** Flush to the canvas corner (tighter than compass — no side inset). */
const GRADE_LEFT_MARGIN = 2
const GRADE_MAX_DEG = 8
const GRADE_CIRCUMFERENCE = 30 // model units (was 10; tripled)
const GRADE_UNIT_PX = 8 // 1 model unit → pixels (cylinder: height 2, circumference 30)
/** Match dashboard cyan highlight (user marker / status blue). */
const GRADE_STROKE = '#00e5ff'
const GRADE_LABEL_FILL = 'rgba(0, 229, 255, 0.85)'
/** Body fills desaturated (~20% of prior saturation on dark cyan). */
const GRADE_FILL = 'rgba(14, 19, 20, 0.66)'
const GRADE_FILL_TOP = 'rgba(14, 19, 20, 0.96)'
const GRADE_VALUE_FONT_SIZE = 10.4 // 13 × 0.8
const toGradePct = (deg) => Math.tan(deg * Math.PI / 180) * 100

function formatGradePct(pct) {
  const abs = Math.abs(pct)
  const sign = pct < 0 ? '−' : ''
  return `${sign}${abs.toFixed(1)}%`
}

function rotX3(p, a) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }
}

function rotZ3(p, a) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }
}

/**
 * Perspective 3D cylinder: height 2, circumference 30 (radius = 30/2π).
 *
 * Rest pose: camera behind the belt looking forward, elevated so the circular
 * ends foreshorten. Pitch/roll are applied in *view space* afterward so:
 *   +pitch → tip straight toward the viewer (no sideways lean when roll=0)
 *   −pitch → tip straight away
 *   +roll  → tip right; −roll → tip left
 */
function GradeCylinderGizmo({ pitchDeg, rollDeg, cx, cy }) {
  const radius = (GRADE_CIRCUMFERENCE / (2 * Math.PI)) * GRADE_UNIT_PX
  const halfH = (2 * GRADE_UNIT_PX) / 2
  const ringN = 48
  // Amplify ±8° physical so the tilt is readable in the small gizmo.
  const visAmp = (32 / GRADE_MAX_DEG) * (Math.PI / 180)
  const pitch = Math.max(-GRADE_MAX_DEG, Math.min(GRADE_MAX_DEG, pitchDeg)) * visAmp
  const roll = Math.max(-GRADE_MAX_DEG, Math.min(GRADE_MAX_DEG, rollDeg)) * visAmp

  // Elevation only (no yaw): pitch then reads as pure toward/away on screen.
  // Ends still foreshorten from the look-down angle + cylinder curvature.
  const viewElev = 28 * (Math.PI / 180)
  const focal = 140

  const project = (p) => {
    // 1) Rest camera: behind looking along +Z, slightly down.
    let q = rotX3(p, -viewElev)
    // 2) View-space pitch: tip toward (−) / away (+) along screen vertical.
    q = rotX3(q, -pitch)
    // 3) View-space roll: tip right (+) / left (−) along screen horizontal.
    q = rotZ3(q, -roll)
    const w = focal / (focal + q.z)
    return { x: cx + q.x * w, y: cy - q.y * w, z: q.z }
  }

  const top = []
  const bot = []
  for (let i = 0; i < ringN; i += 1) {
    const a = (i / ringN) * Math.PI * 2
    const x = Math.cos(a) * radius
    const z = Math.sin(a) * radius
    top.push(project({ x, y: halfH, z }))
    bot.push(project({ x, y: -halfH, z }))
  }

  // Convex hull of all projected rim points → clean body silhouette under tilt.
  const hull = (() => {
    const pts = [...top, ...bot].map((p) => ({ x: p.x, y: p.y }))
    pts.sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
    const lower = []
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop()
      }
      lower.push(p)
    }
    const upper = []
    for (let i = pts.length - 1; i >= 0; i -= 1) {
      const p = pts[i]
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop()
      }
      upper.push(p)
    }
    lower.pop()
    upper.pop()
    return lower.concat(upper)
  })()

  const poly = (pts) => pts.map((p) => `${p.x},${p.y}`).join(' ')
  const topMeanZ = top.reduce((s, p) => s + p.z, 0) / top.length
  const botMeanZ = bot.reduce((s, p) => s + p.z, 0) / bot.length
  const drawTopFirst = topMeanZ > botMeanZ

  const endPoly = (pts, fill) => (
    <polygon
      points={poly(pts)}
      fill={fill}
      stroke={GRADE_STROKE}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  )

  return (
    <g>
      <polygon
        points={poly(hull)}
        fill={GRADE_FILL}
        stroke={GRADE_STROKE}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {drawTopFirst ? (
        <>
          {endPoly(bot, GRADE_FILL)}
          {endPoly(top, GRADE_FILL_TOP)}
        </>
      ) : (
        <>
          {endPoly(top, GRADE_FILL_TOP)}
          {endPoly(bot, GRADE_FILL)}
        </>
      )}
    </g>
  )
}

// GradeIndicator — one 3D cylinder; values with pitch/roll labels underneath.
function GradeIndicator({
  rollDeg,
  pitchDeg,
  scale = 1,
  left = GRADE_LEFT_MARGIN,
  bottom = GRADE_CORNER_MARGIN,
}) {
  const W = GRADE_NATIVE_WIDTH
  const H = GRADE_NATIVE_HEIGHT

  const pitchPct = toGradePct(pitchDeg)
  const rollPct = toGradePct(rollDeg)
  const pitchLabel = formatGradePct(pitchPct)
  const rollLabel = formatGradePct(rollPct)

  // Bias content left so the gizmo sits in the canvas corner.
  const pitchCx = 28
  const rollCx = 100
  const cylCx = 64
  const cylCy = 30
  const valueY = 74
  const labelY = 90

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom,
        left,
        zIndex: 100,
        pointerEvents: 'none',
        transform: `scale(${scale})`,
        transformOrigin: 'bottom left',
      }}
      data-testid="dashboard-grade-indicator"
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="visible">
        <GradeCylinderGizmo
          pitchDeg={pitchDeg}
          rollDeg={rollDeg}
          cx={cylCx}
          cy={cylCy}
        />

        <text
          x={pitchCx}
          y={valueY}
          fill={GRADE_STROKE}
          fontSize={GRADE_VALUE_FONT_SIZE}
          fontFamily="Montserrat, sans-serif"
          fontWeight="700"
          textAnchor="middle"
          data-testid="dashboard-grade-pitch"
        >
          {pitchLabel}
        </text>
        <text
          x={pitchCx}
          y={labelY}
          fill={GRADE_LABEL_FILL}
          fontSize="8"
          fontFamily="Montserrat, sans-serif"
          fontWeight="600"
          textAnchor="middle"
        >
          PITCH
        </text>

        <text
          x={rollCx}
          y={valueY}
          fill={GRADE_STROKE}
          fontSize={GRADE_VALUE_FONT_SIZE}
          fontFamily="Montserrat, sans-serif"
          fontWeight="700"
          textAnchor="middle"
          data-testid="dashboard-grade-roll"
        >
          {rollLabel}
        </text>
        <text
          x={rollCx}
          y={labelY}
          fill={GRADE_LABEL_FILL}
          fontSize="8"
          fontFamily="Montserrat, sans-serif"
          fontWeight="600"
          textAnchor="middle"
        >
          ROLL
        </text>
      </svg>
    </Box>
  )
}

/**
 * Largest CSS scale for a W×H packing box anchored in a canvas corner such that
 * the box stays outside the tread surface circle (plus gap).
 *
 * UL: box grows down/right from (marginX, marginY) — transform-origin top left
 * LL: box grows up/right from (marginX, panelHeight - marginY) — origin bottom left
 *
 * Clearance is tested at the box corner nearest the tread center.
 */
function maxScaleForCornerBox({
  corner,
  panelWidth,
  panelHeight,
  circleCx,
  circleCy,
  circleR,
  gap = TREAD_SURFACE_GAP_PX,
  marginX,
  marginY,
  packWidth,
  packHeight,
  fill = CORNER_FILL,
}) {
  const clearance = circleR + gap
  if (packWidth <= 0 || packHeight <= 0 || clearance <= 0) {
    return 0.5
  }

  const maxScaleByPanel = Math.min(
    (panelWidth - marginX) / packWidth,
    (panelHeight - marginY) / packHeight,
  )

  let lo = 0
  let hi = Math.max(0, maxScaleByPanel)

  for (let i = 0; i < 48; i += 1) {
    const scale = (lo + hi) / 2
    const x = marginX + packWidth * scale
    const y = corner === 'ul' ? marginY + packHeight * scale : panelHeight - marginY - packHeight * scale
    const distance = Math.hypot(x - circleCx, y - circleCy)

    if (distance >= clearance) {
      lo = scale
    } else {
      hi = scale
    }
  }

  return Math.max(0.5, lo * fill)
}


// Under counteract these are typically opposite; do not prefer body facing here —
// facing often aligns with centering push when the player is behind center.
function DirectionCompass({
  treadDirection,
  userDirection,
  treadSpeed,
  userSpeed,
  scale = 1,
  left = COMPASS_LEFT_MARGIN,
  top = COMPASS_CORNER_MARGIN,
}) {
  const compassSize = 100
  const center = compassSize / 2
  const outerRadius = 42
  const innerRadius = 28

  // Calculate angles (convert from Bandit coords to compass coords)
  // Bandit: +X=right, +Y=forward. Compass: 0°=up (forward), 90°=right
  const treadAngle = useMemo(() => {
    const x = treadDirection?.x || 0
    const y = treadDirection?.y || 0
    if (Math.abs(x) < 0.001 && Math.abs(y) < 0.001) return null
    // atan2(x, y) gives angle from +Y axis (forward) clockwise
    return Math.atan2(x, y) * 180 / Math.PI
  }, [treadDirection])

  const userAngle = useMemo(() => {
    const x = userDirection?.x || 0
    const y = userDirection?.y || 0
    if (Math.abs(x) < 0.001 && Math.abs(y) < 0.001) return null
    return Math.atan2(x, y) * 180 / Math.PI
  }, [userDirection])

  // Show tread only when belt is moving; show user whenever a direction is known
  const showTread = treadSpeed > 0.05 && treadAngle !== null
  const showUser = userAngle !== null

  // Compute label position at the tip of each arrow in world-space (text stays upright)
  const getLabelPos = (angleDeg, r) => {
    const rad = angleDeg * Math.PI / 180
    const sina = Math.sin(rad)
    const cosa = Math.cos(rad)
    return {
      x: center + r * sina,
      y: center - r * cosa,
      anchor: sina > 0.3 ? 'start' : sina < -0.3 ? 'end' : 'middle',
      baseline: cosa > 0.3 ? 'auto' : cosa < -0.3 ? 'hanging' : 'middle'
    }
  }
  const treadLabelPos = showTread ? getLabelPos(treadAngle, outerRadius + 6) : null
  const userLabelPos  = showUser  ? getLabelPos(userAngle,  innerRadius + 9) : null

  return (
    <Box sx={{
      position: 'absolute',
      top,
      left,
      zIndex: 100,
      pointerEvents: 'none',
      transform: `scale(${scale})`,
      transformOrigin: 'top left'
    }}>
      <svg width={compassSize} height={compassSize} viewBox={`0 0 ${compassSize} ${compassSize}`} overflow="visible">
        <defs>
          {/* Outer ring gradient - tread color (green) */}
          <linearGradient id="compassOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00d4aa" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#00b894" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00d4aa" stopOpacity="0.8" />
          </linearGradient>

          {/* Inner ring gradient - user color (lighter aqua) */}
          <linearGradient id="compassInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#00bcd4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.8" />
          </linearGradient>

          {/* Glow filters */}
          <filter id="treadGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="userGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={outerRadius + 4}
          fill="rgba(0,0,0,0.6)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />

        {/* Outer ring track (tread) */}
        <circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="none"
          stroke="rgba(176,190,197,0.45)"
          strokeWidth="8"
        />

        {/* Inner ring track (user) */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke="rgba(0,229,255,0.15)"
          strokeWidth="6"
        />

        {/* Cardinal direction marks */}
        {['N', 'E', 'S', 'W'].map((dir, i) => {
          const angle = i * 90 - 90 // N=up, E=right, S=down, W=left
          const rad = angle * Math.PI / 180
          const x = center + Math.cos(rad) * (outerRadius + 12)
          const y = center + Math.sin(rad) * (outerRadius + 12)
          return (
            <text
              key={dir}
              x={x}
              y={y}
              fill="#555"
              fontSize="8"
              fontFamily="Montserrat, sans-serif"
              fontWeight="600"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {dir === 'N' ? '▲' : dir === 'S' ? '▼' : dir === 'E' ? '►' : '◄'}
            </text>
          )
        })}

        {/* Tick marks every 30 degrees */}
        {[...Array(12)].map((_, i) => {
          const angle = i * 30 - 90
          const rad = angle * Math.PI / 180
          const isMajor = i % 3 === 0
          const innerR = outerRadius - (isMajor ? 5 : 3)
          const outerR = outerRadius
          return (
            <line
              key={i}
              x1={center + Math.cos(rad) * innerR}
              y1={center + Math.sin(rad) * innerR}
              x2={center + Math.cos(rad) * outerR}
              y2={center + Math.sin(rad) * outerR}
              stroke={isMajor ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)"}
              strokeWidth={isMajor ? 2 : 1}
            />
          )
        })}

        {/* Tread direction indicator (outer ring) */}
        {showTread && (
          <g transform={`rotate(${treadAngle}, ${center}, ${center})`} filter="url(#treadGlow)">
            {/* Arrow pointing up (forward direction) */}
            <path
              d={`M ${center} ${center - outerRadius + 3} 
                  L ${center - 6} ${center - outerRadius + 12} 
                  L ${center - 2} ${center - outerRadius + 10}
                  L ${center - 2} ${center - outerRadius + 18}
                  L ${center + 2} ${center - outerRadius + 18}
                  L ${center + 2} ${center - outerRadius + 10}
                  L ${center + 6} ${center - outerRadius + 12} Z`}
              fill="#00d4aa"
              stroke="#00ffcc"
              strokeWidth="1"
            />
          </g>
        )}

        {/* User direction indicator (inner ring) */}
        {showUser && (
          <g transform={`rotate(${userAngle}, ${center}, ${center})`} filter="url(#userGlow)">
            {/* Smaller arrow for user */}
            <path
              d={`M ${center} ${center - innerRadius + 2} 
                  L ${center - 5} ${center - innerRadius + 10} 
                  L ${center - 1.5} ${center - innerRadius + 8}
                  L ${center - 1.5} ${center - innerRadius + 14}
                  L ${center + 1.5} ${center - innerRadius + 14}
                  L ${center + 1.5} ${center - innerRadius + 8}
                  L ${center + 5} ${center - innerRadius + 10} Z`}
              fill="#00e5ff"
              stroke="#66ffff"
              strokeWidth="1"
            />
          </g>
        )}

        {/* Center dot */}
        <circle
          cx={center}
          cy={center}
          r="3"
          fill="#444"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />

        {/* Tread label — travels to the tip of the tread arrow */}
        {treadLabelPos && (
          <text
            x={treadLabelPos.x}
            y={treadLabelPos.y}
            fill="#00d4aa"
            fontSize="7"
            fontFamily="Montserrat, sans-serif"
            fontWeight="700"
            textAnchor={treadLabelPos.anchor}
            dominantBaseline={treadLabelPos.baseline}
          >
            TREAD
          </text>
        )}

        {/* User label — travels to the tip of the user arrow */}
        {userLabelPos && (
          <text
            x={userLabelPos.x}
            y={userLabelPos.y}
            fill="#00e5ff"
            fontSize="7"
            fontFamily="Montserrat, sans-serif"
            fontWeight="700"
            textAnchor={userLabelPos.anchor}
            dominantBaseline={userLabelPos.baseline}
          >
            USER
          </text>
        )}
      </svg>
    </Box>
  )
}

function DashboardTab() {
  const { sessionActive } = usePlayerSession()
  const [config, setConfig] = useState(null)
  const [treadmillState, setTreadmillState] = useState(null)
  const [userState, setUserState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [apiConnected, setApiConnected] = useState(true)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)
  const [animationOffset, setAnimationOffset] = useState({ x: 0, y: 0, linearOffset: 0, directionAngle: 0 })
  const containerRef = useRef(null)
  const canvasContainerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 })
  const animationRef = useRef(null)
  const lastTimeRef = useRef(performance.now())
  const treadmillStateRef = useRef(null)
  const lastNonZeroUserDirRef = useRef({ x: 0, y: 1 })
  const hexScaleRef = useRef(TREAD_HEX_SCALE)
  const prevUiScaleRef = useRef(1)
  const sessionActiveRef = useRef(sessionActive)

  // Scale overlays and tread hex tiles relative to the current viewer size.
  const uiScale = useMemo(() => {
    const size = Math.min(dimensions.width, dimensions.height)
    if (size <= 0) {
      return 1
    }
    return size / REFERENCE_VIEW_SIZE
  }, [dimensions.width, dimensions.height])

  const MAX_CONSECUTIVE_FAILURES = 5 // Show disconnected state after 5 consecutive failures

  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await getConfig()
      if (error) {
        setError(error)
      } else {
        setConfig(data)
        setError(null)
      }
      setLoading(false)
    }
    fetchConfig()
  }, [])

  // Fetch telemetry (combined treadmill and user status)
  const fetchStatus = async () => {
    const { data, error: fetchError, noContent } = await getTelemetryCurrent()
    if (fetchError) {
      console.error('Dashboard fetch error:', fetchError)
      setConsecutiveFailures(prev => {
        const newCount = prev + 1
        if (newCount >= MAX_CONSECUTIVE_FAILURES) {
          setApiConnected(false)
        }
        return newCount
      })
    } else if (noContent) {
      // Idle / post-session: no samples — clear stale motion so the tread surface stops.
      setTreadmillState(null)
      setUserState(null)
      setConsecutiveFailures(0)
      setApiConnected(true)
    } else if (data) {
      // Reset failure count
      setConsecutiveFailures(0)
      setApiConnected(true)
      // Ignore motion samples outside an active player session (prevents post-end scroll).
      if (!sessionActiveRef.current) {
        setTreadmillState(null)
        setUserState(null)
        return
      }
      // Map telemetry data to treadmill state format expected by UI
      if (data.tread) {
        const treadSpeed = data.tread.speed || 0
        const treadDir = data.tread.dir || { x: 0, y: 0 }
        setTreadmillState({
          treadVelocity: data.tread.vel,
          treadSpeed: treadSpeed,
          treadDirection: treadDir,
          treadTilt: data.tread.tilt,
          treadmillState: data.tread.state,
          avatarVirtualVelocity: data.avatar?.vel
        })
      }
      // Map telemetry data to user state format expected by UI
      if (data.user) {
        const velX = data.user.vel?.x || 0
        const velY = data.user.vel?.y || 0
        setUserState({
          userPosition: data.user.pos,
          userVelocity: data.user.vel,
          userFacingDirection: data.user.facing,
          userSpeed: data.user.speed ?? Math.sqrt(velX * velX + velY * velY),
          virtualSpeed: data.user.virtualSpeed || 0,
          userStatus: data.user.status,
          distanceFromCenter: data.user.dist,
          unboundedPosition: data.avatar?.pos  // Avatar position is the unbounded/virtual world position
        })
      }
    } else {
      console.warn('Dashboard: Unexpected state - no data, no error, no noContent flag')
    }
  }

  // Keep latest treadmill state in a ref so the animation loop doesn't restart on every poll
  useEffect(() => {
    treadmillStateRef.current = treadmillState
  }, [treadmillState])

  // Stop tread surface scroll immediately when the player session ends (don't wait on telemetry).
  useEffect(() => {
    sessionActiveRef.current = sessionActive
    if (!sessionActive) {
      setTreadmillState(null)
      setUserState(null)
    }
  }, [sessionActive])

  // Fetch telemetry periodically
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 100) // Update 10 times per second for smooth animation
    return () => clearInterval(interval)
  }, [])

  // Animation loop for tread pattern - continuous scrolling based on tread direction and speed
  // IMPORTANT: this must not restart on every telemetry poll, so it reads treadmill state from a ref
  // Reads hexScaleRef each frame so tile size stays correct across browser zoom changes.
  useEffect(() => {
    if (!config) return

    const mod = (n, m) => ((n % m) + m) % m

    lastTimeRef.current = performance.now()

    const animate = (currentTime) => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000
      lastTimeRef.current = currentTime

      const state = sessionActiveRef.current ? treadmillStateRef.current : null
      const speed = state?.treadSpeed || 0
      const dirX = state?.treadDirection?.x || 0
      const dirY = state?.treadDirection?.y || 0

      // Calculate velocity in SVG coords
      // Bandit coords: +X=right, +Y=forward -> SVG: +X=right, +Y=down (flip Y)
      // The tread direction vector points where user gets PUSHED
      // The hexagons should move in the SAME direction (belt surface moves with user)
      const svgVelX = dirX * speed
      const svgVelY = -dirY * speed

      if (speed > 0.001) {
        setAnimationOffset(prev => {
          const hexScale = hexScaleRef.current
          const tileWidth = 90 * hexScale
          const tileHeight = 78 * hexScale
          const pixelsPerMeter = tileWidth
          const newX = mod(prev.x + svgVelX * pixelsPerMeter * deltaTime, tileWidth)
          const newY = mod(prev.y + svgVelY * pixelsPerMeter * deltaTime, tileHeight)
          return {
            ...prev,
            x: newX,
            y: newY
          }
        })
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [config])

  // When viewer size changes, rescale hex tile period so tread animation stays continuous.
  useEffect(() => {
    const newHexScale = TREAD_HEX_SCALE * uiScale
    const oldHexScale = hexScaleRef.current
    if (newHexScale !== oldHexScale && oldHexScale > 0) {
      const ratio = newHexScale / oldHexScale
      setAnimationOffset(prev => ({ ...prev, x: prev.x * ratio, y: prev.y * ratio }))
      hexScaleRef.current = newHexScale
      prevUiScaleRef.current = uiScale
    }
  }, [uiScale])

  // Handle container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect()
        const size = Math.min(rect.width - 20, rect.height - 20)
        setDimensions({ width: size, height: size })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [loading])

  // Calculate SVG dimensions based on config
  const svgConfig = useMemo(() => {
    if (!config?.tread) return null

    const treadDiameter = config.tread.diameter_meters
    const safetyWallThickness = config.tread.safety_wall_thickness_meters || 0.5
    const outerDiameter = treadDiameter + (safetyWallThickness * 2)

    // Calculate pixel scale to fit in container with padding (+15px side inset for corner overlays)
    const padding = TREAD_VIEW_PADDING
    const availableSize = Math.min(dimensions.width, dimensions.height) - padding * 2
    const scale = availableSize / outerDiameter

    const outerRadius = (outerDiameter / 2) * scale
    const innerRadius = (treadDiameter / 2) * scale

    return {
      outerRadius,
      innerRadius,
      scale,
      treadDiameter,
      safetyWallThickness,
      outerDiameter,
      centerX: dimensions.width / 2,
      centerY: dimensions.height / 2
    }
  }, [config, dimensions])

  // Marker size tracks the tread disk (meters→px), not panel uiScale alone.
  // uiScale previously made the icon grow/shrink with the viewer while the tread
  // diameter mapping used a different scale, so the user looked wrong on the belt.
  const treadUserIconSize = useMemo(() => {
    if (!svgConfig?.innerRadius) {
      return BASELINE_ICON_PX * USER_ICON_SCALE
    }
    const fromTread = svgConfig.innerRadius * USER_MARKER_INNER_RADIUS_FRAC
    const maxPx = svgConfig.innerRadius * USER_MARKER_MAX_INNER_FRAC
    return Math.max(USER_MARKER_MIN_PX, Math.min(fromTread, maxPx))
  }, [svgConfig])

  const cornerOverlayLayout = useMemo(() => {
    if (!svgConfig) {
      return null
    }

    const { centerX, centerY, innerRadius } = svgConfig
    const panelWidth = dimensions.width
    const panelHeight = dimensions.height

    return {
      compass: {
        left: COMPASS_LEFT_MARGIN,
        top: COMPASS_CORNER_MARGIN,
        scale: maxScaleForCornerBox({
          corner: 'ul',
          panelWidth,
          panelHeight,
          circleCx: centerX,
          circleCy: centerY,
          // Fit into corner + safety-wall ring; keep off tread surface.
          circleR: innerRadius,
          marginX: COMPASS_LEFT_MARGIN,
          marginY: COMPASS_CORNER_MARGIN,
          packWidth: COMPASS_PACK_SIZE,
          packHeight: COMPASS_PACK_SIZE,
        }),
      },
      grade: {
        left: GRADE_LEFT_MARGIN,
        bottom: GRADE_CORNER_MARGIN,
        scale: maxScaleForCornerBox({
          corner: 'll',
          panelWidth,
          panelHeight,
          circleCx: centerX,
          circleCy: centerY,
          circleR: innerRadius,
          marginX: GRADE_LEFT_MARGIN,
          marginY: GRADE_CORNER_MARGIN,
          packWidth: GRADE_PACK_WIDTH,
          packHeight: GRADE_PACK_HEIGHT,
        }),
      },
    }
  }, [svgConfig, dimensions.width, dimensions.height])

  // Calculate user position in SVG coordinates
  const userPosition = useMemo(() => {
    if (!userState?.userPosition || !svgConfig) return null

    // User position is in meters from center
    // Bandit coordinate system: +X=right, +Y=forward (away from camera)
    // SVG coordinate system: +X=right, +Y=down
    // So we need to flip Y: SVG_Y = -Bandit_Y
    const x = userState.userPosition.x * svgConfig.scale
    const y = -userState.userPosition.y * svgConfig.scale // Flip Y for SVG (Y-forward to Y-down)

    return { x, y }
  }, [userState, svgConfig])

  // Derive a stable, correct user direction vector for UI arrows.
  // Priority:
  //  1) avatarVirtualVelocity (matches VR movement)
  //  2) userVelocity
  //  3) userFacingDirection (pose)
  const userDirectionVectorForUi = useMemo(() => {
    const avatarVel = treadmillState?.avatarVirtualVelocity
    const userVel = userState?.userVelocity
    const facing = userState?.userFacingDirection

    const pickFromVelocity = (vel) => {
      const x = vel?.x || 0
      const y = vel?.y || 0
      const mag = Math.sqrt(x * x + y * y)
      if (mag > 0.05) {
        const dir = { x: x / mag, y: y / mag }
        lastNonZeroUserDirRef.current = dir
        return dir
      }
      return null
    }

    return (
      pickFromVelocity(avatarVel) ||
      pickFromVelocity(userVel) ||
      (facing && (Math.abs(facing.x || 0) > 0.001 || Math.abs(facing.y || 0) > 0.001)
        ? { x: facing.x || 0, y: facing.y || 0 }
        : lastNonZeroUserDirRef.current)
    )
  }, [treadmillState?.avatarVirtualVelocity, userState?.userVelocity, userState?.userFacingDirection])

  // Calculate user direction angle for the treadmill user indicator (SVG rotation degrees)
  // Uses derived direction that matches VR motion when moving.
  const userDirectionAngle = useMemo(() => {
    const dirX = userDirectionVectorForUi?.x || 0
    const dirY = userDirectionVectorForUi?.y || 0
    if (Math.abs(dirX) < 0.001 && Math.abs(dirY) < 0.001) return 0

    // Bandit coordinate system: +X=right, +Y=forward
    // SVG: 0° is right (positive X), 90° is down (positive Y)
    // atan2(y, x) gives angle from +X axis, counter-clockwise
    // For SVG rotation (clockwise from +X axis pointing right):
    // Bandit (0,1) forward -> SVG up = -90°
    // Bandit (1,0) right -> SVG right = 0°
    // Bandit (0,-1) backward -> SVG down = 90°
    // Bandit (-1,0) left -> SVG left = 180°
    const angleRad = Math.atan2(-dirY, dirX)  // Flip Y for SVG
    return angleRad * 180 / Math.PI
  }, [userDirectionVectorForUi])

  // Calculate tread direction arrow (shows which way tread is pushing the user)
  // The tread velocity vector points in the direction the user gets PUSHED
  // Arrow is positioned outside the tread area, pointing in the push direction
  const treadDirectionArrow = useMemo(() => {
    if (!treadmillState?.treadDirection || !svgConfig) return null

    const dirX = treadmillState.treadDirection.x || 0
    const dirY = treadmillState.treadDirection.y || 0
    const speed = treadmillState.treadSpeed || 0

    if (speed < 0.01) return null // Don't show arrow if not moving

    // Convert Bandit coords to SVG coords: flip Y
    // Bandit: +X=right, +Y=forward, SVG: +X=right, +Y=down
    const angleSvg = Math.atan2(-dirY, dirX)

    // Arrow positioned outside the tread, pointing in the push direction
    const arrowLength = Math.min(speed * svgConfig.scale * 0.4, 60) + 30 // Min 30px, scaled by speed
    const tipRadius = svgConfig.outerRadius + 15 // Arrow tip just outside the outer circle

    // Position arrow so tip is outside the outer circle, pointing outward
    const endX = Math.cos(angleSvg) * tipRadius
    const endY = Math.sin(angleSvg) * tipRadius
    const startX = Math.cos(angleSvg) * (tipRadius - arrowLength)
    const startY = Math.sin(angleSvg) * (tipRadius - arrowLength)

    return {
      startX,
      startY,
      endX,
      endY,
      angleDeg: angleSvg * 180 / Math.PI
    }
  }, [treadmillState, svgConfig])

  // Calculate user direction arrow (shows which way user is facing/moving)
  // User and tread use the SAME coordinate system: +X=right, +Y=forward (Bandit coords)
  // The tread should move OPPOSITE to user direction to recenter them
  const userDirectionArrow = useMemo(() => {
    if (!userDirectionVectorForUi || !userState?.userSpeed || !svgConfig) return null

    const dirX = userDirectionVectorForUi.x || 0
    const dirY = userDirectionVectorForUi.y || 0
    const speed = userState.userSpeed || 0

    if (speed < 0.01) return null // Don't show arrow if not moving

    // Calculate angle for positioning (SVG coords with Y flipped)
    // Same transformation as tread direction - no additional PI offset
    const angleSvg = Math.atan2(-dirY, dirX)

    // Arrow positioned outside the tread, pointing outward in user's movement direction
    const arrowLength = Math.min(speed * svgConfig.scale * 0.4, 60) + 30
    const tipRadius = svgConfig.outerRadius + 15

    const endX = Math.cos(angleSvg) * tipRadius
    const endY = Math.sin(angleSvg) * tipRadius
    const startX = Math.cos(angleSvg) * (tipRadius - arrowLength)
    const startY = Math.sin(angleSvg) * (tipRadius - arrowLength)

    return {
      startX,
      startY,
      endX,
      endY,
      angleDeg: angleSvg * 180 / Math.PI
    }
  }, [userDirectionVectorForUi, userState?.userSpeed, svgConfig])

  // Calculate warning zones based on user position and movement
  // warningZone: orange - user is in outer area (40-70% from center)
  // dangerZone: red - user is very close to edge (>70% from center) AND moving outward
  const { isWarningZone, isDangerZone } = useMemo(() => {
    if (!userState?.userPosition || !svgConfig) {
      return { isWarningZone: false, isDangerZone: false }
    }

    const posX = userState.userPosition.x || 0
    const posY = userState.userPosition.y || 0
    const dirX = userDirectionVectorForUi?.x || 0
    const dirY = userDirectionVectorForUi?.y || 0
    const speed = userState.userSpeed || 0

    // Calculate distance from center (in meters)
    const distanceFromCenter = Math.sqrt(posX * posX + posY * posY)

    // Tread radius in meters (from config)
    const treadRadius = (svgConfig.treadDiameter || 3) / 2
    const warningRadius = treadRadius * 0.4  // Warning zone starts at 40% of radius
    const dangerRadius = treadRadius * 0.7   // Danger zone starts at 70% of radius

    // Warning zone: user is in outer area (past 40% from center)
    const inWarningArea = distanceFromCenter >= warningRadius

    // Danger zone: user is very close to edge AND moving outward
    let inDangerZone = false
    if (distanceFromCenter >= dangerRadius && speed >= 0.05) {
      // Check if user is moving outward (toward edge)
      const posNorm = Math.sqrt(posX * posX + posY * posY) || 1
      const posUnitX = posX / posNorm
      const posUnitY = posY / posNorm

      // Dot product of movement direction and position direction
      const dotProduct = dirX * posUnitX + dirY * posUnitY
      inDangerZone = dotProduct > 0.2 // Moving outward
    }

    return {
      isWarningZone: inWarningArea && !inDangerZone,
      isDangerZone: inDangerZone
    }
  }, [userState, userDirectionVectorForUi, svgConfig])

  // Calculate speeds for display
  const speeds = useMemo(() => {
    const treadSpeed = treadmillState?.treadSpeed || 0
    const userSpeed = userState?.userSpeed || 0
    // Avatar speed is computed from avatar velocity magnitude (user + tread combined motion in VR)
    const avatarVelX = treadmillState?.avatarVirtualVelocity?.x || 0
    const avatarVelY = treadmillState?.avatarVirtualVelocity?.y || 0
    const avatarSpeed = Math.sqrt(avatarVelX * avatarVelX + avatarVelY * avatarVelY)
    const vrSpeed = userState?.virtualSpeed || 0

    return { treadSpeed, userSpeed, avatarSpeed, vrSpeed }
  }, [treadmillState, userState])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="400px" gap={2}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading configuration: {error}
        </Alert>
        <Button variant="contained" onClick={() => window.location.reload()} startIcon={<RefreshIcon />}>
          Retry
        </Button>
      </Box>
    )
  }

  if (!apiConnected) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="400px" gap={2}>
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Connection Lost
          </Typography>
          <Typography variant="body2">
            Unable to connect to Bandit Arena API. Please ensure the bandit_arena service is running.
          </Typography>
        </Alert>
        <Button
          variant="contained"
          onClick={() => {
            setConsecutiveFailures(0)
            setApiConnected(true)
            fetchStatus()
          }}
          startIcon={<RefreshIcon />}
        >
          Retry Connection
        </Button>
      </Box>
    )
  }

  if (!svgConfig) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Treadmill configuration not available
      </Alert>
    )
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '400px',
        p: 0,
        m: 0
      }}
    >
      {/* Two Column Viewers */}
      <Box sx={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
        {/* Left Column - Treadmill Viewer */}
        <Box
          ref={canvasContainerRef}
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 1,
            backgroundColor: 'transparent',
            position: 'relative',
            height: '100%',
            overflow: 'visible',
            borderRight: 1,
            borderColor: 'divider'
          }}
        >
          <svg
            width={dimensions.width}
            height={dimensions.height}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          >
            <defs>
              {/* Radial gradient for safety wall - very dark PVC look */}
              <radialGradient id="safetyWallGradient" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="#0a0a0a" />
                <stop offset="85%" stopColor="#050505" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </radialGradient>

              {/* Linear gradient for inflatable 3D effect - darker */}
              <linearGradient id="inflatableHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#151515" />
                <stop offset="30%" stopColor="#0a0a0a" />
                <stop offset="70%" stopColor="#050505" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </linearGradient>

              {/* Tread surface gradient - pure black */}
              <radialGradient id="treadSurfaceGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#010101" />
                <stop offset="100%" stopColor="#010101" />
              </radialGradient>

              {/* Clip path for tread surface */}
              <clipPath id="treadClip">
                <circle cx={svgConfig.centerX} cy={svgConfig.centerY} r={svgConfig.innerRadius} />
              </clipPath>

              {/* Hexagonal tread pattern - larger hexagons */}
              {/* NOTE: patternUnits=userSpaceOnUse anchors the pattern to SVG user space.
                Tile size (width/height) and polygon points are scaled explicitly because
                patternTransform scale() only clips content to the original tile area —
                it does NOT resize the tile period. Animation translate keeps scrolling. */}
              <pattern
                id="hexPattern"
                width={90 * TREAD_HEX_SCALE * uiScale}
                height={78 * TREAD_HEX_SCALE * uiScale}
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${animationOffset.x} ${animationOffset.y})`}
              >
                <g fill="none" stroke="#0f0f0f" strokeWidth={8 * TREAD_HEX_SCALE * uiScale}>
                  <polygon points={`${45 * TREAD_HEX_SCALE * uiScale},0 ${90 * TREAD_HEX_SCALE * uiScale},${22.5 * TREAD_HEX_SCALE * uiScale} ${90 * TREAD_HEX_SCALE * uiScale},${55.5 * TREAD_HEX_SCALE * uiScale} ${45 * TREAD_HEX_SCALE * uiScale},${78 * TREAD_HEX_SCALE * uiScale} 0,${55.5 * TREAD_HEX_SCALE * uiScale} 0,${22.5 * TREAD_HEX_SCALE * uiScale}`} />
                </g>
              </pattern>

              {/* Animation for warning ring pulses */}
              <style>{`
              @keyframes pulseOrange {
                0% { opacity: 0.4; stroke-width: 20; }
                100% { opacity: 0.7; stroke-width: 28; }
              }
              @keyframes pulseRed {
                0% { opacity: 0.5; stroke-width: 25; }
                100% { opacity: 0.85; stroke-width: 35; }
              }
              @keyframes flashRed {
                0%, 100% { fill: rgba(255, 0, 0, 0.15); }
                50% { fill: rgba(255, 0, 0, 0.35); }
              }
            `}</style>
            </defs>

            {/* Background - matches tab area background.default */}
            <rect width="100%" height="100%" fill="#181c20" />

            {/* Outer circle - outside edge of safety inflatable */}
            <circle
              cx={svgConfig.centerX}
              cy={svgConfig.centerY}
              r={svgConfig.outerRadius}
              fill="url(#inflatableHighlight)"
              stroke="#151515"
              strokeWidth="2"
            />

            {/* Safety wall ring - the inflatable barrier */}
            <circle
              cx={svgConfig.centerX}
              cy={svgConfig.centerY}
              r={(svgConfig.outerRadius + svgConfig.innerRadius) / 2}
              fill="none"
              stroke="url(#safetyWallGradient)"
              strokeWidth={svgConfig.outerRadius - svgConfig.innerRadius}
              opacity="0.9"
            />

            {/* Warning ring - orange transparent ring when user in outer area */}
            {isWarningZone && (
              <>
                <circle
                  cx={svgConfig.centerX}
                  cy={svgConfig.centerY}
                  r={svgConfig.innerRadius - 12}
                  fill="none"
                  stroke="rgba(255, 165, 0, 0.5)"
                  strokeWidth="24"
                  style={{
                    animation: 'pulseOrange 1s ease-in-out infinite alternate'
                  }}
                />
                {/* Warning status text */}
                <text
                  x={svgConfig.centerX}
                  y={svgConfig.centerY - svgConfig.innerRadius + 40}
                  fill="#ffa500"
                  fontSize="16"
                  fontFamily="Montserrat, sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  filter="drop-shadow(0 0 4px rgba(255, 165, 0, 0.8))"
                >
                  ⚠ WARNING ZONE
                </text>
              </>
            )}

            {/* Danger warning ring - red transparent ring when user heading toward wall */}
            {isDangerZone && (
              <>
                {/* Full tread flash background */}
                <circle
                  cx={svgConfig.centerX}
                  cy={svgConfig.centerY}
                  r={svgConfig.innerRadius}
                  fill="rgba(255, 0, 0, 0.2)"
                  style={{
                    animation: 'flashRed 0.3s ease-in-out infinite'
                  }}
                />
                <circle
                  cx={svgConfig.centerX}
                  cy={svgConfig.centerY}
                  r={svgConfig.innerRadius - 15}
                  fill="none"
                  stroke="rgba(255, 0, 0, 0.6)"
                  strokeWidth="30"
                  style={{
                    animation: 'pulseRed 0.4s ease-in-out infinite alternate'
                  }}
                />
                {/* Barrier alert text */}
                <text
                  x={svgConfig.centerX}
                  y={svgConfig.centerY - svgConfig.innerRadius + 40}
                  fill="#ff4444"
                  fontSize="18"
                  fontFamily="Montserrat, sans-serif"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  filter="drop-shadow(0 0 6px rgba(255, 0, 0, 0.9))"
                >
                  🚨 BARRIER ALERT
                </text>
              </>
            )}

            {/* Inner circle - tread surface */}
            <circle
              cx={svgConfig.centerX}
              cy={svgConfig.centerY}
              r={svgConfig.innerRadius}
              fill="url(#treadSurfaceGradient)"
              stroke="#3a3a3a"
              strokeWidth="2"
            />

            {/* Tread pattern - hexagonal pattern animated in tread direction */}
            <g clipPath="url(#treadClip)">
              {/* Animated hexagonal pattern - offset based on accumulated X,Y velocity */}
              {/* Uses independent X,Y offsets to avoid jumping when direction changes */}
              <rect
                x={svgConfig.centerX - svgConfig.innerRadius * 1.5}
                y={svgConfig.centerY - svgConfig.innerRadius * 1.5}
                width={svgConfig.innerRadius * 3}
                height={svgConfig.innerRadius * 3}
                fill="url(#hexPattern)"
                opacity="0.6"
              />
            </g>

            {/* Center reference point */}
            <circle
              cx={svgConfig.centerX}
              cy={svgConfig.centerY}
              r="4"
              fill="#666666"
            />

            {/* User position indicator */}
            {userPosition && (
              <g transform={`translate(${svgConfig.centerX + userPosition.x}, ${svgConfig.centerY + userPosition.y})`}>
                {/* User glow effect */}
                <circle
                  cx={0}
                  cy={0}
                  r={treadUserIconSize * 2}
                  fill="rgba(77, 182, 196, 0.25)"
                />
                {/* User marker */}
                <circle
                  cx={0}
                  cy={0}
                  r={treadUserIconSize}
                  fill="#4db6c4"
                  stroke="#ffffff"
                  strokeWidth={Math.max(1.5, treadUserIconSize / 5)}
                />
                {/* User direction indicator (triangle pointing in facing direction) */}
                {(() => {
                  const markerRadius = treadUserIconSize
                  const tip = markerRadius * 1.8
                  const baseX = markerRadius * 0.6
                  const baseY = markerRadius * 0.8
                  return (
                    <polygon
                      points={`0,${-tip} ${-baseX},${-baseY} ${baseX},${-baseY}`}
                      fill="#ffffff"
                      opacity="0.9"
                      transform={`rotate(${userDirectionAngle + 90})`}
                    />
                  )
                })()}
              </g>
            )}

            {/* Tread Movement label */}
            <text
              x={svgConfig.centerX}
              y={20}
              fill="#888"
              fontSize="14"
              fontFamily="Montserrat, sans-serif"
              fontWeight="600"
              textAnchor="middle"
              letterSpacing="1"
            >
              TREAD MOVEMENT
            </text>

          </svg>

          {/* Compass overlay in upper left corner */}
          <DirectionCompass
            treadDirection={treadmillState?.treadDirection}
            userDirection={userDirectionVectorForUi}
            treadSpeed={speeds.treadSpeed}
            userSpeed={speeds.avatarSpeed}
            scale={cornerOverlayLayout?.compass.scale ?? 1}
            left={cornerOverlayLayout?.compass.left ?? COMPASS_LEFT_MARGIN}
            top={cornerOverlayLayout?.compass.top ?? COMPASS_CORNER_MARGIN}
          />

          {/* Grade indicator in lower left corner */}
          <GradeIndicator
            rollDeg={treadmillState?.treadTilt?.x || 0}
            pitchDeg={treadmillState?.treadTilt?.y || 0}
            scale={cornerOverlayLayout?.grade.scale ?? 1}
            left={cornerOverlayLayout?.grade.left ?? GRADE_LEFT_MARGIN}
            bottom={cornerOverlayLayout?.grade.bottom ?? GRADE_CORNER_MARGIN}
          />
        </Box>

        {/* Right Column - VR Position Viewer */}
        <VRPositionViewer userState={userState} config={config} />
      </Box>
    </Box>
  )
}

function VrEventMarker({ type, x, y, size }) {
  const r = Math.max(8, size * 1.15)
  const label = type === 'fall' ? 'F' : 'X'
  const testId = type === 'fall' ? 'vr-trail-fall-marker' : 'vr-trail-wall-marker'
  return (
    <g transform={`translate(${x}, ${y})`} data-testid={testId}>
      <circle
        cx={0}
        cy={0}
        r={r}
        fill="#c62828"
        stroke="#ffffff"
        strokeWidth={Math.max(1.25, r / 8)}
      />
      {type === 'fall' ? (
        <text
          x={0}
          y={0}
          fill="#ffffff"
          fontSize={r * 1.05}
          fontFamily="Montserrat, sans-serif"
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      ) : (
        <>
          <line
            x1={-r * 0.38}
            y1={-r * 0.38}
            x2={r * 0.38}
            y2={r * 0.38}
            stroke="#ffffff"
            strokeWidth={Math.max(1.75, r / 5)}
            strokeLinecap="round"
          />
          <line
            x1={r * 0.38}
            y1={-r * 0.38}
            x2={-r * 0.38}
            y2={r * 0.38}
            stroke="#ffffff"
            strokeWidth={Math.max(1.75, r / 5)}
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  )
}

// VR Position Viewer Component - shows unbounded position with movement trail
function VRPositionViewer({ userState, config }) {
  const containerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 })
  const [positionHistory, setPositionHistory] = useState([]) // Array of {x, y, timestamp, inWarning}
  const [eventMarkers, setEventMarkers] = useState([]) // {type: 'wall'|'fall', x, y, timestamp}
  const lastSafetyRef = useRef({ atWall: false, fallen: false })
  const boundaryRadii = useMemo(() => safetyBoundaryRadii(config), [config])

  const uiScale = useMemo(() => {
    const size = Math.min(dimensions.width, dimensions.height)
    if (size <= 0) {
      return 1
    }
    return size / REFERENCE_VIEW_SIZE
  }, [dimensions.width, dimensions.height])

  // Handle container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const size = Math.min(rect.width - 20, rect.height - 20)
        setDimensions({ width: size, height: size })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Calculate unbounded position for display
  const unboundedPos = useMemo(() => {
    const x = userState?.unboundedPosition?.x || 0
    const y = userState?.unboundedPosition?.y || 0
    return { x, y }
  }, [userState])

  // Update position history and safety markers when telemetry changes
  useEffect(() => {
    if (!userState) {
      setPositionHistory([])
      setEventMarkers([])
      lastSafetyRef.current = { atWall: false, fallen: false }
      return
    }

    const now = Date.now()
    const dist = userState?.distanceFromCenter
      ?? Math.hypot(userState?.userPosition?.x || 0, userState?.userPosition?.y || 0)
    const inWarning = dist >= boundaryRadii.warning
    const atWall = dist >= boundaryRadii.violation
    const fallen = userState?.userStatus === USER_STATUS_FALL
    const newPoint = { x: unboundedPos.x, y: unboundedPos.y, timestamp: now, inWarning }

    setPositionHistory((prev) => {
      const pruned = prunePositionHistory(prev, now)
      const last = pruned[pruned.length - 1]
      const moved = !last
        || Math.hypot(newPoint.x - last.x, newPoint.y - last.y) > 0.001
        || last.inWarning !== inWarning
      if (!moved) {
        return pruned.length === prev.length ? prev : pruned
      }
      const updated = prunePositionHistory([...pruned, newPoint], now)

      if (updated.length > 2000) {
        const sampled = []
        const step = Math.ceil(updated.length / 1500)
        for (let i = 0; i < updated.length; i += step) {
          sampled.push(updated[i])
        }
        if (sampled[sampled.length - 1] !== updated[updated.length - 1]) {
          sampled.push(updated[updated.length - 1])
        }
        return sampled
      }

      return updated
    })

    const prevSafety = lastSafetyRef.current
    const nextMarkers = []
    if (atWall && !prevSafety.atWall) {
      nextMarkers.push({ type: 'wall', x: unboundedPos.x, y: unboundedPos.y, timestamp: now })
    }
    if (fallen && !prevSafety.fallen) {
      nextMarkers.push({ type: 'fall', x: unboundedPos.x, y: unboundedPos.y, timestamp: now })
    }
    lastSafetyRef.current = { atWall, fallen }
    setEventMarkers((prev) => {
      const kept = prunePositionHistory(prev, now)
      return nextMarkers.length > 0 ? [...kept, ...nextMarkers] : kept
    })
  }, [
    userState,
    unboundedPos.x,
    unboundedPos.y,
    userState?.distanceFromCenter,
    userState?.userPosition?.x,
    userState?.userPosition?.y,
    userState?.userStatus,
    boundaryRadii.warning,
    boundaryRadii.violation,
  ])

  // Prune trail while the runner is idle so the window stays wall-clock limited.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now()
      setPositionHistory((prev) => {
        const next = prunePositionHistory(prev, now)
        return next.length === prev.length ? prev : next
      })
      setEventMarkers((prev) => {
        const next = prunePositionHistory(prev, now)
        return next.length === prev.length ? prev : next
      })
    }, POSITION_HISTORY_PRUNE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  // Bounding box of the trailing window only (used to size the view before the max clamp).
  const bounds = useMemo(() => {
    if (positionHistory.length === 0) {
      return {
        minX: unboundedPos.x - 5,
        maxX: unboundedPos.x + 5,
        minY: unboundedPos.y - 5,
        maxY: unboundedPos.y + 5,
      }
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const p of positionHistory) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }

    minX = Math.min(minX, unboundedPos.x)
    maxX = Math.max(maxX, unboundedPos.x)
    minY = Math.min(minY, unboundedPos.y)
    maxY = Math.max(maxY, unboundedPos.y)

    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const paddingX = Math.max(2, rangeX * 0.2)
    const paddingY = Math.max(2, rangeY * 0.2)

    return {
      minX: minX - paddingX,
      maxX: maxX + paddingX,
      minY: minY - paddingY,
      maxY: maxY + paddingY,
    }
  }, [positionHistory, unboundedPos])

  // Follow the user; clamp world extent so long distance inside the trail window cannot collapse scale.
  const viewConfig = useMemo(
    () =>
      computeVrTrailViewConfig({
        bounds,
        userX: unboundedPos.x,
        userY: unboundedPos.y,
        panelWidth: dimensions.width,
        panelHeight: dimensions.height,
      }),
    [dimensions, bounds, unboundedPos],
  )

  // Convert world position to SVG coordinates
  const worldToSvg = useCallback((worldX, worldY) => {
    const relX = worldX - viewConfig.viewCenterX
    const relY = worldY - viewConfig.viewCenterY
    return {
      x: relX * viewConfig.scale + viewConfig.centerX,
      y: -relY * viewConfig.scale + viewConfig.centerY // Flip Y for SVG
    }
  }, [viewConfig])

  // Calculate user position in SVG coordinates
  const userSvgPos = useMemo(() => {
    return worldToSvg(unboundedPos.x, unboundedPos.y)
  }, [unboundedPos, worldToSvg])

  // Generate colored trail segments (cyan in the safe area, yellow in the warning/wall area)
  const trailSegments = useMemo(() => {
    if (positionHistory.length < 2) return []

    const segments = []
    let current = {
      inWarning: Boolean(positionHistory[0].inWarning),
      points: [positionHistory[0]],
    }
    for (let i = 1; i < positionHistory.length; i++) {
      const p = positionHistory[i]
      const warn = Boolean(p.inWarning)
      if (warn === current.inWarning) {
        current.points.push(p)
      } else {
        current.points.push(p)
        segments.push(current)
        current = { inWarning: warn, points: [p] }
      }
    }
    segments.push(current)
    return segments
      .filter((seg) => seg.points.length >= 2)
      .map((seg) => ({
        inWarning: seg.inWarning,
        d: trailPathFromPoints(seg.points, worldToSvg),
      }))
  }, [positionHistory, worldToSvg])

  // Generate grid lines for the visible viewport (not the full trail AABB).
  const gridLines = useMemo(() => {
    if (!viewConfig) return { vertical: [], horizontal: [] }

    const lines = { vertical: [], horizontal: [] }

    let gridSpacing = 1
    if (viewConfig.viewSize > 50) gridSpacing = 10
    else if (viewConfig.viewSize > 20) gridSpacing = 5
    else if (viewConfig.viewSize > 10) gridSpacing = 2

    const half = viewConfig.viewSize / 2
    const startX = Math.floor((viewConfig.viewCenterX - half) / gridSpacing) * gridSpacing
    const endX = Math.ceil((viewConfig.viewCenterX + half) / gridSpacing) * gridSpacing
    const startY = Math.floor((viewConfig.viewCenterY - half) / gridSpacing) * gridSpacing
    const endY = Math.ceil((viewConfig.viewCenterY + half) / gridSpacing) * gridSpacing

    for (let x = startX; x <= endX; x += gridSpacing) {
      const svg = worldToSvg(x, viewConfig.viewCenterY)
      const isMajor = x % (gridSpacing * 5) === 0 || x === 0
      lines.vertical.push({
        x: svg.x,
        label: x,
        isMajor,
        isOrigin: x === 0,
      })
    }

    for (let y = startY; y <= endY; y += gridSpacing) {
      const svg = worldToSvg(viewConfig.viewCenterX, y)
      const isMajor = y % (gridSpacing * 5) === 0 || y === 0
      lines.horizontal.push({
        y: svg.y,
        label: y,
        isMajor,
        isOrigin: y === 0,
      })
    }

    return lines
  }, [viewConfig, worldToSvg])

  // Icon size scales with the VR viewer panel size (matches tread user marker).
  const iconSize = BASELINE_ICON_PX * USER_ICON_SCALE * uiScale

  return (
    <Box
      ref={containerRef}
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 1,
        backgroundColor: 'transparent',
        position: 'relative',
        height: '100%'
      }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        data-testid="dashboard-vr-position"
      >
        {/* Background */}
        <rect width="100%" height="100%" fill="#181c20" />

        {/* Grid lines - dynamically spaced */}
        {gridLines.vertical.map((line, i) => (
          <g key={`v-${i}`}>
            <line
              x1={line.x}
              y1={0}
              x2={line.x}
              y2={dimensions.height}
              stroke={line.isOrigin ? "#4a4a4a" : line.isMajor ? "#3a3a3a" : "#252525"}
              strokeWidth={line.isOrigin ? 2 : line.isMajor ? 1.5 : 1}
            />
            {/* X axis labels at bottom */}
            {line.isMajor && (
              <text
                x={line.x}
                y={dimensions.height - 8}
                fill="#666"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {line.label}
              </text>
            )}
          </g>
        ))}

        {gridLines.horizontal.map((line, i) => (
          <g key={`h-${i}`}>
            <line
              x1={0}
              y1={line.y}
              x2={dimensions.width}
              y2={line.y}
              stroke={line.isOrigin ? "#4a4a4a" : line.isMajor ? "#3a3a3a" : "#252525"}
              strokeWidth={line.isOrigin ? 2 : line.isMajor ? 1.5 : 1}
            />
            {/* Y axis labels on left */}
            {line.isMajor && (
              <text
                x={8}
                y={line.y + 3}
                fill="#666"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="start"
              >
                {line.label}
              </text>
            )}
          </g>
        ))}

        {/* Movement history trail: yellow in boundary warning, cyan otherwise */}
        {trailSegments.map((seg, i) => (
          <path
            key={`trail-${i}`}
            d={seg.d}
            fill="none"
            stroke={seg.inWarning ? TRAIL_COLOR_WARNING : TRAIL_COLOR_SAFE}
            strokeWidth={Math.max(1.5, iconSize / 5)}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.75"
            data-testid={seg.inWarning ? 'vr-trail-warning' : 'vr-trail-safe'}
          />
        ))}

        {eventMarkers.map((marker) => {
          const svg = worldToSvg(marker.x, marker.y)
          return (
            <VrEventMarker
              key={`${marker.type}-${marker.timestamp}`}
              type={marker.type}
              x={svg.x}
              y={svg.y}
              size={iconSize}
            />
          )
        })}

        {/* User position indicator - blue circle at front of line, no arrow */}
        <g transform={`translate(${userSvgPos.x}, ${userSvgPos.y})`}>
          {/* User glow effect */}
          <circle
            cx={0}
            cy={0}
            r={iconSize * 2}
            fill="rgba(77, 182, 196, 0.25)"
          />
          {/* User marker - solid blue circle */}
          <circle
            cx={0}
            cy={0}
            r={iconSize}
            fill="#4db6c4"
            stroke="#ffffff"
            strokeWidth={Math.max(1.5, iconSize / 5)}
          />
        </g>

        {/* Current position label */}
        <text
          x={userSvgPos.x}
          y={userSvgPos.y + iconSize * 2.5 + 10}
          fill="#4db6c4"
          fontSize="11"
          fontFamily="monospace"
          textAnchor="middle"
        >
          ({unboundedPos.x.toFixed(1)}, {unboundedPos.y.toFixed(1)})
        </text>

        {/* VR Position label */}
        <text
          x={viewConfig.centerX}
          y={20}
          fill="#888"
          fontSize="14"
          fontFamily="Montserrat, sans-serif"
          fontWeight="600"
          textAnchor="middle"
          letterSpacing="1"
        >
          VR POSITION
        </text>

        {/* Scale indicator - shows current grid scale */}
        <g transform={`translate(${dimensions.width - 80}, ${dimensions.height - 30})`}>
          <line x1={0} y1={0} x2={viewConfig.scale} y2={0} stroke="#666" strokeWidth="2" />
          <line x1={0} y1={-5} x2={0} y2={5} stroke="#666" strokeWidth="2" />
          <line x1={viewConfig.scale} y1={-5} x2={viewConfig.scale} y2={5} stroke="#666" strokeWidth="2" />
          <text
            x={viewConfig.scale / 2}
            y={15}
            fill="#666"
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
          >
            1m
          </text>
        </g>

        {/* History duration indicator */}
        <text
          x={dimensions.width - 10}
          y={20}
          fill="#555"
          fontSize="10"
          fontFamily="monospace"
          textAnchor="end"
        >
          {positionHistory.length > 0
            ? `${Math.min(
                Math.round((Date.now() - positionHistory[0].timestamp) / 1000),
                Math.round(POSITION_HISTORY_MAX_DURATION_MS / 1000),
              )}s trail`
            : ''}
        </text>
      </svg>
    </Box>
  )
}

export default DashboardTab
