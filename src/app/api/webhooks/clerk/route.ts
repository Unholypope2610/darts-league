import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { Webhook } from "svix"
import { prisma } from "@/lib/prisma"

type ClerkWebhookEvent = {
  type: string
  data: {
    id: string
    email_addresses: { email_address: string }[]
  }
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: "No webhook secret configured" }, { status: 500 })
  }

  const headersList = await headers()
  const svixId = headersList.get("svix-id") ?? ""
  const svixTimestamp = headersList.get("svix-timestamp") ?? ""
  const svixSignature = headersList.get("svix-signature") ?? ""

  const body = await req.text()

  let event: ClerkWebhookEvent
  try {
    const wh = new Webhook(webhookSecret)
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  const { type, data } = event
  const email = data.email_addresses[0]?.email_address ?? ""

  if (type === "user.created") {
    const role = email === process.env.ADMIN_EMAIL ? "ADMIN" : "PLAYER"
    await prisma.user.upsert({
      where: { id: data.id },
      update: { email },
      create: { id: data.id, email, role },
    })
  }

  if (type === "user.updated") {
    await prisma.user.upsert({
      where: { id: data.id },
      update: { email },
      create: { id: data.id, email, role: "PLAYER" },
    })
  }

  return NextResponse.json({ received: true })
}
