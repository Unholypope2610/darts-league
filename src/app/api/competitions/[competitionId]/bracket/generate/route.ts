import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { generateBracket } from "@/lib/algorithms/bracket-generator"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { competitionId } = await params
    const body = await req.json().catch(() => ({}))

    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        divisions: {
          include: { players: true },
          orderBy: { tier: "asc" },
        },
        // Only load match scores — not legs/visits (too expensive for large leagues)
        fixtures: {
          where: { status: "COMPLETED" },
          include: {
            match: { select: { playerAId: true, playerBId: true, winnerId: true, playerAScore: true, playerBScore: true } },
          },
        },
      },
    })
    if (!competition) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const division = competition.divisions[0]
    if (!division) return NextResponse.json({ error: "No division found" }, { status: 400 })

    const playerIds = division.players.map((p) => p.playerId)

    // Auto-determine topN from player count if not provided
    const playerCount = playerIds.length
    const autoTopN: 2 | 4 | 8 = playerCount <= 2 ? 2 : playerCount <= 4 ? 4 : 8
    const topN: 2 | 4 | 8 = body.topN === 2 ? 2 : body.topN === 8 ? 8 : body.topN === 4 ? 4 : autoTopN

    // Build standings using only points and leg difference (no visits needed)
    const stats = playerIds.map((pid) => {
      let points = 0
      let legsFor = 0
      let legsAgainst = 0
      for (const f of competition.fixtures) {
        if (!f.match) continue
        const { playerAId, playerBId, winnerId, playerAScore, playerBScore } = f.match
        if (playerAId !== pid && playerBId !== pid) continue
        const isA = playerAId === pid
        legsFor += isA ? playerAScore : playerBScore
        legsAgainst += isA ? playerBScore : playerAScore
        if (winnerId === pid) points += 2
      }
      return { playerId: pid, points, legDifference: legsFor - legsAgainst, legsFor, average: 0 }
    }).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.legDifference !== a.legDifference) return b.legDifference - a.legDifference
      return b.legsFor - a.legsFor
    })

    // Random seeding when no fixtures have been played (e.g. pure knockout draw)
    const hasFixtures = competition.fixtures.length > 0
    if (!hasFixtures) {
      for (let i = stats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [stats[i], stats[j]] = [stats[j], stats[i]]
      }
    }

    // Clear existing bracket nodes
    await prisma.bracketNode.deleteMany({ where: { competitionId } })

    // Pre-generate IDs so we can wire winnerNextNodeId without extra round-trips
    const nodeInputs = generateBracket(competitionId, stats, topN, competition.type !== "KNOCKOUT")
    const ids = nodeInputs.map(() => randomUUID())

    // Attach IDs to inputs
    const nodesWithIds = nodeInputs.map((n, i) => ({ ...n, id: ids[i], winnerNextNodeId: null as string | null }))

    // Wire winnerNextNodeId in memory before inserting
    if (topN === 4) {
      // semi1 (idx 0) → final (idx 2), semi2 (idx 1) → final (idx 2)
      nodesWithIds[0].winnerNextNodeId = ids[2]
      nodesWithIds[1].winnerNextNodeId = ids[2]
    } else if (topN === 8) {
      // quarters (0,1) → semi (4), quarters (2,3) → semi (5), semis → final (6)
      nodesWithIds[0].winnerNextNodeId = ids[4]
      nodesWithIds[1].winnerNextNodeId = ids[4]
      nodesWithIds[2].winnerNextNodeId = ids[5]
      nodesWithIds[3].winnerNextNodeId = ids[5]
      nodesWithIds[4].winnerNextNodeId = ids[6]
      nodesWithIds[5].winnerNextNodeId = ids[6]
    }
    // topN === 2: single final node, no wiring needed

    await prisma.bracketNode.createMany({ data: nodesWithIds })

    const finalNodes = await prisma.bracketNode.findMany({
      where: { competitionId },
      include: { seedA: true, seedB: true, winner: true },
      orderBy: [{ round: "desc" }, { position: "asc" }],
    })

    // Activate KNOCKOUT competitions automatically — no league stage needed
    if (competition.type === "KNOCKOUT" && competition.status === "DRAFT") {
      await prisma.competition.update({
        where: { id: competitionId },
        data: { status: "ACTIVE" },
      })
    }

    return NextResponse.json(finalNodes, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[bracket/generate]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
