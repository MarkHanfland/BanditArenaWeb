import deviceApi from './client'

export async function getServicesStatus() {
  try {
    const response = await deviceApi.get('/services/status')
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}

export async function restartService(serviceName) {
  try {
    const response = await deviceApi.post('/services/restart', { serviceName })
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}

export async function stopService(serviceName) {
  try {
    const response = await deviceApi.post('/services/stop', { serviceName })
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}

export async function startService(serviceName) {
  try {
    const response = await deviceApi.post('/services/start', { serviceName })
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}
