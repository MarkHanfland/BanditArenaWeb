import React, { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl') || canvas.getContext('webgl2'))
  } catch {
    return false
  }
}

/**
 * Staff register/workbench GLB preview (FR-SW-UI-013 / SW-097).
 * Loads @google/model-viewer only when a signed URL is present.
 */
export default function MachineGlbViewer({ src, label = 'Machine model', height = 180 }) {
  const [viewerReady, setViewerReady] = useState(false)
  const [webgl, setWebgl] = useState(true)

  useEffect(() => {
    setWebgl(webglAvailable())
  }, [])

  useEffect(() => {
    if (!src || !webgl) {
      setViewerReady(false)
      return undefined
    }
    let cancelled = false
    import('@google/model-viewer')
      .then(() => {
        if (!cancelled) setViewerReady(true)
      })
      .catch(() => {
        if (!cancelled) setViewerReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [src, webgl])

  if (!src) {
    return (
      <Box
        data-testid="machine-glb-placeholder"
        sx={{
          height,
          borderRadius: 1.5,
          border: '1px dashed rgba(255,255,255,0.2)',
          bgcolor: 'rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <Typography variant="caption" color="text.secondary" textAlign="center">
          No 3D model for this product. Provision still proceeds.
        </Typography>
      </Box>
    )
  }

  if (!webgl) {
    return (
      <Box
        data-testid="machine-glb-nowebgl"
        sx={{
          height,
          borderRadius: 1.5,
          bgcolor: 'rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          3D preview unavailable (WebGL). Registration still proceeds.
        </Typography>
      </Box>
    )
  }

  if (viewerReady) {
    return (
      <Box data-testid="machine-glb-viewer" sx={{ height }}>
        <model-viewer
          src={src}
          alt={label}
          camera-controls
          touch-action="pan-y"
          interaction-prompt="none"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
      </Box>
    )
  }

  return (
    <Box
      data-testid="machine-glb-unavailable"
      sx={{
        height,
        borderRadius: 1.5,
        bgcolor: 'rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        3D preview unavailable. Registration still proceeds.
      </Typography>
    </Box>
  )
}
