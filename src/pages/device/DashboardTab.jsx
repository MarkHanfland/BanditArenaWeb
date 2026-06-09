import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Box, CircularProgress, Alert, Typography, Paper, Button } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { getConfig, getTelemetryCurrent, getServicesStatus, getTelemetryStats } from '../../api/device'

// Constants for position history
const POSITION_HISTORY_MAX_DURATION_MS = 3 * 60 * 1000 // 3 minutes in milliseconds

// Zoom-invariant UI scales (baseline sizes rendered at 100% zoom)
const BASELINE_ICON_PX = 10
const TREAD_HEX_SCALE = 2.0
const COMPASS_SCALE = 1.75
const GRADE_SCALE = 1.75
const LEFT_USER_ICON_SCALE = 3.0
const RIGHT_USER_ICON_SCALE = 1.75


// Stylish speed meter component
function SpeedMeter({ label, value, maxValue, color, glowColor, unit = 'm/s' }) {
  const percentage = Math.min((value / maxValue) * 100, 100)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 180 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Typography
          variant="caption"
          sx={{
            color: '#888',
            fontWeight: 600,
            letterSpacing: 1,
            fontSize: '10px'
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: color,
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '13px',
            textShadow: `0 0 8px ${glowColor}`
          }}
        >
          {value.toFixed(2)} {unit}
        </Typography>
      </Box>
      <Box sx={{
        position: 'relative',
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Background track with tick marks */}
        <Box sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'space-between',
          px: 0.5,
          alignItems: 'center'
        }}>
          {[...Array(10)].map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 1,
                height: '60%',
                backgroundColor: 'rgba(255,255,255,0.1)'
              }}
            />
          ))}
        </Box>
        {/* Filled portion */}
        <Box sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${percentage}%`,
          background: `linear-gradient(90deg, ${color}66, ${color})`,
          borderRadius: 4,
          boxShadow: `0 0 12px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.3)`,
          transition: 'width 0.15s ease-out'
        }} />
        {/* Glossy overlay */}
        <Box sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
          borderRadius: 4,
          pointerEvents: 'none'
        }} />
      </Box>
    </Box>
  )
}

// Session stats component
function SessionStat({ label, value, color }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
      <Typography
        variant="caption"
        sx={{
          color: '#666',
          fontWeight: 600,
          letterSpacing: 1,
          fontSize: '9px'
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: color,
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: '14px'
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

// Compass component - shows tread and user facing direction
function DirectionCompass({ treadDirection, userDirection, treadSpeed, userSpeed, scale = 1 }) {
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

  // Show tread only when moving, but always show user facing direction when tracked
  const showTread = treadSpeed > 0.05 && treadAngle !== null
  const showUser = userAngle !== null  // Show facing direction even when stationary

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
      top: 16,
      left: 40,
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

// GradeIndicator — shows tread grade as a perspective ellipse viewed from above and slightly ahead.
//
// Visual encoding:
//   Roll  (X-grade): rotates the entire ellipse so the long axis tilts left/right.
//                    Positive roll → right side higher → counter-clockwise tilt (−SVG angle).
//                    2× visual amplification: ±8° physical → ±16° apparent rotation.
//   Pitch (Y-grade): stretches/compresses the minor axis (ry).
//                    Positive pitch → grade toward viewer → front rim rises → taller ellipse.
//                    Negative pitch → grade away → front rim drops → flatter ellipse.
//                    1.1px/° amplification: ±8° physical → ±9px ry change on base 18px.
//   Combined: rotation + ry-change apply simultaneously.
//
// The grade % label travels to the uphill rim point, correctly rotating around the full perimeter.
// Gradient dark side = uphill, light side = downhill.
function GradeIndicator({ rollDeg, pitchDeg, scale = 1 }) {
  const W = 150
  const H = 92
  const cx = W / 2   // 75
  const cy = 46      // vertical center of ellipse

  const baseRx = 58  // half-width of flat disk
  const baseRy = 18  // half-height (foreshortened perspective)

  // ── Pitch: stretch/compress minor axis ──────────────────────────────────────
  // pitchDeg > 0 = toward viewer → ry increases (front rim rises → taller disk).
  // pitchDeg < 0 = away from viewer → ry decreases (front rim drops → flatter).
  const pitchScale = 1.1   // px of ry change per degree of pitch (1:1 ratio at ±8° max)
  const ry = Math.max(4, Math.min(baseRy + pitchDeg * pitchScale, baseRy * 3.5))

  // ── Roll: rotate the ellipse around its center ─────────────────────────────
  // Positive roll = right side higher. In SVG (+Y = down) that means CCW = negative angle.
  // 2× amplification → ±8° physical becomes ±16° visible.
  const maxVisualRotate = 16
  const visualRotateDeg = Math.max(-maxVisualRotate, Math.min(-rollDeg * 2.0, maxVisualRotate))
  const rotRad = visualRotateDeg * Math.PI / 180

  // ── Grade magnitudes ────────────────────────────────────────────────────────
  // gradMag in degrees (drives threshold + shape logic)
  const gradMag = Math.sqrt(rollDeg * rollDeg + pitchDeg * pitchDeg)
  // Convert actuator degrees → grade % for the label (tan(θ)×100)
  const toGradePct = (deg) => Math.tan(deg * Math.PI / 180) * 100
  const gradeMagPct = Math.sqrt(toGradePct(rollDeg) ** 2 + toGradePct(pitchDeg) ** 2)

  // ── Uphill unit vector in the pre-rotation ellipse frame ───────────────────
  // roll+  → right is uphill → +SVG-X
  // pitch+ → toward viewer is uphill → -SVG-Y  (SVG Y-axis is inverted vs. screen intuition)
  const uphillX = gradMag > 0.1 ? rollDeg / gradMag : 0
  const uphillY = gradMag > 0.1 ? -pitchDeg / gradMag : 0

  // Rotate the uphill vector into global SVG coordinates
  // (the ellipse rotates by visualRotateDeg, so its uphill side rotates with it)
  const uphillGX = uphillX * Math.cos(rotRad) - uphillY * Math.sin(rotRad)
  const uphillGY = uphillX * Math.sin(rotRad) + uphillY * Math.cos(rotRad)

  // ── Gradient endpoints in global SVG space ──────────────────────────────────
  const gradR = Math.max(baseRx, ry) * 1.15
  const g1x = cx + uphillGX * gradR   // uphill end → dark
  const g1y = cy + uphillGY * gradR
  const g2x = cx - uphillGX * gradR   // downhill end → light
  const g2y = cy - uphillGY * gradR

  // ── Label position: uphill rim point rotated into global SVG space ──────────
  const labelOffset = 11
  const rimPreX = uphillX * (baseRx + labelOffset)
  const rimPreY = uphillY * (ry + labelOffset)
  const highX = cx + rimPreX * Math.cos(rotRad) - rimPreY * Math.sin(rotRad)
  const highY = cy + rimPreX * Math.sin(rotRad) + rimPreY * Math.cos(rotRad)

  const showGrade = gradMag >= 0.3
  const gradeLabelText = showGrade ? `${gradeMagPct.toFixed(1)}%` : null

  return (
    <Box sx={{ position: 'absolute', bottom: 16, left: 16, zIndex: 100, pointerEvents: 'none', transform: `scale(${scale})`, transformOrigin: 'bottom left' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} overflow="visible">
        <defs>
          <linearGradient
            id="gradeEllipseGrad"
            gradientUnits="userSpaceOnUse"
            x1={g1x} y1={g1y}
            x2={g2x} y2={g2y}
          >
            <stop offset="0%" stopColor="rgba(0,8,25,0.10)" />
            <stop offset="55%" stopColor="rgba(0,70,130,0.10)" />
            <stop offset="100%" stopColor="rgba(0,170,220,0.10)" />
          </linearGradient>
        </defs>

        {/* Outer glow / shadow halo — rotates with roll */}
        <ellipse
          cx={cx} cy={cy}
          rx={baseRx + 7} ry={baseRy + 6}
          fill="rgba(0,0,0,0.45)"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
          transform={`rotate(${visualRotateDeg}, ${cx}, ${cy})`}
        />

        {/* Main tread-disk ellipse — rotated by roll, height set by pitch */}
        <ellipse
          cx={cx} cy={cy}
          rx={baseRx} ry={ry}
          fill={showGrade ? 'url(#gradeEllipseGrad)' : 'rgba(0,25,45,0.10)'}
          stroke="rgba(0,210,255,0.35)"
          strokeWidth="1.5"
          transform={`rotate(${visualRotateDeg}, ${cx}, ${cy})`}
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="2" fill="rgba(255,255,255,0.4)" />

        {/* Grade value label — travels to the uphill rim point */}
        {showGrade && (
          <text
            x={highX}
            y={highY}
            fill="#00e5ff"
            fontSize="9"
            fontFamily="Montserrat, sans-serif"
            fontWeight="700"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {gradeLabelText}
          </text>
        )}

        {/* GRADE label */}
        <text
          x={cx}
          y={H - 2}
          fill="#00e5ff"
          fontSize="8"
          fontFamily="Montserrat, sans-serif"
          fontWeight="600"
          textAnchor="middle"
          opacity="0.8"
        >
          GRADE
        </text>
      </svg>
    </Box>
  )
}

function DashboardTab() {
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
  const initialDimensionsRef = useRef(null)
  const hexScaleRef = useRef(TREAD_HEX_SCALE)
  const prevHexScaleRef = useRef(TREAD_HEX_SCALE)

  // counterZoom must be declared before any useEffect that references it.
  // Ratio of current CSS container width to initial width — when browser zooms in,
  // CSS pixels shrink proportionally, so this equals 1/zoomFactor automatically.
  const counterZoom = initialDimensionsRef.current ? dimensions.width / initialDimensionsRef.current : 1.0

  // Session tracking state (server-side, avoids uint64 precision issues and page-refresh loss)
  const [sessionDurationSec, setSessionDurationSec] = useState(0)
  const [vrDistanceMeters, setVrDistanceMeters] = useState(0)
  const [openxrRuntimeName, setOpenxrRuntimeName] = useState('Unknown')
  const [openxrLinkHealthy, setOpenxrLinkHealthy] = useState(null)

  const MAX_CONSECUTIVE_FAILURES = 5 // Show disconnected state after 5 consecutive failures

  // Fetch initial config
  useEffect(() => {
    const fetchConfig = async () => {
      const { data, error } = await getConfig()
      if (error) {
        setError(error)
      } else {
        setConfig(data)
        const runtimeName = data?.openxr_runtime?.name || data?.openxr_runtime?.manifestPath || 'Unknown'
        setOpenxrRuntimeName(runtimeName)
        setError(null)
      }
      setLoading(false)
    }
    fetchConfig()
  }, [])

  // Fetch service status for OpenXR heartbeat (poll modestly)
  useEffect(() => {
    let mounted = true

    const fetchServiceStatus = async () => {
      const { data, error: fetchError } = await getServicesStatus()
      if (fetchError || !data?.services) return
      if (!mounted) return

      const oxrService = data.services.find(s => s.serviceName === 'OpenXR_Driver')
      if (oxrService && typeof oxrService.secondsSinceLastHeartbeat === 'number') {
        setOpenxrLinkHealthy(oxrService.secondsSinceLastHeartbeat < 5)
      } else {
        setOpenxrLinkHealthy(false)
      }
    }

    fetchServiceStatus()
    const interval = setInterval(fetchServiceStatus, 2000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
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
      // Server returned 204 - no data yet, not an error
      console.debug('Dashboard: Waiting for telemetry data...')
    } else if (data) {
      // Reset failure count
      setConsecutiveFailures(0)
      setApiConnected(true)
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
        setUserState({
          userPosition: data.user.pos,
          userVelocity: data.user.vel,
          userFacingDirection: data.user.facing,
          userDirection: data.user.moveDir || data.user.facing,
          userSpeed: data.user.speed || 0,
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

  // Fetch telemetry periodically
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 100) // Update 10 times per second for smooth animation
    return () => clearInterval(interval)
  }, [])

  // Poll server-side stats for session time and VR distance.
  // Server-side values avoid uint64 precision loss from QPC nanosecond subtraction in JS
  // and survive page refreshes since data is accumulated in BanditArena's telemetry buffer.
  useEffect(() => {
    let mounted = true
    const fetchStats = async () => {
      const { data } = await getTelemetryStats()
      if (!mounted || !data) return
      setSessionDurationSec(data.session?.durationSec || 0)
      setVrDistanceMeters(data.avatar?.totalDistance || 0)
    }
    fetchStats()
    const interval = setInterval(fetchStats, 2000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  // Format session time as HH:MM:SS or MM:SS
  const formattedSessionTime = useMemo(() => {
    const totalSec = Math.floor(sessionDurationSec)
    const hours = Math.floor(totalSec / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [sessionDurationSec])

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

      const state = treadmillStateRef.current
      const speed = state?.treadSpeed || 0
      const dirX = state?.treadDirection?.x || 0
      const dirY = state?.treadDirection?.y || 0

      // Calculate velocity in SVG coords
      // Bandit coords: +X=right, +Y=forward -> SVG: +X=right, +Y=down (flip Y)
      // The tread direction vector points where user gets PUSHED
      // The hexagons should move in the SAME direction (belt surface moves with user)
      const svgVelX = dirX * speed
      const svgVelY = -dirY * speed

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

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [config])

  // When browser zoom changes, update hexScaleRef and rescale animation offset to maintain visual phase
  useEffect(() => {
    const newHexScale = TREAD_HEX_SCALE * counterZoom
    const oldHexScale = prevHexScaleRef.current
    if (newHexScale !== oldHexScale) {
      const ratio = newHexScale / oldHexScale
      setAnimationOffset(prev => ({ ...prev, x: prev.x * ratio, y: prev.y * ratio }))
      hexScaleRef.current = newHexScale
      prevHexScaleRef.current = newHexScale
    }
  }, [counterZoom])

  // Handle container resize — also captures the initial size on first call so counterZoom
  // can be derived from dimensions alone (no devicePixelRatio detection needed).
  useEffect(() => {
    const updateDimensions = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect()
        const size = Math.min(rect.width - 20, rect.height - 20)
        if (initialDimensionsRef.current === null && size > 0) {
          initialDimensionsRef.current = size
        }
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

    // Calculate pixel scale to fit in container with padding
    const padding = 40
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
    if (!userState?.userDirection || !userState?.userSpeed || !svgConfig) return null

    const dirX = userState.userDirection.x || 0
    const dirY = userState.userDirection.y || 0
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
  }, [userState, svgConfig])

  // Calculate warning zones based on user position and movement
  // warningZone: orange - user is in outer area (40-70% from center)
  // dangerZone: red - user is very close to edge (>70% from center) AND moving outward
  const { isWarningZone, isDangerZone } = useMemo(() => {
    if (!userState?.userPosition || !svgConfig) {
      return { isWarningZone: false, isDangerZone: false }
    }

    const posX = userState.userPosition.x || 0
    const posY = userState.userPosition.y || 0
    const dirX = userState.userDirection?.x || 0
    const dirY = userState.userDirection?.y || 0
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
  }, [userState, svgConfig])

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
      {/* Stats Panel - Top Bar with Speed Meters and Session Info */}
      <Paper
        elevation={2}
        sx={{
          borderRadius: 0,
          px: 3,
          py: 1.5,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(30,35,40,1) 0%, rgba(24,28,32,1) 100%)'
        }}
      >
        {/* Left Section - Speed Meters */}
        <Box sx={{ display: 'flex', gap: 3, flex: 1, alignItems: 'center' }}>
          <SpeedMeter
            label="AVATAR SPEED"
            value={speeds.avatarSpeed}
            maxValue={6}
            color="#00e5ff"
            glowColor="rgba(0,229,255,0.5)"
          />
          <SpeedMeter
            label="TREAD SPEED"
            value={speeds.treadSpeed}
            maxValue={6}
            color="#00e5ff"
            glowColor="rgba(0,229,255,0.5)"
          />
          <SessionStat
            label="OPENXR RUNTIME"
            value={openxrRuntimeName}
            color="#00e5ff"
          />
         
          <SessionStat
            label="OPENXR DRIVER"
            value={openxrLinkHealthy === null ? 'Detecting...' : (openxrLinkHealthy ? 'Running' : 'Disabled')}
            color={openxrLinkHealthy ? '#00d4aa' : '#ef5350'}
          />
          <SessionStat
            label="VR DISTANCE"
            value={vrDistanceMeters >= 1000
              ? `${(vrDistanceMeters / 1000).toFixed(2)} km`
              : `${vrDistanceMeters.toFixed(1)} m`}
            color="#00e5ff"
          />
          <SessionStat
            label="SESSION TIME"
            value={formattedSessionTime}
            color="#00e5ff"
          />
        </Box>


        {/* Right Section - Session Stats */}
        <Box sx={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-start' }}>

        </Box>
      </Paper>

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
                width={90 * TREAD_HEX_SCALE * counterZoom}
                height={78 * TREAD_HEX_SCALE * counterZoom}
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${animationOffset.x} ${animationOffset.y})`}
              >
                <g fill="none" stroke="#0f0f0f" strokeWidth={8 * TREAD_HEX_SCALE * counterZoom}>
                  <polygon points={`${45 * TREAD_HEX_SCALE * counterZoom},0 ${90 * TREAD_HEX_SCALE * counterZoom},${22.5 * TREAD_HEX_SCALE * counterZoom} ${90 * TREAD_HEX_SCALE * counterZoom},${55.5 * TREAD_HEX_SCALE * counterZoom} ${45 * TREAD_HEX_SCALE * counterZoom},${78 * TREAD_HEX_SCALE * counterZoom} 0,${55.5 * TREAD_HEX_SCALE * counterZoom} 0,${22.5 * TREAD_HEX_SCALE * counterZoom}`} />
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
                  r={BASELINE_ICON_PX * LEFT_USER_ICON_SCALE * 2 * counterZoom}
                  fill="rgba(77, 182, 196, 0.3)"
                />
                {/* User marker */}
                <circle
                  cx={0}
                  cy={0}
                  r={BASELINE_ICON_PX * LEFT_USER_ICON_SCALE * counterZoom}
                  fill="#4db6c4"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                {/* User direction indicator (triangle pointing in facing direction) */}
                {(() => {
                  const markerRadius = BASELINE_ICON_PX * LEFT_USER_ICON_SCALE * counterZoom
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
            scale={COMPASS_SCALE * counterZoom}
          />

          {/* Grade indicator in lower left corner */}
          <GradeIndicator
            rollDeg={treadmillState?.treadTilt?.x || 0}
            pitchDeg={treadmillState?.treadTilt?.y || 0}
            scale={GRADE_SCALE * counterZoom}
          />
        </Box>

        {/* Right Column - VR Position Viewer */}
        <VRPositionViewer userState={userState} />
      </Box>
    </Box>
  )
}

// VR Position Viewer Component - shows unbounded position with movement trail
function VRPositionViewer({ userState }) {
  const containerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 })
  const initialDimensionsRef = useRef(null)
  const [positionHistory, setPositionHistory] = useState([]) // Array of {x, y, timestamp}

  // Handle container resize — capture initial size for zoom-immune icon sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const size = Math.min(rect.width - 20, rect.height - 20)
        if (initialDimensionsRef.current === null && size > 0) {
          initialDimensionsRef.current = size
        }
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

  // Update position history when unbounded position changes
  useEffect(() => {
    const now = Date.now()
    const newPoint = { x: unboundedPos.x, y: unboundedPos.y, timestamp: now }

    setPositionHistory(prev => {
      // Add new point
      const updated = [...prev, newPoint]

      // Remove points older than 3 minutes
      const cutoff = now - POSITION_HISTORY_MAX_DURATION_MS
      const filtered = updated.filter(p => p.timestamp >= cutoff)

      // Limit to reasonable number of points (sample every ~100ms = ~1800 points for 3 min)
      // If we have too many points, keep every Nth point
      if (filtered.length > 2000) {
        const sampled = []
        const step = Math.ceil(filtered.length / 1500)
        for (let i = 0; i < filtered.length; i += step) {
          sampled.push(filtered[i])
        }
        // Always include the latest point
        if (sampled[sampled.length - 1] !== filtered[filtered.length - 1]) {
          sampled.push(filtered[filtered.length - 1])
        }
        return sampled
      }

      return filtered
    })
  }, [unboundedPos.x, unboundedPos.y])

  // Calculate bounding box of all positions in history
  const bounds = useMemo(() => {
    if (positionHistory.length === 0) {
      return { minX: -5, maxX: 5, minY: -5, maxY: 5 }
    }

    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const p of positionHistory) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }

    // Include current position
    minX = Math.min(minX, unboundedPos.x)
    maxX = Math.max(maxX, unboundedPos.x)
    minY = Math.min(minY, unboundedPos.y)
    maxY = Math.max(maxY, unboundedPos.y)

    // Add padding (at least 2 meters on each side, or 20% of range)
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    const paddingX = Math.max(2, rangeX * 0.2)
    const paddingY = Math.max(2, rangeY * 0.2)

    return {
      minX: minX - paddingX,
      maxX: maxX + paddingX,
      minY: minY - paddingY,
      maxY: maxY + paddingY
    }
  }, [positionHistory, unboundedPos])

  // Calculate view configuration that fits entire movement history
  const viewConfig = useMemo(() => {
    const rangeX = bounds.maxX - bounds.minX
    const rangeY = bounds.maxY - bounds.minY
    const viewSize = Math.max(rangeX, rangeY, 10) // Minimum 10 meters view

    const padding = 40
    const availableSize = Math.min(dimensions.width, dimensions.height) - padding * 2
    const scale = availableSize / viewSize // pixels per meter

    // Center of view is center of bounds
    const viewCenterX = (bounds.minX + bounds.maxX) / 2
    const viewCenterY = (bounds.minY + bounds.maxY) / 2

    return {
      scale,
      viewSize,
      viewCenterX,
      viewCenterY,
      centerX: dimensions.width / 2,
      centerY: dimensions.height / 2
    }
  }, [dimensions, bounds])

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

  // Generate path for position history
  const historyPath = useMemo(() => {
    if (positionHistory.length < 2) return ''

    const points = positionHistory.map(p => worldToSvg(p.x, p.y))
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`
    }
    return d
  }, [positionHistory, worldToSvg])

  // Generate grid lines - dynamically based on view size
  const gridLines = useMemo(() => {
    if (!viewConfig) return { vertical: [], horizontal: [] }

    const lines = { vertical: [], horizontal: [] }

    // Determine grid spacing based on view size (1m, 5m, 10m, etc.)
    let gridSpacing = 1
    if (viewConfig.viewSize > 50) gridSpacing = 10
    else if (viewConfig.viewSize > 20) gridSpacing = 5
    else if (viewConfig.viewSize > 10) gridSpacing = 2

    // Calculate grid range
    const startX = Math.floor(bounds.minX / gridSpacing) * gridSpacing
    const endX = Math.ceil(bounds.maxX / gridSpacing) * gridSpacing
    const startY = Math.floor(bounds.minY / gridSpacing) * gridSpacing
    const endY = Math.ceil(bounds.maxY / gridSpacing) * gridSpacing

    // Vertical lines
    for (let x = startX; x <= endX; x += gridSpacing) {
      const svg = worldToSvg(x, 0)
      const isMajor = x % (gridSpacing * 5) === 0 || x === 0
      lines.vertical.push({
        x: svg.x,
        label: x,
        isMajor,
        isOrigin: x === 0
      })
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSpacing) {
      const svg = worldToSvg(0, y)
      const isMajor = y % (gridSpacing * 5) === 0 || y === 0
      lines.horizontal.push({
        y: svg.y,
        label: y,
        isMajor,
        isOrigin: y === 0
      })
    }

    return lines
  }, [viewConfig, bounds, worldToSvg])

  // Icon size: 175% of 10px baseline. counterZoom derived from container resize — same
  // mechanism that keeps the SVG rendering correct, so guaranteed to track browser zoom.
  const counterZoom = initialDimensionsRef.current ? dimensions.width / initialDimensionsRef.current : 1.0
  const iconSize = BASELINE_ICON_PX * RIGHT_USER_ICON_SCALE * counterZoom

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

        {/* Movement history trail line */}
        {historyPath && (
          <path
            d={historyPath}
            fill="none"
            stroke="#4db6c4"
            strokeWidth={Math.max(1.5, iconSize / 5)}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.6"
          />
        )}

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
            ? `${Math.round((Date.now() - positionHistory[0].timestamp) / 1000)}s trail`
            : ''}
        </text>
      </svg>
    </Box>
  )
}

export default DashboardTab
