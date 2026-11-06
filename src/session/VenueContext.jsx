import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { FormControl, MenuItem, Select } from '@mui/material'
import { getConfig } from '../api/device'
import { listVenues } from '../api/cloud'

const VenueContext = createContext(null)

const TENANT_WIDE = new Set([
  'bandit-cloud-admin',
  'bandit-account-owner',
  'bandit-fleet-admin',
  'bandit-billing-admin',
  'bandit-developer',
])

function storageKey(username) {
  return `bandit.venue.${username || 'staff'}`
}

function readStored(username) {
  try {
    return window.localStorage.getItem(storageKey(username))
  } catch {
    return null
  }
}

function writeStored(username, venueId) {
  try {
    if (venueId) window.localStorage.setItem(storageKey(username), venueId)
  } catch {
    // Remembering the venue is a convenience.
  }
}

function deviceVenueId(config) {
  return config?.venueId || config?.venue?.venueId || config?.device?.venueId || null
}

export function VenueProvider({ children, username, groups = [], deviceOnline = false }) {
  const [venues, setVenues] = useState([])
  const [venueId, setVenueIdState] = useState('')
  const [locked, setLocked] = useState(false)
  const [ready, setReady] = useState(false)
  const [revision, setRevision] = useState(0)

  const tenantWide = groups.some((group) => TENANT_WIDE.has(group))

  const choose = useCallback((nextId, venueList, lock) => {
    const allowed = venueList.filter((venue) => venue?.venueId)
    const stored = readStored(username)
    const pick = allowed.find((venue) => venue.venueId === nextId)
      || allowed.find((venue) => venue.venueId === stored)
      || allowed[0]
      || null
    setVenueIdState(pick?.venueId || '')
    setLocked(lock || allowed.length <= 1)
    if (pick?.venueId) writeStored(username, pick.venueId)
  }, [username])

  useEffect(() => {
    const onTenant = () => setRevision((value) => value + 1)
    window.addEventListener('bandit:tenant-changed', onTenant)
    return () => window.removeEventListener('bandit:tenant-changed', onTenant)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setReady(false)
      const listed = await listVenues()
      if (cancelled) return
      const venueList = listed.data?.venues || []
      let deviceVenue = null
      if (deviceOnline) {
        const config = await getConfig()
        deviceVenue = deviceVenueId(config.data)
      }
      if (cancelled) return
      const allowed = deviceVenue && venueList.some((venue) => venue.venueId === deviceVenue)
      setVenues(venueList)
      choose(allowed ? deviceVenue : '', venueList, Boolean(allowed) || (!tenantWide && venueList.length <= 1))
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [choose, deviceOnline, revision, tenantWide])

  const setVenueId = useCallback((nextId) => {
    if (locked) return
    const pick = venues.find((venue) => venue.venueId === nextId)
    if (!pick) return
    setVenueIdState(pick.venueId)
    writeStored(username, pick.venueId)
  }, [locked, username, venues])

  const venue = venues.find((item) => item.venueId === venueId) || null
  const value = useMemo(() => ({
    ready,
    venues,
    venue,
    venueId: venue?.venueId || '',
    locked,
    empty: ready && venues.length === 0,
    setVenueId,
  }), [locked, ready, setVenueId, venue, venues])

  return <VenueContext.Provider value={value}>{children}</VenueContext.Provider>
}

export function useVenue() {
  return useContext(VenueContext)
}

export function HeaderVenueSelect() {
  const venueCtx = useVenue()
  if (!venueCtx || venueCtx.locked || venueCtx.venues.length < 2) return null
  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <Select
        value={venueCtx.venueId}
        onChange={(event) => venueCtx.setVenueId(event.target.value)}
        data-testid="header-venue"
        inputProps={{ 'aria-label': 'Venue' }}
        sx={{ color: 'inherit', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' } }}
      >
        {venueCtx.venues.map((venue) => (
          <MenuItem key={venue.venueId} value={venue.venueId} data-testid={`header-venue-${venue.venueId}`}>
            {venue.name || venue.venueId}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
