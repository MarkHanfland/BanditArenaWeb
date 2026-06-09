import axios from 'axios'
import { getCloudApiBaseUrl } from '../../config/runtime'

const cloudApi = axios.create({
  baseURL: getCloudApiBaseUrl(),
  timeout: 10000,
})

let _authToken = null

export function setCloudAuthToken(token) {
  _authToken = token
  if (token) {
    cloudApi.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete cloudApi.defaults.headers.common.Authorization
  }
}

export function clearCloudAuthToken() {
  _authToken = null
  delete cloudApi.defaults.headers.common.Authorization
}

cloudApi.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`
  }
  return config
})

export default cloudApi

async function request(promiseFactory) {
  try {
    const response = await promiseFactory()
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.message || error.response?.data?.error || error.message,
    }
  }
}

export async function listUsers() {
  return request(() => cloudApi.get('/users'))
}

export async function createUser(payload) {
  return request(() => cloudApi.post('/users', payload))
}

export async function getUser(userId) {
  return request(() => cloudApi.get(`/users/${userId}`))
}

export async function listUserSessions(userId) {
  return request(() => cloudApi.get(`/users/${userId}/sessions`))
}

export async function listMedia() {
  return request(() => cloudApi.get('/media'))
}

export async function listProducts() {
  return request(() => cloudApi.get('/products'))
}

export async function listProductInstances() {
  return request(() => cloudApi.get('/product-instances'))
}

export async function getProductComponents(productId) {
  return request(() => cloudApi.get(`/products/${productId}/components`))
}

export async function createSession(payload) {
  return request(() => cloudApi.post('/sessions', payload))
}
