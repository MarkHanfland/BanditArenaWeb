import test from 'node:test'
import assert from 'node:assert/strict'
import { canOperateDevice, cloudCapabilities, deriveUserRole, getAllowedMenuIds, landingMenuId } from './rolePermissions.js'

const as = (...groups) => ({ groups })
const menus = (...groups) => new Set(getAllowedMenuIds(as(...groups)))

// FR-SW-UI-014: each role in the FR-SW-AUTH-001 table sees only its permitted menus.
test('Front Desk sees reservations, Player lookup, and incidents only', () => {
  assert.deepEqual([...menus('bandit-front-desk')].sort(), ['incidents', 'reservations', 'users'])
  assert.ok(!menus('bandit-front-desk').has('venue-hours'))
  assert.ok(!menus('bandit-front-desk').has('audit'))
  assert.ok(!menus('bandit-front-desk').has('notifications'))
})

test('Billing Admin sees billing only', () => {
  assert.deepEqual([...menus('bandit-billing-admin')], ['billing'])
})

test('Account Owner sees venue pages, billing, incidents and audit, but no fleet pages', () => {
  const m = menus('bandit-account-owner')
  for (const id of ['reservations', 'users', 'staff', 'sessions', 'media', 'billing', 'usage', 'incidents', 'audit']) {
    assert.ok(m.has(id), `account owner sees ${id}`)
  }
  for (const id of ['fleet', 'diagnostics', 'support', 'accounts']) {
    assert.ok(!m.has(id), `account owner does not see ${id}`)
  }
})

test('Venue Administrator sees device and venue pages, no billing or fleet', () => {
  const m = menus('bandit-venue-admin')
  assert.ok(m.has('dashboard') && m.has('reservations') && m.has('staff') && m.has('venue-hours'))
  assert.ok(!m.has('billing') && !m.has('fleet') && !m.has('accounts'))
})

test('Technician and Fleet Administrator see fleet pages, no business pages', () => {
  const tech = menus('bandit-technician')
  assert.ok(tech.has('support') && tech.has('diagnostics') && !tech.has('reservations'))
  const fleet = menus('bandit-fleet-admin')
  assert.ok(fleet.has('fleet') && !fleet.has('reservations') && !fleet.has('staff'))
  assert.ok(!fleet.has('audit'), 'Fleet Administrator cannot call the audit trail')
})

test('Organization Admin, Instructor and Support Agent see only their own chrome', () => {
  assert.deepEqual([...menus('bandit-org-admin')], ['organizations'])
  assert.deepEqual([...menus('bandit-instructor')], ['cohorts'])
  assert.deepEqual([...menus('bandit-support')], [])
})

test('Operator sees only the local device pages', () => {
  assert.deepEqual([...menus('bandit-operator')].sort(), ['dashboard', 'events', 'treadmill'])
})

test('a staff member with several roles sees the union', () => {
  const m = menus('bandit-front-desk', 'bandit-technician')
  assert.ok(m.has('reservations') && m.has('support'))
  assert.equal(deriveUserRole(as('bandit-front-desk', 'bandit-technician')), 'front-desk')
})

// PM review (UI-014): device chrome (status band, Safety Stop) only for roles with a Local Device menu.
test('device chrome is limited to roles that have a Local Device menu', () => {
  for (const group of ['bandit-operator', 'bandit-venue-admin', 'bandit-technician', 'bandit-fleet-admin', 'bandit-cloud-admin']) {
    assert.ok(canOperateDevice(as(group)), `${group} sees device chrome`)
  }
  for (const group of ['bandit-front-desk', 'bandit-account-owner', 'bandit-billing-admin', 'bandit-developer', 'bandit-org-admin', 'bandit-instructor', 'bandit-support']) {
    assert.ok(!canOperateDevice(as(group)), `${group} does not see device chrome`)
  }
  assert.ok(canOperateDevice(as('bandit-front-desk', 'bandit-operator')), 'a union of roles keeps device chrome')
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

// FR-SW-UI-018: each role lands on the first page of its job.
test('each role lands on the page its job needs', () => {
  const landing = {
    'bandit-operator': 'dashboard',
    'bandit-venue-admin': 'dashboard',
    'bandit-cloud-admin': 'dashboard',
    'bandit-front-desk': 'reservations',
    'bandit-account-owner': 'reservations',
    'bandit-billing-admin': 'billing',
    'bandit-fleet-admin': 'fleet',
  }
  for (const [group, page] of Object.entries(landing)) {
    assert.equal(landingMenuId(as(group)), page, group + ' lands on ' + page)
  }
})

test('a Technician lands on the first page that exists while Support is not built', () => {
  assert.equal(landingMenuId(as('bandit-technician')), 'dashboard')
})

test('the primary role decides the landing for a user with several roles', () => {
  assert.equal(landingMenuId(as('bandit-front-desk', 'bandit-technician')), 'reservations')
  assert.equal(landingMenuId(as('bandit-fleet-admin', 'bandit-front-desk')), 'fleet')
})