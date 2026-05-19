import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { startMatchSchema } from "@/lib/validations/visit.schema"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { fixtureId } = await params
  const body = await req.json()
  const parsed = startMatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: { competition: true },
  })
  if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (fixture.status === "COMPLETED") {
    return NextResponse.json({ error: "Fixture already completed" }, { status: 400 })
  }

  const { startingPlayerId, ...matchFormat } = parsed.data

  // Create match + first leg in a transaction
  const [match] = await prisma.$transaction(async (tx) => {
    const newMatch = await tx.match.create({
      data: {
        ...matchFormat,
        playerAId: fixture.playerAId,
        playerBId: fixture.playerBId,
      },
      include: { playerA: true, playerB: true },
    })

    // Link match to fixture
    await tx.fixture.update({
      where: { id: fixtureId },
      data: { matchId: newMatch.id, status: "LIVE" },
    })

    // Create first leg
    await tx.leg.create({
      data: {
        matchId: newMatch.id,
        legNumber: 1,
        starterId: startingPlayerId,
      },
    })

    return [newMatch]
  })

  return NextResponse.json(match, { status: 201 })
}
