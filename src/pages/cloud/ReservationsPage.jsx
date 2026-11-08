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
  listSessions,
  listUsers,
  redeemSessionPass,
} from '../../api/cloud'
import { useVenue } from '../../session/VenueContext'
import { nextOpenSlot, playerStatus } from './frontDesk'
import PassScanDialog from './PassScanDialog'

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
  const [sessions, setSessions] = useState([])
  const [passText, setPassText] = useState('')
  const [scan, setScan] = useState(null)
  const [walkInOpen, setWalkInOpen] = useState(false)
  const [walkInPlayer, setWalkInPlayer] = useState('')
  const [scanOpen, setScanOpen] = useState(false)

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
    const [availability, people, playGroups, titles, played] = await Promise.all([
      getVenueAvailability(venueId, date),
      listUsers(),
      listPlayGroups(),
      listMedia(),
      listSessions({ venueId, limit: 200 }),
    ])
    setSessions(played.data?.sessions || [])
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

  // A no-show frees the machine, so it never holds a cell; it is shown on the open cell instead.
  const reservationAt = (machineId, column) => reservations.find((item) => (
    item.status !== 'no_show'
    && item.resourceId === machineId && overlaps(item.startTime, item.endTime, column.startTime, column.endTime)
  ))
  const noShowAt = (machineId, column) => reservations.find((item) => (
    item.status === 'no_show'
    && item.resourceId === machineId && overlaps(item.startTime, item.endTime, column.startTime, column.endTime)
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

  const checkInByPass = async (raw) => {
    const payload = String(raw ?? passText).trim()
    if (!payload) return
    setBusy(true)
    setScan(null)
    setScanOpen(false)
    const result = await redeemSessionPass(payload)
    setBusy(false)
    if (result.error) {
      setScan({ error: result.error })
      return
    }
    const body = result.data || {}
    setScan({
      name: body.player?.displayName || body.player?.userId || 'Player',
      status: body.reservation?.status || '',
      eligible: body.eligible !== false,
      reason: body.failureMessage || '',
    })
    setPassText('')
    await load()
  }

  const addWalkIn = async () => {
    if (!walkInPlayer) return
    const slot = nextOpenSlot(columns, machines, reservations)
    if (!slot) {
      setWalkInOpen(false)
      setMessage('No open time is left today.')
      return
    }
    setBusy(true)
    setMessage('')
    const result = await bookReservation({
      userId: walkInPlayer,
      resourceId: slot.machineId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      venueId,
    })
    setBusy(false)
    setWalkInOpen(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    const when = clockFace(slot.startTime, timezone)
    setMessage(`Walk-in booked on ${slot.machineName} at ${when.label} ${when.period}`)
    await load()
  }

  const openWalkIn = () => {
    if (date !== todayKey()) {
      setDate(todayKey())
      setMessage("Walk-ins go on today's grid. Choose the Player again.")
      return
    }
    setWalkInPlayer((current) => current || users[0]?.userId || '')
    setWalkInOpen(true)
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
        <Button variant="outlined" data-testid="walk-in-open" disabled={!venueId || busy} onClick={openWalkIn}>
          Add walk-in
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="flex-start" data-testid="check-in-panel">
        <TextField
          size="small"
          label="Pass code"
          value={passText}
          onChange={(event) => setPassText(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') checkInByPass() }}
          helperText="Scan the Player's pass, photograph it, or type its code"
          sx={{ minWidth: 320 }}
          inputProps={{ 'data-testid': 'check-in-code', autoComplete: 'off' }}
        />
        <Button
          variant="outlined"
          data-testid="check-in-scan"
          disabled={busy}
          onClick={() => setScanOpen(true)}
          sx={{ mt: 0.5 }}
        >
          Scan pass
        </Button>
        <Button variant="contained" data-testid="check-in-submit" disabled={busy || !passText.trim()} onClick={() => checkInByPass()} sx={{ mt: 0.5 }}>
          Check in
        </Button>
      </Stack>
      <PassScanDialog open={scanOpen} onClose={() => setScanOpen(false)} onDetected={checkInByPass} />
      {scan?.error && <Alert severity="error" sx={{ mb: 2 }} data-testid="check-in-result">{scan.error}</Alert>}
      {scan && !scan.error && (
        <Alert severity={scan.eligible ? 'success' : 'warning'} sx={{ mb: 2 }} data-testid="check-in-result">
          {scan.name} is checked in.
          {scan.eligible
            ? ' Eligible to play. The Operator confirms before the session starts.'
            : ` Not ready to play: ${scan.reason || 'see the Player record'}`}
        </Alert>
      )}
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
                          {booked ? (
                            <Box component="span" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
                              <span>{userName(booked.userId)}</span>
                              <Box component="span" data-testid={`slot-status-${machine.instanceId}-${index}`} sx={{ fontSize: 11, opacity: 0.9 }}>
                                {playerStatus(booked, sessions)}
                              </Box>
                            </Box>
                          ) : (
                            <Box component="span" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.2 }}>
                              <span>{past ? 'Not Available' : 'Open'}</span>
                              {noShowAt(machine.instanceId, column) && (
                                <Box component="span" data-testid={`slot-status-${machine.instanceId}-${index}`} sx={{ fontSize: 11, opacity: 0.9 }}>
                                  {`No-show: ${userName(noShowAt(machine.instanceId, column).userId)}`}
                                </Box>
                              )}
                            </Box>
                          )}
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

      <Dialog open={walkInOpen} onClose={() => setWalkInOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add a walk-in</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2">The Player is booked for the next open half hour on any machine.</Typography>
            <TextField
              select
              label="Player"
              value={walkInPlayer}
              onChange={(event) => setWalkInPlayer(event.target.value)}
              inputProps={{ 'data-testid': 'walk-in-player' }}
            >
              {users.map((user) => (
                <MenuItem key={user.userId} value={user.userId}>{user.name || user.userId}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWalkInOpen(false)}>Close</Button>
          <Button variant="contained" data-testid="walk-in-confirm" disabled={busy || !walkInPlayer} onClick={addWalkIn}>
            Book walk-in
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
