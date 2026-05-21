import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { competitionId } = await params

    const nodes = await prisma.bracketNode.findMany({
      where: { competitionId },
      include: { seedA: true, seedB: true, winner: true },
      orderBy: [{ round: "desc" }, { position: "asc" }],
    })

    // BracketNode has no @relation to Match in the schema, so join manually
    const matchIds = nodes.map((n) => n.matchId).filter(Boolean) as string[]
    const matches = matchIds.length
      ? await prisma.match.findMany({
          where: { id: { in: matchIds } },
          select: { id: true, playerAScore: true, playerBScore: true, winnerId: true },
        })
      : []
    const matchById = Object.fromEntries(matches.map((m) => [m.id, m]))

    const result = nodes.map((n) => ({
      ...n,
      match: n.matchId ? (matchById[n.matchId] ?? null) : null,
    }))

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[bracket/GET]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
