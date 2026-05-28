import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { createCompetitionSchema } from "@/lib/validations/competition.schema"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const competitions = await prisma.competition.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      divisions: { include: { players: { include: { player: { select: { id: true, name: true } } } } } },
      _count: { select: { fixtures: true } },
    },
  })
  return NextResponse.json(competitions)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createCompetitionSchema.safeParse(body)
  console.log("[create-competition] body.isRanked=", body.isRanked, "parsed.isRanked=", parsed.data?.isRanked)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { divisions, playerIds, ...competitionData } = body as {
    divisions?: { name: string; tier: number; playerIds: string[] }[]
    playerIds?: string[]
    [key: string]: unknown
  }

  const competition = await prisma.competition.create({
    data: {
      ...parsed.data,
      status: "DRAFT",
      divisions: {
        create:
          parsed.data.type === "DIVISIONS" && divisions
            ? divisions.map((d) => ({
                name: d.name,
                tier: d.tier,
                players: {
                  create: d.playerIds.map((pid) => ({ playerId: pid })),
                },
              }))
            : parsed.data.type !== "DIVISIONS"
            ? [
                {
                  name: "League",
                  tier: 1,
                  players: {
                    create: (playerIds ?? []).map((pid: string) => ({ playerId: pid })),
                  },
                },
              ]
            : [],
      },
    },
    include: { divisions: { include: { players: true } } },
  })

  return NextResponse.json(competition, { status: 201 })
}
