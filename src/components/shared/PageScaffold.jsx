import React from 'react'
import { Alert, Box, Chip, Paper, Stack, Typography } from '@mui/material'
import { useVenue } from '../../session/VenueContext'

/**
 * @param {'default' | 'immersive'} [tone]
 * immersive — transparent shell for stylized fleet/analytics surfaces
 */
function VenueBanner() {
  const venueCtx = useVenue()
  if (!venueCtx) return null
  if (venueCtx.empty) {
    return (
      <Alert severity="warning" data-testid="venue-banner" sx={{ mb: 2 }}>
        Ask the Account Owner to assign this login to a venue.
      </Alert>
    )
  }
  if (!venueCtx.venue) return null
  return (
    <Box
      data-testid="venue-banner"
      sx={{
        mb: 2,
        px: 2.5,
        py: 1.25,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: '4px solid',
        borderLeftColor: 'primary.main',
      }}
    >
      <Typography variant="overline" color="primary.light" sx={{ letterSpacing: 1.4 }}>
        Venue
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
        {venueCtx.venue.name || venueCtx.venue.venueId}
      </Typography>
    </Box>
  )
}

export default function PageScaffold({ title, category, description, children, tone = 'default' }) {
  const immersive = tone === 'immersive'
  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }} tabIndex={0}>
      <VenueBanner />
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
