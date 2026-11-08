import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import {
  barcodeDetectorSupported,
  detectPassFromImageFile,
  detectPassFromSource,
} from './passScan'

function stopStream(stream) {
  for (const track of stream?.getTracks?.() || []) track.stop()
}

export default function PassScanDialog({ open, onClose, onDetected }) {
  const videoRef = useRef(null)
  const fileRef = useRef(null)
  const onDetectedRef = useRef(onDetected)
  const [cameraError, setCameraError] = useState('')
  const [scanError, setScanError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const canDetect = barcodeDetectorSupported()
  onDetectedRef.current = onDetected

  useEffect(() => {
    if (!open) return undefined
    let stream
    let cancelled = false
    setCameraError('')
    setScanError('')
    setCameraReady(false)

    const start = async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError('This station has no camera. Photograph the pass or type its code.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stopStream(stream)
          return
        }
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => {})
        }
        setCameraReady(true)
      } catch {
        setCameraError('The camera was refused. Photograph the pass or type its code.')
      }
    }
    start()

    return () => {
      cancelled = true
      stopStream(stream)
      const video = videoRef.current
      if (video) video.srcObject = null
    }
  }, [open])

  useEffect(() => {
    if (!open || !cameraReady || !canDetect) return undefined
    let cancelled = false
    const tick = async () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      try {
        const payload = await detectPassFromSource(video)
        if (!cancelled && payload) onDetectedRef.current(payload)
      } catch {
        // A missed frame is not a failed check-in; keep scanning.
      }
    }
    const id = window.setInterval(tick, 300)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [open, cameraReady, canDetect])

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setScanError('')
    try {
      const payload = await detectPassFromImageFile(file)
      if (!payload) {
        setScanError('No pass was found in that photo. Try again or type the code.')
        return
      }
      onDetectedRef.current(payload)
    } catch {
      setScanError('That photo could not be read. Type the code instead.')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="pass-scan-dialog">
      <DialogTitle>Scan Player pass</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Point the camera at the Player's live pass. A cached picture is refused by the cloud.
          </Typography>
          {cameraError ? <Alert severity="info">{cameraError}</Alert> : null}
          {scanError ? <Alert severity="warning" data-testid="pass-scan-error">{scanError}</Alert> : null}
          {!canDetect ? (
            <Alert severity="info">
              This browser cannot read a QR from the camera. Photograph the pass or type its code.
            </Alert>
          ) : null}
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            data-testid="pass-scan-video"
            style={{
              width: '100%',
              maxHeight: 280,
              background: '#111',
              borderRadius: 8,
              display: cameraError ? 'none' : 'block',
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            data-testid="pass-scan-file"
            onChange={onFile}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => fileRef.current?.click()} data-testid="pass-scan-photo">
          Use a photo
        </Button>
        <Button onClick={onClose} data-testid="pass-scan-cancel">Cancel</Button>
      </DialogActions>
    </Dialog>
  )
}
