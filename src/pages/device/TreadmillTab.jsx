import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  Typography,
  Grid,
  Box,
  Chip,
  Alert,
  CircularProgress,
  LinearProgress,
  Button,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { getTelemetryCurrent } from '../../api/device'

const MAX_CONSECUTIVE_FAILURES = 5

const TreadmillStateMap = {
  0: { label: 'Startup', color: 'warning' },
  1: { label: 'Failure', color: 'error' },
  2: { label: 'Operating', color: 'success' },
  3: { label: 'Safety Stop', color: 'error' },
}

function TreadmillTab() {
  const [treadmillState, setTreadmillState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [apiConnected, setApiConnected] = useState(true)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)

  const fetchTreadmillStatus = async () => {
    const { data, error: fetchError, noContent } = await getTelemetryCurrent()
    if (fetchError) {
      console.error('TreadmillTab fetch error:', fetchError)
      setConsecutiveFailures(prev => {
        const newCount = prev + 1
        if (newCount >= MAX_CONSECUTIVE_FAILURES) {
          setApiConnected(false)
          setError(fetchError)
        }
        return newCount
      })
    } else if (noContent) {
      // Server returned 204 - no data yet, not an error
      console.debug('TreadmillTab: Waiting for telemetry data...')
    } else if (data?.tread) {
      console.debug('TreadmillTab received data:', data.tread)
      // Map telemetry tread data to expected format
      setTreadmillState({
        treadVelocity: data.tread.vel,
        treadSpeed: data.tread.speed || 0,
        treadDirection: data.tread.dir,
        treadTilt: data.tread.tilt,
        treadmillState: data.tread.state,
        avatarVirtualVelocity: data.avatar?.vel,
        timestamp: data.ts
      })
      setError(null)
      setConsecutiveFailures(0)
      setApiConnected(true)
    } else {
      console.warn('TreadmillTab: Got response but no tread data:', data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchTreadmillStatus()
    const interval = setInterval(fetchTreadmillStatus, 500) // Update twice per second
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    )
  }

  if (!apiConnected) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="300px" gap={2}>
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
            fetchTreadmillStatus()
          }} 
          startIcon={<RefreshIcon />}
        >
          Retry Connection
        </Button>
      </Box>
    )
  }

  const statusInfo = TreadmillStateMap[treadmillState?.treadmillState] || TreadmillStateMap[0]
  const speedProgress = (treadmillState?.treadSpeed / 5.0) * 100 // Assuming max speed 5.0 m/s
  const avatarVirtualSpeed = Math.sqrt(
    Math.pow(treadmillState?.avatarVirtualVelocity?.x || 0, 2) +
    Math.pow(treadmillState?.avatarVirtualVelocity?.y || 0, 2)
  )
  const avatarVirtualSpeedProgress = (avatarVirtualSpeed / 5.0) * 100

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Treadmill Status
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Chip 
                label={statusInfo.label} 
                color={statusInfo.color} 
                size="large"
                sx={{ fontSize: '1.1rem', py: 3 }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Tread Velocity
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Speed
              </Typography>
              <Typography variant="h3">
                {treadmillState?.treadSpeed?.toFixed(2) || '0.00'} m/s
              </Typography>
              <Box sx={{ mt: 2, mb: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(speedProgress, 100)} 
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    X Velocity
                  </Typography>
                  <Typography variant="h5">
                    {treadmillState?.treadVelocity?.x?.toFixed(3) || '0.000'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Y Velocity
                  </Typography>
                  <Typography variant="h5">
                    {treadmillState?.treadVelocity?.y?.toFixed(3) || '0.000'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Platform Tilt
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  X (Roll)
                </Typography>
                <Typography variant="h5">
                  {treadmillState?.treadTilt?.x?.toFixed(3) || '0.000'}°
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Y (Pitch)
                </Typography>
                <Typography variant="h5">
                  {treadmillState?.treadTilt?.y?.toFixed(3) || '0.000'}°
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Avatar Virtual Velocity (VR Movement) */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Avatar Virtual Velocity
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Speed
              </Typography>
              <Typography variant="h3">
                {avatarVirtualSpeed.toFixed(2)} m/s
              </Typography>
              <Box sx={{ mt: 2, mb: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(avatarVirtualSpeedProgress, 100)}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    X Velocity
                  </Typography>
                  <Typography variant="h5">
                    {treadmillState?.avatarVirtualVelocity?.x?.toFixed(3) || '0.000'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Y Velocity
                  </Typography>
                  <Typography variant="h5">
                    {treadmillState?.avatarVirtualVelocity?.y?.toFixed(3) || '0.000'}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default TreadmillTab
