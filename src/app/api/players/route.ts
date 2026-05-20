import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createPlayerSchema } from "@/lib/validations/player.schema"
import { calculateAverage, count180s, checkoutPercentage, top3Checkouts } from "@/lib/utils/stats"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const players = await prisma.player.findMany({
    orderBy: { name: "asc" },
    include: {
      matchesAsA: { where: { completedAt: { not: null } }, select: { winnerId: true, startingScore: true } },
      matchesAsB: { where: { completedAt: { not: null } }, select: { winnerId: true, startingScore: true } },
      visits: { select: { scoreThrown: true, dartsUsed: true, isBust: true, isCheckout: true, visitNumber: true, playerId: true, runningRemainder: true } },
    },
  })

  const withStats = players.map((p) => {
    const allMatchData = [
      ...p.matchesAsA.map((m) => ({ winnerId: m.winnerId, startingScore: m.startingScore })),
      ...p.matchesAsB.map((m) => ({ winnerId: m.winnerId, startingScore: m.startingScore })),
    ]
    const won = allMatchData.filter((m) => m.winnerId === p.id).length
    const lost = allMatchData.filter((m) => m.winnerId !== null && m.winnerId !== p.id).length
    const drawn = allMatchData.filter((m) => m.winnerId === null).length

    // Use the most common startingScore (or 501 as fallback)
    const startingScore = allMatchData[0]?.startingScore ?? 501
    const visits = p.visits.map((v) => ({ ...v, playerId: p.id }))

    const average = parseFloat(calculateAverage(visits).toFixed(2))
    const coPercent = checkoutPercentage(visits, startingScore)
    const c180s = count180s(visits)
    const topCO = top3Checkouts(visits)

    const { matchesAsA: _a, matchesAsB: _b, visits: _v, ...rest } = p
    return { ...rest, won, lost, drawn, average, checkoutPercentage: coPercent, count180s: c180s, topCheckouts: topCO }
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
