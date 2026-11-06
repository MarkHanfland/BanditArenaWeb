/**
 * Front Desk journey helpers (FR-SW-UI-018): what to show for each Player on the day's grid, and
 * where a walk-in goes. Plain functions so they are tested without the page.
 */

function overlaps(start, end, slotStart, slotEnd) {
  return Date.parse(start) < Date.parse(slotEnd) && Date.parse(end) > Date.parse(slotStart)
}

/**
 * What the front desk sees for a Player: booked, checked in, playing, finished, or no-show.
 * Playing and finished come from the session that carries the reservation.
 */
export function playerStatus(reservation, sessions = []) {
  const session = sessions.find((item) => item.reservationId && item.reservationId === reservation?.slotId)
  if (session?.status === 'active') return 'Playing'
  if (session?.status === 'completed') return 'Finished'
  switch (reservation?.status) {
    case 'checked_in': return 'Checked in'
    case 'no_show': return 'No-show'
    case 'booked': return 'Booked'
    default: return ''
  }
}

/**
 * The earliest open half hour that has not started, on any machine, or null. A walk-in goes
 * there; the cloud refuses a booking for a slot that has already started.
 */
export function nextOpenSlot(columns, machines, reservations, now = Date.now()) {
  const taken = (machineId, column) => reservations.some((item) => (
    item.resourceId === machineId && overlaps(item.startTime, item.endTime, column.startTime, column.endTime)
  ))
  for (const column of columns) {
    if (Date.parse(column.startTime) < now) continue
    const machine = machines.find((entry) => !taken(entry.instanceId, column))
    if (machine) return { machineId: machine.instanceId, machineName: machine.displayName || machine.instanceId, ...column }
  }
  return null
}
