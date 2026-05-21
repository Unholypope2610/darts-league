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

  const { bestOf, startingScore, finishType } = competition
  const legsToWin = Math.floor(bestOf / 2) + 1
  const now = new Date()
  let simulated = 0

  for (const fixture of fixtures) {
    const playerAId = fixture.playerAId!
    const playerBId = fixture.playerBId!

    // Randomly choose match winner and how many legs the loser wins
    const matchWinnerId = Math.random() < 0.5 ? playerAId : playerBId
    const matchLoserId = matchWinnerId === playerAId ? playerBId : playerAId
    const loserLegsWon = Math.floor(Math.random() * legsToWin)

    // Build outcome array: last leg always won by match winner
    const outcomes: ("W" | "L")[] = shuffle([
      ...Array<"W">(legsToWin - 1).fill("W"),
      ...Array<"L">(loserLegsWon).fill("L"),
    ])
    outcomes.push("W")

    const playerAScore = outcomes.filter(
      (o) => (o === "W") === (matchWinnerId === playerAId),
    ).length
    const playerBScore = outcomes.length - playerAScore

    await prisma.$transaction(async (tx) => {
      const match = await tx.match.create({
        data: {
          playerAId,
          playerBId,
          startingScore,
          bestOf,
          finishType,
          isSets: false,
          playerAScore,
          playerBScore,
          winnerId: matchWinnerId,
          startedAt: now,
          completedAt: now,
        },
      })

      for (let legIdx = 0; legIdx < outcomes.length; legIdx++) {
        const legWinnerId = outcomes[legIdx] === "W" ? matchWinnerId : matchLoserId
        const legLoserId = legWinnerId === playerAId ? playerBId : playerAId
        const winnerStarts = Math.random() < 0.5

        const { visits, dartsThrown } = buildLegVisits(
          startingScore, legWinnerId, legLoserId, winnerStarts,
        )

        const leg = await tx.leg.create({
          data: {
            matchId: match.id,
            legNumber: legIdx + 1,
            starterId: winnerStarts ? legWinnerId : legLoserId,
            winnerId: legWinnerId,
            dartsThrown,
            completedAt: now,
          },
        })

        await tx.visit.createMany({
          data: visits.map((v) => ({ ...v, legId: leg.id })),
        })
      }

      await tx.fixture.update({
        where: { id: fixture.id },
        data: { status: "COMPLETED", matchId: match.id },
      })
    })

    simulated++
  }

  return NextResponse.json({ simulated })
}
