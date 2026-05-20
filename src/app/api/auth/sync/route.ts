import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const clerk = await clerkClient()
  const clerkUser = await clerk.users.getUser(userId)
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""
  const adminEmail = process.env.ADMIN_EMAIL ?? ""
  const role = email.toLowerCase() === adminEmail.toLowerCase() ? "ADMIN" : "PLAYER"

  const user = await prisma.user.upsert({
    where: { id: userId },
    update: { email },
    create: { id: userId, email, role },
  })

  return NextResponse.json({ id: user.id, email: user.email, role: user.role, debug_email: email, debug_admin: adminEmail })
}
