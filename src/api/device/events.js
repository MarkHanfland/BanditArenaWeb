import deviceApi from './client'

export async function getErrorEvents() {
  try {
    const response = await deviceApi.get('/events/errors')
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}

export async function getSafetyEvents() {
  try {
    const response = await deviceApi.get('/events/safety')
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message,
    }
  }
}
