import React from 'react'
import { Box, Chip, Paper, Stack, Typography } from '@mui/material'

export default function PageScaffold({ title, category, description, children }) {
  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {category && <Chip size="small" color="info" label={category} />}
        </Stack>
        <Typography variant="body1" color="text.secondary" sx={{ mb: children ? 2 : 0 }}>
          {description}
        </Typography>
        {children}
      </Paper>
    </Box>
  )
}
