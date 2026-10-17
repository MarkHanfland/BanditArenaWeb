import axios from 'axios'
import { attachSessionRecovery } from '../../auth/expiredSession'
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

attachSessionRecovery(deviceApi, {
  refresh: () => (_refreshCallback ? _refreshCallback() : false),
  signedIn: () => Boolean(_authToken),
  onSignIn: () => {
    if (_loginCallback) _loginCallback()
  },
  applyAuthorization: (config) => {
    config.headers.Authorization = `Bearer ${_authToken}`
  },
})

export default deviceApi

export async function getAuthInfo() {
  try {
    const response = await axios.get(`${getDeviceApiBaseUrl()}/auth/info`, { timeout: 2000 })
    return { data: response.data, error: null }
  } catch (err) {
    return { data: null, error: err.message || 'Device auth info unavailable' }
  }
}
