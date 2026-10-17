import React, { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { subscribePageError } from '../pageError'

export default function PageErrorBanner() {
  const [notice, setNotice] = useState(null)
  useEffect(() => subscribePageError(setNotice), [])
  if (!notice) return null
  return (
    <Box role="alert" data-testid="page-error" sx={{ px: 3, py: 1.25, backgroundColor: '#3a2424', color: '#f3f6f7' }}>
      <Typography sx={{ color: '#e06a6a', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.04em' }}>
        {notice.code}
      </Typography>
      <Typography>{notice.message}</Typography>
    </Box>
  )
}
