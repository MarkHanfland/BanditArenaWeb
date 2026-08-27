import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import {
  exportSession,
  getSessionMetrics,
  getSessionSafetyEvents,
  listProductInstances,
  listUserSessions,
  listUsers,
  listVenues,
} from '../../api/cloud'
import {
  consumeSessionHistoryUserFilter,
  peekSessionHistoryUserFilter,
  readLastSessionHistoryUser,
  rememberSessionHistoryUser,
} from '../../nav/sessionHistoryNav'
import { formatTreadmillLabel, formatVenueLabel } from '../../session/sessionDeviceContext'
import { readLastPlayers } from '../../session/lastPlayers'

function statusColor(status) {
  if (status === 'active') return 'success'
  if (status === 'completed' || status === 'closed') return 'default'
  return 'warning'
}

function formatWhen(iso) {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return String(iso)
  return new Date(ms).toLocaleString()
}

function formatDuration(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 60) return `${Math.round(n)}s`
  const mins = Math.floor(n / 60)
  const secs = Math.round(n % 60)
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

function resolveMediaId(row) {
  if (row?.mediaId) return row.mediaId
  if (Array.isArray(row?.mediaSessions) && row.mediaSessions[0]?.mediaId) {
    return row.mediaSessions[0].mediaId
  }
  if (Array.isArray(row?.timeline?.vrScenes) && row.timeline.vrScenes[0]?.mediaId) {
    return row.timeline.vrScenes[0].mediaId
  }
  return null
}

function resolveDurationSeconds(row) {
  const stored = Number(row?.duration)
  if (row?.status === 'active') {
    const startMs = Date.parse(row.startTime || '')
    if (Number.isFinite(startMs)) {
      return Math.max(0, Math.round((Date.now() - startMs) / 1000))
    }
  }
  if (Number.isFinite(stored) && stored > 0) return stored
  if (row?.endTime && row?.startTime) {
    const startMs = Date.parse(row.startTime)
    const endMs = Date.parse(row.endTime)
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return Math.max(0, Math.round((endMs - startMs) / 1000))
    }
  }
  if (Number.isFinite(stored)) return stored
  return null
}

/** Level 5 / CI polluters — not product Player accounts. */
function isHistoryEligiblePlayer(user) {
  if (!user) return false
  const email = String(user.email || '').toLowerCase()
  if (email === 'integration@example.com') return false
  if (String(user.name || '') === 'Integration Test User') return false
  return true
}

function defaultPlayerFilter(initialUserId) {
  return (
    initialUserId
    || peekSessionHistoryUserFilter()
    || readLastSessionHistoryUser()
    || readLastPlayers()[0]?.userId
    || ''
  )
}

function enrichSessionRow(session, user, deviceById, venueById) {
  const instanceId = session.instanceId || null
  const device = instanceId ? deviceById.get(instanceId) : null
  const venueId = session.venueId || device?.venueId || null
  const venue = venueId ? venueById.get(venueId) : null
  const instanceDisplayName =
    session.instanceDisplayName || device?.displayName || null
  const venueName = session.venueName || venue?.name || device?.venueName || null
  return {
    ...session,
    userId: session.userId || user.userId,
    playerName: user.name || user.userId,
    mediaId: resolveMediaId(session),
    durationDisplay: resolveDurationSeconds(session),
    instanceId,
    venueId,
    instanceDisplayName,
    venueName,
  }
}

export default function SessionHistoryPage({ initialUserId = null } = {}) {
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [rows, setRows] = useState([])
  const [deviceById, setDeviceById] = useState(() => new Map())
  const [venueById, setVenueById] = useState(() => new Map())
  const [userFilter, setUserFilter] = useState(() => defaultPlayerFilter(initialUserId))
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [safetyEvents, setSafetyEvents] = useState([])
  const [detailError, setDetailError] = useState('')

  const userNameById = useMemo(() => {
    const map = new Map()
    for (const user of users) {
      map.set(user.userId, user.name || user.userId)
    }
    return map
  }, [users])

  const loadDirectory = useCallback(async () => {
    setLoadingUsers(true)
    setError('')
    const [usersRes, instancesRes, venuesRes] = await Promise.all([
      listUsers(),
      listProductInstances(),
      listVenues(),
    ])
    if (usersRes.error) {
      setError(usersRes.error)
      setUsers([])
      setLoadingUsers(false)
      return { users: [], devices: new Map(), venues: new Map() }
    }
    const list = (usersRes.data?.users || []).filter(isHistoryEligiblePlayer)
    setUsers(list)

    const devices = new Map()
    for (const instance of instancesRes.data?.instances || []) {
      if (instance?.instanceId) devices.set(instance.instanceId, instance)
    }
    setDeviceById(devices)

    const venues = new Map()
    for (const venue of venuesRes.data?.venues || []) {
      if (venue?.venueId) venues.set(venue.venueId, venue)
    }
    setVenueById(venues)
    setLoadingUsers(false)
    return { users: list, devices, venues }
  }, [])

  const loadHistoryForPlayer = useCallback(async (filterUserId, directory) => {
    if (!filterUserId) {
      setRows([])
      setLoadingSessions(false)
      return
    }
    setLoadingSessions(true)
    setError('')
    rememberSessionHistoryUser(filterUserId)

    let usersList = directory?.users
    let devices = directory?.devices || deviceById
    let venues = directory?.venues || venueById
    if (!usersList) {
      const loaded = await loadDirectory()
      usersList = loaded.users
      devices = loaded.devices
      venues = loaded.venues
    }

    const user = usersList.find((entry) => entry.userId === filterUserId)
    if (!user) {
      setRows([])
      setError('Selected Player account was not found among enrolled accounts.')
      setLoadingSessions(false)
      return
    }

    const sessionsRes = await listUserSessions(user.userId)
    if (sessionsRes.error) {
      setError(sessionsRes.error)
      setRows([])
      setLoadingSessions(false)
      return
    }
    const sessions = (sessionsRes.data?.sessions || []).map((session) =>
      enrichSessionRow(session, user, devices, venues),
    )
    sessions.sort((a, b) => {
      const aMs = Date.parse(a.startTime || a.createdAt || '') || 0
      const bMs = Date.parse(b.startTime || b.createdAt || '') || 0
      return bMs - aMs
    })
    setRows(sessions)
    setLoadingSessions(false)
  }, [deviceById, loadDirectory, venueById])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const directory = await loadDirectory()
      if (cancelled) return
      const fromNav = consumeSessionHistoryUserFilter()
      const nextFilter = fromNav || userFilter || defaultPlayerFilter(initialUserId)
      if (fromNav || nextFilter !== userFilter) {
        setUserFilter(nextFilter)
      }
      if (nextFilter) {
        await loadHistoryForPlayer(nextFilter, directory)
      }
    })()
    return () => {
      cancelled = true
    }
    // Initial mount only — subsequent loads go through filter / refresh / nav event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onOpen = (event) => {
      const nextUserId = event?.detail?.userId || ''
      setUserFilter(nextUserId)
      loadHistoryForPlayer(nextUserId)
    }
    window.addEventListener('bandit:open-session-history', onOpen)
    return () => window.removeEventListener('bandit:open-session-history', onOpen)
  }, [loadHistoryForPlayer])

  const openDetail = async (row) => {
    setSelected(row)
    setDetailLoading(true)
    setDetailError('')
    setMetrics(null)
    setSafetyEvents([])
    const [metricsRes, safetyRes] = await Promise.all([
      getSessionMetrics(row.sessionId),
      getSessionSafetyEvents(row.sessionId),
    ])
    if (metricsRes.error && safetyRes.error) {
      setDetailError(metricsRes.error || safetyRes.error)
    } else {
      setMetrics(metricsRes.data?.metrics || null)
      setSafetyEvents(safetyRes.data?.safetyEvents || [])
      if (metricsRes.error) setDetailError(metricsRes.error)
      if (safetyRes.error) setDetailError(safetyRes.error)
    }
    setDetailLoading(false)
  }

  const handleExport = async () => {
    if (!selected?.sessionId) return
    const { data, error: apiError } = await exportSession(selected.sessionId, 'json')
    if (apiError) {
      setDetailError(apiError)
      return
    }
    const body = data?.body || data
    const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${selected.sessionId}-export.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const loading = loadingUsers || loadingSessions

  return (
    <PageScaffold
      title="Session History"
      category="Operations"
      description="Post-run Player session records scoped to one enrolled account (SVC-010). Live playback remains on Local Device."
    >
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          select
          size="small"
          label="Player account"
          value={userFilter}
          required
          onChange={(e) => {
            const next = e.target.value
            setUserFilter(next)
            loadHistoryForPlayer(next)
          }}
          sx={{ minWidth: 260 }}
          inputProps={{ 'data-testid': 'session-history-user-filter' }}
          helperText="Alpha loads one Player at a time (no all-accounts fan-out)."
        >
          <MenuItem value="">
            <em>Select a Player…</em>
          </MenuItem>
          {users.map((user) => (
            <MenuItem key={user.userId} value={user.userId}>
              {user.name || user.userId}
            </MenuItem>
          ))}
        </TextField>
        <Button
          size="small"
          onClick={() => loadHistoryForPlayer(userFilter)}
          disabled={!userFilter}
          data-testid="session-history-refresh"
        >
          Refresh
        </Button>
      </Stack>

      {!userFilter ? (
        <Alert severity="info" data-testid="session-history-scope-hint">
          Select a Player account to load Session History. Use Enrollment → Session history to
          open a specific account, or pick the last Player used on this console.
        </Alert>
      ) : loading ? (
        <CircularProgress size={28} />
      ) : (
        <Table size="small" data-testid="session-history-table">
          <TableHead>
            <TableRow>
              <TableCell>Venue</TableCell>
              <TableCell>Treadmill</TableCell>
              <TableCell>Player</TableCell>
              <TableCell>Session</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Media</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography variant="body2" color="text.secondary">
                    No sessions found for this Player.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.sessionId} hover>
                  <TableCell>{formatVenueLabel(row)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{formatTreadmillLabel(row)}</Typography>
                    {row.instanceDisplayName && row.instanceId ? (
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        {row.instanceId}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.playerName || userNameById.get(row.userId) || row.userId}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {row.sessionId}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={row.status || '—'} color={statusColor(row.status)} />
                  </TableCell>
                  <TableCell>{formatWhen(row.startTime)}</TableCell>
                  <TableCell>{formatDuration(row.durationDisplay)}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {row.mediaId || '—'}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => openDetail(row)}
                      data-testid={`session-history-open-${row.sessionId}`}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        maxWidth="sm"
        fullWidth
        data-testid="session-history-detail"
      >
        <DialogTitle>Session {selected?.sessionId}</DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <CircularProgress size={24} />
          ) : (
            <Stack spacing={1.5}>
              {detailError ? <Alert severity="warning">{detailError}</Alert> : null}
              <Typography variant="body2">
                Player: {selected?.playerName || userNameById.get(selected?.userId) || selected?.userId}
              </Typography>
              <Typography variant="body2">
                Venue: {formatVenueLabel(selected || {})}
              </Typography>
              <Typography variant="body2">
                Treadmill: {formatTreadmillLabel(selected || {})}
                {selected?.instanceId ? ` (${selected.instanceId})` : ''}
              </Typography>
              <Typography variant="body2">Status: {selected?.status || '—'}</Typography>
              <Typography variant="body2">Started: {formatWhen(selected?.startTime)}</Typography>
              <Typography variant="body2">
                Duration: {formatDuration(resolveDurationSeconds(selected))}
              </Typography>
              <Typography variant="body2">Media: {resolveMediaId(selected) || '—'}</Typography>
              {metrics ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Metrics</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Duration {metrics.durationSeconds ?? '—'}s · Distance {metrics.distanceMeters ?? '—'} m ·
                    Avg {metrics.averageSpeedMps ?? '—'} m/s · Max {metrics.maxSpeedMps ?? '—'} m/s ·
                    Calories {metrics.calories ?? '—'} · Safety events {metrics.safetyEventCount ?? 0}
                  </Typography>
                </Box>
              ) : null}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Safety events ({safetyEvents.length})
                </Typography>
                {safetyEvents.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">None recorded.</Typography>
                ) : (
                  safetyEvents.slice(0, 20).map((ev, index) => (
                    <Typography
                      key={`${ev.t}-${ev.type}-${index}`}
                      variant="body2"
                      color="text.secondary"
                    >
                      t={ev.t ?? '—'} · {ev.type || ev.category || 'event'}
                      {ev.severity ? ` · ${ev.severity}` : ''}
                    </Typography>
                  ))
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExport} disabled={!selected} data-testid="session-history-export">
            Export JSON
          </Button>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
