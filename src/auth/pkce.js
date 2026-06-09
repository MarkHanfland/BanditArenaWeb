/**
 * PKCE (Proof Key for Code Exchange) helpers for OAuth2 Authorization Code Flow.
 * Uses the native WebCrypto API — no external dependencies.
 */

/** Generate a cryptographically random code verifier string (43–128 chars, URL-safe). */
export function generateCodeVerifier() {
  const array = new Uint8Array(64)
  window.crypto.getRandomValues(array)
  return base64urlEncode(array)
}

/**
 * Derive the S256 code challenge from a verifier.
 * @param {string} verifier
 * @returns {Promise<string>} base64url-encoded SHA-256 hash
 */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  return base64urlEncode(new Uint8Array(digest))
}

/** Encode a Uint8Array to base64url (no padding, URL-safe alphabet). */
function base64urlEncode(buffer) {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Generate a random state string for CSRF protection. */
export function generateState() {
  const array = new Uint8Array(16)
  window.crypto.getRandomValues(array)
  return base64urlEncode(array)
}
