import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Authenticator, ThemeProvider, useAuthenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import './auth-overrides.css'
import { Box, Button, CircularProgress, Typography } from '@mui/material'
import { banditAuthTheme } from './banditAuthTheme'
import { banditAuthenticatorComponents } from './banditAuthenticatorComponents'

const FADE_DURATION_MS = 1800
const DISPLAY_DURATION_MS = 10000

const backgroundModules = import.meta.glob('../assets/login-backgrounds/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
})

const backgroundImages = Object.values(backgroundModules)

function shuffle(list) {
  const copy = [...list]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const temp = copy[index]
    copy[index] = copy[randomIndex]
    copy[randomIndex] = temp
  }
  return copy
}

function preloadImage(src) {
  if (!src) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = resolve
    image.onerror = resolve
    image.src = src
  })
}

function BrandedBackdrop({ children }) {
  const sessionOrder = useMemo(() => {
    if (!backgroundImages.length) {
      return []
    }
    return shuffle(backgroundImages)
  }, [])

  const startIndex = useMemo(() => {
    if (!sessionOrder.length) {
      return -1
    }
    return Math.floor(Math.random() * sessionOrder.length)
  }, [sessionOrder])

  const [currentImage, setCurrentImage] = useState(() => (startIndex >= 0 ? sessionOrder[startIndex] : null))
  const [incomingImage, setIncomingImage] = useState(null)
  const [isCrossfading, setIsCrossfading] = useState(false)
  const currentIndexRef = useRef(startIndex)

  useEffect(() => {
    if (sessionOrder.length < 2) {
      return undefined
    }

    let cancelled = false

    const interval = setInterval(async () => {
      const nextIndex = (currentIndexRef.current + 1) % sessionOrder.length
      const nextImage = sessionOrder[nextIndex]

      await preloadImage(nextImage)
      if (cancelled) {
        return
      }

      setIncomingImage(nextImage)
      setIsCrossfading(true)

      window.setTimeout(() => {
        if (cancelled) {
          return
        }
        setCurrentImage(nextImage)
        setIncomingImage(null)
        setIsCrossfading(false)
        currentIndexRef.current = nextIndex
      }, FADE_DURATION_MS)
    }, DISPLAY_DURATION_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sessionOrder])

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        bgcolor: '#111',
      }}
    >
      {currentImage && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${currentImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'grayscale(100%) brightness(0.72)',
            transform: 'scale(1.03)',
            transition: 'transform 12s ease-in-out',
          }}
        />
      )}

      {incomingImage && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${incomingImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'grayscale(100%) brightness(0.72)',
            opacity: isCrossfading ? 1 : 0,
            transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
          }}
        />
      )}

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at center, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.45) 62%, rgba(0,0,0,0.68) 100%)',
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          px: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 560,
            borderRadius: 3,
            px: { xs: 3, sm: 4 },
            py: { xs: 4, sm: 5 },
            backgroundColor: 'rgba(12, 14, 16, 0.62)',
            border: '1px solid rgba(255,255,255,0.16)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)',
            textAlign: 'center',
          }}
        >
          <Box
            component="img"
            src="/BanditLogo.svg"
            alt="Bandit"
            sx={{ height: 56, width: 'auto', mb: 2, opacity: 0.95 }}
          />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#fff',
              mb: 1,
            }}
          >
            BANDIT ARENA
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)', mb: 3 }}>
            Secure operator access for the Bandit Arena Console.
          </Typography>
          {children}
        </Box>
      </Box>
    </Box>
  )
}

export function BanditAuthLoadingShell() {
  return (
    <BrandedBackdrop>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={34} thickness={4.2} sx={{ color: '#4db6c4' }} />
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.76)' }}>
          Loading secure sign-in...
        </Typography>
      </Box>
    </BrandedBackdrop>
  )
}

export function BanditLocalBypassShell({ onEnter, isEntering = false }) {
  return (
    <BrandedBackdrop>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          size="large"
          onClick={onEnter}
          disabled={isEntering}
          startIcon={isEntering ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{
            minWidth: 230,
            py: 1.3,
            borderRadius: 999,
            fontWeight: 700,
            letterSpacing: '0.06em',
            bgcolor: '#4db6c4',
            '&:hover': { bgcolor: '#7ed4df' },
          }}
        >
          {isEntering ? 'Entering...' : 'Enter Console'}
        </Button>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.64)' }}>
          Local lab mode — authentication bypass enabled.
        </Typography>
      </Box>
    </BrandedBackdrop>
  )
}

function BrandedAuthenticator() {
  return (
    <Box className="bandit-auth-shell" sx={{ width: '100%' }}>
      <ThemeProvider theme={banditAuthTheme} colorMode="dark">
        <Authenticator
          hideSignUp
          loginMechanisms={['username']}
          components={banditAuthenticatorComponents}
        />
      </ThemeProvider>
    </Box>
  )
}

export default function CognitoAuthGate({ children }) {
  const { authStatus } = useAuthenticator((context) => [context.authStatus])

  if (authStatus === 'authenticated') {
    return children
  }

  return (
    <BrandedBackdrop>
      <BrandedAuthenticator />
    </BrandedBackdrop>
  )
}

export function CognitoAuthRoot({ children }) {
  return (
    <Authenticator.Provider>
      <CognitoAuthGate>{children}</CognitoAuthGate>
    </Authenticator.Provider>
  )
}
