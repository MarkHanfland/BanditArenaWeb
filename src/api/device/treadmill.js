import deviceApi from './client'

export async function triggerSafetyStop() {
  try {
    const response = await deviceApi.post('/safety/stop')
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}

export async function triggerSafetyStart() {
  try {
    const response = await deviceApi.post('/safety/start')
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}

export async function getTelemetryCurrent() {
  try {
    const response = await deviceApi.get('/telemetry/current')
    if (response.status === 204 || !response.data) {
      return { data: null, error: null, noContent: true }
    }
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}

export async function getTelemetryHistory(count = 0, compact = false) {
  try {
    const params = new URLSearchParams()
    if (count > 0) params.append('count', count)
    if (compact) params.append('compact', 'true')
    const response = await deviceApi.get(`/telemetry/history?${params.toString()}`)
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}

export async function getTelemetryStats() {
  try {
    const response = await deviceApi.get('/telemetry/stats')
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}

export async function getTelemetryConfig() {
  try {
    const response = await deviceApi.get('/telemetry/config')
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}

export async function pingDevice() {
  try {
    await deviceApi.get('/config', { timeout: 2000 })
    return true
  } catch {
    return false
  }
}
