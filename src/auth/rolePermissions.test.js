import test from 'node:test'
import assert from 'node:assert/strict'
import { cloudCapabilities, deriveUserRole, getAllowedMenuIds } from './rolePermissions.js'

const as = (...groups) => ({ groups })
const menus = (...groups) => new Set(getAllowedMenuIds(as(...groups)))

// FR-SW-UI-014: each role in the FR-SW-AUTH-001 table sees only its permitted menus.
test('Front Desk sees reservations and Player lookup only', () => {
  assert.deepEqual([...menus('bandit-front-desk')].sort(), ['reservations', 'users'])
})

test('Billing Admin sees billing only', () => {
  assert.deepEqual([...menus('bandit-billing-admin')], ['billing'])
})

test('Account Owner sees venue pages and billing, but no fleet pages', () => {
  const m = menus('bandit-account-owner')
  for (const id of ['reservations', 'users', 'staff', 'sessions', 'media', 'billing', 'usage']) {
    assert.ok(m.has(id), `account owner sees ${id}`)
  }
  for (const id of ['fleet', 'diagnostics', 'support', 'accounts']) {
    assert.ok(!m.has(id), `account owner does not see ${id}`)
  }
})

test('Venue Administrator sees device and venue pages, no billing or fleet', () => {
  const m = menus('bandit-venue-admin')
  assert.ok(m.has('dashboard') && m.has('reservations') && m.has('staff'))
  assert.ok(!m.has('billing') && !m.has('fleet') && !m.has('accounts'))
})

test('Technician and Fleet Administrator see fleet pages, no business pages', () => {
  const tech = menus('bandit-technician')
  assert.ok(tech.has('support') && tech.has('diagnostics') && !tech.has('reservations'))
  const fleet = menus('bandit-fleet-admin')
  assert.ok(fleet.has('fleet') && !fleet.has('reservations') && !fleet.has('staff'))
})

test('Operator sees only the local device pages', () => {
  assert.deepEqual([...menus('bandit-operator')].sort(), ['dashboard', 'events', 'treadmill'])
})

test('a staff member with several roles sees the union', () => {
  const m = menus('bandit-front-desk', 'bandit-technician')
  assert.ok(m.has('reservations') && m.has('support'))
  assert.equal(deriveUserRole(as('bandit-front-desk', 'bandit-technician')), 'front-desk')
})

test('capabilities follow the ownership chains', () => {
  const owner = cloudCapabilities(as('bandit-account-owner'))
  assert.ok(owner.accountOwner && owner.venueAdmin && owner.billingAdmin && owner.frontDesk)
  assert.ok(!owner.fleetAdmin && !owner.technician)
  const billing = cloudCapabilities(as('bandit-billing-admin'))
  assert.ok(billing.billingAdmin && !billing.venueAdmin && !billing.frontDesk)
  const desk = cloudCapabilities(as('bandit-front-desk'))
  assert.ok(desk.frontDesk && !desk.venueAdmin)
})
