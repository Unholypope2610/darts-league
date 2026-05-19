import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params
  const body = await req.json().catch(() => ({}))
  const { winnerId } = body as { winnerId?: string }

  const match = await prisma.match.update({
    where: { id: matchId },
    data: {
      winnerId: winnerId ?? undefined,
      completedAt: new Date(),
    },
    include: { fixture: true },
  })

  if (match.fixture) {
    await prisma.fixture.update({
      where: { id: match.fixture.id },
      data: { status: "COMPLETED" },
    })
  }

  return NextResponse.json(match)
}
