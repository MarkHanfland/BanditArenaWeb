function isLocalConsoleHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

/** Mock login is for local Vite and the Playwright build. The query flag does nothing on the public console. */
export function isE2eAuthBypass() {
  if (import.meta.env.VITE_E2E_AUTH_BYPASS === 'true') {
    return true
  }
  if (!isLocalConsoleHost()) return false
  return new URLSearchParams(window.location.search).get('e2eAuthBypass') === 'true'
}
