import React from 'react'
import { Box, Chip, Paper, Stack, Typography } from '@mui/material'

/**
 * @param {'default' | 'immersive'} [tone]
 * immersive — transparent shell for stylized fleet/analytics surfaces
 */
export default function PageScaffold({ title, category, description, children, tone = 'default' }) {
  const immersive = tone === 'immersive'
  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      <Paper
        elevation={immersive ? 0 : 1}
        sx={{
          p: 3,
          bgcolor: immersive ? 'transparent' : undefined,
          backgroundImage: immersive ? 'none' : undefined,
          boxShadow: immersive ? 'none' : undefined,
          color: immersive ? '#e8eee9' : undefined,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography
            variant="h5"
            sx={{ fontWeight: 600, color: immersive ? '#fff' : undefined }}
          >
            {title}
          </Typography>
          {category && (
            <Chip
              size="small"
              color={immersive ? 'default' : 'info'}
              label={category}
              sx={
                immersive
                  ? { bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }
                  : undefined
              }
            />
          )}
        </Stack>
        <Typography
          variant="body1"
          sx={{
            mb: children ? 2 : 0,
            color: immersive ? 'rgba(255,255,255,0.72)' : 'text.secondary',
          }}
        >
          {description}
        </Typography>
        {children}
      </Paper>
    </Box>
  )
}
