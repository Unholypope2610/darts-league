"use client"

import { use } from "react"
import Link from "next/link"
import { usePlayer } from "@/hooks/usePlayers"
import { PageHeader } from "@/components/shared/PageHeader"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

interface PageProps {
  params: Promise<{ playerId: string }>
}

export default function PlayerProfilePage({ params }: PageProps) {
  const { playerId } = use(params)
  const { data: player, isLoading } = usePlayer(playerId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (!player) {
    return <p className="text-muted-foreground">Player not found.</p>
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <PageHeader
        title={player.name}
        actions={
          <Link
            href={`/players/${player.id}/edit`}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Edit
          </Link>
        }
      />

      <div className="rounded-xl border border-border bg-card p-6 flex items-center gap-5">
        <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="xl" />
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">{player.name}</h2>
          {player.nickname && <p className="text-muted-foreground">"{player.nickname}"</p>}
          <Badge variant="outline">{player.hand === "LEFT" ? "Left-handed" : "Right-handed"}</Badge>
        </div>
      </div>
    </div>
  )
}
