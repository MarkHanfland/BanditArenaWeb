import React, { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Button,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import ErrorIcon from '@mui/icons-material/Error'
import WarningIcon from '@mui/icons-material/Warning'
import InfoIcon from '@mui/icons-material/Info'
import SecurityIcon from '@mui/icons-material/Security'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import { getErrorEvents, getSafetyEvents } from '../../api/device'

const MAX_CONSECUTIVE_FAILURES = 3

// Error type severity colors
const errorTypeColors = {
  WARNING: 'warning',
  RECOVERABLE_ERROR: 'warning',
  CONFIGURATION_ERROR: 'error',
  HARDWARE_FAULT: 'error',
  COMMUNICATION_ERROR: 'warning',
  CRITICAL_FAILURE: 'error',
  SAFETY_INCIDENT: 'error',
  GENERAL_ERROR: 'default',
}

// Safety severity colors
const severityColors = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'error',
}

// Safety event type icons
const safetyEventIcons = {
  FALL_DETECTED: <ReportProblemIcon color="error" />,
  STUMBLE_DETECTED: <WarningIcon color="warning" />,
  TRACKING_LOST: <ErrorIcon color="warning" />,
  LOW_CONFIDENCE: <InfoIcon color="info" />,
  BOUNDARY_WARNING: <WarningIcon color="warning" />,
  BOUNDARY_VIOLATION: <ErrorIcon color="error" />,
  EMERGENCY_STOP: <ReportProblemIcon color="error" />,
  SENSOR_FAILURE: <ErrorIcon color="error" />,
  RECOVERY: <InfoIcon color="success" />,
}

function EventsTab() {
  const [activeTab, setActiveTab] = useState(0)
  const [errorEvents, setErrorEvents] = useState([])
  const [safetyEvents, setSafetyEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchFilter, setSearchFilter] = useState('')
  const [apiConnected, setApiConnected] = useState(true)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    
    try {
      const [errorResult, safetyResult] = await Promise.all([
        getErrorEvents(),
        getSafetyEvents()
      ])
      
      // Check if both calls failed
      if (errorResult.error && safetyResult.error) {
        setConsecutiveFailures(prev => {
          const newCount = prev + 1
          if (newCount >= MAX_CONSECUTIVE_FAILURES) {
            setApiConnected(false)
            setError(errorResult.error)
          }
          return newCount
        })
      } else {
        // At least one succeeded
        setConsecutiveFailures(0)
        setApiConnected(true)
        setError(null)
        
        if (!errorResult.error) {
          // Reverse to show newest first
          setErrorEvents((errorResult.data?.events || []).reverse())
        }
        
        if (!safetyResult.error) {
          // Reverse to show newest first
          setSafetyEvents((safetyResult.data?.events || []).reverse())
        }
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    
    // Poll every 5 seconds
    const interval = setInterval(fetchEvents, 5000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  const filteredErrorEvents = errorEvents.filter(event => {
    if (!searchFilter) return true
    const lowerFilter = searchFilter.toLowerCase()
    return (
      event.errorType?.toLowerCase().includes(lowerFilter) ||
      event.summary?.toLowerCase().includes(lowerFilter) ||
      event.detail?.toLowerCase().includes(lowerFilter) ||
      event.timestamp?.toLowerCase().includes(lowerFilter)
    )
  })

  const filteredSafetyEvents = safetyEvents.filter(event => {
    if (!searchFilter) return true
    const lowerFilter = searchFilter.toLowerCase()
    return (
      event.eventType?.toLowerCase().includes(lowerFilter) ||
      event.severity?.toLowerCase().includes(lowerFilter) ||
      event.source?.toLowerCase().includes(lowerFilter) ||
      event.message?.toLowerCase().includes(lowerFilter) ||
      event.timestamp?.toLowerCase().includes(lowerFilter)
    )
  })

  if (loading && errorEvents.length === 0 && safetyEvents.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
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
            fetchEvents()
          }} 
          startIcon={<RefreshIcon />}
        >
          Retry Connection
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* Header with actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Safety & Error Events
        </Typography>
        
        <Tooltip title="Refresh events">
          <IconButton onClick={fetchEvents} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading events: {error}
        </Alert>
      )}

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            '& .MuiTab-root': {
              minHeight: 56,
              textTransform: 'none',
              fontSize: '0.95rem',
            }
          }}
        >
          <Tab 
            icon={<SecurityIcon />} 
            iconPosition="start" 
            label="Safety Events"
          />
          <Tab 
            icon={<ErrorIcon />} 
            iconPosition="start" 
            label="Error Events"
          />
        </Tabs>
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        placeholder="Search events..."
        value={searchFilter}
        onChange={(e) => setSearchFilter(e.target.value)}
        sx={{ mb: 3 }}
        size="small"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />

      {/* Safety Events Tab */}
      {activeTab === 0 && (
        <Box>
          {filteredSafetyEvents.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <SecurityIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography color="text.secondary">
                No safety events recorded
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell width={50}></TableCell>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Event Type</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Confidence</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSafetyEvents.map((event, index) => (
                    <TableRow 
                      key={index}
                      sx={{ 
                        '&:hover': { backgroundColor: 'action.hover' },
                        backgroundColor: event.severity === 'CRITICAL' ? 'error.light' : 'inherit',
                        opacity: event.severity === 'CRITICAL' ? 0.9 : 1,
                      }}
                    >
                      <TableCell>
                        {safetyEventIcons[event.eventType] || <InfoIcon />}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {event.timestamp}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={event.eventType?.replace(/_/g, ' ')} 
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={event.severity} 
                          size="small"
                          color={severityColors[event.severity] || 'default'}
                        />
                      </TableCell>
                      <TableCell>{event.source}</TableCell>
                      <TableCell>
                        {event.confidence !== undefined ? `${(event.confidence * 100).toFixed(0)}%` : '-'}
                      </TableCell>
                      <TableCell>{event.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Error Events Tab */}
      {activeTab === 1 && (
        <Box>
          {filteredErrorEvents.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <ErrorIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography color="text.secondary">
                No error events recorded
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Error Type</TableCell>
                    <TableCell>Summary</TableCell>
                    <TableCell>Detail</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredErrorEvents.map((event, index) => (
                    <TableRow 
                      key={index}
                      sx={{ 
                        '&:hover': { backgroundColor: 'action.hover' },
                        backgroundColor: event.errorType === 'CRITICAL_FAILURE' ? 'error.light' : 'inherit',
                      }}
                    >
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {event.timestamp}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={event.errorType?.replace(/_/g, ' ')} 
                          size="small"
                          color={errorTypeColors[event.errorType] || 'default'}
                        />
                      </TableCell>
                      <TableCell>{event.summary}</TableCell>
                      <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Tooltip title={event.detail || ''}>
                          <span>{event.detail || '-'}</span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Footer info */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Showing last 100 events (auto-refreshes every 5 seconds)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {activeTab === 0 
            ? `${filteredSafetyEvents.length} safety events`
            : `${filteredErrorEvents.length} error events`
          }
        </Typography>
      </Box>
    </Box>
  )
}

export default EventsTab
