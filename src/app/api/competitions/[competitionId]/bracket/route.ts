import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { competitionId } = await params

  const nodes = await prisma.bracketNode.findMany({
    where: { competitionId },
    include: {
      seedA: true,
      seedB: true,
      winner: true,
      match: {
        include: { legs: true },
      },
    },
    orderBy: [{ round: "desc" }, { position: "asc" }],
  })

  return NextResponse.json(nodes)
}
