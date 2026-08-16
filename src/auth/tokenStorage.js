import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito'
import { sessionStorage as amplifySessionStorage } from 'aws-amplify/utils'

/**
 * Tab-scoped Cognito token store (FR-SW-ADMIN-004):
 * - refresh / identity metadata → sessionStorage (cleared on tab close; not shared with new tabs)
 * - access + id tokens → in-memory only (survives neither tab close nor hard reload until refresh)
 */
class MemoryAccessSessionStorage {
  #memory = new Map()

  #isEphemeral(key) {
    return typeof key === 'string' && (key.includes('.accessToken') || key.includes('.idToken'))
  }

  async setItem(key, value) {
    if (this.#isEphemeral(key)) {
      this.#memory.set(key, value)
      return
    }
    await amplifySessionStorage.setItem(key, value)
  }

  async getItem(key) {
    if (this.#isEphemeral(key)) {
      return this.#memory.has(key) ? this.#memory.get(key) : null
    }
    return amplifySessionStorage.getItem(key)
  }

  async removeItem(key) {
    this.#memory.delete(key)
    await amplifySessionStorage.removeItem(key)
  }

  async clear() {
    this.#memory.clear()
    await amplifySessionStorage.clear()
  }
}

/** Remove Amplify Cognito keys left in localStorage from older builds. */
export function clearLegacyAmplifyLocalStorageTokens() {
  if (typeof localStorage === 'undefined') {
    return
  }

  const toRemove = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (
      key &&
      (key.includes('CognitoIdentityServiceProvider') || key.startsWith('amplify-'))
    ) {
      toRemove.push(key)
    }
  }
  toRemove.forEach((key) => localStorage.removeItem(key))
}

export function configureTabScopedTokenStorage() {
  clearLegacyAmplifyLocalStorageTokens()
  cognitoUserPoolsTokenProvider.setKeyValueStorage(new MemoryAccessSessionStorage())
}
