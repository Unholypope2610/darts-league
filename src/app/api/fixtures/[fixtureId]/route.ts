import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { fixtureId } = await params

  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: {
      playerA: true,
      playerB: true,
      match: { include: { legs: true } },
      competition: true,
      division: true,
    },
  })
  if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(fixture)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { fixtureId } = await params
  const body = await req.json()
  const { scheduledAt, matchday } = body as { scheduledAt?: string; matchday?: number }

  const fixture = await prisma.fixture.update({
    where: { id: fixtureId },
    data: {
      ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
      ...(matchday !== undefined && { matchday }),
    },
  })
  return NextResponse.json(fixture)
}
