import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { generateFixtures } from "@/lib/algorithms/fixture-generator"
import { generateFixturesSchema } from "@/lib/validations/competition.schema"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId } = await params

  const fixtures = await prisma.fixture.findMany({
    where: { competitionId },
    include: {
      playerA: true,
      playerB: true,
      match: true,
      division: true,
      competition: { select: { id: true, name: true, bestOf: true, startingScore: true, finishType: true } },
    },
    orderBy: [{ matchday: "asc" }, { createdAt: "asc" }],
  })

  return NextResponse.json(fixtures)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const parsed = generateFixturesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const competition = await prisma.competition.findUnique({
      where: { id: competitionId },
      include: {
        divisions: {
          include: { players: true },
          orderBy: { tier: "asc" },
        },
      },
    })
    if (!competition) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Determine which division(s) to generate for
    const divisionsToGenerate = parsed.data.divisionId
      ? competition.divisions.filter((d) => d.id === parsed.data.divisionId)
      : competition.divisions

    type FixtureInput = {
      competitionId: string
      divisionId: string
      matchday: number
      playerAId: string
      playerBId: string
      status: "SCHEDULED"
    }
    const allFixtureData: FixtureInput[] = []

    for (const division of divisionsToGenerate) {
      const playerIds = division.players.map((p) => p.playerId)
      if (playerIds.length < 2) continue

      const generated = generateFixtures(playerIds, parsed.data.rounds)
      for (const f of generated) {
        allFixtureData.push({
          competitionId,
          divisionId: division.id,
          matchday: f.matchday,
          playerAId: f.playerAId,
          playerBId: f.playerBId,
          status: "SCHEDULED",
        })
      }
    }

    if (allFixtureData.length === 0) {
      return NextResponse.json(
        { error: "No players found in this competition. Add players to the division before generating fixtures." },
        { status: 400 },
      )
    }

    // Clear unplayed fixtures for the divisions being regenerated so we don't stack duplicates
    await prisma.fixture.deleteMany({
      where: {
        competitionId,
        divisionId: { in: divisionsToGenerate.map((d) => d.id) },
        status: "SCHEDULED",
      },
    })

    await prisma.fixture.createMany({ data: allFixtureData })

    // Activate the competition if it was in DRAFT
    if (competition.status === "DRAFT") {
      await prisma.competition.update({
        where: { id: competitionId },
        data: { status: "ACTIVE" },
      })
    }

    return NextResponse.json({ count: allFixtureData.length }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[fixtures/generate]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
