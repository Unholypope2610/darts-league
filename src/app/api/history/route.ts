import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const competitions = await prisma.competition.findMany({
    where: { status: "COMPLETED" },
    orderBy: { updatedAt: "desc" },
    include: {
      winner: { select: { id: true, name: true, avatarUrl: true } },
    },
  })

  return NextResponse.json(competitions)
}
