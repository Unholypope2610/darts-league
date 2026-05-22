"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { useBracket } from "@/hooks/useBracket"
import { BracketView } from "@/components/bracket/BracketView"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Network } from "lucide-react"
import type { Competition } from "@/types/api"

function CompetitionBracket({ competition }: { competition: Competition }) {
  const { data: nodes, isLoading } = useBracket(competition.id)

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">{competition.name}</h2>
          <p className="text-xs text-muted-foreground">{competition.season}</p>
        </div>
        <Link
          href={`/competitions/${competition.id}/bracket`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Full bracket →
        </Link>
      </div>
      {nodes?.length ? (
        <BracketView nodes={nodes} competitionId={competition.id} canScore={true} />
      ) : (
        <p className="text-sm text-muted-foreground">No bracket generated yet. Go to the competition to generate one.</p>
      )}
    </div>
  )
}

export default function BracketsPage() {
  const { data: competitions, isLoading } = useQuery<Competition[]>({
    queryKey: ["competitions"],
    queryFn: () => fetch("/api/competitions").then((r) => r.json()),
  })

  const active = competitions?.filter((c) => c.status === "ACTIVE") ?? []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Brackets" description="Knockout brackets across all active competitions" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Brackets" description="Knockout brackets across all active competitions" />
      {active.length === 0 ? (
        <EmptyState
          icon={<Network className="w-10 h-10" />}
          title="No active competitions"
          description="Activate a competition to see knockout brackets here"
          action={<Link href="/competitions" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">Go to Competitions</Link>}
        />
      ) : (
        active.map((comp) => (
          <CompetitionBracket key={comp.id} competition={comp} />
        ))
      )}
    </div>
  )
}
