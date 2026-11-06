import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import DarkDateField from '../../components/shared/DarkDateField'
import PageScaffold from '../../components/shared/PageScaffold'
import { listVenues, patchVenue } from '../../api/cloud'
import { useVenue } from '../../session/VenueContext'

const DAYS = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
]

const HALF_HOURS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2)
  const minute = index % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${minute}`
})
const MIDNIGHT = '24:00'

export function formatHour12(value) {
  if (value === MIDNIGHT) return '12:00 AM'
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return value || ''
  const hour = Number(match[1])
  const minute = match[2]
  const period = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minute} ${period}`
}

function timeChoices(current) {
  const values = [...HALF_HOURS, MIDNIGHT]
  return current && !values.includes(current) ? [current, ...values] : values
}

function weekFromVenue(venue) {
  const weekly = venue?.openingHours?.weekly || {}
  const fallbackOpen = venue?.openingHours?.open || '09:00'
  const fallbackClose = venue?.openingHours?.close || '21:00'
  return Object.fromEntries(DAYS.map(([day]) => {
    const stored = weekly[day]
    if (stored?.closed) return [day, { open: fallbackOpen, close: fallbackClose, closed: true }]
    return [day, {
      open: stored?.open || fallbackOpen,
      close: stored?.close || fallbackClose,
      closed: false,
    }]
  }))
}

export default function VenueHoursPage() {
  const venueCtx = useVenue()
  const venueId = venueCtx?.venueId || ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [venues, setVenues] = useState([])
  const [week, setWeek] = useState(() => weekFromVenue(null))
  const [holidays, setHolidays] = useState([])
  const [holiday, setHoliday] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await listVenues()
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    const next = result.data?.venues || []
    setVenues(next)
    setError('')
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!venueCtx?.ready) return
    load()
  }, [load, venueCtx?.ready, venueId])

  useEffect(() => {
    const venue = venues.find((item) => item.venueId === venueId)
    setWeek(weekFromVenue(venue))
    setHolidays(Array.isArray(venue?.holidays) ? venue.holidays : [])
  }, [venueId, venues])

  const save = async () => {
    if (!venueId) return
    setSaving(true)
    setMessage('')
    const weekly = Object.fromEntries(DAYS.map(([day]) => {
      const value = week[day]
      return [day, value.closed ? { closed: true } : { open: value.open, close: value.close }]
    }))
    const openDay = DAYS.map(([day]) => week[day]).find((day) => !day.closed)
    const result = await patchVenue(venueId, {
      openingHours: {
        open: openDay?.open || '09:00',
        close: openDay?.close || '21:00',
        weekly,
      },
      holidays,
    })
    setSaving(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setMessage(`Saved hours for ${venueId}`)
    await load()
  }

  return (
    <PageScaffold
      title="Venue hours"
      category="Operations"
      description="Weekly operating hours and holiday closures for a venue. Booking offers times only inside these hours."
    >
      {loading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="info" sx={{ mb: 2 }} data-testid="venue-hours-message">{message}</Alert>}
      {!loading && !error && (
        <Stack spacing={2} data-testid="venue-hours">
          <Typography variant="h6">Operating hours</Typography>
          {DAYS.map(([day, label]) => (
            <Stack key={day} direction="row" spacing={1} alignItems="center">
              <Typography sx={{ width: 120 }}>{label}</Typography>
              <TextField
                select
                size="small"
                label="Opens"
                sx={{ minWidth: 140 }}
                value={week[day]?.open || ''}
                disabled={week[day]?.closed}
                onChange={(event) => setWeek((current) => ({
                  ...current,
                  [day]: { ...current[day], open: event.target.value },
                }))}
                inputProps={{ 'data-testid': `hours-open-${day}` }}
              >
                {timeChoices(week[day]?.open).map((value) => (
                  <MenuItem key={`open-${day}-${value}`} value={value}>{formatHour12(value)}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Closes"
                sx={{ minWidth: 140 }}
                value={week[day]?.close || ''}
                disabled={week[day]?.closed}
                onChange={(event) => setWeek((current) => ({
                  ...current,
                  [day]: { ...current[day], close: event.target.value },
                }))}
                inputProps={{ 'data-testid': `hours-close-${day}` }}
              >
                {timeChoices(week[day]?.close).map((value) => (
                  <MenuItem key={`close-${day}-${value}`} value={value}>{formatHour12(value)}</MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={Boolean(week[day]?.closed)}
                    onChange={(event) => setWeek((current) => ({
                      ...current,
                      [day]: { ...current[day], closed: event.target.checked },
                    }))}
                    inputProps={{ 'data-testid': `hours-closed-${day}` }}
                  />
                )}
                label="Closed"
              />
            </Stack>
          ))}
          <Typography variant="h6">Holidays</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <DarkDateField
              label="Holiday"
              testId="hours-holiday"
              value={holiday}
              onChange={(event) => setHoliday(event.target.value)}
            />
            <Button
              variant="outlined"
              data-testid="hours-add-holiday"
              onClick={() => {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday) || holidays.includes(holiday)) return
                setHolidays((current) => [...current, holiday].sort())
                setHoliday('')
              }}
            >
              Add holiday
            </Button>
          </Stack>
          {holidays.map((day) => (
            <Stack key={day} direction="row" spacing={1} alignItems="center">
              <Typography data-testid={`holiday-${day}`}>{day}</Typography>
              <Button size="small" onClick={() => setHolidays((current) => current.filter((item) => item !== day))}>
                Remove
              </Button>
            </Stack>
          ))}
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || !venueId}
            data-testid="hours-save"
            sx={{ alignSelf: 'flex-start', px: 3 }}
          >
            Save hours
          </Button>
        </Stack>
      )}
    </PageScaffold>
  )
}
