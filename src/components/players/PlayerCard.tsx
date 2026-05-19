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
    </Link>
  )
}
