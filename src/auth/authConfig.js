function normalizeCognitoDomain(rawDomain) {
  if (typeof rawDomain !== 'string') {
    throw new Error('Cognito OAuth domain is not configured')
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

  if (!domain || !domain.includes('.')) {
    throw new Error(`Invalid Cognito OAuth domain: "${rawDomain}"`)
  }

  return domain
}

function getCurrentOrigin() {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return ''
  }
  return window.location.origin
}

function parseScopes(rawScopes) {
  if (Array.isArray(rawScopes)) {
    return rawScopes.filter(Boolean).join(' ')
  }
  if (typeof rawScopes === 'string' && rawScopes.trim()) {
    return rawScopes.trim().replace(/,/g, ' ')
  }
  return 'openid profile email'
}

function readAmplifyOAuthConfig() {
  const amplifyConfig = window.__BANDIT_AMPLIFY_CONFIG__ || {}
  return amplifyConfig.oauth || amplifyConfig.Auth?.Cognito?.loginWith?.oauth || {}
}

function amplifyUserPoolClientId(config) {
  if (!config) {
    return ''
  }
  return config.aws_user_pools_web_client_id || config.Auth?.Cognito?.userPoolClientId || ''
}

export function loadAuthConfig() {
  const oauth = readAmplifyOAuthConfig()
  const origin = getCurrentOrigin()

  const clientId =
    import.meta.env.VITE_COGNITO_CLIENT_ID ||
    oauth?.clientId ||
    amplifyUserPoolClientId(window.__BANDIT_AMPLIFY_CONFIG__) ||
    ''

  const LEGACY_DELETED_CLIENT_IDS = new Set([
    '4rdj86bmv8dl1pmfkb6d9j426t',
    'emldp4d5c71g24844921tc71',
  ])
  const resolvedClientId = LEGACY_DELETED_CLIENT_IDS.has(clientId)
    ? import.meta.env.VITE_COGNITO_CLIENT_ID || '15fn5bb1fl3nnnsujt79f4s3b9'
    : clientId

  const cognitoDomain = normalizeCognitoDomain(
    import.meta.env.VITE_COGNITO_OAUTH_DOMAIN ||
      oauth?.domain ||
      'bandit-administrator-test.auth.us-east-1.amazoncognito.com',
  )

  const redirectUri =
    import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN ||
    oauth?.redirectSignIn ||
    `${origin}/auth/callback`

  const logoutUri =
    import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT ||
    oauth?.redirectSignOut ||
    `${origin}/`

  const scope = parseScopes(import.meta.env.VITE_COGNITO_OAUTH_SCOPES || oauth?.scopes)

  if (!resolvedClientId) {
    throw new Error('Cognito client id is not configured for cloud auth.')
  }

  return {
    auth_enabled: true,
    client_id: resolvedClientId,
    cognito_domain: cognitoDomain,
    redirect_uri: redirectUri,
    logout_uri: logoutUri,
    scope,
  }
}

export function buildCognitoUrl(domain, pathWithLeadingSlash) {
  return new URL(`https://${normalizeCognitoDomain(domain)}${pathWithLeadingSlash}`)
}
