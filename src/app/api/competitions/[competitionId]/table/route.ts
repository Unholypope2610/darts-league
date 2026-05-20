import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import type { LeagueTableRow } from "@/types/table"
import { calculateAverage, doublesPercentage } from "@/lib/utils/stats"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId } = await params
  const { searchParams } = new URL(req.url)
  const divisionId = searchParams.get("divisionId")

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      divisions: {
        where: divisionId ? { id: divisionId } : undefined,
        include: {
          players: { include: { player: true } },
        },
        orderBy: { tier: "asc" },
      },
    },
  })
  if (!competition) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const tables: { divisionId: string; divisionName: string; rows: LeagueTableRow[] }[] = []

  for (const division of competition.divisions) {
    const playerIds = division.players.map((p) => p.playerId)

    // Fetch all completed matches for this division
    const fixtures = await prisma.fixture.findMany({
      where: { competitionId, divisionId: division.id, status: "COMPLETED" },
      include: {
        match: {
          include: {
            legs: { include: { visits: true } },
          },
        },
        playerA: true,
        playerB: true,
      },
    })

    const rowMap = new Map<string, LeagueTableRow>()

    for (const pid of playerIds) {
      const player = division.players.find((p) => p.playerId === pid)!.player
      rowMap.set(pid, {
        playerId: pid,
        name: player.name,
        avatarUrl: player.avatarUrl,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        legsFor: 0,
        legsAgainst: 0,
        legDifference: 0,
        average: 0,
        doublesPercentage: 0,
        points: 0,
        form: [],
      })
    }

    for (const fixture of fixtures) {
      if (!fixture.match) continue
      const { match } = fixture
      const aId = match.playerAId
      const bId = match.playerBId
      const rowA = rowMap.get(aId)
      const rowB = rowMap.get(bId)
      if (!rowA || !rowB) continue

      rowA.played++
      rowB.played++
      rowA.legsFor += match.playerAScore
      rowA.legsAgainst += match.playerBScore
      rowB.legsFor += match.playerBScore
      rowB.legsAgainst += match.playerAScore

      if (match.winnerId === aId) {
        rowA.won++; rowA.points += 2
        rowB.lost++
        rowA.form.push("W"); rowB.form.push("L")
      } else if (match.winnerId === bId) {
        rowB.won++; rowB.points += 2
        rowA.lost++
        rowA.form.push("L"); rowB.form.push("W")
      } else {
        rowA.drawn++; rowA.points++
        rowB.drawn++; rowB.points++
        rowA.form.push("D"); rowB.form.push("D")
      }

      // Calculate averages from visits
      const allVisits = match.legs.flatMap((l) => l.visits)
      const aVisits = allVisits.filter((v) => v.playerId === aId)
      const bVisits = allVisits.filter((v) => v.playerId === bId)
      // We'll recalculate after all matches
      void aVisits; void bVisits
    }

    // Recalculate averages and checkout% from all visits across all matches
    for (const [pid, row] of rowMap) {
      const allVisitsForPlayer = fixtures.flatMap((f) =>
        f.match?.legs.flatMap((l) => l.visits.filter((v) => v.playerId === pid)) ?? [],
      )
      row.average = parseFloat(calculateAverage(allVisitsForPlayer).toFixed(2))
      row.doublesPercentage = doublesPercentage(allVisitsForPlayer)
      row.legDifference = row.legsFor - row.legsAgainst
      // Keep only last 5 form entries
      row.form = row.form.slice(-5)
    }

    const rows = Array.from(rowMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.legDifference !== a.legDifference) return b.legDifference - a.legDifference
      if (b.legsFor !== a.legsFor) return b.legsFor - a.legsFor
      return b.average - a.average
    })

    tables.push({ divisionId: division.id, divisionName: division.name, rows })
  }

  return NextResponse.json(tables)
}
