import test from 'node:test'
import assert from 'node:assert/strict'
import {
  barcodeDetectorSupported,
  detectPassFromImageFile,
  detectPassFromSource,
  isBanditPassPayload,
  normalizePassPayload,
  pickPassFromBarcodes,
} from './passScan.js'

test('FR-SW-UI-015: a tagged pass is kept even when the scanner wraps it in other text', () => {
  assert.equal(normalizePassPayload('  bandit-pass:abc.def  '), 'bandit-pass:abc.def')
  assert.equal(
    normalizePassPayload('Player pass\nbandit-pass:live-token-1 extra'),
    'bandit-pass:live-token-1',
  )
  assert.equal(normalizePassPayload('typed-code-only'), 'typed-code-only')
  assert.equal(normalizePassPayload(''), '')
  assert.equal(normalizePassPayload(null), '')
})

test('FR-SW-UI-015: a Bandit pass is preferred over a URL or caption in the same frame', () => {
  assert.equal(
    pickPassFromBarcodes([
      { rawValue: 'https://play.banditarena.com' },
      { rawValue: 'bandit-pass:live-from-phone' },
      'HOLD THIS PASS',
    ]),
    'bandit-pass:live-from-phone',
  )
  assert.equal(
    pickPassFromBarcodes(['https://example.com', 'a-dense-token-value-16']),
    'a-dense-token-value-16',
  )
  assert.equal(pickPassFromBarcodes(['short']), 'short')
  assert.equal(pickPassFromBarcodes([]), '')
  assert.equal(pickPassFromBarcodes(undefined), '')
  assert.equal(pickPassFromBarcodes(['  bandit-pass:wrapped  ']), 'bandit-pass:wrapped')
})

test('FR-SW-UI-015: a tagged payload is recognized case-insensitively', () => {
  assert.equal(isBanditPassPayload('bandit-pass:x'), true)
  assert.equal(isBanditPassPayload('BANDIT-PASS:x'), true)
  assert.equal(isBanditPassPayload('not-a-pass'), false)
})

test('barcodeDetectorSupported follows the host BarcodeDetector', () => {
  assert.equal(barcodeDetectorSupported({}), false)
  assert.equal(barcodeDetectorSupported({ BarcodeDetector: function Detector() {} }), true)
})

test('detectPassFromSource returns the tagged pass the detector saw', async () => {
  class Detector {
    constructor(options) {
      this.options = options
    }
    async detect() {
      return [{ rawValue: 'https://wallet.example' }, { rawValue: 'bandit-pass:from-video' }]
    }
  }
  const payload = await detectPassFromSource({ tag: 'video' }, Detector)
  assert.equal(payload, 'bandit-pass:from-video')
})

test('detectPassFromSource is empty when the detector or the frame is missing', async () => {
  assert.equal(await detectPassFromSource(null, class Detector { async detect() { return [{ rawValue: 'x' }] } }), '')
  assert.equal(await detectPassFromSource({}), '')
})

test('detectPassFromImageFile reads a photo through BarcodeDetector and closes the bitmap', async () => {
  let closed = false
  class Detector {
    async detect(source) {
      assert.equal(source.label, 'bitmap')
      return [{ rawValue: 'bandit-pass:from-photo' }]
    }
  }
  const payload = await detectPassFromImageFile({ name: 'pass.jpg' }, {
    BarcodeDetector: Detector,
    createImageBitmap: async () => ({
      label: 'bitmap',
      close() { closed = true },
    }),
  })
  assert.equal(payload, 'bandit-pass:from-photo')
  assert.equal(closed, true)
})

test('detectPassFromImageFile is empty without a detector', async () => {
  assert.equal(await detectPassFromImageFile({ name: 'pass.jpg' }, { BarcodeDetector: undefined, createImageBitmap: async () => ({}) }), '')
  assert.equal(await detectPassFromImageFile(null, { BarcodeDetector: class { async detect() { return [] } } }), '')
})
