"use client"

import { useState } from "react"
import { cn } from "@/lib/utils/cn"
import type { VisitRecord } from "@/types/api"

interface LegHistoryProps {
  visits: VisitRecord[]
  playerAId: string
  playerBId: string
  playerAName: string
  playerBName: string
  onEdit?: (visitId: string, newScore: number) => void
}

export function LegHistory({ visits, playerAId, playerBId, playerAName, playerBName, onEdit }: LegHistoryProps) {
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
            <VisitCell visit={row.a} onEdit={onEdit} />
            <div className="border-l border-border/50">
              <VisitCell visit={row.b} onEdit={onEdit} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VisitCell({ visit, onEdit }: { visit: VisitRecord | null; onEdit?: (id: string, score: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState("")

  if (!visit) return <div className="px-3 py-2 h-9" />

  function confirm() {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= 0 && n <= 180 && visit) onEdit?.(visit.id, n)
    setEditing(false)
  }

  const canEdit = onEdit && !visit.isBust && !visit.isCheckout

  if (editing) {
    return (
      <div className="px-2 py-1.5 flex items-center gap-1">
        <input
          autoFocus
          type="number"
          min={0}
          max={180}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm()
            if (e.key === "Escape") setEditing(false)
          }}
          className="w-12 bg-muted rounded px-1 py-0.5 text-sm font-score font-bold text-center border border-primary outline-none"
        />
        <button onClick={confirm} className="text-emerald-400 text-xs font-bold touch-manipulation" style={{ touchAction: "manipulation" }}>✓</button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground text-xs font-bold touch-manipulation" style={{ touchAction: "manipulation" }}>✕</button>
      </div>
    )
  }

  return (
    <div className="px-2 py-1.5 flex items-center gap-1 group">
      <span
        className={cn(
          "font-score text-sm font-bold",
          visit.isBust ? "text-red-500 line-through" : visit.isCheckout ? "text-emerald-400" : "text-foreground",
        )}
      >
        {visit.isBust ? "BUST" : visit.scoreThrown}
      </span>
      {canEdit && (
        <button
          onClick={() => { setVal(String(visit.scoreThrown)); setEditing(true) }}
          className="opacity-0 group-hover:opacity-60 active:opacity-100 text-muted-foreground text-[10px] touch-manipulation ml-0.5"
          style={{ touchAction: "manipulation" }}
          aria-label="Edit score"
        >
          ✏
        </button>
      )}
      <span className="font-score text-xs text-muted-foreground ml-auto">{visit.runningRemainder}</span>
    </div>
  )
}
