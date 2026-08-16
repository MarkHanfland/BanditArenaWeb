import React, { useCallback, useEffect, useState } from 'react'
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
import { bookReservation, listReservations, listUsers, sendNotification } from '../../api/cloud'
import { rememberPlayer } from '../../session/lastPlayers'

export default function ReservationsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [slots, setSlots] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [message, setMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [reservationsRes, usersRes] = await Promise.all([listReservations(), listUsers()])
    if (reservationsRes.error || usersRes.error) {
      setError(reservationsRes.error || usersRes.error)
    } else {
      setSlots(reservationsRes.data?.reservations || [])
      const activeUsers = (usersRes.data?.users || []).filter((u) => u.enrollmentState === 'active')
      setUsers(activeUsers)
      if (activeUsers.length > 0) {
        setSelectedUserId(activeUsers[0].userId)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleBook = async (slotId) => {
    setMessage('')
    const { data, error: apiError } = await bookReservation({ slotId, userId: selectedUserId })
    if (apiError) {
      setMessage(apiError)
      return
    }
    await sendNotification({
      userId: selectedUserId,
      template: 'session_reminder',
      channel: 'email',
    })
    const bookedUser = users.find((user) => user.userId === selectedUserId)
    rememberPlayer({
      userId: selectedUserId,
      displayName: bookedUser?.name || selectedUserId,
    })
    setMessage(
      `Booked ${data?.reservation?.slotId} for ${bookedUser?.name || selectedUserId}. Set as next player on this console.`,
    )
    await loadData()
  }

  return (
    <PageScaffold
      title="Reservations"
      category="Cloud"
      description="Session scheduling and booking workflow (SVC-009, SVC-014 notification stub)."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="info" sx={{ mb: 2 }}>{message}</Alert>}
      {!loading && !error && (
        <Stack spacing={2}>
          <TextField
            select
            label="Book as user"
            size="small"
            sx={{ maxWidth: 320 }}
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            inputProps={{ 'data-testid': 'book-as-user' }}
          >
            {users.map((user) => (
              <MenuItem key={user.userId} value={user.userId}>{user.name}</MenuItem>
            ))}
          </TextField>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Slot</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {slots.map((slot) => (
                <TableRow key={slot.slotId}>
                  <TableCell>{slot.slotId}</TableCell>
                  <TableCell>{new Date(slot.startTime).toLocaleString()}</TableCell>
                  <TableCell>
                    <Chip size="small" label={slot.status} color={slot.status === 'available' ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    {slot.status === 'available' ? (
                      <Button size="small" onClick={() => handleBook(slot.slotId)} data-testid={`book-${slot.slotId}`}>
                        Book
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Booked</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      )}
    </PageScaffold>
  )
}
