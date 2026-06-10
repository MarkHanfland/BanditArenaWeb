import React, { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { AuthProvider } from './useAuth'
import Dashboard from '../AppDashboard'
import {
  ROLE_OPERATOR,
  ROLE_TECHNICIAN,
  ROLE_VENUE_ADMIN,
} from './rolePermissions'

const GROUP_BY_ROLE = {
  [ROLE_OPERATOR]: 'bandit-operator',
  [ROLE_TECHNICIAN]: 'bandit-technician',
  [ROLE_VENUE_ADMIN]: 'bandit-venue-admin',
}

export default function MockLoginShell() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(ROLE_OPERATOR)
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.')
      return
    }

    setError('')
    setSession({
      accessToken: '__e2e_mock_token__',
      user: {
        userId: username.trim(),
        username: username.trim(),
        groups: [GROUP_BY_ROLE[role]],
      },
    })
  }

  if (session) {
    return (
      <AuthProvider
        initialAccessToken={session.accessToken}
        initialUser={session.user}
        onE2eSignOut={() => setSession(null)}
      >
        <Dashboard />
      </AuthProvider>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 2 }}>
            Bandit Arena Login
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} data-testid="login-error">
              {error}
            </Alert>
          )}
          <TextField
            fullWidth
            margin="normal"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            inputProps={{ 'data-testid': 'login-username' }}
          />
          <TextField
            fullWidth
            margin="normal"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputProps={{ 'data-testid': 'login-password' }}
          />
          <TextField
            fullWidth
            select
            margin="normal"
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            inputProps={{ 'data-testid': 'login-role' }}
          >
            <MenuItem value={ROLE_OPERATOR}>Operator</MenuItem>
            <MenuItem value={ROLE_TECHNICIAN}>Technician</MenuItem>
            <MenuItem value={ROLE_VENUE_ADMIN}>Venue Admin</MenuItem>
          </TextField>
          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
            onClick={handleLogin}
            data-testid="login-submit"
          >
            Sign In
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}
