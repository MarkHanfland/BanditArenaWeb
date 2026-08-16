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
  issueLicense,
  listLicensePlans,
  listLicenses,
  listProductInstances,
  renewLicense,
  revokeLicense,
} from '../../api/cloud'

function licenseColor(status) {
  if (status === 'active') return 'success'
  if (status === 'revoked') return 'error'
  return 'default'
}

export default function BillingPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [licenses, setLicenses] = useState([])
  const [plans, setPlans] = useState([])
  const [instances, setInstances] = useState([])
  const [message, setMessage] = useState('')
  const [issueOpen, setIssueOpen] = useState(false)
  const [planId, setPlanId] = useState('venue_pro')
  const [instanceId, setInstanceId] = useState('')

  const loadBilling = useCallback(async () => {
    setLoading(true)
    setError('')
    const [licensesRes, plansRes, instancesRes] = await Promise.all([
      listLicenses(),
      listLicensePlans(),
      listProductInstances(),
    ])
    if (licensesRes.error) {
      setError(licensesRes.error)
    } else {
      setLicenses(licensesRes.data?.licenses || [])
    }
    setPlans(plansRes.data?.plans || [])
    setInstances(instancesRes.data?.instances || [])
    if (!licensesRes.error && plansRes.data?.plans?.[0]?.planId) {
      setPlanId((current) => current || plansRes.data.plans[0].planId)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadBilling()
  }, [loadBilling])

  const handleIssue = async () => {
    setMessage('')
    const payload = { planId, licenseTier: planId }
    if (instanceId) {
      payload.instanceId = instanceId
    }
    const { data, error: apiError } = await issueLicense(payload)
    if (apiError) {
      setMessage(apiError)
      return
    }
    setIssueOpen(false)
    setInstanceId('')
    setMessage(`Issued ${data?.license?.licenseId} (${data?.license?.licenseTier})`)
    await loadBilling()
  }

  const handleRenew = async (licenseId) => {
    setMessage('')
    const { data, error: apiError } = await renewLicense(licenseId, { days: 365 })
    if (apiError) {
      setMessage(apiError)
      return
    }
    setMessage(`Renewed ${data?.license?.licenseId}`)
    await loadBilling()
  }

  const handleRevoke = async (licenseId) => {
    setMessage('')
    const { data, error: apiError } = await revokeLicense(licenseId, { reason: 'operator_ui' })
    if (apiError) {
      setMessage(apiError)
      return
    }
    setMessage(`Revoked ${data?.license?.licenseId}`)
    await loadBilling()
  }

  return (
    <PageScaffold
      title="Billing"
      category="Cloud"
      description="Venue licenses: issue a plan, optionally bind it to a device, then renew or revoke."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="billing-message">
          {message}
        </Alert>
      )}
      {!loading && !error && (
        <Stack spacing={2}>
          <Button
            variant="contained"
            onClick={() => setIssueOpen(true)}
            data-testid="issue-license"
            sx={{ alignSelf: 'flex-start' }}
          >
            Issue license
          </Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>License</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {licenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary">No licenses issued yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {licenses.map((license) => (
                <TableRow key={license.licenseId}>
                  <TableCell>{license.licenseId}</TableCell>
                  <TableCell>{license.licenseTier || license.planId}</TableCell>
                  <TableCell>{license.assignedDeviceId || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={license.status} color={licenseColor(license.status)} />
                  </TableCell>
                  <TableCell>{license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : '—'}</TableCell>
                  <TableCell align="right">
                    {license.status !== 'revoked' && (
                      <>
                        <Button
                          size="small"
                          onClick={() => handleRenew(license.licenseId)}
                          data-testid={`renew-${license.licenseId}`}
                        >
                          Renew
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleRevoke(license.licenseId)}
                          data-testid={`revoke-${license.licenseId}`}
                        >
                          Revoke
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      )}

      <Dialog open={issueOpen} onClose={() => setIssueOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Issue license</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Plan"
              fullWidth
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              inputProps={{ 'data-testid': 'issue-plan' }}
            >
              {(plans.length > 0 ? plans : [{ planId: 'venue_pro', name: 'Venue Pro' }]).map((plan) => (
                <MenuItem key={plan.planId} value={plan.planId}>
                  {plan.name || plan.planId}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Assign to device (optional)"
              fullWidth
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              inputProps={{ 'data-testid': 'issue-device' }}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {instances.map((instance) => (
                <MenuItem key={instance.instanceId} value={instance.instanceId}>
                  {instance.instanceId} · {instance.computeSerialNumber || instance.model || 'device'}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIssueOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleIssue} data-testid="issue-license-submit">
            Issue
          </Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
