import React, { useEffect, useState } from 'react'
import { FormControl, MenuItem, Select } from '@mui/material'
import { getActiveTenant, getMyRoleBindings, setActiveTenant } from '../../api/cloud'

const STORAGE_KEY = 'bandit.activeTenant'

function readStored() {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStored(value) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage is a convenience only.
  }
}

/**
 * FR-SW-UI-014 / FR-SW-AUTH-011 scope switcher. Shown only to a staff member bound in more
 * than one tenant. The selected tenant goes to the cloud on every request as
 * x-bandit-tenant; the cloud checks the binding, so this never widens access.
 */
export default function ScopeSwitcher({ onChange }) {
  const [tenants, setTenants] = useState([])
  const [home, setHome] = useState(null)
  const [active, setActive] = useState(getActiveTenant())

  useEffect(() => {
    let cancelled = false
    getMyRoleBindings().then(({ data }) => {
      if (cancelled || !data) return
      const list = Array.isArray(data.tenants) ? data.tenants : []
      setTenants(list)
      setHome(data.homeOperatorId || null)
      const stored = readStored()
      const initial = stored && list.includes(stored) ? stored : null
      if (initial && initial !== getActiveTenant()) {
        setActiveTenant(initial)
        setActive(initial)
        onChange?.(initial)
      }
    })
    return () => {
      cancelled = true
    }
  }, [onChange])

  if (tenants.length < 2) return null

  const value = active || home || tenants[0]
  const select = (event) => {
    const next = event.target.value
    const header = next === home ? null : next
    setActiveTenant(header)
    writeStored(header)
    setActive(header)
    onChange?.(header)
  }

  return (
    <FormControl size="small" sx={{ minWidth: 180 }}>
      <Select
        value={value}
        onChange={select}
        data-testid="scope-switcher"
        inputProps={{ 'aria-label': 'Tenant' }}
        sx={{ color: 'inherit', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' } }}
      >
        {tenants.map((t) => (
          <MenuItem key={t} value={t} data-testid={`scope-option-${t}`}>
            {t}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
