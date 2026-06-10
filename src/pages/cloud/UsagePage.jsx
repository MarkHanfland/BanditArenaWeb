import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import { getAnalyticsSummary } from '../../api/cloud'

export default function UsagePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error: apiError } = await getAnalyticsSummary()
      if (!mounted) return
      if (apiError) {
        setError(apiError)
      } else {
        setSummary(data)
      }
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  return (
    <PageScaffold
      title="Analytics"
      category="Cloud"
      description="Fleet and session analytics dashboard (SVC-011)."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && summary && (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Sessions (7d)</Typography>
                  <Typography variant="h4">{summary.sessionsCompleted}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Active Devices</Typography>
                  <Typography variant="h4">{summary.activeDevices}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="overline" color="text.secondary">Enrolled Users</Typography>
                  <Typography variant="h4">{summary.enrolledUsers}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          <Box>
            <Typography variant="subtitle2" gutterBottom>Weekly session trend</Typography>
            <Typography variant="body2" color="text.secondary">
              {(summary.weeklySessionTrend || []).join(' → ')}
            </Typography>
          </Box>
          {(summary.alerts || []).map((alert) => (
            <Alert key={alert.id} severity={alert.severity === 'info' ? 'info' : 'warning'}>
              {alert.message}
            </Alert>
          ))}
        </Stack>
      )}
    </PageScaffold>
  )
}
