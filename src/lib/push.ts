import webpush from "web-push"
import { prisma } from "@/lib/prisma"

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export async function sendMatchStartPush(
  userId: string,
  opponentName: string,
  matchId: string,
) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return

  const payload = JSON.stringify({
    title: "Match Starting",
    body: `Your match vs ${opponentName} is starting now`,
    url: `/matches/${matchId}/live`,
  })

  await Promise.allSettled(
    subs.map((s) =>
      webpush
        .sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        .catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } })
          }
        }),
    ),
  )
}
