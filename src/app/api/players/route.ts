import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createPlayerSchema } from "@/lib/validations/player.schema"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const players = await prisma.player.findMany({
    orderBy: { name: "asc" },
    include: {
      matchesAsA: { where: { completedAt: { not: null } }, select: { winnerId: true } },
      matchesAsB: { where: { completedAt: { not: null } }, select: { winnerId: true } },
      visits: { where: { isBust: false }, select: { scoreThrown: true, dartsUsed: true } },
    },
  })

  const withStats = players.map((p) => {
    const allMatches = [
      ...p.matchesAsA.map((m) => m.winnerId),
      ...p.matchesAsB.map((m) => m.winnerId),
    ]
    const won = allMatches.filter((w) => w === p.id).length
    const lost = allMatches.filter((w) => w !== null && w !== p.id).length
    const drawn = allMatches.filter((w) => w === null).length

    const totalScore = p.visits.reduce((s, v) => s + v.scoreThrown, 0)
    const totalDarts = p.visits.reduce((s, v) => s + v.dartsUsed, 0)
    const average = totalDarts > 0 ? (totalScore / totalDarts) * 3 : 0

    const { matchesAsA: _a, matchesAsB: _b, visits: _v, ...rest } = p
    return { ...rest, won, lost, drawn, average: Math.round(average * 100) / 100 }
  })

  return NextResponse.json(withStats)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createPlayerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const player = await prisma.player.create({ data: parsed.data })
  return NextResponse.json(player, { status: 201 })
}
