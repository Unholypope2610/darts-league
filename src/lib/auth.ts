import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "./prisma"

export async function getCurrentDbUser() {
  const { userId } = await auth()
  if (!userId) return null
  return prisma.user.findUnique({ where: { id: userId }, include: { player: true } })
}

export async function isAdmin(): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) return false
  const user = await prisma.user.findUnique({ where: { id: userId } })
  return user?.role === "ADMIN"
}

export async function requireAdmin() {
  const admin = await isAdmin()
  if (!admin) {
    throw new Error("Forbidden: admin access required")
  }
}

export { auth, currentUser }
