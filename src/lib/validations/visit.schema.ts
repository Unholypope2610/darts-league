import { z } from "zod"

export const recordVisitSchema = z.object({
  legId: z.string(),
  playerId: z.string(),
  scoreThrown: z.number().int().min(0).max(180),
  dartsUsed: z.number().int().min(1).max(3).default(3),
  doublesAttempted: z.number().int().min(1).max(3).default(1),
})

export const startMatchSchema = z.object({
  startingScore: z.number().int().positive().default(501),
  bestOf: z.number().int().min(1).max(21).default(7),
  finishType: z.enum(["DOUBLE_OUT", "MASTER_OUT", "STRAIGHT_OUT"]).default("DOUBLE_OUT"),
  isSets: z.boolean().default(false),
  legSize: z.number().int().min(1).optional().nullable(),
  startingPlayerId: z.string(),
})

export type RecordVisitInput = z.infer<typeof recordVisitSchema>
export type StartMatchInput = z.infer<typeof startMatchSchema>
