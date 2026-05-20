import Link from "next/link"
import { PlayerAvatar } from "./PlayerAvatar"
import type { Player } from "@/types/api"

interface PlayerCardProps {
  player: Player
}

export function PlayerCard({ player }: PlayerCardProps) {
  const played = player.won + player.lost + player.drawn

  return (
    <Link
      href={`/players/${player.id}`}
      className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all group"
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
        <span className="text-xs text-muted-foreground shrink-0">{player.hand === "LEFT" ? "L" : "R"}</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-1 text-center">
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
      </div>

      {/* Badges row */}
      {(player.count180s > 0 || player.topCheckouts.length > 0 || player.doublesPercentage > 0) && (
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
        </div>
      )}
    </Link>
  )
}
