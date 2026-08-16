import React from 'react'
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material'

function DetailRow({ label, children }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{ color: '#888', fontWeight: 600, letterSpacing: 1, fontSize: '10px' }}
      >
        {label}
      </Typography>
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Box>
  )
}

/**
 * Read-only media details for the status bar (no field editing / no selection change).
 */
export default function MediaDetailsDialog({ open, onClose, media }) {
  const image = media?.image || media?.cover
  const tags = Array.isArray(media?.tags) ? media.tags : []

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="media-details-dialog">
      <DialogTitle>{media?.name || 'Media'}</DialogTitle>
      <DialogContent dividers>
        {!media ? (
          <Typography color="text.secondary">No media selected.</Typography>
        ) : (
          <Stack spacing={2}>
            {image ? (
              <Box
                component="img"
                src={image}
                alt={media.name || 'Media cover'}
                sx={{
                  width: '100%',
                  maxHeight: 200,
                  objectFit: 'cover',
                  borderRadius: 1,
                  bgcolor: 'background.default',
                }}
              />
            ) : null}
            <DetailRow label="DESCRIPTION">
              <Typography variant="body2" color="text.secondary">
                {media.description || '—'}
              </Typography>
            </DetailRow>
            <DetailRow label="VERSION">
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                v{media.version ?? '—'}
              </Typography>
            </DetailRow>
            <DetailRow label="TAGS">
              {tags.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  —
                </Typography>
              ) : (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {tags.map((tag) => (
                    <Chip key={tag} size="small" label={tag} />
                  ))}
                </Stack>
              )}
            </DetailRow>
            {media.demoVideo ? (
              <DetailRow label="DEMO VIDEO">
                <Typography
                  variant="body2"
                  component="a"
                  href={media.demoVideo}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: 'primary.main' }}
                >
                  {media.demoVideo}
                </Typography>
              </DetailRow>
            ) : null}
            {media.testMedia ? (
              <>
                <Divider />
                <DetailRow label="TEST MEDIA">
                  <Typography variant="body2" color="warning.main">
                    Camera Simulator mode:{' '}
                    <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {media.simulationMode || 'random'}
                    </Box>
                  </Typography>
                </DetailRow>
              </>
            ) : null}
            <DetailRow label="MEDIA ID">
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#888' }}>
                {media.mediaId}
              </Typography>
            </DetailRow>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  )
}
