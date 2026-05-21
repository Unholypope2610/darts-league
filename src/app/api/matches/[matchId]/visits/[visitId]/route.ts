import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { getNewRemainder } from "@/lib/utils/darts"
import type { FinishType } from "@/lib/utils/darts"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ matchId: string; visitId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId, visitId } = await params
  const body = await req.json()

  // Branch: doubles/darts update (from doubles prompt, not a score edit)
  if ("doublesAttempted" in body || "dartsUsed" in body) {
    const doublesAttempted: number | undefined = body.doublesAttempted
    const dartsUsed: number | undefined = body.dartsUsed

    if (doublesAttempted !== undefined && (typeof doublesAttempted !== "number" || doublesAttempted < 0 || doublesAttempted > 3)) {
      return NextResponse.json({ error: "Invalid doublesAttempted" }, { status: 400 })
    }
    if (dartsUsed !== undefined && (typeof dartsUsed !== "number" || dartsUsed < 1 || dartsUsed > 3)) {
      return NextResponse.json({ error: "Invalid dartsUsed" }, { status: 400 })
    }

    const targetVisit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { leg: { include: { visits: { where: { isCheckout: true } } } } },
    })
    if (!targetVisit || targetVisit.leg.matchId !== matchId) {
      return NextResponse.json({ error: "Visit not found" }, { status: 404 })
    }

    const updateData: { doublesAttempted?: number; dartsUsed?: number } = {}
    if (doublesAttempted !== undefined) updateData.doublesAttempted = doublesAttempted
    if (dartsUsed !== undefined) updateData.dartsUsed = dartsUsed

    await prisma.visit.update({ where: { id: visitId }, data: updateData })

    // Recalculate leg.dartsThrown if this visit is the checkout and dartsUsed changed
    if (dartsUsed !== undefined && targetVisit.isCheckout) {
      const allPlayerVisits = await prisma.visit.findMany({
        where: { legId: targetVisit.legId, playerId: targetVisit.playerId },
      })
      const totalDarts = allPlayerVisits.reduce((sum, v) => sum + (v.id === visitId ? dartsUsed : v.dartsUsed), 0)
      await prisma.leg.update({ where: { id: targetVisit.legId }, data: { dartsThrown: totalDarts } })
    }

    return NextResponse.json({ ok: true })
  }

  // Branch: score edit
  const newScore: number = body?.scoreThrown

  if (typeof newScore !== "number" || newScore < 0 || newScore > 180 || !Number.isInteger(newScore)) {
    return NextResponse.json({ error: "Invalid scoreThrown" }, { status: 400 })
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (match.completedAt) return NextResponse.json({ error: "Match already completed" }, { status: 400 })

  // Find the target visit — must be in the active (uncompleted) leg
  const targetVisit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { leg: true },
  })
  if (!targetVisit || targetVisit.leg.matchId !== matchId) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 })
  }
  if (targetVisit.leg.completedAt) {
    return NextResponse.json({ error: "Cannot edit visits in a completed leg" }, { status: 400 })
  }

  // Don't allow editing bust or checkout visits (they affect leg state)
  if (targetVisit.isBust || targetVisit.isCheckout) {
    return NextResponse.json({ error: "Cannot edit bust or checkout visits" }, { status: 400 })
  }

  // Get all same-player visits in this leg in creation order
  const samePlayerVisits = await prisma.visit.findMany({
    where: { legId: targetVisit.legId, playerId: targetVisit.playerId },
    orderBy: { createdAt: "asc" },
  })

  const targetIndex = samePlayerVisits.findIndex((v) => v.id === visitId)
  const prevRemainder =
    targetIndex === 0
      ? match.startingScore
      : samePlayerVisits[targetIndex - 1].runningRemainder

  // Recalculate chain from target onwards
  const updates: {
    id: string
    scoreThrown: number
    runningRemainder: number
    isBust: boolean
    isCheckout: boolean
  }[] = []

  let remainder = prevRemainder
  for (let i = targetIndex; i < samePlayerVisits.length; i++) {
    const v = samePlayerVisits[i]
    const score = i === targetIndex ? newScore : v.scoreThrown
    const newRem = getNewRemainder(score, remainder, match.finishType as FinishType)
    const isBust = newRem === null
    const isCheckout = !isBust && newRem === 0
    const actualRem = isBust ? remainder : newRem!
    updates.push({ id: v.id, scoreThrown: score, runningRemainder: actualRem, isBust, isCheckout })
    if (!isBust) remainder = newRem!
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.visit.update({
        where: { id: u.id },
        data: {
          scoreThrown: u.scoreThrown,
          runningRemainder: u.runningRemainder,
          isBust: u.isBust,
          isCheckout: u.isCheckout,
        },
      }),
    ),
  )

  return NextResponse.json({ updatedVisits: updates })
}
