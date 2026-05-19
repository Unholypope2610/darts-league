import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { updatePlayerSchema } from "@/lib/validations/player.schema"
import { calculateAverage, count180s, highestCheckout } from "@/lib/utils/stats"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { playerId } = await params

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      matchesAsA: {
        include: { legs: { include: { visits: true } } },
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      },
      matchesAsB: {
        include: { legs: { include: { visits: true } } },
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
      },
    },
  })

  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const allMatches = [
    ...player.matchesAsA.map((m) => ({ ...m, side: "A" as const })),
    ...player.matchesAsB.map((m) => ({ ...m, side: "B" as const })),
  ].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  const allVisits = allMatches.flatMap((m) =>
    m.legs.flatMap((l) => l.visits.filter((v) => v.playerId === playerId)),
  )

  const careerStats = {
    played: allMatches.length,
    won: allMatches.filter((m) => m.winnerId === playerId).length,
    lost: allMatches.filter((m) => m.completedAt && m.winnerId !== playerId).length,
    average: calculateAverage(allVisits),
    highest180s: count180s(allVisits),
    highestCheckout: highestCheckout(allVisits),
    recentForm: allMatches.slice(0, 5).map((m) =>
      m.winnerId === playerId ? "W" : "L",
    ),
  }

  return NextResponse.json({ ...player, careerStats })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { playerId } = await params
  const body = await req.json()
  const parsed = updatePlayerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const player = await prisma.player.update({
    where: { id: playerId },
    data: parsed.data,
  })
  return NextResponse.json(player)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { playerId } = await params
  await prisma.player.delete({ where: { id: playerId } })
  return new NextResponse(null, { status: 204 })
}
