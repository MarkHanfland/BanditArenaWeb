import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import DarkDateField from '../../components/shared/DarkDateField'
import PageScaffold from '../../components/shared/PageScaffold'
import {
  bookReservation,
  createGroupInvitation,
  listMedia,
  cancelReservation,
  checkInReservation,
  getVenueAvailability,
  listPlayGroups,
  listUsers,
} from '../../api/cloud'
import { useVenue } from '../../session/VenueContext'

function overlaps(start, end, slotStart, slotEnd) {
  return Date.parse(start) < Date.parse(slotEnd) && Date.parse(end) > Date.parse(slotStart)
}

function columnsFrom(open, close) {
  const start = Date.parse(open || '')
  const end = Date.parse(close || '')
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []
  const columns = []
  for (let cursor = start; cursor + 30 * 60 * 1000 <= end; cursor += 30 * 60 * 1000) {
    columns.push({
      startTime: new Date(cursor).toISOString(),
      endTime: new Date(cursor + 30 * 60 * 1000).toISOString(),
    })
  }
  return columns
}

function clockFace(iso, timezone) {
  const ms = Date.parse(iso || '')
  if (!Number.isFinite(ms)) return { label: '', period: '' }
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
    timeZone: timezone || undefined,
  }).formatToParts(new Date(ms))
  const hour = parts.find((part) => part.type === 'hour')?.value || ''
  const minute = parts.find((part) => part.type === 'minute')?.value || '00'
  const period = (parts.find((part) => part.type === 'dayPeriod')?.value || '').toUpperCase()
  return { label: `${hour}:${minute}`, period }
}

function periodGroups(columns, timezone) {
  const groups = []
  for (const column of columns) {
    const period = clockFace(column.startTime, timezone).period || 'AM'
    const last = groups[groups.length - 1]
    if (last && last.period === period) last.count += 1
    else groups.push({ period, count: 1 })
  }
  return groups
}

function Portrait({ src, alt }) {
  if (!src) return null
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      sx={{ width: 28, height: 28, borderRadius: '50%', mr: 1, objectFit: 'cover' }}
    />
  )
}

function todayKey() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export default function ReservationsPage() {
  const venueCtx = useVenue()
  const venueId = venueCtx?.venueId || ''
  const [date, setDate] = useState(todayKey)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [grid, setGrid] = useState(null)
  const [users, setUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [selection, setSelection] = useState(null)
  const [bookOpen, setBookOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [playerId, setPlayerId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [inviteIds, setInviteIds] = useState([])
  const [mediaChoices, setMediaChoices] = useState([])
  const [mediaId, setMediaId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!venueCtx?.ready) return
    if (!venueId) {
      setGrid(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setGrid(null)
    setError('')
    const [availability, people, playGroups, titles] = await Promise.all([
      getVenueAvailability(venueId, date),
      listUsers(),
      listPlayGroups(),
      listMedia(),
    ])
    if (availability.error) {
      setError(availability.error)
      setGrid(null)
      setLoading(false)
      return
    }
    setGrid(availability.data || null)
    const active = (people.data?.users || []).filter((user) => user.enrollmentState === 'active')
    setUsers(active)
    setPlayerId((current) => current || active[0]?.userId || '')
    const bookable = (playGroups.data?.groups || []).filter((group) => (group.memberUserIds || []).length >= 2)
    setGroups(bookable)
    setMediaChoices(titles.data?.media || [])
    setLoading(false)
  }, [date, venueCtx?.ready, venueId])

  useEffect(() => {
    load()
  }, [load])

  const columns = useMemo(() => columnsFrom(grid?.open, grid?.close), [grid])
  const machines = grid?.machines || []
  const reservations = grid?.reservations || []
  const timezone = grid?.timezone

  const reservationAt = (machineId, column) => reservations.find((item) => (
    item.resourceId === machineId && overlaps(item.startTime, item.endTime, column.startTime, column.endTime)
  ))

  const userName = (userId) => users.find((user) => user.userId === userId)?.name || userId || 'Player'

  const toggleCell = (machineId, index) => {
    const column = columns[index]
    const booked = reservationAt(machineId, column)
    if (booked) {
      setSelection(null)
      setDetail(booked)
      return
    }
    if (Date.parse(column.endTime) <= Date.now()) return
    setSelection((current) => {
      if (!current || current.machineId !== machineId) {
        return { machineId, indexes: [index] }
      }
      const indexes = current.indexes.includes(index)
        ? current.indexes.filter((value) => value !== index)
        : [...current.indexes, index].sort((a, b) => a - b)
      if (!indexes.length) return null
      const contiguous = indexes.every((value, position) => position === 0 || value === indexes[position - 1] + 1)
      const free = indexes.every((value) => !reservationAt(machineId, columns[value]))
      if (!contiguous || !free) return { machineId, indexes: [index] }
      return { machineId, indexes }
    })
  }

  const selectedRange = () => {
    if (!selection?.indexes?.length) return null
    const first = columns[selection.indexes[0]]
    const last = columns[selection.indexes[selection.indexes.length - 1]]
    return { machineId: selection.machineId, startTime: first.startTime, endTime: last.endTime }
  }

  const book = async () => {
    const range = selectedRange()
    if (!range) return
    setBusy(true)
    setMessage('')
    let result
    if (groupId) {
      if (!inviteIds.length || !mediaId) {
        setBusy(false)
        setMessage('Choose the players to invite and a title. They accept by picking a free machine.')
        return
      }
      result = await createGroupInvitation(groupId, {
        userIds: inviteIds,
        mediaId,
        startTime: range.startTime,
        endTime: range.endTime,
      })
    } else {
      result = await bookReservation({
        userId: playerId,
        resourceId: range.machineId,
        startTime: range.startTime,
        endTime: range.endTime,
        venueId,
      })
    }
    setBusy(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setBookOpen(false)
    setSelection(null)
    setGroupId('')
    setMessage(groupId ? 'Invitations sent. Players are not booked until they accept a machine.' : 'Reservation booked')
    await load()
  }

  const cancel = async () => {
    if (!detail?.slotId) return
    setBusy(true)
    const result = await cancelReservation(detail.slotId)
    setBusy(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setDetail(null)
    setMessage('Reservation cancelled')
    await load()
  }

  const startSession = async () => {
    if (!detail?.slotId) return
    setBusy(true)
    const result = await checkInReservation(detail.slotId)
    setBusy(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setDetail(null)
    setMessage(result.data?.group?.groupWaiting
      ? 'Checked in. The session waits until every player in the group is checked in.'
      : 'Session started')
    await load()
  }

  const canStart = (item) => {
    if (!item || item.status !== 'booked') return false
    const start = Date.parse(item.startTime)
    const end = Date.parse(item.endTime)
    const holdMs = (Number(grid?.holdMinutes) > 0 ? Number(grid.holdMinutes) : 10) * 60 * 1000
    const now = Date.now()
    return now >= start - holdMs && now <= end
  }

  return (
    <PageScaffold
      title="Reservations"
      category="Operations"
      description="Book a player or a group on adjacent half-hour slots. Click a reservation to review, cancel, or start it."
    >
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="info" sx={{ mb: 2 }} data-testid="reservations-message">{message}</Alert>}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
        <DarkDateField
          label="Date"
          testId="reservation-date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        {timezone && (
          <Typography variant="body2" data-testid="reservation-timezone">
            Venue time ({timezone})
          </Typography>
        )}
        {selection && (
          <Button variant="contained" data-testid="reservation-book-open" onClick={() => setBookOpen(true)}>
            Book {selection.indexes.length * 30} min
          </Button>
        )}
      </Stack>
      {(!venueCtx?.ready || loading) && !error && (
        <Typography>Loading the day…</Typography>
      )}
      {venueCtx?.ready && !loading && !venueId && !error && (
        <Typography>No venue is assigned to this login.</Typography>
      )}
      {!loading && grid?.closed && <Alert severity="info">This venue is closed ({grid.closed}).</Alert>}
      {!loading && grid && !grid.closed && (
        <Box sx={{ overflowX: 'auto' }} data-testid="reservation-grid">
          <Box component="table" sx={{ borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ textAlign: 'left', padding: 8 }}>Machine</th>
                {periodGroups(columns, timezone).map((group, index) => (
                  <th
                    key={`${group.period}-${index}`}
                    colSpan={group.count}
                    data-testid={`reservation-period-${group.period}`}
                    style={{
                      padding: '6px 8px',
                      background: group.period === 'PM' ? '#6b4c9a' : '#1f6f78',
                      color: '#ffffff',
                      letterSpacing: '0.08em',
                      fontWeight: 700,
                    }}
                  >
                    {group.period}
                  </th>
                ))}
              </tr>
              <tr>
                {columns.map((column) => (
                  <th key={column.startTime} style={{ padding: 8, fontWeight: 500 }}>
                    {clockFace(column.startTime, timezone).label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {machines.map((machine) => (
                <tr key={machine.instanceId}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{machine.displayName}</td>
                  {columns.map((column, index) => {
                    const booked = reservationAt(machine.instanceId, column)
                    const selected = selection?.machineId === machine.instanceId && selection.indexes.includes(index)
                    const past = Date.parse(column.endTime) <= Date.now()
                    let background = '#1e2420'
                    if (booked) background = '#1d4e89'
                    else if (selected) background = '#2d6a4f'
                    else if (past) background = '#2a2a2a'
                    return (
                      <td key={column.startTime} style={{ padding: 4 }}>
                        <Button
                          data-testid={`slot-${machine.instanceId}-${index}`}
                          onClick={() => toggleCell(machine.instanceId, index)}
                          disabled={!booked && past}
                          sx={{
                            minWidth: 88,
                            minHeight: 42,
                            bgcolor: background,
                            color: '#f4fff6',
                            '&:hover': { bgcolor: background },
                          }}
                        >
                          {booked ? userName(booked.userId) : past ? 'Not Available' : 'Open'}
                        </Button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </Box>
          {machines.length === 0 && <Typography sx={{ mt: 2 }}>No machines are assigned to this venue.</Typography>}
        </Box>
      )}

      <Dialog open={bookOpen} onClose={() => setBookOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Book this time</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Player"
              value={playerId}
              onChange={(event) => { setPlayerId(event.target.value); setGroupId('') }}
              inputProps={{ 'data-testid': 'reservation-player' }}
              disabled={Boolean(groupId)}
            >
              {users.map((user) => (
                <MenuItem key={user.userId} value={user.userId}>
                  <Portrait src={user.avatarUrl} alt="" />
                  {user.name || user.userId}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Group"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              inputProps={{ 'data-testid': 'reservation-group' }}
            >
              <MenuItem value="">One player</MenuItem>
              {groups.map((group) => (
                <MenuItem key={group.groupId} value={group.groupId}>
                  <Portrait src={group.logoUrl} alt="" />
                  {group.name} ({group.memberUserIds.length} players)
                </MenuItem>
              ))}
            </TextField>
            {groupId && (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2">Invite</Typography>
                  <Button size="small" onClick={() => setInviteIds(groups.find((item) => item.groupId === groupId)?.memberUserIds || [])}>
                    Invite everyone
                  </Button>
                </Stack>
                {(groups.find((item) => item.groupId === groupId)?.memberUserIds || []).map((id) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={inviteIds.includes(id)}
                      onChange={(event) => setInviteIds((current) => (
                        event.target.checked ? [...current, id] : current.filter((item) => item !== id)
                      ))}
                    />
                    {' '}{userName(id)}
                  </label>
                ))}
                <TextField
                  select
                  label="Title"
                  value={mediaId}
                  onChange={(event) => setMediaId(event.target.value)}
                >
                  {mediaChoices.map((item) => (
                    <MenuItem key={item.mediaId} value={item.mediaId}>{item.name || item.mediaId}</MenuItem>
                  ))}
                </TextField>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBookOpen(false)}>Close</Button>
          <Button variant="contained" data-testid="reservation-book-confirm" disabled={busy || (!groupId && !playerId)} onClick={book}>
            Book
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
        <DialogTitle>Reservation</DialogTitle>
        <DialogContent data-testid="reservation-detail">
          {detail && (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography>{userName(detail.userId)}</Typography>
              <Typography>
                {clockFace(detail.startTime, timezone).label} {clockFace(detail.startTime, timezone).period}
                {' – '}
                {clockFace(detail.endTime, timezone).label} {clockFace(detail.endTime, timezone).period}
              </Typography>
              <Typography>Status: {detail.status}</Typography>
              {detail.playGroupId && <Typography>Group booking {detail.playGroupId}</Typography>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>Close</Button>
          {detail && canStart(detail) && (
            <Button variant="contained" data-testid="reservation-start" disabled={busy} onClick={startSession}>
              Start session
            </Button>
          )}
          <Button color="warning" data-testid="reservation-cancel" disabled={busy} onClick={cancel}>
            Cancel reservation
          </Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
