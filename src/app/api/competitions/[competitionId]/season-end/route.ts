import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/auth"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { competitionId } = await params
  const body = await req.json().catch(() => ({}))
  const { promotionCount = 2 } = body as { promotionCount?: number }

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    include: {
      divisions: {
        include: { players: { include: { player: true } } },
        orderBy: { tier: "asc" },
      },
    },
  })
  if (!competition) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (competition.type !== "DIVISIONS") {
    return NextResponse.json({ error: "Only DIVISIONS competitions support season end" }, { status: 400 })
  }

  const tier1 = competition.divisions.find((d) => d.tier === 1)
  const tier2 = competition.divisions.find((d) => d.tier === 2)
  if (!tier1 || !tier2) {
    return NextResponse.json({ error: "Two divisions required" }, { status: 400 })
  }

  // The caller sends sorted standings; we trust the table order
  // Body: { tier1Standings: string[], tier2Standings: string[] }
  const { tier1Standings, tier2Standings } = body as {
    tier1Standings: string[]
    tier2Standings: string[]
  }

  if (!tier1Standings || !tier2Standings) {
    return NextResponse.json({ error: "Standings required" }, { status: 400 })
  }

  // Relegated: bottom N of tier 1
  const relegated = tier1Standings.slice(-promotionCount)
  // Promoted: top N of tier 2
  const promoted = tier2Standings.slice(0, promotionCount)

  await prisma.$transaction([
    // Remove relegated from tier 1
    prisma.divisionPlayer.deleteMany({
      where: { divisionId: tier1.id, playerId: { in: relegated } },
    }),
    // Remove promoted from tier 2
    prisma.divisionPlayer.deleteMany({
      where: { divisionId: tier2.id, playerId: { in: promoted } },
    }),
    // Add relegated to tier 2
    ...relegated.map((pid) =>
      prisma.divisionPlayer.create({
        data: { divisionId: tier2.id, playerId: pid },
      }),
    ),
    // Add promoted to tier 1
    ...promoted.map((pid) =>
      prisma.divisionPlayer.create({
        data: { divisionId: tier1.id, playerId: pid },
      }),
    ),
    // Mark competition completed
    prisma.competition.update({
      where: { id: competitionId },
      data: { status: "COMPLETED" },
    }),
  ])

  return NextResponse.json({ promoted, relegated })
}
