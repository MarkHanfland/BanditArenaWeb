import React, { useEffect, useState } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import {
  getServicesStatus,
  getTelemetryCurrent,
  getTelemetryStats,
} from '../../api/device'
import { treadmillStateInfo } from '../../device/treadmillState'
import { SESSION_PHASE, usePlayerSession } from '../../session/PlayerSessionContext'
import PlayerSessionControls from './PlayerSessionControls'

function SpeedMeter({ label, value, maxValue, color, glowColor, unit = 'm/s' }) {
  const percentage = Math.min((value / maxValue) * 100, 100)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 140 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: '#888',
            fontWeight: 600,
            letterSpacing: 1,
            fontSize: '10px',
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color,
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: '13px',
            textShadow: `0 0 8px ${glowColor}`,
          }}
        >
          {value.toFixed(2)} {unit}
        </Typography>
      </Box>
      <Box
        sx={{
          position: 'relative',
          height: 8,
          borderRadius: 4,
          backgroundColor: 'rgba(255,255,255,0.05)',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'space-between',
            px: 0.5,
            alignItems: 'center',
          }}
        >
          {[...Array(10)].map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 1,
                height: '60%',
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </Box>
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${color}66, ${color})`,
            borderRadius: 4,
            boxShadow: `0 0 12px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.3)`,
            transition: 'width 0.15s ease-out',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        />
      </Box>
    </Box>
  )
}

function SessionStat({ label, value, color, testId }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
      <Typography
        variant="caption"
        sx={{
          color: '#666',
          fontWeight: 600,
          letterSpacing: 1,
          fontSize: '9px',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="caption"
        data-testid={testId}
        sx={{
          color,
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: '14px',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

/**
 * Page-level device status band: player controls first, then live telemetry.
 */
export default function DeviceStatusBand({ deviceOnline = true }) {
  const { phase, formattedElapsed, statusNotice } = usePlayerSession()
  const [treadSpeed, setTreadSpeed] = useState(0)
  const [avatarSpeed, setAvatarSpeed] = useState(0)
  const [operatingState, setOperatingState] = useState(null)
  const [vrDistanceMeters, setVrDistanceMeters] = useState(0)
  const [openxrLinkHealthy, setOpenxrLinkHealthy] = useState(null)

  useEffect(() => {
    if (!deviceOnline) return undefined
    let mounted = true
    const fetchServiceStatus = async () => {
      const { data, error: fetchError } = await getServicesStatus()
      if (fetchError || !data?.services || !mounted) return
      const oxrService = data.services.find((s) => s.serviceName === 'OpenXR_Driver')
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
  }, [deviceOnline])

  useEffect(() => {
    if (!deviceOnline) return undefined
    let mounted = true
    const fetchStatus = async () => {
      const { data, noContent } = await getTelemetryCurrent()
      if (!mounted || noContent || !data) return
      const tSpeed = data.tread?.speed || 0
      const av = data.avatar?.vel
      const ax = av?.x || 0
      const ay = av?.y || 0
      setTreadSpeed(tSpeed)
      setAvatarSpeed(Math.sqrt(ax * ax + ay * ay))
      if (data.tread?.state != null) {
        setOperatingState(data.tread.state)
      }
    }
    fetchStatus()
    const interval = setInterval(fetchStatus, 200)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [deviceOnline])

  useEffect(() => {
    if (!deviceOnline) return undefined
    let mounted = true
    const fetchStats = async () => {
      const { data } = await getTelemetryStats()
      if (!mounted || !data) return
      setVrDistanceMeters(data.avatar?.totalDistance || 0)
    }
    fetchStats()
    const interval = setInterval(fetchStats, 2000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [deviceOnline])

  const sessionTimeActive = phase === SESSION_PHASE.active
  const formattedSessionTime = sessionTimeActive ? formattedElapsed : '—'
  const treadmillInfo = treadmillStateInfo(operatingState)

  if (!deviceOnline) {
    return null
  }

  return (
    <Box sx={{ flexShrink: 0 }} data-testid="device-status-band">
      {statusNotice ? (
        <Box
          data-testid="session-status-notice"
          sx={{
            px: 2,
            py: 0.75,
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: 'rgba(255, 167, 38, 0.08)',
          }}
        >
          <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>
            {statusNotice}
          </Typography>
        </Box>
      ) : null}
      <Paper
        elevation={2}
        data-testid="device-status-bar"
        sx={{
          borderRadius: 0,
          px: 2,
          py: 1.25,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2.5,
          flexWrap: 'wrap',
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(30,35,40,1) 0%, rgba(24,28,32,1) 100%)',
        }}
      >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
          flexWrap: 'wrap',
          flex: 1,
          minWidth: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <PlayerSessionControls compact deviceOnline={deviceOnline} part="player" />
        </Box>

        <SpeedMeter
          label="AVATAR SPEED"
          value={avatarSpeed}
          maxValue={6}
          color="#00e5ff"
          glowColor="rgba(0,229,255,0.5)"
        />
        <SpeedMeter
          label="TREAD SPEED"
          value={treadSpeed}
          maxValue={6}
          color="#00e5ff"
          glowColor="rgba(0,229,255,0.5)"
        />
        <SessionStat
          label="TREADMILL"
          value={treadmillInfo.label}
          color="#00e5ff"
          testId="dashboard-treadmill-state"
        />
        <SessionStat
          label="OPENXR DRIVER"
          value={openxrLinkHealthy === null ? 'Detecting...' : openxrLinkHealthy ? 'Running' : 'Disabled'}
          color={openxrLinkHealthy ? '#00d4aa' : '#ef5350'}
        />
        <SessionStat
          label="VR DISTANCE"
          value={
            vrDistanceMeters >= 1000
              ? `${(vrDistanceMeters / 1000).toFixed(2)} km`
              : `${vrDistanceMeters.toFixed(1)} m`
          }
          color="#00e5ff"
        />
        <SessionStat
          label="SESSION TIME"
          value={formattedSessionTime}
          color={sessionTimeActive ? '#00e5ff' : '#666'}
          testId="dashboard-session-time"
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, ml: 'auto' }}>
        <PlayerSessionControls compact deviceOnline={deviceOnline} part="action" />
      </Box>
    </Paper>
    </Box>
  )
}
