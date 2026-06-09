import React, { useEffect, useMemo, useState } from 'react'
import {
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PersonIcon from '@mui/icons-material/Person'
import SpeedIcon from '@mui/icons-material/Speed'
import DeviceHubIcon from '@mui/icons-material/DeviceHub'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import TuneIcon from '@mui/icons-material/Tune'
import LogoutIcon from '@mui/icons-material/Logout'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import PlayCircleFilledWhiteIcon from '@mui/icons-material/PlayCircleFilledWhite'
import CloudQueueIcon from '@mui/icons-material/CloudQueue'
import GroupIcon from '@mui/icons-material/Group'
import PaymentsIcon from '@mui/icons-material/Payments'
import InsightsIcon from '@mui/icons-material/Insights'
import HubIcon from '@mui/icons-material/Hub'
import BuildIcon from '@mui/icons-material/Build'
import MovieIcon from '@mui/icons-material/Movie'

import DashboardTab from './pages/device/DashboardTab'
import UserTab from './pages/device/UserTab'
import TreadmillTab from './pages/device/TreadmillTab'
import ServicesTab from './pages/device/ServicesTab'
import EventsTab from './pages/device/EventsTab'
import ConfigurationTab from './pages/device/ConfigurationTab'
import ContentPage from './pages/cloud/ContentPage'
import UsersPage from './pages/cloud/UsersPage'
import BillingPage from './pages/cloud/BillingPage'
import UsagePage from './pages/cloud/UsagePage'
import FleetPage from './pages/cloud/FleetPage'
import MaintenancePage from './pages/cloud/MaintenancePage'

import { AuthProvider, useAuth } from './auth/useAuth'
import AuthCallback from './auth/AuthCallback'
import ProtectedRoute from './auth/ProtectedRoute'
import DeviceOfflineBanner, { DeviceOfflinePanel } from './components/shared/DeviceOfflineBanner'
import { useDeviceOnline } from './hooks/useDeviceOnline'
import {
  setAuthToken,
  clearAuthToken,
  setRefreshCallback,
  setLoginCallback,
  getTelemetryCurrent,
  triggerSafetyStop,
  triggerSafetyStart,
} from './api/device'
import { setCloudAuthToken, clearCloudAuthToken } from './api/cloud'

const DEVICE_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, panel: (props) => <DashboardTab {...props} /> },
  { id: 'user', label: 'User', icon: <PersonIcon />, panel: (props) => <UserTab {...props} /> },
  { id: 'treadmill', label: 'Treadmill', icon: <SpeedIcon />, panel: (props) => <TreadmillTab {...props} /> },
  { id: 'services', label: 'Services', icon: <DeviceHubIcon />, panel: (props) => <ServicesTab {...props} /> },
  { id: 'events', label: 'Events', icon: <ReportProblemIcon />, panel: (props) => <EventsTab {...props} /> },
  { id: 'config', label: 'Config', icon: <TuneIcon />, panel: (props) => <ConfigurationTab {...props} /> },
]

const CLOUD_ITEMS = [
  { id: 'content', label: 'Content', icon: <MovieIcon />, panel: () => <ContentPage /> },
  { id: 'users', label: 'Users', icon: <GroupIcon />, panel: () => <UsersPage /> },
  { id: 'billing', label: 'Billing', icon: <PaymentsIcon />, panel: () => <BillingPage /> },
  { id: 'usage', label: 'Usage', icon: <InsightsIcon />, panel: () => <UsagePage /> },
  { id: 'fleet', label: 'Fleet', icon: <HubIcon />, panel: () => <FleetPage /> },
  { id: 'maintenance', label: 'Maintenance', icon: <BuildIcon />, panel: () => <MaintenancePage /> },
]

const MENU_GROUPS = [
  { id: 'local', label: 'Local Device', items: DEVICE_ITEMS },
  { id: 'cloud', label: 'Cloud Management', items: CLOUD_ITEMS },
]

function TabPanel({ children, isActive, noPadding = false, scrollable = false }) {
  return (
    <div role="tabpanel" hidden={!isActive} style={{ height: '100%' }}>
      {isActive && (
        <Box
          sx={{
            py: noPadding ? 0 : 3,
            px: noPadding ? 0 : { xs: 2, md: 3 },
            pb: noPadding ? 0 : 4,
            height: '100%',
            overflowY: scrollable ? 'auto' : 'visible',
            overflowX: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </Box>
      )}
    </div>
  )
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { accessToken, user, logout, refreshAccessToken, login } = useAuth()
  const deviceOnline = useDeviceOnline()
  const [treadmillState, setTreadmillState] = useState(null)
  const [safetyActionBusy, setSafetyActionBusy] = useState(false)
  const [safetyStopLatched, setSafetyStopLatched] = useState(false)
  const [safetyActionPending, setSafetyActionPending] = useState(null)

  const allItems = useMemo(() => MENU_GROUPS.flatMap((group) => group.items), [])
  const activeItem = allItems.find((item) => item.id === activeTab) || allItems[0]
  const isDeviceTab = DEVICE_ITEMS.some((item) => item.id === activeTab)

  const isSafetyStopState = treadmillState === 3
  const isOperatingState = treadmillState === 2
  const showSafetyStart = safetyStopLatched || isSafetyStopState
  const isSafetyControlBusy = safetyActionBusy || safetyActionPending !== null
  const canSafetyStop = !isSafetyControlBusy && isOperatingState && deviceOnline
  const canSafetyStart = !isSafetyControlBusy && showSafetyStart && deviceOnline

  useEffect(() => {
    if (accessToken) {
      setAuthToken(accessToken)
      setCloudAuthToken(accessToken)
    } else {
      clearAuthToken()
      clearCloudAuthToken()
    }
  }, [accessToken])

  useEffect(() => {
    setRefreshCallback(refreshAccessToken)
    setLoginCallback(login)
    return () => {
      setRefreshCallback(null)
      setLoginCallback(null)
    }
  }, [refreshAccessToken, login])

  useEffect(() => {
    if (!deviceOnline) {
      return undefined
    }

    let mounted = true
    const fetchTreadmillState = async () => {
      const { data, noContent } = await getTelemetryCurrent()
      if (!mounted || noContent || !data?.tread) {
        return
      }
      const state = data.tread.state
      setTreadmillState(state)
      if (state === 3) {
        setSafetyStopLatched(true)
        if (safetyActionPending === 'stop') setSafetyActionPending(null)
      }
      if (state === 2) {
        setSafetyStopLatched(false)
        if (safetyActionPending === 'start') setSafetyActionPending(null)
      }
    }

    fetchTreadmillState()
    const interval = setInterval(fetchTreadmillState, 500)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [safetyActionPending, deviceOnline])

  const handleSafetyStop = async () => {
    if (!canSafetyStop) return
    setSafetyActionBusy(true)
    const { error } = await triggerSafetyStop()
    if (!error) {
      setSafetyStopLatched(true)
      setSafetyActionPending('stop')
    } else {
      setSafetyActionPending(null)
    }
    setSafetyActionBusy(false)
  }

  const handleSafetyStart = async () => {
    if (!canSafetyStart) return
    setSafetyActionBusy(true)
    const { error } = await triggerSafetyStart()
    if (!error) {
      setSafetyActionPending('start')
    } else {
      setSafetyActionPending(null)
    }
    setSafetyActionBusy(false)
  }

  const safetyButtonColor = showSafetyStart ? 'success' : 'error'
  const safetyButtonIcon = showSafetyStart ? <PlayCircleFilledWhiteIcon /> : <StopCircleIcon />
  const safetyButtonDisabled = showSafetyStart ? !canSafetyStart : !canSafetyStop
  let safetyButtonLabel = showSafetyStart ? 'Start' : 'Safety Stop'
  if (safetyActionBusy) {
    safetyButtonLabel = showSafetyStart ? 'Starting...' : 'Stopping...'
  } else if (safetyActionPending === 'stop') {
    safetyButtonLabel = 'Stopping...'
  } else if (safetyActionPending === 'start') {
    safetyButtonLabel = 'Starting...'
  }

  const handleSafetyAction = showSafetyStart ? handleSafetyStart : handleSafetyStop

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
            <img src="/BanditLogo.svg" alt="Bandit Logo" style={{ height: '48px', width: 'auto' }} />
            <Typography
              variant="h4"
              component="div"
              sx={{
                fontWeight: 600,
                fontFamily: '"Montserrat", sans-serif',
                letterSpacing: '1px',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
              }}
            >
              BANDIT ARENA
            </Typography>
            <Chip icon={<CloudQueueIcon />} size="small" label="Unified Console" variant="outlined" />
          </Box>
          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="contained"
                color={safetyButtonColor}
                size="small"
                startIcon={isSafetyControlBusy ? <CircularProgress size={14} color="inherit" /> : safetyButtonIcon}
                onClick={handleSafetyAction}
                disabled={safetyButtonDisabled}
                sx={{ borderRadius: 999, px: 1.5, fontWeight: 700 }}
              >
                {safetyButtonLabel}
              </Button>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {user.username}
              </Typography>
              <Button color="inherit" size="small" startIcon={<LogoutIcon />} onClick={logout}>
                Sign out
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {deviceOnline === false && isDeviceTab && <DeviceOfflineBanner />}

      <Box sx={{ display: 'flex', flexGrow: 1 }}>
        <Box
          sx={{
            borderRight: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            width: 280,
            overflowY: 'auto',
          }}
        >
          {MENU_GROUPS.map((group, groupIndex) => (
            <Box key={group.id}>
              <Typography
                variant="overline"
                sx={{
                  display: 'block',
                  px: 2,
                  pt: groupIndex === 0 ? 2 : 1,
                  pb: 1,
                  color: 'text.secondary',
                  letterSpacing: 1,
                  fontWeight: 700,
                }}
              >
                {group.label}
              </Typography>
              <List dense sx={{ pt: 0 }}>
                {group.items.map((item) => (
                  <ListItemButton
                    key={item.id}
                    selected={activeTab === item.id}
                    onClick={() => setActiveTab(item.id)}
                    sx={{ mx: 1, borderRadius: 1 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      secondary={
                        group.id === 'local' && deviceOnline === false ? 'offline' : undefined
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
              {groupIndex < MENU_GROUPS.length - 1 && <Divider sx={{ mt: 1 }} />}
            </Box>
          ))}
        </Box>

        <Box sx={{ flexGrow: 1, py: 0, height: 'calc(100vh - 64px - 56px)', overflow: 'hidden' }}>
          <TabPanel
            isActive
            noPadding={activeItem.id === 'dashboard'}
            scrollable={activeItem.id !== 'dashboard'}
          >
            {isDeviceTab && deviceOnline === false ? (
              <DeviceOfflinePanel />
            ) : (
              activeItem.panel({ treadmillState })
            )}
          </TabPanel>
        </Box>
      </Box>

      <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          mt: 'auto',
          backgroundColor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="body2" color="text.secondary" align="center">
          Bandit VR Treadmill System © {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  )
}

function App() {
  const isCallback = window.location.pathname === '/auth/callback'

  return (
    <AuthProvider>
      {isCallback ? (
        <AuthCallback />
      ) : (
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      )}
    </AuthProvider>
  )
}

export default App
