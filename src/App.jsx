import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Box } from '@mui/material'
import { AuthProvider, useAuth } from './auth/useAuth'
import { configureAmplifyAuth, resolveAuthMode } from './auth/amplifyConfig'
import {
  BanditAuthLoadingShell,
  BanditLocalBypassShell,
  CognitoAuthRoot,
} from './auth/BanditAuthShell'
import MockLoginShell from './auth/MockLoginShell'
import { isE2eAuthBypass } from './auth/e2eAuth'
import Dashboard from './AppDashboard'

function LocalBypassGate() {
  const { isAuthenticated, login } = useAuth()
  const [isEntering, setIsEntering] = useState(false)

  const handleEnter = useCallback(async () => {
    setIsEntering(true)
    try {
      await login()
    } finally {
      setIsEntering(false)
    }
  }, [login])

  if (!isAuthenticated) {
    return <BanditLocalBypassShell onEnter={handleEnter} isEntering={isEntering} />
  }

  return <Dashboard />
}

function CognitoApp() {
  return (
    <CognitoAuthRoot>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </CognitoAuthRoot>
  )
}

function LocalBypassApp() {
  return (
    <AuthProvider localBypass>
      <LocalBypassGate />
    </AuthProvider>
  )
}

function AppRoot() {
  const [authBoot, setAuthBoot] = useState(null)
  const [bootError, setBootError] = useState(null)

  useEffect(() => {
    let cancelled = false

    resolveAuthMode()
      .then((mode) => {
        if (cancelled) {
          return
        }
        if (mode.mode === 'cognito') {
          configureAmplifyAuth(mode.resourcesConfig)
        }
        setAuthBoot(mode)
      })
      .catch((err) => {
        if (!cancelled) {
          setBootError(err?.message || 'Authentication configuration failed.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (bootError) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Alert severity="error" sx={{ maxWidth: 560 }}>
          {bootError}
        </Alert>
      </Box>
    )
  }

  if (!authBoot) {
    return <BanditAuthLoadingShell />
  }

  if (authBoot.mode === 'local-bypass') {
    return <LocalBypassApp />
  }

  return <CognitoApp />
}

function App() {
  if (isE2eAuthBypass()) {
    return <MockLoginShell />
  }

  return <AppRoot />
}

export default App
