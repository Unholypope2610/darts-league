import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// Generates the winner's scoring sequence that always finishes on D20 (40)
function winnerVisitScores(startingScore: number): number[] {
  const checkout = 40
  const scores: number[] = []
  let rem = startingScore - checkout
  while (rem > 180) { scores.push(180); rem -= 180 }
  if (rem > 0) scores.push(rem)
  scores.push(checkout)
  return scores
}

interface VisitData {
  playerId: string
  visitNumber: number
  scoreThrown: number
  dartsUsed: number
  doublesAttempted: number
  runningRemainder: number
  isBust: boolean
  isCheckout: boolean
}

function buildLegVisits(
  startingScore: number,
  winnerId: string,
  loserId: string,
  winnerStarts: boolean,
): { visits: VisitData[]; dartsThrown: number } {
  const winScores = winnerVisitScores(startingScore)
  const visits: VisitData[] = []
  let winnerRem = startingScore
  let loserRem = startingScore
  let winnerVisitNum = 0
  let loserVisitNum = 0

  for (let i = 0; i < winScores.length; i++) {
    const isCheckout = i === winScores.length - 1

    // If loser starts, loser throws before each winner visit
    if (!winnerStarts) {
      loserRem -= 60
      loserVisitNum++
      visits.push({
        playerId: loserId, visitNumber: loserVisitNum, scoreThrown: 60,
        dartsUsed: 3, doublesAttempted: 0, runningRemainder: loserRem,
        isBust: false, isCheckout: false,
      })
    }

    // Winner's visit
    const score = winScores[i]
    winnerRem -= score
    winnerVisitNum++
    visits.push({
      playerId: winnerId, visitNumber: winnerVisitNum, scoreThrown: score,
      dartsUsed: isCheckout ? 2 : 3, doublesAttempted: isCheckout ? 1 : 0,
      runningRemainder: winnerRem, isBust: false, isCheckout,
    })

    // If winner starts, loser throws after each non-final winner visit
    if (winnerStarts && !isCheckout) {
      loserRem -= 60
      loserVisitNum++
      visits.push({
        playerId: loserId, visitNumber: loserVisitNum, scoreThrown: 60,
        dartsUsed: 3, doublesAttempted: 0, runningRemainder: loserRem,
        isBust: false, isCheckout: false,
      })
    }
  }

  const dartsThrown = visits
    .filter((v) => v.playerId === winnerId)
    .reduce((s, v) => s + v.dartsUsed, 0)

  return { visits, dartsThrown }
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { competitionId } = await params

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { bestOf: true, startingScore: true, finishType: true },
  })
  if (!competition) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const fixtures = await prisma.fixture.findMany({
    where: {
      competitionId,
      status: "SCHEDULED",
      matchId: null,
      playerAId: { not: null },
      playerBId: { not: null },
    },
    select: { id: true, playerAId: true, playerBId: true },
  })

  if (fixtures.length === 0) return NextResponse.json({ simulated: 0 })

  const { bestOf, startingScore, finishType } = competition
  const legsToWin = Math.floor(bestOf / 2) + 1
  const now = new Date()

  // Build all rows in memory with pre-generated IDs — no DB calls needed.
  type MatchRow = { id: string; playerAId: string; playerBId: string; startingScore: number; bestOf: number; finishType: string; isSets: boolean; playerAScore: number; playerBScore: number; winnerId: string; startedAt: Date; completedAt: Date }
  type LegRow = { id: string; matchId: string; legNumber: number; starterId: string; winnerId: string; dartsThrown: number; completedAt: Date }
  type VisitRow = VisitData & { legId: string }

  const matchRows: MatchRow[] = []
  const legRows: LegRow[] = []
  const visitRows: VisitRow[] = []
  const fixtureUpdates: { id: string; matchId: string }[] = []

  for (const fixture of fixtures) {
    const playerAId = fixture.playerAId!
    const playerBId = fixture.playerBId!

    const matchWinnerId = Math.random() < 0.5 ? playerAId : playerBId
    const matchLoserId = matchWinnerId === playerAId ? playerBId : playerAId
    const loserLegsWon = Math.floor(Math.random() * legsToWin)

    const outcomes: ("W" | "L")[] = shuffle([
      ...Array<"W">(legsToWin - 1).fill("W"),
      ...Array<"L">(loserLegsWon).fill("L"),
    ])
    outcomes.push("W")

    const playerAScore = outcomes.filter(
      (o) => (o === "W") === (matchWinnerId === playerAId),
    ).length
    const playerBScore = outcomes.length - playerAScore

    const matchId = randomUUID()
    matchRows.push({ id: matchId, playerAId, playerBId, startingScore, bestOf, finishType, isSets: false, playerAScore, playerBScore, winnerId: matchWinnerId, startedAt: now, completedAt: now })
    fixtureUpdates.push({ id: fixture.id, matchId })

    for (let legIdx = 0; legIdx < outcomes.length; legIdx++) {
      const legWinnerId = outcomes[legIdx] === "W" ? matchWinnerId : matchLoserId
      const legLoserId = legWinnerId === playerAId ? playerBId : playerAId
      const winnerStarts = Math.random() < 0.5
      const { visits, dartsThrown } = buildLegVisits(startingScore, legWinnerId, legLoserId, winnerStarts)

      const legId = randomUUID()
      legRows.push({ id: legId, matchId, legNumber: legIdx + 1, starterId: winnerStarts ? legWinnerId : legLoserId, winnerId: legWinnerId, dartsThrown, completedAt: now })
      for (const v of visits) visitRows.push({ ...v, legId })
    }
  }

  try {
    // Three bulk inserts in one transaction instead of hundreds of sequential calls.
    await prisma.$transaction([
      prisma.match.createMany({ data: matchRows }),
      prisma.leg.createMany({ data: legRows }),
      prisma.visit.createMany({ data: visitRows }),
    ])

    // Update fixtures in parallel (one UPDATE per fixture, but all fired at once).
    await Promise.all(
      fixtureUpdates.map(({ id, matchId }) =>
        prisma.fixture.update({ where: { id }, data: { status: "COMPLETED", matchId } })
      )
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[simulate]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ simulated: fixtures.length })
}
