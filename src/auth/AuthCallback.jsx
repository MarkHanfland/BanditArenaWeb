import React, { useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { CircularProgress, Box, Typography } from '@mui/material'

/**
 * Renders at the /auth/callback route.
 * Reads `code` and `state` from the URL, validates state (CSRF),
 * exchanges the code for tokens, then redirects to the app root.
 */
export default function AuthCallback() {
  const { handleCallback } = useAuth()
  const [status, setStatus] = useState('exchanging')   // 'exchanging' | 'success' | 'error'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code  = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (error) {
      console.error('[AuthCallback] Cognito returned error:', error, params.get('error_description'))
      setStatus('error')
      return
    }

    if (!code || !state) {
      setStatus('error')
      return
    }

    handleCallback(code, state).then((ok) => {
      if (ok) {
        setStatus('success')
        // Replace history entry so back-button doesn't replay the callback
        window.history.replaceState({}, '', '/')
        // Small delay so the user sees a brief success message
        setTimeout(() => { window.location.replace('/') }, 500)
      } else {
        setStatus('error')
      }
    })
  }, [handleCallback])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 2 }}>
      {status === 'exchanging' && (
        <>
          <CircularProgress />
          <Typography>Completing sign-in…</Typography>
        </>
      )}
      {status === 'success' && (
        <Typography color="success.main">Signed in — redirecting…</Typography>
      )}
      {status === 'error' && (
        <Typography color="error">
          Sign-in failed. <a href="/">Return to login</a>
        </Typography>
      )}
    </Box>
  )
}
