const listeners = new Set()
let current = null

export function reportPageError(notice) {
  current = notice && notice.message
    ? { code: String(notice.code || 'REQUEST_FAILED'), message: String(notice.message) }
    : null
  listeners.forEach((listener) => listener(current))
}

export function clearPageError() {
  reportPageError(null)
}

export function subscribePageError(listener) {
  listeners.add(listener)
  listener(current)
  return () => listeners.delete(listener)
}

export function noticeFromAxios(error) {
  const status = error?.response?.status
  const data = error?.response?.data
  return {
    code: data?.code || (status ? `HTTP_${status}` : 'NETWORK'),
    message: data?.error || data?.message || error?.message || 'The request could not be completed.',
  }
}
