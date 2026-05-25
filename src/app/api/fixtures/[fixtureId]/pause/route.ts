import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { fixtureId } = await params

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true, role: true } })
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } })
  if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isParticipant = user.playerId === fixture.playerAId || user.playerId === fixture.playerBId
  if (!isParticipant && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (fixture.status !== "LIVE") {
    return NextResponse.json({ error: "Match is not live" }, { status: 400 })
  }

  await prisma.fixture.update({ where: { id: fixtureId }, data: { status: "PAUSED" } })

  return NextResponse.json({ ok: true })
}
