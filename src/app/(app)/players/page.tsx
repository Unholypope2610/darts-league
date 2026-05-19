"use client"

import Link from "next/link"
import { usePlayers } from "@/hooks/usePlayers"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { PlayerCard } from "@/components/players/PlayerCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Users } from "lucide-react"

export default function PlayersPage() {
  const { data: players, isLoading } = usePlayers()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Players"
        description="All registered players"
        actions={
          <Link
            href="/players/new"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            + Add Player
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : players?.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {players.map((p) => <PlayerCard key={p.id} player={p} />)}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="w-12 h-12" />}
          title="No players yet"
          description="Add players to get started"
          action={
            <Link href="/players/new" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
              Add Player
            </Link>
          }
        />
      )}
    </div>
  )
}
