import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createPlayerSchema } from "@/lib/validations/player.schema"
import { calculateAverage, count180s, doublesPercentage, top3Checkouts } from "@/lib/utils/stats"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const players = await prisma.player.findMany({
    orderBy: { name: "asc" },
    include: {
      matchesAsA: { where: { completedAt: { not: null } }, select: { winnerId: true, startingScore: true, completedAt: true } },
      matchesAsB: { where: { completedAt: { not: null } }, select: { winnerId: true, startingScore: true, completedAt: true } },
      visits: { select: { scoreThrown: true, dartsUsed: true, doublesAttempted: true, isBust: true, isCheckout: true, visitNumber: true, playerId: true, runningRemainder: true } },
    },
  })

  const withStats = players.map((p) => {
    const allMatchesSorted = [
      ...p.matchesAsA.map((m) => ({ winnerId: m.winnerId, completedAt: m.completedAt! })),
      ...p.matchesAsB.map((m) => ({ winnerId: m.winnerId, completedAt: m.completedAt! })),
    ].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

    const won = allMatchesSorted.filter((m) => m.winnerId === p.id).length
    const lost = allMatchesSorted.filter((m) => m.winnerId !== null && m.winnerId !== p.id).length
    const drawn = allMatchesSorted.filter((m) => m.winnerId === null).length
    const recentForm = allMatchesSorted.slice(0, 5).map((m) =>
      m.winnerId === p.id ? "W" : m.winnerId === null ? "D" : "L"
    ) as ("W" | "D" | "L")[]

    const visits = p.visits.map((v) => ({ ...v, playerId: p.id }))

    const average = parseFloat(calculateAverage(visits).toFixed(2))
    const dblPercent = doublesPercentage(visits)
    const c180s = count180s(visits)
    const topCO = top3Checkouts(visits)

    const { matchesAsA: _a, matchesAsB: _b, visits: _v, ...rest } = p
    return { ...rest, won, lost, drawn, average, doublesPercentage: dblPercent, count180s: c180s, topCheckouts: topCO, recentForm }
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
