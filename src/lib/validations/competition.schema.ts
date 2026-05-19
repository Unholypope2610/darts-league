import { z } from "zod"

export const createCompetitionSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  type: z.enum(["SINGLE_LEAGUE", "DIVISIONS", "KNOCKOUT"]),
  season: z.string().min(1, "Season is required").max(20),
  startingScore: z.number().int().positive().default(501),
  bestOf: z.number().int().min(1).max(21).default(7),
  finishType: z.enum(["DOUBLE_OUT", "MASTER_OUT", "STRAIGHT_OUT"]).default("DOUBLE_OUT"),
  isSets: z.boolean().default(false),
  legSize: z.number().int().min(1).optional().nullable(),
})

export const updateCompetitionSchema = createCompetitionSchema.partial()

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>
export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>

export const createDivisionSchema = z.object({
  name: z.string().min(1).max(60),
  tier: z.number().int().min(1).max(10),
  playerIds: z.array(z.string()),
})

export const generateFixturesSchema = z.object({
  divisionId: z.string().optional(),
  rounds: z.number().int().min(1).max(10).default(1),
})
