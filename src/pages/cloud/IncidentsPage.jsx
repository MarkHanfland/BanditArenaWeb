import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import { useAuth } from '../../auth/useAuth'
import { cloudCapabilities } from '../../auth/rolePermissions'
import { createIncident, listIncidents, releaseIncidentHold } from '../../api/cloud'

function formatWhen(iso) {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return String(iso)
  return new Date(ms).toLocaleString()
}

export default function IncidentsPage() {
  const { user } = useAuth()
  const caps = cloudCapabilities(user)
  const canList = caps.venueAdmin
  const canFile = caps.frontDesk
  const canRelease = caps.cloudAdmin
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [incidents, setIncidents] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [releaseId, setReleaseId] = useState('')
  const [reason, setReason] = useState('')
  const [form, setForm] = useState({
    sessionId: '',
    instanceId: '',
    injured: false,
    description: '',
    witnesses: '',
    actionsTaken: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    if (!canList) {
      setIncidents([])
      setLoading(false)
      return
    }
    const res = await listIncidents()
    if (res.error) {
      setError(res.error)
      setIncidents([])
    } else {
      setIncidents(res.data?.incidents || [])
    }
    setLoading(false)
  }, [canList])

  useEffect(() => {
    load()
  }, [load])

  const handleFile = async () => {
    setBusy(true)
    setActionMessage('')
    const res = await createIncident({
      sessionId: form.sessionId.trim() || undefined,
      instanceId: form.instanceId.trim() || undefined,
      injured: form.injured,
      description: form.description.trim(),
      witnesses: form.witnesses.split(',').map((w) => w.trim()).filter(Boolean),
      actionsTaken: form.actionsTaken.trim() || undefined,
    })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setOpen(false)
    setForm({ sessionId: '', instanceId: '', injured: false, description: '', witnesses: '', actionsTaken: '' })
    setActionMessage(res.data?.incident?.injured ? 'Incident filed. Bandit safety was notified.' : 'Incident filed. A legal hold is in place.')
    load()
  }

  const handleRelease = async () => {
    setBusy(true)
    const res = await releaseIncidentHold(releaseId, { reason: reason.trim() })
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setReleaseId('')
    setReason('')
    setActionMessage('Hold released.')
    load()
  }

  return (
    <PageScaffold
      title="Safety incidents"
      description="File a report linked to a session or treadmill. An injury notifies Bandit safety and places a legal hold so the evidence is not deleted."
      category="Operations"
    >
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {actionMessage && <Alert severity="info" data-testid="incidents-action">{actionMessage}</Alert>}
        {canFile ? (
          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" onClick={() => setOpen(true)} data-testid="incidents-file">
              File incident
            </Button>
          </Stack>
        ) : null}
        {loading ? (
          <CircularProgress size={24} />
        ) : !canList ? (
          <Typography color="text.secondary" data-testid="incidents-empty">
            File a report linked to a session or treadmill. Venue Administrators review the list.
          </Typography>
        ) : incidents.length === 0 ? (
          <Typography color="text.secondary" data-testid="incidents-empty">No incidents filed.</Typography>
        ) : (
          <Table size="small" data-testid="incidents-table">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Site</TableCell>
                <TableCell>Injured</TableCell>
                <TableCell>Hold</TableCell>
                <TableCell>Description</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {incidents.map((row) => (
                <TableRow key={row.incidentId} data-testid={`incident-${row.incidentId}`}>
                  <TableCell>{formatWhen(row.filedAt)}</TableCell>
                  <TableCell>{row.venueId}</TableCell>
                  <TableCell>
                    <Chip size="small" color={row.injured ? 'error' : 'default'} label={row.injured ? 'Yes' : 'No'} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={row.legalHold ? 'warning' : 'success'} label={row.legalHold ? 'Held' : 'Released'} />
                  </TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell>
                    {canRelease && row.legalHold ? (
                      <Button size="small" onClick={() => setReleaseId(row.incidentId)} data-testid={`incident-release-${row.incidentId}`}>
                        Release hold
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>File an incident</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Session id"
              value={form.sessionId}
              onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
              inputProps={{ 'data-testid': 'incident-session' }}
            />
            <TextField
              label="Treadmill id"
              value={form.instanceId}
              onChange={(e) => setForm({ ...form, instanceId: e.target.value })}
              inputProps={{ 'data-testid': 'incident-device' }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.injured}
                  onChange={(e) => setForm({ ...form, injured: e.target.checked })}
                  inputProps={{ 'data-testid': 'incident-injured' }}
                />
              }
              label="Someone was injured"
            />
            <TextField
              label="What happened"
              multiline
              minRows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              inputProps={{ 'data-testid': 'incident-description' }}
            />
            <TextField
              label="Witnesses (comma separated)"
              value={form.witnesses}
              onChange={(e) => setForm({ ...form, witnesses: e.target.value })}
              inputProps={{ 'data-testid': 'incident-witnesses' }}
            />
            <TextField
              label="Actions taken"
              value={form.actionsTaken}
              onChange={(e) => setForm({ ...form, actionsTaken: e.target.value })}
              inputProps={{ 'data-testid': 'incident-actions' }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !form.description.trim()} onClick={handleFile} data-testid="incident-submit">
            File
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(releaseId)} onClose={() => setReleaseId('')} maxWidth="xs" fullWidth>
        <DialogTitle>Release legal hold</DialogTitle>
        <DialogContent>
          <TextField
            label="Reason"
            fullWidth
            multiline
            minRows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            sx={{ mt: 1 }}
            inputProps={{ 'data-testid': 'incident-release-reason' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReleaseId('')}>Cancel</Button>
          <Button variant="contained" disabled={busy || reason.trim().length < 10} onClick={handleRelease} data-testid="incident-release-confirm">
            Release
          </Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
