import axios from 'axios'
import { getDeviceApiBaseUrl } from '../../config/runtime'

const deviceApi = axios.create({
  baseURL: getDeviceApiBaseUrl(),
  timeout: 5000,
})

let _authToken = null
let _refreshCallback = null
let _loginCallback = null

export function setAuthToken(token) {
  _authToken = token
}

export function clearAuthToken() {
  _authToken = null
}

export function setRefreshCallback(fn) {
  _refreshCallback = fn
}

export function setLoginCallback(fn) {
  _loginCallback = fn
}

deviceApi.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`
  }
  return config
})

deviceApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._authRetried && _refreshCallback) {
      original._authRetried = true
      const refreshed = await _refreshCallback()
      if (refreshed && _authToken) {
        original.headers.Authorization = `Bearer ${_authToken}`
        return deviceApi(original)
      }
      if (_loginCallback) {
        _loginCallback()
      }
    }
    return Promise.reject(error)
  },
)

export default deviceApi

export async function getAuthInfo() {
  try {
    const response = await axios.get(`${getDeviceApiBaseUrl()}/auth/info`, { timeout: 2000 })
    return { data: response.data, error: null }
  } catch (err) {
    return { data: null, error: err.message || 'Device auth info unavailable' }
  }
}
