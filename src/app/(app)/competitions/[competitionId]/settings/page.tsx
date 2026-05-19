"use client"

import { use, useState } from "react"
import { toast } from "sonner"
import { useCompetition, useUpdateCompetition } from "@/hooks/useCompetitions"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { SeasonEndModal } from "@/components/competitions/SeasonEndModal"

interface PageProps {
  params: Promise<{ competitionId: string }>
}

export default function CompetitionSettingsPage({ params }: PageProps) {
  const { competitionId } = use(params)
  const { data: competition, isLoading } = useCompetition(competitionId)
  const { mutate: update, isPending } = useUpdateCompetition(competitionId)
  const [showSeasonEnd, setShowSeasonEnd] = useState(false)

  if (isLoading) return <Skeleton className="h-64 rounded-xl max-w-md" />
  if (!competition) return null

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <h2 className="font-semibold">Settings</h2>

      {/* Status management */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <h3 className="font-medium">Competition Status</h3>
        <p className="text-sm text-muted-foreground">
          Current status: <span className="font-semibold text-foreground">{competition.status}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {competition.status === "DRAFT" && (
            <Button
              size="sm"
              onClick={() => update({ status: "ACTIVE" }, {
                onSuccess: () => toast.success("Competition activated!"),
                onError: () => toast.error("Failed to update status"),
              })}
              disabled={isPending}
            >
              Activate Competition
            </Button>
          )}
          {competition.status === "ACTIVE" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSeasonEnd(true)}
              >
                End Season
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => update({ status: "COMPLETED" }, {
                  onSuccess: () => toast.success("Competition completed!"),
                  onError: () => toast.error("Failed to update status"),
                })}
                disabled={isPending}
              >
                Mark Completed
              </Button>
            </>
          )}
        </div>
      </div>

      <SeasonEndModal
        competitionId={competitionId}
        open={showSeasonEnd}
        onClose={() => setShowSeasonEnd(false)}
      />
    </div>
  )
}
