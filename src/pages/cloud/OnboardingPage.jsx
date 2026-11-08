import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import PageScaffold from '../../components/shared/PageScaffold'
import { getOnboardingChecklist } from '../../api/cloud'

function formatWhen(iso) {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return String(iso)
  return new Date(ms).toLocaleDateString()
}

function ownerLabel(owner) {
  return owner === 'bandit' ? 'Bandit' : 'You'
}

export default function OnboardingPage({ onContinue } = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await getOnboardingChecklist()
    if (result.error) {
      setError(result.error)
      setPayload(null)
    } else {
      setPayload(result.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PageScaffold
      title="Onboarding"
      category="Operations"
      description="Every step between purchase and the first session. Each line is taken from the agreement, the treadmill, staff, the venue page, the media library, or a session — not a separate checklist."
    >
      <Stack spacing={2} data-testid="onboarding-page">
        {error ? <Alert severity="error">{error}</Alert> : null}
        {loading ? <CircularProgress size={24} /> : null}
        {!loading && payload?.complete ? (
          <Alert severity="success" data-testid="onboarding-complete">
            You are ready to book. The first session is on record.
          </Alert>
        ) : null}
        {!loading && payload && !payload.complete ? (
          <Alert severity="info" data-testid="onboarding-waiting">
            Finish the steps that wait on you. Bandit-owned steps show when they are due.
          </Alert>
        ) : null}
        {(payload?.checklists || []).map((row) => (
          <Stack key={row.agreementId || 'tenant'} spacing={1} data-testid={`onboarding-agreement-${row.agreementId || 'none'}`}>
            <Typography variant="h6">
              {row.agreementId ? `Agreement ${row.agreementId}` : 'This site'}
              {row.siteKind === 'home' ? ' (home)' : ''}
            </Typography>
            <Table size="small" data-testid="onboarding-table">
              <TableHead>
                <TableRow>
                  <TableCell>Step</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {row.steps.map((step) => (
                  <TableRow key={step.id} data-testid={`onboarding-step-${step.id}`}>
                    <TableCell>{step.label}</TableCell>
                    <TableCell>{ownerLabel(step.owner)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={step.status === 'complete' ? 'success' : step.overdue ? 'warning' : 'default'}
                        label={step.status === 'complete' ? 'Done' : step.overdue ? 'Overdue' : 'Waiting'}
                      />
                    </TableCell>
                    <TableCell>
                      {step.status === 'complete'
                        ? formatWhen(step.completedAt)
                        : step.owner === 'bandit'
                          ? `Expected ${formatWhen(step.expectedDate)}`
                          : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        ))}
        {payload?.complete && typeof onContinue === 'function' ? (
          <Button variant="contained" onClick={onContinue} data-testid="onboarding-continue">
            Go to Reservations
          </Button>
        ) : null}
      </Stack>
    </PageScaffold>
  )
}
