const STORAGE_KEY = 'bandit.auth.rememberUsername'

/** In-form preference for the current Authenticator render (not a silent login grant). */
let preferRemember = false

export function getRememberedUsername() {
  if (typeof localStorage === 'undefined') {
    return ''
  }
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function setRememberedUsername(username) {
  if (typeof localStorage === 'undefined' || !username) {
    return
  }
  localStorage.setItem(STORAGE_KEY, username)
}

export function clearRememberedUsername() {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.removeItem(STORAGE_KEY)
}

export function getPreferRememberUsername() {
  return preferRemember
}

export function setPreferRememberUsername(value) {
  preferRemember = Boolean(value)
}

/** Seed checkbox from any previously remembered username. */
export function initPreferRememberFromStorage() {
  preferRemember = Boolean(getRememberedUsername())
}

export function persistRememberUsernamePreference(username) {
  if (preferRemember && username) {
    setRememberedUsername(username)
  } else {
    clearRememberedUsername()
  }
}
