import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/auth"

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const target = req.nextUrl.searchParams.get("target")

  if (target === "casual-matches") {
    // Matches not linked to a fixture and not linked to a bracket node
    const matches = await prisma.match.findMany({
      where: { fixture: null, bracketNodeId: null },
      select: { id: true },
    })
    const matchIds = matches.map((m) => m.id)

    await prisma.$transaction([
      prisma.visit.deleteMany({ where: { leg: { matchId: { in: matchIds } } } }),
      prisma.leg.deleteMany({ where: { matchId: { in: matchIds } } }),
      prisma.match.deleteMany({ where: { id: { in: matchIds } } }),
    ])

    return NextResponse.json({ deleted: matchIds.length })
  }

  if (target === "competitions") {
    // Get all fixture IDs so we can find linked matches
    const fixtures = await prisma.fixture.findMany({ select: { id: true, matchId: true } })
    const fixtureMatchIds = fixtures.map((f) => f.matchId).filter(Boolean) as string[]

    // Get bracket match IDs
    const bracketNodes = await prisma.bracketNode.findMany({ select: { matchId: true } })
    const bracketMatchIds = bracketNodes.map((n) => n.matchId).filter(Boolean) as string[]

    const competitionMatchIds = [...new Set([...fixtureMatchIds, ...bracketMatchIds])]

    await prisma.$transaction([
      // Null out fixture.matchId so matches can be deleted
      prisma.fixture.updateMany({ data: { matchId: null } }),
      // Delete visit data for competition matches
      prisma.visit.deleteMany({ where: { leg: { matchId: { in: competitionMatchIds } } } }),
      prisma.leg.deleteMany({ where: { matchId: { in: competitionMatchIds } } }),
      prisma.match.deleteMany({ where: { id: { in: competitionMatchIds } } }),
      // Delete competition structure (Competition → Division → DivisionPlayer cascades)
      prisma.bracketNode.deleteMany({}),
      prisma.fixture.deleteMany({}),
      prisma.competition.deleteMany({}),
    ])

    return NextResponse.json({ deleted: true })
  }

  const id = req.nextUrl.searchParams.get("id")

  if (target === "competition" && id) {
    const fixtures = await prisma.fixture.findMany({
      where: { competitionId: id },
      select: { matchId: true },
    })
    const fixtureMatchIds = fixtures.map((f) => f.matchId).filter(Boolean) as string[]

    const bracketNodes = await prisma.bracketNode.findMany({
      where: { competitionId: id },
      select: { matchId: true },
    })
    const bracketMatchIds = bracketNodes.map((n) => n.matchId).filter(Boolean) as string[]

    const matchIds = [...new Set([...fixtureMatchIds, ...bracketMatchIds])]

    await prisma.$transaction([
      prisma.fixture.updateMany({ where: { competitionId: id }, data: { matchId: null } }),
      prisma.visit.deleteMany({ where: { leg: { matchId: { in: matchIds } } } }),
      prisma.leg.deleteMany({ where: { matchId: { in: matchIds } } }),
      prisma.match.deleteMany({ where: { id: { in: matchIds } } }),
      prisma.bracketNode.deleteMany({ where: { competitionId: id } }),
      prisma.fixture.deleteMany({ where: { competitionId: id } }),
      prisma.competition.delete({ where: { id } }),
    ])

    return NextResponse.json({ deleted: true })
  }

  if (target === "match" && id) {
    // Only allow deleting casual matches (no fixture, no bracket)
    const match = await prisma.match.findUnique({
      where: { id },
      include: { fixture: true },
    })
    if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (match.fixture || match.bracketNodeId) {
      return NextResponse.json({ error: "Cannot delete competition matches here" }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.visit.deleteMany({ where: { leg: { matchId: id } } }),
      prisma.leg.deleteMany({ where: { matchId: id } }),
      prisma.match.delete({ where: { id } }),
    ])

    return NextResponse.json({ deleted: true })
  }

  if (target === "practice-sessions") {
    await prisma.practiceSession.deleteMany({})
    return NextResponse.json({ deleted: true })
  }

  if (target === "practice-session" && id) {
    await prisma.practiceSession.delete({ where: { id } })
    return NextResponse.json({ deleted: true })
  }

  return NextResponse.json({ error: "Invalid target" }, { status: 400 })
}
