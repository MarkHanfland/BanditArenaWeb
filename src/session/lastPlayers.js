export const LAST_PLAYERS_KEY = 'bandit.lastPlayers'

export function readLastPlayers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LAST_PLAYERS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((entry) => entry?.userId) : []
  } catch {
    return []
  }
}

export function rememberPlayer(player) {
  if (!player?.userId) {
    return
  }
  const next = [
    { userId: player.userId, displayName: player.displayName || player.name || player.userId },
    ...readLastPlayers().filter((entry) => entry.userId !== player.userId),
  ].slice(0, 5)
  localStorage.setItem(LAST_PLAYERS_KEY, JSON.stringify(next))
}
