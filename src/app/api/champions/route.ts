import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const competitions = await prisma.competition.findMany({
    where: { status: "COMPLETED", winnerId: { not: null } },
    select: {
      id: true,
      name: true,
      season: true,
      isRanked: true,
      entrantCount: true,
      updatedAt: true,
      winner: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { updatedAt: "desc" },
  })

  // Group by competition name
  const grouped = new Map<string, {
    competitionName: string
    current: { competitionId: string; season: string; isRanked: boolean; entrantCount: number | null; winner: { id: string; name: string; avatarUrl: string | null } } | null
    past: { competitionId: string; season: string; isRanked: boolean; winner: { id: string; name: string; avatarUrl: string | null } }[]
  }>()

  for (const c of competitions) {
    if (!c.winner) continue
    const entry = grouped.get(c.name) ?? { competitionName: c.name, current: null, past: [] }

    if (!entry.current) {
      entry.current = {
        competitionId: c.id,
        season: c.season,
        isRanked: c.isRanked,
        entrantCount: c.entrantCount,
        winner: { id: c.winner.id, name: c.winner.name, avatarUrl: c.winner.avatarUrl },
      }
    } else {
      entry.past.push({
        competitionId: c.id,
        season: c.season,
        isRanked: c.isRanked,
        winner: { id: c.winner.id, name: c.winner.name, avatarUrl: c.winner.avatarUrl },
      })
    }
    grouped.set(c.name, entry)
  }

  return NextResponse.json([...grouped.values()])
}
