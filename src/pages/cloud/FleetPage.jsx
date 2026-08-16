import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Badge,
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
  Typography,
} from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import {
  activateDevice,
  checkUpdates,
  decommissionDevice,
  issueLicense,
  listCustomers,
  listProductInstances,
  listVenues,
  provisionDevice,
  transferDevice,
} from '../../api/cloud'

export default function FleetPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [instances, setInstances] = useState([])
  const [updateInfo, setUpdateInfo] = useState({})
  const [registerOpen, setRegisterOpen] = useState(false)
  const [deviceModel, setDeviceModel] = useState('BanditArena-Alpha')
  const [computeSerialNumber, setComputeSerialNumber] = useState('')
  const [venueId, setVenueId] = useState('')
  const [venues, setVenues] = useState([])
  const [customers, setCustomers] = useState([])
  const [buyerKind, setBuyerKind] = useState('operator')
  const [buyerCustomerId, setBuyerCustomerId] = useState('')
  const [message, setMessage] = useState('')
  const [messageSeverity, setMessageSeverity] = useState('success')
  const [credentials, setCredentials] = useState(null)
  const [transferTarget, setTransferTarget] = useState(null)
  const [transferVenueId, setTransferVenueId] = useState('')
  const [transferTenantId, setTransferTenantId] = useState('')

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
    setInstances(list)
    const nextVenues = venuesRes.data?.venues || []
    setVenues(nextVenues)
    setVenueId((current) => current || nextVenues[0]?.venueId || '')
    const nextCustomers = customersRes.data?.customers || []
    setCustomers(nextCustomers)
    setBuyerCustomerId((current) => current || nextCustomers[0]?.customerId || '')
    setError('')

    const updates = {}
    await Promise.all(
      list.map(async (instance) => {
        const res = await checkUpdates({ instanceId: instance.instanceId })
        if (res.data) {
          updates[instance.instanceId] = res.data
        }
      }),
    )
    setUpdateInfo(updates)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadFleet()
  }, [loadFleet])

  const handleProvision = async () => {
    setMessage('')
    const serial = computeSerialNumber.trim()
    if (!serial) {
      setMessageSeverity('error')
      setMessage('Compute serial number (ASSY-COMPUTE) is required')
      return
    }
    const { data, error: apiError } = await provisionDevice({
      model: deviceModel,
      computeSerialNumber: serial,
      venueId: venueId || undefined,
      buyerKind,
      buyerCustomerId: buyerKind === 'customer' ? buyerCustomerId || undefined : undefined,
    })
    if (apiError) {
      setMessageSeverity('error')
      setMessage(apiError)
      return
    }
    setRegisterOpen(false)
    setComputeSerialNumber('')
    setCredentials(data?.oneTimeCredentials || null)
    setMessageSeverity('success')
    setMessage(`Provisioned ${data?.instance?.instanceId} (SN ${serial}) — save credentials now`)
    await loadFleet()
  }

  const handleActivate = async (instanceId) => {
    setMessage('')
    const { data, error: apiError } = await activateDevice(instanceId, {})
    if (apiError) {
      setMessageSeverity('error')
      setMessage(apiError)
      return
    }
    setMessageSeverity('success')
    setMessage(`Activated ${data?.instance?.instanceId}`)
    await loadFleet()
  }

  const handleDecommission = async (instanceId) => {
    setMessage('')
    const { data, error: apiError } = await decommissionDevice(instanceId, {
      reason: 'operator_ui',
    })
    if (apiError) {
      setMessageSeverity('error')
      setMessage(apiError)
      return
    }
    setMessageSeverity('success')
    setMessage(`Decommissioned ${data?.instance?.instanceId}`)
    await loadFleet()
  }

  const openTransfer = (instance) => {
    setTransferTarget(instance)
    setTransferVenueId(instance.venueId || '')
    setTransferTenantId('')
  }

  const handleTransfer = async () => {
    if (!transferTarget) return
    setMessage('')
    const venueId = transferVenueId.trim()
    const tenantId = transferTenantId.trim()
    if (!venueId && !tenantId) {
      setMessageSeverity('error')
      setMessage('Enter a venueId and/or tenantId to transfer')
      return
    }
    const payload = {}
    if (venueId) payload.venueId = venueId
    if (tenantId) payload.tenantId = tenantId
    const { data, error: apiError } = await transferDevice(transferTarget.instanceId, payload)
    if (apiError) {
      setMessageSeverity('error')
      setMessage(apiError)
      return
    }
    setTransferTarget(null)
    setMessageSeverity('success')
    setMessage(`Transferred ${data?.instance?.instanceId}`)
    await loadFleet()
  }

  const handleAssignLicense = async (instanceId) => {
    setMessage('')
    const { data, error: apiError } = await issueLicense({
      instanceId,
      licenseTier: 'venue_pro',
      features: ['session', 'content_base', 'ota'],
    })
    if (apiError) {
      setMessageSeverity('error')
      setMessage(apiError)
      return
    }
    setMessageSeverity('success')
    setMessage(`Issued ${data?.license?.licenseId} → ${instanceId} (${data?.license?.licenseTier})`)
    await loadFleet()
  }

  return (
    <PageScaffold
      title="Fleet"
      category="Cloud"
      description="Device lifecycle: provision → license → entitlement → OTA check (SVC-005/006/007)."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && (
        <Alert severity={messageSeverity} sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      {!loading && !error && (
        <Stack spacing={2}>
          <Button variant="contained" onClick={() => setRegisterOpen(true)} data-testid="register-device">
            Provision Device
          </Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Instance</TableCell>
                <TableCell>Compute SN</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Firmware</TableCell>
                <TableCell>License</TableCell>
                <TableCell>Updates</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {instances.map((instance) => {
                const updates = updateInfo[instance.instanceId]
                return (
                  <TableRow key={instance.instanceId}>
                    <TableCell>{instance.instanceId}</TableCell>
                    <TableCell>
                      {instance.computeSerialNumber || instance.serialNumber || '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={instance.identityMismatch ? 'identity_mismatch' : instance.status}
                        color={
                          instance.identityMismatch || instance.status === 'decommissioned'
                            ? 'error'
                            : instance.status === 'online' || instance.status === 'active'
                              ? 'success'
                              : 'default'
                        }
                      />
                    </TableCell>
                    <TableCell>{instance.firmwareVersion}</TableCell>
                    <TableCell>
                      {instance.licenseTier || instance.licenseId ? (
                        <Chip size="small" label={instance.licenseTier || instance.licenseId} color="info" />
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {updates?.updateAvailable ? (
                        <Badge color="warning" badgeContent="1">
                          <Typography variant="body2">{updates.latestVersion} available</Typography>
                        </Badge>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Up to date</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        {instance.status === 'provisioned' && (
                          <Button
                            size="small"
                            variant="outlined"
                            data-testid={`activate-${instance.instanceId}`}
                            onClick={() => handleActivate(instance.instanceId)}
                          >
                            Activate
                          </Button>
                        )}
                        {instance.status !== 'decommissioned' && (
                          <>
                            {!instance.licenseId && instance.status !== 'provisioned' && (
                              <Button
                                size="small"
                                variant="outlined"
                                data-testid={`license-${instance.instanceId}`}
                                onClick={() => handleAssignLicense(instance.instanceId)}
                              >
                                Assign license
                              </Button>
                            )}
                            <Button
                              size="small"
                              variant="outlined"
                              data-testid={`transfer-${instance.instanceId}`}
                              onClick={() => openTransfer(instance)}
                            >
                              Transfer
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              data-testid={`decommission-${instance.instanceId}`}
                              onClick={() => handleDecommission(instance.instanceId)}
                            >
                              Decommission
                            </Button>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Stack>
      )}

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
            {venues.map((venue) => (
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
            inputProps={{ 'data-testid': 'register-buyer-kind' }}
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
              inputProps={{ 'data-testid': 'register-buyer-customer' }}
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

      <Dialog
        open={Boolean(transferTarget)}
        onClose={() => setTransferTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Transfer device</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
            Reassign venue and/or tenant. Does not change compute serial or certificate binding.
          </Typography>
          <Typography variant="caption" display="block" gutterBottom>
            {transferTarget?.instanceId}
          </Typography>
          <TextField
            label="Venue ID"
            fullWidth
            sx={{ mt: 1 }}
            value={transferVenueId}
            onChange={(e) => setTransferVenueId(e.target.value)}
            inputProps={{ 'data-testid': 'transfer-venue-id' }}
          />
          <TextField
            label="Tenant ID (CA / FA cross-tenant)"
            fullWidth
            sx={{ mt: 2 }}
            value={transferTenantId}
            onChange={(e) => setTransferTenantId(e.target.value)}
            helperText="Leave blank for same-tenant venue move"
            inputProps={{ 'data-testid': 'transfer-tenant-id' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleTransfer} data-testid="transfer-submit">
            Transfer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(credentials)} onClose={() => setCredentials(null)} maxWidth="md" fullWidth>
        <DialogTitle>One-time device credentials</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Private key is shown once and is not stored in the cloud. Install on the compute TPM/CNG
            store, then discard.
          </Alert>
          <Typography variant="caption" display="block" gutterBottom>
            Thumbprint: {credentials?.certificateThumbprint}
          </Typography>
          <Typography variant="caption" display="block" gutterBottom>
            CN: {credentials?.certificateCn} ({credentials?.certificateSource})
          </Typography>
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
  )
}
