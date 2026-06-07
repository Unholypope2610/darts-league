import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import type { Bobs27RoundData, CricketRoundData, HalfItRoundData } from "@/types/api"

interface Params { params: Promise<{ gameMode: string }> }

export async function GET(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { gameMode } = await params
  const { searchParams } = new URL(req.url)
  const requestedPlayerId = searchParams.get("playerId")

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true } })
  if (!user?.playerId) return NextResponse.json({ stats: null })

  // Allow viewing any player's stats; default to own player
  const playerId = requestedPlayerId ?? user.playerId

  const SLUG_MAP: Record<string, string> = {
    halfit: "HALF_IT",
    bobs27: "BOBS_27",
    cricket: "CRICKET",
  }
  const dbGameMode = SLUG_MAP[gameMode.toLowerCase()] ?? gameMode.toUpperCase()

  const sessions = await prisma.practiceSession.findMany({
    where: {
      gameMode: dbGameMode,
      status: "COMPLETED",
      players: { some: { playerId } },
    },
    include: {
      rounds: { where: { playerId }, orderBy: { roundNumber: "asc" } },
      players: { where: { playerId } },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  })

  if (dbGameMode === "BOBS_27") {
    const hitsByDouble: Record<string, { hits0: number; hits1: number; hits2: number; hits3: number; attempts: number }> = {}
    let totalScore = 0
    let bestScore = -Infinity
    let perfectRounds = 0
    let games = 0
    let totalDartsHit = 0
    let totalRounds = 0

    for (const s of sessions) {
      games++
      const player = s.players[0]
      if (!player) continue
      const sessionScore = player.finalScore ?? 27

      for (const r of s.rounds) {
        const d = r.data as Bobs27RoundData
        if (!hitsByDouble[d.target]) hitsByDouble[d.target] = { hits0: 0, hits1: 0, hits2: 0, hits3: 0, attempts: 0 }
        hitsByDouble[d.target].attempts++
        hitsByDouble[d.target][`hits${d.dartsHit as 0 | 1 | 2 | 3}`]++
        totalDartsHit += d.dartsHit
        totalRounds++
        if (d.dartsHit === 3) perfectRounds++
      }
      totalScore += sessionScore
      if (sessionScore > bestScore) bestScore = sessionScore
    }

    return NextResponse.json({
      games,
      averageScore: games > 0 ? Math.round(totalScore / games) : 0,
      bestScore: games > 0 ? bestScore : 0,
      perfectRounds,
      overallAvgDartsHit: totalRounds > 0 ? Math.round((totalDartsHit / totalRounds) * 100) / 100 : 0,
      hitsByDouble,
    })
  }

  if (dbGameMode === "CRICKET") {
    let totalMarks = 0
    let totalDarts = 0
    let totalRounds = 0
    let tripleDarts = 0
    let threeInABed = 0
    let bestRoundMarks = 0
    let bestGameMpr = 0
    let wins = 0
    const marksByTarget: Record<string, number> = {}
    const sessions2 = sessions.length

    for (const s of sessions) {
      if (s.winnerId) {
        const player = s.players[0]
        if (player && s.winnerId === player.playerId) wins++
      }
      let sessionMarks = 0
      let sessionRounds = 0
      for (const r of s.rounds) {
        const d = r.data as CricketRoundData
        totalRounds++
        sessionRounds++
        let roundMarks = 0
        for (const dart of d.darts) {
          roundMarks += dart.multiplier
          totalDarts++
          if (dart.multiplier === 3) tripleDarts++
          marksByTarget[dart.target] = (marksByTarget[dart.target] ?? 0) + dart.multiplier
        }
        totalMarks += roundMarks
        sessionMarks += roundMarks
        if (roundMarks > bestRoundMarks) bestRoundMarks = roundMarks
        if (
          d.darts.length === 3 &&
          d.darts.every((dart) => dart.multiplier === 3 && dart.target === d.darts[0].target)
        ) {
          threeInABed++
        }
      }
      const sessionMpr = sessionRounds > 0 ? sessionMarks / sessionRounds : 0
      if (sessionMpr > bestGameMpr) bestGameMpr = sessionMpr
    }

    return NextResponse.json({
      games: sessions2,
      wins,
      mpr: totalRounds > 0 ? Math.round((totalMarks / totalRounds) * 100) / 100 : 0,
      bestGameMpr: Math.round(bestGameMpr * 100) / 100,
      bestRoundMarks,
      tripleRate: totalDarts > 0 ? Math.round((tripleDarts / totalDarts) * 100) : 0,
      threeInABed,
      totalRounds,
      marksByTarget,
    })
  }

  if (dbGameMode === "HALF_IT") {
    let totalFinalScore = 0
    let bestFinalScore = 0
    let totalHalves = 0
    let games = 0
    let bestRoundScore = 0

    for (const s of sessions) {
      games++
      const player = s.players[0]
      const finalScore = player?.finalScore ?? 0
      totalFinalScore += finalScore
      if (finalScore > bestFinalScore) bestFinalScore = finalScore

      for (const r of s.rounds) {
        const d = r.data as HalfItRoundData
        if (d.wasHalved) totalHalves++
        if (d.pointsScored > bestRoundScore) bestRoundScore = d.pointsScored
      }
    }

    return NextResponse.json({
      games,
      averageFinalScore: games > 0 ? Math.round(totalFinalScore / games) : 0,
      bestFinalScore,
      averageHalvesPerGame: games > 0 ? Math.round((totalHalves / games) * 10) / 10 : 0,
      bestRoundScore,
    })
  }

  return NextResponse.json({ stats: null })
}
