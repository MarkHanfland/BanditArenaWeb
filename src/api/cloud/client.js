import axios from 'axios'

import { getCloudApiBaseUrl } from '../../config/runtime'

import { isE2eAuthBypass } from '../../auth/e2eAuth'



const cloudApi = axios.create({

  baseURL: getCloudApiBaseUrl(),

  timeout: 10000,

})



let _authToken = null
let _tenantId = null



export function setCloudAuthToken(token) {

  _authToken = token

  if (token) {

    cloudApi.defaults.headers.common.Authorization = `Bearer ${token}`

  } else {

    delete cloudApi.defaults.headers.common.Authorization

  }

}



export function setCloudTenantId(tenantId) {

  _tenantId = tenantId || null

  if (_tenantId) {

    cloudApi.defaults.headers.common['X-Bandit-Tenant-Id'] = _tenantId

  } else {

    delete cloudApi.defaults.headers.common['X-Bandit-Tenant-Id']

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

  if (_tenantId) {

    config.headers['X-Bandit-Tenant-Id'] = _tenantId

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



export async function updateMedia(mediaId, payload) {

  return request(() => cloudApi.patch(`/media/${mediaId}`, payload))

}



export async function deleteMedia(mediaId) {

  return request(() => cloudApi.delete(`/media/${mediaId}`))

}



export async function unpublishMedia(mediaId) {

  return request(() => cloudApi.post(`/media/${mediaId}/unpublish`))

}



export async function republishMedia(mediaId, payload = {}) {

  return request(() => cloudApi.post(`/media/${mediaId}/publish`, payload))

}



export async function createMediaAssetUploadToken(mediaId, payload) {

  return request(() => cloudApi.post(`/media/${mediaId}/asset-upload-token`, payload))

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



export async function updateEnrollmentState(userId, payload) {

  return request(() => cloudApi.patch(`/users/${userId}/enrollment`, payload))

}



export async function listVenues() {

  return request(() => cloudApi.get('/venues'))

}



export async function createVenue(payload) {

  return request(() => cloudApi.post('/venues', payload))

}



export async function patchVenue(venueId, payload) {

  return request(() => cloudApi.patch(`/venues/${venueId}`, payload))

}



export async function deactivateVenue(venueId) {

  return request(() => cloudApi.delete(`/venues/${venueId}`))

}



export async function listTenants() {

  return request(() => cloudApi.get('/tenants'))

}



export async function createTenant(payload) {

  return request(() => cloudApi.post('/tenants', payload))

}



export async function patchTenant(tenantId, payload) {

  return request(() => cloudApi.patch(`/tenants/${tenantId}`, payload))

}



export async function deactivateTenant(tenantId) {

  return request(() => cloudApi.delete(`/tenants/${tenantId}`))

}



export async function listCustomers() {

  return request(() => cloudApi.get('/customers'))

}



export async function createCustomer(payload) {

  return request(() => cloudApi.post('/customers', payload))

}



export async function patchCustomer(customerId, payload) {

  return request(() => cloudApi.patch(`/customers/${customerId}`, payload))

}



export async function deactivateCustomer(customerId) {

  return request(() => cloudApi.delete(`/customers/${customerId}`))

}



export async function listVenueRoles(venueId) {

  return request(() => cloudApi.get(`/venues/${venueId}/roles`))

}



export async function assignVenueRole(venueId, payload) {

  return request(() => cloudApi.post(`/venues/${venueId}/roles`, payload))

}



export async function unassignVenueRole(venueId, assignmentId) {

  return request(() => cloudApi.delete(`/venues/${venueId}/roles/${assignmentId}`))

}



export async function listLicensePlans() {

  return request(() => cloudApi.get('/license-plans'))

}



export async function renewLicense(licenseId, payload = {}) {

  return request(() => cloudApi.post(`/licenses/${licenseId}/renew`, payload))

}


