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
import { useAuth } from '../../auth/useAuth'
import { cloudCapabilities } from '../../auth/rolePermissions'
import { createSupportTicket, listSupportTickets } from '../../api/cloud'

const STATUSES = ['', 'open', 'in_progress', 'waiting', 'resolved', 'closed']

function formatWhen(iso) {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return String(iso)
  return new Date(ms).toLocaleString()
}

function statusColor(status) {
  if (status === 'open') return 'warning'
  if (status === 'in_progress') return 'info'
  if (status === 'waiting') return 'default'
  if (status === 'resolved' || status === 'closed') return 'success'
  return 'default'
}

export default function SupportPage() {
  const { user } = useAuth()
  const canManage = cloudCapabilities(user).technician
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [tickets, setTickets] = useState([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ subject: '', description: '', deviceId: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await listSupportTickets(status ? { status } : {})
    if (result.error) {
      setError(result.error)
      setTickets([])
    } else {
      setTickets(result.data?.tickets || [])
    }
    setLoading(false)
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const openTicket = async () => {
    if (!form.subject.trim()) return
    setBusy(true)
    setActionMessage('')
    const result = await createSupportTicket({
      subject: form.subject.trim(),
      description: form.description.trim(),
      deviceId: form.deviceId.trim() || undefined,
      priority: 'normal',
    })
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setForm({ subject: '', description: '', deviceId: '' })
    setActionMessage(`Ticket ${result.data?.ticket?.ticketId || ''} opened.`)
    await load()
  }

  return (
    <PageScaffold
      title="Support"
      category="Device & Fleet"
      description="Open a ticket for a treadmill that needs service. Field Service Technicians land here."
    >
      <Stack spacing={2} data-testid="support-page">
        {error ? <Alert severity="error">{error}</Alert> : null}
        {actionMessage ? <Alert severity="success" data-testid="support-action">{actionMessage}</Alert> : null}

        {canManage ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'flex-start' }}>
            <TextField
              size="small"
              label="Subject"
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              sx={{ minWidth: 240 }}
              inputProps={{ 'data-testid': 'support-subject' }}
            />
            <TextField
              size="small"
              label="Treadmill id"
              value={form.deviceId}
              onChange={(event) => setForm({ ...form, deviceId: event.target.value })}
              sx={{ minWidth: 180 }}
              inputProps={{ 'data-testid': 'support-device' }}
            />
            <TextField
              size="small"
              label="What is wrong"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              sx={{ flex: 1, minWidth: 220 }}
              inputProps={{ 'data-testid': 'support-description' }}
            />
            <Button
              variant="contained"
              disabled={busy || !form.subject.trim()}
              onClick={openTicket}
              data-testid="support-create"
              sx={{ whiteSpace: 'nowrap' }}
            >
              Open ticket
            </Button>
          </Stack>
        ) : (
          <Typography color="text.secondary">
            Field Service Technicians open and track tickets here.
          </Typography>
        )}

        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          sx={{ maxWidth: 220 }}
          data-testid="support-status-filter"
        >
          {STATUSES.map((value) => (
            <MenuItem key={value || 'all'} value={value}>
              {value || 'All statuses'}
            </MenuItem>
          ))}
        </TextField>

        {loading ? (
          <CircularProgress size={24} />
        ) : tickets.length === 0 ? (
          <Typography color="text.secondary" data-testid="support-empty">No tickets.</Typography>
        ) : (
          <Table size="small" data-testid="support-table">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Treadmill</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Id</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((row) => (
                <TableRow key={row.ticketId} data-testid={`support-ticket-${row.ticketId}`}>
                  <TableCell>{formatWhen(row.createdAt)}</TableCell>
                  <TableCell>{row.subject}</TableCell>
                  <TableCell>{row.instanceId || row.deviceId || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" color={statusColor(row.status)} label={row.status || 'open'} />
                  </TableCell>
                  <TableCell>{row.ticketId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Stack>
    </PageScaffold>
  )
}
