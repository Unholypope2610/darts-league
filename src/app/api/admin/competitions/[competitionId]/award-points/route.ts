import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { awardRankingPoints } from "@/lib/utils/award-ranking-points"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { competitionId } = await params
  try {
    await awardRankingPoints(competitionId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[award-points]", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
