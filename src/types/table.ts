export type FormResult = "W" | "D" | "L"

export interface LeagueTableRow {
  playerId: string
  name: string
  avatarUrl: string | null
  played: number
  won: number
  drawn: number
  lost: number
  legsFor: number
  legsAgainst: number
  legDifference: number
  average: number
  points: number
  form: FormResult[]
}
