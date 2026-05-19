import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { updateCompetitionSchema } from "@/lib/validations/competition.schema"

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

  const competition = await prisma.competition.update({
    where: { id: competitionId },
    data: parsed.data,
  })
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
