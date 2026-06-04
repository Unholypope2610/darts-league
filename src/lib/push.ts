import webpush from "web-push"
import { prisma } from "@/lib/prisma"

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

async function sendToUser(
  userId: string,
  payload: { title: string; body: string; url: string },
) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } })
  if (subs.length === 0) return
  const body = JSON.stringify(payload)
  await Promise.allSettled(
    subs.map((s) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body)
        .catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 410) await prisma.pushSubscription.delete({ where: { id: s.id } })
        }),
    ),
  )
}

export async function sendPracticeSessionPush(
  userId: string,
  creatorName: string,
  sessionId: string,
  gameModeLabel: string,
  role: "participant" | "spectator",
) {
  await sendToUser(userId, {
    title: "Practice Arena",
    body: role === "participant"
      ? `${creatorName} has started a ${gameModeLabel} session — join now!`
      : `${creatorName} is playing ${gameModeLabel} — watch live!`,
    url: `/practice/${sessionId}`,
  })
}

export async function sendMatchStartPush(
  userId: string,
  opponentName: string,
  matchId: string,
) {
  await sendToUser(userId, {
    title: "Match Starting",
    body: `Your match vs ${opponentName} is starting now`,
    url: `/matches/${matchId}/live`,
  })
}
