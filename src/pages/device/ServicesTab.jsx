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
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
} from '@mui/material'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import StopIcon from '@mui/icons-material/Stop'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import RefreshIcon from '@mui/icons-material/Refresh'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import PersonIcon from '@mui/icons-material/Person'
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun'
import MemoryIcon from '@mui/icons-material/Memory'
import ExploreIcon from '@mui/icons-material/Explore'
import SpeedIcon from '@mui/icons-material/Speed'
import DeviceHubIcon from '@mui/icons-material/DeviceHub'
import ShieldIcon from '@mui/icons-material/Shield'
import SettingsIcon from '@mui/icons-material/Settings'
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew'
import SensorsIcon from '@mui/icons-material/Sensors'
import VideocamIcon from '@mui/icons-material/Videocam'
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing'
import { getServicesStatus, restartService, stopService, startService } from '../../api/device'

const MAX_CONSECUTIVE_FAILURES = 5

function getServiceIcon(serviceName) {
  const normalizedName = String(serviceName || '').toLowerCase().replace(/[^a-z0-9]/g, '')

  if (normalizedName.includes('kinect')) return <CameraAltIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('camera')) return <VideocamIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('usersimulator')) return <AccessibilityNewIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('user')) return <PersonIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('pose')) return <DirectionsRunIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('treadmill')) return <MemoryIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('stepper')) return <ExploreIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('vesc')) return <SpeedIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('actuator')) return <PrecisionManufacturingIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('safety')) return <ShieldIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('motor')) return <SettingsIcon sx={{ color: '#ffffff', fontSize: 24 }} />
  if (normalizedName.includes('service')) return <SensorsIcon sx={{ color: '#ffffff', fontSize: 24 }} />

  return <DeviceHubIcon sx={{ color: '#ffffff', fontSize: 24 }} />
}

function ServicesTab() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState({})
  const [apiConnected, setApiConnected] = useState(true)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)

  const fetchServicesStatus = async () => {
    const { data, error } = await getServicesStatus()
    if (error) {
      setConsecutiveFailures(prev => {
        const newCount = prev + 1
        if (newCount >= MAX_CONSECUTIVE_FAILURES) {
          setApiConnected(false)
          setError(error)
        }
        return newCount
      })
    } else {
      // Sort services by startupSequence
      const sortedServices = (data.services || []).sort((a, b) => 
        (a.startupSequence || 999) - (b.startupSequence || 999)
      )
      setServices(sortedServices)
      setError(null)
      setConsecutiveFailures(0)
      setApiConnected(true)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchServicesStatus()
    const interval = setInterval(fetchServicesStatus, 2000) // Update every 2 seconds
    return () => clearInterval(interval)
  }, [])

  const handleRestart = async (serviceName) => {
    setActionLoading({ ...actionLoading, [serviceName]: 'restart' })
    const { error } = await restartService(serviceName)
    if (error) {
      setError(`Failed to restart ${serviceName}: ${error}`)
    }
    setActionLoading({ ...actionLoading, [serviceName]: null })
    await fetchServicesStatus()
  }

  const handleStop = async (serviceName) => {
    setActionLoading({ ...actionLoading, [serviceName]: 'stop' })
    const { error } = await stopService(serviceName)
    if (error) {
      setError(`Failed to stop ${serviceName}: ${error}`)
    }
    setActionLoading({ ...actionLoading, [serviceName]: null })
    await fetchServicesStatus()
  }

  const handleStart = async (serviceName) => {
    setActionLoading({ ...actionLoading, [serviceName]: 'start' })
    const { error } = await startService(serviceName)
    if (error) {
      setError(`Failed to start ${serviceName}: ${error}`)
    }
    setActionLoading({ ...actionLoading, [serviceName]: null })
    await fetchServicesStatus()
  }

  const getHealthColor = (secondsSinceHeartbeat) => {
    if (secondsSinceHeartbeat < 3) return 'success'
    if (secondsSinceHeartbeat < 10) return 'warning'
    return 'error'
  }

  const getHealthIcon = (secondsSinceHeartbeat) => {
    if (secondsSinceHeartbeat < 3) return <CheckCircleIcon />
    return <ErrorIcon />
  }

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
            fetchServicesStatus()
          }} 
          startIcon={<RefreshIcon />}
        >
          Retry Connection
        </Button>
      </Box>
    )
  }

  return (
    <Grid container spacing={3}>
      {error && (
        <Grid item xs={12}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Grid>
      )}

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Service Health
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
              {services.map((service) => (
                <Chip
                  key={service.serviceName}
                  icon={getHealthIcon(service.secondsSinceLastHeartbeat)}
                  label={`${service.serviceName} (${service.secondsSinceLastHeartbeat}s)`}
                  color={getHealthColor(service.secondsSinceLastHeartbeat)}
                  variant={service.running ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center" sx={{ width: '60px' }}>Order</TableCell>
                <TableCell>Service Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Restart Count</TableCell>
                <TableCell align="right">Last Heartbeat</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.serviceName}>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight="medium" color="text.secondary">
                      {service.startupSequence || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell component="th" scope="row">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {getServiceIcon(service.serviceName)}
                      <Typography variant="body1" fontWeight="bold">
                        {service.serviceName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {service.description || 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={service.running ? 'Running' : 'Stopped'}
                        color={service.running ? 'success' : 'error'}
                        size="small"
                      />
                      {service.enabled && (
                        <Chip
                          label="Enabled"
                          color="info"
                          size="small"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="right">

                    {service.restartCount}
                  </TableCell>
                  <TableCell align="right">
                    <Chip
                      label={`${service.secondsSinceLastHeartbeat}s ago`}
                      color={getHealthColor(service.secondsSinceLastHeartbeat)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                      {service.running ? (
                        <>
                          <Tooltip title="Restart Service">
                            <IconButton
                              color="warning"
                              size="small"
                              onClick={() => handleRestart(service.serviceName)}
                              disabled={actionLoading[service.serviceName]}
                            >
                              {actionLoading[service.serviceName] === 'restart' ? (
                                <CircularProgress size={20} />
                              ) : (
                                <RestartAltIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Stop Service">
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => handleStop(service.serviceName)}
                              disabled={actionLoading[service.serviceName]}
                            >
                              {actionLoading[service.serviceName] === 'stop' ? (
                                <CircularProgress size={20} />
                              ) : (
                                <StopIcon />
                              )}
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <Tooltip title="Start Service">
                          <IconButton
                            color="success"
                            size="small"
                            onClick={() => handleStart(service.serviceName)}
                            disabled={actionLoading[service.serviceName]}
                          >
                            {actionLoading[service.serviceName] === 'start' ? (
                              <CircularProgress size={20} />
                            ) : (
                              <PlayArrowIcon />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </Grid>
  )
}

export default ServicesTab
