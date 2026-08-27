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
  createCustomer,
  createOperator,
  createVenue,
  deactivateCustomer,
  deactivateOperator,
  deactivateVenue,
  listCustomers,
  listOperators,
  listVenues,
  patchCustomer,
  patchOperator,
  patchVenue,
} from '../../api/cloud'

/** Product entities: Customer, Operator, Venue (`/operators`, `operatorId`). */
const TABS = [
  { id: 'customers', label: 'Customers' },
  { id: 'operators', label: 'Operators' },
  { id: 'venues', label: 'Venues' },
]

export default function AccountsPage() {
  const [tab, setTab] = useState('customers')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [customers, setCustomers] = useState([])
  const [operators, setOperators] = useState([])
  const [venues, setVenues] = useState([])
  const [name, setName] = useState('')
  const [ownerCustomerId, setOwnerCustomerId] = useState('')
  const [editRow, setEditRow] = useState(null)
  const [editName, setEditName] = useState('')
  const [editTimezone, setEditTimezone] = useState('')
  const [editBillingEmail, setEditBillingEmail] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editOwnerCustomerId, setEditOwnerCustomerId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [customersRes, operatorsRes, venuesRes] = await Promise.all([
      listCustomers(),
      listOperators(),
      listVenues(),
    ])
    const firstError = customersRes.error || operatorsRes.error || venuesRes.error
    if (firstError && !customersRes.data && !operatorsRes.data && !venuesRes.data) {
      setError(firstError)
      setLoading(false)
      return
    }
    const nextCustomers = customersRes.data?.customers || []
    setCustomers(nextCustomers)
    setOperators(operatorsRes.data?.operators || [])
    setVenues(venuesRes.data?.venues || [])
    setOwnerCustomerId((current) => current || nextCustomers[0]?.customerId || '')
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setMessage('')
    let result
    if (tab === 'customers') {
      result = await createCustomer({ name: trimmed })
    } else if (tab === 'operators') {
      result = await createOperator({ name: trimmed })
    } else {
      if (!ownerCustomerId) {
        setMessage('Select a Venue owner (Customer) before creating a Venue')
        return
      }
      result = await createVenue({
        name: trimmed,
        ownerCustomerId,
      })
    }
    if (result.error) {
      setMessage(result.error)
      return
    }
    setName('')
    setMessage(
      tab === 'customers'
        ? `Created Customer ${result.data?.customer?.customerId}`
        : tab === 'operators'
          ? `Created Operator ${result.data?.operator?.operatorId}`
          : `Created Venue ${result.data?.venue?.venueId}`,
    )
    await load()
  }

  const openEdit = (row) => {
    setEditRow(row)
    setEditName(row.name || '')
    setEditTimezone(row.timezone || '')
    setEditBillingEmail(row.billingEmail || '')
    setEditNotes(row.notes || '')
    setEditOwnerCustomerId(row.ownerCustomerId || ownerCustomerId)
  }

  const handleSaveEdit = async () => {
    if (!editRow) return
    setMessage('')
    const id = editRow.customerId || editRow.operatorId || editRow.venueId
    let result
    if (tab === 'customers') {
      result = await patchCustomer(id, {
        name: editName.trim(),
        billingEmail: editBillingEmail.trim() || null,
        notes: editNotes.trim() || null,
      })
    } else if (tab === 'operators') {
      result = await patchOperator(id, {
        name: editName.trim(),
        timezone: editTimezone.trim() || undefined,
      })
    } else {
      result = await patchVenue(id, {
        name: editName.trim(),
        timezone: editTimezone.trim() || undefined,
        ownerCustomerId: editOwnerCustomerId || undefined,
      })
    }
    if (result.error) {
      setMessage(result.error)
      return
    }
    setEditRow(null)
    setMessage(`Updated ${id}`)
    await load()
  }

  const handleDeactivate = async (id) => {
    setMessage('')
    let result
    if (tab === 'customers') result = await deactivateCustomer(id)
    else if (tab === 'operators') result = await deactivateOperator(id)
    else result = await deactivateVenue(id)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setMessage(`Deactivated ${id}`)
    await load()
  }

  const rows =
    tab === 'customers' ? customers : tab === 'operators' ? operators : venues

  return (
    <PageScaffold
      title="Customers / Operators / Venues"
      category="Business & Commerce"
      description="Customer (buyer / Venue owner), Operator (estate boundary), and Venue (site). Treadmills bind Operator + Venue + Customer."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && (
        <Alert severity="info" sx={{ mb: 2 }} data-testid="accounts-message">
          {message}
        </Alert>
      )}
      {!loading && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            {TABS.map((entry) => (
              <Button
                key={entry.id}
                variant={tab === entry.id ? 'contained' : 'outlined'}
                onClick={() => setTab(entry.id)}
                data-testid={`accounts-tab-${entry.id}`}
              >
                {entry.label}
              </Button>
            ))}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <TextField
              label={
                tab === 'venues'
                  ? 'Venue name'
                  : tab === 'operators'
                    ? 'Operator name'
                    : 'Customer name'
              }
              size="small"
              sx={{ minWidth: 240 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              inputProps={{ 'data-testid': 'accounts-name' }}
            />
            {tab === 'venues' && (
              <TextField
                select
                label="Venue owner (Customer)"
                size="small"
                sx={{ minWidth: 240 }}
                value={ownerCustomerId}
                onChange={(e) => setOwnerCustomerId(e.target.value)}
                inputProps={{ 'data-testid': 'accounts-owner-customer' }}
              >
                {customers.map((customer) => (
                  <MenuItem key={customer.customerId} value={customer.customerId}>
                    {customer.name || customer.customerId}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={!name.trim() || (tab === 'venues' && !ownerCustomerId)}
              data-testid="accounts-create"
            >
              Create
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Id</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                {tab === 'venues' && <TableCell>Owner</TableCell>}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={tab === 'venues' ? 5 : 4}>
                    <Typography color="text.secondary">No records yet.</Typography>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => {
                const id = row.customerId || row.operatorId || row.venueId
                return (
                  <TableRow key={id}>
                    <TableCell>{id}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <Chip size="small" label={row.status || 'active'} />
                    </TableCell>
                    {tab === 'venues' && (
                      <TableCell>
                        {row.ownerName || row.ownerCustomerId || '—'}
                      </TableCell>
                    )}
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(row)} data-testid={`accounts-edit-${id}`}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        disabled={row.status === 'deactivated'}
                        onClick={() => handleDeactivate(id)}
                      >
                        Deactivate
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Stack>
      )}

      <Dialog open={Boolean(editRow)} onClose={() => setEditRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Edit {tab === 'customers' ? 'Customer' : tab === 'operators' ? 'Operator' : 'Venue'}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            sx={{ mt: 1 }}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          {tab === 'customers' && (
            <>
              <TextField
                label="Billing email"
                fullWidth
                sx={{ mt: 2 }}
                value={editBillingEmail}
                onChange={(e) => setEditBillingEmail(e.target.value)}
              />
              <TextField
                label="Notes"
                fullWidth
                sx={{ mt: 2 }}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </>
          )}
          {(tab === 'operators' || tab === 'venues') && (
            <TextField
              label="Timezone"
              fullWidth
              sx={{ mt: 2 }}
              value={editTimezone}
              onChange={(e) => setEditTimezone(e.target.value)}
            />
          )}
          {tab === 'venues' && (
            <TextField
              select
              label="Venue owner (Customer)"
              fullWidth
              sx={{ mt: 2 }}
              value={editOwnerCustomerId}
              onChange={(e) => setEditOwnerCustomerId(e.target.value)}
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
          <Button onClick={() => setEditRow(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={!editName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
