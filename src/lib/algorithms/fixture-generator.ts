export interface GeneratedFixture {
  matchday: number
  playerAId: string
  playerBId: string
}

export function generateFixtures(
  playerIds: string[],
  rounds = 1,
): GeneratedFixture[] {
  const BYE = "__BYE__"
  const players = [...playerIds]

  if (players.length % 2 !== 0) players.push(BYE)

  const n = players.length
  const pinned = players[0]
  const rotation = players.slice(1)
  const singleRobin: GeneratedFixture[] = []

  for (let round = 0; round < n - 1; round++) {
    const pair0: [string, string] =
      round % 2 === 0 ? [pinned, rotation[0]] : [rotation[0], pinned]

    if (pair0[0] !== BYE && pair0[1] !== BYE) {
      singleRobin.push({ matchday: round + 1, playerAId: pair0[0], playerBId: pair0[1] })
    }

    for (let i = 1; i < n / 2; i++) {
      const a = rotation[i]
      const b = rotation[n - 1 - i]
      if (a === BYE || b === BYE) continue
      const pair: [string, string] = round % 2 === 0 ? [a, b] : [b, a]
      singleRobin.push({ matchday: round + 1, playerAId: pair[0], playerBId: pair[1] })
    }

    const last = rotation.pop()!
    rotation.unshift(last)
  }

  const matchdaysPerRound = n - 1
  const all: GeneratedFixture[] = []

  for (let r = 0; r < rounds; r++) {
    const offset = r * matchdaysPerRound
    // Alternate home/away each round
    const flip = r % 2 === 1
    for (const f of singleRobin) {
      all.push({
        matchday: f.matchday + offset,
        playerAId: flip ? f.playerBId : f.playerAId,
        playerBId: flip ? f.playerAId : f.playerBId,
      })
    }
  }

  return all
}
