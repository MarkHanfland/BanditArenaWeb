import axios from 'axios'

import { getCloudApiBaseUrl } from '../../config/runtime'

import { isE2eAuthBypass } from '../../auth/e2eAuth'



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

  } else if (isE2eAuthBypass()) {

    delete config.headers.Authorization

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



export async function getTenantMe() {

  return request(() => cloudApi.get('/tenants/me'))

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



export async function checkEntitlement(payload) {

  return request(() => cloudApi.post('/entitlements/check', payload))

}



export async function listMedia() {

  return request(() => cloudApi.get('/media'))

}



export async function publishMedia(payload) {

  return request(() => cloudApi.post('/media', payload))

}



export async function listProducts() {

  return request(() => cloudApi.get('/products'))

}



export async function listProductInstances() {

  return request(() => cloudApi.get('/product-instances'))

}



export async function registerProductInstance(payload) {

  return request(() => cloudApi.post('/product-instances', payload))

}



export async function provisionDevice(payload) {

  return request(() => cloudApi.post('/devices/provision', payload))

}



export async function activateDevice(deviceId, payload = {}) {

  return request(() => cloudApi.post(`/devices/${deviceId}/activate`, payload))

}



export async function decommissionDevice(deviceId, payload = {}) {

  return request(() => cloudApi.post(`/devices/${deviceId}/decommission`, payload))

}



export async function transferDevice(deviceId, payload = {}) {

  return request(() => cloudApi.post(`/devices/${deviceId}/transfer`, payload))

}



export async function getModelInventoryPreset(productId) {

  return request(() => cloudApi.get(`/products/${productId}/inventory-preset`))

}



export async function getDeviceInventory(deviceId) {

  return request(() => cloudApi.get(`/devices/${deviceId}/inventory`))

}



export async function listDeviceMaintenance(deviceId) {

  return request(() => cloudApi.get(`/devices/${deviceId}/maintenance`))

}



export async function createDeviceMaintenance(deviceId, payload) {

  return request(() => cloudApi.post(`/devices/${deviceId}/maintenance`, payload))

}



export async function getProductComponents(productId) {

  return request(() => cloudApi.get(`/products/${productId}/components`))

}



export async function createSession(payload) {

  return request(() => cloudApi.post('/sessions', payload))

}



export async function checkUpdates(params) {

  return request(() => cloudApi.get('/updates/check', { params }))

}



export async function listLicenses() {

  return request(() => cloudApi.get('/licenses'))

}



export async function issueLicense(payload) {

  return request(() => cloudApi.post('/licenses', payload))

}



export async function assignLicense(licenseId, payload) {

  return request(() => cloudApi.post(`/licenses/${licenseId}/assign`, payload))

}



export async function revokeLicense(licenseId, payload = {}) {

  return request(() => cloudApi.post(`/licenses/${licenseId}/revoke`, payload))

}



export async function checkDeviceEntitlement(deviceId, payload = {}) {

  return request(() => cloudApi.post(`/devices/${deviceId}/entitlements/check`, payload))

}



export async function createUpdateDownloadToken(payload) {

  return request(() => cloudApi.post('/updates/download-token', payload))

}



export async function acknowledgeUpdate(payload) {

  return request(() => cloudApi.post('/updates/ack', payload))

}



export async function listReservations() {

  return request(() => cloudApi.get('/reservations'))

}



export async function bookReservation(payload) {

  return request(() => cloudApi.post('/reservations', payload))

}



export async function sendNotification(payload) {

  return request(() => cloudApi.post('/notifications/send', payload))

}



export async function getAnalyticsSummary() {

  return request(() => cloudApi.get('/analytics/summary'))

}


