import test from 'node:test'
import assert from 'node:assert/strict'
import { jwtExpiryMs, recoverExpiredSession, sessionNeedsSignIn } from './expiredSession.js'

function token(exp, parts = 3) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url')
  if (parts === 2) return `${payload}.sig`
  return `header.${payload}.sig`
}

test('AUTH-009: an expired staff or player token needs sign-in', () => {
  const past = Math.floor(Date.now() / 1000) - 60
  const future = Math.floor(Date.now() / 1000) + 3600
  assert.equal(sessionNeedsSignIn(token(past)), true)
  assert.equal(sessionNeedsSignIn(token(future)), false)
  assert.equal(sessionNeedsSignIn(token(new Date(Date.now() - 1000).toISOString(), 2)), true)
  assert.equal(sessionNeedsSignIn('__bandit_local_auth_bypass__'), false)
  assert.ok(jwtExpiryMs(token(future)) > Date.now())
})

test('AUTH-009: a rejected session refreshes once, then returns to sign-in', async () => {
  assert.equal(await recoverExpiredSession({ status: 200, alreadyRetried: false, refresh: async () => false, signedIn: () => false }), 'stay')
  assert.equal(await recoverExpiredSession({ status: 401, alreadyRetried: true, refresh: async () => true, signedIn: () => true }), 'stay')
  let calls = 0
  assert.equal(await recoverExpiredSession({
    status: 401,
    alreadyRetried: false,
    refresh: async () => {
      calls += 1
      return true
    },
    signedIn: () => true,
  }), 'retry')
  assert.equal(calls, 1)
  assert.equal(await recoverExpiredSession({
    status: 401,
    alreadyRetried: false,
    refresh: async () => false,
    signedIn: () => false,
  }), 'sign-in')
})
