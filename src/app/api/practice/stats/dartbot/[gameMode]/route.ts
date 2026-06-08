import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import type { Bobs27RoundData, CricketRoundData, HalfItRoundData, X01RoundData } from "@/types/api"

interface Params { params: Promise<{ gameMode: string }> }

export async function GET(req: Request, { params }: Params) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { gameMode } = await params

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true } })
  if (!user?.playerId) return NextResponse.json({ stats: null })

  const playerId = user.playerId

  const SLUG_MAP: Record<string, string> = {
    halfit: "HALF_IT",
    bobs27: "BOBS_27",
    cricket: "CRICKET",
    x01: "X01",
  }
  const dbGameMode = SLUG_MAP[gameMode.toLowerCase()] ?? gameMode.toUpperCase()

  const sessions = await prisma.practiceSession.findMany({
    where: {
      gameMode: dbGameMode,
      status: "COMPLETED",
      isBotGame: true,
      players: { some: { playerId } },
    },
    include: {
      rounds: { where: { playerId }, orderBy: { roundNumber: "asc" } },
      players: true,
    },
    orderBy: { startedAt: "desc" },
    take: 200,
  })

  // Win/loss helper: session winner is the human if winnerId === playerId
  const wins = sessions.filter((s) => s.winnerId === playerId).length
  const losses = sessions.filter((s) => s.winnerId && s.winnerId !== playerId).length

  // Per-level breakdown
  const perLevel: Record<number, { wins: number; losses: number }> = {}
  for (const s of sessions) {
    const botPlayer = s.players.find((p) => p.isBot)
    const level = botPlayer?.botLevel ?? 0
    if (!perLevel[level]) perLevel[level] = { wins: 0, losses: 0 }
    if (s.winnerId === playerId) perLevel[level].wins++
    else if (s.winnerId) perLevel[level].losses++
  }

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
      const player = s.players.find((p) => p.playerId === playerId)
      const sessionScore = player?.finalScore ?? 27

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
      wins,
      losses,
      perLevel,
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
    const marksByTarget: Record<string, number> = {}

    for (const s of sessions) {
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
      games: sessions.length,
      wins,
      losses,
      perLevel,
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
    let bestRoundScore = 0

    for (const s of sessions) {
      const player = s.players.find((p) => p.playerId === playerId)
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
      games: sessions.length,
      wins,
      losses,
      perLevel,
      averageFinalScore: sessions.length > 0 ? Math.round(totalFinalScore / sessions.length) : 0,
      bestFinalScore,
      averageHalvesPerGame: sessions.length > 0 ? Math.round((totalHalves / sessions.length) * 10) / 10 : 0,
      bestRoundScore,
    })
  }

  if (dbGameMode === "X01") {
    let totalScoreThrown = 0
    let totalDartsUsed = 0
    let totalDoublesAttempted = 0
    let totalDoublesHit = 0
    let highestCheckout = 0
    let count180s = 0
    let bestLegDarts = Infinity
    let worstLegDarts = 0
    let totalLegsWon = 0
    let totalLegsLost = 0
    let f9TotalScore = 0
    let f9TotalVisits = 0
    const checkoutScoresSet = new Set<number>()

    for (const s of sessions) {
      const visitsByLeg: Record<number, X01RoundData[]> = {}
      for (const r of s.rounds) {
        const d = r.data as X01RoundData
        if (!visitsByLeg[d.legNumber]) visitsByLeg[d.legNumber] = []
        visitsByLeg[d.legNumber].push(d)

        if (!d.isBust) {
          totalScoreThrown += d.scoreThrown
          totalDartsUsed += d.dartsUsed
          if (d.scoreThrown === 180) count180s++
        }
        totalDoublesAttempted += d.doublesAttempted
        if (d.isCheckout) {
          totalDoublesHit++
          if (d.scoreThrown > highestCheckout) highestCheckout = d.scoreThrown
          checkoutScoresSet.add(d.scoreThrown)
        }
      }

      for (const legVisits of Object.values(visitsByLeg)) {
        const legDarts = legVisits.reduce((acc, v) => acc + v.dartsUsed, 0)
        const legWon = legVisits.some((v) => v.isCheckout)
        if (legWon) {
          totalLegsWon++
          if (legDarts < bestLegDarts) bestLegDarts = legDarts
        } else {
          totalLegsLost++
          if (legDarts > worstLegDarts) worstLegDarts = legDarts
        }

        // First 9 average: first 3 visits per leg
        for (let i = 0; i < Math.min(3, legVisits.length); i++) {
          const v = legVisits[i]
          f9TotalScore += v.isBust ? 0 : v.scoreThrown
          f9TotalVisits++
        }
      }
    }

    const threedartAvg =
      totalDartsUsed > 0 ? Math.round((totalScoreThrown / totalDartsUsed) * 3 * 10) / 10 : 0
    const first9Avg =
      f9TotalVisits > 0 ? Math.round((f9TotalScore / f9TotalVisits) * 10) / 10 : 0
    const topCheckouts = [...checkoutScoresSet].sort((a, b) => b - a).slice(0, 3)
    const recentForm = sessions.slice(0, 5).map((s) => {
      const botPlayer = s.players.find((p) => p.isBot)
      return {
        result: (s.winnerId === playerId ? "W" : "L") as "W" | "L",
        botLevel: botPlayer?.botLevel ?? 0,
      }
    })

    return NextResponse.json({
      games: sessions.length,
      wins,
      losses,
      perLevel,
      threedartAvg,
      first9Avg,
      doublesHitPct: totalDoublesAttempted > 0 ? Math.round((totalDoublesHit / totalDoublesAttempted) * 100) : 0,
      highestCheckout: highestCheckout > 0 ? highestCheckout : null,
      topCheckouts,
      count180s,
      bestLegDarts: bestLegDarts < Infinity ? bestLegDarts : null,
      worstLegDarts: worstLegDarts > 0 ? worstLegDarts : null,
      totalLegsWon,
      totalLegsLost,
      recentForm,
    })
  }

  return NextResponse.json({ stats: null })
}
