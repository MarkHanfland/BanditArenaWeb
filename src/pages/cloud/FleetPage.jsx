import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import FleetMapView from './fleet/FleetMapView'
import DeviceWorkbench from './fleet/DeviceWorkbench'
import {
  DEMO_FLEETS,
  GEOLOCATION_FEASIBILITY,
  getFleetById,
  rollupFleetFinancials,
} from '../../data/fleetDemoCatalog'
import {
  checkUpdates,
  listCustomers,
  listProductInstances,
  listVenues,
  provisionDevice,
} from '../../api/cloud'

function usd(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function StatPill({ label, value }) {
  return (
    <Box
      sx={{
        px: 1.75,
        py: 1,
        borderRadius: 2,
        bgcolor: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        minWidth: 110,
      }}
    >
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>
        {value}
      </Typography>
    </Box>
  )
}

/**
 * Unified Fleet hub: map + device list + workbench tabs
 * (lifecycle, updates, maintenance, diagnostics, tickets, financial).
 */
export default function FleetPage({ initialTab = 'overview' }) {
  const [fleetId, setFleetId] = useState(DEMO_FLEETS[0].fleetId)
  const [selectedVenueId, setSelectedVenueId] = useState(DEMO_FLEETS[0].venues[0]?.venueId || '')
  const [selectedId, setSelectedId] = useState(DEMO_FLEETS[0].devices[0]?.instanceId || '')
  const [view, setView] = useState('map')
  const [apiInstances, setApiInstances] = useState([])
  const [venues, setVenues] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [messageSeverity, setMessageSeverity] = useState('success')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [computeSerialNumber, setComputeSerialNumber] = useState('')
  const [deviceModel, setDeviceModel] = useState('BanditArena-Alpha')
  const [venueId, setVenueId] = useState('')
  const [buyerKind, setBuyerKind] = useState('operator')
  const [buyerCustomerId, setBuyerCustomerId] = useState('')
  const [credentials, setCredentials] = useState(null)
  const [updateInfo, setUpdateInfo] = useState({})

  const fleet = useMemo(() => getFleetById(fleetId), [fleetId])
  const rollup = useMemo(() => rollupFleetFinancials(fleet), [fleet])

  const devices = useMemo(() => {
    const demoIds = new Set(fleet.devices.map((d) => d.instanceId))
    const live = (apiInstances || [])
      .filter((i) => !demoIds.has(i.instanceId))
      .map((i) => ({
        ...i,
        fleetId: 'fleet-lab',
        venueName: venues.find((v) => v.venueId === i.venueId)?.name || i.venueId,
        city: 'Lab',
        financials: i.financials || null,
        location: i.location || null,
      }))
    return [...fleet.devices, ...live]
  }, [fleet, apiInstances, venues])

  const listDevices = useMemo(() => {
    let demo = devices.filter((d) => d.fleetId === fleetId)
    if (selectedVenueId) {
      const atVenue = demo.filter((d) => d.venueId === selectedVenueId)
      if (atVenue.length) demo = atVenue
    }
    const live = devices.filter((d) => d.fleetId === 'fleet-lab')
    return [...demo, ...live]
  }, [devices, selectedVenueId, fleetId])

  const selectedDevice = useMemo(
    () => devices.find((d) => d.instanceId === selectedId) || listDevices[0] || null,
    [devices, selectedId, listDevices],
  )

  const loadFleet = useCallback(async () => {
    setLoading(true)
    const [instancesRes, venuesRes, customersRes] = await Promise.all([
      listProductInstances(),
      listVenues(),
      listCustomers(),
    ])
    if (instancesRes.error) {
      setError(instancesRes.error)
      setLoading(false)
      return
    }
    const list = instancesRes.data?.instances || []
    setApiInstances(list)
    const nextVenues = [...(venuesRes.data?.venues || []), ...fleet.venues]
    const deduped = []
    const seen = new Set()
    for (const v of nextVenues) {
      if (seen.has(v.venueId)) continue
      seen.add(v.venueId)
      deduped.push(v)
    }
    setVenues(deduped)
    setVenueId((current) => current || deduped[0]?.venueId || '')
    const nextCustomers = customersRes.data?.customers || []
    setCustomers(nextCustomers)
    setBuyerCustomerId((current) => current || nextCustomers[0]?.customerId || '')
    setError('')

    const updates = {}
    await Promise.all(
      list.slice(0, 12).map(async (instance) => {
        const res = await checkUpdates({ instanceId: instance.instanceId })
        if (res.data) updates[instance.instanceId] = res.data
      }),
    )
    setUpdateInfo(updates)
    setLoading(false)
  }, [fleet.venues])

  useEffect(() => {
    loadFleet()
  }, [loadFleet])

  useEffect(() => {
    setSelectedVenueId(fleet.venues[0]?.venueId || '')
    setSelectedId(fleet.devices[0]?.instanceId || '')
  }, [fleetId, fleet])

  const showMessage = (text, severity = 'success') => {
    setMessageSeverity(severity)
    setMessage(text)
  }

  const handleProvision = async () => {
    const { data, error: apiError } = await provisionDevice({
      computeSerialNumber,
      model: deviceModel,
      venueId,
      buyerKind,
      buyerCustomerId: buyerKind === 'customer' ? buyerCustomerId : undefined,
    })
    if (apiError) {
      showMessage(apiError, 'error')
      return
    }
    setRegisterOpen(false)
    setComputeSerialNumber('')
    setCredentials(data?.credentials || data?.oneTimeCredentials || null)
    const serial = data?.instance?.computeSerialNumber
    const provisionedId = data?.instance?.instanceId || 'device'
    showMessage(
      serial ? `Provisioned ${provisionedId} (SN ${serial})` : `Provisioned ${provisionedId}`,
      'success',
    )
    await loadFleet()
  }

  const combinedVenuesForTransfer = useMemo(() => {
    const map = new Map()
    for (const v of [...venues, ...fleet.venues]) map.set(v.venueId, v)
    return [...map.values()]
  }, [venues, fleet.venues])

  return (
    <Box
      sx={{
        minHeight: '100%',
        background:
          'radial-gradient(1200px 500px at 10% -10%, rgba(15,110,86,0.18), transparent 55%), radial-gradient(900px 400px at 90% 0%, rgba(139,69,19,0.12), transparent 50%), #0e1216',
        color: '#e8eee9',
      }}
    >
      <PageScaffold
        title="Fleet"
        category="Cloud"
        tone="immersive"
        description="Device lifecycle, maintenance, diagnostics, and financial performance — organized by fleet."
      >
        <Stack spacing={2.5}>
          {loading && <CircularProgress size={24} />}
          {error && <Alert severity="error">{error}</Alert>}
          {message && (
            <Alert severity={messageSeverity} onClose={() => setMessage('')}>
              {message}
            </Alert>
          )}

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ md: 'center' }}
            justifyContent="space-between"
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={fleetId}
              onChange={(_, v) => v && setFleetId(v)}
              data-testid="fleet-selector"
              sx={{
                bgcolor: 'rgba(0,0,0,0.25)',
                '& .MuiToggleButton-root': {
                  color: 'rgba(255,255,255,0.7)',
                  borderColor: 'rgba(255,255,255,0.12)',
                  textTransform: 'none',
                  px: 2,
                },
                '& .Mui-selected': {
                  color: '#fff !important',
                  bgcolor: `${fleet.accent.primary} !important`,
                },
              }}
            >
              {DEMO_FLEETS.map((f) => (
                <ToggleButton key={f.fleetId} value={f.fleetId} data-testid={`fleet-${f.fleetId}`}>
                  {f.name}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Stack direction="row" spacing={1} alignItems="center">
              <ToggleButtonGroup
                exclusive
                size="small"
                value={view}
                onChange={(_, v) => v && setView(v)}
                sx={{
                  '& .MuiToggleButton-root': {
                    color: 'rgba(255,255,255,0.7)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    textTransform: 'none',
                  },
                }}
              >
                <ToggleButton value="map" data-testid="fleet-view-map">
                  Map
                </ToggleButton>
                <ToggleButton value="list" data-testid="fleet-view-list">
                  List
                </ToggleButton>
              </ToggleButtonGroup>
              <Button variant="contained" onClick={() => setRegisterOpen(true)} data-testid="register-device">
                Provision Device
              </Button>
            </Stack>
          </Stack>

          <Box
            sx={{
              p: 2.5,
              borderRadius: 3,
              background: fleet.accent.wash,
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography
                  variant="overline"
                  sx={{ color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em' }}
                >
                  {fleet.shortLabel}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: '#fff', mt: 0.5 }}>
                  {fleet.name}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'rgba(255,255,255,0.78)', maxWidth: 520, mt: 1 }}
                >
                  {fleet.description}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(255,255,255,0.55)', display: 'block', mt: 1 }}
                >
                  {GEOLOCATION_FEASIBILITY.summary}
                </Typography>
              </Box>
              <Stack direction="row" flexWrap="wrap" gap={1} alignContent="flex-start">
                <StatPill label="Devices" value={rollup.deviceCount} />
                <StatPill label="Online" value={rollup.onlineCount} />
                <StatPill label="Attention" value={rollup.needsAttention} />
                <StatPill label="Revenue 30d" value={usd(rollup.sessionRevenue30d)} />
                <StatPill label="Margin 30d" value={usd(rollup.contributionMargin30d)} />
                <StatPill label="Utilization" value={`${rollup.avgUtilizationPct}%`} />
              </Stack>
            </Stack>
          </Box>

          {view === 'map' && (
            <FleetMapView
              venues={fleet.venues}
              selectedVenueId={selectedVenueId}
              accent={fleet.accent}
              onSelectVenue={(id) => {
                setSelectedVenueId(id)
                const first = fleet.devices.find((d) => d.venueId === id)
                if (first) setSelectedId(first.instanceId)
              }}
            />
          )}

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
            <Box
              sx={{
                flex: { lg: '0 0 38%' },
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Devices · {listDevices.length}
                </Typography>
              </Box>
              <Table
                size="small"
                data-testid="fleet-device-table"
                sx={{
                  '& .MuiTableCell-root': {
                    color: 'rgba(232,238,233,0.92)',
                    borderColor: 'rgba(255,255,255,0.08)',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Unit</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Rev 30d</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listDevices.map((instance) => {
                    const selected = instance.instanceId === selectedDevice?.instanceId
                    const upd = updateInfo[instance.instanceId]
                    return (
                      <TableRow
                        key={instance.instanceId}
                        hover
                        selected={selected}
                        onClick={() => {
                          setSelectedId(instance.instanceId)
                          if (instance.venueId) setSelectedVenueId(instance.venueId)
                        }}
                        sx={{ cursor: 'pointer' }}
                        data-testid={`fleet-row-${instance.instanceId}`}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {instance.instanceId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {instance.city || instance.venueId}
                            {(upd?.updateAvailable || instance.updateAvailable) && ' · update'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={instance.status}
                            color={
                              instance.status === 'online'
                                ? 'success'
                                : instance.status === 'offline' || instance.status === 'maintenance'
                                  ? 'warning'
                                  : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell align="right">
                          {instance.financials ? usd(instance.financials.sessionRevenue30d) : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>

            <Box
              sx={{
                flex: 1,
                borderRadius: 2,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                p: 2,
                minHeight: 360,
              }}
            >
              <DeviceWorkbench
                device={selectedDevice}
                accent={fleet.accent}
                initialTab={initialTab}
                venues={combinedVenuesForTransfer}
                onMessage={showMessage}
                onRefresh={loadFleet}
              />
            </Box>
          </Stack>

        </Stack>

        <Dialog open={registerOpen} onClose={() => setRegisterOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Provision Device</DialogTitle>
          <DialogContent>
            <TextField
              label="Compute serial number"
              helperText="Unique ASSY-COMPUTE serial bound to the device certificate"
              fullWidth
              required
              sx={{ mt: 1 }}
              value={computeSerialNumber}
              onChange={(e) => setComputeSerialNumber(e.target.value)}
              inputProps={{ 'data-testid': 'register-compute-serial' }}
            />
            <TextField
              label="Model"
              fullWidth
              sx={{ mt: 2 }}
              value={deviceModel}
              onChange={(e) => setDeviceModel(e.target.value)}
            />
            <TextField
              select
              label="Venue"
              fullWidth
              sx={{ mt: 2 }}
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              inputProps={{ 'data-testid': 'register-venue' }}
            >
              {combinedVenuesForTransfer.map((venue) => (
                <MenuItem key={venue.venueId} value={venue.venueId}>
                  {venue.name || venue.venueId}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Buyer"
              fullWidth
              sx={{ mt: 2 }}
              value={buyerKind}
              onChange={(e) => setBuyerKind(e.target.value)}
            >
              <MenuItem value="operator">Operator tenant</MenuItem>
              <MenuItem value="customer">Customer</MenuItem>
            </TextField>
            {buyerKind === 'customer' && (
              <TextField
                select
                label="Buyer customer"
                fullWidth
                sx={{ mt: 2 }}
                value={buyerCustomerId}
                onChange={(e) => setBuyerCustomerId(e.target.value)}
              >
                {customers.map((customer) => (
                  <MenuItem key={customer.customerId} value={customer.customerId}>
                    {customer.name || customer.customerId}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRegisterOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleProvision} data-testid="register-device-submit">
              Provision
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(credentials)} onClose={() => setCredentials(null)} maxWidth="md" fullWidth>
          <DialogTitle>One-time device credentials</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Private key is shown once and is not stored in the cloud.
            </Alert>
            <TextField
              label="Certificate PEM"
              fullWidth
              multiline
              minRows={4}
              sx={{ mt: 1 }}
              value={credentials?.certificatePem || ''}
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Private key PEM"
              fullWidth
              multiline
              minRows={4}
              sx={{ mt: 2 }}
              value={credentials?.privateKeyPem || ''}
              InputProps={{ readOnly: true }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCredentials(null)} data-testid="credentials-dismiss">
              I have saved the credentials
            </Button>
          </DialogActions>
        </Dialog>
      </PageScaffold>
    </Box>
  )
}
