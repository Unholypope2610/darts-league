import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "./prisma"

export async function getCurrentDbUser() {
  const { userId } = await auth()
  if (!userId) return null
  return prisma.user.findUnique({ where: { id: userId }, include: { player: true } })
}

export async function isAdmin(): Promise<boolean> {
  const clerkUser = await currentUser()
  if (!clerkUser) return false

  const dbUser = await prisma.user.findUnique({ where: { id: clerkUser.id } })
  if (dbUser) return dbUser.role === "ADMIN"

  // Webhook may not have fired — bootstrap admin from ADMIN_EMAIL env var
  const email = clerkUser.emailAddresses[0]?.emailAddress
  const isAdminEmail = !!email && email === process.env.ADMIN_EMAIL
  if (isAdminEmail) {
    await prisma.user.upsert({
      where: { id: clerkUser.id },
      update: {},
      create: { id: clerkUser.id, email, role: "ADMIN" },
    })
  }
  return isAdminEmail
}

export async function requireAdmin() {
  const admin = await isAdmin()
  if (!admin) {
    throw new Error("Forbidden: admin access required")
  }
}

export async function canEditPlayer(playerId: string): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false
  if (await isAdmin()) return true
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { playerId: true } })
  return user?.playerId === playerId
}

export { auth, currentUser }
