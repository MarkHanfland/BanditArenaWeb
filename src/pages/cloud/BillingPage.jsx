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
import PageScaffold from '../../components/shared/PageScaffold'
import {
  checkCommerceCompatibility,
  createCommerceOrder,
  getModelInventoryPreset,
  getRevenueReport,
  issueLicense,
  listCatalogModels,
  listCommerceOfferings,
  listCommerceOrders,
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

function usd(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function typeColor(t) {
  if (t === 'primary_system') return 'primary'
  if (t === 'addon') return 'secondary'
  if (t === 'spare') return 'warning'
  if (t === 'software' || t === 'content') return 'info'
  return 'default'
}

export default function BillingPage() {
  const [tab, setTab] = useState('offerings')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [offerings, setOfferings] = useState([])
  const [orders, setOrders] = useState([])
  const [models, setModels] = useState([])
  const [preset, setPreset] = useState([])
  const [selectedModel, setSelectedModel] = useState('bandit-arena-core')
  const [revenue, setRevenue] = useState(null)
  const [licenses, setLicenses] = useState([])
  const [plans, setPlans] = useState([])
  const [instances, setInstances] = useState([])
  const [issueOpen, setIssueOpen] = useState(false)
  const [planId, setPlanId] = useState('venue_pro')
  const [instanceId, setInstanceId] = useState('')
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderSku, setOrderSku] = useState('BA-SPARE-MEMBRANE')
  const [orderDevice, setOrderDevice] = useState('instance-demo-001')
  const [compatNote, setCompatNote] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    const [
      offeringsRes,
      ordersRes,
      modelsRes,
      revenueRes,
      licensesRes,
      plansRes,
      instancesRes,
    ] = await Promise.all([
      listCommerceOfferings(),
      listCommerceOrders(),
      listCatalogModels(),
      getRevenueReport(),
      listLicenses(),
      listLicensePlans(),
      listProductInstances(),
    ])
    if (offeringsRes.error) setError(offeringsRes.error)
    setOfferings(offeringsRes.data?.offerings || [])
    setOrders(ordersRes.data?.orders || [])
    setModels(modelsRes.data?.products || [])
    setRevenue(revenueRes.data || null)
    setLicenses(licensesRes.data?.licenses || [])
    setPlans(plansRes.data?.plans || [])
    setInstances(instancesRes.data?.instances || [])
    if (plansRes.data?.plans?.[0]?.planId) {
      setPlanId((c) => c || plansRes.data.plans[0].planId)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    if (tab !== 'models' || !selectedModel) return
    ;(async () => {
      const { data, error: apiError } = await getModelInventoryPreset(selectedModel)
      if (apiError) setMessage(apiError)
      else setPreset(data?.inventory || [])
    })()
  }, [tab, selectedModel])

  const handleIssue = async () => {
    setMessage('')
    const payload = { planId, licenseTier: planId }
    if (instanceId) payload.instanceId = instanceId
    const { data, error: apiError } = await issueLicense(payload)
    if (apiError) {
      setMessage(apiError)
      return
    }
    setIssueOpen(false)
    setInstanceId('')
    setMessage(`Issued ${data?.license?.licenseId} (${data?.license?.licenseTier})`)
    await loadAll()
  }

  const handleRenew = async (licenseId) => {
    const { data, error: apiError } = await renewLicense(licenseId, { days: 365 })
    setMessage(apiError || `Renewed ${data?.license?.licenseId}`)
    await loadAll()
  }

  const handleRevoke = async (licenseId) => {
    const { data, error: apiError } = await revokeLicense(licenseId, { reason: 'operator_ui' })
    setMessage(apiError || `Revoked ${data?.license?.licenseId}`)
    await loadAll()
  }

  const runCompat = async () => {
    const { data, error: apiError } = await checkCommerceCompatibility({
      skuId: orderSku,
      instanceId: orderDevice || undefined,
    })
    if (apiError) {
      setCompatNote(apiError)
      return
    }
    setCompatNote(
      data?.compatible
        ? 'Compatible with selected device/model'
        : `Not compatible: ${(data?.reasons || []).join('; ')}`,
    )
  }

  const handleOrder = async () => {
    setMessage('')
    const lines = [{ skuId: orderSku, quantity: 1 }]
    if (orderDevice) lines[0].instanceId = orderDevice
    const { data, error: apiError } = await createCommerceOrder({ lines, buyerKind: 'operator' })
    if (apiError) {
      setMessage(apiError)
      return
    }
    setOrderOpen(false)
    setMessage(`Order ${data?.order?.orderId} · ${usd(data?.order?.totalUsd)}`)
    await loadAll()
  }

  return (
    <PageScaffold
      title="Commerce"
      category="Cloud"
      description="Offerings, Core/Pro BOM, licensing, and Bandit revenue streams (SVC-001/002/006/017)."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="billing-message" onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Offerings" value="offerings" data-testid="commerce-tab-offerings" />
        <Tab label="Models & BOM" value="models" data-testid="commerce-tab-models" />
        <Tab label="Licensing" value="licensing" data-testid="commerce-tab-licensing" />
        <Tab label="Revenue" value="revenue" data-testid="commerce-tab-revenue" />
      </Tabs>

      {!loading && tab === 'offerings' && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" data-testid="commerce-create-order" onClick={() => setOrderOpen(true)}>
              Create order
            </Button>
          </Stack>
          <Table size="small" data-testid="commerce-offerings-table">
            <TableHead>
              <TableRow>
                <TableCell>SKU</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Stream</TableCell>
                <TableCell align="right">List price</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {offerings.map((o) => (
                <TableRow key={o.skuId}>
                  <TableCell>{o.skuId}</TableCell>
                  <TableCell>
                    <Chip size="small" label={o.offeringType} color={typeColor(o.offeringType)} />
                  </TableCell>
                  <TableCell>{o.name}</TableCell>
                  <TableCell>{o.stream}</TableCell>
                  <TableCell align="right">{usd(o.unitPriceUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="subtitle2">Recent orders</Typography>
          <Table size="small" data-testid="commerce-orders-table">
            <TableHead>
              <TableRow>
                <TableCell>Order</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Stream</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.slice(0, 12).map((o) => (
                <TableRow key={o.orderId}>
                  <TableCell>{o.orderId}</TableCell>
                  <TableCell>{o.status}</TableCell>
                  <TableCell>{o.stream}</TableCell>
                  <TableCell align="right">{usd(o.totalUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      )}

      {!loading && tab === 'models' && (
        <Stack spacing={2}>
          <TextField
            select
            label="Model"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            sx={{ maxWidth: 360 }}
            inputProps={{ 'data-testid': 'commerce-model-select' }}
          >
            {(models.length
              ? models
              : [
                  { productId: 'bandit-arena-core', name: 'Core' },
                  { productId: 'bandit-arena-pro', name: 'Pro' },
                ]
            ).map((m) => (
              <MenuItem key={m.productId} value={m.productId}>
                {m.name || m.productId}
              </MenuItem>
            ))}
          </TextField>
          <Table size="small" data-testid="commerce-bom-table">
            <TableHead>
              <TableRow>
                <TableCell>Component</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Part / config</TableCell>
                <TableCell>Replaceable</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {preset.map((line) => (
                <TableRow key={line.componentId}>
                  <TableCell>
                    {line.name}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {line.componentId}
                    </Typography>
                  </TableCell>
                  <TableCell>{line.category}</TableCell>
                  <TableCell>{line.partNumber || line.configValue || line.version || '—'}</TableCell>
                  <TableCell>{line.fieldReplaceable ? 'Yes' : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      )}

      {!loading && tab === 'licensing' && (
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
                  <TableCell>{license.instanceId || '—'}</TableCell>
                  <TableCell>
                    <Chip size="small" label={license.status} color={licenseColor(license.status)} />
                  </TableCell>
                  <TableCell>
                    {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : '—'}
                  </TableCell>
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

      {!loading && tab === 'revenue' && (
        <Stack spacing={2} data-testid="commerce-revenue">
          <Typography variant="h6">Bandit revenue by stream</Typography>
          <Typography variant="body2" color="text.secondary">
            Operator session-ticket revenue stays on Fleet/Analytics KPIs — this ledger is what operators
            pay Bandit.
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1.5}>
            {Object.entries(revenue?.streams || {}).map(([stream, amount]) => (
              <Box
                key={stream}
                sx={{
                  p: 1.5,
                  minWidth: 140,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {stream}
                </Typography>
                <Typography variant="h6" data-testid={`revenue-stream-${stream}`}>
                  {usd(amount)}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Typography variant="subtitle1" data-testid="revenue-total">
            Total · {usd(revenue?.totalUsd)} · {revenue?.orderCount || 0} orders
          </Typography>
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
                  {instance.instanceId}
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

      <Dialog open={orderOpen} onClose={() => setOrderOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create commerce order</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="SKU"
              fullWidth
              value={orderSku}
              onChange={(e) => setOrderSku(e.target.value)}
              inputProps={{ 'data-testid': 'order-sku' }}
            >
              {offerings.map((o) => (
                <MenuItem key={o.skuId} value={o.skuId}>
                  {o.skuId} · {o.offeringType}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Target device (addons / spares)"
              fullWidth
              value={orderDevice}
              onChange={(e) => setOrderDevice(e.target.value)}
              inputProps={{ 'data-testid': 'order-device' }}
            >
              <MenuItem value="">None (primary / software)</MenuItem>
              {instances.map((i) => (
                <MenuItem key={i.instanceId} value={i.instanceId}>
                  {i.instanceId}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" onClick={runCompat} data-testid="order-check-compat">
              Check compatibility
            </Button>
            {compatNote && (
              <Alert severity={compatNote.startsWith('Compatible') ? 'success' : 'warning'}>
                {compatNote}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleOrder} data-testid="order-submit">
            Submit order
          </Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
