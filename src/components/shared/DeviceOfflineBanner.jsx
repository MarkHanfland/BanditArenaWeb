import React from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { getDeviceApiBaseUrl } from '../../config/runtime'

export default function DeviceOfflineBanner() {
  return (
    <Box sx={{ px: 2, pt: 2 }}>
      <Alert severity="warning">
        <Typography variant="body2">
          Local treadmill is offline. Start Bandit Arena on this machine and ensure the REST API is
          listening at {getDeviceApiBaseUrl()}.
        </Typography>
      </Alert>
    </Box>
  )
}

export function DeviceOfflinePanel({ title = 'Device unavailable' }) {
  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="info">
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2">
          Connect to a local Bandit Arena instance to view live treadmill data. Cloud management
          pages remain available in the sidebar.
        </Typography>
      </Alert>
    </Box>
  )
}
