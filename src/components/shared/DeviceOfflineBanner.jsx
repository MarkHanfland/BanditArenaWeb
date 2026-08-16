import React from 'react'
import { Alert, Box, Typography } from '@mui/material'

/**
 * Quiet main-panel copy when a Local Device route is somehow still active while
 * offline. Header errors / warning banners are intentionally not used.
 */
export function DeviceOfflinePanel({ title = 'Local device offline' }) {
  return (
    <Box sx={{ p: 3 }} data-testid="local-device-offline-panel">
      <Alert severity="info">
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2">
          Connect to a local Bandit Arena instance to use Local Device pages. Cloud
          management remains available in the sidebar. Availability is rechecked
          every 5 seconds.
        </Typography>
      </Alert>
    </Box>
  )
}

export default DeviceOfflinePanel
