import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string; nodeId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId, nodeId } = await params

  const [competition, node] = await Promise.all([
    prisma.competition.findUnique({
      where: { id: competitionId },
      select: { bestOf: true, startingScore: true, finishType: true, bracketBestOf: true, bracketStartingScore: true, bracketFinishType: true },
    }),
    prisma.bracketNode.findUnique({ where: { id: nodeId } }),
  ])

  if (!competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 })
  if (!node) return NextResponse.json({ error: "Bracket node not found" }, { status: 404 })
  if (!node.seedAId || !node.seedBId) return NextResponse.json({ error: "Both seeds must be set before starting" }, { status: 400 })
  if (node.matchId) return NextResponse.json({ matchId: node.matchId })

  const match = await prisma.match.create({
    data: {
      playerAId: node.seedAId,
      playerBId: node.seedBId,
      startingScore: competition.bracketStartingScore ?? competition.startingScore,
      bestOf: competition.bracketBestOf ?? competition.bestOf,
      finishType: competition.bracketFinishType ?? competition.finishType,
      isSets: false,
      bracketNodeId: node.id,
    },
  })

  await prisma.bracketNode.update({ where: { id: nodeId }, data: { matchId: match.id } })

  return NextResponse.json({ matchId: match.id })
}
