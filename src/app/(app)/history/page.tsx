"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { PlayerAvatar } from "@/components/players/PlayerAvatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy } from "lucide-react"

interface HistoryEntry {
  id: string
  name: string
  season: string
  type: string
  status: string
  winner?: { id: string; name: string; avatarUrl?: string | null } | null
}

const TYPE_LABELS: Record<string, string> = {
  SINGLE_LEAGUE: "League",
  DIVISIONS: "Divisions",
  KNOCKOUT: "Knockout",
}

export default function HistoryPage() {
  const { data, isLoading } = useQuery<HistoryEntry[]>({
    queryKey: ["history"],
    queryFn: () => fetch("/api/history").then((r) => r.json()),
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Champions Wall"
        description="Season archive and past winners"
        actions={
          <Link
            href="/history/records"
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Hall of Fame →
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : data?.length ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Competition</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Season</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Winner</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry) => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{entry.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.season}</td>
                  <td className="px-4 py-3 text-muted-foreground">{TYPE_LABELS[entry.type] ?? entry.type}</td>
                  <td className="px-4 py-3">
                    {entry.winner ? (
                      <div className="flex items-center gap-2">
                        <PlayerAvatar name={entry.winner.name} avatarUrl={entry.winner.avatarUrl} size="sm" />
                        <span className="font-medium">{entry.winner.name}</span>
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={<Trophy className="w-12 h-12" />}
          title="No completed seasons yet"
          description="Season history will appear here once competitions are completed"
        />
      )}
    </div>
  )
}
