import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from './useAuth'
import LoginSplash from './LoginSplash'

/**
 * Wraps any component that requires authentication.
 *
 * Behaviour:
 * 1. If the access token is present in memory → render children immediately.
 * 2. If no access token but a refresh token exists in sessionStorage →
 *    attempt a silent refresh before deciding.
 * 3. Otherwise → initiate the Cognito PKCE login flow.
 *
 * This component handles its own loading state so children are never
 * rendered with a stale/missing token.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, login, refreshAccessToken } = useAuth()
  const [authError, setAuthError] = useState('')
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const triggerLogin = useCallback(async () => {
    setAuthError('')
    setIsSigningIn(true)
    try {
      await Promise.resolve(login())
    } catch (err) {
      const message = err?.message || 'Authentication configuration is invalid.'
      console.error('[Auth] Login initiation failed:', err)
      setAuthError(message)
    } finally {
      setIsSigningIn(false)
    }
  }, [login])

  useEffect(() => {
    let isMounted = true

    const checkSession = async () => {
      if (isAuthenticated) {
        if (isMounted) {
          setIsCheckingSession(false)
        }
        return
      }

      const hasRefreshToken = !!sessionStorage.getItem('refresh_token')
      if (!hasRefreshToken) {
        if (isMounted) {
          setIsCheckingSession(false)
        }
        return
      }

      const ok = await refreshAccessToken()
      if (isMounted) {
        if (!ok) {
          sessionStorage.removeItem('refresh_token')
        }
        setIsCheckingSession(false)
      }
    }

    checkSession()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, refreshAccessToken])

  if (!isAuthenticated) {
    return (
      <LoginSplash
        authError={authError}
        onSignIn={triggerLogin}
        isCheckingSession={isCheckingSession}
        isSigningIn={isSigningIn}
      />
    )
  }

  return children
}
