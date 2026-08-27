import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
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
import MovieIcon from '@mui/icons-material/Movie'
import EventIcon from '@mui/icons-material/Event'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import TimelineIcon from '@mui/icons-material/Timeline'
import NotificationsIcon from '@mui/icons-material/Notifications'
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import WifiIcon from '@mui/icons-material/Wifi'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import CardMembershipIcon from '@mui/icons-material/CardMembership'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import DevicesIcon from '@mui/icons-material/Devices'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import ApiIcon from '@mui/icons-material/Api'
import PaletteIcon from '@mui/icons-material/Palette'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'

import DashboardTab from './pages/device/DashboardTab'
import TreadmillTab from './pages/device/TreadmillTab'
import ServicesTab from './pages/device/ServicesTab'
import EventsTab from './pages/device/EventsTab'
import ConfigurationTab from './pages/device/ConfigurationTab'
import MediaPage from './pages/cloud/MediaPage'
import UsersPage from './pages/cloud/UsersPage'
import BillingPage from './pages/cloud/BillingPage'
import StaffPage from './pages/cloud/StaffPage'
import AccountsPage from './pages/cloud/AccountsPage'
import UsagePage from './pages/cloud/UsagePage'
import FleetPage from './pages/cloud/FleetPage'
import ReservationsPage from './pages/cloud/ReservationsPage'
import SessionHistoryPage from './pages/cloud/SessionHistoryPage'

import { useAuth } from './auth/useAuth'
import { filterMenuGroups } from './auth/rolePermissions'
import { DeviceOfflinePanel } from './components/shared/DeviceOfflineBanner'
import { useDeviceOnline } from './hooks/useDeviceOnline'
import DeviceStatusBand from './components/shared/DeviceStatusBand'
import ConsoleErrorBoundary from './components/shared/ConsoleErrorBoundary'
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
import { setCloudAuthToken, clearCloudAuthToken, setCloudOperatorId } from './api/cloud'
import {
  MENU_GROUP,
  MENU_LEAF_CATALOG,
  buildMenuGroups,
  findGroupIdForItem,
  firstCloudLanding,
  initialExpandedGroupIds,
} from './nav/consoleMenu'

const DEVICE_ITEM_IDS = new Set(['dashboard', 'treadmill', 'services', 'events', 'config'])

const IMPLEMENTED_PANELS = {
  dashboard: (props) => <DashboardTab {...props} />,
  treadmill: (props) => <TreadmillTab {...props} />,
  services: (props) => <ServicesTab {...props} />,
  events: (props) => <EventsTab {...props} />,
  config: (props) => <ConfigurationTab {...props} />,
  media: () => <MediaPage />,
  users: () => <UsersPage />,
  reservations: () => <ReservationsPage />,
  staff: () => <StaffPage />,
  accounts: () => <AccountsPage />,
  billing: () => <BillingPage />,
  usage: () => <UsagePage />,
  fleet: () => <FleetPage />,
  sessions: () => <SessionHistoryPage />,
}

const MENU_ICONS = {
  dashboard: <DashboardIcon />,
  treadmill: <SpeedIcon />,
  services: <DeviceHubIcon />,
  events: <ReportProblemIcon />,
  config: <TuneIcon />,
  reservations: <EventIcon />,
  users: <GroupIcon />,
  staff: <ManageAccountsIcon />,
  sessions: <TimelineIcon />,
  notifications: <NotificationsIcon />,
  fleet: <HubIcon />,
  firmware: <SystemUpdateAltIcon />,
  diagnostics: <MonitorHeartIcon />,
  support: <SupportAgentIcon />,
  network: <WifiIcon />,
  media: <MovieIcon />,
  'media-uploads': <CloudUploadIcon />,
  'session-recordings': <VideoLibraryIcon />,
  billing: <PaymentsIcon />,
  accounts: <BusinessIcon />,
  subscriptions: <CardMembershipIcon />,
  pricing: <LocalOfferIcon />,
  usage: <InsightsIcon />,
  'device-analytics': <DevicesIcon />,
  'experience-analytics': <TrendingUpIcon />,
  'revenue-analytics': <AttachMoneyIcon />,
  roles: <AdminPanelSettingsIcon />,
  integrations: <ApiIcon />,
  branding: <PaletteIcon />,
  audit: <FactCheckIcon />,
}

const ITEMS_BY_ID = Object.fromEntries(
  MENU_LEAF_CATALOG.map((leaf) => [
    leaf.id,
    {
      id: leaf.id,
      label: leaf.label,
      implemented: leaf.implemented,
      phase: leaf.phase || null,
      icon: MENU_ICONS[leaf.id] || <LockOutlinedIcon />,
      panel: IMPLEMENTED_PANELS[leaf.id] || null,
    },
  ]),
)

const MENU_GROUPS = buildMenuGroups(ITEMS_BY_ID)

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
  const [activeTab, setActiveTab] = useState('dashboard')

  const handleSessionStarted = useCallback(() => {
    setActiveTab('dashboard')
  }, [])

  return (
    <PlayerSessionProvider deviceOnline={deviceOnline === true} onSessionStarted={handleSessionStarted}>
      <DashboardView
        deviceOnline={deviceOnline}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </PlayerSessionProvider>
  )
}

function DashboardView({ deviceOnline, activeTab, setActiveTab }) {
  const { accessToken, cloudAuthToken, idToken, user, logout, refreshAccessToken, login } = useAuth()
  const { sessionActive } = usePlayerSession()
  const [treadmillState, setTreadmillState] = useState(null)
  const [safetyActionBusy, setSafetyActionBusy] = useState(false)
  const [safetyStopLatched, setSafetyStopLatched] = useState(false)
  const [safetyActionPending, setSafetyActionPending] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState(() => initialExpandedGroupIds(deviceOnline))

  const visibleMenuGroups = useMemo(
    () => (user ? filterMenuGroups(MENU_GROUPS, user) : MENU_GROUPS),
    [user],
  )
  const allItems = useMemo(
    () => visibleMenuGroups.flatMap((group) => group.items),
    [visibleMenuGroups],
  )
  const activeItem = allItems.find((item) => item.id === activeTab) || allItems[0]
  const isDeviceTab = DEVICE_ITEM_IDS.has(activeTab)

  const expandGroup = useCallback((groupId) => {
    if (!groupId) return
    setExpandedGroups((prev) => {
      if (prev.has(groupId)) return prev
      const next = new Set(prev)
      next.add(groupId)
      return next
    })
  }, [])

  const toggleGroup = useCallback((groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const selectMenuItem = useCallback(
    (itemId) => {
      const item = allItems.find((entry) => entry.id === itemId)
      if (!item || item.implemented === false) return
      const groupId = findGroupIdForItem(visibleMenuGroups, itemId)
      expandGroup(groupId)
      setActiveTab(itemId)
    },
    [allItems, expandGroup, setActiveTab, visibleMenuGroups],
  )

  useEffect(() => {
    const onOpenHistory = () => {
      selectMenuItem('sessions')
    }
    window.addEventListener('bandit:open-session-history', onOpenHistory)
    return () => window.removeEventListener('bandit:open-session-history', onOpenHistory)
  }, [selectMenuItem])

  // Sync default expand when local reachability flips (FR-SW-UI-009).
  useEffect(() => {
    if (deviceOnline === false) {
      setExpandedGroups((prev) => {
        const next = new Set(prev)
        next.delete(MENU_GROUP.LOCAL)
        return next
      })
      return
    }
    if (deviceOnline === true) {
      expandGroup(MENU_GROUP.LOCAL)
    }
  }, [deviceOnline, expandGroup])

  useEffect(() => {
    if (!allItems.some((item) => item.id === activeTab)) {
      setActiveTab(allItems[0]?.id || 'dashboard')
    }
  }, [allItems, activeTab, setActiveTab])

  // Keep the active item's pillar open (e.g. after Start Session → Dashboard).
  useEffect(() => {
    const groupId = findGroupIdForItem(visibleMenuGroups, activeTab)
    if (groupId === MENU_GROUP.LOCAL && deviceOnline === false) return
    expandGroup(groupId)
  }, [activeTab, visibleMenuGroups, expandGroup, deviceOnline])

  // When the local unit is offline, leave Local Device routes and land on cloud.
  useEffect(() => {
    if (deviceOnline !== false || !isDeviceTab) {
      return
    }
    const landing = firstCloudLanding(visibleMenuGroups)
    if (landing) {
      expandGroup(landing.groupId)
      setActiveTab(landing.itemId)
    }
  }, [deviceOnline, isDeviceTab, visibleMenuGroups, expandGroup, setActiveTab])

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
      // Prefer JWT custom:operatorId; Alpha staff tokens often omit it → demo operator.
      const fromToken = readOperatorIdFromJwt(idToken || cloudAuthToken)
      setCloudOperatorId(fromToken || 'operator-demo-001')
      return undefined
    }

    let cancelled = false
    getAuthInfo().then(({ data }) => {
      if (!cancelled && data?.operatorId) {
        setCloudOperatorId(data.operatorId)
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
            minWidth: 260,
            flexShrink: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {visibleMenuGroups.map((group, groupIndex) => {
            const localOffline = group.id === MENU_GROUP.LOCAL && deviceOnline === false
            const items = localOffline ? [] : group.items
            const expanded = !localOffline && expandedGroups.has(group.id)
            const canToggle = !localOffline && items.length > 0
            return (
              <Box key={group.id} data-testid={`menu-group-${group.id}`}>
                <ListItemButton
                  onClick={() => canToggle && toggleGroup(group.id)}
                  disabled={!canToggle && localOffline}
                  sx={{
                    mx: 1,
                    mt: groupIndex === 0 ? 1.5 : 0.5,
                    borderRadius: 1,
                    py: 0.75,
                  }}
                  data-testid={`menu-group-toggle-${group.id}`}
                  aria-expanded={expanded}
                >
                  <ListItemText
                    primary={group.label}
                    primaryTypographyProps={{
                      variant: 'overline',
                      sx: {
                        color: 'text.secondary',
                        letterSpacing: 1,
                        fontWeight: 700,
                        lineHeight: 1.5,
                      },
                    }}
                  />
                  {localOffline && (
                    <Chip
                      size="small"
                      label="Offline"
                      data-testid="menu-local-offline"
                      sx={{ height: 20, fontSize: '0.65rem', mr: 0.5 }}
                    />
                  )}
                  {canToggle ? (expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />) : null}
                </ListItemButton>
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                  <List dense sx={{ pt: 0, pb: 0.5 }}>
                    {items.map((item) => {
                      const notImplemented = item.implemented === false
                      const secondary = notImplemented
                        ? item.phase
                          ? `Coming soon · ${item.phase}`
                          : 'Coming soon'
                        : undefined
                      return (
                        <ListItemButton
                          key={item.id}
                          selected={!notImplemented && activeTab === item.id}
                          disabled={notImplemented}
                          onClick={() => selectMenuItem(item.id)}
                          sx={{ mx: 1, borderRadius: 1, pl: 2.5 }}
                          data-testid={`menu-${item.id}`}
                          data-implemented={notImplemented ? 'false' : 'true'}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {notImplemented ? <LockOutlinedIcon fontSize="small" /> : item.icon}
                          </ListItemIcon>
                          <ListItemText primary={item.label} secondary={secondary} />
                        </ListItemButton>
                      )
                    })}
                  </List>
                </Collapse>
                {groupIndex < visibleMenuGroups.length - 1 && <Divider sx={{ mt: 0.5 }} />}
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
            <ConsoleErrorBoundary key={activeItem?.id || 'panel'}>
              {isDeviceTab && deviceOnline === false ? (
                <DeviceOfflinePanel />
              ) : (
                activeItem?.panel({ treadmillState })
              )}
            </ConsoleErrorBoundary>
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

function readOperatorIdFromJwt(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null
  }
  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)
    const operatorId = payload['custom:operatorId'] || payload['custom:operator_id'] || payload.operatorId
    return typeof operatorId === 'string' && operatorId.trim() ? operatorId.trim() : null
  } catch {
    return null
  }
}
