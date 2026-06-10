export function isE2eAuthBypass() {
  if (import.meta.env.VITE_E2E_AUTH_BYPASS === 'true') {
    return true
  }

  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get('e2eAuthBypass') === 'true'
  }

  return false
}
