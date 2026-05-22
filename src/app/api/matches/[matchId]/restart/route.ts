import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/auth"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { matchId } = await params

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      fixture: { select: { id: true } },
      legs: { select: { id: true } },
    },
  })
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    // Visits cascade-delete when legs are deleted (schema: onDelete: Cascade)
    await tx.leg.deleteMany({ where: { matchId } })

    await tx.match.update({
      where: { id: matchId },
      data: { playerAScore: 0, playerBScore: 0, winnerId: null, completedAt: null },
    })

    if (match.fixture) {
      await tx.fixture.update({
        where: { id: match.fixture.id },
        data: { status: "LIVE" },
      })
    }

    if (match.bracketNodeId) {
      const node = await tx.bracketNode.findUnique({ where: { id: match.bracketNodeId } })
      if (node?.winnerId && node.winnerNextNodeId) {
        // Clear the seed that was set when this match completed
        const nextNode = await tx.bracketNode.findUnique({ where: { id: node.winnerNextNodeId } })
        if (nextNode) {
          if (nextNode.seedAId === node.winnerId) {
            await tx.bracketNode.update({ where: { id: node.winnerNextNodeId }, data: { seedAId: null } })
          } else if (nextNode.seedBId === node.winnerId) {
            await tx.bracketNode.update({ where: { id: node.winnerNextNodeId }, data: { seedBId: null } })
          }
        }
      }
      if (node) {
        await tx.bracketNode.update({ where: { id: match.bracketNodeId }, data: { winnerId: null } })
      }
    }
  })

  return NextResponse.json({ matchId })
}
