import deviceApi from './client'

export async function getConfig() {
  try {
    const response = await deviceApi.get('/config')
    return { data: response.data, error: null, status: response.status }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
      status: error.response?.status,
    }
  }
}

export async function updateConfig(payload) {
  try {
    const response = await deviceApi.put('/config', payload)
    return { data: response.data, error: null, status: response.status }
  } catch (error) {
    return {
      data: error.response?.data || null,
      error: error.response?.data?.error || error.message,
      status: error.response?.status,
    }
  }
}
