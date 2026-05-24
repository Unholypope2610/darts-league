import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params
  const body = await req.json()
  const { votesA, votesB } = body

  if (typeof votesA !== "number" || typeof votesB !== "number") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  // First-writer-wins: only update if not already saved
  await prisma.match.updateMany({
    where: { id: matchId, pollVotesA: null },
    data: { pollVotesA: votesA, pollVotesB: votesB },
  })

  return NextResponse.json({ ok: true })
}
