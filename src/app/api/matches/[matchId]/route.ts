import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params
  const body = await req.json()

  if (typeof body.isLocal !== "boolean") {
    return NextResponse.json({ error: "isLocal must be a boolean" }, { status: 400 })
  }

  const match = await prisma.match.update({
    where: { id: matchId },
    data: { isLocal: body.isLocal },
  })

  return NextResponse.json({ ok: true, isLocal: match.isLocal })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { matchId } = await params

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      playerA: true,
      playerB: true,
      winner: true,
      legs: {
        include: {
          visits: { orderBy: { visitNumber: "asc" } },
          starter: true,
        },
        orderBy: { legNumber: "asc" },
      },
      fixture: {
        include: { competition: true, division: true },
      },
    },
  })
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(match)
}
