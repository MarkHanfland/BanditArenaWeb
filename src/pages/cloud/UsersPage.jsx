import React, { useCallback, useEffect, useState } from 'react'
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
} from '../../api/cloud'

export default function UsersPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState(null)
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [sessions, setSessions] = useState([])
  const [addOpen, setAddOpen] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '' })
  const [actionMessage, setActionMessage] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    const [tenantRes, usersRes] = await Promise.all([getTenantMe(), listUsers()])
    if (tenantRes.error || usersRes.error) {
      setError(tenantRes.error || usersRes.error)
    } else {
      setTenant(tenantRes.data?.tenant)
      setUsers(usersRes.data?.users || [])
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
    const { data, error: apiError } = await createUser(newUser)
    if (apiError) {
      setActionMessage(apiError)
      return
    }
    setAddOpen(false)
    setNewUser({ name: '', email: '' })
    setActionMessage(`Created ${data?.user?.name}`)
    await loadUsers()
  }

  const handleStartSession = async (userId) => {
    setActionMessage('')
    const entitlement = await checkEntitlement({ userId, action: 'session_start' })
    if (entitlement.error || !entitlement.data?.allowed) {
      setActionMessage(entitlement.error || 'Session blocked: enrollment not active')
      return
    }
    const sessionRes = await createSession({ userId, banditProductId: 'product-demo-treadmill' })
    if (sessionRes.error) {
      setActionMessage(sessionRes.error)
      return
    }
    setActionMessage(`Session ${sessionRes.data?.session?.sessionId} started`)
    if (selectedUser?.userId === userId) {
      const sessionsRes = await listUserSessions(userId)
      setSessions(sessionsRes.data?.sessions || [])
    }
  }

  return (
    <PageScaffold
      title="User Profile & Enrollment"
      category="Cloud"
      description="Enrollment state, safety profiles, and session access for venue users (SVC-004)."
    >
      {tenant && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Tenant: {tenant.name} · Venue: {tenant.venueName}
        </Typography>
      )}
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {actionMessage && <Alert severity="info" sx={{ mb: 2 }}>{actionMessage}</Alert>}
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
                    <Chip size="small" label={user.enrollmentState} color={user.enrollmentState === 'active' ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openUserDetail(user.userId)}>Details</Button>
                    <Button size="small" onClick={() => handleStartSession(user.userId)}>Start Session</Button>
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
            <Typography variant="subtitle2" sx={{ pt: 1 }}>Sessions ({sessions.length})</Typography>
            {sessions.map((s) => (
              <Typography key={s.sessionId} variant="body2" color="text.secondary">
                {s.sessionId} · {s.status} · {s.duration || 0}s
              </Typography>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedUser(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Name" fullWidth value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
            <TextField label="Email" fullWidth value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddUser}>Create</Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
