import test from 'node:test'
import assert from 'node:assert/strict'
import { nextOpenSlot, playerStatus } from './frontDesk.js'

// FR-SW-UI-018: the front desk sees each Player's status, and a walk-in goes to the next open time.

test('FR-SW-UI-018: a reservation shows booked, checked in, or no-show from its own status', () => {
  assert.equal(playerStatus({ slotId: 's1', status: 'booked' }), 'Booked')
  assert.equal(playerStatus({ slotId: 's1', status: 'checked_in' }), 'Checked in')
  assert.equal(playerStatus({ slotId: 's1', status: 'no_show' }), 'No-show')
  assert.equal(playerStatus({ slotId: 's1', status: 'available' }), '')
  assert.equal(playerStatus(undefined), '')
})

test('FR-SW-UI-018: playing and finished come from the session that carries the reservation', () => {
  const reservation = { slotId: 's1', status: 'checked_in' }
  assert.equal(playerStatus(reservation, [{ reservationId: 's1', status: 'active' }]), 'Playing')
  assert.equal(playerStatus(reservation, [{ reservationId: 's1', status: 'completed' }]), 'Finished')
  assert.equal(playerStatus(reservation, [{ reservationId: 'other', status: 'active' }]), 'Checked in', 'another reservation\'s session does not count')
  assert.equal(playerStatus(reservation, [{ reservationId: null, status: 'active' }]), 'Checked in', 'a session with no reservation is not matched')
})

const half = (iso) => ({ startTime: iso, endTime: new Date(Date.parse(iso) + 30 * 60000).toISOString() })
const columns = ['10:00', '10:30', '11:00', '11:30'].map((t) => half(`2099-09-07T${t}:00.000Z`))
const machines = [{ instanceId: 'm1', displayName: 'Bay 1' }, { instanceId: 'm2', displayName: 'Bay 2' }]
const at = (t) => Date.parse(`2099-09-07T${t}:00.000Z`)

test('FR-SW-UI-018: a walk-in goes on the first machine at the first half hour that has not started', () => {
  const slot = nextOpenSlot(columns, machines, [], at('10:10'))
  assert.equal(slot.machineId, 'm1')
  assert.equal(slot.startTime, '2099-09-07T10:30:00.000Z', 'the 10:00 half hour has started')
  assert.equal(slot.endTime, '2099-09-07T11:00:00.000Z')
  assert.equal(slot.machineName, 'Bay 1')
})

test('FR-SW-UI-018: a walk-in takes the second machine when the first is booked, and a later time when both are', () => {
  const book = (resourceId, t) => ({ resourceId, ...half(`2099-09-07T${t}:00.000Z`) })
  assert.equal(nextOpenSlot(columns, machines, [book('m1', '10:30')], at('10:10')).machineId, 'm2')
  const both = [book('m1', '10:30'), book('m2', '10:30')]
  assert.equal(nextOpenSlot(columns, machines, both, at('10:10')).startTime, '2099-09-07T11:00:00.000Z')
})

test('FR-SW-UI-018: a booking that spans two half hours holds both', () => {
  const long = { resourceId: 'm1', startTime: '2099-09-07T10:30:00.000Z', endTime: '2099-09-07T11:30:00.000Z' }
  const one = [machines[0]]
  assert.equal(nextOpenSlot(columns, one, [long], at('10:10')).startTime, '2099-09-07T11:30:00.000Z')
})

test('FR-SW-UI-018: no walk-in slot is offered when the day is over or full', () => {
  assert.equal(nextOpenSlot(columns, machines, [], at('12:00')), null)
  assert.equal(nextOpenSlot([], machines, [], at('10:00')), null)
  assert.equal(nextOpenSlot(columns, [], [], at('10:00')), null)
})
