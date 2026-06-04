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
    const hitsByDouble: Record<string, { hits: number; attempts: number }> = {}
    let totalScore = 0
    let bestScore = -Infinity
    let perfectRounds = 0
    let games = 0

    for (const s of sessions) {
      games++
      let sessionScore = 27
      const player = s.players[0]
      if (!player) continue
      sessionScore = player.finalScore ?? 27

      for (const r of s.rounds) {
        const d = r.data as Bobs27RoundData
        if (!hitsByDouble[d.target]) hitsByDouble[d.target] = { hits: 0, attempts: 0 }
        hitsByDouble[d.target].attempts++
        if (d.dartsHit > 0) hitsByDouble[d.target].hits++
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
      hitsByDouble,
    })
  }

  if (dbGameMode === "CRICKET") {
    let totalMarks = 0
    let totalDarts = 0
    let wins = 0
    const marksByTarget: Record<string, number> = {}
    const dartsByTarget: Record<string, number> = {}

    for (const s of sessions) {
      if (s.winnerId) {
        const player = s.players[0]
        if (player && s.winnerId === player.playerId) wins++
      }
      for (const r of s.rounds) {
        const d = r.data as CricketRoundData
        for (const [target, marks] of Object.entries(d.marksEarned)) {
          totalMarks += marks
          marksByTarget[target] = (marksByTarget[target] ?? 0) + marks
        }
        totalDarts += d.darts.length
        for (const dart of d.darts) {
          dartsByTarget[dart.target] = (dartsByTarget[dart.target] ?? 0) + 1
        }
      }
    }

    const mpd = totalDarts > 0 ? totalMarks / totalDarts : 0
    const sessions2 = sessions.length
    const mpr = sessions2 > 0 && sessions[0]?.rounds.length > 0
      ? totalMarks / sessions2
      : 0

    return NextResponse.json({
      games: sessions2,
      wins,
      mpd: Math.round(mpd * 100) / 100,
      mpr: Math.round(mpr * 100) / 100,
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
