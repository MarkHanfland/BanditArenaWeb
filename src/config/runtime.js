const CLOUD_HOSTS = new Set(['banditarena.com', 'www.banditarena.com'])

export function isCloudDeployment() {
  if (import.meta.env.VITE_APP_MODE === 'cloud') {
    return true
  }
  if (import.meta.env.VITE_APP_MODE === 'device') {
    return false
  }
  if (typeof window === 'undefined') {
    return false
  }
  return CLOUD_HOSTS.has(window.location.hostname)
}

export function getDeviceApiBaseUrl() {
  const configured = import.meta.env.VITE_DEVICE_API_URL
  if (configured) {
    return configured.replace(/\/$/, '')
  }
  if (isCloudDeployment()) {
    return 'http://localhost:8080'
  }
  return window.location.origin
}

export function getCloudApiBaseUrl() {
  const configured = import.meta.env.VITE_CLOUD_API_URL
  if (configured) {
    return configured.replace(/\/$/, '')
  }
  return '/api'
}
