import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Paper, Typography } from '@mui/material'
import { issueSessionCode } from '../../api/device'
import { bindCodeMessage, formatBindCode, remainingSeconds } from './bindCode'

export default function SessionBindCode() {
  const [code, setCode] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [left, setLeft] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const issue = useCallback(async () => {
    setBusy(true)
    const result = await issueSessionCode()
    setBusy(false)
    if (result.error) {
      setCode('')
      setExpiresAt('')
      setLeft(0)
      setError(bindCodeMessage(result))
      return
    }
    const next = String(result.data?.code || '')
    setCode(next)
    setExpiresAt(result.data?.expiresAt || '')
    setLeft(remainingSeconds(result.data?.expiresAt))
    setError('')
  }, [])

  useEffect(() => {
    issue()
  }, [issue])

  useEffect(() => {
    if (!expiresAt) return undefined
    const id = window.setInterval(() => {
      const seconds = remainingSeconds(expiresAt)
      setLeft(seconds)
      if (seconds <= 0) {
        window.clearInterval(id)
        issue()
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [expiresAt, issue])

  return (
    <Paper
      elevation={3}
      data-testid="session-bind-code"
      sx={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 3,
        px: 1.5,
        py: 1,
        minWidth: 168,
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
        Player bind code
      </Typography>
      {code ? (
        <Typography
          variant="h5"
          data-testid="session-bind-digits"
          sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, lineHeight: 1.2 }}
        >
          {formatBindCode(code)}
        </Typography>
      ) : null}
      {code ? (
        <Typography variant="caption" color="text.secondary" data-testid="session-bind-ttl">
          {left}s left
        </Typography>
      ) : null}
      {error ? (
        <Alert severity="info" sx={{ mt: 0.5, py: 0 }} data-testid="session-bind-error">
          {error}
        </Alert>
      ) : null}
      <Box sx={{ mt: 0.5 }}>
        <Button size="small" onClick={issue} disabled={busy} data-testid="session-bind-refresh">
          Show new code
        </Button>
      </Box>
    </Paper>
  )
}
