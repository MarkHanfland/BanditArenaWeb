import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import { getAnalyticsSummary } from '../../api/cloud'
import { analyticsFleetComparison } from '../../data/fleetDemoCatalog'

function usd(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)
}

function HeroMetric({ label, value, sub }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 140,
        p: 2,
        borderRadius: 2,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800, mt: 0.5 }} data-testid={sub}>
        {value}
      </Typography>
    </Box>
  )
}

function FleetCard({ fleet, onOpenFleet }) {
  return (
    <Box
      data-testid={`analytics-fleet-${fleet.fleetId}`}
      sx={{
        p: 2.5,
        borderRadius: 3,
        background: fleet.accent.wash,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 16px 36px rgba(0,0,0,0.3)',
        flex: 1,
        minWidth: 280,
      }}
    >
      <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.7)' }}>
        {fleet.shortLabel}
      </Typography>
      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800 }}>
        {fleet.name}
      </Typography>
      <Stack spacing={1.25} sx={{ mt: 2 }}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>
            Session revenue 30d
          </Typography>
          <Typography sx={{ color: '#fff', fontWeight: 700 }}>{usd(fleet.sessionRevenue30d)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>
            Contribution margin 30d
          </Typography>
          <Typography sx={{ color: '#fff', fontWeight: 700 }}>
            {usd(fleet.contributionMargin30d)}
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>
            Devices online
          </Typography>
          <Typography sx={{ color: '#fff', fontWeight: 700 }}>
            {fleet.onlineCount}/{fleet.deviceCount}
          </Typography>
        </Stack>
        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
              Avg utilization
            </Typography>
            <Typography variant="caption" sx={{ color: '#fff' }}>
              {fleet.avgUtilizationPct}%
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={fleet.avgUtilizationPct}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(0,0,0,0.35)',
              '& .MuiLinearProgress-bar': { bgcolor: fleet.accent.pin },
            }}
          />
        </Box>
        {fleet.needsAttention > 0 && (
          <Alert
            severity="warning"
            sx={{ py: 0, bgcolor: 'rgba(0,0,0,0.25)', color: '#fff' }}
            action={
              onOpenFleet ? (
                <Button color="inherit" size="small" onClick={() => onOpenFleet(fleet.fleetId)}>
                  Fleet
                </Button>
              ) : null
            }
          >
            {fleet.needsAttention} unit(s) need attention
          </Alert>
        )}
      </Stack>
    </Box>
  )
}

export default function UsagePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const fleets = useMemo(() => analyticsFleetComparison(), [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error: apiError } = await getAnalyticsSummary()
      if (!mounted) return
      if (apiError) setError(apiError)
      else setSummary(data)
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  const openFleet = () => {
    const btn = document.querySelector('[data-testid="menu-fleet"]')
    if (btn) btn.click()
  }

  const totalRevenue = fleets.reduce((a, f) => a + f.sessionRevenue30d, 0)
  const totalMargin = fleets.reduce((a, f) => a + f.contributionMargin30d, 0)

  return (
    <Box
      sx={{
        minHeight: '100%',
        background:
          'radial-gradient(1000px 420px at 0% 0%, rgba(15,110,86,0.2), transparent 50%), radial-gradient(800px 380px at 100% 10%, rgba(139,69,19,0.16), transparent 45%), #0e1216',
      }}
    >
      <PageScaffold
        title="Analytics"
        category="Cloud"
        tone="immersive"
        description="Fleet utilization, session volume, and operating financials across demo fleets."
      >
        {loading && <CircularProgress size={24} />}
        {error && <Alert severity="error">{error}</Alert>}

        <Stack spacing={3} sx={{ mt: loading ? 2 : 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <HeroMetric
              label="Sessions (7d)"
              value={summary?.sessionsCompleted ?? '—'}
              sub="analytics-sessions"
            />
            <HeroMetric label="Active devices" value={summary?.activeDevices ?? '—'} />
            <HeroMetric label="Enrolled users" value={summary?.enrolledUsers ?? '—'} />
            <HeroMetric label="Fleet revenue 30d" value={usd(totalRevenue)} sub="analytics-fleet-revenue" />
            <HeroMetric label="Fleet margin 30d" value={usd(totalMargin)} sub="analytics-fleet-margin" />
          </Stack>

          <Box>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
              Weekly session trend
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="flex-end" data-testid="analytics-trend" height={72}>
              {(summary?.weeklySessionTrend || []).map((n, i) => (
                <Box
                  key={`t-${i}`}
                  sx={{
                    flex: 1,
                    height: `${Math.max(12, n * 7)}%`,
                    borderRadius: 1,
                    background: 'linear-gradient(180deg, #3DDC97, #0F6E56)',
                    opacity: 0.85,
                  }}
                  title={String(n)}
                />
              ))}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {(summary?.weeklySessionTrend || []).join(' → ')}
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, mb: 1.5 }}>
              Fleet financial comparison
            </Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {fleets.map((fleet) => (
                <FleetCard key={fleet.fleetId} fleet={fleet} onOpenFleet={openFleet} />
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>
              Financial measurement capabilities
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Per-device session revenue, average ticket, utilization, and contribution margin</li>
                <li>Content royalty, license cost, maintenance contract accrual, and parts spend</li>
                <li>Fleet rollups for downtown entertainment vs theme-park operating models</li>
                <li>Deep-link into Fleet for units that need attention (offline, update, degraded)</li>
              </ul>
            </Typography>
          </Box>

          {(summary?.alerts || []).length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No open alerts.
            </Typography>
          )}
          {(summary?.alerts || []).map((alert) => (
            <Alert key={alert.id} severity={alert.severity === 'info' ? 'info' : 'warning'}>
              {alert.message}
            </Alert>
          ))}
        </Stack>
      </PageScaffold>
    </Box>
  )
}
