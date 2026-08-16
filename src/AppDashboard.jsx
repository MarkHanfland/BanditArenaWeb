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
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import BusinessIcon from '@mui/icons-material/Business'
import InsightsIcon from '@mui/icons-material/Insights'
import HubIcon from '@mui/icons-material/Hub'
import BuildIcon from '@mui/icons-material/Build'
import MovieIcon from '@mui/icons-material/Movie'
import EventIcon from '@mui/icons-material/Event'

import DashboardTab from './pages/device/DashboardTab'
import UserTab from './pages/device/UserTab'
import TreadmillTab from './pages/device/TreadmillTab'
import ServicesTab from './pages/device/ServicesTab'
import EventsTab from './pages/device/EventsTab'
import ConfigurationTab from './pages/device/ConfigurationTab'
import MediaPage from './pages/cloud/MediaPage'
import UsersPage from './pages/cloud/UsersPage'
import BillingPage from './pages/cloud/BillingPage'
import StaffPage from './pages/cloud/StaffPage'
import OrganizationsPage from './pages/cloud/OrganizationsPage'
import UsagePage from './pages/cloud/UsagePage'
import FleetPage from './pages/cloud/FleetPage'
import MaintenancePage from './pages/cloud/MaintenancePage'
import ReservationsPage from './pages/cloud/ReservationsPage'

import { useAuth } from './auth/useAuth'
import { filterMenuGroups } from './auth/rolePermissions'
import { DeviceOfflinePanel } from './components/shared/DeviceOfflineBanner'
import { useDeviceOnline } from './hooks/useDeviceOnline'
import DeviceStatusBand from './components/shared/DeviceStatusBand'
import { PlayerSessionProvider, SESSION_PHASE, usePlayerSession } from './session/PlayerSessionContext'
import { isCloudDeployment } from './config/runtime'
import {
  setAuthToken,
  clearAuthToken,
  setRefreshCallback,
  setLoginCallback,
  getTelemetryCurrent,
  triggerSafetyStop,
  triggerSafetyStart,
  getAuthInfo,
} from './api/device'
import { setCloudAuthToken, clearCloudAuthToken, setCloudTenantId } from './api/cloud'

const DEVICE_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, panel: (props) => <DashboardTab {...props} /> },
  { id: 'user', label: 'User', icon: <PersonIcon />, panel: (props) => <UserTab {...props} /> },
  { id: 'treadmill', label: 'Treadmill', icon: <SpeedIcon />, panel: (props) => <TreadmillTab {...props} /> },
  { id: 'services', label: 'Services', icon: <DeviceHubIcon />, panel: (props) => <ServicesTab {...props} /> },
  { id: 'events', label: 'Events', icon: <ReportProblemIcon />, panel: (props) => <EventsTab {...props} /> },
  { id: 'config', label: 'Config', icon: <TuneIcon />, panel: (props) => <ConfigurationTab {...props} /> },
]

const CLOUD_ITEMS = [
  { id: 'media', label: 'Media', icon: <MovieIcon />, panel: () => <MediaPage /> },
  { id: 'users', label: 'Enrollment', icon: <GroupIcon />, panel: () => <UsersPage /> },
  { id: 'reservations', label: 'Reservations', icon: <EventIcon />, panel: () => <ReservationsPage /> },
  { id: 'staff', label: 'Staff', icon: <ManageAccountsIcon />, panel: () => <StaffPage /> },
  { id: 'organizations', label: 'Organizations', icon: <BusinessIcon />, panel: () => <OrganizationsPage /> },
  { id: 'billing', label: 'Billing', icon: <PaymentsIcon />, panel: () => <BillingPage /> },
  { id: 'usage', label: 'Analytics', icon: <InsightsIcon />, panel: () => <UsagePage /> },
  { id: 'fleet', label: 'Fleet', icon: <HubIcon />, panel: () => <FleetPage /> },
  { id: 'maintenance', label: 'Maintenance', icon: <BuildIcon />, panel: () => <MaintenancePage /> },
]

const MENU_GROUPS = [
  { id: 'local', label: 'Local Treadmill Device', items: DEVICE_ITEMS },
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

export default function Dashboard() {
  const deviceOnline = useDeviceOnline()
  return (
    <PlayerSessionProvider deviceOnline={deviceOnline === true}>
      <DashboardView deviceOnline={deviceOnline} />
    </PlayerSessionProvider>
  )
}

function DashboardView({ deviceOnline }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { accessToken, cloudAuthToken, idToken, user, logout, refreshAccessToken, login } = useAuth()
  const { phase, sessionActive } = usePlayerSession()
  const [treadmillState, setTreadmillState] = useState(null)
  const [safetyActionBusy, setSafetyActionBusy] = useState(false)
  const [safetyStopLatched, setSafetyStopLatched] = useState(false)
  const [safetyActionPending, setSafetyActionPending] = useState(null)

  const visibleMenuGroups = useMemo(
    () => (user ? filterMenuGroups(MENU_GROUPS, user) : MENU_GROUPS),
    [user],
  )
  const allItems = useMemo(
    () => visibleMenuGroups.flatMap((group) => group.items),
    [visibleMenuGroups],
  )
  const activeItem = allItems.find((item) => item.id === activeTab) || allItems[0]
  const isDeviceTab = DEVICE_ITEMS.some((item) => item.id === activeTab)

  useEffect(() => {
    if (!allItems.some((item) => item.id === activeTab)) {
      setActiveTab(allItems[0]?.id || 'dashboard')
    }
  }, [allItems, activeTab])

  // When the local unit is offline, leave Local Device routes and land on cloud.
  useEffect(() => {
    if (deviceOnline !== false || !isDeviceTab) {
      return
    }
    const cloudFirst = visibleMenuGroups.find((group) => group.id === 'cloud')?.items?.[0]
    if (cloudFirst) {
      setActiveTab(cloudFirst.id)
    }
  }, [deviceOnline, isDeviceTab, visibleMenuGroups])

  const isSafetyStopState = treadmillState === 3
  const isOperatingState = treadmillState === 2
  // Safety Start is only a resume after e-stop during an active player session.
  // USER_STANDBY uses the player Start control; offering Safety Start here leaves
  // the button stuck on "Starting..." because the belt never enters OPERATING.
  const showSafetyStart = sessionActive && (safetyStopLatched || isSafetyStopState)
  const isSafetyControlBusy = safetyActionBusy || safetyActionPending !== null
  const canSafetyStop = !isSafetyControlBusy && isOperatingState && deviceOnline
  const canSafetyStart = !isSafetyControlBusy && showSafetyStart && deviceOnline

  useEffect(() => {
    if (accessToken) {
      setAuthToken(accessToken)
      setCloudAuthToken(cloudAuthToken || accessToken)
    } else {
      clearAuthToken()
      clearCloudAuthToken()
    }
  }, [accessToken, cloudAuthToken])

  useEffect(() => {
    if (isCloudDeployment()) {
      // Prefer JWT custom:tenantId; Alpha staff tokens often omit it → demo tenant.
      const fromToken = readTenantIdFromJwt(idToken || cloudAuthToken)
      setCloudTenantId(fromToken || 'tenant-demo-001')
      return undefined
    }

    let cancelled = false
    getAuthInfo().then(({ data }) => {
      if (!cancelled && data?.tenantId) {
        setCloudTenantId(data.tenantId)
      }
    })
    return () => {
      cancelled = true
    }
  }, [idToken, cloudAuthToken])

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
      if (state === 5 || state === 0) {
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

  const userTabEnabled = phase !== SESSION_PHASE.idle
  const userTabSecondary =
    phase === SESSION_PHASE.pending
      ? 'pending start'
      : phase === SESSION_PHASE.active
        ? 'active session'
        : 'no session'

  useEffect(() => {
    if (activeTab === 'user' && phase === SESSION_PHASE.idle) {
      setActiveTab('dashboard')
    }
  }, [activeTab, phase])

  const handleSafetyAction = showSafetyStart ? handleSafetyStart : handleSafetyStop

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppBar position="static" elevation={0} sx={{ flexShrink: 0 }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1, minWidth: 0 }}>
            <img src="/BanditLogo.svg" alt="Bandit Logo" style={{ height: '48px', width: 'auto' }} />
            <Typography
              variant="h4"
              component="div"
              sx={{
                fontWeight: 600,
                fontFamily: '"Montserrat", sans-serif',
                letterSpacing: '1px',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
                whiteSpace: 'nowrap',
              }}
            >
              BANDIT ARENA
            </Typography>
            <Chip icon={<CloudQueueIcon />} size="small" label="Unified Console" variant="outlined" />
            {deviceOnline === false && (
              <Chip
                size="small"
                color="default"
                variant="outlined"
                label="Local offline"
                data-testid="header-local-offline"
                sx={{ opacity: 0.9 }}
              />
            )}
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
                data-testid="safety-control"
                sx={{ borderRadius: 999, px: 1.5, fontWeight: 700 }}
              >
                {safetyButtonLabel}
              </Button>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {user.username}
              </Typography>
              <Button
                color="inherit"
                size="small"
                startIcon={<LogoutIcon />}
                onClick={logout}
                data-testid="sign-out"
              >
                Sign out
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <DeviceStatusBand deviceOnline={deviceOnline === true} />

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            borderRight: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
            width: 280,
            overflowY: 'auto',
          }}
        >
          {visibleMenuGroups.map((group, groupIndex) => {
            const localOffline = group.id === 'local' && deviceOnline === false
            const items = localOffline ? [] : group.items
            return (
            <Box key={group.id} data-testid={group.id === 'local' ? 'menu-group-local' : `menu-group-${group.id}`}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  pt: groupIndex === 0 ? 2 : 1,
                  pb: 1,
                }}
              >
                <Typography
                  variant="overline"
                  sx={{
                    color: 'text.secondary',
                    letterSpacing: 1,
                    fontWeight: 700,
                    lineHeight: 1.5,
                  }}
                >
                  {group.label}
                </Typography>
                {localOffline && (
                  <Chip
                    size="small"
                    label="Offline"
                    data-testid="menu-local-offline"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                )}
              </Box>
              {items.length > 0 && (
              <List dense sx={{ pt: 0 }}>
                {items.map((item) => {
                  const isUserTab = item.id === 'user'
                  const disabled = isUserTab && !userTabEnabled
                  let secondary
                  if (isUserTab) {
                    secondary = userTabSecondary
                  }
                  return (
                    <ListItemButton
                      key={item.id}
                      selected={activeTab === item.id}
                      disabled={disabled}
                      onClick={() => setActiveTab(item.id)}
                      sx={{ mx: 1, borderRadius: 1 }}
                      data-testid={`menu-${item.id}`}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.label} secondary={secondary} />
                    </ListItemButton>
                  )
                })}
              </List>
              )}
              {groupIndex < visibleMenuGroups.length - 1 && <Divider sx={{ mt: 1 }} />}
            </Box>
            )
          })}
        </Box>

        <Box sx={{ flexGrow: 1, py: 0, minHeight: 0, overflow: 'hidden' }}>
          <TabPanel
            isActive
            noPadding={activeItem?.id === 'dashboard'}
            scrollable={activeItem?.id !== 'dashboard'}
          >
            {isDeviceTab && deviceOnline === false ? (
              <DeviceOfflinePanel />
            ) : (
              activeItem?.panel({ treadmillState })
            )}
          </TabPanel>
        </Box>
      </Box>

      <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          flexShrink: 0,
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

function readTenantIdFromJwt(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null
  }
  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)
    const tenantId = payload['custom:tenantId'] || payload['custom:tenant_id'] || payload.tenantId
    return typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : null
  } catch {
    return null
  }
}
