import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

interface Params { params: Promise<{ sessionId: string }> }

export async function POST(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionId } = await params
  const { winnerId, finalScores } = await req.json() as {
    winnerId: string | null
    finalScores: Record<string, number>  // practicePlayerId → score
  }

  await prisma.practiceSession.update({
    where: { id: sessionId },
    data: { status: "COMPLETED", winnerId, completedAt: new Date() },
  })

  // Write final scores onto each player record
  await Promise.all(
    Object.entries(finalScores).map(([ppId, score]) =>
      prisma.practicePlayer.update({ where: { id: ppId }, data: { finalScore: score } })
    )
  )

  return NextResponse.json({ ok: true })
}
