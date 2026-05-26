import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { updateCompetitionSchema } from "@/lib/validations/competition.schema"
import { getLeagueWinner } from "@/lib/utils/getLeagueWinner"
import { awardRankingPoints } from "@/lib/utils/award-ranking-points"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId } = await params

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      divisions: {
        include: {
          players: { include: { player: true } },
        },
        orderBy: { tier: "asc" },
      },
      _count: { select: { fixtures: true } },
    },
  })

  if (!competition) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(competition)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId } = await params
  const body = await req.json()
  const parsed = updateCompetitionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let winnerId: string | undefined
  if (parsed.data.status === "COMPLETED") {
    // Bracket final winner takes precedence over league table leader
    const finalNode = await prisma.bracketNode.findFirst({
      where: { competitionId, round: 1, winnerId: { not: null } },
      select: { winnerId: true },
    })
    if (finalNode?.winnerId) {
      winnerId = finalNode.winnerId
    } else {
      const comp = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: {
          type: true,
          divisions: { orderBy: { tier: "asc" }, take: 1, select: { id: true } },
        },
      })
      const div = comp?.divisions[0]
      if (div && (comp?.type === "SINGLE_LEAGUE" || comp?.type === "DIVISIONS")) {
        winnerId = (await getLeagueWinner(competitionId, div.id)) ?? undefined
      }
    }
  }

  const competition = await prisma.competition.update({
    where: { id: competitionId },
    data: { ...parsed.data, ...(winnerId ? { winnerId } : {}) },
  })

  if (parsed.data.status === "COMPLETED") {
    await awardRankingPoints(competitionId)
  }

  return NextResponse.json(competition)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId } = await params
  await prisma.competition.delete({ where: { id: competitionId } })
  return new NextResponse(null, { status: 204 })
}
