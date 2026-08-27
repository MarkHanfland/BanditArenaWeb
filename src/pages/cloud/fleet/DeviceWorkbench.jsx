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
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {
  activateDevice,
  checkUpdates,
  createDeviceMaintenance,
  createSupportTicket,
  decommissionDevice,
  getDeviceInventory,
  issueLicense,
  listDeviceMaintenance,
  listDiagnosticCommands,
  listSupportTickets,
  queueDiagnosticCommand,
  transferDevice,
} from '../../../api/cloud'

const TAB_IDS = [
  'overview',
  'lifecycle',
  'updates',
  'maintenance',
  'diagnostics',
  'tickets',
  'financial',
]

function usd(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    n || 0,
  )
}

function Metric({ label, value, hint }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        minWidth: 120,
        flex: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  )
}

export default function DeviceWorkbench({
  device,
  accent,
  initialTab = 'overview',
  onMessage,
  onRefresh,
  venues = [],
}) {
  const [tab, setTab] = useState(initialTab)
  const [inventory, setInventory] = useState([])
  const [records, setRecords] = useState([])
  const [commands, setCommands] = useState([])
  const [tickets, setTickets] = useState([])
  const [updateInfo, setUpdateInfo] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [maintOpen, setMaintOpen] = useState(false)
  const [form, setForm] = useState({ type: 'routine', description: '', componentId: '' })
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferVenueId, setTransferVenueId] = useState('')
  const [diagCommand, setDiagCommand] = useState('RUN_SELF_TEST')
  const [ticketSubject, setTicketSubject] = useState('')

  useEffect(() => {
    setTab(TAB_IDS.includes(initialTab) ? initialTab : 'overview')
  }, [initialTab, device?.instanceId])

  const loadSideData = useCallback(async () => {
    if (!device?.instanceId) return
    setLoadingDetail(true)
    const [inv, maint, diag, tix, upd] = await Promise.all([
      getDeviceInventory(device.instanceId),
      listDeviceMaintenance(device.instanceId),
      listDiagnosticCommands({ deviceId: device.instanceId }),
      listSupportTickets({ deviceId: device.instanceId }),
      checkUpdates({ instanceId: device.instanceId }),
    ])
    setInventory(inv.data?.inventory || [])
    setRecords(maint.data?.records || [])
    setCommands(diag.data?.commands || [])
    setTickets(tix.data?.tickets || [])
    setUpdateInfo(upd.data || null)
    setLoadingDetail(false)
  }, [device?.instanceId])

  useEffect(() => {
    loadSideData()
  }, [loadSideData])

  if (!device) {
    return (
      <Box sx={{ p: 3, color: 'text.secondary' }}>
        Select a device from the map or list to open the workbench.
      </Box>
    )
  }

  const fin = device.financials || {}

  const handleActivate = async () => {
    const { error } = await activateDevice(device.instanceId, {})
    onMessage?.(error || `Activated ${device.instanceId}`, error ? 'error' : 'success')
    onRefresh?.()
  }

  const handleDecommission = async () => {
    const { error } = await decommissionDevice(device.instanceId, {})
    onMessage?.(error || `Decommissioned ${device.instanceId}`, error ? 'error' : 'success')
    onRefresh?.()
  }

  const handleLicense = async () => {
    const { data, error } = await issueLicense({
      instanceId: device.instanceId,
      licenseTier: 'venue_pro',
      features: ['session', 'content_base', 'ota'],
    })
    onMessage?.(
      error || `Issued ${data?.license?.licenseId} → ${device.instanceId}`,
      error ? 'error' : 'success',
    )
    onRefresh?.()
  }

  const handleTransfer = async () => {
    const { error } = await transferDevice(device.instanceId, { venueId: transferVenueId || undefined })
    setTransferOpen(false)
    onMessage?.(error || `Transferred ${device.instanceId}`, error ? 'error' : 'success')
    onRefresh?.()
  }

  const handleMaint = async () => {
    const { data, error } = await createDeviceMaintenance(device.instanceId, {
      type: form.type,
      description: form.description,
      componentIds: form.componentId ? [form.componentId] : [],
      inventoryChanges: form.componentId ? [{ componentId: form.componentId }] : [],
    })
    if (error) {
      onMessage?.(error, 'error')
      return
    }
    setMaintOpen(false)
    onMessage?.(`Recorded ${data?.record?.maintenanceId || 'maintenance'}`, 'success')
    await loadSideData()
  }

  const handleQueueDiag = async () => {
    const { data, error } = await queueDiagnosticCommand({
      deviceId: device.instanceId,
      command: diagCommand,
    })
    onMessage?.(error || `Queued ${data?.command?.commandId || diagCommand}`, error ? 'error' : 'success')
    await loadSideData()
  }

  const handleTicket = async () => {
    if (!ticketSubject.trim()) return
    const { data, error } = await createSupportTicket({
      subject: ticketSubject,
      description: `Opened from fleet console for ${device.instanceId}`,
      deviceId: device.instanceId,
      priority: 'normal',
    })
    setTicketSubject('')
    onMessage?.(error || `Ticket ${data?.ticket?.ticketId}`, error ? 'error' : 'success')
    await loadSideData()
  }

  return (
    <Box data-testid="device-workbench" sx={{ height: '100%', color: 'inherit',
      '& .MuiTableCell-root': { color: 'inherit', borderColor: 'rgba(255,255,255,0.08)' },
      '& .MuiTypography-root': { color: 'inherit' },
      '& .MuiTypography-colorTextSecondary': { color: 'rgba(255,255,255,0.55) !important' },
    }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {device.instanceId}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {device.venueName || device.venueId} · {device.computeSerialNumber}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip size="small" label={device.status} color={device.status === 'online' ? 'success' : 'default'} />
          <Chip size="small" variant="outlined" label={device.healthState || 'unknown'} />
          {device.updateAvailable && <Chip size="small" color="warning" label="Update" />}
        </Stack>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
          minHeight: 40,
          '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 },
          '& .Mui-selected': { color: accent?.secondary || 'primary.main' },
          '& .MuiTabs-indicator': { bgcolor: accent?.secondary || 'primary.main' },
        }}
      >
        <Tab label="Overview" value="overview" data-testid="fleet-tab-overview" />
        <Tab label="Lifecycle" value="lifecycle" data-testid="fleet-tab-lifecycle" />
        <Tab label="Updates" value="updates" data-testid="fleet-tab-updates" />
        <Tab label="Maintenance" value="maintenance" data-testid="fleet-tab-maintenance" />
        <Tab label="Diagnostics" value="diagnostics" data-testid="fleet-tab-diagnostics" />
        <Tab label="Tickets" value="tickets" data-testid="fleet-tab-tickets" />
        <Tab label="Financial" value="financial" data-testid="fleet-tab-financial" />
      </Tabs>

      {loadingDetail && tab !== 'overview' && tab !== 'financial' && (
        <CircularProgress size={20} sx={{ mb: 1 }} />
      )}

      {tab === 'overview' && (
        <Stack spacing={2}>
          <Stack direction="row" flexWrap="wrap" gap={1.5}>
            <Metric label="Firmware" value={device.firmwareVersion || '—'} />
            <Metric label="License" value={device.licenseTier || '—'} />
            <Metric
              label="Venue"
              value={`${device.city || device.venueName || '—'}`}
              hint={device.location?.source === 'venue_pin' ? 'Venue IoT pin' : device.location?.source}
            />
            <Metric label="Utilization 30d" value={`${fin.utilizationPct ?? '—'}%`} />
          </Stack>
          <Alert severity="info" variant="outlined">
            Geolocation uses the venue registry pin today. Heartbeat can later attach{' '}
            <code>lastKnownLocation</code> from GNSS or Wi‑Fi without changing this workbench.
          </Alert>
        </Stack>
      )}

      {tab === 'lifecycle' && (
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {device.status === 'provisioned' && (
            <Button
              variant="contained"
              data-testid={`activate-${device.instanceId}`}
              onClick={handleActivate}
            >
              Activate
            </Button>
          )}
          {!device.licenseId && device.status !== 'provisioned' && device.status !== 'decommissioned' && (
            <Button variant="outlined" data-testid={`license-${device.instanceId}`} onClick={handleLicense}>
              Assign license
            </Button>
          )}
          {device.status !== 'decommissioned' && (
            <>
              <Button
                variant="outlined"
                data-testid={`transfer-${device.instanceId}`}
                onClick={() => {
                  setTransferVenueId(device.venueId || '')
                  setTransferOpen(true)
                }}
              >
                Transfer
              </Button>
              <Button
                color="error"
                variant="outlined"
                data-testid={`decommission-${device.instanceId}`}
                onClick={handleDecommission}
              >
                Decommission
              </Button>
            </>
          )}
        </Stack>
      )}

      {tab === 'updates' && (
        <Stack spacing={1}>
          {updateInfo?.updateAvailable || device.updateAvailable ? (
            <Alert severity="warning">
              {updateInfo?.latestVersion || 'Update'} available on channel{' '}
              {updateInfo?.channel || device.updateChannel || 'stable'}
            </Alert>
          ) : (
            <Typography color="text.secondary">Up to date.</Typography>
          )}
        </Stack>
      )}

      {tab === 'maintenance' && (
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" fontWeight={700}>
              Inventory
            </Typography>
            <Button variant="contained" data-testid="record-maintenance" onClick={() => setMaintOpen(true)}>
              Record maintenance
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell>Component</TableCell>
                <TableCell>Serial / value</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inventory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary">
                      No inventory from API — demo device may not be provisioned for this Operator yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {inventory.map((item) => (
                <TableRow key={item.componentId}>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.serialNumber || item.configValue || '—'}</TableCell>
                  <TableCell>{item.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="subtitle1" fontWeight={700}>
            History
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">No maintenance events yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {records.map((r) => (
                <TableRow key={r.maintenanceId}>
                  <TableCell>{r.performedAt}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>{r.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      )}

      {tab === 'diagnostics' && (
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
            <TextField
              select
              size="small"
              label="Command"
              value={diagCommand}
              onChange={(e) => setDiagCommand(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              {['REBOOT', 'RUN_SELF_TEST', 'COLLECT_LOGS', 'FACTORY_RESET'].map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" data-testid="queue-diagnostic" onClick={handleQueueDiag}>
              Queue command
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Command</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Id</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {commands.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">No diagnostic commands yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {commands.map((c) => (
                <TableRow key={c.commandId}>
                  <TableCell>{c.command}</TableCell>
                  <TableCell>{c.status}</TableCell>
                  <TableCell>{c.commandId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      )}

      {tab === 'tickets' && (
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              size="small"
              fullWidth
              label="Subject"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              inputProps={{ 'data-testid': 'ticket-subject' }}
            />
            <Button variant="contained" data-testid="create-ticket" onClick={handleTicket}>
              Open ticket
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Id</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography color="text.secondary">No tickets for this device.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {tickets.map((t) => (
                <TableRow key={t.ticketId}>
                  <TableCell>{t.subject}</TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell>{t.ticketId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      )}

      {tab === 'financial' && (
        <Stack spacing={2} data-testid="device-financials">
          <Stack direction="row" flexWrap="wrap" gap={1.5}>
            <Metric label="Session revenue 30d" value={usd(fin.sessionRevenue30d)} />
            <Metric label="Contribution margin 30d" value={usd(fin.contributionMargin30d)} />
            <Metric label="Sessions 30d" value={fin.sessions30d ?? '—'} />
            <Metric label="Avg ticket" value={usd(fin.avgTicketUsd)} />
            <Metric label="Content royalty 30d" value={usd(fin.contentRoyalty30d)} />
            <Metric label="License / mo" value={usd(fin.licenseCostMonthly)} />
            <Metric label="Maint. accrual 30d" value={usd(fin.maintenanceAccrual30d)} />
            <Metric label="Parts 30d" value={usd(fin.partsCost30d)} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Margin = session revenue − royalty − license − maintenance accrual − parts. Feeds fleet
            analytics and (later) Billing revenue streams (FR-SW-SVC-002 / SVC-011).
          </Typography>
        </Stack>
      )}

      <Dialog open={maintOpen} onClose={() => setMaintOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record maintenance</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Type"
            fullWidth
            sx={{ mt: 1 }}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {['routine', 'repair', 'replace', 'inspect', 'config_change', 'other'].map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Description"
            fullWidth
            sx={{ mt: 2 }}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <TextField
            select
            label="Affected component"
            fullWidth
            sx={{ mt: 2 }}
            value={form.componentId}
            onChange={(e) => setForm({ ...form, componentId: e.target.value })}
          >
            <MenuItem value="">None</MenuItem>
            {inventory.map((i) => (
              <MenuItem key={i.componentId} value={i.componentId}>
                {i.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaintOpen(false)}>Cancel</Button>
          <Button variant="contained" data-testid="maintenance-submit" onClick={handleMaint}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={transferOpen} onClose={() => setTransferOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Transfer device</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Venue"
            fullWidth
            sx={{ mt: 1 }}
            value={transferVenueId}
            onChange={(e) => setTransferVenueId(e.target.value)}
            inputProps={{ 'data-testid': 'transfer-venue-id' }}
          >
            {venues.map((v) => (
              <MenuItem key={v.venueId} value={v.venueId}>
                {v.name || v.venueId}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferOpen(false)}>Cancel</Button>
          <Button variant="contained" data-testid="transfer-submit" onClick={handleTransfer}>
            Transfer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
