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
import { checkUpdates, listProductInstances, registerProductInstance } from '../../api/cloud'

export default function FleetPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [instances, setInstances] = useState([])
  const [updateInfo, setUpdateInfo] = useState({})
  const [registerOpen, setRegisterOpen] = useState(false)
  const [deviceModel, setDeviceModel] = useState('BanditArena-Alpha')
  const [message, setMessage] = useState('')

  const loadFleet = useCallback(async () => {
    setLoading(true)
    const { data, error: apiError } = await listProductInstances()
    if (apiError) {
      setError(apiError)
      setLoading(false)
      return
    }
    const list = data?.instances || []
    setInstances(list)
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

  const handleRegister = async () => {
    setMessage('')
    const { data, error: apiError } = await registerProductInstance({ model: deviceModel })
    if (apiError) {
      setMessage(apiError)
      return
    }
    setRegisterOpen(false)
    setMessage(`Registered ${data?.instance?.instanceId}`)
    await loadFleet()
  }

  return (
    <PageScaffold
      title="Fleet"
      category="Cloud"
      description="Device registry and software update status (SVC-005, SVC-007)."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {!loading && !error && (
        <Stack spacing={2}>
          <Button variant="contained" onClick={() => setRegisterOpen(true)} data-testid="register-device">
            Register Device
          </Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Instance</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Firmware</TableCell>
                <TableCell>Updates</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {instances.map((instance) => {
                const updates = updateInfo[instance.instanceId]
                return (
                  <TableRow key={instance.instanceId}>
                    <TableCell>{instance.instanceId}</TableCell>
                    <TableCell>
                      <Chip size="small" label={instance.status} color={instance.status === 'online' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell>{instance.firmwareVersion}</TableCell>
                    <TableCell>
                      {updates?.updateAvailable ? (
                        <Badge color="warning" badgeContent="1">
                          <Typography variant="body2">{updates.latestVersion} available</Typography>
                        </Badge>
                      ) : (
                        <Typography variant="body2" color="text.secondary">Up to date</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Stack>
      )}

      <Dialog open={registerOpen} onClose={() => setRegisterOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Register Device</DialogTitle>
        <DialogContent>
          <TextField
            label="Model"
            fullWidth
            sx={{ mt: 1 }}
            value={deviceModel}
            onChange={(e) => setDeviceModel(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegisterOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRegister}>Register</Button>
        </DialogActions>
      </Dialog>
    </PageScaffold>
  )
}
