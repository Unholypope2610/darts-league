import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { generateBracket } from "@/lib/algorithms/bracket-generator"
import { calculateAverage } from "@/lib/utils/stats"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId } = await params
  const body = await req.json().catch(() => ({}))
  const topN: 4 | 8 = body.topN === 8 ? 8 : 4

  // Get league table standings
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      divisions: {
        include: { players: true },
        orderBy: { tier: "asc" },
      },
      fixtures: {
        where: { status: "COMPLETED" },
        include: { match: { include: { legs: { include: { visits: true } } } } },
      },
    },
  })
  if (!competition) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Use first division for standings (or merge for SINGLE_LEAGUE)
  const division = competition.divisions[0]
  if (!division) return NextResponse.json({ error: "No division found" }, { status: 400 })

  const playerIds = division.players.map((p) => p.playerId)

  // Build standings
  const stats = playerIds.map((pid) => {
    const fixtures = competition.fixtures.filter(
      (f) => f.playerAId === pid || f.playerBId === pid,
    )
    let points = 0
    let legsFor = 0
    let legsAgainst = 0
    const allVisits = fixtures.flatMap((f) =>
      f.match?.legs.flatMap((l) => l.visits.filter((v) => v.playerId === pid)) ?? [],
    )
    for (const f of fixtures) {
      if (!f.match) continue
      const isA = f.playerAId === pid
      legsFor += isA ? f.match.playerAScore : f.match.playerBScore
      legsAgainst += isA ? f.match.playerBScore : f.match.playerAScore
      if (f.match.winnerId === pid) points += 2
    }
    return {
      playerId: pid,
      points,
      legDifference: legsFor - legsAgainst,
      legsFor,
      average: calculateAverage(allVisits),
    }
  }).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.legDifference !== a.legDifference) return b.legDifference - a.legDifference
    if (b.legsFor !== a.legsFor) return b.legsFor - a.legsFor
    return b.average - a.average
  })

  // Clear existing bracket nodes
  await prisma.bracketNode.deleteMany({ where: { competitionId } })

  const nodeInputs = generateBracket(competitionId, stats, topN)

  // Create nodes and wire up winnerNextNodeId
  const nodes = await prisma.$transaction(
    nodeInputs.map((n) => prisma.bracketNode.create({ data: n })),
  )

  // Wire winners: for topN=4: semis (round=2) → final (round=1)
  // For topN=8: quarters → semis → final
  if (topN === 4) {
    const [semi1, semi2, final] = nodes
    await prisma.bracketNode.update({ where: { id: semi1.id }, data: { winnerNextNodeId: final.id } })
    await prisma.bracketNode.update({ where: { id: semi2.id }, data: { winnerNextNodeId: final.id } })
  } else {
    const quarters = nodes.filter((n) => n.round === 4)
    const semis = nodes.filter((n) => n.round === 2)
    const [final] = nodes.filter((n) => n.round === 1)
    if (quarters[0] && quarters[1] && semis[0]) {
      await prisma.bracketNode.update({ where: { id: quarters[0].id }, data: { winnerNextNodeId: semis[0].id } })
      await prisma.bracketNode.update({ where: { id: quarters[1].id }, data: { winnerNextNodeId: semis[0].id } })
    }
    if (quarters[2] && quarters[3] && semis[1]) {
      await prisma.bracketNode.update({ where: { id: quarters[2].id }, data: { winnerNextNodeId: semis[1].id } })
      await prisma.bracketNode.update({ where: { id: quarters[3].id }, data: { winnerNextNodeId: semis[1].id } })
    }
    if (semis[0] && semis[1] && final) {
      await prisma.bracketNode.update({ where: { id: semis[0].id }, data: { winnerNextNodeId: final.id } })
      await prisma.bracketNode.update({ where: { id: semis[1].id }, data: { winnerNextNodeId: final.id } })
    }
  }

  const finalNodes = await prisma.bracketNode.findMany({
    where: { competitionId },
    include: { seedA: true, seedB: true, winner: true },
    orderBy: [{ round: "desc" }, { position: "asc" }],
  })

  return NextResponse.json(finalNodes, { status: 201 })
}
