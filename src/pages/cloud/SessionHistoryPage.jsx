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
  listUserSessions,
  listUsers,
} from '../../api/cloud'
import {
  consumeSessionHistoryUserFilter,
  peekSessionHistoryUserFilter,
} from '../../nav/sessionHistoryNav'

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

export default function SessionHistoryPage({ initialUserId = null } = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [rows, setRows] = useState([])
  const [userFilter, setUserFilter] = useState(
    () => initialUserId || peekSessionHistoryUserFilter() || '',
  )
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

  const loadHistory = useCallback(async (filterUserId) => {
    setLoading(true)
    setError('')
    const usersRes = await listUsers()
    if (usersRes.error) {
      setError(usersRes.error)
      setUsers([])
      setRows([])
      setLoading(false)
      return
    }
    const list = usersRes.data?.users || []
    setUsers(list)
    const targets = filterUserId
      ? list.filter((u) => u.userId === filterUserId)
      : list
    const settled = await Promise.all(
      targets.map(async (user) => {
        const sessionsRes = await listUserSessions(user.userId)
        const sessions = sessionsRes.data?.sessions || []
        return sessions.map((session) => ({
          ...session,
          userId: session.userId || user.userId,
          playerName: user.name || user.userId,
        }))
      }),
    )
    const merged = settled.flat().sort((a, b) => {
      const aMs = Date.parse(a.startTime || a.createdAt || '') || 0
      const bMs = Date.parse(b.startTime || b.createdAt || '') || 0
      return bMs - aMs
    })
    setRows(merged)
    setLoading(false)
  }, [])

  useEffect(() => {
    const fromNav = consumeSessionHistoryUserFilter()
    if (fromNav) {
      setUserFilter(fromNav)
      loadHistory(fromNav)
      return undefined
    }
    loadHistory(userFilter || '')
    return undefined
  }, [loadHistory])

  useEffect(() => {
    const onOpen = (event) => {
      const nextUserId = event?.detail?.userId || ''
      setUserFilter(nextUserId)
      loadHistory(nextUserId)
    }
    window.addEventListener('bandit:open-session-history', onOpen)
    return () => window.removeEventListener('bandit:open-session-history', onOpen)
  }, [loadHistory])

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

  const filteredRows = userFilter
    ? rows.filter((row) => row.userId === userFilter)
    : rows

  return (
    <PageScaffold
      title="Session History"
      category="Operations"
      description="Post-run Player session records for enrolled accounts (SVC-010). Live playback remains on Local Device."
    >
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems="center">
        <TextField
          select
          size="small"
          label="Player account"
          value={userFilter}
          onChange={(e) => {
            const next = e.target.value
            setUserFilter(next)
            loadHistory(next)
          }}
          sx={{ minWidth: 260 }}
          inputProps={{ 'data-testid': 'session-history-user-filter' }}
        >
          <MenuItem value="">All enrolled accounts</MenuItem>
          {users.map((user) => (
            <MenuItem key={user.userId} value={user.userId}>
              {user.name || user.userId}
            </MenuItem>
          ))}
        </TextField>
        <Button
          size="small"
          onClick={() => loadHistory(userFilter)}
          data-testid="session-history-refresh"
        >
          Refresh
        </Button>
      </Stack>

      {loading ? (
        <CircularProgress size={28} />
      ) : (
        <Table size="small" data-testid="session-history-table">
          <TableHead>
            <TableRow>
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
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    No sessions found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.sessionId} hover>
                  <TableCell>{row.playerName || userNameById.get(row.userId) || row.userId}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {row.sessionId}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={row.status || '—'} color={statusColor(row.status)} />
                  </TableCell>
                  <TableCell>{formatWhen(row.startTime)}</TableCell>
                  <TableCell>{row.duration != null ? `${row.duration}s` : '—'}</TableCell>
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
              <Typography variant="body2">Status: {selected?.status || '—'}</Typography>
              <Typography variant="body2">Started: {formatWhen(selected?.startTime)}</Typography>
              <Typography variant="body2">Media: {selected?.mediaId || '—'}</Typography>
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
