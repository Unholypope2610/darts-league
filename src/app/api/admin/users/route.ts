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
  const { email, force } = body as { email: string; force?: boolean }
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const clerk = await clerkClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  if (force) {
    // Revoke any existing pending invitation for this email before re-creating
    const existing = await clerk.invitations.getInvitationList({ status: "pending" })
    const match = existing.data.find((inv) => inv.emailAddress === email)
    if (match) await clerk.invitations.revokeInvitation(match.id)
  }

  try {
    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      ...(appUrl && { redirectUrl: `${appUrl}/sign-up` }),
    })
    return NextResponse.json({ invitationId: invitation.id, inviteUrl: invitation.url }, { status: 201 })
  } catch (err: unknown) {
    const clerkErr = err as { errors?: { message: string }[]; message?: string }
    const message = clerkErr?.errors?.[0]?.message ?? clerkErr?.message ?? "Failed to create invitation"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
