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
  createCommerceQuote,
  getModelInventoryPreset,
  getRevenueReport,
  listBillingCycles,
  createBillingCycle,
  generateBillingInvoice,
  reconcileBillingCycle,
  issueLicense,
  listCatalogModels,
  listCommerceOfferings,
  listCommerceOrders,
  listCommerceQuotes,
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
  const [quotes, setQuotes] = useState([])
  const [models, setModels] = useState([])
  const [preset, setPreset] = useState([])
  const [selectedModel, setSelectedModel] = useState('bandit-arena-core')
  const [revenue, setRevenue] = useState(null)
  const [cycles, setCycles] = useState([])
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
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [quoteSku, setQuoteSku] = useState('BA-CORE-BUNDLE')
  const [quoteQty, setQuoteQty] = useState(2)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    const [
      offeringsRes,
      ordersRes,
      quotesRes,
      modelsRes,
      revenueRes,
      cyclesRes,
      licensesRes,
      plansRes,
      instancesRes,
    ] = await Promise.all([
      listCommerceOfferings(),
      listCommerceOrders(),
      listCommerceQuotes(),
      listCatalogModels(),
      getRevenueReport(),
      listBillingCycles(),
      listLicenses(),
      listLicensePlans(),
      listProductInstances(),
    ])
    if (offeringsRes.error) setError(offeringsRes.error)
    setOfferings(offeringsRes.data?.offerings || [])
    setOrders(ordersRes.data?.orders || [])
    setQuotes(quotesRes.data?.quotes || [])
    setModels(modelsRes.data?.products || [])
    setRevenue(revenueRes.data || null)
    setCycles(cyclesRes.data?.cycles || [])
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

  const handleQuote = async () => {
    setMessage('')
    const quantity = Math.max(1, Number(quoteQty) || 1)
    const { data, error: apiError } = await createCommerceQuote({
      lines: [{ skuId: quoteSku, quantity }],
      buyerKind: 'customer',
    })
    if (apiError) {
      setMessage(apiError)
      return
    }
    setQuoteOpen(false)
    setMessage(
      `Quote ${data?.quote?.quoteId} · ${usd(data?.quote?.totalUsd)} · no payment`,
    )
    await loadAll()
  }

  const handleCloseCycle = async () => {
    setMessage('')
    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const { data, error: apiError } = await createBillingCycle({
      periodStart: start,
      periodEnd: now.toISOString(),
      jurisdiction: 'US-IL',
    })
    if (apiError) {
      setMessage(apiError)
      return
    }
    setMessage(`Cycle ${data?.cycle?.cycleId} · ${usd(data?.cycle?.amountDueUsd)} due`)
    await loadAll()
  }

  const handleInvoice = async (cycleId) => {
    setMessage('')
    const { data, error: apiError } = await generateBillingInvoice(cycleId)
    if (apiError) {
      setMessage(apiError)
      return
    }
    setMessage(`Invoice ${data?.invoice?.invoiceId} · ${usd(data?.invoice?.totalUsd)}`)
    await loadAll()
  }

  const handleReconcile = async (cycleId) => {
    setMessage('')
    const { data, error: apiError } = await reconcileBillingCycle(cycleId, {
      transactionId: `txn-${Date.now()}`,
    })
    if (apiError) {
      setMessage(apiError)
      return
    }
    setMessage(`Reconciled ${data?.cycle?.cycleId}`)
    await loadAll()
  }

  return (
    <PageScaffold
      title="Commerce"
      category="Cloud"
      description="Offerings, enterprise quotes (no payment), billing cycles, Core/Pro BOM, licensing, and Bandit revenue streams (SVC-001/002/006/017)."
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
        <Tab label="Quotes" value="quotes" data-testid="commerce-tab-quotes" />
        <Tab label="Models & BOM" value="models" data-testid="commerce-tab-models" />
        <Tab label="Licensing" value="licensing" data-testid="commerce-tab-licensing" />
        <Tab label="Cycles" value="cycles" data-testid="commerce-tab-cycles" />
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

      {!loading && tab === 'quotes' && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" data-testid="commerce-create-quote" onClick={() => setQuoteOpen(true)}>
              Create quote
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Multi-unit enterprise quotes do not charge a payment processor and do not create an order.
          </Typography>
          <Table size="small" data-testid="commerce-quotes-table">
            <TableHead>
              <TableRow>
                <TableCell>Quote</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Units</TableCell>
                <TableCell>Stream</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary">No quotes yet.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((q) => (
                  <TableRow key={q.quoteId}>
                    <TableCell>{q.quoteId}</TableCell>
                    <TableCell>{q.status}</TableCell>
                    <TableCell>{q.unitCount ?? '—'}</TableCell>
                    <TableCell>{q.stream}</TableCell>
                    <TableCell align="right">{usd(q.totalUsd)}</TableCell>
                  </TableRow>
                ))
              )}
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

      {!loading && tab === 'cycles' && (
        <Stack spacing={2} data-testid="commerce-cycles">
          <Stack direction="row" spacing={1}>
            <Button variant="contained" data-testid="commerce-close-cycle" onClick={handleCloseCycle}>
              Close current cycle
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Cycles roll up paid Bandit streams. Invoice download uses a placeholder URL until the
            billing bucket is configured. Reconciliation records an external transaction — no
            payment processor.
          </Typography>
          <Table size="small" data-testid="commerce-cycles-table">
            <TableHead>
              <TableRow>
                <TableCell>Cycle</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Amount due</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cycles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary">No billing cycles yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {cycles.map((cycle) => (
                <TableRow key={cycle.cycleId}>
                  <TableCell>{cycle.cycleId}</TableCell>
                  <TableCell>
                    {cycle.periodStart ? new Date(cycle.periodStart).toLocaleDateString() : '—'}
                    {' – '}
                    {cycle.periodEnd ? new Date(cycle.periodEnd).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>{cycle.status}</TableCell>
                  <TableCell align="right">{usd(cycle.amountDueUsd)}</TableCell>
                  <TableCell align="right">
                    {cycle.status !== 'reconciled' && (
                      <>
                        <Button
                          size="small"
                          onClick={() => handleInvoice(cycle.cycleId)}
                          data-testid={`invoice-${cycle.cycleId}`}
                        >
                          Invoice
                        </Button>
                        <Button
                          size="small"
                          onClick={() => handleReconcile(cycle.cycleId)}
                          data-testid={`reconcile-${cycle.cycleId}`}
                        >
                          Reconcile
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

      <Dialog open={quoteOpen} onClose={() => setQuoteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create enterprise quote</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="SKU"
              fullWidth
              value={quoteSku}
              onChange={(e) => setQuoteSku(e.target.value)}
              inputProps={{ 'data-testid': 'quote-sku' }}
            >
              {offerings.map((o) => (
                <MenuItem key={o.skuId} value={o.skuId}>
                  {o.skuId} · {o.offeringType}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label="Quantity"
              fullWidth
              value={quoteQty}
              onChange={(e) => setQuoteQty(e.target.value)}
              inputProps={{ 'data-testid': 'quote-qty', min: 1 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuoteOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleQuote} data-testid="quote-submit">
            Save quote
          </Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
