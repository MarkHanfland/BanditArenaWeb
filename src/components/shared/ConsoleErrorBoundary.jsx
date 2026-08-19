import React from 'react'
import { Alert, Box, Button, Typography } from '@mui/material'

/**
 * Keeps console shell mounted when a panel throws — avoids blank-root recovery
 * that can bounce users off console.banditarena.com.
 */
export default class ConsoleErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Console panel error:', error, info?.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
    if (typeof this.props.onReset === 'function') {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 3 }} data-testid="console-error-boundary">
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={this.handleReset}>
                Try again
              </Button>
            }
          >
            Something went wrong in this view. You are still signed in — use Try again or pick
            another menu item.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {this.state.error?.message || String(this.state.error)}
          </Typography>
        </Box>
      )
    }
    return this.props.children
  }
}
