"use client"

import { cn } from "@/lib/utils/cn"
import type { VisitRecord } from "@/types/api"

interface LegHistoryProps {
  visits: VisitRecord[]
  playerAId: string
  playerBId: string
  playerAName: string
  playerBName: string
}

export function LegHistory({ visits, playerAId, playerBId, playerAName, playerBName }: LegHistoryProps) {
  if (visits.length === 0) return null

  const grouped: { a: VisitRecord | null; b: VisitRecord | null }[] = []
  const aVisits = visits.filter((v) => v.playerId === playerAId)
  const bVisits = visits.filter((v) => v.playerId === playerBId)
  const maxLen = Math.max(aVisits.length, bVisits.length)
  for (let i = 0; i < maxLen; i++) {
    grouped.push({ a: aVisits[i] ?? null, b: bVisits[i] ?? null })
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
      <div className="grid grid-cols-2 border-b border-border">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground text-center truncate">{playerAName}</div>
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground text-center truncate border-l border-border">{playerBName}</div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {grouped.map((row, i) => (
          <div key={i} className="grid grid-cols-2 border-b border-border/50 last:border-0">
            <VisitCell visit={row.a} />
            <div className="border-l border-border/50">
              <VisitCell visit={row.b} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VisitCell({ visit }: { visit: VisitRecord | null }) {
  if (!visit) return <div className="px-3 py-2 h-9" />
  return (
    <div className="px-3 py-2 flex items-center justify-between gap-2">
      <span
        className={cn(
          "font-score text-sm font-bold",
          visit.isBust ? "text-red-500 line-through" : visit.isCheckout ? "text-emerald-400" : "text-foreground",
        )}
      >
        {visit.isBust ? "BUST" : visit.scoreThrown}
      </span>
      <span className="font-score text-xs text-muted-foreground">{visit.runningRemainder}</span>
    </div>
  )
}
