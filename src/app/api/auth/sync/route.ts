import { NextResponse } from "next/server"
import { currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

// Called on app load to ensure the current Clerk user has a DB record.
// Creates the record if missing, using ADMIN_EMAIL to assign role.
export async function POST() {
  const clerkUser = await currentUser()
  if (!clerkUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ""
  const role = email === process.env.ADMIN_EMAIL ? "ADMIN" : "PLAYER"

  const user = await prisma.user.upsert({
    where: { id: clerkUser.id },
    update: { email },
    create: { id: clerkUser.id, email, role },
  })

  return NextResponse.json({ id: user.id, email: user.email, role: user.role })
}
