import deviceApi from './client'

/**
 * Apply Camera Simulator mode for test media (writes override; starts/stops process).
 * Prefer session start/end — the console applies mode only when a session starts.
 */
export async function applyCameraSimulatorMediaMode({
  mediaId,
  testMedia = false,
  simulationMode = 'random',
  deterministicConfig = '',
} = {}) {
  try {
    const response = await deviceApi.post('/camera-simulator/media-mode', {
      mediaId: mediaId || '',
      testMedia: Boolean(testMedia),
      simulationMode: simulationMode || 'random',
      deterministicConfig: deterministicConfig || '',
    })
    return { data: response.data, error: null }
  } catch (error) {
    return {
      data: null,
      error: error.response?.data?.error || error.message || 'Failed to apply simulator mode',
    }
  }
}
