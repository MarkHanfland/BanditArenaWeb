import test from 'node:test'
import assert from 'node:assert/strict'
import { landingMenuId } from '../../auth/rolePermissions.js'

const as = (...groups) => ({ groups })

test('FR-SW-UI-018: Account Owner lands on Onboarding until the checklist is complete', () => {
  assert.equal(landingMenuId(as('bandit-account-owner')), 'onboarding')
  assert.equal(landingMenuId(as('bandit-account-owner'), { onboardingComplete: false }), 'onboarding')
  assert.equal(landingMenuId(as('bandit-account-owner'), { onboardingComplete: true }), 'reservations')
})
