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
import { assignVenueRole, getOperatorMe, listVenueRoles, listVenues, unassignVenueRole } from '../../api/cloud'

const STAFF_ROLES = [
  { id: 'bandit-operator', label: 'Operator' },
  { id: 'bandit-technician', label: 'Technician' },
  { id: 'bandit-venue-admin', label: 'Venue admin' },
]

export default function StaffPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [venues, setVenues] = useState([])
  const [venueId, setVenueId] = useState('')
  const [assignments, setAssignments] = useState([])
  const [principal, setPrincipal] = useState('')
  const [role, setRole] = useState('bandit-operator')
  const [message, setMessage] = useState('')

  const loadVenues = useCallback(async () => {
    setLoading(true)
    setError('')
    const [operatorRes, venuesRes] = await Promise.all([getOperatorMe(), listVenues()])
    if (operatorRes.error && venuesRes.error) {
      setError(operatorRes.error || venuesRes.error)
      setLoading(false)
      return
    }
    const nextVenues = venuesRes.data?.venues || []
    setVenues(nextVenues)
    setVenueId((current) => current || nextVenues[0]?.venueId || '')
    setLoading(false)
  }, [])

  const loadRoles = useCallback(async (id) => {
    if (!id) {
      setAssignments([])
      return
    }
    const { data, error: apiError } = await listVenueRoles(id)
    if (apiError) {
      setError(apiError)
      setAssignments([])
      return
    }
    setError('')
    setAssignments(data?.assignments || [])
  }, [])

  useEffect(() => {
    loadVenues()
  }, [loadVenues])

  useEffect(() => {
    loadRoles(venueId)
  }, [venueId, loadRoles])

  const handleAssign = async () => {
    const trimmed = principal.trim()
    if (!venueId || !trimmed) {
      return
    }
    setMessage('')
    const { data, error: apiError } = await assignVenueRole(venueId, {
      principal: trimmed,
      role,
    })
    if (apiError) {
      setMessage(apiError)
      return
    }
    setPrincipal('')
    setMessage(`Assigned ${data?.assignment?.role} to ${data?.assignment?.principal}`)
    await loadRoles(venueId)
  }

  return (
    <PageScaffold
      title="Staff"
      category="Cloud"
      description="Assign console roles to staff principals (email or username) for this venue. Cognito sign-in still uses the matching group."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="staff-message">
          {message}
        </Alert>
      )}
      {!loading && !error && (
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <TextField
              select
              label="Venue"
              size="small"
              sx={{ minWidth: 240 }}
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              inputProps={{ 'data-testid': 'staff-venue' }}
            >
              {venues.map((venue) => (
                <MenuItem key={venue.venueId} value={venue.venueId}>
                  {venue.name || venue.venueId}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Staff email or username"
              size="small"
              sx={{ minWidth: 260 }}
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              inputProps={{ 'data-testid': 'staff-principal' }}
            />
            <TextField
              select
              label="Role"
              size="small"
              sx={{ minWidth: 180 }}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              inputProps={{ 'data-testid': 'staff-role' }}
            >
              {STAFF_ROLES.map((entry) => (
                <MenuItem key={entry.id} value={entry.id}>
                  {entry.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              onClick={handleAssign}
              disabled={!venueId || !principal.trim()}
              data-testid="staff-assign"
            >
              Assign role
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Principal</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Assignment</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assignments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary">No staff assignments yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {assignments.map((assignment) => (
                <TableRow key={assignment.assignmentId}>
                  <TableCell>{assignment.principal}</TableCell>
                  <TableCell>
                    <Chip size="small" label={assignment.role} />
                  </TableCell>
                  <TableCell>{assignment.assignmentId}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      color="error"
                      onClick={async () => {
                        setMessage('')
                        const { error: apiError } = await unassignVenueRole(
                          venueId,
                          assignment.assignmentId,
                        )
                        if (apiError) {
                          setMessage(apiError)
                          return
                        }
                        setMessage(`Removed ${assignment.principal}`)
                        await loadRoles(venueId)
                      }}
                    >
                      Remove
                    </Button>
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
