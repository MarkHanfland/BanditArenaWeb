import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
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
  bookReservation,
  cancelReservation,
  checkInReservation,
  createReservationSlot,
  listReservations,
  listUsers,
  markReservationNoShow,
  sendNotification,
} from '../../api/cloud'
import { rememberPlayer } from '../../session/lastPlayers'

function dayKey(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown'
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function statusColor(status) {
  if (status === 'available') return 'success'
  if (status === 'booked') return 'primary'
  if (status === 'checked_in') return 'info'
  if (status === 'cancelled' || status === 'no_show') return 'default'
  return 'default'
}

export default function ReservationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [slots, setSlots] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [message, setMessage] = useState('')
  const [messageSeverity, setMessageSeverity] = useState('info')
  const [busySlotId, setBusySlotId] = useState('')
  const [newSlotStart, setNewSlotStart] = useState('')
  const [newSlotDuration, setNewSlotDuration] = useState(60)
  const [creating, setCreating] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [reservationsRes, usersRes] = await Promise.all([listReservations(), listUsers()])
      if (reservationsRes.error || usersRes.error) {
        setError(reservationsRes.error || usersRes.error)
        setSlots([])
        setUsers([])
      } else {
        setSlots(reservationsRes.data?.reservations || [])
        const activeUsers = (usersRes.data?.users || []).filter((u) => u.enrollmentState === 'active')
        setUsers(activeUsers)
        if (activeUsers.length > 0) {
          setSelectedUserId((prev) =>
            prev && activeUsers.some((u) => u.userId === prev) ? prev : activeUsers[0].userId,
          )
        }
        setError('')
      }
    } catch (err) {
      setError(err?.message || 'Failed to load reservations')
      setSlots([])
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const slotsByDay = useMemo(() => {
    const sorted = [...slots].sort((a, b) => {
      const aTime = new Date(a.startTime).getTime()
      const bTime = new Date(b.startTime).getTime()
      return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime)
    })
    const groups = new Map()
    for (const slot of sorted) {
      const key = dayKey(slot.startTime)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(slot)
    }
    return [...groups.entries()]
  }, [slots])

  const flash = (text, severity = 'info') => {
    setMessageSeverity(severity)
    setMessage(text)
  }

  const handleBook = async (slotId) => {
    setBusySlotId(slotId)
    flash('')
    try {
      const { data, error: apiError } = await bookReservation({ slotId, userId: selectedUserId })
      if (apiError) {
        flash(apiError, 'error')
        return
      }
      await sendNotification({
        userId: selectedUserId,
        template: 'session_reminder',
        channel: 'email',
        variables: { slotId },
      })
      const bookedUser = users.find((user) => user.userId === selectedUserId)
      rememberPlayer({
        userId: selectedUserId,
        displayName: bookedUser?.name || selectedUserId,
      })
      flash(
        `Booked ${data?.reservation?.slotId || slotId} for ${bookedUser?.name || selectedUserId}. Reminder queued.`,
        'success',
      )
      await loadData()
    } catch (err) {
      flash(err?.message || 'Booking failed', 'error')
    } finally {
      setBusySlotId('')
    }
  }

  const runSlotAction = async (slotId, action, label) => {
    setBusySlotId(slotId)
    flash('')
    try {
      const { error: apiError } = await action()
      if (apiError) {
        flash(apiError, 'error')
        return
      }
      flash(`${label} ${slotId}`, 'success')
      await loadData()
    } catch (err) {
      flash(err?.message || `${label} failed`, 'error')
    } finally {
      setBusySlotId('')
    }
  }

  const handleCreateSlot = async () => {
    if (!newSlotStart) {
      flash('Pick a start time for the new slot', 'error')
      return
    }
    setCreating(true)
    flash('')
    try {
      const start = new Date(newSlotStart)
      if (Number.isNaN(start.getTime())) {
        flash('Invalid start time', 'error')
        return
      }
      const end = new Date(start.getTime() + Number(newSlotDuration || 60) * 60_000)
      const { data, error: apiError } = await createReservationSlot({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationMinutes: Number(newSlotDuration) || 60,
      })
      if (apiError) {
        flash(apiError, 'error')
        return
      }
      flash(`Created slot ${data?.reservation?.slotId || data?.slot?.slotId || ''}`, 'success')
      setNewSlotStart('')
      await loadData()
    } catch (err) {
      flash(err?.message || 'Failed to create slot', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <PageScaffold
      title="Reservations"
      category="Cloud"
      description="Staff session calendar — book, check in, cancel, and create slots (SVC-009)."
    >
      {loading && <CircularProgress size={24} />}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={loadData}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity={messageSeverity} sx={{ mb: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      {!loading && !error && (
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <TextField
              select
              label="Book as user"
              size="small"
              sx={{ minWidth: 280 }}
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              inputProps={{ 'data-testid': 'book-as-user' }}
            >
              {users.map((user) => (
                <MenuItem key={user.userId} value={user.userId}>
                  {user.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="New slot start"
              type="datetime-local"
              size="small"
              value={newSlotStart}
              onChange={(e) => setNewSlotStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ 'data-testid': 'new-slot-start' }}
            />
            <TextField
              label="Duration (min)"
              type="number"
              size="small"
              sx={{ width: 140 }}
              value={newSlotDuration}
              onChange={(e) => setNewSlotDuration(e.target.value)}
            />
            <Button
              variant="outlined"
              disabled={creating}
              onClick={handleCreateSlot}
              data-testid="create-slot"
            >
              {creating ? 'Creating…' : 'Create slot'}
            </Button>
          </Stack>

          {slotsByDay.length === 0 ? (
            <Typography color="text.secondary">No reservation slots yet.</Typography>
          ) : (
            slotsByDay.map(([day, daySlots]) => (
              <Stack key={day} spacing={1}>
                <Typography variant="h6" component="h2">
                  {day}
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Slot</TableCell>
                      <TableCell>Start</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {daySlots.map((slot) => (
                      <TableRow key={slot.slotId}>
                        <TableCell>{slot.slotId}</TableCell>
                        <TableCell>
                          {slot.startTime && !Number.isNaN(new Date(slot.startTime).getTime())
                            ? new Date(slot.startTime).toLocaleTimeString()
                            : '—'}
                        </TableCell>
                        <TableCell>{slot.userId || '—'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={slot.status} color={statusColor(slot.status)} />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                            {slot.status === 'available' ? (
                              <Button
                                size="small"
                                disabled={busySlotId === slot.slotId || !selectedUserId}
                                onClick={() => handleBook(slot.slotId)}
                                data-testid={`book-${slot.slotId}`}
                              >
                                Book
                              </Button>
                            ) : null}
                            {slot.status === 'booked' ? (
                              <>
                                <Button
                                  size="small"
                                  disabled={busySlotId === slot.slotId}
                                  onClick={() =>
                                    runSlotAction(
                                      slot.slotId,
                                      () => checkInReservation(slot.slotId),
                                      'Checked in',
                                    )
                                  }
                                  data-testid={`checkin-${slot.slotId}`}
                                >
                                  Check in
                                </Button>
                                <Button
                                  size="small"
                                  disabled={busySlotId === slot.slotId}
                                  onClick={() =>
                                    runSlotAction(
                                      slot.slotId,
                                      () => cancelReservation(slot.slotId),
                                      'Cancelled',
                                    )
                                  }
                                  data-testid={`cancel-${slot.slotId}`}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="small"
                                  color="warning"
                                  disabled={busySlotId === slot.slotId}
                                  onClick={() =>
                                    runSlotAction(
                                      slot.slotId,
                                      () => markReservationNoShow(slot.slotId),
                                      'Marked no-show',
                                    )
                                  }
                                  data-testid={`noshow-${slot.slotId}`}
                                >
                                  No-show
                                </Button>
                              </>
                            ) : null}
                            {slot.status !== 'available' && slot.status !== 'booked' ? (
                              <Typography variant="caption" color="text.secondary">
                                —
                              </Typography>
                            ) : null}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Stack>
            ))
          )}
        </Stack>
      )}
    </PageScaffold>
  )
}
