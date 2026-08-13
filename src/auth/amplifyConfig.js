import { Amplify } from 'aws-amplify'
import { isCloudDeployment, getDeviceApiBaseUrl, isLocalWebDev } from '../config/runtime'
import { loadAuthConfig } from './authConfig'
import { configureTabScopedTokenStorage } from './tokenStorage'

function normalizeCognitoDomain(rawDomain) {
  if (typeof rawDomain !== 'string') {
    throw new Error('Cognito domain is missing from auth config')
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
    throw new Error(`Invalid Cognito domain: "${rawDomain}"`)
  }

  return domain
}

function parseScopeList(rawScopes) {
  if (Array.isArray(rawScopes)) {
    return rawScopes.filter(Boolean)
  }
  if (typeof rawScopes === 'string' && rawScopes.trim()) {
    return rawScopes.trim().replace(/,/g, ' ').split(/\s+/).filter(Boolean)
  }
  return ['openid', 'profile', 'email']
}

function readUserPoolId() {
  const amplifyConfig = window.__BANDIT_AMPLIFY_CONFIG__ || {}
  return (
    import.meta.env.VITE_COGNITO_USER_POOL_ID ||
    amplifyConfig.aws_user_pools_id ||
    amplifyConfig.Auth?.Cognito?.userPoolId ||
    ''
  )
}

function authConfigFromDeviceInfo(deviceInfo) {
  return {
    auth_enabled: true,
    client_id: deviceInfo.client_id,
    cognito_domain: normalizeCognitoDomain(deviceInfo.cognito_domain),
    redirect_uri: deviceInfo.redirect_uri,
    logout_uri: deviceInfo.redirect_uri?.replace('/auth/callback', '/') || `${window.location.origin}/`,
    scope: deviceInfo.scope || 'openid profile email',
  }
}

export function buildAmplifyResourcesConfig(authCfg) {
  const userPoolId = readUserPoolId()
  if (!userPoolId) {
    throw new Error('Cognito user pool id is not configured.')
  }
  if (!authCfg?.client_id) {
    throw new Error('Cognito client id is not configured.')
  }

  const scopes = parseScopeList(authCfg.scope)

  return {
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: authCfg.client_id,
        loginWith: {
          username: true,
          oauth: {
            domain: authCfg.cognito_domain,
            scopes,
            redirectSignIn: [authCfg.redirect_uri],
            redirectSignOut: [authCfg.logout_uri],
            responseType: 'code',
          },
        },
      },
    },
  }
}

const DEVICE_AUTH_INFO_TIMEOUT_MS = 2000
const DEVICE_UI_PORTS = new Set(['9724', '8080'])

/** True when the console is served by the Bandit Arena device HTTP server. */
function isDeviceServedUi() {
  if (typeof window === 'undefined') {
    return false
  }
  const port = window.location.port
  return DEVICE_UI_PORTS.has(port)
}

/**
 * Vite (:5173) and console.banditarena.com use the cloud admin app client.
 * Device-served UI (:9724/:8080) uses /auth/info (device app client).
 */
function preferCloudAuthConfig() {
  if (isCloudDeployment()) {
    return true
  }
  if (isDeviceServedUi()) {
    return false
  }
  return isLocalWebDev()
}

async function fetchDeviceAuthInfo() {
  if (isCloudDeployment()) {
    return null
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEVICE_AUTH_INFO_TIMEOUT_MS)

  try {
    const res = await fetch(`${getDeviceApiBaseUrl()}/auth/info`, {
      signal: controller.signal,
    })
    if (res.ok) {
      return res.json()
    }
  } catch (err) {
    console.warn('[Auth] Device /auth/info unavailable:', err)
  } finally {
    clearTimeout(timer)
  }

  return null
}

/**
 * Resolve auth mode before rendering the app shell.
 * @returns {Promise<{ mode: 'local-bypass', config: object } | { mode: 'cognito', resourcesConfig: object, authCfg: object }>}
 */
export async function resolveAuthMode() {
  const deviceInfo = await fetchDeviceAuthInfo()

  if (deviceInfo?.auth_enabled === false) {
    console.info('[Auth] Local bypass mode (auth_enabled=false).')
    return { mode: 'local-bypass', config: deviceInfo }
  }

  let authCfg
  if (preferCloudAuthConfig()) {
    authCfg = loadAuthConfig()
    console.info('[Auth] Cloud/local dev Cognito config loaded.', {
      cognito_domain: authCfg.cognito_domain,
      redirect_uri: authCfg.redirect_uri,
      client_id: authCfg.client_id,
    })
  } else if (deviceInfo?.client_id) {
    authCfg = authConfigFromDeviceInfo(deviceInfo)
    console.info('[Auth] Device /auth/info Cognito config loaded.', {
      cognito_domain: authCfg.cognito_domain,
      redirect_uri: authCfg.redirect_uri,
      client_id: authCfg.client_id,
    })
  } else {
    throw new Error(
      'Failed to fetch auth config from the Bandit Arena device server. Start bandit_arena.exe or use BanditArenaWeb Start Local for cloud-only testing.',
    )
  }

  const resourcesConfig = buildAmplifyResourcesConfig(authCfg)
  return { mode: 'cognito', resourcesConfig, authCfg }
}

export function configureAmplifyAuth(resourcesConfig) {
  configureTabScopedTokenStorage()
  Amplify.configure(resourcesConfig)
}
