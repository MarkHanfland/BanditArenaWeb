import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
  checkEntitlement,
  createSession,
  createUser,
  getTenantMe,
  getUser,
  listUserSessions,
  listUsers,
  listVenues,
  updateEnrollmentState,
} from '../../api/cloud'
import { isCloudDeployment } from '../../config/runtime'
import { SESSION_PHASE, usePlayerSession } from '../../session/PlayerSessionContext'
import { requestSessionHistoryForUser } from '../../nav/sessionHistoryNav'

const ENROLLMENT_ACTIONS = {
  pending: [
    { next: 'active', label: 'Activate' },
    { next: 'revoked', label: 'Revoke' },
  ],
  active: [
    { next: 'suspended', label: 'Suspend' },
    { next: 'revoked', label: 'Revoke' },
  ],
  suspended: [
    { next: 'active', label: 'Activate' },
    { next: 'revoked', label: 'Revoke' },
  ],
  revoked: [],
}

function enrollmentChipColor(state) {
  if (state === 'active') return 'success'
  if (state === 'pending') return 'warning'
  if (state === 'revoked') return 'error'
  return 'default'
}

export default function UsersPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [venues, setVenues] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [sessions, setSessions] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '' })
  const [ageAttested, setAgeAttested] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [busyUserId, setBusyUserId] = useState('')
  const onDevice = !isCloudDeployment()
  const { startForPlayer, selectedMediaId, sessionActive, phase } = usePlayerSession()
  const startBlockedByActiveSession =
    sessionActive || phase === SESSION_PHASE.pending || phase === SESSION_PHASE.active

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    const [tenantRes, usersRes, venuesRes] = await Promise.all([
      getTenantMe(),
      listUsers(),
      listVenues(),
    ])
    if (tenantRes.error || usersRes.error) {
      setError(tenantRes.error || usersRes.error)
    } else {
      setTenant(tenantRes.data?.tenant)
      setUsers(usersRes.data?.users || [])
      setVenues(venuesRes.data?.venues || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const openUserDetail = async (userId) => {
    setActionMessage('')
    const { data, error: apiError } = await getUser(userId)
    if (apiError) {
      setActionMessage(apiError)
      return
    }
    setSelectedUser(data?.user)
    const sessionsRes = await listUserSessions(userId)
    setSessions(sessionsRes.data?.sessions || [])
  }

  const handleAddUser = async () => {
    setActionMessage('')
    const { data, error: apiError } = await createUser({
      ...newUser,
      ageAttested,
    })
    if (apiError) {
      setActionMessage(apiError)
      return
    }
    setAddOpen(false)
    setNewUser({ name: '', email: '' })
    setAgeAttested(false)
    setActionMessage(`Created ${data?.user?.name}`)
    await loadUsers()
  }

  const handleEnrollment = async (user, nextState) => {
    if (nextState === 'revoked') {
      const confirmed = window.confirm(`Revoke enrollment for ${user.name}? This cannot be undone.`)
      if (!confirmed) {
        return
      }
    }
    setActionMessage('')
    setBusyUserId(user.userId)
    const { data, error: apiError } = await updateEnrollmentState(user.userId, {
      enrollmentState: nextState,
    })
    setBusyUserId('')
    if (apiError) {
      setActionMessage(apiError)
      return
    }
    const toState = data?.user?.enrollmentState || nextState
    setActionMessage(`${user.name} is now ${toState}`)
    await loadUsers()
    if (selectedUser?.userId === user.userId) {
      setSelectedUser(data?.user || { ...selectedUser, enrollmentState: toState })
    }
  }

  const handleStartSession = async (userId) => {
    setActionMessage('')
    if (startBlockedByActiveSession) {
      setActionMessage('Start Session is disabled while a Player session is already active.')
      return
    }
    const user = users.find((entry) => entry.userId === userId)
    if (user && user.enrollmentState !== 'active') {
      setActionMessage('Session blocked: enrollment not active')
      return
    }
    if (onDevice) {
      if (!selectedMediaId) {
        setActionMessage('Select a media title in the header before starting a device session.')
        return
      }
      const started = await startForPlayer({
        userId,
        displayName: user?.name || userId,
        ageAttested: Boolean(user?.ageAttested),
        mediaId: selectedMediaId,
      })
      if (!started) {
        setActionMessage('Device session start failed. Use the header Player Start after selecting an enrolled Player.')
        return
      }
      setActionMessage(`Device session started for ${user?.name || userId}`)
      return
    }
    if (!selectedMediaId) {
      setActionMessage('Select a media title before creating a cloud session record.')
      return
    }
    const entitlement = await checkEntitlement({ userId, action: 'session_start' })
    if (entitlement.error || !entitlement.data?.allowed) {
      setActionMessage(entitlement.error || 'Session blocked: enrollment not active')
      return
    }
    const sessionRes = await createSession({
      userId,
      mediaId: selectedMediaId,
      banditProductId: 'product-demo-treadmill',
    })
    if (sessionRes.error) {
      setActionMessage(sessionRes.error)
      return
    }
    setActionMessage(`Cloud session record ${sessionRes.data?.session?.sessionId} created. This does not start the treadmill.`)
    if (selectedUser?.userId === userId) {
      const sessionsRes = await listUserSessions(userId)
      setSessions(sessionsRes.data?.sessions || [])
    }
  }

  return (
    <PageScaffold
      title="Enrollment / Check-In"
      category="Operations"
      description={onDevice
        ? 'Enroll Player accounts here. Start a run from the header: pick a Player and Start. Age 8+ is attested when the account is created.'
        : 'Enrollment state and safety profiles for Player accounts. Creating a cloud session record does not start the treadmill.'}
    >
      {tenant && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Operator: {tenant.name}
          {venues.length > 0
            ? ` · Venues: ${venues.map((v) => v.name || v.venueId).join(', ')}`
            : ''}
        </Typography>
      )}
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {actionMessage && <Alert severity="info" sx={{ mb: 2 }} data-testid="enrollment-message">{actionMessage}</Alert>}
      {!loading && !error && (
        <Stack spacing={2}>
          <Box>
            <Button variant="contained" onClick={() => setAddOpen(true)} data-testid="add-user">
              Add User
            </Button>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Enrollment</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.userId} hover>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={user.enrollmentState}
                      color={enrollmentChipColor(user.enrollmentState)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openUserDetail(user.userId)}>Details</Button>
                    <Button
                      size="small"
                      onClick={() => requestSessionHistoryForUser(user.userId)}
                      data-testid={`session-history-${user.userId}`}
                    >
                      Session history
                    </Button>
                    {(ENROLLMENT_ACTIONS[user.enrollmentState] || []).map((action) => (
                      <Button
                        key={action.next}
                        size="small"
                        color={action.next === 'revoked' ? 'error' : 'primary'}
                        disabled={busyUserId === user.userId}
                        onClick={() => handleEnrollment(user, action.next)}
                        data-testid={`${action.next === 'active' ? 'activate' : action.next === 'suspended' ? 'suspend' : 'revoke'}-${user.userId}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                    <Button
                      size="small"
                      disabled={startBlockedByActiveSession || user.enrollmentState !== 'active'}
                      onClick={() => handleStartSession(user.userId)}
                      data-testid={`start-session-${user.userId}`}
                    >
                      Start Session
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      )}

      <Dialog open={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedUser?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pt: 1 }}>
            <Typography variant="body2">Enrollment: {selectedUser?.enrollmentState}</Typography>
            <Typography variant="body2">
              Safety: {selectedUser?.safetyProfile?.heightCm} cm, {selectedUser?.safetyProfile?.weightKg} kg
            </Typography>
            <Typography variant="subtitle2" sx={{ pt: 1 }}>Session history ({sessions.length})</Typography>
            {sessions.map((s) => (
              <Typography key={s.sessionId} variant="body2" color="text.secondary">
                {s.sessionId} · {s.status} · {s.duration || 0}s
              </Typography>
            ))}
            <Button
              size="small"
              sx={{ alignSelf: 'flex-start' }}
              onClick={() => {
                const userId = selectedUser?.userId
                setSelectedUser(null)
                requestSessionHistoryForUser(userId)
              }}
              data-testid="user-detail-open-session-history"
            >
              Open Session History
            </Button>          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedUser(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              fullWidth
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              inputProps={{ 'data-testid': 'add-user-name' }}
            />
            <TextField
              label="Email"
              fullWidth
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              inputProps={{ 'data-testid': 'add-user-email' }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={ageAttested}
                  onChange={(e) => setAgeAttested(e.target.checked)}
                  inputProps={{ 'data-testid': 'add-user-age' }}
                />
              }
              label="Player is age 8 or older"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddUser}
            disabled={!newUser.name.trim() || !ageAttested}
            data-testid="add-user-submit"
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
