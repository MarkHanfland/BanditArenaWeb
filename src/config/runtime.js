const CLOUD_HOSTS = new Set(['banditarena.com', 'www.banditarena.com'])
const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1'])

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

/** True when running the Vite dev server (BanditArenaWeb Start Local). */
export function isLocalWebDev() {
  if (import.meta.env.DEV) {
    return true
  }
  if (typeof window === 'undefined') {
    return false
  }
  return LOCAL_DEV_HOSTS.has(window.location.hostname)
}

export function getDeviceApiBaseUrl() {
  const configured = import.meta.env.VITE_DEVICE_API_URL
  if (configured) {
    return configured.replace(/\/$/, '')
  }
  if (isCloudDeployment()) {
    return 'http://localhost:9724'
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
