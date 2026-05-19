"use client"

import Link from "next/link"
import { useCompetitions } from "@/hooks/useCompetitions"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Trophy } from "lucide-react"
import type { Competition } from "@/types/api"

const TYPE_LABELS: Record<string, string> = {
  SINGLE_LEAGUE: "League",
  DIVISIONS: "Divisions",
  KNOCKOUT: "Knockout",
}

function CompRow({ comp }: { comp: Competition }) {
  return (
    <Link
      href={`/competitions/${comp.id}`}
      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all"
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{comp.name}</p>
        <p className="text-sm text-muted-foreground">{comp.season}</p>
      </div>
      <Badge variant="outline" className="shrink-0">{TYPE_LABELS[comp.type] ?? comp.type}</Badge>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
        comp.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" :
        comp.status === "DRAFT" ? "bg-amber-500/10 text-amber-400" :
        "bg-muted text-muted-foreground"
      }`}>{comp.status}</span>
    </Link>
  )
}

export default function CompetitionsPage() {
  const { data: competitions, isLoading } = useCompetitions()

  const byStatus = {
    all: competitions ?? [],
    ACTIVE: competitions?.filter((c) => c.status === "ACTIVE") ?? [],
    DRAFT: competitions?.filter((c) => c.status === "DRAFT") ?? [],
    COMPLETED: competitions?.filter((c) => c.status === "COMPLETED") ?? [],
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Competitions"
        actions={
          <Link href="/competitions/new" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            + New
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All ({byStatus.all.length})</TabsTrigger>
            <TabsTrigger value="ACTIVE">Active ({byStatus.ACTIVE.length})</TabsTrigger>
            <TabsTrigger value="DRAFT">Draft ({byStatus.DRAFT.length})</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed ({byStatus.COMPLETED.length})</TabsTrigger>
          </TabsList>
          {(["all", "ACTIVE", "DRAFT", "COMPLETED"] as const).map((tab) => (
            <TabsContent key={tab} value={tab}>
              {byStatus[tab].length > 0 ? (
                <div className="flex flex-col gap-3">
                  {byStatus[tab].map((c) => <CompRow key={c.id} comp={c} />)}
                </div>
              ) : (
                <EmptyState
                  icon={<Trophy className="w-10 h-10" />}
                  title="No competitions"
                  action={<Link href="/competitions/new" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Create one</Link>}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
