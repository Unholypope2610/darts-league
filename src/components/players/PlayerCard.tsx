"use client"

import { useState } from "react"
import Link from "next/link"
import { Trophy } from "lucide-react"
import { PlayerAvatar } from "./PlayerAvatar"
import { cn } from "@/lib/utils/cn"
import { usePresence } from "@/contexts/PlayerPresenceContext"
import { ChallengeModal } from "@/components/match/ChallengeModal"
import type { Player } from "@/types/api"

interface PlayerCardProps {
  player: Player
  rank?: number
}

export function PlayerCard({ player, rank }: PlayerCardProps) {
  const played = player.won + player.lost + player.drawn
  const winPct = played >= 5 ? ((player.won / played) * 100).toFixed(1) : null
  const { onlinePlayerIds, myPlayerId } = usePresence()
  const [challenging, setChallenging] = useState(false)
  const isOnline = onlinePlayerIds.has(player.id) && player.id !== myPlayerId

  return (
    <div className="relative flex flex-col rounded-xl border bg-card transition-all group hover:border-primary/50"
      style={{ borderColor: isOnline ? "rgba(16,185,129,0.4)" : undefined }}
    >
      {isOnline && (
        <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-card z-10" />
      )}

      <Link
        href={`/players/${player.id}`}
        className="flex flex-col gap-3 p-4"
      >
        {/* Top row: avatar + name */}
        <div className="flex items-center gap-3">
          <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate group-hover:text-primary transition-colors">{player.name}</p>
            {player.nickname && (
              <p className="text-xs text-muted-foreground truncate">"{player.nickname}"</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {player.rankedTitles > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                <Trophy className="size-2.5" />
                {player.rankedTitles}
              </span>
            )}
            {player.titles > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Trophy className="size-2.5" />
                {player.titles}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{player.hand === "LEFT" ? "L" : "R"}</span>
            {rank !== undefined && (
              <span className={cn(
                "text-[10px] font-black px-1.5 py-0.5 rounded-full border",
                rank === 1 ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                rank === 2 ? "bg-zinc-400/15 text-zinc-300 border-zinc-400/30" :
                rank === 3 ? "bg-orange-700/15 text-orange-600 border-orange-700/30" :
                "bg-violet-500/10 text-violet-400 border-violet-500/20"
              )}>
                #{rank}
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-1 text-center">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Avg</span>
            <span className="font-score font-bold text-sm text-primary">
              {played > 0 ? player.average.toFixed(2) : "—"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">W</span>
            <span className="font-score font-bold text-sm text-emerald-400">{player.won}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">D</span>
            <span className="font-score font-bold text-sm text-muted-foreground">{player.drawn}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">L</span>
            <span className="font-score font-bold text-sm text-red-400">{player.lost}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Win%</span>
            <span className="font-score font-bold text-sm text-amber-400">
              {winPct !== null ? `${winPct}%` : "—"}
            </span>
          </div>
        </div>

        {/* Badges row */}
        {(player.count180s > 0 || player.topCheckouts.length > 0 || player.doublesPercentage > 0 || player.first9Average > 0 || player.bestLeg !== null) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {player.count180s > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                180 ×{player.count180s}
              </span>
            )}
            {player.topCheckouts.map((c, i) => (
              <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {c}
              </span>
            ))}
            {player.doublesPercentage > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {player.doublesPercentage.toFixed(1)}% D
              </span>
            )}
            {player.first9Average > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                F9: {player.first9Average.toFixed(2)}
              </span>
            )}
            {player.bestLeg !== null && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                BL: {player.bestLeg}d
              </span>
            )}
          </div>
        )}

        {/* Form dots — last 5 matches */}
        {player.recentForm.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-0.5">Form</span>
            {player.recentForm.map((r, i) => (
              <span
                key={i}
                className={cn(
                  "w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center",
                  r === "W" ? "bg-emerald-500/20 text-emerald-400" :
                  r === "D" ? "bg-muted text-muted-foreground" :
                  "bg-red-500/20 text-red-400",
                )}
              >
                {r}
              </span>
            ))}
          </div>
        )}
      </Link>

      {isOnline && (
        <button
          onClick={() => setChallenging(true)}
          className="mx-3 mb-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all active:scale-95"
        >
          Challenge
        </button>
      )}

      {challenging && (
        <ChallengeModal
          open={challenging}
          opponent={{ id: player.id, name: player.name, avatarUrl: player.avatarUrl ?? null }}
          myPlayerId={myPlayerId}
          onClose={() => setChallenging(false)}
        />
      )}
    </div>
  )
}
