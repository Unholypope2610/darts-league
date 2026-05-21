"use client"

import { use, useState } from "react"
import { toast } from "sonner"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useCompetition, useUpdateCompetition } from "@/hooks/useCompetitions"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SeasonEndModal } from "@/components/competitions/SeasonEndModal"

interface PageProps {
  params: Promise<{ competitionId: string }>
}

export default function CompetitionSettingsPage({ params }: PageProps) {
  const { competitionId } = use(params)
  const qc = useQueryClient()
  const { data: competition, isLoading } = useCompetition(competitionId)
  const { mutate: update, isPending } = useUpdateCompetition(competitionId)
  const [showSeasonEnd, setShowSeasonEnd] = useState(false)
  const [confirmSimulate, setConfirmSimulate] = useState(false)
  const [confirmSimulateBracket, setConfirmSimulateBracket] = useState(false)

  const { data: meData } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => fetch("/api/auth/sync", { method: "POST" }).then((r) => r.json()),
    staleTime: Infinity,
  })
  const isAdmin = meData?.role === "ADMIN"

  const { mutate: simulate, isPending: isSimulating } = useMutation({
    mutationFn: () =>
      fetch(`/api/admin/competitions/${competitionId}/simulate`, { method: "POST" }).then(async (r) => {
        let json: unknown
        try { json = await r.json() } catch { json = null }
        if (!r.ok) {
          const msg = json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string"
            ? (json as Record<string, string>).error
            : "Simulation failed"
          throw new Error(msg)
        }
        return json as { simulated: number }
      }),
    onSuccess: (data) => {
      toast.success(`Simulated ${data.simulated} fixture${data.simulated !== 1 ? "s" : ""}`)
      setConfirmSimulate(false)
      qc.invalidateQueries({ queryKey: ["fixtures", competitionId] })
      qc.invalidateQueries({ queryKey: ["table", competitionId] })
      qc.invalidateQueries({ queryKey: ["competition-stats", competitionId] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Simulation failed"),
  })

  const { mutate: simulateBracket, isPending: isSimulatingBracket } = useMutation({
    mutationFn: () =>
      fetch(`/api/admin/competitions/${competitionId}/simulate-bracket`, { method: "POST" }).then(async (r) => {
        let json: unknown
        try { json = await r.json() } catch { json = null }
        if (!r.ok) {
          const msg = json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string"
            ? (json as Record<string, string>).error
            : "Bracket simulation failed"
          throw new Error(msg)
        }
        return json as { simulated: number }
      }),
    onSuccess: (data) => {
      toast.success(`Simulated ${data.simulated} bracket match${data.simulated !== 1 ? "es" : ""}`)
      setConfirmSimulateBracket(false)
      qc.invalidateQueries({ queryKey: ["bracket", competitionId] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Bracket simulation failed"),
  })

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

      {isAdmin && (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-medium">Testing Tools</h3>
            <p className="text-sm text-muted-foreground mt-1">Auto-generate fake results for remaining fixtures.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmSimulate(true)}
            >
              Simulate All Fixtures
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmSimulateBracket(true)}
            >
              Simulate Bracket
            </Button>
          </div>
        </div>
      )}

      <SeasonEndModal
        competitionId={competitionId}
        open={showSeasonEnd}
        onClose={() => setShowSeasonEnd(false)}
      />

      <Dialog open={confirmSimulate} onOpenChange={setConfirmSimulate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Simulate all fixtures?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Fake results will be generated for all remaining scheduled fixtures. Completed matches are not affected.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmSimulate(false)} disabled={isSimulating}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => simulate()} disabled={isSimulating}>
              {isSimulating ? "Simulating…" : "Simulate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmSimulateBracket} onOpenChange={setConfirmSimulateBracket}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Simulate bracket?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Fake results will be generated for all bracket matches. A bracket must be generated first.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmSimulateBracket(false)} disabled={isSimulatingBracket}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => simulateBracket()} disabled={isSimulatingBracket}>
              {isSimulatingBracket ? "Simulating…" : "Simulate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
