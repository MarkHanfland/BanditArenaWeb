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
import {
  acknowledgePlatformIncident,
  listOperationalLogs,
  listPlatformIncidents,
} from '../../api/cloud'

function severityColor(severity) {
  if (severity === 'CRITICAL') return 'error'
  if (severity === 'ERROR') return 'error'
  if (severity === 'WARNING') return 'warning'
  return 'default'
}

function formatWhen(iso) {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return String(iso)
  return new Date(ms).toLocaleString()
}

export default function ServiceLogsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [entries, setEntries] = useState([])
  const [incidents, setIncidents] = useState([])
  const [severity, setSeverity] = useState('WARNING')
  const [route, setRoute] = useState('')
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [logsRes, incidentsRes] = await Promise.all([
      listOperationalLogs({ severity, route, q }),
      listPlatformIncidents(),
    ])
    if (logsRes.error) {
      setError(logsRes.error)
      setEntries([])
    } else {
      setEntries(logsRes.data?.entries || [])
    }
    if (incidentsRes.error && !logsRes.error) {
      setError(incidentsRes.error)
      setIncidents([])
    } else {
      setIncidents(incidentsRes.data?.incidents || [])
    }
    setLoading(false)
  }, [q, route, severity])

  useEffect(() => {
    load()
  }, [load])

  const onAck = async (incidentId) => {
    setBusyId(incidentId)
    setActionMessage('')
    const result = await acknowledgePlatformIncident(incidentId)
    setBusyId('')
    if (result.error) {
      setError(result.error)
      return
    }
    setActionMessage(result.data?.message || 'Incident acknowledged')
    await load()
  }

  return (
    <PageScaffold
      title="Service Logs"
      category="Administration"
      description="BanditArenaCloud WARNING and higher events plus platform incidents. Capture runs on the API even when this page is closed."
    >
      <Stack spacing={2} data-testid="service-logs-page">
        {error ? <Alert severity="error">{error}</Alert> : null}
        {actionMessage ? <Alert severity="success">{actionMessage}</Alert> : null}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField
            select
            size="small"
            label="Minimum severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            sx={{ minWidth: 180 }}
            data-testid="service-logs-severity"
          >
            {['WARNING', 'ERROR', 'CRITICAL'].map((level) => (
              <MenuItem key={level} value={level}>
                {level}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Route contains"
            value={route}
            onChange={(event) => setRoute(event.target.value)}
            sx={{ minWidth: 200 }}
          />
          <TextField
            size="small"
            label="Search"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            sx={{ minWidth: 200 }}
          />
          <Button variant="outlined" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Stack>

        <Typography variant="h6">Platform incidents</Typography>
        {loading ? (
          <CircularProgress size={28} />
        ) : (
          <Table size="small" data-testid="service-incidents-table">
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Route</TableCell>
                <TableCell>Count</TableCell>
                <TableCell>Last seen</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {incidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary">No platform incidents.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                incidents.map((incident) => (
                  <TableRow key={incident.incidentId}>
                    <TableCell>{incident.status}</TableCell>
                    <TableCell>
                      <Chip size="small" color={severityColor(incident.severity)} label={incident.severity} />
                    </TableCell>
                    <TableCell>{incident.code}</TableCell>
                    <TableCell>{incident.route}</TableCell>
                    <TableCell>{incident.count || 1}</TableCell>
                    <TableCell>{formatWhen(incident.lastAt || incident.openedAt)}</TableCell>
                    <TableCell>
                      {incident.status === 'open' ? (
                        <Button
                          size="small"
                          disabled={busyId === incident.incidentId}
                          onClick={() => onAck(incident.incidentId)}
                          data-testid={`service-incident-ack-${incident.incidentId}`}
                        >
                          Acknowledge
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}

        <Typography variant="h6">Operational logs</Typography>
        {loading ? (
          <CircularProgress size={28} />
        ) : (
          <Table size="small" data-testid="service-logs-table">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Route</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary">No operational log entries at this severity.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.logId || `${entry.timestamp}-${entry.route}`}>
                    <TableCell>{formatWhen(entry.timestamp)}</TableCell>
                    <TableCell>
                      <Chip size="small" color={severityColor(entry.severity)} label={entry.severity} />
                    </TableCell>
                    <TableCell>{entry.code}</TableCell>
                    <TableCell>{entry.route}</TableCell>
                    <TableCell>{entry.message}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Stack>
    </PageScaffold>
  )
}
