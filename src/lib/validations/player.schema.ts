import { z } from "zod"

export const createPlayerSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  nickname: z.string().max(30).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  hand: z.enum(["LEFT", "RIGHT"]).default("RIGHT"),
})

export const updatePlayerSchema = createPlayerSchema.partial()

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>
export type UpdatePlayerInput = z.infer<typeof updatePlayerSchema>
