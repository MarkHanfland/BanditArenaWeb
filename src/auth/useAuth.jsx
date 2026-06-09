import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce'
import { isCloudDeployment, getDeviceApiBaseUrl } from '../config/runtime'
import { loadAuthConfig, buildCognitoUrl } from './authConfig'

const AuthContext = createContext(null)
const LOCAL_BYPASS_TOKEN = '__bandit_local_auth_bypass__'

function normalizeCognitoDomain(rawDomain) {
  if (typeof rawDomain !== 'string') {
    throw new Error('Cognito domain is missing from /auth/info')
  }

  let domain = rawDomain.trim()
  if (domain.startsWith('https://')) {
    domain = domain.slice('https://'.length)
  } else if (domain.startsWith('http://')) {
    domain = domain.slice('http://'.length)
  }

  const slashIndex = domain.indexOf('/')
  if (slashIndex >= 0) {
    domain = domain.slice(0, slashIndex)
  }

  if (!domain || domain === 'oauth2' || !domain.includes('.')) {
    throw new Error(`Invalid Cognito domain in /auth/info: "${rawDomain}"`)
  }

  return domain
}

/**
 * Authentication context provider.
 *
 * Token storage policy (FR-SW-ADMIN-004):
 * - Access token  → React state (in-memory only, cleared on page unload)
 * - Refresh token → sessionStorage (tab-bound, cleared when tab closes)
 * - "Remember me" → not implemented in this layer (cookie flag only, set by server)
 */
export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null)
  const [user, setUser] = useState(null)        // { userId, username, role, groups }
  const cognitoConfig = useRef(null)            // fetched once from /auth/info

  /** Fetch Cognito config from cloud amplify config or the local device server. */
  const getConfig = useCallback(async () => {
    if (cognitoConfig.current) return cognitoConfig.current

    if (isCloudDeployment()) {
      cognitoConfig.current = loadAuthConfig()
      return cognitoConfig.current
    }

    const res = await fetch(`${getDeviceApiBaseUrl()}/auth/info`)
    if (!res.ok) throw new Error('Failed to fetch auth config')
    const config = await res.json()

    // Local/lab mode: backend auth is disabled, so no Cognito redirects are required.
    if (config.auth_enabled === false) {
      console.info('[Auth] /auth/info indicates local bypass mode (auth_enabled=false).')
      cognitoConfig.current = config
      return cognitoConfig.current
    }

    config.cognito_domain = normalizeCognitoDomain(config.cognito_domain)
    console.info('[Auth] /auth/info loaded Cognito mode.', {
      auth_enabled: config.auth_enabled,
      cognito_domain: config.cognito_domain,
      redirect_uri: config.redirect_uri,
      scope: config.scope,
    })
    cognitoConfig.current = config
    return cognitoConfig.current
  }, [])

  /**
   * Initiate the PKCE authorization code flow.
   * Stores verifier and state in sessionStorage, then redirects to Cognito Hosted UI.
   */
  const login = useCallback(async () => {
    const config = await getConfig()

    if (config.auth_enabled === false) {
      console.info('[Auth] Local bypass login granted; Cognito redirect skipped.')
      setAccessToken(LOCAL_BYPASS_TOKEN)
      setUser({
        userId: 'dev',
        username: 'dev',
        groups: ['local-auth-bypass'],
      })
      return
    }

    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    const state = generateState()

    sessionStorage.setItem('pkce_verifier', verifier)
    sessionStorage.setItem('oauth_state', state)

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.client_id,
      redirect_uri: config.redirect_uri,
      scope: config.scope,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })

    const authorizeUrl = buildCognitoUrl(config.cognito_domain, '/oauth2/authorize')
    authorizeUrl.search = params.toString()
    window.location.href = authorizeUrl.toString()
  }, [getConfig])

  /**
   * Exchange the authorization code for tokens (called from AuthCallback).
   * @param {string} code  - Authorization code from Cognito callback
   * @param {string} state - State value from callback URL (CSRF check)
   * @returns {boolean} true on success
   */
  const handleCallback = useCallback(async (code, state) => {
    const savedState = sessionStorage.getItem('oauth_state')
    const verifier   = sessionStorage.getItem('pkce_verifier')

    if (!savedState || state !== savedState) {
      console.error('[Auth] State mismatch — possible CSRF')
      return false
    }

    sessionStorage.removeItem('oauth_state')
    // Keep verifier until exchange succeeds

    try {
      const config = await getConfig()
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.client_id,
        code,
        redirect_uri: config.redirect_uri,
        code_verifier: verifier,
      })

      const tokenUrl = buildCognitoUrl(config.cognito_domain, '/oauth2/token')
      const res = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      if (!res.ok) {
        console.error('[Auth] Token exchange failed:', res.status)
        return false
      }

      const tokens = await res.json()
      sessionStorage.removeItem('pkce_verifier')

      // Store refresh token in sessionStorage (tab-bound)
      if (tokens.refresh_token) {
        sessionStorage.setItem('refresh_token', tokens.refresh_token)
      }

      // Store access token in memory (React state only)
      setAccessToken(tokens.access_token)
      setUser(parseUserFromToken(tokens.access_token))
      return true
    } catch (err) {
      console.error('[Auth] Token exchange error:', err)
      return false
    }
  }, [getConfig])

  /**
   * Attempt a silent token refresh using the refresh token from sessionStorage.
   * @returns {boolean} true if a new access token was obtained
   */
  const refreshAccessToken = useCallback(async () => {
    const config = await getConfig()

    if (config.auth_enabled === false) {
      console.info('[Auth] Local bypass refresh granted; Cognito token refresh skipped.')
      setAccessToken(LOCAL_BYPASS_TOKEN)
      setUser({
        userId: 'dev',
        username: 'dev',
        groups: ['local-auth-bypass'],
      })
      return true
    }

    const refreshToken = sessionStorage.getItem('refresh_token')
    if (!refreshToken) return false

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.client_id,
        refresh_token: refreshToken,
      })

      const tokenUrl = buildCognitoUrl(config.cognito_domain, '/oauth2/token')
      const res = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      if (!res.ok) return false

      const tokens = await res.json()
      setAccessToken(tokens.access_token)
      setUser(parseUserFromToken(tokens.access_token))
      return true
    } catch {
      return false
    }
  }, [getConfig])

  /** Clear all tokens and redirect to Cognito logout. */
  const logout = useCallback(async () => {
    setAccessToken(null)
    setUser(null)
    sessionStorage.removeItem('refresh_token')
    sessionStorage.removeItem('pkce_verifier')
    sessionStorage.removeItem('oauth_state')

    try {
      const config = await getConfig()
      const params = new URLSearchParams({
        client_id: config.client_id,
        logout_uri: config.logout_uri || config.redirect_uri.replace('/auth/callback', '/'),
      })
      const logoutUrl = buildCognitoUrl(config.cognito_domain, '/logout')
      logoutUrl.search = params.toString()
      window.location.href = logoutUrl.toString()
    } catch {
      window.location.href = '/'
    }
  }, [getConfig])

  const value = {
    accessToken,
    user,
    isAuthenticated: !!accessToken,
    login,
    logout,
    handleCallback,
    refreshAccessToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Convenience hook. */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Decode a JWT payload (no signature verification — verification is done by the server). */
function parseUserFromToken(token) {
  try {
    const [, payloadB64] = token.split('.')
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)
    return {
      userId:   payload.sub,
      username: payload.username || payload['cognito:username'] || payload.sub,
      groups:   payload['cognito:groups'] || [],
    }
  } catch {
    return null
  }
}
