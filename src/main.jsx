import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import App from './App'
import { isCloudDeployment, isLocalWebDev } from './config/runtime'

const DEFAULT_OAUTH_SCOPES = ['openid', 'profile', 'email']

function getCurrentOrigin() {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return ''
  }
  return window.location.origin
}

function parseScopes(rawScopes) {
  if (Array.isArray(rawScopes)) {
    return rawScopes.filter(Boolean)
  }
  if (typeof rawScopes === 'string' && rawScopes.trim().length > 0) {
    return rawScopes.split(',').map((scope) => scope.trim()).filter(Boolean)
  }
  return DEFAULT_OAUTH_SCOPES
}

function buildOAuthConfig(config) {
  const existingOauth = config?.oauth || config?.Auth?.Cognito?.loginWith?.oauth || null
  const oauthDomain =
    import.meta.env.VITE_COGNITO_OAUTH_DOMAIN || existingOauth?.domain || ''

  if (!oauthDomain) {
    return config
  }

  const currentOrigin = getCurrentOrigin()
  const preferCurrentOrigin = currentOrigin && (isCloudDeployment() || isLocalWebDev())
  const redirectSignIn =
    import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN ||
    (preferCurrentOrigin
      ? `${currentOrigin}/auth/callback`
      : existingOauth?.redirectSignIn || `${currentOrigin}/auth/callback`)
  const redirectSignOut =
    import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT ||
    (preferCurrentOrigin
      ? `${currentOrigin}/`
      : existingOauth?.redirectSignOut || `${currentOrigin}/`)

  return {
    ...config,
    oauth: {
      ...existingOauth,
      domain: oauthDomain,
      redirectSignIn,
      redirectSignOut,
      responseType:
        import.meta.env.VITE_COGNITO_OAUTH_RESPONSE_TYPE || existingOauth?.responseType || 'code',
      scopes: parseScopes(import.meta.env.VITE_COGNITO_OAUTH_SCOPES || existingOauth?.scopes),
    },
  }
}

async function fetchJsonConfig(path) {
  const response = await fetch(path, { cache: 'no-store' })
  if (!response.ok) {
    return null
  }
  return response.json()
}

async function loadAmplifyConfig() {
  try {
    const deployedConfig = await fetchJsonConfig('/amplifyconfiguration.json')
    if (deployedConfig) {
      return deployedConfig
    }
    return (await fetchJsonConfig('/amplifyconfiguration.example.json')) || {}
  } catch {
    return {}
  }
}

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4db6c4', light: '#7ed4df', dark: '#2a8a96', contrastText: '#ffffff' },
    secondary: { main: '#7a8a8f', light: '#a0b0b5', dark: '#556065', contrastText: '#ffffff' },
    error: { main: '#e05555', light: '#ff8a80', dark: '#b33030' },
    warning: { main: '#c9a857', light: '#e0c87a', dark: '#a08840' },
    info: { main: '#5eb8cf', light: '#8ed0e2', dark: '#3a95ab' },
    success: { main: '#00d4aa', light: '#33e0bb', dark: '#00a884', contrastText: '#0a0c0e' },
    background: { default: '#181c20', paper: '#23272b' },
    text: { primary: '#e0e0e0', secondary: '#b0bec5', disabled: '#7b8a97' },
    divider: 'rgba(224, 224, 224, 0.12)',
  },
  typography: {
    fontFamily: '"Montserrat", "Helvetica", "Arial", sans-serif',
    h1: { color: '#e0e0e0', fontWeight: 600 },
    h2: { color: '#e0e0e0', fontWeight: 600 },
    h3: { color: '#e0e0e0', fontWeight: 600 },
    h4: { color: '#e0e0e0', fontWeight: 600 },
    h5: { color: '#e0e0e0', fontWeight: 600 },
    h6: { color: '#e0e0e0', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#23272b',
          borderRadius: 8,
          border: '1px solid rgba(224, 224, 224, 0.10)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#23272b',
          backgroundImage: 'none',
          borderBottom: '1px solid rgba(224, 224, 224, 0.10)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#23272b',
          border: '1px solid rgba(224, 224, 224, 0.10)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', borderRadius: 6 },
      },
    },
  },
})

const root = ReactDOM.createRoot(document.getElementById('root'))

async function bootstrap() {
  window.__BANDIT_AMPLIFY_CONFIG__ = buildOAuthConfig(await loadAmplifyConfig())
  root.render(
    <React.StrictMode>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </React.StrictMode>,
  )
}

bootstrap()
