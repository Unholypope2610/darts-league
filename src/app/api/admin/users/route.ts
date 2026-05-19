import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/auth"
import { clerkClient } from "@clerk/nextjs/server"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { player: true },
  })
  return NextResponse.json(users)
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { targetUserId, role, playerId } = body as {
    targetUserId: string
    role?: string
    playerId?: string | null
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      ...(role && { role }),
      ...(playerId !== undefined && { playerId }),
    },
    include: { player: true },
  })

  return NextResponse.json(user)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { email } = body as { email: string }
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const clerk = await clerkClient()
  const invitation = await clerk.invitations.createInvitation({
    emailAddress: email,
    redirectUrl: `${process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ?? "/dashboard"}`,
  })

  return NextResponse.json({ invitationId: invitation.id }, { status: 201 })
}
