import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
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
  createDeviceMaintenance,
  getDeviceInventory,
  listDeviceMaintenance,
  listProductInstances,
} from '../../api/cloud'

export default function MaintenancePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [instances, setInstances] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [inventory, setInventory] = useState([])
  const [records, setRecords] = useState([])
  const [message, setMessage] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    type: 'routine',
    description: '',
    componentId: '',
    serialNumber: '',
    version: '',
    configValue: '',
  })

  const loadInstances = useCallback(async () => {
    setLoading(true)
    const { data, error: apiError } = await listProductInstances()
    if (apiError) {
      setError(apiError)
      setLoading(false)
      return
    }
    const list = data?.instances || []
    setInstances(list)
    if (!selectedId && list[0]) setSelectedId(list[0].instanceId)
    setError('')
    setLoading(false)
  }, [selectedId])

  const loadDeviceDetail = useCallback(async (instanceId) => {
    if (!instanceId) return
    const [invRes, maintRes] = await Promise.all([
      getDeviceInventory(instanceId),
      listDeviceMaintenance(instanceId),
    ])
    if (invRes.error) setError(invRes.error)
    else setInventory(invRes.data?.inventory || [])
    if (maintRes.error) setError(maintRes.error)
    else setRecords(maintRes.data?.records || [])
  }, [])

  useEffect(() => {
    loadInstances()
  }, [loadInstances])

  useEffect(() => {
    if (selectedId) loadDeviceDetail(selectedId)
  }, [selectedId, loadDeviceDetail])

  const handleSubmit = async () => {
    setMessage('')
    const inventoryChanges = form.componentId
      ? [
          {
            componentId: form.componentId,
            ...(form.serialNumber ? { serialNumber: form.serialNumber } : {}),
            ...(form.version ? { version: form.version } : {}),
            ...(form.configValue ? { configValue: form.configValue } : {}),
            ...(form.type === 'replace' ? { status: 'replaced' } : {}),
          },
        ]
      : []
    const { data, error: apiError } = await createDeviceMaintenance(selectedId, {
      type: form.type,
      description: form.description,
      inventoryChanges,
      componentIds: form.componentId ? [form.componentId] : [],
    })
    if (apiError) {
      setMessage(apiError)
      return
    }
    setDialogOpen(false)
    setMessage(`Recorded ${data?.record?.maintenanceId}`)
    await loadDeviceDetail(selectedId)
  }

  return (
    <PageScaffold
      title="Maintenance"
      category="Cloud"
      description="Device inventory (HW/SW/config) and maintenance event history (FR-SW-SVC-017 / SVC-012)."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}

      {!loading && !error && (
        <Stack spacing={3}>
          <TextField
            select
            label="Device"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            sx={{ maxWidth: 420 }}
            data-testid="maintenance-device-select"
          >
            {instances.map((i) => (
              <MenuItem key={i.instanceId} value={i.instanceId}>
                {i.instanceId} · {i.model || i.productId} · {i.computeSerialNumber || i.serialNumber || '—'}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Inventory</Typography>
            <Button
              variant="contained"
              onClick={() => setDialogOpen(true)}
              data-testid="record-maintenance"
            >
              Record maintenance
            </Button>
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell>Component</TableCell>
                <TableCell>Assembly / key</TableCell>
                <TableCell>Serial / value</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inventory.map((item) => (
                <TableRow key={item.componentId}>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.assemblyId || item.configKey || '—'}</TableCell>
                  <TableCell>{item.serialNumber || item.configValue || '—'}</TableCell>
                  <TableCell>{item.version || '—'}</TableCell>
                  <TableCell>{item.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Typography variant="h6">Maintenance history</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Components</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary">No maintenance events yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {records.map((r) => (
                <TableRow key={r.maintenanceId}>
                  <TableCell>{r.performedAt}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>{r.description}</TableCell>
                  <TableCell>{(r.componentIds || []).join(', ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
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
              <MenuItem key={t} value={t}>{t}</MenuItem>
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
            label="Affected component (optional)"
            fullWidth
            sx={{ mt: 2 }}
            value={form.componentId}
            onChange={(e) => setForm({ ...form, componentId: e.target.value })}
          >
            <MenuItem value="">None</MenuItem>
            {inventory.map((i) => (
              <MenuItem key={i.componentId} value={i.componentId}>
                {i.category}: {i.name}
              </MenuItem>
            ))}
          </TextField>
          {form.componentId && (
            <>
              <TextField
                label="New serial (optional)"
                fullWidth
                sx={{ mt: 2 }}
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              />
              <TextField
                label="New version (optional)"
                fullWidth
                sx={{ mt: 2 }}
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
              />
              <TextField
                label="New config value (optional)"
                fullWidth
                sx={{ mt: 2 }}
                value={form.configValue}
                onChange={(e) => setForm({ ...form, configValue: e.target.value })}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} data-testid="maintenance-submit">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
