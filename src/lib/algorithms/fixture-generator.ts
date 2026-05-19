export interface GeneratedFixture {
  matchday: number
  playerAId: string
  playerBId: string
}

export function generateFixtures(
  playerIds: string[],
  doubleRoundRobin = false,
): GeneratedFixture[] {
  const BYE = "__BYE__"
  const players = [...playerIds]

  if (players.length % 2 !== 0) {
    players.push(BYE)
  }

  const n = players.length
  const pinned = players[0]
  const rotation = players.slice(1)
  const fixtures: GeneratedFixture[] = []

  for (let round = 0; round < n - 1; round++) {
    const roundFixtures: GeneratedFixture[] = []

    // Pinned vs first in rotation
    const pair0: [string, string] =
      round % 2 === 0
        ? [pinned, rotation[0]]
        : [rotation[0], pinned]

    if (pair0[0] !== BYE && pair0[1] !== BYE) {
      roundFixtures.push({
        matchday: round + 1,
        playerAId: pair0[0],
        playerBId: pair0[1],
      })
    }

    // Remaining pairs
    for (let i = 1; i < n / 2; i++) {
      const a = rotation[i]
      const b = rotation[n - 1 - i]
      if (a === BYE || b === BYE) continue

      const pair: [string, string] = round % 2 === 0 ? [a, b] : [b, a]
      roundFixtures.push({
        matchday: round + 1,
        playerAId: pair[0],
        playerBId: pair[1],
      })
    }

    fixtures.push(...roundFixtures)

    // Rotate: move last element of rotation to front
    const last = rotation.pop()!
    rotation.unshift(last)
  }

  if (!doubleRoundRobin) return fixtures

  // Double round robin: add reversed fixtures as second half
  const secondHalf: GeneratedFixture[] = fixtures.map((f, i) => ({
    matchday: fixtures.length > 0 ? Math.ceil(fixtures.length / (n / 2)) + Math.ceil((i + 1) / (n / 2)) : i + 1 + (n - 1),
    playerAId: f.playerBId,
    playerBId: f.playerAId,
  }))

  // Recalculate matchdays for second half
  const matchdaysFirst = n - 1
  const secondHalfFixtures = fixtures.map((f) => ({
    matchday: f.matchday + matchdaysFirst,
    playerAId: f.playerBId,
    playerBId: f.playerAId,
  }))

  return [...fixtures, ...secondHalfFixtures]
}
