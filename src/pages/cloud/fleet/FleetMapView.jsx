import React, { useMemo } from 'react'
import { Box, Stack, Typography } from '@mui/material'
import { projectLatLng } from '../../../data/fleetDemoCatalog'

/**
 * Stylized continental map — venue pins only (no external map SDK).
 * Suitable for IoT venue-pin demos; live GNSS can feed the same markers later.
 */
export default function FleetMapView({
  venues = [],
  selectedVenueId,
  accent,
  onSelectVenue,
  height = 280,
}) {
  const pins = useMemo(
    () =>
      venues.map((venue) => {
        const { x, y } = projectLatLng(venue.lat, venue.lng, 100, 100)
        return { ...venue, x, y }
      }),
    [venues],
  )

  return (
    <Box
      data-testid="fleet-map"
      sx={{
        position: 'relative',
        height,
        borderRadius: 2,
        overflow: 'hidden',
        background: accent?.wash || 'linear-gradient(160deg, #1a2330, #2c3e50)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 0 60px rgba(0,0,0,0.35)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }}
      >
        <path
          d="M12,32 L18,28 L28,30 L38,26 L48,28 L58,24 L70,26 L82,30 L88,38 L86,48 L80,58 L72,66 L60,72 L48,74 L36,70 L24,64 L16,52 L12,40 Z"
          fill="rgba(255,255,255,0.12)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="0.4"
        />
        <path
          d="M8,70 L14,68 L18,74 L12,78 Z"
          fill="rgba(255,255,255,0.08)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="0.3"
        />
      </svg>

      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          left: 14,
          top: 12,
          color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          zIndex: 1,
        }}
      >
        Venue geolocation · IoT pin
      </Typography>

      {pins.map((pin) => {
        const selected = pin.venueId === selectedVenueId
        return (
          <Box
            key={pin.venueId}
            component="button"
            type="button"
            data-testid={`fleet-pin-${pin.venueId}`}
            onClick={() => onSelectVenue?.(pin.venueId)}
            title={pin.name}
            sx={{
              position: 'absolute',
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              transform: 'translate(-50%, -50%)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              zIndex: selected ? 3 : 2,
              p: 0,
            }}
          >
            <Box
              sx={{
                width: selected ? 18 : 12,
                height: selected ? 18 : 12,
                borderRadius: '50%',
                bgcolor: accent?.pin || '#7FDBCA',
                boxShadow: selected
                  ? `0 0 0 6px ${accent?.pin || '#7FDBCA'}33, 0 4px 14px rgba(0,0,0,0.45)`
                  : `0 0 0 3px ${accent?.pin || '#7FDBCA'}44`,
                transition: 'all 160ms ease',
              }}
            />
            {selected && (
              <Stack
                spacing={0}
                sx={{
                  position: 'absolute',
                  top: 22,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  minWidth: 140,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: 'rgba(8,12,16,0.85)',
                  color: '#fff',
                  pointerEvents: 'none',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {pin.city}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.75, whiteSpace: 'nowrap' }}>
                  {pin.district}
                </Typography>
              </Stack>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
