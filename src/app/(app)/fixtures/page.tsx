"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/PageHeader"
import { FixtureCard } from "@/components/fixtures/FixtureCard"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/EmptyState"
import { Calendar } from "lucide-react"

interface GlobalFixture {
  id: string
  matchday: number
  status: string
  matchId?: string | null
  scheduledAt?: string | null
  competition: { id: string; name: string }
  playerA: { id: string; name: string; avatarUrl?: string | null }
  playerB: { id: string; name: string; avatarUrl?: string | null }
  match?: { playerAScore: number; playerBScore: number } | null
}

export default function GlobalFixturesPage() {
  const { data: competitions } = useQuery<{ id: string; name: string; status: string }[]>({
    queryKey: ["competitions"],
    queryFn: () => fetch("/api/competitions").then((r) => r.json()),
  })

  const activeComps = competitions?.filter((c) => c.status === "ACTIVE") ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Fixtures" description="All upcoming fixtures across active competitions" />

      {activeComps.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-10 h-10" />}
          title="No active competitions"
          action={<Link href="/competitions/new" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Create Competition</Link>}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {activeComps.map((comp) => (
            <CompetitionFixtures key={comp.id} competition={comp} />
          ))}
        </div>
      )}
    </div>
  )
}

function CompetitionFixtures({ competition }: { competition: { id: string; name: string } }) {
  const { data: fixtures, isLoading } = useQuery<GlobalFixture[]>({
    queryKey: ["fixtures", competition.id],
    queryFn: () => fetch(`/api/competitions/${competition.id}/fixtures`).then((r) => r.json()),
  })

  const upcoming = fixtures?.filter((f) => f.status !== "COMPLETED").slice(0, 5) ?? []

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <Link href={`/competitions/${competition.id}/fixtures`} className="font-semibold hover:text-primary transition-colors">
          {competition.name} →
        </Link>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : upcoming.length > 0 ? (
        <div className="flex flex-col gap-2">
          {upcoming.map((f) => <FixtureCard key={f.id} fixture={f} canScore={true} />)}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">All fixtures completed.</p>
      )}
    </section>
  )
}
