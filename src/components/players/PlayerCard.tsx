import Link from "next/link"
import { PlayerAvatar } from "./PlayerAvatar"
import type { Player } from "@prisma/client"

interface PlayerCardProps {
  player: Player
}

export function PlayerCard({ player }: PlayerCardProps) {
  return (
    <Link
      href={`/players/${player.id}`}
      className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-card/80 transition-all group"
    >
      <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate group-hover:text-primary transition-colors">{player.name}</p>
        {player.nickname && <p className="text-sm text-muted-foreground truncate">"{player.nickname}"</p>}
      </div>
      <span className="text-xs text-muted-foreground">{player.hand === "LEFT" ? "L" : "R"}</span>
    </Link>
  )
}
