import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { getUser, listReservations } from '../../api/cloud'
import {
  currentSlotsForUser,
  matchesPlayerSearch,
  playerDisplayName,
  playerLastName,
  scheduledUserIdsFromReservations,
} from '../../session/playerSelectUtils'

function DetailRow({ label, value }) {
  if (value === undefined || value === null || value === '') {
    return null
  }
  return (
    <Typography variant="body2">
      <Box component="span" sx={{ color: 'text.secondary' }}>{label}: </Box>
      {value}
    </Typography>
  )
}

export default function PlayerSelectDialog({
  open,
  onClose,
  onSelect,
  players = [],
  selected = null,
  testIdPrefix = 'player-select',
}) {
  const [search, setSearch] = useState('')
  const [scheduledOnly, setScheduledOnly] = useState(true)
  const [reservations, setReservations] = useState([])
  const [loadingReservations, setLoadingReservations] = useState(false)
  const [highlightedId, setHighlightedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!open) {
      return undefined
    }
    setSearch('')
    setScheduledOnly(true)
    setLoadError('')
    setHighlightedId(selected?.userId || null)
    setDetail(null)

    let cancelled = false
    setLoadingReservations(true)
    listReservations().then(({ data, error }) => {
      if (cancelled) {
        return
      }
      if (error) {
        setLoadError(error)
        setReservations([])
        setScheduledOnly(false)
      } else {
        const slots = data?.reservations || []
        setReservations(slots)
        const scheduledIds = scheduledUserIdsFromReservations(slots)
        const hasScheduledPlayers = players.some((player) => scheduledIds.has(player.userId))
        setScheduledOnly(hasScheduledPlayers)
      }
      setLoadingReservations(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, players, selected?.userId])

  const scheduledIds = useMemo(
    () => scheduledUserIdsFromReservations(reservations),
    [reservations],
  )

  const filteredPlayers = useMemo(() => {
    let list = players.filter((player) => matchesPlayerSearch(player, search))
    if (scheduledOnly) {
      list = list.filter((player) => scheduledIds.has(player.userId))
    }
    return list.slice().sort((a, b) => {
      const aScheduled = scheduledIds.has(a.userId) ? 0 : 1
      const bScheduled = scheduledIds.has(b.userId) ? 0 : 1
      if (aScheduled !== bScheduled) {
        return aScheduled - bScheduled
      }
      return playerLastName(a).localeCompare(playerLastName(b), undefined, { sensitivity: 'base' })
        || playerDisplayName(a).localeCompare(playerDisplayName(b), undefined, { sensitivity: 'base' })
    })
  }, [players, search, scheduledOnly, scheduledIds])

  useEffect(() => {
    if (!open || !highlightedId) {
      return undefined
    }
    let cancelled = false
    setDetailLoading(true)
    getUser(highlightedId).then(({ data, error }) => {
      if (cancelled) {
        return
      }
      if (error) {
        const fallback = players.find((player) => player.userId === highlightedId) || null
        setDetail(fallback)
      } else {
        setDetail(data?.user || null)
      }
      setDetailLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, highlightedId, players])

  const highlightSlots = useMemo(
    () => currentSlotsForUser(reservations, highlightedId),
    [reservations, highlightedId],
  )

  const handleConfirm = () => {
    const player = players.find((entry) => entry.userId === highlightedId)
      || detail
      || null
    if (!player?.userId) {
      return
    }
    onSelect({
      ...player,
      displayName: playerDisplayName(player),
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle data-testid={testIdPrefix}>Select treadmill player</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Search last name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              inputProps={{ 'data-testid': `${testIdPrefix}-search` }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={scheduledOnly}
                  onChange={(event) => setScheduledOnly(event.target.checked)}
                  inputProps={{ 'data-testid': `${testIdPrefix}-scheduled-only` }}
                />
              }
              label="Scheduled now"
              sx={{ flexShrink: 0 }}
            />
          </Stack>

          {loadError && (
            <Typography variant="caption" color="warning.main">
              Could not load reservations ({loadError}). Showing all active players.
            </Typography>
          )}
          {loadingReservations && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">Loading schedule…</Typography>
            </Stack>
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
              minHeight: 320,
            }}
          >
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                  PLAYERS ({filteredPlayers.length})
                </Typography>
              </Box>
              {filteredPlayers.length === 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {scheduledOnly
                      ? 'No players scheduled for the current window. Turn off “Scheduled now” to browse all active enrollments.'
                      : 'No players match this search.'}
                  </Typography>
                  {scheduledOnly && (
                    <Button
                      size="small"
                      sx={{ mt: 1 }}
                      onClick={() => setScheduledOnly(false)}
                      data-testid={`${testIdPrefix}-show-all`}
                    >
                      Show all active players
                    </Button>
                  )}
                </Box>
              ) : (
                <List dense sx={{ maxHeight: 360, overflowY: 'auto', py: 0 }}>
                  {filteredPlayers.map((player) => {
                    const scheduled = scheduledIds.has(player.userId)
                    return (
                      <ListItemButton
                        key={player.userId}
                        selected={highlightedId === player.userId}
                        onClick={() => setHighlightedId(player.userId)}
                        data-testid={`${testIdPrefix}-row-${player.userId}`}
                      >
                        <ListItemText
                          primary={playerDisplayName(player)}
                          secondary={player.email || player.userId}
                          primaryTypographyProps={{ fontWeight: scheduled ? 700 : 500 }}
                        />
                        {scheduled && <Chip size="small" color="primary" label="Scheduled" />}
                        {player.recent && !scheduled && (
                          <Chip size="small" label="Recent" sx={{ ml: 0.5 }} />
                        )}
                      </ListItemButton>
                    )
                  })}
                </List>
              )}
            </Box>

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                DETAILS
              </Typography>
              <Divider sx={{ my: 1 }} />
              {!highlightedId && (
                <Typography variant="body2" color="text.secondary">
                  Select a player to view enrollment and safety details.
                </Typography>
              )}
              {highlightedId && detailLoading && <CircularProgress size={20} />}
              {highlightedId && !detailLoading && detail && (
                <Stack spacing={1} data-testid={`${testIdPrefix}-details`}>
                  <Typography variant="h6">{playerDisplayName(detail)}</Typography>
                  <DetailRow label="Last name" value={playerLastName(detail)} />
                  <DetailRow label="Email" value={detail.email} />
                  <DetailRow label="User ID" value={detail.userId} />
                  <DetailRow label="Enrollment" value={detail.enrollmentState} />
                  <DetailRow
                    label="Age attested"
                    value={detail.ageAttested === undefined ? null : detail.ageAttested ? 'Yes' : 'No'}
                  />
                  <DetailRow
                    label="Safety"
                    value={
                      detail.safetyProfile
                        ? `${detail.safetyProfile.heightCm || '—'} cm · ${detail.safetyProfile.weightKg || '—'} kg · stride ${detail.safetyProfile.strideCm || '—'} cm`
                        : null
                    }
                  />
                  <DetailRow
                    label="Emergency contact"
                    value={
                      detail.emergencyContact
                        ? `${detail.emergencyContact.name || ''} ${detail.emergencyContact.phone || ''}`.trim()
                        : null
                    }
                  />
                  {highlightSlots.length > 0 && (
                    <Box sx={{ pt: 1 }}>
                      <Typography variant="subtitle2">Current schedule</Typography>
                      {highlightSlots.map((slot) => (
                        <Typography key={slot.slotId} variant="body2" color="text.secondary">
                          {slot.slotId} · {slot.status} · {new Date(slot.startTime).toLocaleString()}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid={`${testIdPrefix}-cancel`}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!highlightedId}
          data-testid={`${testIdPrefix}-confirm`}
        >
          Select player
        </Button>
      </DialogActions>
    </Dialog>
  )
}
