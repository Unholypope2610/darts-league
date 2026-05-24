import { z } from "zod"

export const createPlayerSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  nickname: z.string().max(30).optional().nullable(),
  avatarUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  hand: z.enum(["LEFT", "RIGHT"]).default("RIGHT"),
  replayScoreThreshold: z.coerce.number().int().min(60).max(180).default(100),
  replayCheckoutThreshold: z.coerce.number().int().min(40).max(170).default(69),
})

export const updatePlayerSchema = createPlayerSchema.partial()

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>
