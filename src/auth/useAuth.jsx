import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { fetchAuthSession, signOut } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'

const AuthContext = createContext(null)
const LOCAL_BYPASS_TOKEN = '__bandit_local_auth_bypass__'

/**
 * Authentication context — Amplify session adapter (FR-SW-ADMIN-004).
 *
 * Cognito mode: custom Amplify Authenticator (SRP); access/id tokens mirrored into React
 * state (memory). Amplify refresh token is tab-scoped via sessionStorage (see tokenStorage.js).
 * Local bypass: synthetic token when device auth_enabled=false.
 */
export function AuthProvider({
  children,
  localBypass = false,
  initialAccessToken = null,
  initialUser = null,
  onE2eSignOut = null,
}) {
  const [accessToken, setAccessToken] = useState(initialAccessToken)
  const [idToken, setIdToken] = useState(null)
  const [user, setUser] = useState(initialUser)
  const [sessionReady, setSessionReady] = useState(Boolean(initialAccessToken || localBypass))

  const syncSession = useCallback(async () => {
    if (localBypass || initialAccessToken) {
      setSessionReady(true)
      return
    }

    try {
      const session = await fetchAuthSession()
      const access = session.tokens?.accessToken?.toString() || null
      const id = session.tokens?.idToken?.toString() || null
      setAccessToken(access)
      setIdToken(id)
      setUser(parseUserFromToken(id || access, session))
    } catch (err) {
      console.warn('[Auth] Session sync failed:', err)
      setAccessToken(null)
      setIdToken(null)
      setUser(null)
    } finally {
      setSessionReady(true)
    }
  }, [localBypass, initialAccessToken])

  useEffect(() => {
    if (initialAccessToken) {
      return undefined
    }

    syncSession()

    const unsubscribe = Hub.listen('auth', () => {
      syncSession()
    })

    return unsubscribe
  }, [syncSession, initialAccessToken])

  const login = useCallback(async () => {
    if (localBypass) {
      console.info('[Auth] Local bypass login granted.')
      setAccessToken(LOCAL_BYPASS_TOKEN)
      setIdToken(null)
      setUser({
        userId: 'dev',
        username: 'dev',
        groups: ['local-auth-bypass'],
      })
      return
    }

    // Return to Amplify Authenticator sign-in (e.g. after 401 when refresh fails).
    await signOut()
    setAccessToken(null)
    setIdToken(null)
    setUser(null)
  }, [localBypass])

  const refreshAccessToken = useCallback(async () => {
    if (localBypass) {
      setAccessToken(LOCAL_BYPASS_TOKEN)
      setUser({
        userId: 'dev',
        username: 'dev',
        groups: ['local-auth-bypass'],
      })
      return true
    }

    try {
      const session = await fetchAuthSession({ forceRefresh: true })
      const access = session.tokens?.accessToken?.toString() || null
      const id = session.tokens?.idToken?.toString() || null
      if (!access) {
        return false
      }
      setAccessToken(access)
      setIdToken(id)
      setUser(parseUserFromToken(id || access, session))
      return true
    } catch {
      return false
    }
  }, [localBypass])

  const logout = useCallback(async () => {
    if (onE2eSignOut) {
      setAccessToken(null)
      setIdToken(null)
      setUser(null)
      onE2eSignOut()
      return
    }

    if (localBypass) {
      setAccessToken(null)
      setIdToken(null)
      setUser(null)
      return
    }

    try {
      await signOut({ global: true })
    } catch (err) {
      console.warn('[Auth] signOut failed:', err)
    }

    setAccessToken(null)
    setIdToken(null)
    setUser(null)
  }, [localBypass, onE2eSignOut])

  const value = {
    accessToken,
    idToken,
    cloudAuthToken: idToken || accessToken,
    user,
    isAuthenticated: !!accessToken,
    sessionReady,
    login,
    logout,
    refreshAccessToken,
  }

  if (!sessionReady) {
    return null
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

function parseUserFromToken(token, session = null) {
  if (!token || token === LOCAL_BYPASS_TOKEN) {
    return null
  }

  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)
    let groups = payload['cognito:groups'] || []
    if (typeof groups === 'string') {
      groups = [groups]
    }
    if (!Array.isArray(groups)) {
      groups = []
    }

    return {
      userId: payload.sub,
      username: payload.username || payload['cognito:username'] || payload.preferred_username || payload.sub,
      groups,
      email: payload.email || session?.tokens?.idToken?.payload?.email,
    }
  } catch {
    return null
  }
}
