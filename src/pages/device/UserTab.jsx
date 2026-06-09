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
  Button,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { getTelemetryCurrent } from '../../api/device'

const MAX_CONSECUTIVE_FAILURES = 5

const UserStatusMap = {
  0: { label: 'Stopped', color: 'default' },
  1: { label: 'Operating', color: 'success' },
  2: { label: 'Fall Detected', color: 'error' },
  3: { label: 'Present', color: 'info' },
  4: { label: 'None', color: 'default' },
}

function UserTab() {
  const [userState, setUserState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [apiConnected, setApiConnected] = useState(true)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)

  const fetchUserStatus = async () => {
    const { data, error: fetchError, noContent } = await getTelemetryCurrent()
    if (fetchError) {
      console.error('UserTab fetch error:', fetchError)
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
      console.debug('UserTab: Waiting for telemetry data...')
    } else if (data?.user) {
      console.debug('UserTab received data:', data.user)
      // Compute speed from velocity magnitude
      const velX = data.user.vel?.x || 0
      const velY = data.user.vel?.y || 0
      const computedSpeed = Math.sqrt(velX * velX + velY * velY)
      
      // Map telemetry user data to expected format
      setUserState({
        userPosition: data.user.pos,
        userVelocity: data.user.vel,
        userFacingDirection: data.user.facing,
        userDirection: data.user.moveDir || data.user.facing,
        userSpeed: computedSpeed,
        virtualSpeed: computedSpeed,
        userStatus: data.user.status,
        distanceFromCenter: data.user.dist,
        timestamp: data.ts
      })
      setError(null)
      setConsecutiveFailures(0)
      setApiConnected(true)
    } else {
      console.warn('UserTab: Got response but no user data:', data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUserStatus()
    const interval = setInterval(fetchUserStatus, 1000) // Update every second
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
            fetchUserStatus()
          }} 
          startIcon={<RefreshIcon />}
        >
          Retry Connection
        </Button>
      </Box>
    )
  }

  const statusInfo = UserStatusMap[userState?.userStatus] || UserStatusMap[4]

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              User Status
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
              Speed & Direction
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" color="text.secondary">
                Avatar Speed
              </Typography>
              <Typography variant="h4">
                {userState?.userSpeed?.toFixed(2) || '0.00'} m/s
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Position
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  X Position
                </Typography>
                <Typography variant="h5">
                  {userState?.userPosition?.x?.toFixed(3) || '0.000'} m
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Y Position
                </Typography>
                <Typography variant="h5">
                  {userState?.userPosition?.y?.toFixed(3) || '0.000'} m
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Direction Vector
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  X Direction
                </Typography>
                <Typography variant="h5">
                  {userState?.userDirection?.x?.toFixed(3) || '0.000'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Y Direction
                </Typography>
                <Typography variant="h5">
                  {userState?.userDirection?.y?.toFixed(3) || '0.000'}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

    </Grid>
  )
}

export default UserTab
