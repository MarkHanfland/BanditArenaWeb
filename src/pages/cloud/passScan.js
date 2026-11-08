/** FR-SW-UI-015: Front Desk reads a live Player pass from a camera, a photo, or typed text. */

export const PASS_PREFIX = 'bandit-pass:'

export function normalizePassPayload(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  const tagged = text.match(/bandit-pass:[^\s]+/i)
  if (tagged) return tagged[0]
  return text
}

export function isBanditPassPayload(value) {
  return /^bandit-pass:/i.test(String(value || '').trim())
}

/**
 * Prefer a tagged Bandit pass over other barcodes in the same frame (a URL on a
 * poster, a caption, a cached Apple Wallet chrome barcode).
 */
export function pickPassFromBarcodes(barcodes = []) {
  const values = (Array.isArray(barcodes) ? barcodes : [])
    .map((item) => (typeof item === 'string' ? item : item?.rawValue))
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  const tagged = values.find((value) => /bandit-pass:/i.test(value))
  if (tagged) return normalizePassPayload(tagged)
  const token = values.find((value) => value.length >= 16 && !/\s/.test(value) && !/^https?:/i.test(value))
  return token || values[0] || ''
}

export function barcodeDetectorSupported(globalObj = globalThis) {
  return typeof globalObj?.BarcodeDetector === 'function'
}

export async function detectPassFromSource(source, Detector = globalThis.BarcodeDetector) {
  if (!source || typeof Detector !== 'function') return ''
  const detector = new Detector({ formats: ['qr_code'] })
  const barcodes = await detector.detect(source)
  return pickPassFromBarcodes(barcodes)
}

export async function detectPassFromImageFile(file, options = {}) {
  const Detector = options.BarcodeDetector || globalThis.BarcodeDetector
  const createImageBitmap = options.createImageBitmap || globalThis.createImageBitmap
  if (!file || typeof Detector !== 'function' || typeof createImageBitmap !== 'function') return ''
  const bitmap = await createImageBitmap(file)
  try {
    return await detectPassFromSource(bitmap, Detector)
  } finally {
    if (typeof bitmap.close === 'function') bitmap.close()
  }
}
