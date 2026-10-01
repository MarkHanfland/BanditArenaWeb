import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Checkbox,
  Typography,
} from '@mui/material'
import { queueEmergencyPatch } from '../../../api/cloud'
import { PATCH_SCOPE, planEmergencyPatch } from './emergencyPatch'

const SCOPE_LABEL = {
  [PATCH_SCOPE.DEVICE]: 'This device',
  [PATCH_SCOPE.VENUE]: 'This venue',
  [PATCH_SCOPE.TENANT]: 'Every device in the tenant',
}

export default function EmergencyPatchDialog({
  open,
  onClose,
  onDone,
  instanceId,
  venueId,
  allowVenue = false,
  allowTenant = false,
}) {
  const [scope, setScope] = useState(PATCH_SCOPE.DEVICE)
  const [targetVersion, setTargetVersion] = useState('')
  const [reason, setReason] = useState('')
  const [fleetScopeConfirmed, setFleetScopeConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)

  const scopes = [PATCH_SCOPE.DEVICE]
  if (allowVenue) scopes.push(PATCH_SCOPE.VENUE)
  if (allowTenant) scopes.push(PATCH_SCOPE.TENANT)

  const reset = () => {
    setScope(PATCH_SCOPE.DEVICE)
    setTargetVersion('')
    setReason('')
    setFleetScopeConfirmed(false)
  }

  const handleClose = () => {
    if (busy) return
    reset()
    onClose?.()
  }

  const handleSubmit = async () => {
    const plan = planEmergencyPatch({
      scope,
      instanceId,
      venueId,
      targetVersion,
      reason,
      fleetScopeConfirmed,
    })
    if (!plan.send) {
      onDone?.(plan.error, 'error')
      return
    }
    setBusy(true)
    const { error } = await queueEmergencyPatch(plan.payload)
    setBusy(false)
    if (error) {
      onDone?.(error, 'error')
      return
    }
    reset()
    onDone?.(`Emergency patch queued (${SCOPE_LABEL[scope]})`, 'success')
    onClose?.()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Emergency patch</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Scope"
            value={scope}
            onChange={(e) => {
              setScope(e.target.value)
              setFleetScopeConfirmed(false)
            }}
            inputProps={{ 'data-testid': 'emergency-patch-scope' }}
          >
            {scopes.map((id) => (
              <MenuItem key={id} value={id}>
                {SCOPE_LABEL[id]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Target version"
            value={targetVersion}
            onChange={(e) => setTargetVersion(e.target.value)}
            inputProps={{ 'data-testid': 'emergency-patch-version' }}
          />
          <TextField
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            inputProps={{ 'data-testid': 'emergency-patch-reason' }}
          />
          {scope === PATCH_SCOPE.TENANT && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={fleetScopeConfirmed}
                  onChange={(e) => setFleetScopeConfirmed(e.target.checked)}
                  inputProps={{ 'data-testid': 'emergency-patch-fleet-confirm' }}
                />
              }
              label="Patch every device in the tenant"
            />
          )}
          {scope === PATCH_SCOPE.TENANT && !fleetScopeConfirmed && (
            <Typography variant="body2" color="text.secondary" data-testid="emergency-patch-fleet-gate">
              This scope is not sent until that confirmation is checked.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          data-testid="emergency-patch-submit"
          disabled={busy || (scope === PATCH_SCOPE.TENANT && !fleetScopeConfirmed)}
          onClick={handleSubmit}
        >
          Queue patch
        </Button>
      </DialogActions>
    </Dialog>
  )
}
