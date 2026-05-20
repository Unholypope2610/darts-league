"use client"

import Link from "next/link"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { FormDots } from "./FormDots"
import { cn } from "@/lib/utils/cn"
import type { LeagueTableRow } from "@/types/table"
import { formatAverage } from "@/lib/utils/format"

interface LeagueTableProps {
  rows: LeagueTableRow[]
  topQualifyCount?: number
  promotionCount?: number
  relegationCount?: number
}

export function LeagueTable({
  rows,
  topQualifyCount = 4,
  promotionCount = 0,
  relegationCount = 0,
}: LeagueTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left px-3 py-3 font-medium text-muted-foreground w-8">#</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground">Player</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-10">P</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-10">W</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-10">D</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-10">L</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-12">LF</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-12">LA</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-12">LD</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-16 hidden sm:table-cell">Avg</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-14 hidden sm:table-cell">D%</th>
            <th className="text-center px-2 py-3 font-medium text-muted-foreground w-10">Pts</th>
            <th className="text-left px-3 py-3 font-medium text-muted-foreground hidden md:table-cell">Form</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const position = idx + 1
            const isPromotion = promotionCount > 0 && position <= promotionCount
            const isRelegation =
              relegationCount > 0 && position > rows.length - relegationCount
            const isTopQualify = topQualifyCount > 0 && position <= topQualifyCount && !promotionCount

            return (
              <tr
                key={row.playerId}
                className={cn(
                  "border-b border-border/50 hover:bg-muted/30 transition-colors",
                  isPromotion && "border-l-2 border-l-emerald-500",
                  isRelegation && "border-l-2 border-l-red-500",
                  isTopQualify && "border-l-2 border-l-emerald-500",
                )}
              >
                <td className="px-3 py-3 text-muted-foreground font-mono">{position}</td>
                <td className="px-3 py-3">
                  <Link
                    href={`/players/${row.playerId}`}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <PlayerAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
                    <span className="font-medium truncate max-w-[140px]">{row.name}</span>
                  </Link>
                </td>
                <td className="px-2 py-3 text-center font-mono">{row.played}</td>
                <td className="px-2 py-3 text-center font-mono text-emerald-500">{row.won}</td>
                <td className="px-2 py-3 text-center font-mono text-amber-500">{row.drawn}</td>
                <td className="px-2 py-3 text-center font-mono text-red-500">{row.lost}</td>
                <td className="px-2 py-3 text-center font-mono">{row.legsFor}</td>
                <td className="px-2 py-3 text-center font-mono">{row.legsAgainst}</td>
                <td className={cn("px-2 py-3 text-center font-mono", row.legDifference > 0 ? "text-emerald-500" : row.legDifference < 0 ? "text-red-500" : "")}>
                  {row.legDifference > 0 ? `+${row.legDifference}` : row.legDifference}
                </td>
                <td className="px-2 py-3 text-center font-mono hidden sm:table-cell">
                  {formatAverage(row.average)}
                </td>
                <td className="px-2 py-3 text-center font-mono hidden sm:table-cell">
                  {row.doublesPercentage > 0 ? `${row.doublesPercentage.toFixed(1)}%` : "—"}
                </td>
                <td className="px-2 py-3 text-center font-bold font-mono">{row.points}</td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <FormDots form={row.form} />
                </td>
              </tr>
            )
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={13} className="px-4 py-8 text-center text-muted-foreground text-sm">
                No fixtures played yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
