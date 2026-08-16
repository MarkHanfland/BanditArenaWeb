export {
  setAuthToken,
  clearAuthToken,
  setRefreshCallback,
  setLoginCallback,
  getAuthInfo,
} from './client'

export { getConfig, updateConfig } from './config'
export { getServicesStatus, restartService, stopService, startService } from './services'
export { getErrorEvents, getSafetyEvents } from './events'
export {
  triggerSafetyStop,
  triggerSafetyStart,
  getTelemetryCurrent,
  getTelemetryHistory,
  getTelemetryStats,
  getTelemetryConfig,
  pingDevice,
  getCurrentSession,
  startSession,
  endSession,
} from './treadmill'
export { applyCameraSimulatorMediaMode } from './cameraSimulator'
