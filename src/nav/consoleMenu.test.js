import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MENU_GROUP,
  MENU_PILLARS,
  MENU_LEAF_CATALOG,
  FUTURE_MENU_LEAVES,
  buildMenuGroups,
  findGroupIdForItem,
  firstCloudLanding,
  initialExpandedGroupIds,
  isMenuItemImplemented,
} from './consoleMenu.js'

test('pillars include Alpha and roadmap leaves', () => {
  const ops = MENU_PILLARS.find((p) => p.id === MENU_GROUP.OPERATIONS)
  const fleet = MENU_PILLARS.find((p) => p.id === MENU_GROUP.DEVICE_FLEET)
  const admin = MENU_PILLARS.find((p) => p.id === MENU_GROUP.ADMINISTRATION)
  assert.ok(ops.itemIds.includes('reservations'))
  assert.ok(ops.itemIds.includes('sessions'))
  assert.ok(fleet.itemIds.includes('fleet'))
  assert.ok(fleet.itemIds.includes('diagnostics'))
  assert.deepEqual(admin.itemIds, ['roles', 'integrations', 'branding', 'audit'])
})

test('initialExpandedGroupIds opens only Local when online', () => {
  assert.deepEqual([...initialExpandedGroupIds(true)], [MENU_GROUP.LOCAL])
  assert.deepEqual([...initialExpandedGroupIds(null)], [MENU_GROUP.LOCAL])
  assert.deepEqual([...initialExpandedGroupIds(false)], [])
})

test('buildMenuGroups includes Administration when roadmap leaves are provided', () => {
  const itemsById = Object.fromEntries(
    MENU_LEAF_CATALOG.map((leaf) => [leaf.id, { id: leaf.id, implemented: leaf.implemented }]),
  )
  const groups = buildMenuGroups(itemsById)
  assert.ok(groups.some((g) => g.id === MENU_GROUP.ADMINISTRATION))
  assert.equal(groups.find((g) => g.id === MENU_GROUP.ADMINISTRATION).items.length, 4)
})

test('firstCloudLanding skips unimplemented leaves', () => {
  const groups = [
    {
      id: MENU_GROUP.LOCAL,
      items: [{ id: 'dashboard', implemented: true }],
    },
    {
      id: MENU_GROUP.OPERATIONS,
      items: [
        { id: 'sessions', implemented: false },
        { id: 'users', implemented: true },
      ],
    },
  ]
  assert.deepEqual(firstCloudLanding(groups), {
    groupId: MENU_GROUP.OPERATIONS,
    itemId: 'users',
  })
  assert.equal(findGroupIdForItem(groups, 'users'), MENU_GROUP.OPERATIONS)
})

test('FUTURE_MENU_LEAVES and implemented flags match catalog', () => {
  assert.equal(isMenuItemImplemented('fleet'), true)
  assert.equal(isMenuItemImplemented('sessions'), false)
  assert.ok(FUTURE_MENU_LEAVES[MENU_GROUP.OPERATIONS].some((l) => l.id === 'sessions'))
  assert.ok(FUTURE_MENU_LEAVES[MENU_GROUP.ADMINISTRATION].some((l) => l.id === 'audit'))
  assert.equal(
    MENU_LEAF_CATALOG.filter((l) => !l.implemented).length,
    Object.values(FUTURE_MENU_LEAVES).flat().length,
  )
})
